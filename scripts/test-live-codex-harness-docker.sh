#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/live-docker-auth.sh"
IMAGE_NAME="${KOVA_IMAGE:-kova:local}"
LIVE_IMAGE_NAME="${KOVA_LIVE_IMAGE:-${IMAGE_NAME}-live}"
CONFIG_DIR="${KOVA_CONFIG_DIR:-$HOME/.kova}"
WORKSPACE_DIR="${KOVA_WORKSPACE_DIR:-$HOME/.kova/workspace}"
PROFILE_FILE="${KOVA_PROFILE_FILE:-$HOME/.profile}"
CODEX_HARNESS_AUTH_MODE="${KOVA_LIVE_CODEX_HARNESS_AUTH:-codex-auth}"
TEMP_DIRS=()
DOCKER_USER="${KOVA_DOCKER_USER:-node}"
DOCKER_HOME_MOUNT=()
DOCKER_EXTRA_ENV_FILES=()
DOCKER_AUTH_PRESTAGED=0

kova_live_codex_harness_append_build_extension() {
  local extension="${1:?extension required}"
  local current="${KOVA_DOCKER_BUILD_EXTENSIONS:-${KOVA_EXTENSIONS:-}}"
  case " $current " in
    *" $extension "*)
      ;;
    *)
      export KOVA_DOCKER_BUILD_EXTENSIONS="${current:+$current }$extension"
      ;;
  esac
}

case "$CODEX_HARNESS_AUTH_MODE" in
  codex-auth | api-key)
    ;;
  *)
    echo "ERROR: KOVA_LIVE_CODEX_HARNESS_AUTH must be one of: codex-auth, api-key." >&2
    exit 1
    ;;
esac

