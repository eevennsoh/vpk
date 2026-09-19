#!/usr/bin/env bash
# verify-target.sh
#
# Runs the three verification steps inside an extracted sibling project:
#   1. pnpm install  — confirms deps are resolvable
#   2. pnpm typecheck — catches missing imports
#   3. static export — uses build:export when the target has that wrapper
#   4. inventory     — verifies referenced assets and reports packaged sizes
#
# Usage:
#   verify-target.sh <target-dir>
#
# Exits 0 on success; non-zero (with the failing step's exit code) on failure.
# Each step's output is streamed to stdout so the caller sees progress live.

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
	echo "Usage: verify-target.sh <target-dir>" >&2
	exit 2
fi
if [[ ! -d "$TARGET" ]]; then
	echo "Target directory not found: $TARGET" >&2
	exit 2
fi

cd "$TARGET"

echo "━━━━ 1/4  pnpm install ━━━━"
pnpm install

echo ""
echo "━━━━ 2/4  pnpm typecheck ━━━━"
pnpm run typecheck

echo ""
echo "━━━━ 3/4  static export ━━━━"
if node -e 'process.exit(JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).scripts?.["build:export"] ? 0 : 1)'; then
	pnpm run build:export
else
	pnpm run build
fi

echo ""
echo "━━━━ 4/4  export inventory ━━━━"
node scripts/prepare-static-export.mjs out --report output/export-inventory.json

echo ""
echo "✅ Verification passed. Try: cd $TARGET && pnpm dev"
