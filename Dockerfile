FROM ghcr.io/openai/codex-universal@sha256:e8c37839df02de366425588f5f47b2e0cf601d4415730f48759428accf310a85 AS release

WORKDIR /opt/codex
COPY package.json package-lock.json ./

# Install Docker CLI + Compose plugin so Codex can talk to a mounted host Docker socket.
RUN apt-get update \
  && apt-get install -y --no-install-recommends docker.io docker-compose-v2 \
  && rm -rf /var/lib/apt/lists/*

# Ensure Codex home exists and provide the container-specific developer instructions.
RUN mkdir -p /root/.codex /usr/local/share/codex
COPY CONTAINER_DEVELOPER_INSTRUCTIONS.md /usr/local/share/codex/developer-instructions.md
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

# Launch Codex by default with a bypassed sandbox.
ENTRYPOINT ["/usr/local/bin/codex-entrypoint", "codex", "--dangerously-bypass-approvals-and-sandbox"]

# CI smoke-test target: build with --target ci-smoke to verify the exact Codex commands we ship.
FROM release AS ci-smoke
RUN codex --dangerously-bypass-approvals-and-sandbox --version \
  && docker --version \
  && docker compose version \
  && codex review --help >/dev/null \
  && bash -n /usr/local/bin/codex-entrypoint \
  && python3 --version \
  && node --version
