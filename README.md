# Codex Docker helper

Builds a Codex-enabled image on top of `ghcr.io/openai/codex-universal` and runs the Codex CLI directly.

## Why this exists
- **Problem:** Codex sessions sometimes need extra system tools or long-running autonomy. Running that directly on your host can be risky or require manual babysitting.
- **Solution:** Give Codex a disposable container that mirrors your repo and `~/.codex` config, based on the same `codex-universal` image used by Codex Web. It can install any tools and you don't need to worry about your local set up.

## Limitations
- Does not work in Windows, because `ghcr.io/openai/codex-universal` image is not built for that platform.
- Sandbox, that's utilized by Codex, is not supported inside docker containers. Codex runs with --dangerously-bypass-approvals-and-sandbox.

## Additional features
- The image injects a short container-specific developer note only when the user has not already set `developer_instructions` in their own Codex config or via CLI override. AGENTS discovery otherwise remains native Codex behavior.

## Prepare & run
- Make the helper reachable everywhere: add the repo to `PATH` (`export PATH="$PATH:/path/to/codex-docker-repo"`) or symlink it (`ln -s "$(pwd)/codex-docker" /usr/local/bin/codex-docker`).
- Run `codex-docker` from any repo. Docker will pull `ghcr.io/andreimarhatau/codex-docker:latest` on first use. The script mounts the current directory to `/workspace/<folder>` and your `~/.codex` to `/root/.codex` so that you can reuse credentials and history, then forwards all args to the Codex CLI.

## Install with Homebrew
```sh
brew tap andreimarhatau/codex-docker
brew install codex-docker
```
One-command install:
```sh
brew install andreimarhatau/codex-docker/codex-docker
```

## Use the host Docker engine (optional)
The image ships with the Docker CLI and Docker Compose plugin (`docker compose`). To let Codex run Docker commands against your host engine, mount the host socket into the container:
```sh
CODEX_MOUNT_PATHS=/var/run/docker.sock codex-docker
```
If your Docker socket lives elsewhere, pass the full path instead (the socket will be mounted at the same path inside the container).

## Pass through environment variables
- Any non-system environment variables from the host are passed into the container by default.
- Example: `FOO=BAR codex-docker` makes `FOO=BAR` available inside the container.
- To explicitly control which vars are forwarded (including ones normally skipped), set `CODEX_PASSTHROUGH_ENV`:
  ```sh
  CODEX_PASSTHROUGH_ENV=FOO,BAR,PATH FOO=BAR BAR=BAZ codex-docker
  ```

## Update to the latest image
This repo runs dependabot every day to update base codex-universal image, and Codex CLI version.
- Refresh the tag you use (defaults shown):
  ```sh
  docker pull "ghcr.io/andreimarhatau/codex-docker:latest"
  ```
- Clear dangling layers:
  ```sh
  docker image prune -f
  ```

## Attach a shell
1. After running "codex-docker", you'll get a command, that you can use to get into the container and run commands. It looks like this:
'To open another terminal inside this container along with codex, run:
  docker exec -it codex-1766702548-23806 /bin/bash'


## Dependencies of the repository
- Base image: `ghcr.io/openai/codex-universal` (pulled during build).
- CLI: `@openai/codex` installed globally inside the image.
- Entrypoint arguments: `codex --dangerously-bypass-approvals-and-sandbox`.

## Container developer note
- The image ships [`CONTAINER_DEVELOPER_INSTRUCTIONS.md`](./CONTAINER_DEVELOPER_INSTRUCTIONS.md) as `/usr/local/share/codex/developer-instructions.md`.
- On startup, the entrypoint injects that text via `-c developer_instructions=...` only when the user has not already provided `developer_instructions` in `~/.codex/config.toml` or via a CLI `-c/--config developer_instructions=...` override.
- The helper no longer rewrites `~/.codex/AGENTS.override.md` or merges AGENTS files. User AGENTS files are read by Codex exactly as usual.
- Set `CODEX_MOUNT_PATHS=/abs/path1:/abs/path2` to bind-mount additional host paths into the container at the same absolute locations.
- Set `CODEX_MOUNT_PATHS_RO=/abs/path1:/abs/path2` to bind-mount additional host paths into the container read-only.
- Set `CODEX_MOUNT_MAPS=/host/path=/container/path` to bind-mount host paths into different writable container paths. Multiple mappings are supported via `:` separators, for example: `CODEX_MOUNT_MAPS=/opt/data=/mnt/data:/tmp/cache=/var/cache/shared`.
- Set `CODEX_MOUNT_MAPS_RO=/host/path=/container/path` to bind-mount host paths into different read-only container paths. Multiple mappings are supported via `:` separators, for example: `CODEX_MOUNT_MAPS_RO=/var/run/docker.sock=/tmp/docker.sock:/opt/data=/mnt/data`.
