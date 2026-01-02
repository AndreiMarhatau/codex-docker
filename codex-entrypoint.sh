#!/usr/bin/env bash
set -euo pipefail

skill_template="/usr/local/share/codex/DOCKER_SKILL.md"
skills_root="/etc/codex/skills"

if [[ -f "${skill_template}" ]]; then
  skill_id="$(date +%s)-${RANDOM}"
  skill_dir="${skills_root}/codex-docker-${skill_id}"
  skill_name="codex-docker-guidance-${skill_id}"
  mkdir -p "${skill_dir}"
  sed "s/{{SKILL_NAME}}/${skill_name}/g" "${skill_template}" > "${skill_dir}/SKILL.md"
fi

# Skills are expected to be enabled implicitly; do not inject feature flags here.
exec "$@"
