FROM ghcr.io/openai/codex-universal

# Install the Codex CLI globally using the default nvm Node.
RUN bash -lc ". $NVM_DIR/nvm.sh && nvm use default && npm install -g @openai/codex"

# Symlink codex and node into /usr/local/bin so they're always on PATH at runtime.
RUN bash -lc '. $NVM_DIR/nvm.sh && nvm use default \
  && BIN_DIR="$(dirname "$(nvm which default)")" \
  && ln -sf "${BIN_DIR}/codex" /usr/local/bin/codex \
  && ln -sf "${BIN_DIR}/node" /usr/local/bin/node'

# Launch Codex by default with a wide-open sandbox and search enabled.
ENTRYPOINT ["codex", "--sandbox", "danger-full-access", "--search"]
