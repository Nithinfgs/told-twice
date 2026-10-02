import { tokenize } from './text.js';

/**
 * @typedef {Object} Item
 * @property {string} text
 * @property {string} session
 * @property {string} project
 * @property {string} agent
 * @property {number} ts
 * @property {number} strength
 */

/** @param {Map<string, number>} a @param {Map<string, number>} b */
function cosine(a, b) {
  let dot = 0;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (w) dot += v * w;
  }
  return dot === 0 ? 0 : dot / (norm(a) * norm(b));
}

/** @param {Map<string, number>} v */
function norm(v) {
  let s = 0;
  for (const x of v.values()) s += x * x;
  return Math.sqrt(s) || 1;
}

/**
 * Greedy centroid clustering on TF-IDF vectors. Deterministic: items are
 * processed in input order after a stable sort by length.
 * @param {Item[]} items
 * @param {{ threshold?: number }} [opts]
 */
export function clusterItems(items, opts = {}) {
  const threshold = opts.threshold ?? 0.25;
  const docs = items.map((it) => tokenize(it.text));
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = items.length || 1;
  const idf = (t) => Math.log(1 + n / (df.get(t) ?? 1));

  const vecs = docs.map((d) => {
    const v = new Map();
    for (const t of d) v.set(t, (v.get(t) ?? 0) + 1);
    for (const [t, c] of v) v.set(t, (1 + Math.log(c)) * idf(t));
    return v;
  });

  /** @type {{ centroid: Map<string, number>, members: number[] }[]} */
  const clusters = [];
  const order = items.map((_, i) => i).sort((a, b) => items[a].text.length - items[b].text.length || a - b);
  for (const i of order) {
    if (vecs[i].size === 0) continue;
    let best = -1;
    let bestSim = 0;
    for (let c = 0; c < clusters.length; c++) {
      const sim = cosine(vecs[i], clusters[c].centroid);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    if (best >= 0 && bestSim >= threshold) {
      const cl = clusters[best];
      cl.members.push(i);
      for (const [t, w] of vecs[i]) cl.centroid.set(t, (cl.centroid.get(t) ?? 0) + w);
    } else {
      clusters.push({ centroid: new Map(vecs[i]), members: [i] });
    }
  }

  return clusters.map((cl) => {
    const members = cl.members.map((i) => items[i]);
    // representative: member closest to the centroid
    let rep = cl.members[0];
    let repSim = -1;
    for (const i of cl.members) {
      const sim = cosine(vecs[i], cl.centroid);
      if (sim > repSim) {
        repSim = sim;
        rep = i;
      }
    }
    // topical keywords: tokens present in at least half the members, heaviest first
    const need = Math.ceil(cl.members.length / 2);
    const counts = new Map();
    for (const i of cl.members) for (const t of new Set(docs[i])) counts.set(t, (counts.get(t) ?? 0) + 1);
    const keywords = [...counts]
      .filter(([, c]) => c >= need)
      .sort((a, b) => (cl.centroid.get(b[0]) ?? 0) - (cl.centroid.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([t]) => t);
    return { members, representative: items[rep], keywords };
  });
}
