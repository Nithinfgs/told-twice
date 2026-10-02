import { homedir } from 'node:os';
import { join } from 'node:path';
import { stripInjected } from '../text.js';
import { mtimeMs, readJsonl, walkJsonl } from './files.js';

export function claudeRoot(env = process.env) {
  return join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');
}

/** @param {unknown} content */
function humanText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  // tool results arrive as "user" messages too; only text blocks are human input
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

/** @param {unknown} content */
function resultText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n');
}

/**
 * Read one Claude Code session file.
 * @returns {Promise<{prompts: import('../types.js').Prompt[], failures: import('../types.js').Failure[]}>}
 */
export async function parseClaudeFile(path) {
  /** @type {import('../types.js').Prompt[]} */
  const prompts = [];
  /** @type {import('../types.js').Failure[]} */
  const failures = [];
  const pending = new Map(); // tool_use id -> command
  let session = '';
  let project = '';
  for await (const e of readJsonl(path)) {
    if (!session && typeof e.sessionId === 'string') session = e.sessionId;
    if (!project && typeof e.cwd === 'string') project = e.cwd;
    if (e.isSidechain || e.isMeta) continue; // sub-agent traffic is not the human talking
    const ts = e.timestamp ? Date.parse(e.timestamp) || 0 : 0;
    const msg = e.message;
    if (!msg || typeof msg !== 'object') continue;

    if (e.type === 'assistant' && Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b?.type === 'tool_use' && b.name === 'Bash' && typeof b.input?.command === 'string') {
          pending.set(b.id, b.input.command);
        }
      }
    } else if (e.type === 'user') {
      if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b?.type === 'tool_result' && b.is_error && pending.has(b.tool_use_id)) {
            failures.push({
              agent: 'claude',
              session: session || path,
              project,
              ts,
              command: /** @type {string} */ (pending.get(b.tool_use_id)),
              error: resultText(b.content),
            });
          }
        }
      }
      const text = stripInjected(humanText(msg.content));
      if (text) prompts.push({ agent: 'claude', session: session || path, project, ts, text });
    }
  }
  return { prompts, failures };
}

/** Yield session files newer than `sinceMs`. */
export async function* claudeFiles(root, sinceMs) {
  for await (const f of walkJsonl(root)) {
    if (sinceMs && (await mtimeMs(f)) < sinceMs) continue;
    yield f;
  }
}
