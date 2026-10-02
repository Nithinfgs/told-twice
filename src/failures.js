const KNOWN_TOOLS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'npx', 'node', 'python', 'python3', 'pip', 'pip3', 'uv', 'poetry', 'cargo', 'go', 'make', 'git', 'docker', 'pytest', 'tsc', 'gradle', 'mvn', 'dotnet', 'rake', 'bundle']);

/** Reduce a shell command to the thing a human would call "the command". */
export function commandKey(command) {
  let c = command.trim().split('\n')[0];
  c = c.replace(/^(?:cd\s+\S+\s*&&\s*)+/, '').replace(/^(?:[A-Z_][A-Z0-9_]*=\S*\s+)+/, '');
  const words = c.split(/\s+/).filter((w) => !w.startsWith('-') || w === c.split(/\s+/)[0]);
  const head = words[0] ?? '';
  const base = head.split('/').pop() ?? head;
  if (KNOWN_TOOLS.has(base) && words[1]) {
    const runner = words[1] === 'run' && words[2] && ['npm', 'pnpm', 'yarn', 'bun'].includes(base);
    return runner ? `${base} run ${words[2]}` : `${base} ${words[1]}`;
  }
  return base;
}

/** Collapse an error into a stable signature (numbers, paths and quoted names removed). */
export function errorSignature(error) {
  const lines = error.split('\n').map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => /(error|not found|no such|cannot|can't|failed|denied|missing|refused|invalid|unknown)/i.test(l)) ?? lines[0] ?? 'non-zero exit';
  return line
    .replace(/\/[^\s:'"()]+/g, '<path>')
    .replace(/\b[0-9a-f]{7,}\b/gi, '<id>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

/**
 * Group failed shell commands that recur across sessions.
 * @param {import('./types.js').Failure[]} failures
 * @param {{ minSessions?: number }} [opts]
 */
export function recurringFailures(failures, opts = {}) {
  const minSessions = opts.minSessions ?? 3;
  const groups = new Map();
  for (const f of failures) {
    const key = commandKey(f.command);
    if (!key) continue;
    const signature = errorSignature(f.error);
    const id = `${key}\u0000${signature}`;
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { command: key, signature, example: f.command, projects: new Set(), sessions: new Set(), count: 0 }));
    g.count += 1;
    g.sessions.add(f.session);
    if (f.project) g.projects.add(f.project);
  }
  return [...groups.values()]
    .filter((g) => g.sessions.size >= minSessions)
    .map((g) => ({ ...g, sessions: g.sessions.size, projects: [...g.projects] }))
    .sort((a, b) => b.sessions - a.sessions || b.count - a.count || a.command.localeCompare(b.command));
}
