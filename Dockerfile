FROM ghcr.io/openai/codex-universal@sha256:e47849324e35257850d13b7173d2d6a6a81e99d6e1058f4b0761c4adeddc3f17 AS release

WORKDIR /opt/codex
COPY package.json package-lock.json ./

# Ensure Codex home exists and provide the container-specific agents file there by default.
RUN mkdir -p /root/.codex
COPY DOCKER_AGENTS.md /root/.codex/AGENTS.override.md

# Install the pinned Codex CLI globally and make node available outside /root for non-root users.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && npm ci --ignore-scripts \
  && CODEX_VER=$(node -p "require(\"./package.json\").dependencies[\"@openai/codex\"]") \
  && npm config set prefix /usr/local \
  && npm install -g "@openai/codex@${CODEX_VER}" \
  && npm config delete prefix \
  && NODE_BIN="$(nvm which default)" \
  && cp "${NODE_BIN}" /usr/local/bin/node \
  && chmod 0755 /usr/local/bin/node \
  && rm -rf node_modules'

# Provide a convenient helper to run the required uncommitted-changes review inside the container.
RUN cat <<'EOF' >/usr/local/bin/codex-review \
  && chmod +x /usr/local/bin/codex-review \
  && ln -sf /usr/local/bin/codex-review /usr/local/bin/review
#!/usr/bin/env bash
set -euo pipefail
codex exec --dangerously-bypass-approvals-and-sandbox --json -c features.web_search_request=true review --uncommitted \
  | jq -rs '[.[] | select(.type=="item.completed" and .item.type=="agent_message") | .item.text] | last // ""'
EOF

# Launch Codex by default with a bypassed sandbox and search enabled.
ENTRYPOINT ["codex", "--dangerously-bypass-approvals-and-sandbox", "--search"]

# CI smoke-test target: build with --target ci-smoke to verify the exact Codex commands we ship.
FROM release AS ci-smoke
RUN codex --dangerously-bypass-approvals-and-sandbox --search --version \
  && codex exec --dangerously-bypass-approvals-and-sandbox --json -c features.web_search_request=true review --help >/dev/null \
  && jq --version >/dev/null \
  && bash -n /usr/local/bin/codex-review \
  && node --version
