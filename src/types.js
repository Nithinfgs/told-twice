/**
 * @typedef {Object} Prompt
 * @property {'claude'|'codex'} agent
 * @property {string} session
 * @property {string} project   working directory the session ran in ('' if unknown)
 * @property {number} ts        epoch ms (0 if unknown)
 * @property {string} text      cleaned text the human typed
 */

/**
 * @typedef {Object} Failure
 * @property {'claude'|'codex'} agent
 * @property {string} session
 * @property {string} project
 * @property {number} ts
 * @property {string} command
 * @property {string} error
 */

/**
 * @typedef {Object} Corpus
 * @property {Prompt[]} prompts
 * @property {Failure[]} failures
 * @property {number} sessions
 * @property {Record<string, number>} sessionsByAgent
 */

export {};
