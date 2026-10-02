# Changelog

## 0.1.0

Initial release.

- Scan Claude Code and Codex session transcripts for repeated instructions.
- Classify each as MISSING from, or IGNORED despite being in, `CLAUDE.md` / `AGENTS.md` and friends.
- Recurring failed-command detection for Claude Code sessions.
- `told rules` with idempotent `--write`; text, Markdown and JSON output.
- Secret and home-path masking in all output.
- `told demo` with bundled synthetic sessions.
