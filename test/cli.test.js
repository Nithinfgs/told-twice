import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main, parseSince } from '../src/cli.js';
import { applyBlock, MARK_END, MARK_START } from '../src/report.js';

async function run(args) {
  const out = [];
  const err = [];
  const code = await main(args, { out: (s) => out.push(s), err: (s) => err.push(s), isTTY: false });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('demo prints a report with missing and ignored rules', async () => {
  const { code, out } = await run(['demo']);
  assert.equal(code, 0);
  assert.match(out, /YOU KEEP SAYING THESE/);
  assert.match(out, /IGNORED/);
  assert.match(out, /MISSING/);
  assert.match(out, /COMMANDS THAT KEEP FAILING/);
});

test('json output is valid and complete', async () => {
  const { out } = await run(['demo', '--format', 'json']);
  const j = JSON.parse(out);
  assert.ok(j.findings.length >= 5);
  assert.equal(j.stats.sessions, 13);
});

test('rules prints a managed block with only missing rules', async () => {
  const { out } = await run(['rules', '--claude-dir', '/nonexistent', '--codex-dir', '/nonexistent']);
  assert.match(out, new RegExp(MARK_START));
  assert.match(out, /Nothing to add/);
});

test('rules --write is idempotent and preserves surrounding content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'told-'));
  const file = join(dir, 'AGENTS.md');
  await writeFile(file, '# Mine\n\nKeep this.\n');
  const block = `${MARK_START}\n- one\n${MARK_END}`;
  const once = applyBlock(await readFile(file, 'utf8'), block);
  const twice = applyBlock(once, `${MARK_START}\n- two\n${MARK_END}`);
  assert.match(twice, /Keep this\./);
  assert.match(twice, /- two/);
  assert.ok(!twice.includes('- one'));
  assert.equal(twice.split(MARK_START).length, 2);
});

test('bad input exits 2 with a message', async () => {
  assert.equal((await run(['bogus'])).code, 2);
  assert.equal((await run(['--format', 'xml'])).code, 2);
  assert.equal((await run(['--min', '0'])).code, 2);
  assert.equal((await run(['--since', 'soon'])).code, 1);
});

test('missing session directories are not an error', async () => {
  const { code, out } = await run(['--claude-dir', '/nonexistent', '--codex-dir', '/nonexistent']);
  assert.equal(code, 0);
  assert.match(out, /No agent sessions found/);
});

test('parseSince', () => {
  assert.equal(parseSince('all'), 0);
  assert.equal(parseSince('2d'), 172800000);
  assert.throws(() => parseSince('x'));
});
