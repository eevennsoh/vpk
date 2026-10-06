const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-lanyard";
export { buildFinaleWall, wallGeometry } from "./finale-wall-layout";
export { slotDescent, slotOnScreen, wallOffset, wallSlotPresence, wallSlotRevealTime } from "./finale-wall-motion";
export { finaleStageFit } from "./finale-stage-fit";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
export { WALL_CUE } from "../data/finale-cues";
export { LANYARD_3D_AGENTS, LANYARD_3D_PROFILES } from "@/components/blocks/3d-lanyard/data";
export { duration as LANYARD_DURATION } from "@/components/blocks/3d-lanyard/renderer/constants";
`;

let lanyardModule;
function load() {
	lanyardModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-lanyard-harness.cjs");
	return lanyardModule;
}

const VIEWPORT = { width: 1920, height: 1080 };

/** A frame as expected, its times to within float error. */
function assertFrame(actual, expected, message) {
	assert.ok(actual, message);
	assert.equal(actual.drop, expected.drop, message);
	assert.ok(Math.abs(actual.time - expected.time) < 1e-9, `${message ?? "time"}: ${actual.time} ≠ ${expected.time}`);
	assert.ok(Math.abs(actual.lift - expected.lift) < 1e-9, `${message ?? "lift"}: ${actual.lift} ≠ ${expected.lift}`);
}

function sceneFor(viewport = VIEWPORT) {
	const m = load();
	const { scale } = m.finaleStageFit(viewport.width, viewport.height);
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, m.finaleBentoLayout(viewport, scale), m.FINALE_FEATURES, []);
	return { m, geometry, wall };
}

test("a lanyard drops on the renderer's own clock, holds still, reels up and leaves the tile empty before the next", () => {
	const m = load();
	const duration = m.LANYARD_DURATION;
	const first = 40;
	const { holdS, liftS, restS } = m.WALL_LANYARD;
	const cycle = m.wallLanyardCycle(duration);
	assert.equal(cycle, duration + holdS + liftS + restS);
	assert.equal(m.wallLanyardFrame(first - 0.01, first, duration), null, "nothing hangs before its first drop");
	assertFrame(m.wallLanyardFrame(first, first, duration), { drop: 0, time: 0, lift: 0 });
	assertFrame(m.wallLanyardFrame(first + 3, first, duration), { drop: 0, time: 3, lift: 0 });
	// Held on the still end pose until it is reeled up, which eases in (an exit).
	assertFrame(m.wallLanyardFrame(first + duration + holdS * 0.5, first, duration), { drop: 0, time: duration, lift: 0 });
	const reeling = m.wallLanyardFrame(first + duration + holdS + liftS * 0.5, first, duration);
	assert.equal(reeling.time, duration);
	assert.ok(reeling.lift > 0 && reeling.lift < 0.5, `reel-up starts slowly (${reeling.lift})`);
	assert.equal(m.wallLanyardFrame(first + duration + holdS + liftS + restS * 0.5, first, duration), null, "the tile rests empty");
	assertFrame(m.wallLanyardFrame(first + cycle, first, duration), { drop: 1, time: 0, lift: 0 });
	assertFrame(m.wallLanyardFrame(first + cycle * 5 + 2, first, duration), { drop: 5, time: 2, lift: 0 }, "a scrubbed clock lands on the same drop");
});

test("every drop is dealt afresh: no presenter, agent or swing twice in a row, and every copy of a tile differs", () => {
	const m = load();
	const people = m.LANYARD_3D_PROFILES.length;
	const agents = m.LANYARD_3D_AGENTS.length;
	assert.equal(people, 4);
	assert.equal(agents, 5);
	const sequences = [];
	const reveals = [];
	for (const seed of [729, 1802, 2838, 3911]) {
		for (const bucket of [6, 51, 96]) {
			const casts = Array.from({ length: 12 }, (_, drop) => m.wallLanyardDrop({ seed, bucket }, drop, people, agents));
			for (let drop = 1; drop < casts.length; drop += 1) {
				assert.notEqual(casts[drop].person, casts[drop - 1].person, `seed ${seed} copy ${bucket} drop ${drop}`);
				assert.notEqual(casts[drop].agent, casts[drop - 1].agent, `seed ${seed} copy ${bucket} drop ${drop}`);
				assert.notEqual(casts[drop].swing, casts[drop - 1].swing, `seed ${seed} copy ${bucket} drop ${drop}`);
			}
			for (const cast of casts) {
				assert.ok(m.WALL_LANYARD.swings.includes(cast.swing), "only swings whose physics is primed");
				assert.ok(cast.revealAngle >= m.WALL_LANYARD.reveal[0] && cast.revealAngle <= m.WALL_LANYARD.reveal[1], `reveal ${cast.revealAngle}`);
			}
			assert.equal(new Set(casts.slice(0, 3).map((cast) => cast.swing)).size, 3, "all three swings within any three drops");
			// Each presenter wears it within any four drops, and each agent within any five.
			assert.equal(new Set(casts.slice(0, people).map((cast) => cast.person)).size, people);
			assert.equal(new Set(casts.slice(0, agents).map((cast) => cast.agent)).size, agents);
			assert.deepEqual(m.wallLanyardDrop({ seed, bucket }, 7, people, agents), casts[7], "the same drop is always dealt the same");
			sequences.push(casts.map((cast) => `${cast.person}${cast.agent}${cast.swing}`).join(","));
			reveals.push(...casts.map((cast) => cast.revealAngle));
		}
	}
	assert.ok(new Set(sequences).size > sequences.length * 0.75, "tiles and their copies deal differently");
	// The reveal is spread across its range, not bunched at one end.
	const [low, high] = m.WALL_LANYARD.reveal;
	const middle = (low + high) / 2;
	assert.ok(reveals.some((angle) => angle < middle - 3) && reveals.some((angle) => angle > middle + 3), "reveals vary across the range");
	assert.equal(m.WALL_LANYARD_FRAMING_SWING, Math.max(...m.WALL_LANYARD.swings), "framed for the liveliest swing");
});

test("a lanyard tile never flies in: it glides in hanging from the top, and drops its first once most of it is in frame", () => {
	for (const viewport of [VIEWPORT, { width: 1024, height: 768 }, { width: 2560, height: 1440 }]) {
		const { m, geometry, wall } = sceneFor(viewport);
		const lanyards = Array.from({ length: wall.periodBuckets * 2 }, (_, index) => wall.bucket(index)).flat().filter((slot) => slot.content.kind === "lanyard");
		assert.equal(lanyards.length, 8, "four a period");
		const settled = m.WALL_CUE.start + m.WALL_CUE.carryDownAt + m.WALL_LANYARD.afterCarryS;
		const [least, most] = m.WALL_LANYARD.enterShown;
		for (const slot of lanyards) {
			assert.equal(m.slotDescent(slot, wall), null, `${slot.key} never waits in the air, which would show its cut strap`);
			assert.equal(m.wallSlotPresence(slot, wall, [], m.WALL_CUE.start + 30).revealStart, null, `${slot.key} never builds`);
			const first = m.wallLanyardFirstDrop(slot, geometry);
			assert.ok(first >= settled, `${slot.key} drops after the title is set down`);
			const rect = m.slotOnScreen(slot, m.wallOffset(first, geometry), geometry);
			const inFrame = (viewport.width - rect.x) / rect.width;
			assert.ok(inFrame >= least - 1e-3 && inFrame <= most + 1e-3, `${viewport.width}: ${slot.key} drops with ${inFrame.toFixed(2)} of it in frame`);
		}
	}
});
