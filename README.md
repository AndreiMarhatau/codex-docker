# Codex Docker helper

Builds a Codex-enabled image on top of `ghcr.io/openai/codex-universal` and runs the Codex CLI directly.

## Dependencies
- Base image: `ghcr.io/openai/codex-universal` (pulled during build).
- CLI: `@openai/codex` installed globally via npm inside the image.
- Entrypoint arguments: `codex -c project_doc_fallback_filenames=["/opt/codex/AGENTS.md"] --dangerously-bypass-approvals-and-sandbox --search`.

## Build
```sh
./build-codex-docker.sh
```

## Run
```sh
./codex-docker
```
Mounts the current directory to `/workspace` and your host `~/.codex` into `/root/.codex` so the container uses your existing Codex config/keys.

The image bundles a fallback `DOCKER_AGENTS.md` (copied into `/opt/codex/AGENTS.md` inside the image) and passes `-c project_doc_fallback_filenames=["/opt/codex/AGENTS.md"]` to Codex so the CLI always has baseline guidance even when a project-specific AGENTS file is missing.

## Make `codex-docker` available everywhere
- Add the repo root to your `PATH`, e.g. `export PATH="$PATH:/path/to/codex-docker-repo"`, or
- Symlink the script: `ln -s "$(pwd)/codex-docker" /usr/local/bin/codex-docker`.

## Get a shell in a running container
To exec into the already-running Codex container that `./codex-docker` started:
1. Launch Codex with a name so it’s easy to target:
   ```sh
   ./codex-docker --name codex-cli
   ```
   (All your usual Codex arguments can follow `--name codex-cli`.)
2. In another terminal, attach a shell:
   ```sh
   docker exec -it codex-cli /bin/bash
   ```
If you didn’t give the container a name, find it with `docker ps` and use the container ID with `docker exec -it <id> /bin/bash`.
