FROM ghcr.io/openai/codex-universal@sha256:e47849324e35257850d13b7173d2d6a6a81e99d6e1058f4b0761c4adeddc3f17 AS release

WORKDIR /opt/codex
COPY package.json package-lock.json ./
COPY codex-review-prompt.md /opt/codex/codex-review-prompt.md

# Ensure Codex home exists and provide the container-specific agents file there by default.
RUN mkdir -p /root/.codex
COPY DOCKER_AGENTS.md /root/.codex/AGENTS.override.md

# Install the pinned Codex CLI globally using the default nvm Node.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && npm ci --ignore-scripts \
  && CODEX_VER=$(node -p "require(\"./package.json\").dependencies[\"@openai/codex\"]") \
  && npm install -g "@openai/codex@${CODEX_VER}" \
  && rm -rf node_modules'

# Symlink codex and node into /usr/local/bin so they're always on PATH at runtime.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && BIN_DIR="$(dirname "$(nvm which default)")" \
  && ln -sf "${BIN_DIR}/codex" /usr/local/bin/codex \
  && ln -sf "${BIN_DIR}/node" /usr/local/bin/node'

# Provide a convenient helper to run the required uncommitted-changes review inside the container.
RUN cat <<'EOF' >/usr/local/bin/codex-review \
  && chmod +x /usr/local/bin/codex-review \
  && ln -sf /usr/local/bin/codex-review /usr/local/bin/review
#!/usr/bin/env bash
set -euo pipefail
prompt="$(cat /opt/codex/codex-review-prompt.md)"
codex exec --dangerously-bypass-approvals-and-sandbox -c features.web_search_request=true "${prompt}" 2>/dev/null
EOF

# Launch Codex by default with a bypassed sandbox and search enabled.
ENTRYPOINT ["codex", "--dangerously-bypass-approvals-and-sandbox", "--search"]

# CI smoke-test target: build with --target ci-smoke to verify the exact Codex commands we ship.
FROM release AS ci-smoke
RUN codex --dangerously-bypass-approvals-and-sandbox --search --version \
  && codex exec --dangerously-bypass-approvals-and-sandbox -c features.web_search_request=true --help >/dev/null \
  && bash -n /usr/local/bin/codex-review \
  && node --version
