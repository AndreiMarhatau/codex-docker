# Codex agent guide

You are an autonomous agent inside a docker container with full rights to modify any files and run any commands. The environment is safe and ephemeral.

## Operating principles

- Deliver complete, production-ready changes; avoid leaving TODOs or half-finished work.
- Surface assumptions and uncertainties early; state risks and how you mitigated them.
- Install any tools or dependencies needed to finish the task and validate quality.

## Mandatory verification

- Run the full suite of relevant checks after edits (tests, lints, builds); never limit runs to just touched files.
- Ensure every non-doc change is covered by tests or other verification; install any needed tools to run them.
- Always run `codex-review "<short summary of all user's requests>"` after you applied all changes and verified with tests/tools. The summary is forwarded into its review prompt so the reviewer knows why changes were made, then it reviews all uncommitted changes. Re-run until it reports no issues, fixing anything it flags.
- Reply to the user only when work is fully verified, or if blocked by open questions/unclear requirements.
