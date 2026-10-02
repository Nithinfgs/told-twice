import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directiveStrength, extractDirectives } from '../src/detect.js';

test('recognises corrections and standing preferences', () => {
  for (const s of [
    "Don't add comments to every function.",
    'I told you, pnpm only.',
    'Always run the tests before you say it is done.',
    'Use pnpm, not npm.',
    'No, use the existing helper instead of writing a new one.',
    'Use conventional commits.',
  ]) assert.ok(directiveStrength(s) > 0, s);
});

test('ignores task descriptions, questions and agent-style narration', () => {
  for (const s of [
    'Add a rate limiter to the orders endpoint.',
    'Why is the build slow on CI?',
    "I'll then build the notebook and stop before pushing it.",
    '/clear',
    'ok',
    'It never pushes to the remote.',
    '**Heading** do not do this',
  ]) assert.equal(directiveStrength(s), 0, s);
});

test('extractDirectives splits multi-sentence prompts', () => {
  const found = extractDirectives("Fix the flaky test. Don't touch the migrations folder. Thanks.");
  assert.deepEqual(found.map((f) => f.text), ["Don't touch the migrations folder."]);
});

test('long pasted prompts and summaries are skipped', () => {
  assert.deepEqual(extractDirectives(`Don't do this. ${'x'.repeat(800)}`), []);
  assert.deepEqual(extractDirectives("This session is being continued from a previous conversation. Don't recap."), []);
});
