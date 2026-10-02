import { maskHome, maskSecrets } from './text.js';
import { homedir } from 'node:os';

const clean = (s) => maskHome(maskSecrets(s), homedir());
const shortPath = (p) => (p.startsWith(`${process.cwd()}/`) ? p.slice(process.cwd().length + 1) : maskHome(p, homedir()));

/** @param {boolean} on */
function palette(on) {
  const w = (open, close) => (s) => (on ? `\u001b[${open}m${s}\u001b[${close}m` : s);
  return { bold: w(1, 22), dim: w(2, 22), red: w(31, 39), yellow: w(33, 39), green: w(32, 39), cyan: w(36, 39) };
}

const day = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : '?');

/**
 * Human-readable terminal report.
 * @param {Awaited<ReturnType<typeof import('./analyze.js').analyze>>} r
 * @param {{ color?: boolean, limit?: number, label?: string }} [opts]
 */
export function renderText(r, opts = {}) {
  const c = palette(opts.color ?? false);
  const limit = opts.limit ?? 10;
  const agents = Object.entries(r.stats.sessionsByAgent).map(([a, n]) => `${a} ${n}`).join(', ') || 'none';
  const out = [];
  out.push(`${c.bold('told-twice')}  ${c.dim(`${r.stats.sessions} sessions (${agents}) · ${r.stats.instructions} instructions found${opts.label ? ` · ${opts.label}` : ''}`)}`);
  out.push('');

  if (r.stats.sessions === 0) {
    out.push('No agent sessions found. Looked for Claude Code (~/.claude/projects) and Codex (~/.codex/sessions).');
    out.push('Try `told demo` to see what a report looks like.');
    return out.join('\n');
  }

  if (r.findings.length === 0) {
    out.push(c.green('Nothing repeated across sessions. Either you are very consistent or the window is short (try --since all).'));
  } else {
    out.push(c.bold(`YOU KEEP SAYING THESE  (${r.findings.length})`));
    out.push('');
    r.findings.slice(0, limit).forEach((f, i) => {
      const tag = f.status === 'ignored' ? c.yellow('IGNORED') : c.red('MISSING');
      out.push(`${String(i + 1).padStart(2)}. ${c.bold(`×${f.count}`)} in ${f.sessions} sessions  ${tag}  ${c.dim(`${day(f.first)} → ${day(f.last)}`)}`);
      out.push(`    ${c.cyan(clean(f.rule))}`);
      if (f.status === 'ignored' && f.coverage) {
        out.push(c.dim(`    already written at ${shortPath(f.coverage.file)}:${f.coverage.line} — the agent is not following it`));
        out.push(c.dim(`    > ${clean(f.coverage.text).slice(0, 100)}`));
      } else {
        out.push(c.dim(`    not in any CLAUDE.md / AGENTS.md · e.g. "${clean(f.examples[f.examples.length - 1]).slice(0, 52)}"`));
      }
      out.push('');
    });
    if (r.findings.length > limit) out.push(c.dim(`    …and ${r.findings.length - limit} more (use --limit or --format json)`), '');
  }

  if (r.failures.length) {
    out.push(c.bold(`COMMANDS THAT KEEP FAILING  (${r.failures.length})`));
    out.push('');
    for (const f of r.failures.slice(0, 5)) {
      out.push(`    ${c.bold(`\`${f.command}\``)} failed in ${f.sessions} sessions: ${c.dim(clean(f.signature))}`);
    }
    out.push('');
  }

  const missing = r.findings.filter((f) => f.status === 'missing').length;
  if (missing) out.push(`${c.green('Next:')} run ${c.bold('told rules')} to get the ${missing} missing rule${missing === 1 ? '' : 's'} as a paste-ready block.`);
  return out.join('\n');
}

export const MARK_START = '<!-- told-twice:start -->';
export const MARK_END = '<!-- told-twice:end -->';

/**
 * The paste-ready block of rules that no instruction file contains yet.
 * @param {Awaited<ReturnType<typeof import('./analyze.js').analyze>>} r
 */
export function renderRules(r) {
  const lines = [MARK_START, '## Standing instructions (from repeated corrections)', ''];
  const missing = r.findings.filter((f) => f.status === 'missing');
  for (const f of missing) lines.push(`- ${clean(f.rule)}`);
  if (r.failures.length) {
    lines.push('', '## Commands that fail here');
    for (const f of r.failures) lines.push(`- \`${f.command}\` has failed in ${f.sessions} past sessions (${clean(f.signature)}). Check before running it.`);
  }
  if (missing.length === 0 && r.failures.length === 0) lines.push('_Nothing to add: every repeated instruction is already written down._');
  lines.push(MARK_END);
  return lines.join('\n');
}

/** Insert or replace the managed block in an existing file body. */
export function applyBlock(body, block) {
  const s = body.indexOf(MARK_START);
  const e = body.indexOf(MARK_END);
  if (s !== -1 && e > s) return body.slice(0, s) + block + body.slice(e + MARK_END.length);
  return `${body.replace(/\s*$/, '')}\n\n${block}\n`;
}

/** @param {Awaited<ReturnType<typeof import('./analyze.js').analyze>>} r */
export function renderMarkdown(r) {
  const out = ['# told-twice report', '', `${r.stats.sessions} sessions, ${r.stats.instructions} instructions found.`, ''];
  out.push('| # | Rule | Said | Sessions | Status |', '|---|------|------|----------|--------|');
  r.findings.forEach((f, i) => out.push(`| ${i + 1} | ${clean(f.rule).replace(/\|/g, '\\|')} | ×${f.count} | ${f.sessions} | ${f.status} |`));
  if (r.failures.length) {
    out.push('', '## Recurring command failures', '');
    for (const f of r.failures) out.push(`- \`${f.command}\` — ${f.sessions} sessions — ${clean(f.signature)}`);
  }
  return out.join('\n');
}

function scrub(v) {
  if (typeof v === 'string') return clean(v);
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)]));
  return v;
}

/** @param {Awaited<ReturnType<typeof import('./analyze.js').analyze>>} r */
export function renderJson(r) {
  return JSON.stringify(scrub(r), null, 2);
}
