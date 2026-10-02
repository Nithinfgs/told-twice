import { clusterItems } from './cluster.js';
import { extractDirectives } from './detect.js';
import { recurringFailures } from './failures.js';
import { findCoverage, loadInstructions } from './instructions.js';

const LEAD = /^(?:(?:no|nope|nah|wrong|incorrect)\s*[,.!:-]\s*|(?:i )?(?:already |have already |just )?(?:told|said|asked)(?: you)?(?: to| that| not to)?[,:\s]+|as i (?:said|mentioned)[,:\s]+|again[,:\s]+|please[,:\s]+|also[,:\s]+|and[,:\s]+)+/i;

/** Turn a verbatim correction into something that reads as a rule. */
export function toRule(text) {
  let t = text.replace(LEAD, '').replace(/[\s,]*(?:again|please)[.!]*$/i, '').trim();
  if (!t) t = text.trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?`]$/.test(t) ? t : `${t}.`;
}

const score = (f) => f.sessions * 3 + Math.min(f.count, f.sessions * 2) + f.strength;

/**
 * Turn a corpus into ranked findings.
 * @param {import('./types.js').Corpus} corpus
 * @param {{ minSessions?: number, minFailureSessions?: number, instructionsDir?: string, includeGlobal?: boolean }} [opts]
 */
export async function analyze(corpus, opts = {}) {
  const minSessions = opts.minSessions ?? 2;
  const items = [];
  const seen = new Set();
  for (const p of corpus.prompts) {
    for (const d of extractDirectives(p.text)) {
      const key = `${p.session}\u0000${d.text.toLowerCase()}`;
      if (seen.has(key)) continue; // pasted twice in one session is one instruction
      seen.add(key);
      items.push({ text: d.text, strength: d.strength, session: p.session, project: p.project, agent: p.agent, ts: p.ts });
    }
  }

  const ruleCache = new Map();
  const rulesFor = async (dir) => {
    const key = opts.instructionsDir ?? dir;
    if (!ruleCache.has(key)) ruleCache.set(key, await loadInstructions(key, { includeGlobal: opts.includeGlobal }));
    return ruleCache.get(key);
  };

  const findings = [];
  for (const c of clusterItems(items)) {
    const sessions = new Set(c.members.map((m) => m.session));
    if (sessions.size < minSessions) continue;
    const projects = [...new Set(c.members.map((m) => m.project).filter(Boolean))];
    let coverage = null;
    for (const dir of projects.length ? projects : ['']) {
      coverage = findCoverage(c.keywords, await rulesFor(dir));
      if (coverage) break;
    }
    const stamps = c.members.map((m) => m.ts).filter(Boolean);
    const strength = c.members.reduce((s, m) => s + m.strength, 0) / c.members.length;
    const examples = [...new Set(c.members.map((m) => m.text))].slice(0, 3);
    findings.push({
      rule: toRule(c.representative.text),
      count: c.members.length,
      sessions: sessions.size,
      projects,
      agents: [...new Set(c.members.map((m) => m.agent))].sort(),
      first: stamps.length ? Math.min(...stamps) : 0,
      last: stamps.length ? Math.max(...stamps) : 0,
      strength: Math.round(strength * 10) / 10,
      keywords: c.keywords,
      status: coverage ? 'ignored' : 'missing',
      coverage: coverage ? { file: coverage.file, line: coverage.line, text: coverage.text } : null,
      examples,
    });
  }
  findings.sort((a, b) => score(b) - score(a) || a.rule.localeCompare(b.rule));

  return {
    stats: {
      sessions: corpus.sessions,
      sessionsByAgent: corpus.sessionsByAgent,
      prompts: corpus.prompts.length,
      instructions: items.length,
    },
    findings,
    failures: recurringFailures(corpus.failures, { minSessions: opts.minFailureSessions ?? 3 }),
  };
}
