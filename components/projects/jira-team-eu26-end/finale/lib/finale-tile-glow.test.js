const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const ENTRY = `
export * from "./finale-tile-glow";
export { tileRevealStart, touchdownTime } from "./finale-card-motion";
export { CUE, FINALE_REST_TIME } from "../data/finale-cues";
export { landingSettled } from "./finale-wall-motion";
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

/* ─── The mega bento's landings ───────────────────────────────────────── */

/** The wall's tiles are smaller: their bloom and smoke shrink with them; the hairline does not. */
const WALL_SCALE = 0.3;
const STROKE = SCALE;
const LANDING = { x: 300, y: 120, width: 180, height: 160 };

test("a bento tile glows in its gap exactly as it did on the slide, from its own touchdown", () => {
	const { landingGlowTime, landingSettled, tileGlow, tileGlowClock, tileGlowFor, tileGlowWindow, tileGlowWindowFor, touchdownTime } = load();
	for (const order of TILES) {
		const touchdown = 12.345 + order * 0.21;
		const shift = touchdown - touchdownTime(order);
		const slide = tileGlowWindow(order);
		const wall = tileGlowWindowFor(touchdown, landingSettled(touchdown), order);
		for (const key of ["start", "peak", "fallStart", "end"]) assert.ok(Math.abs(wall[key] - slide[key] - shift) < 1e-9, `tile ${order}: ${key} as on the slide, after its own touchdown`);
		for (let time = wall.start - 0.1; time < wall.end + 0.1; time += FRAME * 3) {
			const replay = landingGlowTime(time, touchdown, order);
			assert.ok(Math.abs(replay - (time - shift)) < 1e-9, "it replays the slide's moment");
			assert.ok(Math.abs(tileGlowClock(replay) - tileGlowClock(time - shift)) < 1e-9, "with the slide's motion");
			if (Math.min(Math.abs(time - wall.start), Math.abs(time - wall.end)) < 1e-6) continue;
			const now = tileGlowFor(time, touchdown, landingSettled(touchdown), order);
			const then = tileGlow(time - shift, order);
			assert.equal(now.active, then.active);
			assert.ok(Math.abs(now.envelope - then.envelope) < 1e-6, `tile ${order}: the slide's envelope`);
		}
	}
});

test("every card replays one of the six glows, from its own touchdown until its content has built", () => {
	const { TILE_GLOW, glowOrder, landingSettled, tileGlowFor, tileGlowLook, tileGlowWindowFor } = load();
	assert.deepEqual(TILES.map(glowOrder), TILES, "the bento's own tiles replay their own");
	assert.ok(TILES.includes(glowOrder(6)), "the title (order 6) replays one of the six");
	const seeds = [];
	for (let seed = -60; seed < 480; seed += 1) seeds.push(seed);
	const orders = seeds.map(glowOrder);
	for (const order of orders) assert.ok(TILES.includes(order), "one of the six");
	assert.deepEqual(seeds.map(glowOrder), orders, "deterministic");
	for (const order of TILES) assert.ok(orders.filter((each) => each === order).length > seeds.length * 0.1, `the stream draws on glow ${order}`);
	assert.ok(TILES.includes(glowOrder(2.5)) && TILES.includes(glowOrder(-7.25)), "any seed");
	for (const seed of seeds.filter((_, index) => index % 9 === 0)) {
		const touchdown = 40 + seed * 0.13;
		const settled = landingSettled(touchdown);
		const { start, peak, fallStart, end } = tileGlowWindowFor(touchdown, settled, seed);
		assert.ok(start >= touchdown + TILE_GLOW.settle && start <= touchdown + TILE_GLOW.settle + TILE_GLOW.delay[1], "starts once settled");
		assert.ok(start < peak && peak < fallStart && fallStart < end, "rise, alive, fall");
		assert.ok(Math.abs(end - start - tileGlowLook(glowOrder(seed)).duration) < 1e-9, "its glow's own duration (not clamped)");
		assert.ok(end <= settled + 1e-9, "gone once its content has built");
		for (const time of [touchdown - 1, touchdown, start - FRAME, end, settled, settled + 1]) assert.deepEqual(tileGlowFor(time, touchdown, settled, seed), { active: false, envelope: 0 });
		assert.equal(tileGlowFor((peak + fallStart) / 2, touchdown, settled, seed).envelope, 1);
	}
	const never = Number.NEGATIVE_INFINITY;
	for (const time of [0, 10, 1000]) assert.equal(tileGlowFor(time, never, landingSettled(never), 7).active, false, "a card that was down before the wall faded in never glows");
});

