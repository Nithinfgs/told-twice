// Decides which sentences a human typed are *instructions to the agent*
// (corrections, constraints, standing preferences) rather than task descriptions.

const TOLD_YOU = /\b(i (?:already |have already |just )?(?:told|said|asked|mentioned)(?: you)?|as i (?:said|mentioned|told)|how many times|i keep (?:telling|saying|having to)|(?:like|as) i (?:said|told))\b/i;
const NEGATIVE = /\b(never|stop|don'?t|dont|do not|must not|should not|shouldn'?t|mustn'?t|no need (?:to|for)|avoid|without (?:adding|writing|using|creating|touching))\b/i;
const STANDING = /\b(always|make sure|be sure to|remember to|only (?:ever )?use|prefer|every time|each time)\b/i;
const SWAP = /\b(instead of|rather than|not [`'"]?[\w./-]+[`'"]?[,;] (?:use|but)|use [`'"]?[\w./-]+[`'"]? (?:not|instead))\b/i;
const OPENER = /^(no|nope|wrong|incorrect|revert|undo|nah)\b[\s,.!:-]/i;
const IMPERATIVE_USE = /^(?:please |also )?(?:use|run|write|keep|put|name|prefix)\b/i;

/**
 * Score how strongly a sentence reads as a standing instruction (0 = not one).
 * @param {string} sentence
 */
export function directiveStrength(sentence) {
  const s = sentence.trim();
  if (s.length < 12 || s.length > 280) return 0;
  if (s.startsWith('/') || s.includes('**') || NOT_A_DIRECTIVE.test(s)) return 0;
  let score = 0;
  if (TOLD_YOU.test(s)) score += 3;
  if (NEGATIVE.test(s)) score += 2;
  if (SWAP.test(s)) score += 2;
  if (STANDING.test(s)) score += 1;
  if (OPENER.test(s)) score += 1;
  if (IMPERATIVE_USE.test(s)) score += 1;
  // questions are rarely instructions unless they carry an explicit marker
  if (s.endsWith('?') && score < 3) return 0;
  return score;
}

// Programmatic or non-human prompts: summaries, interrupts, agent-written briefs.
const AUTOMATED = /^(this session is being continued|caveat:|\[request interrupted|resume directly|you are (?:an?|the) )/i;
const NOT_A_DIRECTIVE = /^(i'll|i will|i'm|i am|i've|i have(?! already)|let me|we'll|we will|it |it's|this |that |there |the |these |those )/i;
const MAX_PROMPT_CHARS = 700;

/** Split a prompt into sentence-like units. */
export function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z`'"(])|\s*[;\n]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extract directive sentences from a prompt.
 * @param {string} text
 * @returns {{text: string, strength: number}[]}
 */
export function extractDirectives(text) {
  const out = [];
  // corrections are short; long prompts are task briefs, pasted logs or agent-written handoffs
  if (text.length > MAX_PROMPT_CHARS || AUTOMATED.test(text)) return out;
  for (const s of sentences(text)) {
    const strength = directiveStrength(s);
    if (strength > 0) out.push({ text: s, strength });
  }
  return out;
}
