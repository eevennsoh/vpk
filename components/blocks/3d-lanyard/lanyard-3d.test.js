const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { buildSync } = require("esbuild");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");

const dir = __dirname;
const { outputFiles } = buildSync({
	stdin: {
		contents: `
			export { inspectPhysics, inspectAttachment, pose } from ${JSON.stringify(path.join(dir, "renderer/physics.ts"))};
			export { duration, dimensions } from ${JSON.stringify(path.join(dir, "renderer/constants.ts"))};
			export { LanyardPlayer } from ${JSON.stringify(path.join(dir, "lanyard-player.ts"))};
			export { LANYARD_3D_PROFILES, LANYARD_3D_AGENTS, LANYARD_3D_ASSETS } from ${JSON.stringify(path.join(dir, "data.ts"))};
		`,
		resolveDir: process.cwd(), loader: "ts",
	},
	bundle: true, platform: "node", format: "cjs", write: false,
});
const { inspectPhysics, inspectAttachment, pose, duration, dimensions, LanyardPlayer, LANYARD_3D_PROFILES, LANYARD_3D_AGENTS, LANYARD_3D_ASSETS } = loadCjsModuleFromText(outputFiles[0].text, path.join(dir, "index.ts"));

function fakeFrames() {
	const queue = [];
	globalThis.requestAnimationFrame = (callback) => { queue.push(callback); return queue.length; };
	globalThis.cancelAnimationFrame = () => { queue.length = 0; };
	return {
		step(now) { const next = queue.splice(0); next.forEach((callback) => callback(now)); },
		pending: () => queue.length,
	};
}

test("ships the four people and five agents the block promises", () => {
	assert.deepEqual(LANYARD_3D_PROFILES.map((profile) => profile.id), ["tamar", "sherif", "mike", "taroon"]);
	assert.deepEqual(LANYARD_3D_AGENTS.map((agent) => agent.name), ["Claude", "Codex", "Cursor", "Github Copilot", "Rovo"]);
	for (const agent of LANYARD_3D_AGENTS) assert.ok(LANYARD_3D_ASSETS.agents[agent.asset], `${agent.id} has badge artwork`);
});

test("cloth keeps its length while the badge drops, catches and swings", () => {
	for (const time of [.5, 1, 2, 4, duration]) {
		for (const strap of inspectPhysics(time, 1)) {
			assert.ok(strap.length / strap.restLength < 1.05, `strap stretched at ${time}s`);
			assert.ok(strap.maxSegmentStrain < .2, `segment strain ${strap.maxSegmentStrain} at ${time}s`);
		}
	}
});

test("both cards turn about one hole axis without crossing", () => {
	for (const time of [0, 1, 2.5, 4, duration]) {
		const attachment = inspectAttachment(time, 1, 15);
		assert.ok(attachment.sharedAxisError < 1e-6, `axis drift ${attachment.sharedAxisError} at ${time}s`);
		assert.ok(attachment.cardClearance > 0);
	}
});

test("the lanyard settles to rest facing the audience", () => {
	const rest = pose(duration, 1);
	assert.ok(Math.abs(rest.yaw) < 1 && Math.abs(rest.angle) < 1, `settled yaw ${rest.yaw}, roll ${rest.angle}`);
});

test("every format is a real aspect ratio", () => {
	for (const [width, height] of Object.values(dimensions)) assert.ok(width > 0 && height > 0);
});

test("player advances, stops at the end, and renders the settled frame", () => {
	const frames = fakeFrames();
	const rendered = [];
	const player = new LanyardPlayer(2, (time) => rendered.push(time));
	player.play();
	assert.equal(player.getSnapshot().playing, true);
	// Each frame advances at most 100ms, so a stalled tab cannot jump the animation.
	frames.step(1000); frames.step(1100);
	assert.ok(Math.abs(player.getSnapshot().time - .1) < 1e-9);
	frames.step(2100);
	assert.ok(Math.abs(player.getSnapshot().time - .2) < 1e-9, "a long gap is clamped");
	for (let now = 2200; player.getSnapshot().playing; now += 100) frames.step(now);
	assert.equal(player.getSnapshot().playing, false);
	assert.equal(player.getSnapshot().time, 2);
	assert.equal(rendered.at(-1), 2);
	assert.equal(frames.pending(), 0, "no frame loop once finished");
});

test("player loops past the end and replays from the start", () => {
	const frames = fakeFrames();
	const player = new LanyardPlayer(1, () => undefined);
	player.setLooping(true);
	let wrapped = false, previous = 0;
	for (let now = 1000; now < 1000 + 100 * 14; now += 100) {
		frames.step(now);
		const { time } = player.getSnapshot();
		if (time < previous) wrapped = true;
		previous = time;
	}
	assert.equal(wrapped, true, "time wrapped back past the end");
	assert.equal(player.getSnapshot().playing, true);
	assert.ok(player.getSnapshot().time < 1);
	player.replay();
	assert.equal(player.getSnapshot().time, 0);
});

test("seeking pauses playback and clamps to the duration", () => {
	fakeFrames();
	const rendered = [];
	const player = new LanyardPlayer(3, (time) => rendered.push(time));
	player.play();
	player.seek(99);
	assert.equal(player.getSnapshot().playing, false);
	assert.equal(player.getSnapshot().time, 3);
	player.seek(-5);
	assert.equal(player.getSnapshot().time, 0);
	assert.equal(rendered.at(-1), 0);
});

test("subscribers are notified with a fresh snapshot and can unsubscribe", () => {
	fakeFrames();
	const player = new LanyardPlayer(3, () => undefined);
	let calls = 0;
	const before = player.getSnapshot();
	const unsubscribe = player.subscribe(() => { calls += 1; });
	player.seek(1);
	assert.equal(calls, 1);
	assert.notEqual(player.getSnapshot(), before);
	unsubscribe();
	player.seek(2);
	assert.equal(calls, 1);
});
