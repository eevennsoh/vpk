#!/bin/bash
set -euo pipefail

CHECK_RUNTIME=true
if [ "${1:-}" = "--check-only" ]; then
  CHECK_RUNTIME=false
elif [ -n "${1:-}" ]; then
  echo "Usage: $0 [--check-only]"
  exit 2
fi

ERRORS=0

pass() {
  echo "✅ $1"
}

fail() {
  echo "❌ $1"
  ERRORS=$((ERRORS + 1))
}

require_file() {
  if [ -f "$1" ]; then
    pass "$1 exists"
  else
    fail "$1 is missing"
  fi
}

echo "🔍 Pre-deployment checks"
echo ""

echo "📦 Checking pnpm workspace inputs..."
require_file package.json
require_file pnpm-lock.yaml
require_file pnpm-workspace.yaml
require_file backend/package.json

if grep -q '"packageManager": "pnpm@' package.json 2>/dev/null; then
  pass "package.json pins pnpm through packageManager"
else
  fail "package.json must pin pnpm through packageManager"
fi

if grep -q '"build:export": "node scripts/build-static-export.mjs"' package.json 2>/dev/null; then
  pass "package.json exposes the canonical build:export wrapper"
else
  fail "package.json must expose build:export through scripts/build-static-export.mjs"
fi

echo ""
echo "🐳 Checking runtime image contract..."
require_file backend/Dockerfile
if grep -Eq '^FROM node:24([.-]|$)' backend/Dockerfile 2>/dev/null; then
  pass "backend/Dockerfile uses Node 24"
else
  fail "backend/Dockerfile must use Node 24"
fi

if grep -Eq '^COPY out +\./backend/public$' backend/Dockerfile 2>/dev/null; then
  pass "backend/Dockerfile packages the prebuilt static export"
else
  fail "backend/Dockerfile must copy prebuilt out/ into backend/public"
fi

if grep -Eq '^RUN --mount=type=secret,id=npmrc,target=/root/\.npmrc,required=false' backend/Dockerfile 2>/dev/null \
    && grep -q 'pnpm install --prod --frozen-lockfile' backend/Dockerfile 2>/dev/null; then
  pass "backend/Dockerfile consumes the optional npmrc secret during pnpm install"
else
  fail "backend/Dockerfile must consume npmrc as an optional BuildKit secret during pnpm install"
fi

echo ""
echo "⚙️  Checking static-export wrapper..."
require_file scripts/build-static-export.mjs
require_file next.config.ts
require_file .agents/skills/vpk-deploy/scripts/deploy-lib.sh
require_file .agents/skills/vpk-deploy/scripts/verify-initial-theme.mjs
if grep -q 'NEXT_OUTPUT' next.config.ts 2>/dev/null; then
  pass "next.config.ts supports wrapper-controlled static export"
else
  fail "next.config.ts must support the NEXT_OUTPUT export mode"
fi

for deploy_script in \
  .agents/skills/vpk-deploy/scripts/deploy.sh \
  scripts/dev-deploy-fast.sh; do
  require_file "$deploy_script"
  export_line=$(grep -n -m1 'corepack pnpm run build:export' "$deploy_script" 2>/dev/null | cut -d: -f1 || true)
  docker_line=$(grep -n -m1 'vpk_build_image' "$deploy_script" 2>/dev/null | cut -d: -f1 || true)
  if [ -n "$export_line" ] && [ -n "$docker_line" ] && [ "$export_line" -lt "$docker_line" ]; then
    pass "$deploy_script exports before Docker packaging"
  else
    fail "$deploy_script must run build:export before Docker packaging"
  fi
done

if [ -f out/index.html ]; then
  pass "out/index.html is present"
else
  echo "ℹ️  out/ is not built yet; deploy scripts run corepack pnpm run build:export before Docker packaging"
fi

echo ""
echo "🔐 Checking local deployment hints..."
if [ -f .deploy.local ]; then
  pass ".deploy.local exists"
else
  echo "ℹ️  .deploy.local is absent; it is required only for pnpm run deploy:micros"
fi

if [ "$CHECK_RUNTIME" = true ]; then
  echo ""
  echo "🐋 Checking Docker..."
  if ! command -v docker >/dev/null 2>&1; then
    fail "docker is not installed"
  elif docker info >/dev/null 2>&1; then
    pass "Docker is running"
  else
    fail "Docker is not running or not accessible"
  fi
else
  echo "ℹ️  --check-only skips the Docker daemon check"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ Pre-deployment checks found $ERRORS issue(s)"
  exit 1
fi

pass "Pre-deployment checks passed"
