import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { tokenize } from './text.js';

export const INSTRUCTION_FILES = [
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  'AGENTS.md',
  'GEMINI.md',
  '.cursorrules',
  '.github/copilot-instructions.md',
];

/**
 * @typedef {Object} RuleLine
 * @property {string} file
 * @property {number} line
 * @property {string} text
 * @property {Set<string>} tokens
 */

/**
 * Read the instruction files that apply to a directory (plus the user's global CLAUDE.md).
 * @param {string} dir
 * @param {{ includeGlobal?: boolean }} [opts]
 * @returns {Promise<RuleLine[]>}
 */
export async function loadInstructions(dir, opts = {}) {
  const paths = INSTRUCTION_FILES.map((f) => join(dir, f));
  if (opts.includeGlobal !== false) paths.push(join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'CLAUDE.md'));
  const rules = [];
  for (const p of paths) {
    if (!dir || !existsSync(p)) continue;
    let body;
    try {
      body = await readFile(p, 'utf8');
    } catch {
      continue;
    }
    body.split('\n').forEach((raw, i) => {
      const text = raw.replace(/^[\s>*+-]+|^\d+\.\s+/g, '').trim();
      if (text.length < 8 || text.startsWith('#') || text.startsWith('```')) return;
      rules.push({ file: p, line: i + 1, text, tokens: new Set(tokenize(text)) });
    });
  }
  return rules;
}

/**
 * Does any instruction line already cover this cluster? A line covers it when it
 * mentions most of the cluster's topical keywords.
 * @param {string[]} keywords
 * @param {RuleLine[]} rules
 */
export function findCoverage(keywords, rules) {
  const k = keywords.slice(0, 5);
  if (k.length < 2) return null;
  const need = Math.max(2, Math.ceil(k.length * 0.6));
  let best = null;
  let bestHits = 0;
  for (const r of rules) {
    const hits = k.filter((t) => r.tokens.has(t)).length;
    if (hits >= need && hits > bestHits) {
      best = r;
      bestHits = hits;
    }
  }
  return best;
}