test("the wall's glows: only landings in their windows, each around its rect this frame, the hairline at the stroke scale", () => {
	const { TILE_GLOW, glowOrder, landingGlowDraws, landingGlowTime, landingSettled, tileGlowClock, tileGlowFor, tileGlowLook, tileGlowShape } = load();
	const landings = [
		{ rect: LANDING, touchdown: 30, seed: 2 },
		{ rect: { ...LANDING, x: 520 }, touchdown: 30.4, seed: 137 },
		// Already down when the wall faded in, and long settled.
		{ rect: { ...LANDING, x: 740 }, touchdown: Number.NEGATIVE_INFINITY, seed: 9 },
		{ rect: { ...LANDING, x: 960 }, touchdown: 26, seed: 4 },
		// Not yet settled from its touchdown.
		{ rect: { ...LANDING, x: 1180 }, touchdown: 30.8, seed: 5 },
	];
	const radius = 8;
	const time = 30.9;
	const draws = landingGlowDraws(time, landings, radius, WALL_SCALE, STROKE);
	assert.deepEqual(draws.map((draw) => draw.order), [2, glowOrder(137)]);
	draws.forEach((draw, index) => {
		const { rect, touchdown, seed } = landings[index];
		const pad = TILE_GLOW.pad * WALL_SCALE;
		assert.deepEqual(draw.quad, { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }, "the overhang shrinks with the tile");
		assert.deepEqual(draw.shape, tileGlowShape(rect, radius, STROKE, draw.look.lineWidth), "the hairline at the stroke scale");
		assert.equal(draw.look, tileGlowLook(draw.order));
		assert.deepEqual(draw.level, tileGlowFor(time, touchdown, landingSettled(touchdown), seed));
		assert.equal(draw.clock, tileGlowClock(landingGlowTime(time, touchdown, seed)));
	});
	// The wall carries the card: the next frame's rect moves its quad, nothing else.
	const moved = landingGlowDraws(time, [{ ...landings[0], rect: { ...LANDING, x: LANDING.x - 7 } }], radius, WALL_SCALE, STROKE)[0];
	assert.equal(moved.quad.x, draws[0].quad.x - 7);
	assert.deepEqual(moved.level, draws[0].level);
	const idle = landingGlowDraws(time, [], radius, WALL_SCALE, STROKE);
	assert.equal(idle.length, 0);
	assert.equal(landingGlowDraws(100, landings, radius, WALL_SCALE, STROKE), idle, "idle frames share one empty list");
	assert.equal(landingGlowDraws(time, landings, radius, WALL_SCALE)[0].shape.rect.x, LANDING.x - (draws[0].look.lineWidth * WALL_SCALE) / 2, "the stroke is the tile's scale unless set");
});

test("uniforms size the hairline by the stroke scale and the bloom and smoke by the tile's", () => {
	const { tileGlowLook, tileGlowUniforms } = load();
	for (const order of TILES) {
		const look = tileGlowLook(order);
		const uniforms = tileGlowUniforms(look, WALL_SCALE, STROKE);
		assert.equal(tileGlowUniforms(look, WALL_SCALE, STROKE), uniforms, "cached per tile and scales");
		assert.notEqual(tileGlowUniforms(look, WALL_SCALE), uniforms);
		assert.equal(tileGlowUniforms(look, SCALE, SCALE), tileGlowUniforms(look, SCALE), "on the slide the stroke is the scale");
		assert.ok(Math.abs(uniforms.look[0] - look.lineWidth * STROKE) < 1e-9);
		assert.ok(Math.abs(uniforms.look[1] - look.bloom * WALL_SCALE) < 1e-9);
		assert.ok(Math.abs(uniforms.look2[0] - look.smokeSize * WALL_SCALE) < 1e-9);
	}
});

