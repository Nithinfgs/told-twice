import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maskHome, maskSecrets, stem, stripInjected, tokenize } from '../src/text.js';

test('maskSecrets redacts common credential shapes', () => {
  const fakes = [
    'sk-abcdefghijklmnopqrstuvwx',
    `ghp_${'a'.repeat(36)}`,
    'AKIAABCDEFGHIJKLMNOP',
    'Bearer abcdefghijklmnopqrstuvwxyz012345',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop',
  ];
  for (const f of fakes) assert.ok(!maskSecrets(`token ${f} end`).includes(f.slice(5, 20)), f);
  assert.equal(maskSecrets('export API_KEY=supersecretvalue now'), 'export API_KEY=[redacted] now');
  assert.equal(maskSecrets('plain sentence'), 'plain sentence');
});

test('maskHome hides the home directory', () => {
  assert.equal(maskHome('/Users/me/proj/CLAUDE.md', '/Users/me'), '~/proj/CLAUDE.md');
});

test('stripInjected removes harness blocks, code fences and tags', () => {
  const t = stripInjected('<system-reminder>ignore</system-reminder> use pnpm ```js\nconst a = 1\n``` <task-notification>x</task-notification> thanks');
  assert.equal(t, 'use pnpm thanks');
});

test('tokenize drops stopwords and stems', () => {
  assert.deepEqual(tokenize('Always running the tests'), ['runn', 'test']);
  assert.equal(stem('tests'), 'test');
  assert.equal(stem('comments'), 'comment');
  assert.ok(tokenize('use the any type').includes('any'));
});
