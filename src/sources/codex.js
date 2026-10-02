import { homedir } from 'node:os';
import { join } from 'node:path';
import { stripInjected } from '../text.js';
import { mtimeMs, readJsonl, walkJsonl } from './files.js';

export function codexRoot(env = process.env) {
  return join(env.CODEX_HOME || join(homedir(), '.codex'), 'sessions');
}

/**
 * Read one Codex rollout file (user prompts only; Codex tool output
 * formats vary too much between versions to mine failures reliably).
 * @returns {Promise<{prompts: import('../types.js').Prompt[], failures: import('../types.js').Failure[]}>}
 */
export async function parseCodexFile(path) {
  /** @type {import('../types.js').Prompt[]} */
  const prompts = [];
  let session = path;
  let project = '';
  for await (const e of readJsonl(path)) {
    const p = e.payload;
    if (!p || typeof p !== 'object') continue;
    if (e.type === 'session_meta') {
      if (typeof p.id === 'string') session = p.id;
      if (typeof p.cwd === 'string') project = p.cwd;
      continue;
    }
    if (e.type !== 'response_item' || p.type !== 'message' || p.role !== 'user') continue;
    if (!Array.isArray(p.content)) continue;
    const raw = p.content
      .filter((b) => b && b.type === 'input_text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
    // Codex injects AGENTS.md and environment context as user messages
    if (/^\s*(# AGENTS\.md instructions|<environment_context>|<user_instructions>)/.test(raw)) continue;
    const text = stripInjected(raw);
    if (text) prompts.push({ agent: 'codex', session, project, ts: e.timestamp ? Date.parse(e.timestamp) || 0 : 0, text });
  }
  return { prompts, failures: [] };
}

export async function* codexFiles(root, sinceMs) {
  for await (const f of walkJsonl(root)) {
    if (sinceMs && (await mtimeMs(f)) < sinceMs) continue;
    yield f;
  }
}
