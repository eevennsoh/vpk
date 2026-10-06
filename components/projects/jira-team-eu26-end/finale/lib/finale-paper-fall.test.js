const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

/*
 * How the mega bento's cards fall as paper: about an axis in their own plane
 * only (they were once spun flat, whole turns about the lens's axis, like a
 * dial), going over once, quickly past their blank backs, then rocking flat.
 */

const ENTRY = `
export * from "./finale-paper-fall";
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
`;

let paperModule;
function load() {
	paperModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		logLevel: "silent",
	}).outputFiles[0].text, "finale-paper-fall-harness.cjs");
	return paperModule;
}

const TAU = Math.PI * 2;
const STEPS = 2000;

const FALLS = {
	thrown: { axis: "y", turns: -1, over: [0.2, 0.48], lean: 0.32, rock: 0.42, swings: 2.3, wobble: 0.15, phase: 1.1 },
	twice: { axis: "x", turns: 2, over: [0.06, 0.45], lean: 0.3, rock: 0.38, swings: 2.1, wobble: 0.12, phase: 4 },
	letGo: { axis: "x", turns: -1, over: [0, 0.54], lean: 0, rock: 0.36, swings: 1.9, wobble: 0.1, phase: 2.5 },
};

/** The turn about its own axis through the fall, unwrapped from the (−π, π] it is shown in. */
function mainTurns(m, fall) {
	const key = fall.axis === "x" ? "rotateX" : "rotateY";
	const turns = [];
	let previous = 0;
	let unwrapped = 0;
	for (let step = 0; step <= STEPS; step += 1) {
		const shown = m.paperAttitude(fall, step / STEPS)[key];
		let delta = shown - previous;
		delta -= TAU * Math.round(delta / TAU);
		unwrapped += delta;
		previous = shown;
		turns.push(unwrapped);
	}
	return turns;
}

test("a falling sheet leaves and lands exactly flat, at rest, never turned flat like a dial", () => {
	const m = load();
	for (const [name, fall] of Object.entries(FALLS)) {
		const start = m.paperAttitude(fall, 0);
		const end = m.paperAttitude(fall, 1);
		assert.ok(Math.abs(start.rotateX) + Math.abs(start.rotateY) === 0, `${name} leaves flat`);
		assert.ok(Math.abs(end.rotateX) + Math.abs(end.rotateY) < 1e-9 && end.glideX === 0 && end.glideY === 0, `${name} lands flat, over its slot`);
		assert.equal("rotateZ" in end, false, `${name} has no in-plane turn to give`);
		const turns = mainTurns(m, fall);
		const rate = (index) => (turns[index] - turns[index - 1]) * STEPS;
		assert.ok(Math.abs(rate(STEPS)) < 0.05, `${name} has stopped turning as it lands (${rate(STEPS).toFixed(3)})`);
		if (fall.lean > 0) assert.ok(Math.abs(rate(1)) < 0.05, `${name} sets off from rest`);
	}
});

test("it goes over through its whole turns, the way it turns, and is caught face up", () => {
	const m = load();
	for (const [name, fall] of Object.entries(FALLS)) {
		const turns = mainTurns(m, fall);
		assert.ok(Math.abs(turns[STEPS] - TAU * fall.turns) < 1e-6, `${name} turns ${fall.turns} whole turns`);
		const caught = Math.round(fall.over[1] * STEPS);
		assert.ok(Math.abs(turns[caught] - TAU * fall.turns) < 1e-6, `${name} is face up again as the air catches it`);
		// Going over, it only ever turns one way.
		for (let step = 1; step <= caught; step += 1) assert.ok(Math.sign(turns[step] - turns[step - 1]) !== -Math.sign(fall.turns), `${name} never turns back while going over`);
	}
});

test("its blank back only flashes by: it is quickest going over, and never jerks between sailing, going over and rocking", () => {
	const m = load();
	for (const [name, fall] of Object.entries(FALLS)) {
		const turns = mainTurns(m, fall);
		const back = turns.filter((turn) => Math.cos(turn) < 0).length / STEPS;
		assert.ok(back <= 0.2 * Math.abs(fall.turns), `${name} shows its back for ${(back * 100).toFixed(0)}% of its fall`);
		const rates = turns.slice(1).map((turn, index) => (turn - turns[index]) * STEPS);
		for (let step = 1; step < rates.length; step += 1) {
			assert.ok(Math.abs(rates[step] - rates[step - 1]) < 1.5, `${name}'s turn changes pace smoothly (${(step / STEPS).toFixed(3)})`);
		}
	}
});

