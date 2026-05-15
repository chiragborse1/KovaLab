#!/usr/bin/env bash

DOCKER_BUILD_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! declare -F run_logged >/dev/null 2>&1; then
  source "$DOCKER_BUILD_LIB_DIR/docker-e2e-logs.sh"
fi

docker_build_on_missing_enabled() {
  case "${KOVA_DOCKER_BUILD_ON_MISSING:-}" in
    1 | true | TRUE | yes | YES)
      return 0
      ;;
    0 | false | FALSE | no | NO)
      return 1
      ;;
  esac

  [ "${KOVA_TESTBOX:-0}" = "1" ]
}

docker_build_exec() {
  local build_cmd=(docker build)
  if [ "${KOVA_DOCKER_BUILD_USE_BUILDX:-0}" = "1" ]; then
    build_cmd=(docker buildx build --load)
    if [ -n "${KOVA_DOCKER_BUILD_CACHE_FROM:-}" ]; then
      build_cmd+=(--cache-from "${KOVA_DOCKER_BUILD_CACHE_FROM}")
    fi
    if [ -n "${KOVA_DOCKER_BUILD_CACHE_TO:-}" ]; then
      build_cmd+=(--cache-to "${KOVA_DOCKER_BUILD_CACHE_TO}")
    fi
  fi

  env DOCKER_BUILDKIT=1 "${build_cmd[@]}" "$@"
}

docker_build_run() {
  local label="$1"
  shift

  local build_cmd=(docker build)
  if [ "${KOVA_DOCKER_BUILD_USE_BUILDX:-0}" = "1" ]; then
    build_cmd=(docker buildx build --load)
    if [ -n "${KOVA_DOCKER_BUILD_CACHE_FROM:-}" ]; then
      build_cmd+=(--cache-from "${KOVA_DOCKER_BUILD_CACHE_FROM}")
    fi
    if [ -n "${KOVA_DOCKER_BUILD_CACHE_TO:-}" ]; then
      build_cmd+=(--cache-to "${KOVA_DOCKER_BUILD_CACHE_TO}")
    fi
  fi

  run_logged "$label" env DOCKER_BUILDKIT=1 "${build_cmd[@]}" "$@"
}
