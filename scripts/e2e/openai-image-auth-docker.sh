#!/usr/bin/env bash
# Runs a mocked OpenAI image-generation auth smoke inside Docker against the
# package-installed functional E2E image.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "kova-openai-image-auth-e2e" KOVA_OPENAI_IMAGE_AUTH_E2E_IMAGE)"
SKIP_BUILD="${KOVA_OPENAI_IMAGE_AUTH_E2E_SKIP_BUILD:-0}"

docker_e2e_build_or_reuse "$IMAGE_NAME" openai-image-auth "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "" "$SKIP_BUILD"
docker_e2e_harness_mount_args

echo "Running OpenAI image auth Docker E2E..."
# Harness files are mounted read-only; the app under test comes from /app/dist.
run_logged openai-image-auth docker run --rm \
  -e "OPENAI_API_KEY=sk-kova-image-auth-e2e" \
  -e "KOVA_QA_ALLOW_LOCAL_IMAGE_PROVIDER=1" \
  "${DOCKER_E2E_HARNESS_ARGS[@]}" \
  -i "$IMAGE_NAME" bash -lc '
set -euo pipefail
export HOME="$(mktemp -d "/tmp/kova-openai-image-auth.XXXXXX")"
export KOVA_STATE_DIR="$HOME/.kova"
export KOVA_SKIP_CHANNELS=1
export KOVA_SKIP_GMAIL_WATCHER=1
export KOVA_SKIP_CRON=1
export KOVA_SKIP_CANVAS_HOST=1

tsx scripts/e2e/openai-image-auth-docker-client.ts
'
