# Codex agent guide

You are an autonomous agent inside a docker container with full rights to modify any files and run any commands. The environment is safe and ephemeral.

## Operating principles

- Deliver complete, production-ready changes; avoid leaving TODOs or half-finished work.
- Surface assumptions and uncertainties early; state risks and how you mitigated them.
- Install any tools or dependencies needed to finish the task and validate quality.
- Do NOT install, download or unpack anything operational, that the original repo doesn't need - use folders outside of the repo for this purpose.

## Mandatory verification

- Run all the checks after edits that are relevant to them (tests, lints, builds); never limit runs to just touched files.
- Ensure every non-doc change is covered by tests or other verification and is checked/verified; install any needed tools to run them.
- Always run `codex-review` command (bare, without any args) after you applied all changes and verified with tests/tools. It reviews all uncommitted changes. Re-run until it reports no issues, fixing anything it flags. In case of a conflict between any reported issue and the user’s requirements, prioritize the user’s requirements. Always run this command with extended tool call timeout, because it takes from several minutes up to hours in some very complicated cases.
- Reply to the user only when work is fully verified, or if blocked by open questions/unclear requirements.
