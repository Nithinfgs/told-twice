import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseClaudeFile } from '../src/sources/claude.js';
import { parseCodexFile } from '../src/sources/codex.js';
import { commandKey, errorSignature } from '../src/failures.js';

const jl = (...o) => `${o.map((x) => JSON.stringify(x)).join('\n')}\n{broken json\n\n`;

test('claude parser: human text only, sidechains and meta skipped, corrupt lines tolerated', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'told-'));
  const f = join(dir, 's.jsonl');
  await writeFile(f, jl(
    { type: 'user', sessionId: 's1', cwd: '/p', timestamp: '2026-09-01T00:00:00Z', message: { role: 'user', content: 'use pnpm please' } },
    { type: 'user', sessionId: 's1', isSidechain: true, message: { role: 'user', content: 'subagent brief' } },
    { type: 'user', sessionId: 's1', isMeta: true, message: { role: 'user', content: 'meta' } },
    { type: 'user', sessionId: 's1', message: { role: 'user', content: '<system-reminder>x</system-reminder>' } },
    { type: 'assistant', sessionId: 's1', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } },
    { type: 'user', sessionId: 's1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: [{ type: 'text', text: 'boom' }] }] } },
  ));
  const { prompts, failures } = await parseClaudeFile(f);
  assert.deepEqual(prompts.map((p) => p.text), ['use pnpm please']);
  assert.equal(prompts[0].project, '/p');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].error, 'boom');
});

test('codex parser skips injected AGENTS.md and environment context', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'told-'));
  const f = join(dir, 'r.jsonl');
  const msg = (text) => ({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
  await writeFile(f, jl({ type: 'session_meta', payload: { id: 'c1', cwd: '/q' } }, msg('# AGENTS.md instructions for /q\n...'), msg('<environment_context><cwd>/q</cwd></environment_context>'), msg('never touch main')));
  const { prompts } = await parseCodexFile(f);
  assert.deepEqual(prompts.map((p) => p.text), ['never touch main']);
  assert.equal(prompts[0].session, 'c1');
});

test('commandKey and errorSignature normalise noise', () => {
  assert.equal(commandKey('cd app && NODE_ENV=test npm run build --silent'), 'npm run build');
  assert.equal(commandKey('/usr/bin/ruff check .'), 'ruff');
  assert.equal(errorSignature('x\nError: ENOENT /home/a/b.txt line 42'), 'Error: ENOENT <path> line #');
});
