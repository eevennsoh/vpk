const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

async function loadRuntimeStatusHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import { normalizeRuntimeStatusSnapshot } from "./lib/rovo-runtime-status.ts";

				export function normalizeSnapshot(payload) {
					return normalizeRuntimeStatusSnapshot(payload);
				}
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "rovo-runtime-status-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("normalizeRuntimeStatusSnapshot preserves the Rovo surface", async () => {
	const harness = await loadRuntimeStatusHarness();
	const snapshot = harness.normalizeSnapshot({
		status: "ok",
		timestamp: "2026-04-06T00:00:00.000Z",
		surfaces: {
			rovo: {
				available: true,
				health: "ok",
				message: "Rovo is ready.",
				name: "rovo",
				status: "ready",
				url: "http://localhost:3000",
			},
		},
	});

	assert.equal(snapshot.status, "ok");
	assert.deepEqual(snapshot.degradedSurfaces, []);
	assert.equal(snapshot.surfaces.rovo.name, "rovo");
	assert.equal(snapshot.surfaces.rovo.available, true);
});
