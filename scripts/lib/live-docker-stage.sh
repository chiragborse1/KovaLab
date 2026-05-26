#!/usr/bin/env bash

kova_live_stage_source_tree() {
  local dest_dir="${1:?destination directory required}"
  local stage_mode="${KOVA_LIVE_DOCKER_SOURCE_STAGE_MODE:-copy}"

  if [ "$stage_mode" = "symlink" ]; then
    echo "KOVA_LIVE_DOCKER_SOURCE_STAGE_MODE=symlink is disabled; using copy staging." >&2
  fi

  set +e
  tar -C /src \
    --warning=no-file-changed \
    --ignore-failed-read \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.pnpm-store \
    --exclude=.tmp \
    --exclude=.tmp-precommit-venv \
    --exclude=.worktrees \
    --exclude=__kova_vitest__ \
    --exclude=relay.sock \
    --exclude='*.sock' \
    --exclude='*/*.sock' \
    --exclude='apps/*/.build' \
    --exclude='apps/*/*.bun-build' \
    --exclude='apps/*/.gradle' \
    --exclude='apps/*/.kotlin' \
    --exclude='apps/*/build' \
    -cf - . | tar -C "$dest_dir" -xf -
  local status=$?
  set -e
  if [ "$status" -gt 1 ]; then
    return "$status"
  fi
}

kova_live_link_runtime_tree() {
  local dest_dir="${1:?destination directory required}"

  if [ ! -e "$dest_dir/node_modules" ]; then
    ln -s /app/node_modules "$dest_dir/node_modules"
  fi
  ln -s /app/dist "$dest_dir/dist"
  if [ -d /app/dist-runtime/extensions ]; then
    export KOVA_BUNDLED_PLUGINS_DIR=/app/dist-runtime/extensions
  elif [ -d /app/dist/extensions ]; then
    export KOVA_BUNDLED_PLUGINS_DIR=/app/dist/extensions
  fi
}

kova_live_stage_node_modules() {
  local dest_dir="${1:?destination directory required}"
  local target_dir="$dest_dir/node_modules"

  mkdir -p "$target_dir"
  cp -aRs /app/node_modules/. "$target_dir"
  rm -rf "$target_dir/.vite-temp"
  mkdir -p "$target_dir/.vite-temp"
}

kova_live_stage_state_dir() {
  local dest_dir="${1:?destination directory required}"
  local source_dir="${HOME}/.kova"

  mkdir -p "$dest_dir"
  if [ -d "$source_dir" ]; then
    # Sandbox workspaces can accumulate root-owned artifacts from prior Docker
    # runs. The persisted plugin registry contains host-absolute paths that are
    # not portable into Linux containers. Neither is needed for live-test
    # auth/config staging, so keep them out of the staged state copy.
    set +e
    tar -C "$source_dir" \
      --warning=no-file-changed \
      --ignore-failed-read \
      --exclude=workspace \
      --exclude=sandboxes \
      --exclude=plugins/installs.json \
      --exclude=relay.sock \
      --exclude='*.sock' \
      --exclude='*/*.sock' \
      -cf - . | tar -C "$dest_dir" -xf -
    local status=$?
    set -e
    if [ "$status" -gt 1 ]; then
      return "$status"
    fi
    chmod -R u+rwX "$dest_dir" || true
    if [ -d "$source_dir/workspace" ] && [ ! -e "$dest_dir/workspace" ]; then
      ln -s "$source_dir/workspace" "$dest_dir/workspace"
    fi
  fi

  export KOVA_STATE_DIR="$dest_dir"
  export KOVA_CONFIG_PATH="$dest_dir/kova.json"
}

kova_live_prepare_staged_config() {
  if [ ! -f "${KOVA_CONFIG_PATH:-}" ]; then
    return 0
  fi

  (
    cd /app
    node --import tsx /src/scripts/live-docker-normalize-config.ts
  )
}
