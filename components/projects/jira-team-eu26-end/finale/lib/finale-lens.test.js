const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

/*
 * The mega bento's lens films each card in the air through its own share of
 * the smear. Its field is the strongest share of the smeared sheets near a
 * pixel, so it used to smear whatever lay in that reach, landed cards too: a
 * card that had come down beside one still waiting kept a long spectral drag
 * on its GL sheet until it handed over to its crisp DOM card, and the drag
 * vanished in one frame. Now every tap is weighed by the paper it lands on
 * (LENS_SHARE_GLSL, run here as it is), so a sheet's smear never outlasts its
 * own chroma, which reaches 0 well before its sheet goes.
 */

const ENTRY = `
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export { cameraDistance, lensFade } from "./finale-card-motion";
export { LENS_SHARE_GLSL, LENS_TAPS, lensShare } from "./finale-sheet-gl";
export { CUE, WALL_CUE } from "../data/finale-cues";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
`;

let lensModule;
function load() {
	lensModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		logLevel: "silent",
	}).outputFiles[0].text, "finale-lens-harness.cjs");
	return lensModule;
}

/** The lens's scalar GLSL helpers as functions: GLSL's float maths is JavaScript's. */
function lensShader() {
	const m = load();
	const script = m.LENS_SHARE_GLSL
		.replace(/float\(TAPS\)/g, "TAPS")
		.replace(/\bfloat\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => `function ${name}(${params.replace(/\bfloat\s+/g, "")}) {`);
	// Only scalar maths may be left, or this would not be the shader's own arithmetic.
	assert.equal(/\b(float|int|vec[234]|mat[234])\b/.test(script), false, "LENS_SHARE_GLSL stays scalar");
	const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
	return new Function("clamp", "min", "max", "TAPS", `${script}\nreturn { ownShare, bareShare, within, standIn };`)(clamp, Math.min, Math.max, m.LENS_TAPS);
}

/** Each tap's place along its ray, as the lens's loop takes it (t − 0.2). */
function alongs() {
	const { LENS_TAPS } = load();
	return Array.from({ length: LENS_TAPS }, (_, index) => (index + 0.5) / LENS_TAPS - 0.2);
}

/** What an 8-bit mask keeps of a value. */
const byte = (value) => Math.round(value * 255) / 255;

test("at a full share every tap counts as it is, so a card in the air looks as it did", () => {
	const { within, standIn } = lensShader();
	for (const along of alongs()) assert.equal(within(1, along), 1, `tap at ${along}`);
	for (const cover of [0, 0.25, 0.5, 1]) assert.equal(standIn(1, 1, cover), 0);
});

test("a sheet's own field never shortens its own smear, through an 8-bit mask", () => {
	const { ownShare } = lensShader();
	for (let chroma = 0.1; chroma <= 1; chroma += 0.01) {
		// Inside its rect the field is its own share; past it, less.
		assert.equal(ownShare(byte(chroma), 1, chroma), 1, `chroma ${chroma.toFixed(2)}`);
		assert.equal(ownShare(byte(chroma), 1, chroma * 0.5), 1);
	}
});

test("a landed sheet beside a card still in the air takes none of its smear", () => {
	const { ownShare, bareShare, within, standIn } = lensShader();
	for (const field of [0.05, 0.4, 1]) {
		for (const cover of [1 / 255, 0.3, 1]) {
			// Its paper, wherever a tap finds it, and the slide round it at a pixel on it.
			const paper = ownShare(0, cover, field);
			const bare = bareShare(0, cover, field);
			assert.equal(paper, 0);
			assert.equal(bare, 0);
			for (const along of alongs()) {
				assert.equal(within(paper, along), 0);
				// So every tap gives back the pixel as drawn: no trail, nothing to drop at its hand-over.
				assert.equal(standIn(within(paper, along), within(bare, along), cover), 1);
			}
		}
	}
	// Fading out over bare slide (as its DOM card takes over), it leaves no trail beside it either.
	for (const cover of [0.2, 0.6, 1]) assert.equal(within(ownShare(0, cover, 0.8), 0.3) * cover, 0);
});

test("a sheet's smear shortens and fades continuously with its own chroma, to nothing", () => {
	const { ownShare, within } = lensShader();
	const field = 0.8;
	const counted = (chroma) => alongs().reduce((sum, along) => sum + within(ownShare(chroma, 1, field), along), 0);
	const reach = (chroma) => Math.max(0, ...alongs().filter((along) => within(ownShare(chroma, 1, field), along) > 0));
	let before = counted(field);
	assert.equal(before, alongs().length);
	for (let chroma = field; chroma >= -1e-9; chroma -= 0.001) {
		const now = counted(Math.max(chroma, 0));
		assert.ok(now <= before + 1e-9, "never grows as its chroma falls");
		assert.ok(before - now < 0.1, `no step at chroma ${chroma.toFixed(3)}: ${before} → ${now}`);
		// Its trail reaches only its own chroma's share of the field's reach (within a tap).
		assert.ok(reach(Math.max(chroma, 0)) <= (0.8 * Math.max(chroma, 0) * 1.02) / field + 1 / alongs().length + 1e-9);
		before = now;
	}
	assert.equal(counted(0), 0);
});

test("a sheet's share of the lens comes up with it as the wall reveals it", () => {
	const { lensShare } = load();
	assert.equal(lensShare(0.7, 1), 0.7);
	assert.equal(lensShare(0.7, 0), 0);
	assert.equal(lensShare(1, 0.25), 0.25);
	assert.equal(lensShare(1, 1.4), 1);
});

const VIEWPORTS = [
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
	{ width: 1024, height: 768 },
];
const FRAME = 1 / 60;

function wallFor(viewport) {
	const m = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = m.finaleBentoLayout(viewport, scale);
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, m.FINALE_FEATURES, []);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	return { wall, drops };
}

test("every sheet's share of the lens is spent, and stays spent, before its sheet goes", () => {
	const m = load();
	for (const viewport of VIEWPORTS) {
		const { wall, drops } = wallFor(viewport);
		const distance = m.cameraDistance(viewport);
		const share = (sheet) => m.lensShare(sheet.chroma, sheet.pose.opacity * m.lensFade(distance - sheet.pose.z, viewport));
		/** When each sheet in the list last had any share of the lens. */
		const lastSmeared = new Map();
		let gone = 0;
		let previous = new Map();
		for (let time = m.WALL_CUE.start; time < m.WALL_CUE.start + 32; time += FRAME) {
			const sheets = new Map(m.wallSheetsAt(time, wall, drops, viewport).map((sheet) => [sheet.key, sheet]));
			for (const [key, sheet] of sheets) {
				if (share(sheet) > 0.001) lastSmeared.set(key, time);
				// Its smear comes and goes over frames (the steepest: a bento card's swell as it leaves the hand).
				const before = previous.get(key);
				if (before && before.chroma > 0) assert.ok(Math.abs(sheet.chroma - before.chroma) < 0.08, `${viewport.width}: ${key} at ${time.toFixed(3)}`);
			}
			for (const key of previous.keys()) {
				if (sheets.has(key) || !lastSmeared.has(key)) continue;
				const spent = time - lastSmeared.get(key);
				assert.ok(spent >= m.CUE.handoff * 0.5, `${viewport.width}: ${key} goes ${spent.toFixed(3)} s after its last smear`);
				lastSmeared.delete(key);
				gone += 1;
			}
			previous = sheets;
		}
		// The bento's cards and many arrivals came down and handed over.
		assert.ok(gone > 30, `${viewport.width}: ${gone} smeared sheets went`);
	}
});
