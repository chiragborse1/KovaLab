#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "kova-config-reload-e2e" KOVA_CONFIG_RELOAD_E2E_IMAGE)"
SKIP_BUILD="${KOVA_CONFIG_RELOAD_E2E_SKIP_BUILD:-0}"
PORT="18789"
TOKEN="reload-e2e-token"
CONTAINER_NAME="kova-config-reload-e2e-$$"
STATUS_BEFORE_LOG="/tmp/config-reload-status-before-$$.log"
STATUS_AFTER_LOG="/tmp/config-reload-status-after-$$.log"

cleanup() {
  rm -f "$STATUS_BEFORE_LOG" "$STATUS_AFTER_LOG"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

dump_gateway_debug() {
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo false)" = "true" ]; then
    echo "--- config reload gateway log ---"
    docker exec "$CONTAINER_NAME" bash -lc "tail -n 180 /tmp/config-reload-e2e.log" || true
    echo "--- status before ---"
    cat "$STATUS_BEFORE_LOG" 2>/dev/null || true
    echo "--- status after ---"
    cat "$STATUS_AFTER_LOG" 2>/dev/null || true
  else
    echo "--- config reload container logs ---"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -n 180 || true
  fi
}

on_exit() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    dump_gateway_debug
  fi
  cleanup
}
trap on_exit EXIT

assert_gateway_health() {
  local label="$1"
  docker exec "$CONTAINER_NAME" bash -lc "KOVA_E2E_LABEL='$label' KOVA_E2E_WS_URL='ws://127.0.0.1:$PORT' KOVA_E2E_TOKEN='$TOKEN' node --input-type=module - <<'NODE'
import { WebSocket } from 'ws';

const PROTOCOL_VERSION = 3;
const label = process.env.KOVA_E2E_LABEL ?? 'gateway health';
const url = process.env.KOVA_E2E_WS_URL;
const token = process.env.KOVA_E2E_TOKEN;
if (!url || !token) {
  throw new Error('missing KOVA_E2E_WS_URL/KOVA_E2E_TOKEN');
}

const ws = new WebSocket(url);

function waitForFrame(filter, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(label + ' timeout'));
    }, timeoutMs);
    function onMessage(data) {
      const frame = JSON.parse(String(data));
      if (!filter(frame)) {
        return;
      }
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(frame);
    }
    ws.on('message', onMessage);
  });
}

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(label + ' open timeout')), 15000);
  ws.once('open', () => {
    clearTimeout(timer);
    resolve();
  });
  ws.once('error', reject);
});

ws.send(
  JSON.stringify({
    type: 'req',
    id: 'connect',
    method: 'connect',
    params: {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: 'test',
        displayName: 'config reload e2e',
        version: 'dev',
        platform: process.platform,
        mode: 'test',
      },
      caps: [],
      auth: { token },
    },
  }),
);
const connectRes = await waitForFrame((frame) => frame?.type === 'res' && frame?.id === 'connect');
if (!connectRes.ok) {
  throw new Error(label + ' connect failed: ' + (connectRes.error?.message ?? 'unknown'));
}

ws.send(JSON.stringify({ type: 'req', id: 'health', method: 'health', params: {} }));
const healthRes = await waitForFrame((frame) => frame?.type === 'res' && frame?.id === 'health');
ws.close();
if (!healthRes.ok) {
  throw new Error(label + ' health failed: ' + (healthRes.error?.message ?? 'unknown'));
}
console.log('ok');
NODE"
}

docker_e2e_build_or_reuse "$IMAGE_NAME" config-reload "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "" "$SKIP_BUILD"

echo "Starting gateway container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e GATEWAY_AUTH_TOKEN_REF="$TOKEN" \
  -e KOVA_SKIP_CHANNELS=1 \
  -e KOVA_SKIP_PROVIDERS=1 \
  -e KOVA_SKIP_GMAIL_WATCHER=1 \
  -e KOVA_SKIP_CRON=1 \
  -e KOVA_SKIP_CANVAS_HOST=1 \
  "$IMAGE_NAME" \
  bash -lc "set -euo pipefail
