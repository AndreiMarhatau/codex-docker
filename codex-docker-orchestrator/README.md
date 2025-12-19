# Codex Docker Orchestrator

A local backend + UI that manages Codex tasks executed via `codex-docker`. It creates isolated worktrees per task, stores resume tokens, and lets you resume or push later.

## Quick start

### Backend
```
cd codex-docker-orchestrator/backend
npm install
npm run start
```

### UI (served by backend)
```
cd codex-docker-orchestrator/ui
npm install
npm run build
```

Once the UI is built, start the backend and visit `http://localhost:8080`. The backend serves the UI bundle from `ui/dist`, and the UI makes same-origin API calls (no separate UI server needed).

### UI (dev)
```
cd codex-docker-orchestrator/ui
npm install
npm run dev
```

The UI expects the backend at `http://localhost:8080` by default. To point the UI at a different backend (for example, on your LAN), set `VITE_API_BASE_URL` when running the dev server:
```
VITE_API_BASE_URL=http://192.168.1.x:8080 npm run dev
```

You can also set the variable in a `.env` file in `ui/` (for example, `VITE_API_BASE_URL=http://192.168.1.x:8080`) or pass it at build time.

## Environment variables
- `ORCH_HOME`: overrides the default storage path (`~/.codex-orchestrator`).
- `ORCH_PORT`: backend port (default `8080`).
- `ORCH_AGENTS_FILE`: optional path to a Codex agents file to append for orchestrated runs (defaults to `codex-docker-orchestrator/ORCHESTRATOR_AGENTS.md` if present).
- `ORCH_HOME` is automatically mounted into the container so task worktrees can resolve their git metadata.
- `ORCH_GITHUB_TOKEN`: optional token for PR creation.
- `ORCH_GITHUB_REPO`: optional `owner/repo` for PR creation.

## Scripts
- Backend tests: `npm -C backend test`
- UI tests: `npm -C ui test`

## Files
- `LEARNINGS.md`: verified Codex CLI behavior for resume tokens.
- `STRATEGY.md`: full lifecycle strategy for envs/tasks/resume/cleanup.
