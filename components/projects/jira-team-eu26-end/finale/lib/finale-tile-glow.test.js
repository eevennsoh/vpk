const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-tile-glow";
export { tileRevealStart, touchdownTime } from "./finale-card-motion";
export { CUE, FINALE_REST_TIME } from "../data/finale-cues";
`;

let glow;
function load() {
	glow ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-tile-glow-harness.cjs");
	return glow;
}

const TILES = [0, 1, 2, 3, 4, 5];
const FRAME = 1 / 120;
const SCALE = 0.75;
const PERIMETER = 1500;
const SLOTS = TILES.map((order) => ({ x: 40 + (order % 3) * 460, y: 40 + Math.floor(order / 3) * 420, width: 440, height: 400 }));

function samples(fn, step = 0.002) {
	const out = [];
	for (let u = 0; u < 1; u += step) out.push(fn(u));
	return out;
}

test("every tile gets its own deterministic look and motion", () => {
	const { TILE_GLOW, TILE_GLOW_TONES, TILE_GLOW_MAX_SPOTS, tileGlowLook } = load();
	const looks = TILES.map((order) => tileGlowLook(order));
	assert.deepEqual(TILES.map((order) => structuredClone(tileGlowLook(order))), structuredClone(looks), "same order, same look");
	for (const key of ["lineWidth", "bloom", "bloomMix", "intensity", "gain", "opacity", "floor", "smoke", "smokeSize", "smokeSeed", "pulseRate", "pulsePhase", "modRate", "modPhase", "hueShift", "delay", "duration"]) {
		assert.equal(new Set(looks.map((look) => look[key].toFixed(4))).size, TILES.length, `${key} differs between tiles`);
	}
	const motion = (look) => look.spots.map((spot) => `${spot.speed.toFixed(3)}:${spot.maskRate.toFixed(2)}:${spot.color}`).join();
	assert.equal(new Set(looks.map(motion)).size, TILES.length, "spot speeds, flicker and colours differ");
	assert.ok(new Set(looks.map((look) => look.spots.length)).size >= 2, "spot counts differ");
	assert.equal(looks[0].tone, "bright", "the hero is bright");
	assert.ok(looks.some((look) => look.tone === "soft") && looks.some((look) => look.tone === "mid"), "some tiles are understated");
	for (const look of looks) {
		const tone = TILE_GLOW_TONES[look.tone];
		assert.ok(look.spots.length >= 4 && look.spots.length <= TILE_GLOW_MAX_SPOTS);
		assert.ok(look.bloom >= tone.bloom[0] && look.bloom <= tone.bloom[1]);
		assert.ok(look.lineWidth >= TILE_GLOW.lineWidth[0] && look.lineWidth <= TILE_GLOW.lineWidth[1], "a thin stroke");
		assert.ok(look.spots.some((spot) => spot.speed < 0) && look.spots.some((spot) => spot.speed > 0), "spots orbit both ways");
		const speeds = look.spots.map((spot) => Math.abs(spot.speed).toFixed(4));
		assert.equal(new Set(speeds).size, look.spots.length, "each spot has its own speed");
		assert.ok(new Set(look.spots.map((spot) => spot.color)).size >= 3, "at least three Rovo colours per tile");
		for (const spot of look.spots) {
			assert.ok(Math.abs(spot.speed) >= TILE_GLOW.speed[0] && Math.abs(spot.speed) <= TILE_GLOW.speed[1]);
			assert.ok(spot.pulseMix >= 0 && spot.pulseMix <= 0.5, "the beat never fully takes over a spot");
			assert.ok(TILE_GLOW.colors.includes(spot.color) && TILE_GLOW.colors.includes(spot.shift), "Rovo colours only");
		}
	}
	const byTone = (tone) => looks.filter((look) => look.tone === tone);
	assert.ok(Math.max(...byTone("soft").map((look) => look.gain * look.opacity)) < Math.min(...byTone("bright").map((look) => look.gain * look.opacity)), "soft tiles are quieter");
});

test("each glow starts once its tile settles, and is gone before its heading has built and by CUE.end", () => {
	const { CUE, TILE_GLOW, tileGlowLook, tileGlowWindow, tileRevealStart, touchdownTime } = load();
	for (const order of TILES) {
		const { start, peak, fallStart, end } = tileGlowWindow(order);
		const settle = touchdownTime(order) + TILE_GLOW.settle;
		assert.ok(start >= settle && start <= settle + TILE_GLOW.delay[1], `tile ${order} starts once settled`);
		assert.ok(start < peak && peak < fallStart && fallStart < end, "rise, alive, fall");
		assert.ok(Math.abs(end - start - tileGlowLook(order).duration) < 1e-9, `tile ${order} keeps its own duration (not clamped)`);
		assert.ok(end - start >= 1.5, "a brief but readable moment");
		assert.ok(peak - start <= 0.4, "fades up quickly");
		assert.ok(end <= tileRevealStart(order) + CUE.reveal + 1e-9, "gone once the heading has built");
		assert.ok(end < CUE.end, "gone by the final frame");
	}
});

test("dark before it settles, lights once, then dark for good (no loop)", () => {
	const { CUE, tileGlow, tileGlowWindow } = load();
	for (const order of TILES) {
		const { start, peak, fallStart, end } = tileGlowWindow(order);
		for (const time of [0, start - 0.5, start - FRAME]) assert.deepEqual(tileGlow(time, order), { active: false, envelope: 0 });
		let previous = -1;
		for (let time = start; time < end; time += FRAME) {
			const { active, envelope } = tileGlow(time, order);
			assert.equal(active, true);
			if (time <= peak) assert.ok(envelope >= previous - 1e-12, "only rises while fading up");
			else if (time < fallStart) assert.equal(envelope, 1);
			else assert.ok(envelope <= previous + 1e-12, "only falls while fading out");
			previous = envelope;
		}
		assert.ok(tileGlow(start, order).envelope < 0.01 && tileGlow(end - FRAME, order).envelope < 0.05);
		for (const time of [end, end + 0.5, end + 3, CUE.end, CUE.end + 5]) assert.equal(tileGlow(time, order).active, false, "no second pass");
	}
});

test("nothing is drawn outside the windows, and at the rest frame (reduced motion)", () => {
	const { CUE, FINALE_REST_TIME, tileGlowDraws, tileGlowWindow } = load();
	assert.equal(FINALE_REST_TIME, CUE.end);
	assert.deepEqual(tileGlowDraws(FINALE_REST_TIME, SLOTS, 15, SCALE), []);
	const first = Math.min(...TILES.map((order) => tileGlowWindow(order).start));
	const last = Math.max(...TILES.map((order) => tileGlowWindow(order).end));
	assert.deepEqual(tileGlowDraws(first - FRAME, SLOTS, 15, SCALE), []);
	assert.deepEqual(tileGlowDraws(last, SLOTS, 15, SCALE), []);
	for (const order of TILES) {
		const { start, end } = tileGlowWindow(order);
		assert.ok(tileGlowDraws((start + end) / 2, SLOTS, 15, SCALE).some((draw) => draw.order === order));
		assert.ok(!tileGlowDraws(end, SLOTS, 15, SCALE).some((draw) => draw.order === order));
	}
});

test("one shared layer draws every glowing tile, each quad around its own tile", () => {
	const { TILE_GLOW, tileGlow, tileGlowDraws, tileGlowLook, tileGlowWindow } = load();
	const time = tileGlowWindow(3).start + 0.1;
	const draws = tileGlowDraws(time, SLOTS, 15, SCALE);
	assert.ok(draws.length > 1, "overlapping glows share the one canvas");
	for (const draw of draws) {
		const tile = SLOTS[draw.order];
		const pad = TILE_GLOW.pad * SCALE;
		assert.deepEqual(draw.quad, { x: tile.x - pad, y: tile.y - pad, width: tile.width + pad * 2, height: tile.height + pad * 2 });
		assert.deepEqual(draw.level, tileGlow(time, draw.order), "a pure function of the clock");
		assert.equal(draw.look, tileGlowLook(draw.order));
	}
});

/** Heat samples round the lap at `time`. */
function heatAt(glow, look, time, step = 0.002) {
	return samples((u) => glow.strokeProfile(u, time, look, PERIMETER, SCALE).heat, step);
}

/** Separated local maxima above `floor` of the hottest point. */
function peaksOf(heat, floor = 0.3, apart = 0.06) {
	const top = Math.max(...heat);
	const found = [];
	for (let index = 0; index < heat.length; index++) {
		const before = heat[(index - 1 + heat.length) % heat.length];
		const after = heat[(index + 1) % heat.length];
		if (heat[index] >= before && heat[index] > after && heat[index] > floor * top) found.push({ u: index / heat.length, value: heat[index] });
	}
	found.sort((a, b) => b.value - a.value);
	const kept = [];
	for (const peak of found) if (!kept.some((other) => Math.abs(((peak.u - other.u + 1.5) % 1) - 0.5) < apart)) kept.push(peak);
	return kept;
}

test("the border is alive while it glows: spots orbit both ways, peaks move, the profile keeps changing", () => {
	const glow = load();
	const { spotCentre, tileGlowLook, tileGlowWindow } = glow;
	const lap = (a, b) => Math.abs(((a - b + 1.5) % 1) - 0.5);
	for (const order of TILES) {
		const look = tileGlowLook(order);
		const { start, end } = tileGlowWindow(order);
		for (const spot of look.spots) {
			const moved = lap(spotCentre(spot, end), spotCentre(spot, start));
			assert.ok(moved >= 0.15, `tile ${order}: a spot travels ${moved.toFixed(2)} of the lap in the window`);
			const next = spotCentre(spot, start + 0.1);
			const direction = Math.sign(((next - spotCentre(spot, start) + 1.5) % 1) - 0.5);
			assert.equal(direction, -Math.sign(spot.speed), "clockwise speed moves the centre back along the lap");
		}
		// The whole profile changes frame to frame, and its hot peaks are displaced.
		const frames = [0, 0.25, 0.5, 0.75, 1].map((share) => heatAt(glow, look, start + (end - start) * share));
		for (let index = 1; index < frames.length; index++) {
			const [a, b] = [frames[index - 1], frames[index]];
			const change = a.reduce((sum, value, at) => sum + Math.abs(value - b[at]), 0) / a.reduce((sum, value) => sum + value, 0);
			assert.ok(change > 0.2, `tile ${order}: the profile changes by ${change.toFixed(2)} between samples`);
		}
		const tops = frames.map((heat) => peaksOf(heat)[0].u);
		const displacement = Math.max(...tops.map((u) => lap(u, tops[0])));
		assert.ok(displacement > 0.05, `tile ${order}: the hottest peak moves ${displacement.toFixed(2)} of the lap`);
	}
});

test("never a single dominant head: at every moment several hot arcs of comparable weight", () => {
	const glow = load();
	const { tileGlowLook, tileGlowWindow } = glow;
	for (const order of TILES) {
		const look = tileGlowLook(order);
		const { start, end } = tileGlowWindow(order);
		for (let time = start; time < end; time += 0.05) {
			const heat = heatAt(glow, look, time);
			const peaks = peaksOf(heat);
			const at = `tile ${order} at ${time.toFixed(2)}s`;
			assert.ok(peaks.length >= 2, `${at}: ${peaks.length} hot arcs`);
			assert.ok(peaks[1].value >= 0.4 * peaks[0].value, `${at}: runner-up ${(peaks[1].value / peaks[0].value).toFixed(2)} of the hottest`);
			// The hottest contiguous region (above 80% of the peak) stays a modest arc.
			const top = Math.max(...heat);
			let run = 0;
			let longest = 0;
			for (const value of [...heat, ...heat]) {
				run = value > 0.8 * top ? run + 1 : 0;
				longest = Math.max(longest, Math.min(run, heat.length));
			}
			assert.ok(longest / heat.length <= 0.3, `${at}: the hottest arc spans ${(longest / heat.length).toFixed(2)} of the lap`);
		}
	}
});

test("values modulate within the window: pulse, hue, whiteness, smoke", () => {
	const glow = load();
	const { strokeProfile, tileGlowLook, tileGlowPulse, tileGlowWindow } = glow;
	for (const order of TILES) {
		const look = tileGlowLook(order);
		const { start, end } = tileGlowWindow(order);
		const times = [];
		for (let time = start; time < end; time += 0.02) times.push(time);
		const beats = times.map((time) => tileGlowPulse(look, time).beat);
		const drifts = times.map((time) => tileGlowPulse(look, time).drift);
		assert.ok(Math.max(...beats) - Math.min(...beats) > 0.5, `tile ${order}: at least one heartbeat in the window`);
		assert.ok(Math.max(...drifts) - Math.min(...drifts) > 0.8, `tile ${order}: bloom and softness drift`);
		// At a fixed point on the border, colour, whiteness and smoke all change.
		const u = 0.37;
		const points = times.map((time) => strokeProfile(u, time, look, PERIMETER, SCALE));
		const hue = points.map((point) => point.color.map((channel) => channel.toFixed(2)).join());
		assert.ok(new Set(hue).size > 5, `tile ${order}: hue shifts`);
		const brightness = points.map((point) => point.brightness);
		assert.ok(Math.max(...brightness) > 2 * Math.min(...brightness), `tile ${order}: brightness changes at a fixed point`);
		const whites = times.map((time) => Math.max(...samples((v) => strokeProfile(v, time, look, PERIMETER, SCALE).white, 0.01)));
		assert.ok(Math.max(...whites) - Math.min(...whites) > 0.02, `tile ${order}: core whiteness modulates`);
	}
});

test("colour bleeds between spot colours along the stroke", () => {
	const { strokeProfile, tileGlowLook, tileGlowWindow } = load();
	const look = tileGlowLook(0);
	const time = tileGlowWindow(0).start + 0.6;
	const colours = samples((u) => strokeProfile(u, time, look, PERIMETER, SCALE).color.map((channel) => channel.toFixed(2)).join(), 0.01);
	assert.ok(new Set(colours).size > 10, "colour shifts along the ring");
	for (const u of [0, 0.25, 0.5, 0.75]) for (const channel of strokeProfile(u, time, look, PERIMETER, SCALE).color) assert.ok(channel >= 0 && channel <= 1);
});

test("the line sits just outside the tile, concentric with its corners", () => {
	const { tileGlowShape } = load();
	const tile = { x: 100, y: 50, width: 560, height: 470 };
	const shape = tileGlowShape(tile, 15, SCALE, 1.5);
	const out = (1.5 * SCALE) / 2;
	assert.deepEqual(shape.rect, { x: 100 - out, y: 50 - out, width: 560 + out * 2, height: 470 + out * 2 });
	assert.equal(shape.radius, 15 + out);
	const r = shape.radius;
	assert.ok(Math.abs(shape.length - (2 * (shape.rect.width - 2 * r) + 2 * (shape.rect.height - 2 * r) + 2 * Math.PI * r)) < 1e-9);
});

test("the perimeter parameter (Paper's angle) follows the rounded rect clockwise from just past the top-left arc", () => {
	const { perimeterParam, tileGlowShape } = load();
	const shape = tileGlowShape({ x: 0, y: 0, width: 400, height: 300 }, 20, 1, 1.5);
	const { rect, radius: r, length } = shape;
	const left = rect.x;
	const top = rect.y;
	const right = rect.x + rect.width;
	const bottom = rect.y + rect.height;
	const a = rect.width - 2 * r;
	const b = rect.height - 2 * r;
	const arc = (Math.PI * r) / 2;
	const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);

	near(perimeterParam({ x: left + r, y: top }, shape), 0, "start");
	near(perimeterParam({ x: left + r + 10, y: top - 6 }, shape), 10 / length, "outside the top edge");
	near(perimeterParam({ x: left + r + 10, y: top + 6 }, shape), 10 / length, "inside the top edge");
	near(perimeterParam({ x: right - r, y: top }, shape), a / length, "top-right arc begins");
	const diagonal = Math.SQRT1_2 * r;
	near(perimeterParam({ x: right - r + diagonal, y: top + r - diagonal }, shape), (a + arc / 2) / length, "middle of the top-right arc");
	near(perimeterParam({ x: right, y: top + r + 30 }, shape), (a + arc + 30) / length, "down the right edge");
	near(perimeterParam({ x: right - r - 30, y: bottom + 4 }, shape), (a + b + 2 * arc + 30) / length, "leftward along the bottom");
	near(perimeterParam({ x: left - 3, y: bottom - r - 30 }, shape), (2 * a + b + 3 * arc + 30) / length, "up the left edge");
	near(perimeterParam({ x: left + r - diagonal, y: top + r - diagonal }, shape), (length - arc / 2) / length, "middle of the top-left arc");
	let previous = perimeterParam({ x: rect.x + rect.width / 2, y: top - 50 }, shape);
	let wraps = 0;
	const steps = 720;
	for (let index = 1; index <= steps; index++) {
		const angle = -Math.PI / 2 + (index / steps) * Math.PI * 2;
		const s = perimeterParam({ x: rect.x + rect.width / 2 + Math.cos(angle) * 1000, y: rect.y + rect.height / 2 + Math.sin(angle) * 1000 }, shape);
		if (s < previous - 1e-9) wraps++;
		previous = s;
	}
	assert.equal(wraps, 1, "one lap, clockwise");
});

test("uniforms pack each tile's spots, zero-sizing unused slots", () => {
	const { TILE_GLOW_MAX_SPOTS, tileGlowLook, tileGlowUniforms } = load();
	for (const order of TILES) {
		const look = tileGlowLook(order);
		const uniforms = tileGlowUniforms(look, SCALE);
		assert.equal(tileGlowUniforms(look, SCALE), uniforms, "cached per tile and scale");
		for (const key of ["spotA", "spotB", "spotC", "spotD"]) assert.equal(uniforms[key].length, TILE_GLOW_MAX_SPOTS * 4);
		look.spots.forEach((spot, index) => {
			assert.ok(Math.abs(uniforms.spotA[index * 4] - spot.speed) < 1e-6);
			assert.ok(Math.abs(uniforms.spotA[index * 4 + 2] - spot.size) < 1e-6);
		});
		for (let index = look.spots.length; index < TILE_GLOW_MAX_SPOTS; index++) assert.equal(uniforms.spotA[index * 4 + 2], 0, "unused spots are off");
		assert.ok(Math.abs(uniforms.look[0] - look.lineWidth * SCALE) < 1e-9);
		assert.ok(Math.abs(uniforms.look[1] - look.bloom * SCALE) < 1e-9);
	}
});

test("the shader mirrors Paper's dynamics on the finale clock", () => {
	const { TILE_GLOW, TILE_GLOW_FRAGMENT } = load();
	assert.deepEqual([...TILE_GLOW.colors], ["#1868DB", "#AF59E1", "#FCA700", "#6A9A23"]);
	assert.match(TILE_GLOW_FRAGMENT, /float perimeterParam\(vec2 l, vec2 h, float r\)/);
	assert.match(TILE_GLOW_FRAGMENT, /atan\(v\.x, -v\.y\)/, "clockwise angle from 'up'");
	assert.match(TILE_GLOW_FRAGMENT, /uniform float uTime;/, "driven by the clock");
	assert.match(TILE_GLOW_FRAGMENT, /float spotAt = fract\(0\.5 - a4\.x \* time - a4\.y\);/, "spots orbit, as spotCentre()");
	assert.match(TILE_GLOW_FRAGMENT, /smoothstep\(0\.5 - size, 0\.5, at\) \* \(1\.0 - smoothstep\(0\.5, 0\.5 \+ size, at\)\)/, "Paper's sector shape");
	assert.match(TILE_GLOW_FRAGMENT, /noise1\(2\.7 \* x \+ 0\.5 \* t\).*noise1\(3\.4 \* x - 0\.5 \* t\)/, "Paper's smoke scroll");
	assert.match(TILE_GLOW_FRAGMENT, /float heat = mix\(blend, min\(add, 1\.5\), uLook3\.x\);/, "Paper's blend-vs-add bloom");
	assert.doesNotMatch(TILE_GLOW_FRAGMENT, /uTrace|drawn/, "no traced head");
	assert.doesNotMatch(TILE_GLOW_FRAGMENT, /\$\{/);
});
