const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let model;
function load() {
	model ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: 'export * from "./finale-confetti"; export { FLASH_TIMING, FLASH_ROVO_COLORS } from "./finale-column-flash";', resolveDir: __dirname, loader: "ts" },
		bundle: true, format: "cjs", platform: "node", write: false,
	}).outputFiles[0].text, "finale-confetti-harness.cjs");
	return model;
}

// A 1440×900 board whose Done column sits at the right.
const COLUMN = { x: 1090, y: 240, width: 322, height: 630, radius: 8 };
const STAGE = { width: 1440, height: 900, column: COLUMN };

test("the timeline composes the resolved VPK duration tokens and hands over in the flash's rise", () => {
	const { FINALE_CONFETTI_TIMING: T, FLASH_TIMING } = load();
	const css = readFileSync("app/tailwind-theme.css", "utf8");
	const token = (name) => Number(css.match(new RegExp(`--duration-${name}:\\s*(\\d+)ms`))[1]) / 1000;
	assert.equal(T.volley, token("slow"), "the cannons fire as a stream the eye can follow");
	assert.equal(T.gatherStart, token("slowest") * 2 + token("medium"), "a long hang before the vortex opens");
	assert.equal(T.gatherSpread, token("slower"));
	assert.equal(T.glowIn, token("slower"), "the column's glow pulses in once, briefly");
	assert.equal(T.firstArrival, (token("slowest") + token("slower")) * 2);
	assert.equal(T.gathered, token("slowest") * 4);
	assert.equal(T.release, FLASH_TIMING.rise, "the ember blooms over exactly the flash's own rise");
	assert.equal(T.release, token("fast"));
});

test("one mirrored burst of Rovo paper, sequins and ribbons, balanced in hue everywhere", () => {
	const { createFinaleConfettiBurst, FLASH_ROVO_COLORS } = load();
	const { pieces } = createFinaleConfettiBurst(STAGE);
	assert.equal(pieces.length, 600);
	assert.equal(pieces.filter((piece) => piece.corner === "left").length, 300);
	const rovo = new Set(FLASH_ROVO_COLORS);
	for (const piece of pieces) assert.ok(rovo.has(piece.front) && rovo.has(piece.back) && piece.front !== piece.back, "two Rovo faces");
	const count = (predicate) => pieces.filter(predicate).length;
	assert.ok(count((piece) => piece.material === "sequin") > 90, "enough sequins to glint");
	assert.ok(count((piece) => piece.material === "ribbon") > 25, "enough ribbons to read as streamers");
	// Regression: the slow trail was once every fourth index, which aligned it with the hue cycle.
	const trail = pieces.filter((piece) => Math.hypot(piece.velocity.x, piece.velocity.y) < 2200 * 0.5);
	assert.ok(trail.length > 100, "a slow trail stays near each corner");
	for (const hue of FLASH_ROVO_COLORS) {
		const share = trail.filter((piece) => piece.front === hue).length / trail.length;
		assert.ok(share > 0.15 && share < 0.35, `the trail carries ${hue} in proportion (${share.toFixed(2)})`);
	}
});

test("each corner fires a stream: the plume's head first, the gentle trail dribbling out last", () => {
	const { createFinaleConfettiBurst, FINALE_CONFETTI_TIMING: T } = load();
	const { pieces } = createFinaleConfettiBurst(STAGE);
	const trail = (piece) => Math.hypot(piece.velocity.x, piece.velocity.y) < 2200 * 0.5;
	const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
	for (const corner of ["left", "right"]) {
		const fired = pieces.filter((piece) => piece.corner === corner);
		const delays = fired.map((piece) => piece.delay);
		assert.ok(Math.min(...delays) < 0.01 && Math.max(...delays) > T.volley * 0.9 && Math.max(...delays) <= T.volley, "it keeps firing across the whole volley");
		// Regression: the whole volley once fired within 50ms, a fan already formed when first seen.
		assert.ok(Math.max(...delays) - Math.min(...delays) > 0.2, "long enough to watch it leave the corner");
		const head = fired.filter((piece) => !trail(piece)).map((piece) => piece.delay);
		assert.ok(median(head) < T.volley * 0.4, "front-loaded: most of the plume leaves early");
		assert.ok(fired.filter(trail).every((piece) => piece.delay >= T.volley * 0.35 - 1e-9), "the slow trail follows it out");
	}
});

test("both cannons fire a forceful broad diagonal fan from the lower corners", () => {
	const { createFinaleConfettiBurst, finaleConfettiFree, FINALE_CONFETTI_TIMING: T } = load();
	for (const height of [600, 900, 1100]) {
		const stage = { ...STAGE, height, column: { ...COLUMN, height: height - 270 } };
		const { pieces } = createFinaleConfettiBurst(stage);
		for (const piece of pieces) {
			assert.equal(piece.origin.x, piece.corner === "left" ? 0 : stage.width);
			const early = finaleConfettiFree(piece, piece.delay + 0.05);
			assert.ok(early.y < piece.origin.y, "every piece launches upward");
			// Flutter may sway a vertical launch by under a pixel; none heads off the edge.
			assert.ok(piece.corner === "left" ? early.x > -1 : early.x < stage.width + 1, "and never outward");
		}
		for (const corner of ["left", "right"]) {
			const fan = pieces.filter((piece) => piece.corner === corner).map((piece) => finaleConfettiFree(piece, T.gatherStart));
			const reach = fan.map((point) => corner === "left" ? point.x : stage.width - point.x);
			// Launch strength scales with the viewport height, as the drop does.
			assert.ok(Math.max(...reach) > height * 0.95, "the forceful fan reaches across the board");
			assert.ok(fan.filter((point) => point.y < height * 0.5).length > 60, "and well into the upper half");
		}
	}
});

