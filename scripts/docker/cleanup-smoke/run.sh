#!/usr/bin/env bash
set -euo pipefail

cd /repo

export KOVA_STATE_DIR="/tmp/kova-test"
export KOVA_CONFIG_PATH="${KOVA_STATE_DIR}/kova.json"

echo "==> Build"
if ! pnpm build >/tmp/kova-cleanup-build.log 2>&1; then
  cat /tmp/kova-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${KOVA_STATE_DIR}/credentials"
mkdir -p "${KOVA_STATE_DIR}/agents/main/sessions"
echo '{}' >"${KOVA_CONFIG_PATH}"
echo 'creds' >"${KOVA_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${KOVA_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm kova reset --scope config+creds+sessions --yes --non-interactive >/tmp/kova-cleanup-reset.log 2>&1; then
  cat /tmp/kova-cleanup-reset.log
  exit 1
fi

test ! -f "${KOVA_CONFIG_PATH}"
test ! -d "${KOVA_STATE_DIR}/credentials"
test ! -d "${KOVA_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${KOVA_STATE_DIR}/credentials"
echo '{}' >"${KOVA_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm kova uninstall --state --yes --non-interactive >/tmp/kova-cleanup-uninstall.log 2>&1; then
  cat /tmp/kova-cleanup-uninstall.log
  exit 1
fi

test ! -d "${KOVA_STATE_DIR}"

echo "OK"
