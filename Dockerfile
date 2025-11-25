FROM ghcr.io/openai/codex-universal

# Install the Codex CLI globally using the default nvm Node.
RUN bash -lc ". $NVM_DIR/nvm.sh && nvm use default && npm install -g @openai/codex"

# Symlink codex and node into /usr/local/bin so they're always on PATH at runtime.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && BIN_DIR="$(dirname "$(nvm which default)")" \
  && ln -sf "${BIN_DIR}/codex" /usr/local/bin/codex \
  && ln -sf "${BIN_DIR}/node" /usr/local/bin/node'

# Copy auth.json from the build host (requires BuildKit secret).
# Pass the secret with: --secret id=codex_auth,src=$HOME/.codex/auth.json
RUN --mount=type=secret,id=codex_auth,dst=/tmp/auth.json \
    mkdir -p /root/.codex \
    && cp /tmp/auth.json /root/.codex/auth.json \
    && chmod 600 /root/.codex/auth.json

# Launch Codex by default with a wide-open sandbox and search enabled.
ENTRYPOINT ["codex", "--sandbox", "danger-full-access", "--search"]