test("it rocks after going over, each swing smaller, gliding toward its low edge only as it rocks", () => {
	const m = load();
	const fall = FALLS.thrown;
	const glides = [];
	for (let step = 0; step <= STEPS; step += 1) {
		const u = step / STEPS;
		const at = m.paperAttitude(fall, u);
		assert.equal(at.glideY, 0, "a side-over-side turn glides only across");
		if (u <= fall.over[1]) assert.equal(at.glideX, 0, "no glide before it rocks");
		glides.push(at);
	}
	const peaks = [];
	for (let step = Math.round(fall.over[1] * STEPS) + 1; step < STEPS; step += 1) {
		const [before, now, after] = [glides[step - 1].rotateY, glides[step].rotateY, glides[step + 1].rotateY];
		if (Math.abs(now) > Math.abs(before) && Math.abs(now) >= Math.abs(after) && Math.abs(now) > 1e-3) peaks.push(Math.abs(now));
		// At each swing's end its leading edge is up: it has glided away from the side its tilt lowers.
		if (Math.abs(now) > 0.05 && glides[step].glideX !== 0) assert.equal(Math.sign(glides[step].glideX), -Math.sign(now), "a y turn lowering its right edge has glided left");
	}
	assert.ok(peaks.length >= 2, "it swings at least each way");
	peaks.forEach((peak, index) => {
		if (index > 0) assert.ok(peak < peaks[index - 1], "each swing smaller than the last");
	});
	assert.ok(peaks[0] <= fall.rock, "its first swing no farther than its rock");
});

const VIEWPORTS = [
	{ width: 1920, height: 1080 },
	{ width: 1728, height: 1117 },
	{ width: 1024, height: 768 },
];

/** The mega bento on `viewport`, as the finale builds it. */
function wallScene(m, viewport = VIEWPORTS[0]) {
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = m.finaleBentoLayout(viewport, scale);
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, m.FINALE_FEATURES, []);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	return { viewport, geometry, wall, drops };
}

test("the bento's thrown tiles go over as paper, never spun flat, and never all show their backs at once", () => {
	const m = load();
	for (const viewport of VIEWPORTS) {
	const { geometry, drops } = wallScene(m, viewport);
	const tiles = drops.filter((drop) => drop.kind === "tile");
	const toss = m.bentoTossTime();
	const end = Math.max(...tiles.map((drop) => m.bentoTouchdown(drop, drops)));
	let mostBacks = 0;
	for (let time = toss; time <= end; time += 1 / 240) {
		let backs = 0;
		for (const drop of tiles) {
			const pose = m.bentoSheetPose(drop, drops, time, geometry, viewport);
			assert.equal(pose.rotateZ, 0, `tile ${drop.order} is never turned in the wall's plane`);
			// Its back faces the lens while its normal points away: cos of its tilt about each axis multiplied.
			if (Math.cos(pose.rotateX) * Math.cos(pose.rotateY) < 0) backs += 1;
		}
		mostBacks = Math.max(mostBacks, backs);
	}
	assert.ok(mostBacks >= 1 && mostBacks <= 2, `they go over one by one, at most two backs at once (${mostBacks})`);
	for (const drop of tiles) {
		let back = false;
		for (let time = toss; time <= m.bentoTouchdown(drop, drops); time += 1 / 240) {
			const pose = m.bentoSheetPose(drop, drops, time, geometry, viewport);
			if (Math.cos(pose.rotateX) * Math.cos(pose.rotateY) < 0) back = true;
		}
		assert.ok(back, `tile ${drop.order} goes over on its way down`);
	}
	}
});

test("leading-edge arrivals settle face up without a full turn while their chromatic trail clears", () => {
	const m = load();
	for (const viewport of VIEWPORTS) {
		const { geometry, wall, drops } = wallScene(m, viewport);
		const slots = wall.items.filter((slot) => slot.reserved === undefined && m.slotDescent(slot, wall)?.start > 20);
		assert.ok(slots.length >= 8, "sample arrivals across the wall");
		for (const slot of slots) {
			for (const card of m.slotArrivals(slot, wall)) {
				let previousTilt = Infinity;
				for (let frame = 0; frame <= 60; frame += 1) {
					const time = card.descent.start + (card.descent.touchdown - card.descent.start) * frame / 60;
					const rect = m.slotOnScreen(slot, m.wallOffset(time, geometry), geometry);
					const pose = m.arrivalCardPose(slot, card, rect, time, viewport, { breathing: false });
					assert.ok(Math.cos(pose.rotateX) * Math.cos(pose.rotateY) > 0, `${slot.key}: the printed face stays toward the viewer`);
					const tilt = Math.hypot(pose.rotateX, pose.rotateY, pose.rotateZ);
					assert.ok(tilt <= previousTilt + 1e-9, `${slot.key}: settles without another swing`);
					previousTilt = tilt;
				}
				assert.ok(previousTilt < 1e-9, "lands flat");
			}
			const descent = m.slotDescent(slot, wall);
			const sheetAt = (time) => m.wallSheetsAt(time, wall, drops, viewport).find((sheet) => sheet.key === `card-${slot.key}`);
			const waiting = sheetAt(descent.start - 0.05);
			assert.ok(waiting && waiting.pose.opacity > 0.99 && waiting.chroma === 1, "full chromatic distortion before descent");
			const midway = sheetAt((descent.start + descent.touchdown) / 2);
			assert.ok(midway && midway.chroma > 0.45 && midway.chroma < 0.55, "distortion fades through the descent");
			assert.equal(sheetAt(descent.touchdown).chroma, 0, "crisp at touchdown");
		}
	}
});
