FROM ghcr.io/openai/codex-universal@sha256:86f25fd11da9839ae4d75749ae95782f3304d95caab8f7592f92bc2b9ab6e970 AS release

WORKDIR /opt/codex
COPY DOCKER_AGENTS.md /opt/codex/AGENTS.md
COPY package.json package-lock.json ./

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
codex exec --dangerously-bypass-approvals-and-sandbox "Review uncommitted changes, do not make any changes yourself." 2>/dev/null
EOF

# Launch Codex by default with a bypassed sandbox and search enabled.
ENTRYPOINT ["codex", "-c", "project_doc_fallback_filenames=[\"/opt/codex/AGENTS.md\"]", "--dangerously-bypass-approvals-and-sandbox", "--search"]

# CI smoke-test target: build with --target ci-smoke to verify binaries without exporting an image.
FROM release AS ci-smoke
RUN codex --version && node --version
