#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/live-docker-auth.sh"
IMAGE_NAME="${KOVA_IMAGE:-kova:local}"
LIVE_IMAGE_NAME="${KOVA_LIVE_IMAGE:-${IMAGE_NAME}-live}"
PROFILE_FILE="${KOVA_PROFILE_FILE:-$HOME/.profile}"
DOCKER_USER="${KOVA_DOCKER_USER:-node}"
DOCKER_AUTH_PRESTAGED=0

kova_live_truthy() {
  case "${1:-}" in
    1 | true | TRUE | yes | YES | on | ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

TEMP_DIRS=()
DOCKER_HOME_MOUNT=()
cleanup_temp_dirs() {
  if ((${#TEMP_DIRS[@]} > 0)); then
    rm -rf "${TEMP_DIRS[@]}"
  fi
}
trap cleanup_temp_dirs EXIT

if kova_live_truthy "${KOVA_DOCKER_PROFILE_ENV_ONLY:-}"; then
  CONFIG_DIR="$(mktemp -d)"
  WORKSPACE_DIR="$(mktemp -d)"
  TEMP_DIRS+=("$CONFIG_DIR" "$WORKSPACE_DIR")
  KOVA_DOCKER_AUTH_DIRS=none
else
  CONFIG_DIR="${KOVA_CONFIG_DIR:-$HOME/.kova}"
  WORKSPACE_DIR="${KOVA_WORKSPACE_DIR:-$HOME/.kova/workspace}"
fi
if [[ -n "${KOVA_DOCKER_CACHE_HOME_DIR:-}" ]]; then
  CACHE_HOME_DIR="${KOVA_DOCKER_CACHE_HOME_DIR}"
elif [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  CACHE_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/kova-docker-cache.XXXXXX")"
  TEMP_DIRS+=("$CACHE_HOME_DIR")
else
  CACHE_HOME_DIR="$HOME/.cache/kova/docker-cache"
fi
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

AUTH_DIRS=()
AUTH_FILES=()
if [[ -n "${KOVA_DOCKER_AUTH_DIRS:-}" ]]; then
  while IFS= read -r auth_dir; do
    [[ -n "$auth_dir" ]] || continue
    AUTH_DIRS+=("$auth_dir")
  done < <(kova_live_collect_auth_dirs)
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(kova_live_collect_auth_files)
elif [[ -n "${KOVA_LIVE_PROVIDERS:-}" || -n "${KOVA_LIVE_GATEWAY_PROVIDERS:-}" ]]; then
  while IFS= read -r auth_dir; do
    [[ -n "$auth_dir" ]] || continue
    AUTH_DIRS+=("$auth_dir")
  done < <(
    {
      kova_live_collect_auth_dirs_from_csv "${KOVA_LIVE_PROVIDERS:-}"
      kova_live_collect_auth_dirs_from_csv "${KOVA_LIVE_GATEWAY_PROVIDERS:-}"
    } | awk '!seen[$0]++'
  )
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(
    {
      kova_live_collect_auth_files_from_csv "${KOVA_LIVE_PROVIDERS:-}"
      kova_live_collect_auth_files_from_csv "${KOVA_LIVE_GATEWAY_PROVIDERS:-}"
    } | awk '!seen[$0]++'
  )
else
  while IFS= read -r auth_dir; do
    [[ -n "$auth_dir" ]] || continue
    AUTH_DIRS+=("$auth_dir")
  done < <(kova_live_collect_auth_dirs)
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(kova_live_collect_auth_files)
fi
AUTH_DIRS_CSV=""
if ((${#AUTH_DIRS[@]} > 0)); then
  AUTH_DIRS_CSV="$(kova_live_join_csv "${AUTH_DIRS[@]}")"
fi
AUTH_FILES_CSV=""
if ((${#AUTH_FILES[@]} > 0)); then
  AUTH_FILES_CSV="$(kova_live_join_csv "${AUTH_FILES[@]}")"
fi

if [[ -n "${DOCKER_HOME_DIR:-}" ]]; then
  kova_live_stage_auth_into_home "$DOCKER_HOME_DIR" "${AUTH_DIRS[@]}" --files "${AUTH_FILES[@]}"
  DOCKER_AUTH_PRESTAGED=1
fi

EXTERNAL_AUTH_MOUNTS=()
if ((${#AUTH_DIRS[@]} > 0)); then
  for auth_dir in "${AUTH_DIRS[@]}"; do
    auth_dir="$(kova_live_validate_relative_home_path "$auth_dir")"
    host_path="$HOME/$auth_dir"
    if [[ -d "$host_path" ]]; then
      EXTERNAL_AUTH_MOUNTS+=(-v "$host_path":/host-auth/"$auth_dir":ro)
    fi
  done
fi
if ((${#AUTH_FILES[@]} > 0)); then
  for auth_file in "${AUTH_FILES[@]}"; do
    auth_file="$(kova_live_validate_relative_home_path "$auth_file")"
    host_path="$HOME/$auth_file"
    if [[ -f "$host_path" ]]; then
      EXTERNAL_AUTH_MOUNTS+=(-v "$host_path":/host-auth-files/"$auth_file":ro)
    fi
  done
fi

read -r -d '' LIVE_TEST_CMD <<'EOF' || true
set -euo pipefail
[ -f "$HOME/.profile" ] && [ -r "$HOME/.profile" ] && source "$HOME/.profile" || true
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export COREPACK_HOME="${COREPACK_HOME:-$XDG_CACHE_HOME/node/corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$XDG_CACHE_HOME/npm}"
export npm_config_cache="$NPM_CONFIG_CACHE"
mkdir -p "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE"
chmod 700 "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE" || true
if [ "${KOVA_DOCKER_AUTH_PRESTAGED:-0}" != "1" ]; then
  IFS=',' read -r -a auth_dirs <<<"${KOVA_DOCKER_AUTH_DIRS_RESOLVED:-}"
  IFS=',' read -r -a auth_files <<<"${KOVA_DOCKER_AUTH_FILES_RESOLVED:-}"
  if ((${#auth_dirs[@]} > 0)); then
    for auth_dir in "${auth_dirs[@]}"; do
      [ -n "$auth_dir" ] || continue
      if [ -d "/host-auth/$auth_dir" ]; then
        mkdir -p "$HOME/$auth_dir"
        cp -R "/host-auth/$auth_dir/." "$HOME/$auth_dir"
        chmod -R u+rwX "$HOME/$auth_dir" || true
      fi
    done
  fi
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
tmp_dir="$(mktemp -d)"
source /src/scripts/lib/live-docker-stage.sh
kova_live_stage_source_tree "$tmp_dir"
kova_live_stage_node_modules "$tmp_dir"
kova_live_link_runtime_tree "$tmp_dir"
kova_live_stage_state_dir "$tmp_dir/.kova-state"
kova_live_prepare_staged_config
cd "$tmp_dir"
pnpm test:live:models-profiles
EOF

"$ROOT_DIR/scripts/test-live-build-docker.sh"

echo "==> Run live model tests (profile keys)"
echo "==> Target: src/agents/models.profiles.live.test.ts"
echo "==> Profile env only: ${KOVA_DOCKER_PROFILE_ENV_ONLY:-0}"
echo "==> Profile file: $PROFILE_STATUS"
echo "==> External auth dirs: ${AUTH_DIRS_CSV:-none}"
echo "==> External auth files: ${AUTH_FILES_CSV:-none}"
DOCKER_RUN_ARGS=(docker run --rm -t \
  -u "$DOCKER_USER" \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e KOVA_SKIP_CHANNELS=1 \
  -e KOVA_SUPPRESS_NOTES=1 \
  -e KOVA_DOCKER_AUTH_PRESTAGED="$DOCKER_AUTH_PRESTAGED" \
  -e KOVA_DOCKER_AUTH_DIRS_RESOLVED="$AUTH_DIRS_CSV" \
  -e KOVA_DOCKER_AUTH_FILES_RESOLVED="$AUTH_FILES_CSV" \
  -e KOVA_LIVE_DOCKER_SOURCE_STAGE_MODE="${KOVA_LIVE_DOCKER_SOURCE_STAGE_MODE:-copy}" \
  -e KOVA_LIVE_TEST=1 \
  -e KOVA_LIVE_MODELS="${KOVA_LIVE_MODELS:-modern}" \
  -e KOVA_LIVE_PROVIDERS="${KOVA_LIVE_PROVIDERS:-}" \
  -e KOVA_LIVE_MAX_MODELS="${KOVA_LIVE_MAX_MODELS:-12}" \
  -e KOVA_LIVE_MODEL_TIMEOUT_MS="${KOVA_LIVE_MODEL_TIMEOUT_MS:-}" \
  -e KOVA_LIVE_REQUIRE_PROFILE_KEYS="${KOVA_LIVE_REQUIRE_PROFILE_KEYS:-}" \
  -e KOVA_LIVE_GATEWAY_MODELS="${KOVA_LIVE_GATEWAY_MODELS:-}" \
  -e KOVA_LIVE_GATEWAY_PROVIDERS="${KOVA_LIVE_GATEWAY_PROVIDERS:-}" \
  -e KOVA_LIVE_GATEWAY_MAX_MODELS="${KOVA_LIVE_GATEWAY_MAX_MODELS:-}")
kova_live_append_array DOCKER_RUN_ARGS DOCKER_HOME_MOUNT
DOCKER_RUN_ARGS+=(\
  -v "$CACHE_HOME_DIR":/home/node/.cache \
  -v "$ROOT_DIR":/src:ro \
  -v "$CONFIG_DIR":/home/node/.kova \
  -v "$WORKSPACE_DIR":/home/node/.kova/workspace)
kova_live_append_array DOCKER_RUN_ARGS EXTERNAL_AUTH_MOUNTS
kova_live_append_array DOCKER_RUN_ARGS PROFILE_MOUNT
DOCKER_RUN_ARGS+=(\
  "$LIVE_IMAGE_NAME" \
  -lc "$LIVE_TEST_CMD")
"${DOCKER_RUN_ARGS[@]}"
