const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-board-exit";
export { flashWindow } from "./finale-column-flash";
export { CUE, FINALE_REST_TIME } from "../data/finale-cues";
`;

let exit;
function load() {
	exit ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-board-exit-harness.cjs");
	return exit;
}

const FRAME = 1 / 120;

test("the exit starts with the toss, after the flash is spent, and is a full-screen-sized fade", () => {
	const { BOARD_EXIT, CUE, boardExitEnd, flashWindow } = load();
	assert.equal(BOARD_EXIT.start, CUE.burst);
	assert.ok(flashWindow().end <= BOARD_EXIT.start, "the flash is spent before the board starts to leave");
	assert.ok(BOARD_EXIT.duration >= 0.4 && BOARD_EXIT.duration <= 0.6, "duration-slower..duration-slowest");
	assert.ok(BOARD_EXIT.blur >= 12 && BOARD_EXIT.blur <= 20);
	assert.ok(boardExitEnd() < CUE.recoil, "the board has gone before the camera recoils");
});

test("the board is untouched through the flash: no slide, no blur, cards in place", () => {
	const { CUE, boardDoneCardsHidden, boardExitBlur, boardExitSlideOpacity, boardExitStyle } = load();
	for (let time = 0; time <= CUE.burst; time += FRAME) {
		const at = `${time.toFixed(3)}s`;
		assert.equal(boardExitSlideOpacity(time), 0, `slide clear at ${at}`);
		assert.equal(boardExitBlur(time), 0, `no blur at ${at}`);
		assert.deepEqual(boardExitStyle(time), { visibility: "hidden", opacity: 0, backdropFilter: "none" }, `layer hidden at ${at}`);
		if (time < CUE.burst) assert.equal(boardDoneCardsHidden(time), false, `Done cards shown at ${at}`);
	}
	assert.deepEqual(boardExitStyle(CUE.burst), { visibility: "hidden", opacity: 0, backdropFilter: "none" });
});

test("blur and fade ramp together, monotonically, without a snap", () => {
	const { BOARD_EXIT, boardExitBlur, boardExitSlideOpacity } = load();
	let lastOpacity = 0;
	let lastBlur = 0;
	let maxStep = 0;
	// Integer frames: accumulated float steps would land on the end frame itself.
	const frames = Math.round(BOARD_EXIT.duration / FRAME);
	for (let frame = 0; frame < frames; frame += 1) {
		const time = BOARD_EXIT.start + frame * FRAME;
		const opacity = boardExitSlideOpacity(time);
		const blur = boardExitBlur(time);
		assert.ok(opacity >= lastOpacity, `opacity never drops (${time.toFixed(3)}s)`);
		assert.ok(blur >= lastBlur, `blur never drops mid-ramp (${time.toFixed(3)}s)`);
		assert.ok(Math.abs(blur - BOARD_EXIT.blur * opacity) < 1e-9, "blur tracks the fade");
		maxStep = Math.max(maxStep, opacity - lastOpacity);
		lastOpacity = opacity;
		lastBlur = blur;
	}
	assert.ok(maxStep < 0.08, `no frame jumps more than 8% of the fade (max ${maxStep.toFixed(3)})`);
	const at = (share) => BOARD_EXIT.start + BOARD_EXIT.duration * share;
	assert.ok(boardExitSlideOpacity(at(0.1)) > 0 && boardExitSlideOpacity(at(0.1)) < 0.1, "it eases off the board rather than cutting");
	assert.ok(boardExitSlideOpacity(at(0.25)) > 0.2 && boardExitSlideOpacity(at(0.25)) < 0.8, "a quarter in, the board is mid-fade");
	assert.ok(boardExitBlur(at(0.25)) > 4, "and visibly blurred");
	assert.ok(boardExitSlideOpacity(at(0.75)) < 1, "and it lands gently, not on a cut");
	assert.ok(lastBlur > BOARD_EXIT.blur * 0.95, "blur nears its peak as the slide covers the board");
});

test("once it has landed the slide is opaque and the blur is gone", () => {
	const { CUE, FINALE_REST_TIME, boardDoneCardsHidden, boardExitEnd, boardExitStyle } = load();
	for (const time of [boardExitEnd(), boardExitEnd() + FRAME, CUE.recoil, CUE.heroLand, CUE.end]) {
		assert.deepEqual(boardExitStyle(time), { visibility: "visible", opacity: 1, backdropFilter: "none" }, `plain slide at ${time}s`);
		assert.equal(boardDoneCardsHidden(time), true);
	}
	// Reduced motion renders only the rest frame: the exit is fully resolved there.
	assert.deepEqual(boardExitStyle(FINALE_REST_TIME), { visibility: "visible", opacity: 1, backdropFilter: "none" });
});

test("the Done column's DOM originals leave with their sheets on the toss", () => {
	const { CUE, boardDoneCardsHidden } = load();
	assert.equal(boardDoneCardsHidden(CUE.burst - FRAME), false);
	assert.equal(boardDoneCardsHidden(CUE.burst), true);
});
