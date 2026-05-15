#!/usr/bin/env bash
# Installs an Kova package candidate in Docker, performs Telegram
# onboarding/doctor recovery, then runs the Telegram QA live harness.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "kova-npm-telegram-live-e2e" KOVA_NPM_TELEGRAM_LIVE_E2E_IMAGE)"
DOCKER_TARGET="${KOVA_NPM_TELEGRAM_DOCKER_TARGET:-build}"
PACKAGE_SPEC="${KOVA_NPM_TELEGRAM_PACKAGE_SPEC:-getkova@beta}"
PACKAGE_TGZ="${KOVA_NPM_TELEGRAM_PACKAGE_TGZ:-${KOVA_CURRENT_PACKAGE_TGZ:-}}"
PACKAGE_LABEL="${KOVA_NPM_TELEGRAM_PACKAGE_LABEL:-}"
OUTPUT_DIR="${KOVA_NPM_TELEGRAM_OUTPUT_DIR:-.artifacts/qa-e2e/npm-telegram-live}"

resolve_credential_source() {
  if [ -n "${KOVA_NPM_TELEGRAM_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$KOVA_NPM_TELEGRAM_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${KOVA_QA_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$KOVA_QA_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${CI:-}" ] && [ -n "${KOVA_QA_CONVEX_SITE_URL:-}" ]; then
    if [ -n "${KOVA_QA_CONVEX_SECRET_CI:-}" ] || [ -n "${KOVA_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      printf "convex"
    fi
  fi
}

resolve_credential_role() {
  if [ -n "${KOVA_NPM_TELEGRAM_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$KOVA_NPM_TELEGRAM_CREDENTIAL_ROLE"
    return 0
  fi
  if [ -n "${KOVA_QA_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$KOVA_QA_CREDENTIAL_ROLE"
  fi
}

validate_kova_package_spec() {
  local spec="$1"
  if [[ "$spec" =~ ^getkova@(beta|latest|((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-beta\.[1-9][0-9]*)?|[0-9]{4}\.[1-9][0-9]*\.[1-9][0-9]*(-[1-9][0-9]*|-beta\.[1-9][0-9]*)?))$ ]]; then
    return 0
  fi
  echo "KOVA_NPM_TELEGRAM_PACKAGE_SPEC must be getkova@beta, getkova@latest, or an exact Kova release version; got: $spec" >&2
  exit 1
}

resolve_package_tgz() {
  local candidate="$1"
  if [ -z "$candidate" ]; then
    return 0
  fi
  if [ ! -f "$candidate" ]; then
    echo "KOVA_NPM_TELEGRAM_PACKAGE_TGZ must point to an existing .tgz file; got: $candidate" >&2
    exit 1
  fi
  case "$candidate" in
    *.tgz) ;;
    *)
      echo "KOVA_NPM_TELEGRAM_PACKAGE_TGZ must point to a .tgz file; got: $candidate" >&2
      exit 1
      ;;
  esac
  local dir
  local base
  dir="$(cd "$(dirname "$candidate")" && pwd)"
  base="$(basename "$candidate")"
  printf "%s/%s" "$dir" "$base"
}

package_mount_args=()
package_install_source="$PACKAGE_SPEC"
resolved_package_tgz="$(resolve_package_tgz "$PACKAGE_TGZ")"
if [ -n "$resolved_package_tgz" ]; then
  package_install_source="/package-under-test/$(basename "$resolved_package_tgz")"
  package_mount_args=(-v "$resolved_package_tgz:$package_install_source:ro")
else
  validate_kova_package_spec "$PACKAGE_SPEC"
fi
if [ -z "$PACKAGE_LABEL" ]; then
  if [ -n "$resolved_package_tgz" ]; then
    PACKAGE_LABEL="$(basename "$resolved_package_tgz")"
  else
    PACKAGE_LABEL="$PACKAGE_SPEC"
  fi
fi

docker_e2e_build_or_reuse "$IMAGE_NAME" npm-telegram-live "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"
docker_e2e_harness_mount_args

mkdir -p "$ROOT_DIR/.artifacts/qa-e2e"
run_log="$(mktemp "${TMPDIR:-/tmp}/kova-npm-telegram-live.XXXXXX")"
npm_prefix_host="$(mktemp -d "$ROOT_DIR/.artifacts/qa-e2e/npm-telegram-live-prefix.XXXXXX")"
trap 'rm -f "$run_log"; rm -rf "$npm_prefix_host"' EXIT
credential_source="$(resolve_credential_source)"
credential_role="$(resolve_credential_role)"
if [ -z "$credential_role" ] && [ -n "${CI:-}" ] && [ "$credential_source" = "convex" ]; then
  credential_role="ci"
fi

docker_env=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e KOVA_NPM_TELEGRAM_PACKAGE_SPEC="$PACKAGE_SPEC"
  -e KOVA_NPM_TELEGRAM_PACKAGE_LABEL="$PACKAGE_LABEL"
  -e KOVA_NPM_TELEGRAM_OUTPUT_DIR="$OUTPUT_DIR"
  -e KOVA_NPM_TELEGRAM_FAST="${KOVA_NPM_TELEGRAM_FAST:-1}"
)

