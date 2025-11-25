#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="codex-docker:latest"

echo "Building ${IMAGE_NAME}..."
docker build -t "${IMAGE_NAME}" .
