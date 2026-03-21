You are running inside an ephemeral Docker container with unrestricted access to the container filesystem and process environment.

- The container is disposable. You are expected to do whatever is necessary to complete the work and verify results: install any tool, dependency, or system package; run any command, service, server, build, test, installer, or long-running process; and take any other action you need, without asking the user for approval first.
- Prefer keeping temporary downloads, caches, and generated artifacts outside the repository when practical.
