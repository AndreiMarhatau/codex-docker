#!/usr/bin/env bash
set -euo pipefail

codex_home="/root/.codex"
host_codex_home="/root/.codex-host"
append_agents_file="/root/.codex-append/AGENTS.append.md"
base_agents_file="/usr/local/share/codex/AGENTS.docker.md"

mkdir -p "${codex_home}"

if [[ -d "${host_codex_home}" ]]; then
  shopt -s dotglob
  for entry in "${host_codex_home}"/*; do
    [[ -e "${entry}" ]] || continue
    cp -a "${entry}" "${codex_home}/"
  done
  shopt -u dotglob
fi

if [[ -f "${host_codex_home}/AGENTS.override.md" ]] || [[ -f "${base_agents_file}" ]] || [[ -f "${append_agents_file}" ]]; then
  combined_agents_file="$(mktemp)"
  for part in "${host_codex_home}/AGENTS.override.md" "${base_agents_file}" "${append_agents_file}"; do
    if [[ -f "${part}" ]]; then
      cat "${part}" >> "${combined_agents_file}"
      printf "\n" >> "${combined_agents_file}"
    fi
  done
  mv "${combined_agents_file}" "${codex_home}/AGENTS.override.md"
fi

exec "$@"
