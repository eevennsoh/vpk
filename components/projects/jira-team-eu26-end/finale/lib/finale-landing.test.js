const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

/*
 * How a card lands on the page, shared by the bento's tiles on the slide and
 * the mega bento's thrown cards and arrivals: one soft settle, no jolt. The
 * finale used to add an in-plane recoil at touchdown (0 → 61°/s in one frame,
 * then +2.4° / −0.8° / +0.3° of wobble) and fire Peel's wave at full height on
 * the touchdown frame, after the card had already come to rest.
 */

const ENTRY = `
export * from "./finale-card-motion";
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export { landingWaveEnergy } from "./finale-sheet-gl";
export { CUE } from "../data/finale-cues";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
`;

let landingModule;
function load() {
	landingModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		logLevel: "silent",
	}).outputFiles[0].text, "finale-landing-harness.cjs");
	return landingModule;
}

const VIEWPORT = { width: 1728, height: 1117 };
const FRAME = 1 / 60;
const STEP = 1 / 240;

/** Every way a card lands on the page: bento tiles on the slide, thrown cards in their gaps, the title set down by MCB, arrivals at the leading edge. */
function landings() {
	const m = load();
	const scale = Math.min(VIEWPORT.width / 1920, VIEWPORT.height / 1080);
	const bento = m.finaleBentoLayout(VIEWPORT, scale);
	const slots = bento.slots.map((slot) => slot.rect);
	const geometry = m.wallGeometry(bento, scale, VIEWPORT);
	const wall = m.buildFinaleWall(geometry, bento, m.FINALE_FEATURES, []);
	const drops = m.bentoDrops(wall, slots, bento.title);
	const card = { x: 708, y: 160, width: 224, height: 150 };
	const tiles = [1, 3, 5].map((order) => ({
		label: `bento tile ${order}`,
		touchdown: m.touchdownTime(order),
		pose: (time) => m.cardPose(time, { rect: card, fieldIndex: order, fieldCount: 13, burstIndex: order, role: { kind: "tile", order, slot: slots[order] } }, VIEWPORT),
	}));
	const thrown = drops.map((drop) => ({
		label: drop.kind === "title" ? "the title, set down by MCB" : `thrown card ${drop.order}`,
		touchdown: m.bentoTouchdown(drop, drops),
		pose: (time) => m.bentoSheetPose(drop, drops, time, geometry, VIEWPORT),
		slot: drop.slot,
	}));
	assert.equal(thrown.length, 7, "six tiles and the title");
	const arrivals = [];
	for (let column = 0; column < 40 && arrivals.length < 4; column += 1) {
		for (const slot of wall.column(column)) {
			const descent = slot.reserved === undefined && slot.content.kind !== "print" ? m.slotDescent(slot, wall) : null;
			if (!descent || arrivals.length >= 4) continue;
			arrivals.push({
				label: `arrival ${slot.key}`,
				touchdown: descent.touchdown,
				pose: (time) => m.wallSheetsAt(time, wall, drops, VIEWPORT).find((sheet) => sheet.key === `card-${slot.key}`)?.pose ?? null,
				slot,
			});
		}
	}
	assert.equal(arrivals.length, 4, "the wall has arrivals to land");
	return { m, wall, drops, all: [...tiles, ...thrown, ...arrivals], wallCards: [...thrown, ...arrivals] };
}

test("a card comes to rest in its slot without an in-plane kick: its turn eases out through touchdown and stays square", () => {
	const { m, all } = landings();
	for (const landing of all) {
		const turnRate = (time) => (landing.pose(time + STEP / 2).rotateZ - landing.pose(time - STEP / 2).rotateZ) / STEP;
		const degrees = (radians) => (radians * 180) / Math.PI;
		assert.ok(Math.abs(degrees(turnRate(landing.touchdown - FRAME))) < 1, `${landing.label} has all but stopped turning as it touches down`);
		for (let time = landing.touchdown; time < landing.touchdown + m.CUE.handoff; time += STEP) {
			const pose = landing.pose(time);
			assert.ok(pose && Math.abs(pose.rotateX) + Math.abs(pose.rotateY) + Math.abs(pose.rotateZ) < 1e-9, `${landing.label} lies square once down (${((time - landing.touchdown) * 1000).toFixed(0)}ms)`);
		}
	}
});

test("the landing wave gathers before touchdown, swells once and relaxes, never bending the sheet in a single frame", () => {
	const { m, all } = landings();
	for (const landing of all) {
		const energy = (time) => {
			const pose = landing.pose(time);
			return pose ? m.landingWaveEnergy(pose.waveAge) : 0;
		};
		const { touchdown } = landing;
		assert.equal(energy(touchdown - m.LANDING.lead - FRAME), 0, `${landing.label}: flat until the last moments of the fall`);
		assert.ok(energy(touchdown - FRAME) > 0.5, `${landing.label}: the wave is already swelling as the card arrives`);
		assert.ok(energy(touchdown + m.CUE.handoff) < 1e-12, `${landing.label}: spent before the hand-over`);
		let turns = 0;
		let rising = true;
		let previous = energy(touchdown - 0.3);
		for (let time = touchdown - 0.3 + FRAME; time <= touchdown + m.CUE.handoff; time += FRAME) {
			const now = energy(time);
			assert.ok(Math.abs(now - previous) < 0.25, `${landing.label}: no frame bends it abruptly (${((time - touchdown) * 1000).toFixed(0)}ms: ${previous.toFixed(2)} → ${now.toFixed(2)})`);
			if (rising && now < previous - 1e-9) {
				rising = false;
				turns += 1;
			} else if (!rising && now > previous + 1e-9) turns += 1;
			previous = now;
		}
		assert.equal(turns, 1, `${landing.label}: one swell, then one relaxing`);
		// The bend never changes speed abruptly either (bounded second difference).
		for (let time = touchdown - 0.2; time <= touchdown + m.CUE.handoff + 0.05; time += STEP) {
			const curvature = (energy(time + STEP) - 2 * energy(time) + energy(time - STEP)) / (STEP * STEP);
			assert.ok(Math.abs(curvature) < 1200, `${landing.label}: the wave's growth stays smooth (${((time - touchdown) * 1000).toFixed(1)}ms: ${curvature.toFixed(0)}/s²)`);
		}
	}
});

test("a wall card's sheet dissolves off its DOM card rather than vanishing, and the swap never shows the page through", () => {
	const { m, wall, drops, wallCards } = landings();
	for (const landing of wallCards) {
		const at = landing.touchdown + m.CUE.handoff;
		let lastDrawn = null;
		for (let time = at - 0.05; time <= at + 0.2; time += STEP) {
			const pose = landing.pose(time);
			const sheet = pose ? pose.opacity : 0;
			const face = m.wallSlotPresence(landing.slot, wall, drops, time).opacity;
			assert.ok(sheet + face * (1 - sheet) > 0.98, `${landing.label} stays covered through its hand-over (${((time - at) * 1000).toFixed(1)}ms)`);
			if (pose) lastDrawn = sheet;
		}
		assert.ok(lastDrawn !== null && lastDrawn < 0.05, `${landing.label}'s sheet has all but dissolved by the last frame it is drawn (${lastDrawn})`);
		for (let time = at; time <= at + 0.12; time += FRAME) {
			const step = m.landingSheetShown(time, landing.touchdown) - m.landingSheetShown(time + FRAME, landing.touchdown);
			assert.ok(step < 0.5, `${landing.label}'s sheet fades over several frames`);
		}
	}
});
