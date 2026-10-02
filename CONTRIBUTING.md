# Contributing

Thanks for helping. This is a small, dependency-free Node project.

## Setup

```bash
npm install
npm run check
```

`npm run check` runs the type check (`tsc` over JSDoc-annotated JS) and the test suite (`node --test`). CI runs the same on Node 18, 20, 22 and on Linux, macOS and Windows.

## Most useful contributions

1. **Detector misses and false positives.** Open an issue with the sentence (anonymised) and what you expected. Better: add it to `test/detect.test.js`.
2. **New transcript sources.** Add `src/sources/<agent>.js` exporting a parser that returns `{ prompts, failures }`, wire it into `src/corpus.js`, and add a fixture test in the style of `test/parsers.test.js`.
3. **Other languages' directive patterns** in `src/detect.js`.

## Ground rules

- No runtime dependencies without a strong reason.
- No network access, ever. The tool must stay fully local.
- Never put real transcripts in fixtures. Use synthetic data (`scripts/gen-examples.mjs`).
- Anything printed must go through `maskSecrets` / `maskHome` (see `src/report.js`).
- Keep analysis deterministic: same input, same output.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Pull requests

Describe the behaviour change and add a test. Keep PRs focused.