forward_env_if_set() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    docker_env+=(-e "$key")
  fi
}

if [ -n "$credential_source" ]; then
  docker_env+=(-e KOVA_QA_CREDENTIAL_SOURCE="$credential_source")
fi
if [ -n "$credential_role" ]; then
  docker_env+=(-e KOVA_QA_CREDENTIAL_ROLE="$credential_role")
fi

for key in \
  OPENAI_API_KEY \
  ANTHROPIC_API_KEY \
  GEMINI_API_KEY \
  GOOGLE_API_KEY \
  KOVA_LIVE_OPENAI_KEY \
  KOVA_LIVE_ANTHROPIC_KEY \
  KOVA_LIVE_GEMINI_KEY \
  KOVA_QA_TELEGRAM_GROUP_ID \
  KOVA_QA_TELEGRAM_DRIVER_BOT_TOKEN \
  KOVA_QA_TELEGRAM_SUT_BOT_TOKEN \
  KOVA_QA_CONVEX_SITE_URL \
  KOVA_QA_CONVEX_SECRET_CI \
  KOVA_QA_CONVEX_SECRET_MAINTAINER \
  KOVA_QA_CREDENTIAL_LEASE_TTL_MS \
  KOVA_QA_CREDENTIAL_HEARTBEAT_INTERVAL_MS \
  KOVA_QA_CREDENTIAL_ACQUIRE_TIMEOUT_MS \
  KOVA_QA_CREDENTIAL_HTTP_TIMEOUT_MS \
  KOVA_QA_CONVEX_ENDPOINT_PREFIX \
  KOVA_QA_CREDENTIAL_OWNER_ID \
  KOVA_QA_ALLOW_INSECURE_HTTP \
  KOVA_QA_REDACT_PUBLIC_METADATA \
  KOVA_QA_TELEGRAM_CAPTURE_CONTENT \
  KOVA_QA_SUITE_PROGRESS \
  KOVA_NPM_TELEGRAM_PROVIDER_MODE \
  KOVA_NPM_TELEGRAM_MODEL \
  KOVA_NPM_TELEGRAM_ALT_MODEL \
  KOVA_NPM_TELEGRAM_SCENARIOS \
  KOVA_NPM_TELEGRAM_SUT_ACCOUNT \
  KOVA_NPM_TELEGRAM_ALLOW_FAILURES; do
  forward_env_if_set "$key"
done

run_logged() {
  if ! "$@" >"$run_log" 2>&1; then
    cat "$run_log"
    exit 1
  fi
  cat "$run_log"
  >"$run_log"
}

echo "Running package Telegram live Docker E2E ($PACKAGE_LABEL)..."
run_logged docker run --rm \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e KOVA_NPM_TELEGRAM_INSTALL_SOURCE="$package_install_source" \
  -e KOVA_NPM_TELEGRAM_PACKAGE_LABEL="$PACKAGE_LABEL" \
  "${package_mount_args[@]}" \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export HOME="$(mktemp -d "/tmp/kova-npm-telegram-install.XXXXXX")"
export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

install_source="${KOVA_NPM_TELEGRAM_INSTALL_SOURCE:?missing KOVA_NPM_TELEGRAM_INSTALL_SOURCE}"
package_label="${KOVA_NPM_TELEGRAM_PACKAGE_LABEL:-$install_source}"
echo "Installing ${package_label} from ${install_source}..."
npm install -g "$install_source" --no-fund --no-audit

command -v kova
kova --version
EOF

# Mount only test harness/plugin QA sources; the SUT itself is the installed package candidate.
run_logged docker run --rm \
  "${docker_env[@]}" \
  -v "$ROOT_DIR/.artifacts:/app/.artifacts" \
  "${DOCKER_E2E_HARNESS_ARGS[@]}" \
  -v "$ROOT_DIR/extensions:/app/extensions:ro" \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export HOME="$(mktemp -d "/tmp/kova-npm-telegram-runtime.XXXXXX")"
export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export KOVA_NPM_TELEGRAM_REPO_ROOT="/app"

dump_hotpath_logs() {
  local status="$1"
  echo "installed-package onboarding recovery hot path failed with exit code $status" >&2
  for file in \
    /tmp/kova-npm-telegram-onboard.json \
    /tmp/kova-npm-telegram-channel-add.log \
    /tmp/kova-npm-telegram-doctor-fix.log \
    /tmp/kova-npm-telegram-doctor-check.log; do
    if [ -f "$file" ]; then
      echo "--- $file ---" >&2
      sed -n '1,220p' "$file" >&2 || true
    fi
  done
}
trap 'status=$?; dump_hotpath_logs "$status"; exit "$status"' ERR

