const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { registerHooks } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const { fileURLToPath, pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../../../../..");
registerHooks({
	load(url, context, nextLoad) {
		return nextLoad(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context);
	},
	resolve(specifier, context, nextResolve) {
		const target = specifier.startsWith("@/")
			? path.join(root, specifier.slice(2))
			: specifier.startsWith(".") && context.parentURL?.startsWith("file:")
				? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
				: null;
		if (target && existsSync(`${target}.ts`)) return nextResolve(pathToFileURL(`${target}.ts`).href, context);
		if (target && specifier.startsWith("@/")) return nextResolve(pathToFileURL(target).href, context);
		return nextResolve(specifier, context);
	},
});

const { arrivalCardPose, bentoDrops, bentoTouchdown, landingRevealStart, slotDescent, wallLandingsAt, wallSheetsAt } = require("./finale-wall-motion.ts");
const { buildFinaleWall, wallGeometry } = require("./finale-wall-layout.ts");
const { finaleBentoLayout, FINALE_FEATURES } = require("../data/finale-stories.ts");

const viewport = { width: 1920, height: 1080 };
const rect = { x: 1500, y: 200, width: 240, height: 320 };
const card = {
	key: "arrival", index: null, code: null, rect, radius: 20,
	descent: { start: 10, touchdown: 12 },
};

test("edge arrivals settle from their waiting tilt without a flip, overshoot or sideways rock", () => {
	for (let seed = 0; seed < 32; seed++) {
		const slot = { key: "arrival", seed, bucket: 0, rect, content: { kind: "stat", stat: "tokens" } };
		let before = arrivalCardPose(slot, card, rect, 10, viewport, { breathing: false });
		for (let frame = 1; frame <= 120; frame++) {
			const pose = arrivalCardPose(slot, card, rect, 10 + frame / 60, viewport, { breathing: false });
			for (const axis of ["rotateX", "rotateY", "rotateZ", "z"]) {
				assert.ok(Math.abs(pose[axis]) <= Math.abs(before[axis]) + 1e-9, `${axis} reverses at seed ${seed}, frame ${frame}`);
			}
			for (const [axis, goal] of [["x", 1620], ["y", 360]]) {
				assert.ok(Math.abs(pose[axis] - goal) <= Math.abs(before[axis] - goal) + 1e-9, `${axis} rocks at seed ${seed}, frame ${frame}`);
			}
			before = pose;
		}
		assert.deepEqual([before.rotateX, before.rotateY, before.rotateZ, before.z], [0, 0, 0, 0]);
	}
});

test("a stack's individual cards stay on the same smooth descent and land on their own rectangles", () => {
	const slot = { key: "stack", seed: 8, bucket: 0, rect, content: { kind: "print", codes: ["TEU-1", "TEU-2"] } };
	for (const index of [0, 1]) {
		const sheet = { ...card, index, code: `TEU-${index + 1}`, rect: { x: 0, y: index * 160, width: 240, height: 150 } };
		const pose = arrivalCardPose(slot, sheet, rect, 12, viewport);
		assert.deepEqual([pose.x, pose.y, pose.width, pose.height], [1620, 275 + index * 160, 240, 150]);
	}
});

function wallScene() {
	const bento = finaleBentoLayout(viewport, 1);
	const wall = buildFinaleWall(wallGeometry(1, viewport), bento, FINALE_FEATURES, []);
	const drops = bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	const arrivals = wall.items.filter((slot) => slot.reserved === undefined && !(slot.content.kind === "piece" && slot.content.bare) && slotDescent(slot, wall)?.start > 20);
	assert.ok(arrivals.length >= 8);
	return { wall, drops, arrivals };
}

test("edge arrivals show the full chromatic approach before settling", () => {
	const { wall, drops, arrivals } = wallScene();
	for (const slot of arrivals.slice(0, 12)) {
		const descent = slotDescent(slot, wall);
		for (const lead of [0.5, 0.05]) {
			const sheet = wallSheetsAt(descent.start - lead, wall, drops, viewport).find((sheet) => sheet.key === `card-${slot.key}`);
			assert.ok(sheet && sheet.pose.opacity > 0.99, `${slot.key}: visible ${lead}s before descent`);
			assert.equal(sheet.chroma, 1);
		}
		const landed = wallSheetsAt(descent.touchdown + 0.1, wall, drops, viewport).find((sheet) => sheet.key === `card-${slot.key}`);
		assert.equal(landed.chroma, 0);
	}
});

test("new content gets a dot reveal after landing while built bento cards skip it", () => {
	const { wall, drops, arrivals } = wallScene();
	for (const drop of drops) {
		const touchdown = bentoTouchdown(drop, drops);
		const landing = wallLandingsAt(touchdown + 0.2, wall, drops).find((landing) => landing.key === `bento-${drop.order}`);
		assert.equal(landing.revealStart, null);
	}
	for (const slot of arrivals.filter((slot) => slot.content.kind !== "print")) {
		const { touchdown } = slotDescent(slot, wall);
		const landing = wallLandingsAt(touchdown + 0.2, wall, drops).find((landing) => landing.key === slot.key);
		assert.equal(landing.revealStart, landingRevealStart(touchdown));
	}
});

test("a Studio piece without a tile has no arrival sheet or dot reveal", () => {
	const { wall, drops, arrivals } = wallScene();
	const slot = arrivals.find((slot) => slot.content.kind === "piece");
	assert.ok(slot);
	const bare = { ...slot, content: { ...slot.content, bare: true } };
	const bareWall = { ...wall, bucket: (index) => wall.bucket(index).map((candidate) => candidate.key === slot.key ? bare : candidate) };
	const { touchdown } = slotDescent(bare, bareWall);
	const time = touchdown + 0.2;
	assert.equal(wallSheetsAt(time, bareWall, drops, viewport).some((sheet) => sheet.key === `card-${bare.key}`), false);
	const landing = wallLandingsAt(time, bareWall, drops).find((landing) => landing.key === bare.key);
	assert.equal(landing.revealStart, null);
});
