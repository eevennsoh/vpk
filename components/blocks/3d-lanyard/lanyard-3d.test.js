const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { buildSync } = require("esbuild");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");

const dir = __dirname;
const { outputFiles } = buildSync({
	stdin: {
		contents: `
			export { hasSimulation, inspectPhysics, inspectAttachment, pose, primeSimulation, simulate } from ${JSON.stringify(path.join(dir, "renderer/physics.ts"))};
			export { primeLanyardPhysics } from ${JSON.stringify(path.join(dir, "renderer/prime-lanyard-physics.ts"))};
			export { createPrimedSwing } from ${JSON.stringify(path.join(dir, "renderer/primed-swing.ts"))};
			export { hardwareDetail, hardwareMesh } from ${JSON.stringify(path.join(dir, "renderer/hardware.ts"))};
			export { attachment } from ${JSON.stringify(path.join(dir, "renderer/physics.ts"))};
			export { duration, dimensions } from ${JSON.stringify(path.join(dir, "renderer/constants.ts"))};
			export { LanyardPlayer } from ${JSON.stringify(path.join(dir, "lanyard-player.ts"))};
			export { LANYARD_3D_PROFILES, LANYARD_3D_AGENTS, LANYARD_3D_ASSETS } from ${JSON.stringify(path.join(dir, "data.ts"))};
		`,
		resolveDir: process.cwd(), loader: "ts",
	},
	bundle: true, platform: "node", format: "cjs", write: false,
	// Lets `new Worker(new URL(...))` resolve, so a test can stand a worker in.
	define: { "import.meta.url": JSON.stringify("file:///lanyard-3d-test/") },
});
const { hasSimulation, inspectPhysics, inspectAttachment, pose, primeSimulation, simulate, primeLanyardPhysics, createPrimedSwing, hardwareDetail, hardwareMesh, attachment, duration, dimensions, LanyardPlayer, LANYARD_3D_PROFILES, LANYARD_3D_AGENTS, LANYARD_3D_ASSETS } = loadCjsModuleFromText(outputFiles[0].text, path.join(dir, "index.ts"));

