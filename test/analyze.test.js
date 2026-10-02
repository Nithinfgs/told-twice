import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyze, toRule } from '../src/analyze.js';
import { loadCorpus } from '../src/corpus.js';

const EX = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const load = () => loadCorpus({ roots: { claude: join(EX, 'sessions', 'claude'), codex: join(EX, 'sessions', 'codex') } });

test('corpus reads both agents and ignores tool results as prompts', async () => {
  const c = await load();
  assert.equal(c.sessionsByAgent.claude, 11);
  assert.equal(c.sessionsByAgent.codex, 2);
  assert.ok(!c.prompts.some((p) => p.text.includes('ERESOLVE')));
});

test('finds repeated instructions and flags the ones already written down', async () => {
  const r = await analyze(await load(), { instructionsDir: join(EX, 'acme-api'), includeGlobal: false });
  const find = (re) => r.findings.find((f) => re.test(f.rule));
  const pnpm = find(/pnpm/i);
  assert.ok(pnpm && pnpm.sessions >= 5, 'pnpm cluster spans many sessions');
  assert.equal(pnpm.status, 'ignored');
  assert.match(String(pnpm.coverage?.file), /CLAUDE\.md$/);
  assert.equal(find(/comments?/i)?.status, 'missing');
  assert.equal(find(/\bany\b/i)?.status, 'missing');
  assert.equal(find(/tests/i)?.status, 'ignored');
  assert.ok(!r.findings.some((f) => /changelog/i.test(f.rule)), 'one-off instruction is not reported');
});

test('--min raises the bar', async () => {
  const r = await analyze(await load(), { minSessions: 5, instructionsDir: join(EX, 'acme-api'), includeGlobal: false });
  assert.ok(r.findings.every((f) => f.sessions >= 5));
});

test('recurring command failures are grouped by command and error', async () => {
  const r = await analyze(await load(), { instructionsDir: join(EX, 'acme-api'), includeGlobal: false });
  assert.equal(r.failures[0].command, 'npm install');
  assert.equal(r.failures[0].sessions, 4);
});

test('analysis is deterministic', async () => {
  const opts = { instructionsDir: join(EX, 'acme-api'), includeGlobal: false };
  const a = await analyze(await load(), opts);
  const b = await analyze(await load(), opts);
  assert.deepEqual(a, b);
});

test('toRule turns a correction into a rule', () => {
  assert.equal(toRule("No, don't touch the lockfile"), "Don't touch the lockfile.");
  assert.equal(toRule('I already told you: use pnpm, not npm.'), 'Use pnpm, not npm.');
  assert.equal(toRule('No changes tonight'), 'No changes tonight.');
});
