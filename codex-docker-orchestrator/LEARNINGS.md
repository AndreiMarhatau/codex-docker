# Codex Docker Orchestrator Learnings

This document captures verified CLI behavior for non-interactive Codex task orchestration.

## Environment
- Codex CLI version: 0.75.0
- Executed inside `/workspace/codex-docker`

## Verified behavior

### 1) `codex exec --json` emits a resumable session id
Command:
```
codex exec --json --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox "Respond with the single word OK."
```
Observed JSONL (first event):
```
{"type":"thread.started","thread_id":"019b341f-04d9-73b3-8263-2c05ca63d690"}
```
Conclusion: the resumable id is emitted as `thread_id` on the `thread.started` event.

### 2) Resume is non-interactive with `codex exec --json resume`
Command:
```
codex exec --json resume 019b341f-04d9-73b3-8263-2c05ca63d690 "Say AGAIN"
```
Observed JSONL:
```
{"type":"thread.started","thread_id":"019b341f-04d9-73b3-8263-2c05ca63d690"}
...
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"AGAIN"}}
```
Conclusion: `codex exec --json resume <thread_id> <prompt>` works non-interactively and emits JSONL.

### 3) `--last` works for non-interactive resume
Command:
```
codex exec --json resume --last "Say LAST"
```
Observed JSONL:
```
{"type":"thread.started","thread_id":"019b341f-04d9-73b3-8263-2c05ca63d690"}
...
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"LAST"}}
```
Conclusion: `--last` resumes the most recent session without needing an explicit id.

### 4) Resume is not tied to the working directory
Commands:
```
codex exec --json -C /tmp resume 019b341f-04d9-73b3-8263-2c05ca63d690 "Say TMP"
```
Output:
```
Not inside a trusted directory and --skip-git-repo-check was not specified.
```
Then:
```
codex exec --json -C /tmp --skip-git-repo-check resume 019b341f-04d9-73b3-8263-2c05ca63d690 "Say TMP"
```
Observed JSONL:
```
{"type":"thread.started","thread_id":"019b341f-04d9-73b3-8263-2c05ca63d690"}
...
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"TMP"}}
```
Conclusion: resume is session-id based, not bound to the repository path. The repo check still applies unless `--skip-git-repo-check` is passed.

## Practical implications for a UI orchestrator
- Store `thread_id` from `codex exec --json` for future resumes.
- Use `codex exec --json resume <thread_id> "<prompt>"` for one-shot resume calls.
- If the UI runs in a repo worktree, `--skip-git-repo-check` should not be needed.
- Host-side git push/PR creation can be done outside the container if desired; Codex can operate locally without pushing.