entry=dist/index.mjs
[ -f \"\$entry\" ] || entry=dist/index.js
mkdir -p \"\$HOME/.kova\"
cat > \"\$HOME/.kova/kova.json\" <<'JSON'
{
  \"gateway\": {
    \"port\": $PORT,
    \"auth\": {
      \"mode\": \"token\",
      \"token\": {
        \"source\": \"env\",
        \"provider\": \"default\",
        \"id\": \"GATEWAY_AUTH_TOKEN_REF\"
      }
    },
    \"channelHealthCheckMinutes\": 1,
    \"reload\": {
      \"mode\": \"hybrid\",
      \"debounceMs\": 0
    }
  }
}
JSON
node \"\$entry\" gateway --port $PORT --bind loopback --allow-unconfigured > /tmp/config-reload-e2e.log 2>&1" >/dev/null

echo "Waiting for gateway..."
ready=0
for _ in $(seq 1 180); do
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo false)" != "true" ]; then
    break
  fi
  if docker exec "$CONTAINER_NAME" bash -lc "node --input-type=module -e '
    import net from \"node:net\";
    const socket = net.createConnection({ host: \"127.0.0.1\", port: $PORT });
    const timeout = setTimeout(() => {
      socket.destroy();
      process.exit(1);
    }, 400);
    socket.on(\"connect\", () => {
      clearTimeout(timeout);
      socket.end();
      process.exit(0);
    });
    socket.on(\"error\", () => {
      clearTimeout(timeout);
      process.exit(1);
    });
  ' >/dev/null 2>&1"; then
    ready=1
    break
  fi
  sleep 0.5
done

if [ "$ready" -ne 1 ]; then
  echo "Gateway failed to start"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -n 120 || true
  docker exec "$CONTAINER_NAME" bash -lc "tail -n 120 /tmp/config-reload-e2e.log" || true
  exit 1
fi

echo "Checking initial RPC status..."
assert_gateway_health "initial gateway health" >"$STATUS_BEFORE_LOG"

echo "Waiting for reload watcher readiness..."
docker exec "$CONTAINER_NAME" bash -lc "
for _ in \$(seq 1 120); do
  if grep -q 'control plane online' /tmp/config-reload-e2e.log; then
    exit 0
  fi
  sleep 0.5
done
tail -n 160 /tmp/config-reload-e2e.log >&2 || true
exit 1
"

echo "Mutating hot-reload gateway metadata..."
docker exec "$CONTAINER_NAME" bash -lc "node --input-type=module - <<'NODE'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const configPath = path.join(os.homedir(), '.kova', 'kova.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.gateway.channelHealthCheckMinutes = 2;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
NODE"

sleep 2

if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo false)" != "true" ]; then
  echo "Gateway container exited after config metadata write"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -n 120 || true
  exit 1
fi

echo "Waiting for reload application..."
docker exec "$CONTAINER_NAME" bash -lc "
for _ in \$(seq 1 120); do
  if grep -q 'config hot reload applied (gateway.channelHealthCheckMinutes)' /tmp/config-reload-e2e.log; then
    exit 0
  fi
  if grep -q 'config change requires gateway restart' /tmp/config-reload-e2e.log; then
    tail -n 160 /tmp/config-reload-e2e.log >&2 || true
    exit 1
  fi
  sleep 0.5
done
tail -n 160 /tmp/config-reload-e2e.log >&2 || true
exit 1
"

echo "Checking post-write RPC status..."
assert_gateway_health "post-reload gateway health" >"$STATUS_AFTER_LOG"

echo "Checking reload log..."
docker exec "$CONTAINER_NAME" bash -lc "node --input-type=module - <<'NODE'
import fs from 'node:fs';

const log = fs.readFileSync('/tmp/config-reload-e2e.log', 'utf8');
const reloadLines = log
  .split('\n')
  .filter((line) => line.includes('config change detected; evaluating reload'));
const restartLines = log
  .split('\n')
  .filter((line) => line.includes('config change requires gateway restart'));
if (restartLines.length > 0) {
  console.error(log.split('\n').slice(-160).join('\n'));
  throw new Error('unexpected restart-required reload line found');
}
for (const line of reloadLines) {
  for (const needle of ['gateway.auth.token', 'plugins.entries.firecrawl.config.webFetch']) {
    if (line.includes(needle)) {
      console.error(log.split('\n').slice(-160).join('\n'));
      throw new Error('runtime-only path appeared in reload diff: ' + needle);
    }
  }
}
if (reloadLines.length === 0) {
  console.error(log.split('\n').slice(-160).join('\n'));
  throw new Error('expected config reload detection log after metadata write');
}
console.log('ok');
NODE"

echo "Config reload Docker E2E passed."
