FROM ghcr.io/openai/codex-universal@sha256:e47849324e35257850d13b7173d2d6a6a81e99d6e1058f4b0761c4adeddc3f17 AS release

WORKDIR /opt/codex
COPY package.json package-lock.json ./

# Install Docker CLI so Codex can talk to a mounted host Docker socket.
RUN apt-get update \
  && apt-get install -y --no-install-recommends docker.io \
  && rm -rf /var/lib/apt/lists/*

# Ensure Codex home exists and provide the container-specific skill template for the entrypoint.
RUN mkdir -p /root/.codex /usr/local/share/codex /etc/codex/skills
COPY DOCKER_SKILL.md /usr/local/share/codex/DOCKER_SKILL.md
COPY codex-entrypoint.sh /usr/local/bin/codex-entrypoint
RUN chmod +x /usr/local/bin/codex-entrypoint

# Install the pinned Codex CLI globally using the default nvm Node.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && npm ci --ignore-scripts \
  && CODEX_VER=$(node -p "require(\"./package.json\").dependencies[\"@openai/codex\"]") \
  && npm install -g "@openai/codex@${CODEX_VER}" \
  && rm -rf node_modules'

# Install Playwright + Chromium for UI screenshots.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && npm install -g playwright \
  && playwright install --with-deps chromium'

# Symlink codex, node, and playwright into /usr/local/bin so they're always on PATH at runtime.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && BIN_DIR="$(dirname "$(nvm which default)")" \
  && ln -sf "${BIN_DIR}/codex" /usr/local/bin/codex \
  && ln -sf "${BIN_DIR}/node" /usr/local/bin/node \
  && ln -sf "${BIN_DIR}/playwright" /usr/local/bin/playwright'

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
ENTRYPOINT ["/usr/local/bin/codex-entrypoint", "codex", "--dangerously-bypass-approvals-and-sandbox", "--search"]

# CI smoke-test target: build with --target ci-smoke to verify the exact Codex commands we ship.
FROM release AS ci-smoke
RUN codex --dangerously-bypass-approvals-and-sandbox --search --version \
  && codex exec --dangerously-bypass-approvals-and-sandbox --json -c features.web_search_request=true review --help >/dev/null \
  && jq --version >/dev/null \
  && bash -n /usr/local/bin/codex-review \
  && bash -n /usr/local/bin/codex-entrypoint \
  && node --version
