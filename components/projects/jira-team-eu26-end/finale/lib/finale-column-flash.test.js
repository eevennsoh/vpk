const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-column-flash";
export { CUE } from "../data/finale-cues";
export { finaleCameraRig, identityRig } from "./finale-camera";
export { cardPose, cardVelocity } from "./finale-card-motion";
export { boardExitSlideOpacity } from "./finale-board-exit";
export { finaleBentoLayout } from "../data/finale-stories";
export { finaleStageFit } from "./finale-stage-fit";
`;

let flash;
function load() {
	flash ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-column-flash-harness.cjs");
	return flash;
}

const COLUMN = { x: 1445.5, y: 237, width: 450.5, height: 821 };
const FRAME = 1 / 120;

function span() {
	const { flashWindow } = load();
	const { start, end } = flashWindow();
	const times = [];
	for (let time = start; time <= end; time += FRAME) times.push(time);
	return times;
}

const ZERO = { cover: 0, feather: 0, dx: 0, dy: 0, blur: 0, lift: 0, darken: 0, halo: 0, fringe: 0, chroma: 0 };

function grid(step = 11, pad = 60) {
	const points = [];
	for (let x = COLUMN.x - pad; x <= COLUMN.x + COLUMN.width + pad; x += step) {
		for (let y = COLUMN.y - pad; y <= COLUMN.y + COLUMN.height + pad; y += step) points.push([x, y]);
	}
	return points;
}

test("the flash sits between the board hand-off and the toss, paced like the refs", () => {
	const { CUE, FLASH_TIMING, flashCornerRadius, flashIgnition, flashRadius, flashWindow } = load();
	const { start, end } = flashWindow();
	const h = COLUMN.height;
	assert.ok(CUE.hit < start && end <= CUE.burst, "frame 0 is the board; spent by the toss");
	assert.ok(FLASH_TIMING.anticipation >= 0.15 && FLASH_TIMING.anticipation <= 0.3, "A. a brief anticipation");
	const ignition = flashIgnition();
	assert.ok(flashRadius(ignition + 0.12, COLUMN) >= 0.3 * h, "B. the flood covers ~a third of the column within ~0.1s");
	let reach = null;
	for (let time = ignition; time <= end; time += 1 / 240) {
		if (flashRadius(time, COLUMN) >= flashCornerRadius(COLUMN)) {
			reach = time - ignition;
			break;
		}
	}
	assert.ok(reach !== null && reach >= 0.6 && reach <= 1, `D. the front crosses the column in ${reach?.toFixed(2)}s`);
	// It decelerates: speed falls monotonically from the flood to the travel.
	let previous = Infinity;
	for (let time = ignition + 0.01; time < end; time += 0.02) {
		const speed = (flashRadius(time + 0.005, COLUMN) - flashRadius(time - 0.005, COLUMN)) / 0.01;
		assert.ok(speed <= previous + 1e-6, `slows at ${time.toFixed(2)}s`);
		previous = speed;
	}
});

test("the flash is fully spent by the toss: nothing of it overlaps the grey slide", () => {
	const { CUE, boardExitSlideOpacity, flashIntensity, flashLook, flashVisible, flashWindow } = load();
	assert.ok(CUE.flash + CUE.flashDuration <= CUE.burst, "the window ends by the toss");
	assert.ok(flashWindow().end <= CUE.burst);
	assert.equal(flashIntensity(CUE.burst), 0);
	assert.equal(flashVisible(CUE.burst), false);
	for (let time = 0; time <= CUE.burst + 0.8; time += 1 / 240) {
		if (boardExitSlideOpacity(time) > 0) {
			assert.equal(flashVisible(time), false, `nothing over the slide at ${time.toFixed(4)}s`);
			assert.deepEqual(flashLook(time, COLUMN.x + 200, COLUMN.y + 40, COLUMN), ZERO);
		}
	}
	assert.ok(flashVisible(CUE.burst - 0.05), "still fading out on the live board just before the toss");
});

test("the flash is exactly dark on frame 0 and once its window has passed", () => {
	const { CUE, flashIntensity, flashLook, flashWindow } = load();
	const { start, end } = flashWindow();
	for (const time of [0, start, end, end + 0.01, CUE.burst + 1, CUE.end]) {
		assert.equal(flashIntensity(time), 0, `intensity at ${time}s`);
		for (const [x, y] of grid(97)) assert.deepEqual(flashLook(time, x, y, COLUMN), ZERO, `untouched at ${time}s`);
	}
	const peak = Math.max(...span().map(flashIntensity));
	assert.ok(peak > 0.95 && peak <= 1);
});

test("ahead of the front nothing changes, except the brief anticipation haze at the source", () => {
	const { FLASH_SHAPE, flashDistance, flashHazeAmount, flashIgnition, flashLook, flashSource } = load();
	const source = flashSource(COLUMN);
	const haze = FLASH_SHAPE.haze * COLUMN.height;
	let ahead = 0;
	let hazed = 0;
	for (const time of span()) {
		for (const [x, y] of grid(13)) {
			if (flashDistance(time, x, y, COLUMN) >= 0) continue;
			const look = flashLook(time, x, y, COLUMN);
			if (Math.hypot(x - source.x, y - source.y) >= haze) {
				assert.deepEqual(look, ZERO, `untouched ahead at ${time.toFixed(3)}s (${x}, ${y})`);
				ahead += 1;
			} else if (look.cover > 0) {
				hazed += 1;
				assert.ok(flashHazeAmount(time) > 0 && time < flashIgnition() + 0.12, "the haze only gathers before and just after ignition");
				assert.ok(Math.hypot(look.dx, look.dy) <= 3 && look.blur === 0 && look.lift === 0, "a gentle wobble, nothing more");
			}
		}
	}
	assert.ok(ahead > 10000 && hazed > 20);
});

test("the stages read like the refs: flood, hollowing ring over a dark lens, a dimming, widening band", () => {
	const { flashCoreWidth, flashEnergy, flashIgnition, flashLook, flashRadius, flashSource } = load();
	const source = flashSource(COLUMN);
	const at = (time, d) => flashLook(time, source.x, source.y - (flashRadius(time, COLUMN) - d), COLUMN);
	const ignition = flashIgnition();
	// B. Early, the whole disc is glare.
	const flood = ignition + 0.06;
	assert.ok(at(flood, flashRadius(flood, COLUMN) * 0.8).lift > 0.8, "flooded into glare near the source");
	// C. Later the core is a ring: behind it the content returns, darkened and carried outward.
	const ring = ignition + 0.2;
	const radius = flashRadius(ring, COLUMN);
	const coreEnd = 0.065 * COLUMN.height + flashCoreWidth(radius, COLUMN);
	const lens = at(ring, coreEnd + 20);
	assert.ok(lens.lift < 0.3 && lens.darken > 0.08 && Math.hypot(lens.dx, lens.dy) > 10, "a dark, magnified lens behind the ring");
	assert.ok(at(ring, coreEnd * 0.6).lift > 0.6, "the ring itself still glares");
	// D. Energy falls: the core narrows and dims, the halos grow.
	const late = ignition + 0.6;
	assert.ok(flashEnergy(flashRadius(late, COLUMN), COLUMN) < flashEnergy(radius, COLUMN));
	assert.ok(flashCoreWidth(flashRadius(late, COLUMN), COLUMN) < flashCoreWidth(radius, COLUMN));
	const lateCore = at(late, 0.065 * COLUMN.height + 10);
	assert.ok(lateCore.lift < at(ring, coreEnd * 0.6).lift, "the glare dims");
	assert.ok(lateCore.halo > at(ring, coreEnd * 0.6).halo, "E. highlights flare more on the far, broad band");
});

test("the refraction bends content outward like a fisheye, is bounded and never folds", () => {
	const { FLASH_SHAPE, flashIgnition, flashLook, flashSource } = load();
	const source = flashSource(COLUMN);
	const cap = FLASH_SHAPE.lensMax * COLUMN.height;
	for (const offset of [0.08, 0.2, 0.4, 0.7]) {
		const time = flashIgnition() + offset;
		for (const angle of [-0.25, 0, 0.3]) {
			// Along a ray from the source, the sampled radius (r − carry) must keep increasing.
			let previous = -Infinity;
			for (let r = 2; r < COLUMN.height * 1.1; r += 0.5) {
				const x = source.x + Math.sin(angle) * r;
				const y = source.y - Math.cos(angle) * r;
				const look = flashLook(time, x, y, COLUMN);
				const carry = Math.hypot(look.dx, look.dy);
				assert.ok(carry <= cap + 1e-9, "bounded");
				const sampled = r - carry;
				assert.ok(sampled > previous, `no fold at r=${r} (t+${offset})`);
				previous = sampled;
			}
		}
	}
});

test("blur and glare are band-local and brief: each point is itself again within half a second", () => {
	const { FLASH_LOOK, flashDistance, flashLook, flashWindow } = load();
	const { start, end } = flashWindow();
	for (const [x, y] of [[COLUMN.x + 225, COLUMN.y + 700], [COLUMN.x + 60, COLUMN.y + 420], [COLUMN.x + 400, COLUMN.y + 60]]) {
		let arrival = null;
		let blurred = 0;
		let lastActive = null;
		for (let time = start; time <= end; time += 1 / 500) {
			const look = flashLook(time, x, y, COLUMN);
			assert.ok(look.blur <= FLASH_LOOK.blur + 1e-9, "never more than a few px of blur");
			if (arrival === null && flashDistance(time, x, y, COLUMN) >= 0) arrival = time;
			if (look.blur > 0.5) blurred += 1 / 500;
			if (look.cover > 0) lastActive = time;
		}
		assert.ok(arrival !== null && lastActive !== null);
		assert.ok(blurred <= 0.35, `(${x}, ${y}) blurred for ${blurred.toFixed(2)}s`);
		assert.ok(lastActive - arrival <= 0.5, `(${x}, ${y}) back to itself ${(lastActive - arrival).toFixed(2)}s after the front`);
	}
});

test("past the column only the light carries on, behind the front, and it is exactly gone by glowCut px", () => {
	const { FLASH_SHAPE, flashDistance, flashInset, flashLook } = load();
	let lit = 0;
	for (const time of span()) {
		for (const [x, y] of grid(9, 100)) {
			const inset = flashInset(x, y, COLUMN);
			if (inset >= 0) continue;
			const look = flashLook(time, x, y, COLUMN);
			assert.deepEqual({ ...look, lift: 0, darken: 0, fringe: 0 }, ZERO, `no content outside the column at ${time.toFixed(3)}s`);
			const light = look.lift + look.darken + look.fringe;
			if (-inset >= FLASH_SHAPE.glowCut) assert.equal(light, 0, "the rest of the board is untouched");
			if (light > 0) {
				lit += 1;
				assert.ok(flashDistance(time, x, y, COLUMN) >= 0, "never ahead of the front");
			}
		}
	}
	assert.ok(lit > 100, "the light does spill past the column");
});

test("no hard edge at the column's bounds: content eases out and the light is continuous across the edge", () => {
	const { FLASH_SHAPE, flashIgnition, flashLook } = load();
	// What the eye sees of the glare: the content's share plus the overlay's share.
	const seen = (look) => look.lift * look.cover + look.lift * (1 - look.cover);
	for (const offset of [0.12, 0.3, 0.55]) {
		const time = flashIgnition() + offset;
		for (const y of [COLUMN.y + COLUMN.height * 0.5, COLUMN.y + COLUMN.height * 0.8, COLUMN.y + COLUMN.height * 0.95]) {
			let previous = null;
			for (let x = COLUMN.x + COLUMN.width + FLASH_SHAPE.glowCut + 10; x >= COLUMN.x + COLUMN.width - 60; x -= 0.5) {
				const look = flashLook(time, x, y, COLUMN);
				if (previous) {
					// Alpha ramps are ≥ 8px wide (and only where the print is undistorted).
					assert.ok(Math.abs(look.cover - previous.cover) <= 0.1, `content eases in at x=${x} (t+${offset})`);
					assert.ok(Math.abs(seen(look) - seen(previous)) <= 0.05, `light is continuous at x=${x} (t+${offset}, y=${y.toFixed(0)})`);
				}
				previous = look;
			}
			const deep = flashLook(time, COLUMN.x + COLUMN.width - FLASH_SHAPE.feather - 1, y, COLUMN);
			const clearOfEnds = y - COLUMN.y > FLASH_SHAPE.feather && COLUMN.y + COLUMN.height - y > FLASH_SHAPE.feather;
			if (clearOfEnds && deep.cover > 0) assert.equal(deep.feather, 1, "full strength once inside the feather");
		}
	}
	assert.ok(FLASH_SHAPE.feather >= 12 && FLASH_SHAPE.glowCut <= 90, "a soft edge, tens of px of spill");
});

test("every card sheet holds its exact rest pose through the flash", () => {
	const { CUE, cardPose, cardVelocity, finaleBentoLayout } = load();
	const viewport = { width: 1920, height: 1080 };
	const slots = finaleBentoLayout(viewport, 1).slots;
	const rect = { x: 1445.5, y: 280, width: 434, height: 196 };
	const roles = [{ kind: "hero", slot: slots[0].rect }, { kind: "tile", order: 2, slot: slots[2].rect }, { kind: "extra" }];
	for (const [index, role] of roles.entries()) {
		const input = { rect, fieldIndex: index, fieldCount: 13, burstIndex: index, role };
		const rest = cardPose(0, input, viewport);
		for (let time = 0; time < CUE.burst; time += 1 / 240) {
			assert.deepEqual(cardPose(time, input, viewport), rest, `${role.kind} at rest at ${time.toFixed(4)}s`);
			const velocity = cardVelocity(time, input, viewport, rect);
			assert.ok(velocity.weight === 0 && Math.hypot(velocity.x, velocity.y, velocity.z) < 1e-9, `${role.kind} feels no air at ${time.toFixed(4)}s`);
		}
		assert.equal(rest.x, rect.x + rect.width / 2);
		assert.equal(rest.lift, 0);
		assert.equal(rest.clip, 1, "clipped by the column like the DOM");
	}
	const echo = { rect, fieldIndex: 0, fieldCount: 26, burstIndex: 0, role: { kind: "echo" } };
	for (let time = 0; time < CUE.burst; time += 1 / 60) assert.equal(cardPose(time, echo, viewport).opacity, 0, "the deep-field echoes are not there yet");
});

test("never a partial blend of a distorted print: wherever it is displaced, blurred, split or haloed it is opaque", () => {
	const { CUE, finaleCardSheetsShown, flashLook } = load();
	let distorted = 0;
	let fading = 0;
	for (const time of span()) {
		for (const [x, y] of grid(5, 0)) {
			const look = flashLook(time, x, y, COLUMN);
			const moved = Math.hypot(look.dx, look.dy) > 0.5 || look.blur > 0.5 || look.chroma > 0.5 || look.halo > 0.02;
			if (moved) {
				distorted += 1;
				assert.ok(look.cover >= 0.98, `opaque where distorted at ${time.toFixed(3)}s (${x}, ${y}): cover ${look.cover.toFixed(3)}`);
			}
			if (look.cover > 0 && look.cover < 0.98) {
				fading += 1;
				assert.ok(Math.hypot(look.dx, look.dy) <= 0.5 && look.blur <= 0.5 && look.chroma <= 0.5 && look.halo <= 0.02, "it fades only where it is undistorted");
			}
		}
	}
	assert.ok(distorted > 5000 && fading > 100);
	for (let time = 0; time < CUE.burst; time += 1 / 120) assert.equal(finaleCardSheetsShown(time), false, `the GL sheets stay hidden at ${time.toFixed(3)}s`);
	assert.equal(finaleCardSheetsShown(CUE.burst), true, "and take over exactly at the toss");
});

test("distortion eases in over a wide band from every boundary, after the alpha has settled", () => {
	const { FLASH_SHAPE, flashIgnition, flashLook, flashSource } = load();
	const time = flashIgnition() + 0.45;
	const y = COLUMN.y + COLUMN.height * 0.45;
	// From the column's left edge inwards: alpha settles within `feather`, distortion only begins at `distortionInset`.
	let firstMoved = null;
	for (let inset = 0; inset < 160; inset += 0.5) {
		const look = flashLook(time, COLUMN.x + inset, y, COLUMN);
		if (firstMoved === null && (Math.hypot(look.dx, look.dy) > 0.01 || look.blur > 0.01)) firstMoved = inset;
		if (inset >= FLASH_SHAPE.feather && look.cover > 0) assert.ok(look.feather === 1);
	}
	assert.ok(firstMoved !== null && firstMoved >= FLASH_SHAPE.distortionInset, `distortion starts ${firstMoved}px in, past the ${FLASH_SHAPE.feather}px alpha margin`);
	// Behind the front along the axis: opaque by `frontFade`, distortion only past `distortionFront`.
	const source = flashSource(COLUMN);
	const look = (d) => flashLook(time, source.x, source.y - (load().flashRadius(time, COLUMN) - d), COLUMN);
	assert.ok(look(FLASH_SHAPE.frontFade).cover >= 0.98);
	assert.ok(Math.hypot(look(FLASH_SHAPE.distortionFront - 1).dx, look(FLASH_SHAPE.distortionFront - 1).dy) === 0 && look(FLASH_SHAPE.distortionFront - 1).blur === 0);
});

test("floating chrome over the column (the Rovo FAB) stays on top: the pass leaves it untouched", () => {
	const { flashOcclusion } = load();
	const fab = { x: 1850, y: 1030, width: 40, height: 40, radius: 12 };
	assert.equal(flashOcclusion(1870, 1050, [fab]), 0, "transparent over the FAB");
	assert.equal(flashOcclusion(1851, 1031, [fab]), 1, "the rounded corner is not masked");
	assert.equal(flashOcclusion(1840, 1050, [fab]), 1, "untouched beside it");
	assert.equal(flashOcclusion(1870, 1050, []), 1);
	let previous = flashOcclusion(1830, 1050, [fab]);
	for (let x = 1830; x <= 1860; x += 0.25) {
		const value = flashOcclusion(x, 1050, [fab]);
		assert.ok(Math.abs(value - previous) <= 0.2, "a soft 2px rim, no aliasing");
		previous = value;
	}
});

test("the dome has no hard rim: its shade and glare are continuous through the ring", () => {
	const { flashIgnition, flashLook, flashSource } = load();
	const source = flashSource(COLUMN);
	for (const offset of [0.15, 0.3, 0.5]) {
		const time = flashIgnition() + offset;
		let previous = null;
		for (let y = source.y - 2; y > COLUMN.y + 60; y -= 0.5) {
			const look = flashLook(time, source.x, y, COLUMN);
			if (previous) {
				assert.ok(Math.abs(look.darken - previous.darken) <= 0.01, `shade continuous at y=${y} (t+${offset})`);
				assert.ok(Math.abs(look.lift - previous.lift) <= 0.04, `glare continuous at y=${y} (t+${offset})`);
			}
			previous = look;
		}
	}
});

test("the GL layers fit the live window from the first frame (no stand-in stage size)", () => {
	const { finaleStageFit } = load();
	// The user's setup: a ~1760 px window. The fit must carry the window itself, not the 1920×1080 stage.
	const fit = finaleStageFit(1760, 1100);
	assert.equal(fit.width, 1760);
	assert.equal(fit.height, 1100);
	assert.ok(Math.abs(fit.scale - 1760 / 1920) < 1e-12 && fit.x === 0 && fit.y > 0, "the stage letterboxes into the window");
	assert.deepEqual(finaleStageFit(1920, 1080), { scale: 1, x: 0, y: 0, width: 1920, height: 1080 });
});

test("the camera holds at rest through the flash", () => {
	const { CUE, finaleCameraRig, identityRig, flashWindow } = load();
	const viewport = { width: 1920, height: 1080 };
	const subject = { x: 0, y: 0, width: 436, height: 199 };
	const rest = identityRig(viewport);
	for (let time = 0; time <= flashWindow().end; time += 1 / 60) {
		const rig = finaleCameraRig(time, viewport, subject);
		assert.ok(Math.abs(rig.position.z - rest.position.z) < 1e-6 && Math.abs(rig.position.x) < 1e-6 && rig.roll === 0, `camera at rest at ${time.toFixed(2)}s`);
	}
	assert.ok(CUE.burst + 0.2 > flashWindow().end);
});

test("the shader chunks are the same field, with the Rovo palette baked in", () => {
	const { FLASH_GLSL, FLASH_PASS_GLSL, FLASH_ROVO_COLORS, FLASH_SHAPE, flashCoreWidth, flashEnergy, flashHazeAmount, flashIntensity, flashRadius, flashRingUniforms, flashTravel, flashUniforms } = load();
	for (const name of ["uniform vec4 uFlashColumn", "uniform vec3 uFlashState", "uniform vec4 uFlashRing", "struct FlashLook", "FlashLook flashLook(vec2 p)", "vec3 flashColor(float s)"]) {
		assert.ok(FLASH_GLSL.includes(name), `declares ${name}`);
	}
	assert.ok(FLASH_GLSL.includes("if (!inside || hazeAmount <= 0.0 || dist >= hazeRadius) return look;"), "zero ahead of the front in GLSL too");
	assert.ok(FLASH_PASS_GLSL.includes("vec4 flashPass(vec2 p)") && FLASH_PASS_GLSL.includes("uniform sampler2D uPrint"));
	for (const chunk of [FLASH_GLSL, FLASH_PASS_GLSL]) assert.ok(!/\b(half|sample|filter|input|output)\b\s*[=;(]/u.test(chunk), "avoids GLSL reserved words");
	assert.ok(FLASH_GLSL.includes(String(FLASH_SHAPE.lens)) && FLASH_GLSL.includes(String(FLASH_SHAPE.edge)));
	assert.deepEqual(FLASH_ROVO_COLORS, ["#1868DB", "#AF59E1", "#FCA700", "#6A9A23"]);
	const time = 0.6;
	const radius = flashRadius(time, COLUMN);
	assert.deepEqual(flashUniforms(time, COLUMN), { column: [COLUMN.x, COLUMN.y, COLUMN.width, COLUMN.height], state: [radius, flashIntensity(time), time] });
	assert.deepEqual(flashRingUniforms(time, COLUMN), [flashHazeAmount(time), flashEnergy(radius, COLUMN), flashCoreWidth(radius, COLUMN), flashTravel(radius, COLUMN)]);
});
