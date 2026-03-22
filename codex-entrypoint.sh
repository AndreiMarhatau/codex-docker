#!/usr/bin/env bash
set -euo pipefail

codex_home="${CODEX_HOME:-/root/.codex}"
container_instructions_file="/usr/local/share/codex/developer-instructions.md"

mkdir -p "${codex_home}"

has_cli_developer_instructions_override() {
  local index=1
  local argc=$#
  while (( index <= argc )); do
    local arg="${!index}"
    case "${arg}" in
      -c|--config)
        (( index += 1 ))
        if (( index > argc )); then
          return 1
        fi
        local value="${!index}"
        if [[ "${value}" == developer_instructions=* ]]; then
          return 0
        fi
        ;;
      --config=developer_instructions=*)
        return 0
        ;;
    esac
    (( index += 1 ))
  done
  return 1
}

config_has_user_developer_instructions() {
  local config_file="${codex_home}/config.toml"
  if [[ ! -f "${config_file}" ]]; then
    return 1
  fi

  python3 - "${config_file}" <<'PY'
import pathlib
import sys
import tomllib

config_path = pathlib.Path(sys.argv[1])

try:
    data = tomllib.loads(config_path.read_text())
except Exception:
    raise SystemExit(1)

value = data.get("developer_instructions")
if isinstance(value, str) and value.strip():
    raise SystemExit(0)
raise SystemExit(1)
PY
}

if [[ -f "${container_instructions_file}" ]] \
  && ! has_cli_developer_instructions_override "$@" \
  && ! config_has_user_developer_instructions; then
  developer_instructions_toml="$(python3 - "${container_instructions_file}" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
print(json.dumps(path.read_text().strip()))
PY
)"
  exec "$1" -c "developer_instructions=${developer_instructions_toml}" "${@:2}"
fi

exec "$@"
