const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const SESSION_TIME_PATH = path.join(__dirname, "session-time.ts");

let sessionTimePromise;
function loadSessionTime() {
	if (!sessionTimePromise) {
		sessionTimePromise = esbuild
			.build({
				entryPoints: [SESSION_TIME_PATH],
				bundle: true,
				format: "cjs",
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(result.outputFiles[0].text, "session-time-harness.cjs"));
	}
	return sessionTimePromise;
}

test("formatSessionTimestamp uses compact relative labels against a story clock", async () => {
	const { formatSessionTimestamp } = await loadSessionTime();
	const referenceTimeMs = Date.UTC(2026, 4, 12, 10, 0);

	assert.equal(formatSessionTimestamp(referenceTimeMs - 5_000, referenceTimeMs), "Just now");
	assert.equal(formatSessionTimestamp(referenceTimeMs - 5 * 60_000, referenceTimeMs), "5m ago");
	assert.equal(formatSessionTimestamp(referenceTimeMs - 60 * 60_000, referenceTimeMs), "1h ago");
	assert.equal(formatSessionTimestamp(referenceTimeMs - 2 * 60 * 60_000, referenceTimeMs), "2h ago");
	assert.equal(formatSessionTimestamp(referenceTimeMs - 24 * 60 * 60_000, referenceTimeMs), "Yesterday");
	assert.equal(formatSessionTimestamp(referenceTimeMs - 3 * 24 * 60 * 60_000, referenceTimeMs), "3d ago");
});

test("formatSessionTimestamp falls back to a clock label without a reference time", async () => {
	const { formatSessionTimestamp } = await loadSessionTime();

	assert.equal(formatSessionTimestamp(Date.UTC(2026, 4, 12, 9, 5)), "9:05 AM");
});
