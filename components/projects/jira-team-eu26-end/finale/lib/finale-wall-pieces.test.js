const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-pieces";
export { buildFinaleWall, wallGeometry } from "./finale-wall-layout";
export { slotDescent, slotOnScreen, wallOffset, wallRevealAt, wallSlotRevealTime } from "./finale-wall-motion";
export { finaleStageFit } from "./finale-stage-fit";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
export { JIRA_TEAM_EU26_END_PRESENTERS } from "../../data/keynote-presenters";
`;

let piecesModule;
function load() {
	piecesModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-pieces-harness.cjs");
	return piecesModule;
}

const PUBLIC = path.join(process.cwd(), "public");
const KIT = JSON.parse(readFileSync(path.join(PUBLIC, "1p/rovo-stage-kit/pieces.json"), "utf8"));

test("piece boxes preserve catalog sizing at a shared camera scale", () => {
	const m = load();
	const pieces = ["switch", "codeCard"].map((id) => KIT.find((piece) => piece.id === id));
	const layout = m.wallPiecesLayout(pieces, 0.5);
	assert.deepEqual(layout.boxes.map((box) => Number(box.scale.toFixed(4))), [1, 0.8]);
	assert.deepEqual(layout.boxes.map((box) => Number(box.width.toFixed(4))), [170, 220.8]);
	assert.equal(Number(layout.width.toFixed(4)), 442.8);
	assert.equal(Number(layout.height.toFixed(4)), 154.4);
});

test("instance scales reach the kit unchanged, with shadow room and no fit to a tile", () => {
	const piece = KIT.find((piece) => piece.id === "codeCard");
	const layout = load().wallPiecesLayout([{ ...piece, scale: 1.408 }], 0.5);
	assert.equal(layout.boxes[0].scale, 0.704);
	assert.equal(layout.boxes[0].x, 20);
	assert.equal(layout.boxes[0].y, 20);
	assert.equal(Number(layout.width.toFixed(4)), 234.304);
	assert.equal(Number(layout.height.toFixed(4)), 140.672);
});

test("a piece settles when the kit says it does: its style's play, else its own moment", () => {
	const m = load();
	assert.equal(m.pieceStillAfter({ holds: 4 }, undefined), 4);
	assert.equal(m.pieceStillAfter({ holds: null }, undefined), null);
	assert.equal(m.pieceStillAfter({ holds: 4 }, { length: 6 }), 6);
	assert.equal(m.pieceStillAfter({ holds: 4 }, { play: "loop", rest: 1 }), null);
	assert.equal(m.pieceStillAfter({ holds: null }, { play: "once", length: 3 }), 3);
});

test("the isolated frame loads the vendored kit and its stage styles", () => {
	const m = load();
	const srcdoc = m.rovoStageKitSrcdoc();
	assert.ok(srcdoc.toLowerCase().startsWith("<!doctype html>"));
	const urls = [...srcdoc.matchAll(/"(\/1p\/rovo-stage-kit\/[^"]+)"/gu)].map((match) => match[1]);
	assert.deepEqual(urls.sort(), [`${m.ROVO_STAGE_KIT_ROOT}/dist/rovo-stage.js`, `${m.ROVO_STAGE_KIT_ROOT}/rovo-stage.json`]);
	for (const url of urls) assert.ok(existsSync(path.join(PUBLIC, url)));
});

/** Release order of two `x.y.z` kit versions: negative when `a` is older. */
function releaseOrder(a, b) {
	const [x, y] = [a, b].map((version) => version.split(".").map(Number));
	for (let index = 0; index < 3; index += 1) if (x[index] !== y[index]) return x[index] - y[index];
	return 0;
}

test("the vendored kit is whole and one release: every file its package names is here, and no newer kit wrote its stage", () => {
	const kit = path.join(PUBLIC, "1p/rovo-stage-kit");
	const pkg = JSON.parse(readFileSync(path.join(kit, "package.json"), "utf8"));
	// What the kit's own package says it ships: a folder half-copied, or a dist/ an ignore rule kept out of git, fails here.
	const exported = Object.values(pkg.exports).flatMap((entry) => (typeof entry === "string" ? [entry] : Object.values(entry)));
	for (const file of new Set([pkg.main, pkg.module, pkg.types, ...pkg.sideEffects, ...exported])) {
		assert.ok(existsSync(path.join(kit, file)), `${file} is in the vendored kit`);
	}
	assert.ok(readFileSync(path.join(kit, "README.md"), "utf8").startsWith(`# Rovo Stage Kit ${pkg.version}\n`), "its README is the same release");
	// A stage exported by a newer lab may name pieces this kit drops: update the whole folder, not the stage file alone.
	const stage = JSON.parse(readFileSync(path.join(kit, "rovo-stage.json"), "utf8"));
	assert.ok(releaseOrder(stage.kit, pkg.version) <= 0, `rovo-stage.json was written by kit ${stage.kit}, newer than the vendored ${pkg.version}`);
});

test("the vendored kit is byte for byte the build VENDOR.md fingerprints", () => {
	const kit = path.join(PUBLIC, "1p/rovo-stage-kit");
	// The integration notes' fingerprint table is the record: an edited, re-minified or swapped build fails here.
	const notes = readFileSync(path.join(__dirname, "../VENDOR.md"), "utf8");
	const fingerprints = [...notes.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/gmu)].map(([, file, sha256]) => ({ file, sha256 }));
	assert.deepEqual(fingerprints.map(({ file }) => file).sort(), ["dist/react/index.js", "dist/rovo-stage.js", "rovo-stage.json"], "VENDOR.md fingerprints the kit's builds and its stage file");
	for (const { file, sha256 } of fingerprints) {
		const actual = createHash("sha256").update(readFileSync(path.join(kit, file))).digest("hex");
		assert.equal(actual, sha256, `${file} is not the build VENDOR.md records; after a deliberate update, record its new SHA-256 there`);
	}
});