test("the vortex lands every piece exactly on the column's bottom border, farthest last, by `gathered`", () => {
	const { createFinaleConfettiBurst, finaleConfettiCenter, finaleConfettiFree, FINALE_CONFETTI_TIMING: T } = load();
	const { pieces } = createFinaleConfettiBurst(STAGE);
	const sinks = pieces.map((piece) => piece.gather.sink);
	for (const sink of sinks) {
		assert.equal(sink.y, COLUMN.y + COLUMN.height, "on the bottom border");
		assert.ok(sink.x >= COLUMN.x + COLUMN.radius && sink.x <= COLUMN.x + COLUMN.width - COLUMN.radius, "clear of its corners");
	}
	const middle = sinks.filter((sink) => Math.abs(sink.x - (COLUMN.x + COLUMN.width / 2)) < COLUMN.width / 4).length;
	assert.ok(middle / sinks.length > 0.6, "the landing favours the centre, where the flash ignites");
	for (const piece of pieces) {
		assert.ok(piece.gather.start >= T.gatherStart - 0.03, "free flight runs until the vortex opens");
		assert.ok(piece.gather.end - piece.gather.start >= 0.4 - 1e-9, "no piece is snatched to the source");
		assert.ok(piece.gather.end >= T.firstArrival - 1e-9 && piece.gather.end <= T.gathered + 1e-9);
		for (const time of [piece.gather.end, T.gathered, T.gathered + 1]) {
			const at = finaleConfettiCenter(piece, time);
			assert.ok(Math.hypot(at.x - piece.gather.sink.x, at.y - piece.gather.sink.y, at.z) < 1e-6, "it lands, and stays, on its sink, on the page");
		}
		// The pull and swirl start at rest: entering the vortex keeps the piece's velocity.
		const dt = 1e-4;
		const velocity = (fn) => {
			const a = fn(piece.gather.start - dt);
			const b = fn(piece.gather.start + dt);
			return [(b.x - a.x) / (2 * dt), (b.y - a.y) / (2 * dt)];
		};
		const free = velocity((time) => finaleConfettiFree(piece, time));
		const drawn = velocity((time) => finaleConfettiCenter(piece, time));
		assert.ok(Math.hypot(free[0] - drawn[0], free[1] - drawn[1]) < 1, "no kink where the vortex takes over");
	}
	assert.ok(Math.abs(Math.max(...pieces.map((piece) => piece.gather.end)) - T.gathered) < 1e-9, "the last arrival is the gather cue");
	const distance = (piece) => {
		const at = finaleConfettiFree(piece, T.gatherStart);
		return Math.hypot(at.x - piece.gather.sink.x, at.y - piece.gather.sink.y, at.z);
	};
	const byArrival = [...pieces].sort((a, b) => a.gather.end - b.gather.end);
	assert.ok(distance(byArrival[0]) < distance(byArrival.at(-1)), "the nearest arrives first, the farthest last");
});

test("depth of field: a foreground layer near the lens and a background layer behind the page", () => {
	const { createFinaleConfettiBurst, finaleConfettiFree, finaleConfettiCameraDistance, FINALE_CONFETTI_TIMING: T } = load();
	const { pieces } = createFinaleConfettiBurst(STAGE);
	const lens = finaleConfettiCameraDistance(STAGE.height);
	const depth = pieces.map((piece) => finaleConfettiFree(piece, T.gatherStart).z);
	const near = depth.filter((z) => z > lens * 0.25).length / pieces.length;
	const far = depth.filter((z) => z < -lens * 0.3).length / pieces.length;
	assert.ok(near > 0.07 && near < 0.14, `about a tenth fly past the lens (${near.toFixed(3)})`);
	assert.ok(far > 0.1 && far < 0.18, `and a larger share recede behind the page (${far.toFixed(3)})`);
	assert.ok(depth.every((z) => z < lens * 0.61), "none reaches the lens");
	const order = pieces.map((piece) => finaleConfettiFree(piece, T.gatherStart * 0.75).z);
	assert.ok(order.every((z, index) => index === 0 || z >= order[index - 1]), "drawn far to near");
});