/** rAF stand-in that cancels by id, like the browser, so a leaked second loop stays visible. */
function fakeFrames() {
	const queue = new Map();
	let nextId = 1;
	globalThis.requestAnimationFrame = (callback) => { const id = nextId++; queue.set(id, callback); return id; };
	globalThis.cancelAnimationFrame = (id) => { queue.delete(id); };
	return {
		step(now) { const due = [...queue.values()]; queue.clear(); due.forEach((callback) => callback(now)); },
		pending: () => queue.size,
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

test("a drop simulated elsewhere is drawn as handed in, never simulated again here", () => {
	// A worker's result for swing 0.37, stood in for by swing 1's physics carried 1000 to the right.
	const source = simulate(1);
	const data = new Float32Array(source.data);
	for (let index = 0; index < data.length; index += 3) data[index] += 1000;
	primeSimulation(0.37, { ...source, data });
	for (const time of [0, 1.5, 4]) assert.ok(Math.abs(pose(time, 0.37).x - pose(time, 1).x - 1000) < 1e-3, `primed physics drawn at ${time}s`);
});

test("without a worker, priming still settles, leaving each swing to its first draw", async () => {
	assert.equal(typeof globalThis.Worker, "undefined");
	await primeLanyardPhysics([0.6, 0.6]);
});

test("a small render tessellates the clasp coarser, a full-size one exactly as before", () => {
	assert.equal(hardwareDetail(2.7), 1, "the block's own stage");
	assert.equal(hardwareDetail(1.5), 1);
	assert.equal(hardwareDetail(0.93), 0.5);
	assert.equal(hardwareDetail(0.68), 1 / 3, "a mega bento tile");
	const p = pose(3.3, 1), a = attachment(3.3, 1, p, 15), metal = { width: 2, height: 2 };
	const clasp = (detail) => { const faces = []; hardwareMesh(faces, metal, a.origin, p.body, detail); return faces; };
	const bounds = (faces) => { const xs = faces.flatMap((face) => face.v.map((v) => v.x)), ys = faces.flatMap((face) => face.v.map((v) => v.y)); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
	const full = clasp(1);
	assert.equal(full.length, 37088, "full detail keeps every triangle it had");
	let previous = full.length;
	for (const detail of [0.5, 1 / 3]) {
		const faces = clasp(detail);
		assert.ok(faces.length < previous * 0.5, `detail ${detail}: ${faces.length} triangles`);
		previous = faces.length;
		assert.ok(faces.every((face) => face.v.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z))), `detail ${detail} stays finite`);
		// Same silhouette: its extent matches full detail's to within a unit (a wall tile's pixel is about 1.5).
		bounds(faces).forEach((edge, index) => assert.ok(Math.abs(edge - bounds(full)[index]) < 1, `detail ${detail} edge ${index}: ${edge} vs ${bounds(full)[index]}`));
	}
	assert.ok(previous < full.length * 0.2, "a wall tile draws under a fifth of the clasp");
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

test("replaying mid-playback keeps exactly one frame loop", () => {
	const frames = fakeFrames();
	const player = new LanyardPlayer(5, () => undefined);
	player.play();
	frames.step(1000);
	for (let i = 0; i < 3; i++) player.replay();
	assert.equal(frames.pending(), 1, "repeated replays must not stack render loops");
	frames.step(1100);
	assert.equal(frames.pending(), 1);
});

test("under reduced motion, play, replay and loop settle without animating", () => {
	const frames = fakeFrames();
	const rendered = [];
	const player = new LanyardPlayer(4, (time) => rendered.push(time), () => true);
	for (const start of [() => player.play(), () => player.replay(), () => player.setLooping(true)]) {
		player.seek(1);
		start();
		assert.equal(frames.pending(), 0, "no frame loop is scheduled");
		assert.equal(player.getSnapshot().playing, false);
		assert.equal(player.getSnapshot().time, 4);
		assert.equal(rendered.at(-1), 4, "the settled pose is drawn");
	}
	player.seek(2);
	assert.equal(player.getSnapshot().time, 2, "scrubbing still works");
});

/* ─── A Swing change never simulates on the main thread ───────────────── */

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A worker stand-in for `createPrimedSwing`: each ask waits for `land()`, which primes its swings (or none, as a failed worker). */
function standInPrime(source) {
	const asks = [];
	const prime = (swings) => new Promise((resolve) => asks.push({
		swings,
		land(failed = false) {
			if (!failed) for (const swing of swings) primeSimulation(swing, { ...source });
			resolve();
		},
	}));
	return { asks, prime };
}

test("dragging Swing draws the last simulated swing while a worker simulates the newest, one at a time", async () => {
	const worker = standInPrime(simulate(1));
	let landed = 0;
	const swing = createPrimedSwing(0.81, () => { landed += 1; }, worker.prime);
	assert.deepEqual(worker.asks.map((ask) => ask.swings), [[0.81]], "the first swing is simulated before the stage draws");
	worker.asks[0].land();
	await swing.ready;
	assert.equal(swing.current(), 0.81);
	for (const value of [0.82, 0.83, 0.84]) {
		swing.want(value);
		assert.ok(hasSimulation(swing.current()), `still drawable at ${value}`);
	}
	assert.deepEqual(worker.asks.map((ask) => ask.swings), [[0.81], [0.82]], "one simulation at a time");
	assert.equal(swing.current(), 0.81, "keeps drawing the last swing whose physics is in");
	worker.asks[1].land();
	await flush();
	assert.equal(swing.current(), 0.82, "shows the nearer one as it lands");
	assert.deepEqual(worker.asks[2].swings, [0.84], "skips the swings passed on the way");
	assert.ok(hasSimulation(swing.current()));
	worker.asks[2].land();
	await flush();
	assert.equal(swing.current(), 0.84);
	assert.equal(landed, 3, "a redraw for each swing that landed");
	swing.dispose();
});

test("a swing whose physics is kept is drawn at once, with nothing simulated", async () => {
	primeSimulation(0.85, { ...simulate(1) });
	const worker = standInPrime(simulate(1));
	const swing = createPrimedSwing(0.85, () => assert.fail("nothing to land"), worker.prime);
	await swing.ready;
	assert.equal(worker.asks.length, 0);
	assert.equal(swing.current(), 0.85);
});

test("without a worker, the swing asked for is drawn anyway, simulated on its first draw as before", async () => {
	const worker = standInPrime(simulate(1));
	let landed = 0;
	const swing = createPrimedSwing(0.86, () => { landed += 1; }, worker.prime);
	worker.asks[0].land(true);
	await swing.ready;
	assert.equal(hasSimulation(0.86), false);
	assert.equal(swing.current(), 0.86);
	assert.equal(landed, 1);
});

test("the physics cache drops the least recently drawn swing, never the one on screen", () => {
	const source = simulate(1);
	for (const swing of [0.91, 0.92, 0.93]) primeSimulation(swing, { ...source });
	pose(2, 0.91);
	primeSimulation(0.94, { ...source });
	assert.equal(hasSimulation(0.91), true, "drawn last, so kept");
	assert.equal(hasSimulation(0.92), false, "least recently drawn, so dropped");
});

test("priming simulates a swing the cache has dropped again, and a kept one not at all", async () => {
	const source = simulate(1);
	const asked = [];
	globalThis.Worker = class StandInWorker {
		postMessage(message) {
			asked.push(...message.amounts);
			setImmediate(() => { for (const amount of message.amounts) this.onmessage({ data: { amount, simulation: { ...source } } }); });
		}
		terminate() {}
	};
	try {
		await primeLanyardPhysics([0.95]);
		assert.deepEqual(asked, [0.95]);
		await primeLanyardPhysics([0.95, 0.95]);
		assert.deepEqual(asked, [0.95], "kept: nothing to simulate");
		for (const swing of [0.96, 0.97, 0.98]) primeSimulation(swing, { ...source });
		assert.equal(hasSimulation(0.95), false);
		await primeLanyardPhysics([0.95]);
		assert.deepEqual(asked, [0.95, 0.95], "dropped: simulated again rather than drawn on the main thread");
		assert.equal(hasSimulation(0.95), true);
	} finally {
		delete globalThis.Worker;
	}
});
