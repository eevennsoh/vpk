#!/usr/bin/env node
// `pnpm run typecheck:build`: type-check the app with TypeScript 6, the checker `next build` uses.
//
// `pnpm run typecheck` (and `pnpm run check`) use the native TypeScript 7 compiler, which is about
// six times faster. The two can disagree on inference: with neither the explicit
// `lazy<ComponentType<Props>>` generic nor the `as ComponentType<Props>` cast,
// `components/ui/lazy-glyph.tsx` passes TypeScript 7 and fails TypeScript 6 with TS2322, so only
// the build caught it. CI's static job runs this script; locally it is opt-in, because it takes
// about 45 s and several GB of memory, and it takes the machine-wide heavy-run turn like
// `pnpm run check`.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The `typescript` dependency is the TypeScript 6 compatibility package Next loads.
export function resolveTypeScript6() {
	const manifestPath = require.resolve("typescript/package.json", { paths: [REPO_ROOT] });
	const manifest = require(manifestPath);
	const bin = typeof manifest.bin === "string" ? manifest.bin : Object.values(manifest.bin ?? {})[0];
	if (!bin) throw new Error(`${manifest.name} declares no compiler binary`);
	return { name: manifest.name, version: manifest.version, bin: path.resolve(path.dirname(manifestPath), bin) };
}

async function main() {
	const { acquireHeavyRunLock } = require("./lib/heavy-run-lock.js");
	const typescript = resolveTypeScript6();
	if (!typescript.version.startsWith("6.")) {
		console.error(`typecheck:build expects TypeScript 6 (the checker next build uses), found ${typescript.name} ${typescript.version}.`);
		process.exit(2);
	}
	const lock = await acquireHeavyRunLock({ label: "pnpm run typecheck:build" });
	let status;
	try {
		const result = spawnSync(process.execPath, ["--max-old-space-size=8192", typescript.bin, "--noEmit", "--incremental", "false", "-p", "tsconfig.json"], {
			cwd: REPO_ROOT,
			stdio: "inherit",
		});
		status = result.status ?? 1;
	} finally {
		lock.release();
	}
	process.exit(status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
