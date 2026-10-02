# Security Policy

## What this tool touches

- **Reads:** `~/.claude/projects/**/*.jsonl`, `~/.codex/sessions/**/*.jsonl` (or `CLAUDE_CONFIG_DIR` / `CODEX_HOME`), and instruction files (`CLAUDE.md`, `AGENTS.md`, …) in the project directories those sessions ran in.
- **Writes:** only with `told rules --write FILE`, and only between the `told-twice` markers.
- **Network:** none. There are no HTTP calls, telemetry or update checks.

Transcripts can contain secrets. The tool masks common credential shapes and your home path in all output, but masking is best-effort pattern matching: **review a report before sharing it.**

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: *Security → Report a vulnerability* on this repository. Do not open a public issue for security problems. I aim to respond within a week.

## Supported versions

Only the latest release is supported.
