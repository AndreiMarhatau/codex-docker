# Codex Docker Orchestrator

A local backend + UI that manages Codex tasks executed via `codex-docker`. It creates isolated worktrees per task, stores resume tokens, and lets you resume or push later.

## Quick start

### Backend
```
cd codex-docker-orchestrator/backend
npm install
npm run start
```

### UI (dev)
```
cd codex-docker-orchestrator/ui
npm install
npm run dev
```

The UI expects the backend at `http://localhost:8080`.

## Environment variables
- `ORCH_HOME`: overrides the default storage path (`~/.codex-orchestrator`).
- `ORCH_PORT`: backend port (default `8080`).
- `ORCH_GITHUB_TOKEN`: optional token for PR creation.
- `ORCH_GITHUB_REPO`: optional `owner/repo` for PR creation.

## Scripts
- Backend tests: `npm -C backend test`
- UI tests: `npm -C ui test`

## Files
- `LEARNINGS.md`: verified Codex CLI behavior for resume tokens.
- `STRATEGY.md`: full lifecycle strategy for envs/tasks/resume/cleanup.