if [[ "$CODEX_HARNESS_AUTH_MODE" == "api-key" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: KOVA_LIVE_CODEX_HARNESS_AUTH=api-key requires OPENAI_API_KEY." >&2
  exit 1
fi

cleanup_temp_dirs() {
  if ((${#TEMP_DIRS[@]} > 0)); then
    rm -rf "${TEMP_DIRS[@]}"
  fi
}
trap cleanup_temp_dirs EXIT

if [[ -n "${KOVA_DOCKER_CLI_TOOLS_DIR:-}" ]]; then
  CLI_TOOLS_DIR="${KOVA_DOCKER_CLI_TOOLS_DIR}"
elif [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  CLI_TOOLS_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kova-docker-cli-tools.XXXXXX")"
  TEMP_DIRS+=("$CLI_TOOLS_DIR")
else
  CLI_TOOLS_DIR="$HOME/.cache/kova/docker-cli-tools"
fi
if [[ -n "${KOVA_DOCKER_CACHE_HOME_DIR:-}" ]]; then
  CACHE_HOME_DIR="${KOVA_DOCKER_CACHE_HOME_DIR}"
elif [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  CACHE_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kova-docker-cache.XXXXXX")"
  TEMP_DIRS+=("$CACHE_HOME_DIR")
else
  CACHE_HOME_DIR="$HOME/.cache/kova/docker-cache"
fi

mkdir -p "$CLI_TOOLS_DIR"
mkdir -p "$CACHE_HOME_DIR"
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  DOCKER_USER="$(id -u):$(id -g)"
  DOCKER_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kova-docker-home.XXXXXX")"
  TEMP_DIRS+=("$DOCKER_HOME_DIR")
  DOCKER_HOME_MOUNT=(-v "$DOCKER_HOME_DIR":/home/node)
fi

PROFILE_MOUNT=()
PROFILE_STATUS="none"
if [[ -f "$PROFILE_FILE" && -r "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
  PROFILE_STATUS="$PROFILE_FILE"
fi

AUTH_FILES=()
if [[ "$CODEX_HARNESS_AUTH_MODE" != "api-key" ]]; then
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(kova_live_collect_auth_files_from_csv "openai-codex")
fi

AUTH_FILES_CSV=""
if ((${#AUTH_FILES[@]} > 0)); then
  AUTH_FILES_CSV="$(kova_live_join_csv "${AUTH_FILES[@]}")"
fi

if [[ -n "${DOCKER_HOME_DIR:-}" ]]; then
  kova_live_stage_auth_into_home "$DOCKER_HOME_DIR" --files "${AUTH_FILES[@]}"
  DOCKER_AUTH_PRESTAGED=1
fi

EXTERNAL_AUTH_MOUNTS=()
if ((${#AUTH_FILES[@]} > 0)); then
  for auth_file in "${AUTH_FILES[@]}"; do
    auth_file="$(kova_live_validate_relative_home_path "$auth_file")"
    host_path="$HOME/$auth_file"
    if [[ -f "$host_path" ]]; then
      EXTERNAL_AUTH_MOUNTS+=(-v "$host_path":/host-auth-files/"$auth_file":ro)
    fi
  done
fi

DOCKER_AUTH_ENV=()
if [[ "$CODEX_HARNESS_AUTH_MODE" == "api-key" ]]; then
  docker_env_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kova-codex-harness-env.XXXXXX")"
  TEMP_DIRS+=("$docker_env_dir")
  docker_env_file="$docker_env_dir/openai.env"
  {
    printf 'OPENAI_API_KEY=%s\n' "${OPENAI_API_KEY}"
    if [[ -n "${OPENAI_BASE_URL:-}" ]]; then
      printf 'OPENAI_BASE_URL=%s\n' "${OPENAI_BASE_URL}"
    fi
  } >"$docker_env_file"
  DOCKER_EXTRA_ENV_FILES+=(--env-file "$docker_env_file")
fi

read -r -d '' LIVE_TEST_CMD <<'EOF' || true
set -euo pipefail
[ -f "$HOME/.profile" ] && [ -r "$HOME/.profile" ] && source "$HOME/.profile" || true
export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$HOME/.npm-global}"
export npm_config_prefix="$NPM_CONFIG_PREFIX"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export COREPACK_HOME="${COREPACK_HOME:-$XDG_CACHE_HOME/node/corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$XDG_CACHE_HOME/npm}"
export npm_config_cache="$NPM_CONFIG_CACHE"
# Force the Codex harness to use the staged `~/.codex` auth files. This lane
# is not meant to exercise raw OpenAI API-key routing unless the lane
# explicitly opts into API-key auth for CI.
if [ "${KOVA_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" != "api-key" ]; then
  unset OPENAI_API_KEY OPENAI_BASE_URL
fi
mkdir -p "$NPM_CONFIG_PREFIX" "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE"
chmod 700 "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE" || true
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
if [ "${KOVA_DOCKER_AUTH_PRESTAGED:-0}" != "1" ]; then
  IFS=',' read -r -a auth_files <<<"${KOVA_DOCKER_AUTH_FILES_RESOLVED:-}"
  if ((${#auth_files[@]} > 0)); then
    for auth_file in "${auth_files[@]}"; do
      [ -n "$auth_file" ] || continue
      if [ -f "/host-auth-files/$auth_file" ]; then
        mkdir -p "$(dirname "$HOME/$auth_file")"
        cp "/host-auth-files/$auth_file" "$HOME/$auth_file"
        chmod u+rw "$HOME/$auth_file" || true
      fi
    done
  fi
fi
if [ "${KOVA_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" != "api-key" ] && [ ! -s "$HOME/.codex/auth.json" ]; then
  echo "ERROR: missing ~/.codex/auth.json for Codex harness live test." >&2
  exit 1
fi
if [ "${KOVA_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" != "api-key" ]; then
  node --import tsx /src/scripts/prepare-codex-ci-auth.ts "$HOME/.codex/auth.json"
fi
if [ ! -x "$NPM_CONFIG_PREFIX/bin/codex" ]; then
  npm install -g @openai/codex
fi
if [ "${KOVA_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" = "api-key" ]; then
  printf '%s\n' "$OPENAI_API_KEY" | "$NPM_CONFIG_PREFIX/bin/codex" login --with-api-key >/dev/null
fi
tmp_dir="$(mktemp -d)"
source /src/scripts/lib/live-docker-stage.sh
kova_live_stage_source_tree "$tmp_dir"
kova_live_stage_node_modules "$tmp_dir"
kova_live_link_runtime_tree "$tmp_dir"
kova_live_stage_state_dir "$tmp_dir/.kova-state"
kova_live_prepare_staged_config
cd "$tmp_dir"
if [ "${KOVA_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG:-1}" = "1" ]; then
  node --import tsx /src/scripts/prepare-codex-ci-config.ts "$HOME/.codex/config.toml" "$tmp_dir"
fi
codex_preflight_log="$tmp_dir/codex-preflight.log"
codex_preflight_token="CODEX-PREFLIGHT-OK"
if ! "$NPM_CONFIG_PREFIX/bin/codex" exec \
  --json \
  --color never \
  --skip-git-repo-check \
  "Reply exactly: $codex_preflight_token" >"$codex_preflight_log" 2>&1; then
  if grep -q "Failed to extract accountId from token" "$codex_preflight_log"; then
    echo "SKIP: Codex auth cannot extract accountId from the available token; skipping live Codex harness lane."
    exit 0
  fi
  cat "$codex_preflight_log" >&2
  exit 1
fi
pnpm test:live ${KOVA_LIVE_CODEX_TEST_FILES:-src/gateway/gateway-codex-harness.live.test.ts}
EOF

kova_live_codex_harness_append_build_extension codex
"$ROOT_DIR/scripts/test-live-build-docker.sh"

echo "==> Run Codex harness live test in Docker"
echo "==> Model: ${KOVA_LIVE_CODEX_HARNESS_MODEL:-codex/gpt-5.5}"
echo "==> Image probe: ${KOVA_LIVE_CODEX_HARNESS_IMAGE_PROBE:-1}"
echo "==> MCP probe: ${KOVA_LIVE_CODEX_HARNESS_MCP_PROBE:-1}"
echo "==> Subagent probe: ${KOVA_LIVE_CODEX_HARNESS_SUBAGENT_PROBE:-1}"
echo "==> Subagent-only fast path: ${KOVA_LIVE_CODEX_HARNESS_SUBAGENT_ONLY:-auto}"
echo "==> Guardian probe: ${KOVA_LIVE_CODEX_HARNESS_GUARDIAN_PROBE:-1}"
echo "==> Auth mode: $CODEX_HARNESS_AUTH_MODE"
echo "==> Profile file: $PROFILE_STATUS"
echo "==> CI-safe Codex config: ${KOVA_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG:-1}"
echo "==> Test files: ${KOVA_LIVE_CODEX_TEST_FILES:-src/gateway/gateway-codex-harness.live.test.ts}"
echo "==> Harness fallback: none"
echo "==> Auth files: ${AUTH_FILES_CSV:-none}"
DOCKER_RUN_ARGS=(docker run --rm -t \
  -u "$DOCKER_USER" \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e KOVA_AGENT_HARNESS_FALLBACK=none \
  -e KOVA_DOCKER_AUTH_PRESTAGED="$DOCKER_AUTH_PRESTAGED" \
  -e KOVA_CODEX_APP_SERVER_BIN="${KOVA_CODEX_APP_SERVER_BIN:-codex}" \
  -e KOVA_DOCKER_AUTH_FILES_RESOLVED="$AUTH_FILES_CSV" \
  -e KOVA_LIVE_DOCKER_SOURCE_STAGE_MODE="${KOVA_LIVE_DOCKER_SOURCE_STAGE_MODE:-copy}" \
  -e KOVA_LIVE_CODEX_HARNESS_AUTH="$CODEX_HARNESS_AUTH_MODE" \
  -e KOVA_LIVE_CODEX_HARNESS=1 \
  -e KOVA_LIVE_CODEX_HARNESS_DEBUG="${KOVA_LIVE_CODEX_HARNESS_DEBUG:-}" \
  -e KOVA_LIVE_CODEX_HARNESS_GUARDIAN_PROBE="${KOVA_LIVE_CODEX_HARNESS_GUARDIAN_PROBE:-1}" \
  -e KOVA_LIVE_CODEX_HARNESS_IMAGE_PROBE="${KOVA_LIVE_CODEX_HARNESS_IMAGE_PROBE:-1}" \
  -e KOVA_LIVE_CODEX_HARNESS_MCP_PROBE="${KOVA_LIVE_CODEX_HARNESS_MCP_PROBE:-1}" \
  -e KOVA_LIVE_CODEX_HARNESS_MODEL="${KOVA_LIVE_CODEX_HARNESS_MODEL:-codex/gpt-5.5}" \
  -e KOVA_LIVE_CODEX_HARNESS_REQUIRE_GUARDIAN_EVENTS="${KOVA_LIVE_CODEX_HARNESS_REQUIRE_GUARDIAN_EVENTS:-1}" \
  -e KOVA_LIVE_CODEX_HARNESS_REQUEST_TIMEOUT_MS="${KOVA_LIVE_CODEX_HARNESS_REQUEST_TIMEOUT_MS:-}" \
  -e KOVA_LIVE_CODEX_HARNESS_SUBAGENT_ONLY="${KOVA_LIVE_CODEX_HARNESS_SUBAGENT_ONLY:-}" \
  -e KOVA_LIVE_CODEX_HARNESS_SUBAGENT_PROBE="${KOVA_LIVE_CODEX_HARNESS_SUBAGENT_PROBE:-1}" \
  -e KOVA_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG="${KOVA_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG:-1}" \
  -e KOVA_LIVE_CODEX_BIND="${KOVA_LIVE_CODEX_BIND:-}" \
  -e KOVA_LIVE_CODEX_BIND_MODEL="${KOVA_LIVE_CODEX_BIND_MODEL:-}" \
  -e KOVA_LIVE_CODEX_TEST_FILES="${KOVA_LIVE_CODEX_TEST_FILES:-}" \
  -e KOVA_LIVE_TEST=1 \
  -e KOVA_VITEST_FS_MODULE_CACHE=0)
kova_live_append_array DOCKER_RUN_ARGS DOCKER_AUTH_ENV
kova_live_append_array DOCKER_RUN_ARGS DOCKER_EXTRA_ENV_FILES
kova_live_append_array DOCKER_RUN_ARGS DOCKER_HOME_MOUNT
DOCKER_RUN_ARGS+=(\
  -v "$CACHE_HOME_DIR":/home/node/.cache \
  -v "$ROOT_DIR":/src:ro \
  -v "$CONFIG_DIR":/home/node/.kova \
  -v "$WORKSPACE_DIR":/home/node/.kova/workspace \
  -v "$CLI_TOOLS_DIR":/home/node/.npm-global)
kova_live_append_array DOCKER_RUN_ARGS EXTERNAL_AUTH_MOUNTS
kova_live_append_array DOCKER_RUN_ARGS PROFILE_MOUNT
DOCKER_RUN_ARGS+=(\
  "$LIVE_IMAGE_NAME" \
  -lc "$LIVE_TEST_CMD")
"${DOCKER_RUN_ARGS[@]}"
