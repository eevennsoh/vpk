#!/usr/bin/env bash
# verify-target.sh
#
# Runs four verification steps inside an extracted sibling project:
#   1. pnpm install  — confirms deps are resolvable
#   2. pnpm typecheck — catches missing imports
#   3. one build    — selects build:export when available or explicitly requested
#   4. inventory    — verifies referenced assets and reports packaged sizes
#
# Usage:
#   verify-target.sh <target-dir> [--export]
#
# Exits 0 on success; non-zero (with the failing step's exit code) on failure.
# Each step's output is streamed to stdout so the caller sees progress live.

set -euo pipefail

TARGET="${1:-}"
BUILD_SCRIPT="build"
if [[ "${2:-}" == "--export" && "$#" == 2 ]]; then
	BUILD_SCRIPT="build:export"
elif [[ "$#" != 1 ]]; then
	echo "Usage: verify-target.sh <target-dir> [--export]" >&2
	exit 2
fi
if [[ -z "$TARGET" ]]; then
	echo "Usage: verify-target.sh <target-dir> [--export]" >&2
	exit 2
fi
if [[ ! -d "$TARGET" ]]; then
	echo "Target directory not found: $TARGET" >&2
	exit 2
fi

RECEIPT_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../vpk-deploy/scripts" && pwd)/release-receipt.mjs"
cd "$TARGET"

echo "━━━━ 1/4  pnpm install ━━━━"
pnpm install
node "$RECEIPT_SCRIPT" inputs --target "$PWD" --receipt "$PWD/output/build-inputs.json"

echo ""
echo "━━━━ 2/4  pnpm typecheck ━━━━"
pnpm run typecheck

echo ""
if [[ "$BUILD_SCRIPT" == "build" ]] && node -e 'process.exit(JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).scripts?.["build:export"] ? 0 : 1)'; then
	BUILD_SCRIPT="build:export"
fi
echo "━━━━ 3/4  pnpm $BUILD_SCRIPT ━━━━"
pnpm run "$BUILD_SCRIPT"
if [[ ! -f out/index.html ]]; then
	echo "Static export did not produce out/index.html" >&2
	exit 1
fi

echo ""
echo "━━━━ 4/4  export inventory ━━━━"
node scripts/prepare-static-export.mjs out --compress --report output/export-inventory.json
node "$RECEIPT_SCRIPT" capture --target "$PWD" --receipt "$PWD/output/release-receipt.json" \
  --inputs-file "$PWD/output/build-inputs.json" --build-script "$BUILD_SCRIPT" --checks install,typecheck,export,inventory,compression

echo ""
echo "✅ Verification passed. Try: cd $TARGET && pnpm dev"
