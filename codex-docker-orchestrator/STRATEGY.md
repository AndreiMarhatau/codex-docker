# Codex Docker Orchestrator Strategy

This strategy defines the exact, end-to-end flow for managing repo environments and Codex tasks with resume support, using `codex-docker` as the worker.

## Storage layout (host)
```
~/.codex-orchestrator/
  envs/<env_id>/
    repo.url
    default_branch
    mirror/           (bare mirror clone)
  tasks/<task_id>/
    meta.json
    worktree/
    logs/
      run-001.jsonl
      run-002.jsonl
```

## Repo environment lifecycle

### Create repo environment
1. Generate `env_id`.
2. Create `~/.codex-orchestrator/envs/<env_id>/`.
3. Write `repo.url` and `default_branch`.
4. Create a bare mirror:
   - `git clone --mirror <repo_url> ~/.codex-orchestrator/envs/<env_id>/mirror`
5. Validate the default branch exists:
   - `git --git-dir .../mirror show-ref --verify refs/heads/<default_branch>`

### Remove repo environment
1. Delete all tasks linked to this env (see task removal flow below).
2. Remove `~/.codex-orchestrator/envs/<env_id>/` entirely.

## Task lifecycle

### Create task (one-shot)
1. Generate `task_id`.
2. Fetch the latest refs:
   - `git --git-dir .../mirror fetch --all --prune`
3. Create the worktree:
   - `git --git-dir .../mirror worktree add <task_dir>/worktree <ref>`
4. Create a local task branch:
   - `git -C <task_dir>/worktree checkout -b codex/<task_id>`
5. Run Codex non-interactively:
   - `codex-docker exec --json "<prompt>"`
6. Capture JSONL logs to `logs/run-001.jsonl`.
7. Extract `thread_id` from the JSONL `thread.started` event and write to `meta.json`.

### Continue task (resume)
1. Read `thread_id` from `meta.json`.
2. Run:
   - `codex-docker exec --json resume <thread_id> "<prompt>"`
3. Capture logs to `logs/run-00N.jsonl` and append run metadata to `meta.json`.

### Remove task
1. Remove the worktree:
   - `git --git-dir .../mirror worktree remove --force <task_dir>/worktree`
2. Delete `~/.codex-orchestrator/tasks/<task_id>/`.

## Resume token storage
- The resume token is `thread_id` emitted by `codex exec --json` in the `thread.started` event.
- `thread_id` is stored in `meta.json` for all future resumes.

## Push + PR (manual action)
- The UI triggers a push endpoint on the host.
- Backend runs:
  - `git -C <worktree> push origin codex/<task_id>`
- If GitHub config is present, the backend opens a PR:
  - `ORCH_GITHUB_TOKEN` and `ORCH_GITHUB_REPO` (owner/repo) must be set.
  - `base` defaults to the repo environment `default_branch`.

## Non-interactive guarantee
- Verified with Codex CLI v0.75.0 that:
  - `codex exec --json` returns a `thread_id`.
  - `codex exec --json resume <thread_id> "<prompt>"` is non-interactive.

