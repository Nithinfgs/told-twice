// Text cleaning, secret masking and tokenisation shared by the detectors.

const TAG_BLOCKS = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/gi,
  /<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>/gi,
  /<environment_context>[\s\S]*?<\/environment_context>/gi,
  /<command-(?:name|message|args)>[\s\S]*?<\/command-(?:name|message|args)>/gi,
  /<local-command-(?:stdout|caveat)>[\s\S]*?<\/local-command-(?:stdout|caveat)>/gi,
  /<([a-z]+[-_][a-z_-]+)[^>]*>[\s\S]*?<\/\1>/gi, // any other harness-injected hyphen/underscore tag block
];

/** Remove harness-injected blocks so only what the human typed remains. */
export function stripInjected(text) {
  let out = text;
  for (const re of TAG_BLOCKS) out = out.replace(re, ' ');
  out = out.replace(/```[\s\S]*?```/g, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\b[0-9a-f]{32,}\b/gi,
];

const ENV_ASSIGN = /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD))\s*[=:]\s*\S{6,}/g;

/** Mask anything that looks like a credential before it reaches any output. */
export function maskSecrets(text) {
  let out = text.replace(ENV_ASSIGN, '$1=[redacted]');
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  return out;
}

/** Replace the home directory so reports are safe to paste. */
export function maskHome(text, home) {
  if (!home) return text;
  return text.split(home).join('~');
}

export const STOPWORDS = new Set(
  `a an the and or but if then else so to of in on at by for with from as is are was were be been being it its this that these those
  i me my we our you your he she they them their do does did done doing have has had having will would should could can may might must
  just please really very also too not no yes ok okay now again still already always never don't dont do not use using used
  stop make sure avoid prefer instead rather told said asked tell telling say only every each time unless need want like thing please
  there here what which who when where why how all some more most other into out up down over under about than`
    .split(/\s+/),
);
// "not", "never", "always", "use" carry meaning for directives but are noise for clustering
// topics, so they are stopwords only for the topical vector; directive detection runs on raw text.

/** Light stemmer: enough to merge "tests"/"testing"/"tested" without a dictionary. */
export function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

/** Topical tokens for clustering: lowercase, stemmed, stopwords removed. */
export function tokenize(text) {
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9_.+-]*[a-z0-9]|[a-z0-9]/g) ?? [];
  const out = [];
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 2) continue;
    out.push(stem(w));
  }
  return out;
}
