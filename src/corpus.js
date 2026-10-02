import { claudeFiles, claudeRoot, parseClaudeFile } from './sources/claude.js';
import { codexFiles, codexRoot, parseCodexFile } from './sources/codex.js';

/**
 * Load prompts and failures from every available agent.
 * @param {{ since?: number, roots?: {claude?: string, codex?: string}, agents?: string[], project?: string }} opts
 * @returns {Promise<import('./types.js').Corpus>}
 */
export async function loadCorpus(opts = {}) {
  const sinceMs = opts.since ? Date.now() - opts.since : 0;
  const agents = opts.agents ?? ['claude', 'codex'];
  /** @type {import('./types.js').Corpus} */
  const corpus = { prompts: [], failures: [], sessions: 0, sessionsByAgent: {} };
  /** @type {[string, AsyncGenerator<string>, (f: string) => Promise<{prompts: import('./types.js').Prompt[], failures: import('./types.js').Failure[]}>][]} */
  const jobs = [];
  if (agents.includes('claude')) jobs.push(['claude', claudeFiles(opts.roots?.claude ?? claudeRoot(), sinceMs), parseClaudeFile]);
  if (agents.includes('codex')) jobs.push(['codex', codexFiles(opts.roots?.codex ?? codexRoot(), sinceMs), parseCodexFile]);

  for (const [agent, files, parse] of jobs) {
    for await (const file of files) {
      const { prompts, failures } = await parse(file);
      const keep = (x) =>
        (!sinceMs || x.ts === 0 || x.ts >= sinceMs) && (!opts.project || x.project.toLowerCase().includes(opts.project.toLowerCase()));
      const p = prompts.filter(keep);
      if (p.length === 0 && failures.length === 0) continue;
      corpus.prompts.push(...p);
      corpus.failures.push(...failures.filter(keep));
      corpus.sessions += 1;
      corpus.sessionsByAgent[agent] = (corpus.sessionsByAgent[agent] ?? 0) + 1;
    }
  }
  return corpus;
}