test("the border charges steadily from the first arrival to full at the gather cue", () => {
	const { createFinaleConfettiBurst, finaleConfettiCharge, FINALE_CONFETTI_TIMING: T } = load();
	const burst = createFinaleConfettiBurst(STAGE);
	assert.equal(finaleConfettiCharge(burst, T.firstArrival - 0.07), 0);
	assert.equal(finaleConfettiCharge(burst, T.gathered), 1);
	let previous = 0;
	for (let time = T.firstArrival - 0.1; time <= T.gathered + 0.05; time += 0.01) {
		const charge = finaleConfettiCharge(burst, time);
		assert.ok(charge >= previous - 1e-12, "the charge never drains");
		previous = charge;
	}
	const middle = finaleConfettiCharge(burst, (T.firstArrival + T.gathered) / 2);
	assert.ok(middle > 0.35 && middle < 0.65, "arrivals pour in at a steady rate");
});

test("the column's glow pulses in once, briefly, just before the pull, then brightens to full as every piece lands", () => {
	const { createFinaleConfettiBurst, finaleConfettiCharge, finaleConfettiGlow, FINALE_CONFETTI_TIMING: T } = load();
	const burst = createFinaleConfettiBurst(STAGE);
	const glow = (time) => finaleConfettiGlow(time, finaleConfettiCharge(burst, time));
	const start = T.gatherStart - T.glowIn;
	assert.ok(start > T.volley, "dark while the cannons fire");
	assert.equal(glow(start), 0);
	// Regression: it popped on as the vortex opened, a third of its brightness in one frame.
	let steepest = 0;
	for (let time = 0; time < T.gathered; time += 1 / 120) steepest = Math.max(steepest, glow(time + 1 / 60) - glow(time));
	assert.ok(steepest < 0.1, `it glows in from nothing, never popping on (${steepest.toFixed(3)} in a frame)`);
	// One pulse: it swells past the brightness it sets off at, then eases back to it.
	const samples = [];
	for (let time = start; time <= T.gatherStart + 1e-9; time += 0.005) samples.push(glow(time));
	const turns = samples.slice(1, -1).map((value, index) => Math.sign(value - samples[index]) - Math.sign(samples[index + 2] - value));
	assert.equal(turns.filter((turn) => turn > 0).length, 1, "one swell…");
	assert.equal(turns.filter((turn) => turn < 0).length, 0, "…with no second beat…");
	assert.ok(Math.max(...samples) > glow(T.gatherStart) * 1.15, "…that reads as a pulse…");
	assert.ok(Math.abs(glow(T.gatherStart) - 0.65) < 1e-9, "…easing back just as the trace sets off, before any piece lands");
	// Regression: it pulsed at the top for twice as long, lingering there before the trace.
	assert.ok(T.glowIn <= T.gatherSpread + 1e-9, "brief: no longer than the pieces take to join the stream");
	assert.equal(glow(T.gathered), 1, "full once every piece is in");
	let previous = 0;
	for (let time = T.gatherStart; time <= T.gathered + 0.5; time += 0.01) {
		assert.ok(glow(time) >= previous - 1e-12 && glow(time) <= 1, "it only brightens, and never past full");
		previous = glow(time);
	}
});

test("the glow is traced up the column at a steady pace across the whole pull", () => {
	const { finaleConfettiTrace, FINALE_CONFETTI_TIMING: T } = load();
	assert.equal(finaleConfettiTrace(T.gatherStart), 0, "from the moment the vortex opens…");
	assert.equal(finaleConfettiTrace(T.gathered), 1, "…to the last piece landing");
	assert.equal(finaleConfettiTrace(T.gathered + 1), 1);
	// Regression: paced by the pieces, it once covered ~90% of the column in 0.6s.
	const step = 0.05;
	const rate = step / (T.gathered - T.gatherStart);
	for (let time = T.gatherStart; time < T.gathered - 1e-9; time += step) {
		assert.ok(Math.abs(finaleConfettiTrace(time + step) - finaleConfettiTrace(time) - rate) < 1e-9, "never racing: the same climb every moment");
	}
});

test("every rehearsal is the same show, and the GPU layout matches the GLSL port", () => {
	const { createFinaleConfettiBurst, packFinaleConfettiBurst, FINALE_CONFETTI_MOTION_GLSL } = load();
	const a = createFinaleConfettiBurst(STAGE);
	assert.deepEqual(createFinaleConfettiBurst(STAGE), a, "seeded: a rehearsal matches the keynote");
	const packed = packFinaleConfettiBurst(a);
	for (const [name, { array, itemSize }] of Object.entries(packed)) {
		assert.equal(array.length, a.pieces.length * itemSize);
		const type = itemSize === 1 ? "float" : `vec${itemSize}`;
		assert.match(FINALE_CONFETTI_MOTION_GLSL, new RegExp(`attribute ${type} ${name};`), `${name} is declared as ${type}`);
	}
	const declared = [...FINALE_CONFETTI_MOTION_GLSL.matchAll(/attribute \w+ (\w+);/g)].map((match) => match[1]);
	assert.deepEqual(declared.sort(), Object.keys(packed).sort(), "no attribute is declared without data");
	const row = [...packed.aGather.array.slice(0, 3)];
	assert.deepEqual(row.map((value) => Number(value.toFixed(5))), [a.pieces[0].gather.start, a.pieces[0].gather.end, a.pieces[0].gather.swirl].map((value) => Number(Math.fround(value).toFixed(5))));
});
