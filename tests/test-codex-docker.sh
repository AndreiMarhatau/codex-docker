#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_path="${repo_root}/codex-docker"

test_root="$(mktemp -d)"
trap 'rm -rf "${test_root}"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_arg_present() {
  local args_file="$1"
  local expected="$2"

  if ! grep -Fqx -- "${expected}" "${args_file}"; then
    fail "expected argument '${expected}' in ${args_file}"
  fi
}

assert_arg_absent() {
  local args_file="$1"
  local unexpected="$2"

  if grep -Fqx -- "${unexpected}" "${args_file}"; then
    fail "did not expect argument '${unexpected}' in ${args_file}"
  fi
}

setup_fake_docker() {
  local case_dir="$1"
  mkdir -p "${case_dir}/bin"
  cat > "${case_dir}/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" > "${CODEX_DOCKER_TEST_ARGS_FILE}"
EOF
  chmod +x "${case_dir}/bin/docker"
}

run_case() {
  local case_name="$1"
  shift

  local case_dir="${test_root}/${case_name}"
  mkdir -p "${case_dir}/home/.codex" "${case_dir}/workspace"
  setup_fake_docker "${case_dir}"

  (
    cd "${case_dir}/workspace"
    env -i \
      PATH="${case_dir}/bin:/usr/bin:/bin" \
      HOME="${case_dir}/home" \
      IMAGE_NAME="test-image" \
      CONTAINER_NAME="test-container" \
      CODEX_DOCKER_TEST_ARGS_FILE="${case_dir}/docker-args.txt" \
      "$@" \
      bash "${script_path}" --version > "${case_dir}/stdout.txt" 2> "${case_dir}/stderr.txt"
  )

  LAST_CASE_DIR="${case_dir}"
}

test_default_env_passthrough_filters_docker_vars() {
  run_case "default-filter" \
    OUTER_OK="yes" \
    DOCKER_HOST="tcp://outer.example:2375"

  assert_arg_present "${LAST_CASE_DIR}/docker-args.txt" "OUTER_OK"
  assert_arg_absent "${LAST_CASE_DIR}/docker-args.txt" "DOCKER_HOST"
}

test_explicit_passthrough_uses_outer_env_value_by_name() {
  run_case "explicit-passthrough" \
    CODEX_PASSTHROUGH_ENV="DOCKER_HOST" \
    DOCKER_HOST="tcp://outer.example:2375"

  assert_arg_present "${LAST_CASE_DIR}/docker-args.txt" "DOCKER_HOST"
  assert_arg_absent "${LAST_CASE_DIR}/docker-args.txt" "DOCKER_HOST=tcp://outer.example:2375"
}

test_prefixed_container_env_sets_inner_only_value() {
  run_case "prefixed-container-env" \
    CODEX_CONTAINER_ENV_DOCKER_HOST="tcp://inner.example:2375"

  assert_arg_present "${LAST_CASE_DIR}/docker-args.txt" "DOCKER_HOST=tcp://inner.example:2375"
  assert_arg_absent "${LAST_CASE_DIR}/docker-args.txt" "CODEX_CONTAINER_ENV_DOCKER_HOST"
}

test_prefixed_container_env_overrides_name_only_passthrough() {
  run_case "prefixed-overrides-passthrough" \
    CODEX_PASSTHROUGH_ENV="DOCKER_HOST" \
    DOCKER_HOST="tcp://outer.example:2375" \
    CODEX_CONTAINER_ENV_DOCKER_HOST="tcp://inner.example:2375"

  assert_arg_present "${LAST_CASE_DIR}/docker-args.txt" "DOCKER_HOST=tcp://inner.example:2375"
  assert_arg_absent "${LAST_CASE_DIR}/docker-args.txt" "DOCKER_HOST"
}

test_default_env_passthrough_filters_docker_vars
test_explicit_passthrough_uses_outer_env_value_by_name
test_prefixed_container_env_sets_inner_only_value
test_prefixed_container_env_overrides_name_only_passthrough

echo "All codex-docker tests passed."
