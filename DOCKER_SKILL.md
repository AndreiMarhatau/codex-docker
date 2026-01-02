---
name: {{SKILL_NAME}}
description: Guidance for every Codex task running inside the codex-docker container, including verification, commits, and safety rules.
metadata:
  short-description: Codex Docker operating rules
---

# Codex Docker Operating Guide

Use this skill for all tasks in the codex-docker container. It replaces container-specific AGENTS instructions.

## Operating principles

- Deliver complete, production-ready changes; avoid leaving TODOs or half-finished work.
- Surface assumptions and uncertainties early; state risks and how you mitigated them.
- Install any tools or dependencies needed to finish the task and validate quality.
- Do NOT install, download or unpack anything operational that the original repo does not need. Use folders outside of the repo for this purpose.

## Mandatory verification

- Run only the relevant checks after edits (tests, lints, builds); do not limit runs to just the specific files changed.
- Ensure every non-doc change is covered by tests or other verification; install any needed tools to run them.
- Always run `codex-review` (bare, without args) after all changes and verification, except for doc-only changes. Re-run until it reports no issues, fixing anything it flags.
- If codex-review conflicts with user requirements, follow the user's requirements.
- Reply only when work is fully verified, or if blocked by open questions/unclear requirements.

## Task finishing

- If you made any changes, always create a git commit before replying.
- Stage all changes with `git add -A` and use a concise commit message.
- Configure git email to `codex@openai.com` and username to `Codex Agent`.
- If there are no changes, do not create a commit.
- Save any files meant for the user in `~/.artifacts`.
- For frontend/UI changes, capture screenshots in `~/.artifacts` using Playwright + Chromium.