const WALL_ENTRY = `
export { finaleBentoLayout, selectFinaleFeatures } from "../data/finale-stories";
export { buildFinaleWall, wallGeometry } from "./finale-wall-layout";
export { bentoDrops, wallCursorsAt } from "./finale-wall-motion";
export { FINALE_CURSORS } from "./finale-cursor-path";
`;

let wallModule;
function loadWall() {
	wallModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: WALL_ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-accents-harness.cjs");
	return wallModule;
}

/** The accents under a frame registry the test drives, as the overlay's clock does. */
const ACCENTS_HARNESS = `
import { useMemo } from "react";
import { FinaleWallAccents } from "@/components/projects/jira-team-eu26-end/finale/components/finale-wall-accents";
import { FinaleFrameContext, createFinaleFrameRegistry } from "@/components/projects/jira-team-eu26-end/finale/hooks/use-finale-frame";

export default function Harness(props) {
	const registry = useMemo(() => createFinaleFrameRegistry(), []);
	globalThis.__emitFinaleFrame = registry.emit;
	return <FinaleFrameContext value={registry}><FinaleWallAccents {...props} /></FinaleFrameContext>;
}
`;

test("the wall's accents mount nothing until the wall exists (never on the rest frame), then paint a held frame at once", async () => {
	const { CUE, FINALE_REST_TIME } = load();
	const { FINALE_CURSORS, bentoDrops, buildFinaleWall, finaleBentoLayout, selectFinaleFeatures, wallCursorsAt, wallGeometry } = loadWall();
	const viewport = { width: 1920, height: 1080 };
	const fit = { scale: 1, x: 0, y: 0 };
	const bento = finaleBentoLayout(viewport, fit.scale);
	const wall = buildFinaleWall(wallGeometry(bento, fit.scale, viewport), bento, selectFinaleFeatures([]), []);
	const drops = bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	const view = await renderComponent({ source: ACCENTS_HARNESS, props: { wall, drops, fit, viewport } });
	const emit = (time) => React.act(async () => {
		globalThis.__emitFinaleFrame(time);
	});
	const mounted = () => ({ canvases: view.container.querySelectorAll("canvas").length, cursors: view.container.querySelectorAll("[data-finale-cursor]").length });
	const shown = () => [...view.container.querySelectorAll("[data-finale-cursor]")].filter((element) => element.style.visibility === "visible").map((element) => element.getAttribute("data-finale-cursor")).sort();

	for (const time of [CUE.end - 1, FINALE_REST_TIME]) {
		await emit(time);
		assert.deepEqual(mounted(), { canvases: 0, cursors: 0 }, `nothing at ${time.toFixed(2)}s`);
	}
	let held = null;
	for (let time = CUE.end; time < CUE.end + 60 && !held; time += 0.05) {
		const cursors = wallCursorsAt(time, wall, viewport);
		if (cursors.some((cursor) => cursor.opacity > 0.99)) held = { time, cursors };
	}
	assert.ok(held, "a teammate sets a card down");
	// One reading, then the clock holds: the layers that mount on it paint it without another.
	await emit(held.time);
	assert.deepEqual(mounted(), { canvases: 2, cursors: FINALE_CURSORS.length });
	assert.deepEqual(shown(), held.cursors.filter((cursor) => cursor.opacity > 0).map((cursor) => cursor.name).sort(), "the teammates holding cards, by name, and only they");
	await emit(FINALE_REST_TIME);
	assert.deepEqual(mounted(), { canvases: 0, cursors: 0 }, "seeking back before the wall takes it down");
});
