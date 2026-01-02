#!/usr/bin/env bash
set -euo pipefail

codex_home="/root/.codex"
host_codex_home="/root/.codex-host"
append_agents_file="/root/.codex-append/AGENTS.append.md"
skill_template="/usr/local/share/codex/DOCKER_SKILL.md"
skills_root="/etc/codex/skills"

mkdir -p "${codex_home}"

if [[ -f "${host_codex_home}/AGENTS.override.md" ]] || [[ -f "${append_agents_file}" ]]; then
  combined_agents_file="$(mktemp)"
  for part in "${host_codex_home}/AGENTS.override.md" "${append_agents_file}"; do
    if [[ -f "${part}" ]]; then
      cat "${part}" >> "${combined_agents_file}"
      printf "\n" >> "${combined_agents_file}"
    fi
  done
  cat "${combined_agents_file}" > "${codex_home}/AGENTS.override.md"
  rm -f "${combined_agents_file}"
fi

if [[ -f "${skill_template}" ]]; then
  skill_id="$(date +%s)-${RANDOM}"
  skill_dir="${skills_root}/codex-docker-${skill_id}"
  skill_name="codex-docker-guidance-${skill_id}"
  mkdir -p "${skill_dir}"
  sed "s/{{SKILL_NAME}}/${skill_name}/g" "${skill_template}" > "${skill_dir}/SKILL.md"
fi

if [[ "${1:-}" == "codex" ]]; then
  exec "$1" -c features.skills=true "${@:2}"
fi

exec "$@"
