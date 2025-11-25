# Codex Docker helper

Builds a Codex-enabled image on top of `ghcr.io/openai/codex-universal` and runs the Codex CLI directly.

## Build
```sh
./build-codex-docker.sh
```
Requires `~/.codex/auth.json` and BuildKit (for the secret mount).

## Run
```sh
./codex-docker
```
Mounts the current directory to `/workspace` and launches Codex interactively.

## Make `codex-docker` available everywhere
- Add the repo root to your `PATH`, e.g. `export PATH="$PATH:/path/to/codex-docker-repo"`, or
- Symlink the script: `ln -s "$(pwd)/codex-docker" /usr/local/bin/codex-docker`.
