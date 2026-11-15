// Guards against a second Motion copy coming back. motion-plus 2.x pinned
// `motion ^12`, so pnpm installed it its own copy next to the app's motion 13;
// Ticker's MotionValues then lived in a different motion-dom and implicit
// `useTransform` tracking silently stopped working (see
// `components/visual/scrolling/scrolling-offset-bridge.ts`). Each Motion+ major
// peers on one `motion` major, so bumping either alone reinstates the split.
// Reads only the committed lockfile: no network, no registry token.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const LOCKFILE_PATH = path.join(__dirname, "..", "pnpm-lock.yaml");

function readMotionCopies(lockfile) {
	const packagesStart = lockfile.indexOf("\npackages:\n");
	const snapshotsStart = lockfile.indexOf("\nsnapshots:\n");
	assert.ok(packagesStart !== -1 && snapshotsStart > packagesStart, "lockfile has packages: and snapshots: sections");
	const packages = lockfile.slice(packagesStart, snapshotsStart);
	const snapshots = lockfile.slice(snapshotsStart);

	const motionVersions = [...packages.matchAll(/^ {2}motion@([^:\s]+):$/gmu)].map((match) => match[1]);

	const importers = lockfile.slice(lockfile.indexOf("\nimporters:\n"), packagesStart);
	const rootStart = importers.indexOf("\n  .:\n");
	assert.ok(rootStart !== -1, "lockfile has a root importer");
	const afterRoot = importers.slice(rootStart + 1);
	const nextImporter = afterRoot.slice(1).search(/^ {2}\S/mu);
	const rootImporter = nextImporter === -1 ? afterRoot : afterRoot.slice(0, nextImporter + 1);
	const rootMotion = rootImporter.match(/^ {6}motion:\n {8}specifier: [^\n]+\n {8}version: (\d[^(\s]*)/mu)?.[1] ?? null;

	const motionPlusSnapshot = snapshots.match(/^ {2}'@motionplus\/core@[^\n]+':\n((?: {4}[^\n]*\n)*)/mu);
	const motionPlusMotion = motionPlusSnapshot?.[1].match(/^ {6}motion: (\d[^(\s]*)/mu)?.[1] ?? null;

	return { motionVersions, rootMotion, motionPlusMotion };
}

test("only one motion version is installed", () => {
	const { motionVersions } = readMotionCopies(readFileSync(LOCKFILE_PATH, "utf8"));
	assert.equal(motionVersions.length, 1, `expected one motion package in pnpm-lock.yaml, found: ${motionVersions.join(", ") || "none"}`);
});

test("motion-plus resolves the app's motion version", () => {
	const { rootMotion, motionPlusMotion } = readMotionCopies(readFileSync(LOCKFILE_PATH, "utf8"));
	assert.ok(rootMotion, "root importer depends on motion");
	assert.ok(motionPlusMotion, "@motionplus/core snapshot depends on motion");
	assert.equal(motionPlusMotion, rootMotion, "bump motion-plus (@motionplus/core) and motion together so they share one copy");
});
