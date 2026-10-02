// Regenerates the synthetic sessions under examples/sessions. Deterministic, no real data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const CWD = '/home/dev/acme-api';

const claudeSessions = [
  { day: '2026-08-04', say: ['Add a rate limiter middleware to the orders endpoint.', "Use pnpm, not npm. This repo is a pnpm workspace."], fails: [['npm install', 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve']] },
  { day: '2026-08-07', say: ['Refactor the invoice service to use the new money type.', "Stop adding comments to every function, it's noisy.", "Don't use any in TypeScript, use unknown and narrow it."] },
  { day: '2026-08-11', say: ['Write a migration that adds a deleted_at column to users.', 'Do not edit existing migration files, create a new one.', 'I told you, pnpm only. No npm install.'], fails: [['npm install', 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve']] },
  { day: '2026-08-14', say: ['Fix the flaky webhook retry test.', "Always run the tests before you say it's done.", 'Use conventional commits for the commit message.'] },
  { day: '2026-08-19', say: ['Add pagination to GET /customers.', 'Never use the any type, use proper types or unknown.', "Please don't add explanatory comments to the code unless I ask."] },
  { day: '2026-08-22', say: ['Why is the build slow on CI?', 'Make sure to run pnpm test before telling me it is finished.', 'Stop running npm install, this repo uses pnpm.'], fails: [['npm install', 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve']] },
  { day: '2026-08-26', say: ['Port the PDF export to the new template engine.', 'Always write commit messages in conventional commit format.', "Don't forget to update the changelog for this release."] },
  { day: '2026-08-29', say: ['Add an audit log table.', 'Never modify old migrations, add a new migration instead.', 'No comments please. Remove the comments you added.'], fails: [['npm run dev', 'npm ERR! Missing script: "dev"']] },
  { day: '2026-09-02', say: ['Speed up the search query.', 'Stop using any types. Use unknown instead of any.', 'Run the tests before you tell me you are done.'], fails: [['npm run dev', 'npm ERR! Missing script: "dev"']] },
  { day: '2026-09-05', say: ['Bump the Node version in CI.', 'Use pnpm instead of npm for installing dependencies.', 'Use conventional commits.'], fails: [['npm run dev', 'npm ERR! Missing script: "dev"'], ['npm install', 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve']] },
  { day: '2026-09-09', say: ['Clean up the dead feature flags.', "Don't add docstrings or comments unless I ask for them."] },
];

const codexSessions = [
  { day: '2026-09-12', say: ['Add a /health endpoint.', "I already told you: use pnpm, not npm."] },
  { day: '2026-09-15', say: ['Tighten the OpenAPI schema for orders.', 'Use pnpm instead of npm, please.', "Don't add comments to every function."] },
];

const line = (o) => `${JSON.stringify(o)}\n`;
const at = (day, n) => `${day}T09:${String(n).padStart(2, '0')}:00.000Z`;

claudeSessions.forEach((s, i) => {
  const id = `demo-claude-${String(i + 1).padStart(2, '0')}`;
  let out = '';
  s.say.forEach((text, n) => {
    out += line({ type: 'user', sessionId: id, cwd: CWD, timestamp: at(s.day, n * 5), message: { role: 'user', content: [{ type: 'text', text }] } });
    out += line({ type: 'assistant', sessionId: id, cwd: CWD, timestamp: at(s.day, n * 5 + 1), message: { role: 'assistant', content: [{ type: 'text', text: 'On it.' }] } });
  });
  (s.fails ?? []).forEach(([command, error], n) => {
    const tid = `${id}-t${n}`;
    out += line({ type: 'assistant', sessionId: id, cwd: CWD, timestamp: at(s.day, 30 + n), message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name: 'Bash', input: { command } }] } });
    out += line({ type: 'user', sessionId: id, cwd: CWD, timestamp: at(s.day, 31 + n), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, is_error: true, content: error }] } });
  });
  const dir = join(root, 'sessions', 'claude', '-home-dev-acme-api');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.jsonl`), out);
});

codexSessions.forEach((s, i) => {
  const id = `demo-codex-${i + 1}`;
  let out = line({ type: 'session_meta', timestamp: at(s.day, 0), payload: { id, cwd: CWD } });
  s.say.forEach((text, n) => {
    out += line({ type: 'response_item', timestamp: at(s.day, n + 1), payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
  });
  const dir = join(root, 'sessions', 'codex', '2026', '09', s.day.slice(8));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `rollout-${id}.jsonl`), out);
});
console.log(`wrote ${claudeSessions.length} claude + ${codexSessions.length} codex sample sessions`);
