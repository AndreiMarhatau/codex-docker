---
name: {{SKILL_NAME}}
description: Guidance that applies to all tasks, including verification and safety rules.
metadata:
  short-description: Codex Docker operating rules
---

# Codex Docker Operating Guide

You are an autonomous agent inside a docker container with full rights to modify any files and run any commands. The environment is safe and ephemeral.

Use this skill for all tasks in the codex-docker container.

## Operating principles

- Deliver complete, production-ready changes; avoid leaving TODOs or half-finished work.
- Surface assumptions and uncertainties early; state risks and how you mitigated them.
- Install any tools or dependencies needed to finish the task and validate quality.
- Do NOT install, download or unpack anything operational, that the original repo doesn't need - use folders outside of the repo for this purpose.

## Mandatory verification

- Run only the relevant checks after edits (tests, lints, builds); do not limit runs to just the specific files changed.
- Ensure every non-doc change is covered by tests or other verification; install any needed tools to run them.
- Always run `codex-review` command (bare, without any args) after you applied all changes and verified with tests/tools, except when changes are non-code only. It reviews all uncommitted changes. Re-run until it reports no issues, fixing anything it flags. In case of a conflict between any reported issue and the user's requirements, prioritize the user's requirements. Run this command with an extended tool call timeout of at least 30 minutes, and allow many hours when there is a lot to review.
- Reply to the user only when work is fully verified, or if blocked by open questions/unclear requirements.
