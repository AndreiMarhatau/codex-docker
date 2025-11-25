#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="codex-docker:latest"
AUTH_FILE="${HOME}/.codex/auth.json"

if [[ ! -f "${AUTH_FILE}" ]]; then
  echo "Missing auth file at ${AUTH_FILE}; copy your Codex auth.json there first." >&2
  exit 1
fi

echo "Building ${IMAGE_NAME} (requires BuildKit for secret mount)..."
DOCKER_BUILDKIT=1 docker build \
  --secret id=codex_auth,src="${AUTH_FILE}" \
  -t "${IMAGE_NAME}" \
  .
