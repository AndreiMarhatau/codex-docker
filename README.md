# Codex Docker helper

Builds a Codex-enabled image on top of `ghcr.io/openai/codex-universal` and runs the Codex CLI directly.

## Why this exists
- **Problem:** Codex sessions sometimes need extra system tools or long-running autonomy. Running that directly on your host can be risky or require manual babysitting.
- **Solution:** Give Codex a disposable container that mirrors your repo and `~/.codex` config, based on the same `codex-universal` image used by Codex Web.

## Prepare
- Make the helper reachable everywhere: add the repo to `PATH` (`export PATH="$PATH:/path/to/codex-docker-repo"`) or symlink it (`ln -s "$(pwd)/codex-docker" /usr/local/bin/codex-docker`).
- Run `codex-docker` from any repo. Docker will pull `ghcr.io/andreimarhatau/codex-docker:latest` on first use (override with `IMAGE_NAME=...`). The script mounts the current directory to `/workspace/<folder>` and your `~/.codex` to `/root/.codex`, then forwards all args to the Codex CLI.

## Update to the latest image
- Refresh the tag you use (defaults shown):
  ```sh
  IMAGE_NAME="${IMAGE_NAME:-ghcr.io/andreimarhatau/codex-docker:latest}"
  docker pull "$IMAGE_NAME"
  ```
- Remove the previous copy once you’re on the new digest:
  ```sh
  docker rmi $(docker images "$IMAGE_NAME" --format '{{.ID}}' | tail -n +2) 2>/dev/null || true
  ```
  (Or just run `docker image prune -f` to clear dangling layers.)

## Attach a shell
- Start Codex with an easy-to-remember name (optional): `CONTAINER_NAME=codex-cli codex-docker`
- In another terminal: `docker exec -it codex-cli /bin/bash`
- If you skip naming it, locate the container with `docker ps` and exec using its ID.

## Dependencies
- Base image: `ghcr.io/openai/codex-universal` (pulled during build).
- CLI: `@openai/codex` installed globally inside the image.
- Entrypoint arguments: `codex --dangerously-bypass-approvals-and-sandbox --search`.
- Codex review arguments: `codex exec --dangerously-bypass-approvals-and-sandbox --json -c features.web_search_request=true review --uncommitted | jq -rs '[.[] | select(.type==\"item.completed\" and .item.type==\"agent_message\") | .item.text] | last // \"\"'`

## Container-only AGENTS override
- The image ships `DOCKER_AGENTS.md`; it is copied to `/root/.codex/AGENTS.override.md` inside the image.
- The `codex-docker` helper also bind-mounts that file into `/root/.codex/AGENTS.override.md` (read-only) so it is present even when your host `~/.codex` is mounted. The host filesystem is not modified and no project files are touched.
- Set `CODEX_AGENTS_APPEND_FILE=/path/to/extra.md` to append extra instructions (merged with `DOCKER_AGENTS.md`) for a single run.
- Set `CODEX_MOUNT_PATHS=/abs/path1:/abs/path2` to bind-mount additional host paths into the container at the same absolute locations.
- Set `CODEX_MOUNT_PATHS_RO=/abs/path1:/abs/path2` to bind-mount additional host paths into the container read-only.