command -v kova
kova --version
mkdir -p /app/node_modules
kova_package_dir="/npm-global/lib/node_modules/getkova"
# The mounted QA harness imports getkova/plugin-sdk and package dependencies;
# point those imports at the installed package without copying source into the test image.
rm -rf /app/node_modules/kova /app/node_modules/getkova
ln -sfnT "$kova_package_dir" /app/node_modules/kova
ln -sfnT "$kova_package_dir" /app/node_modules/getkova
rm -rf /app/dist
ln -sfnT "$kova_package_dir/dist" /app/dist
cp "$kova_package_dir/package.json" /app/package.json
rm -rf "$kova_package_dir/extensions"
ln -sfnT /app/extensions "$kova_package_dir/extensions"
node --input-type=module <<'NODE'
import fs from "node:fs";

for (const packageJsonPath of [
  "/app/package.json",
  "/app/node_modules/kova/package.json",
  "/app/node_modules/getkova/package.json",
]) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  pkg.exports = pkg.exports && typeof pkg.exports === "object" ? pkg.exports : {};
  pkg.exports["./plugin-sdk/qa-channel"] = {
    types: "./extensions/qa-channel/api.ts",
    default: "./extensions/qa-channel/api.ts",
  };
  pkg.exports["./plugin-sdk/qa-channel-protocol"] = {
    types: "./extensions/qa-channel/src/protocol.ts",
    default: "./extensions/qa-channel/src/protocol.ts",
  };
  if (!pkg.exports["./plugin-sdk/gateway-runtime"]) {
    pkg.exports["./plugin-sdk/gateway-runtime"] = {
      types: "./dist/plugin-sdk/browser-node-runtime.d.ts",
      default: "./dist/plugin-sdk/browser-node-runtime.js",
    };
  }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
NODE
for deps_dir in "$kova_package_dir/node_modules" /npm-global/lib/node_modules; do
  [ -d "$deps_dir" ] || continue
  for dependency_dir in "$deps_dir"/*; do
    [ -e "$dependency_dir" ] || continue
    dependency_name="$(basename "$dependency_dir")"
    case "$dependency_name" in
      .bin | kova | getkova)
        continue
        ;;
      @*)
        [ -d "$dependency_dir" ] || continue
        mkdir -p "/app/node_modules/$dependency_name"
        for scoped_dependency_dir in "$dependency_dir"/*; do
          [ -e "$scoped_dependency_dir" ] || continue
          scoped_dependency_name="$(basename "$scoped_dependency_dir")"
          rm -rf "/app/node_modules/$dependency_name/$scoped_dependency_name"
          ln -sfnT "$scoped_dependency_dir" "/app/node_modules/$dependency_name/$scoped_dependency_name"
        done
        ;;
      *)
        rm -rf "/app/node_modules/$dependency_name"
        ln -sfnT "$dependency_dir" "/app/node_modules/$dependency_name"
        ;;
    esac
  done
done

link_installed_package_dependency() {
  local name="$1"
  local source="/npm-global/lib/node_modules/getkova/node_modules/$name"
  local target="/app/node_modules/$name"
  if [ ! -e "$source" ]; then
    echo "Installed package dependency is missing: $name" >&2
    return 1
  fi
  mkdir -p "$(dirname "$target")"
  ln -sfn "$source" "$target"
}

# QA Lab is intentionally mounted as harness source, so its package-local
# runtime imports must resolve from the installed package dependency tree.
for dependency in \
  @modelcontextprotocol/sdk \
  yaml \
  zod; do
  link_installed_package_dependency "$dependency"
done

echo "Running installed-package onboarding recovery hot path..."
OPENAI_API_KEY="${OPENAI_API_KEY:-sk-kova-npm-telegram-hotpath}" kova onboard --non-interactive --accept-risk \
  --mode local \
  --auth-choice openai-api-key \
  --secret-input-mode ref \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --skip-daemon \
  --skip-ui \
  --skip-skills \
  --skip-health \
  --json >/tmp/kova-npm-telegram-onboard.json </dev/null

kova channels add --channel telegram --token "123456:kova-npm-telegram-hotpath" >/tmp/kova-npm-telegram-channel-add.log 2>&1 </dev/null
kova doctor --fix --non-interactive >/tmp/kova-npm-telegram-doctor-fix.log 2>&1 </dev/null
kova doctor --non-interactive >/tmp/kova-npm-telegram-doctor-check.log 2>&1 </dev/null
if grep -F -q "Bundled plugin runtime deps are missing." /tmp/kova-npm-telegram-doctor-check.log; then
  exit 1
fi
if grep -F -q "Failed to install bundled plugin runtime deps" /tmp/kova-npm-telegram-doctor-fix.log; then
  exit 1
fi

export KOVA_NPM_TELEGRAM_SUT_COMMAND="$(command -v kova)"
trap - ERR
tsx scripts/e2e/npm-telegram-live-runner.ts
EOF

echo "package Telegram live Docker E2E passed ($PACKAGE_LABEL)"
