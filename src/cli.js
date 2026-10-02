import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { analyze } from './analyze.js';
import { loadCorpus } from './corpus.js';
import { applyBlock, renderJson, renderMarkdown, renderRules, renderText } from './report.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = resolve(HERE, '..', 'examples');

const HELP = `told-twice: find the instructions you keep repeating to your coding agent

Usage
  told [scan] [options]     Rank repeated instructions across your sessions
  told rules [options]      Print the missing ones as a paste-ready CLAUDE.md / AGENTS.md block
  told demo                 Run on bundled sample sessions (no real data touched)

Options
  --since <30d|12h|all>     Time window (default: 60d)
  --min <n>                 Minimum sessions a rule must repeat in (default: 2)
  --project <text>          Only sessions whose directory contains <text>
  --agent <claude|codex>    Only one agent (default: both)
  --limit <n>               Rows to print (default: 10)
  --format <text|md|json>   Output format (default: text)
  --write <file>            With "rules": insert into <file> between told-twice markers
  --claude-dir <dir>        Claude Code projects dir (default: ~/.claude/projects)
  --codex-dir <dir>         Codex sessions dir (default: ~/.codex/sessions)
  --no-global               Ignore ~/.claude/CLAUDE.md when checking coverage
  --no-color                Disable colors
  -v, --version | -h, --help

Everything runs locally. Nothing is uploaded and no API key is needed.
`;

/** @param {string} v */
export function parseSince(v) {
  if (v === 'all') return 0;
  const m = /^(\d+)([hdw])$/.exec(v);
  if (!m) throw new Error(`Invalid --since "${v}". Use e.g. 12h, 30d, 8w or all.`);
  const unit = { h: 3600e3, d: 86400e3, w: 604800e3 }[m[2]];
  return Number(m[1]) * unit;
}

/**
 * @param {string[]} argv
 * @param {{ out?: (s: string) => void, err?: (s: string) => void, isTTY?: boolean }} [io]
 * @returns {Promise<number>} exit code
 */
export async function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(`${s}\n`));
  const err = io.err ?? ((s) => process.stderr.write(`${s}\n`));
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        since: { type: 'string', default: '60d' },
        min: { type: 'string', default: '2' },
        project: { type: 'string' },
        agent: { type: 'string' },
        limit: { type: 'string', default: '10' },
        format: { type: 'string', default: 'text' },
        write: { type: 'string' },
        'claude-dir': { type: 'string' },
        'codex-dir': { type: 'string' },
        'no-global': { type: 'boolean', default: false },
        'no-color': { type: 'boolean', default: false },
        version: { type: 'boolean', short: 'v', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (e) {
    err(`${/** @type {Error} */ (e).message}\n\n${HELP}`);
    return 2;
  }
  const { values: v, positionals } = parsed;
  if (v.help) return out(HELP), 0;
  if (v.version) {
    const pkg = JSON.parse(await readFile(join(HERE, '..', 'package.json'), 'utf8'));
    return out(pkg.version), 0;
  }

  const cmd = positionals[0] ?? 'scan';
  if (!['scan', 'rules', 'demo'].includes(cmd)) {
    err(`Unknown command "${cmd}".\n\n${HELP}`);
    return 2;
  }
  if (!['text', 'md', 'json'].includes(v.format)) {
    err(`Invalid --format "${v.format}". Use text, md or json.`);
    return 2;
  }
  if (v.agent && !['claude', 'codex'].includes(v.agent)) {
    err(`Invalid --agent "${v.agent}". Use claude or codex.`);
    return 2;
  }
  const min = Number(v.min);
  const limit = Number(v.limit);
  if (!Number.isInteger(min) || min < 1 || !Number.isInteger(limit) || limit < 1) {
    err('--min and --limit must be positive integers.');
    return 2;
  }

  try {
    const demo = cmd === 'demo';
    const roots = demo
      ? { claude: join(EXAMPLES, 'sessions', 'claude'), codex: join(EXAMPLES, 'sessions', 'codex') }
      : { claude: v['claude-dir'], codex: v['codex-dir'] };
    const corpus = await loadCorpus({
      since: demo ? 0 : parseSince(/** @type {string} */ (v.since)),
      roots,
      agents: v.agent ? [v.agent] : undefined,
      project: v.project,
    });
    const result = await analyze(corpus, {
      minSessions: min,
      instructionsDir: demo ? join(EXAMPLES, 'acme-api') : undefined,
      includeGlobal: demo ? false : !v['no-global'],
    });

    if (cmd === 'rules') {
      const block = renderRules(result);
      if (v.write) {
        const target = resolve(v.write);
        let body = '';
        try {
          body = await readFile(target, 'utf8');
        } catch {
          /* new file */
        }
        await writeFile(target, applyBlock(body, block));
        err(`Wrote ${result.findings.filter((f) => f.status === 'missing').length} rule(s) to ${target}`);
      } else out(block);
      return 0;
    }

    const color = !v['no-color'] && !process.env.NO_COLOR && (io.isTTY ?? Boolean(process.stdout.isTTY));
    if (v.format === 'json') out(renderJson(result));
    else if (v.format === 'md') out(renderMarkdown(result));
    else out(renderText(result, { color, limit, label: demo ? 'bundled demo data' : undefined }));
    return 0;
  } catch (e) {
    err(`told: ${/** @type {Error} */ (e).message}`);
    return 1;
  }
}
