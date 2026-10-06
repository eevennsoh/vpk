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

function sceneFor(viewport = VIEWPORT) {
	const m = load();
	const { scale } = m.finaleStageFit(viewport.width, viewport.height);
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, m.finaleBentoLayout(viewport, scale), m.FINALE_FEATURES, []);
	return { m, geometry, wall };
}

const close = (actual, expected, message) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${message ?? "time"}: ${actual} ≠ ${expected}`);

test("a lanyard drops once on the renderer's own clock, then hangs still on its end pose for good", () => {
	const m = load();
	const duration = m.LANYARD_DURATION;
	const drop = 40;
	assert.equal(m.wallLanyardTime(drop - 0.01, drop, duration), null, "nothing hangs before it drops");
	close(m.wallLanyardTime(drop, drop, duration), 0);
	close(m.wallLanyardTime(drop + 3, drop, duration), 3, "mid-swing");
	for (const later of [0, 1, 13, 60]) {
		close(m.wallLanyardTime(drop + duration + later, drop, duration), duration, "held still: never reeled up or dropped again");
	}
});

test("each tile along the wall is a new lanyard: no presenter, agent or swing twice in a row, and every round uses them all", () => {
	const m = load();
	const people = m.LANYARD_3D_PROFILES.length;
	const agents = m.LANYARD_3D_AGENTS.length;
	assert.equal(people, 4);
	assert.equal(agents, 5);
	// Copies before the wall's first period deal too (their orders are negative).
	const orders = Array.from({ length: 60 }, (_, index) => index - 20);
	const deals = orders.map((order) => m.wallLanyardDeal(order, people, agents));
	for (let index = 1; index < deals.length; index += 1) {
		const order = orders[index];
		assert.notEqual(deals[index].person, deals[index - 1].person, `presenter at ${order}`);
		assert.notEqual(deals[index].agent, deals[index - 1].agent, `agent at ${order}`);
		assert.notEqual(deals[index].swing, deals[index - 1].swing, `swing at ${order}`);
	}
	const round = (count, from) => deals.slice(orders.indexOf(from), orders.indexOf(from) + count);
	for (const from of [-20, -4, 0, 8, 20]) assert.equal(new Set(round(people, from).map((deal) => deal.person)).size, people, `every presenter from ${from}`);
	for (const from of [-20, -5, 0, 10, 25]) assert.equal(new Set(round(agents, from).map((deal) => deal.agent)).size, agents, `every agent from ${from}`);
	for (const from of [-18, -3, 0, 9, 24]) assert.equal(new Set(round(3, from).map((deal) => deal.swing)).size, 3, `every swing from ${from}`);
	for (const deal of deals) {
		assert.ok(m.WALL_LANYARD.swings.includes(deal.swing), "only swings whose physics is primed");
		assert.ok(deal.revealAngle >= m.WALL_LANYARD.reveal[0] && deal.revealAngle <= m.WALL_LANYARD.reveal[1], `reveal ${deal.revealAngle}`);
	}
	assert.deepEqual(m.wallLanyardDeal(7, people, agents), deals[orders.indexOf(7)], "the same tile is always dealt the same");
	// The reveal is spread across its range, not bunched at one end.
	const [low, high] = m.WALL_LANYARD.reveal;
	const middle = (low + high) / 2;
	assert.ok(deals.some((deal) => deal.revealAngle < middle - 3) && deals.some((deal) => deal.revealAngle > middle + 3), "reveals vary across the range");
	assert.equal(m.WALL_LANYARD_FRAMING_SWING, Math.max(...m.WALL_LANYARD.swings), "framed for the liveliest swing");
});

test("a lanyard tile never flies in: it glides in hanging from the top, and drops once most of it is in frame", () => {
	for (const viewport of [VIEWPORT, { width: 1024, height: 768 }, { width: 2560, height: 1440 }]) {
		const { m, geometry, wall } = sceneFor(viewport);
		const lanyards = Array.from({ length: wall.periodBuckets * 3 }, (_, index) => wall.bucket(index)).flat().filter((slot) => slot.content.kind === "lanyard").sort((a, b) => a.rect.x - b.rect.x);
		assert.equal(lanyards.length, 9, "three a period");
		assert.deepEqual(lanyards.map((slot) => slot.content.order), [0, 1, 2, 3, 4, 5, 6, 7, 8], "each copy of the period carries on the run, in order along the wall");
		const settled = m.WALL_CUE.start + m.WALL_CUE.carryDownAt + m.WALL_LANYARD.afterCarryS;
		const [least, most] = m.WALL_LANYARD.enterShown;
		for (const slot of lanyards) {
			assert.equal(m.slotDescent(slot, wall), null, `${slot.key} never waits in the air, which would show its cut strap`);
			assert.equal(m.wallSlotPresence(slot, wall, [], m.WALL_CUE.start + 30).revealStart, null, `${slot.key} never builds`);
			const drop = m.wallLanyardDropTime(slot, geometry);
			assert.ok(drop >= settled, `${slot.key} drops after the title is set down`);
			const rect = m.slotOnScreen(slot, m.wallOffset(drop, geometry), geometry);
			const inFrame = (viewport.width - rect.x) / rect.width;
			assert.ok(inFrame >= least - 1e-3 && inFrame <= most + 1e-3, `${viewport.width}: ${slot.key} drops with ${inFrame.toFixed(2)} of it in frame`);
		}
	}
});
