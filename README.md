# Codex Docker helper

Builds a Codex-enabled image on top of `ghcr.io/openai/codex-universal` and runs the Codex CLI directly.

## Why this exists
- **Problem:** Codex sessions sometimes need extra system tools or long-running autonomy. Running that directly on your host can be risky or require manual babysitting.
- **Solution:** Give Codex a disposable container that mirrors your repo and `~/.codex` config, based on the same `codex-universal` image used by Codex Web. It can install any tools and you don't need to worry about your local set up.

## Limitations
- Does not work in Windows, because `ghcr.io/openai/codex-universal` image is not built for that platform.
- Sandbox, that's utilized by Codex, is not supported inside docker containers. Codex runs with --dangerously-bypass-approvals-and-sandbox.

## Additional features
- Codex is instructed to run "codex-review" command which is just an alias to "codex exec review" command on unmerged changes and is instructed to do so after all relevant checks and edits, just before ending the task. This increases usage consumption. I personally found it very helpful, it eliminates 90% of errors before running into them in runtime or while testing end-to-end.

## Prepare & run
- Make the helper reachable everywhere: add the repo to `PATH` (`export PATH="$PATH:/path/to/codex-docker-repo"`) or symlink it (`ln -s "$(pwd)/codex-docker" /usr/local/bin/codex-docker`).
- Run `codex-docker` from any repo. Docker will pull `ghcr.io/andreimarhatau/codex-docker:latest` on first use. The script mounts the current directory to `/workspace/<folder>` and your `~/.codex` to `/root/.codex` so that you can reuse credentials and history, then forwards all args to the Codex CLI.

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
- Entrypoint arguments: `codex --dangerously-bypass-approvals-and-sandbox --search`.
- Codex review arguments: `codex exec --dangerously-bypass-approvals-and-sandbox --json -c features.web_search_request=true review --uncommitted | jq -rs '[.[] | select(.type==\"item.completed\" and .item.type==\"agent_message\") | .item.text] | last // \"\"'`

## Container-only AGENTS override
- The image ships `DOCKER_AGENTS.md`; it is copied to `/root/.codex/AGENTS.override.md` inside the image.
- The `codex-docker` helper also bind-mounts that file into `/root/.codex/AGENTS.override.md` (read-only) so it is present even when your host `~/.codex` is mounted. The host filesystem is not modified and no project files are touched.
- Set `CODEX_AGENTS_APPEND_FILE=/path/to/extra.md` to append extra instructions (merged with `DOCKER_AGENTS.md`) for a single run.
- Set `CODEX_MOUNT_PATHS=/abs/path1:/abs/path2` to bind-mount additional host paths into the container at the same absolute locations.
- Set `CODEX_MOUNT_PATHS_RO=/abs/path1:/abs/path2` to bind-mount additional host paths into the container read-only.
