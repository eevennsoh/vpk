const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export * from "./finale-shape-morph";
export { titleGrabTime, titleHeldTime } from "./finale-title-drag";
export { cameraDistance, tileRevealStart } from "./finale-card-motion";
export { CUE, FINALE_REST_TIME, WALL_CUE } from "../data/finale-cues";
export { FINALE_STORIES, finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
`;

let motionModule;
function load() {
	motionModule ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "finale-wall-motion-harness.cjs");
	return motionModule;
}

const VIEWPORTS = [
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
	{ width: 1024, height: 768 },
];

function sceneFor(viewport, dragOrder = []) {
	const m = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = m.finaleBentoLayout(viewport, scale);
	const features = m.FINALE_FEATURES;
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, features, dragOrder);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	return { m, viewport, scale, bento, features, geometry, wall, drops };
}

/** Arriving slots (not on the wall when it appears) of a column, with their descents. */
function arrivals(m, wall, column) {
	return wall.bucket(column).filter((slot) => slot.reserved === undefined).map((slot) => ({ slot, descent: m.slotDescent(slot, wall) })).filter((each) => each.descent);
}

function firstArrivingColumn(m, wall) {
	for (let column = 0; column < 60; column += 1) if (arrivals(m, wall, column).length >= 3) return column;
	throw new Error("no arrivals");
}

const close = (a, b, epsilon = 1e-6) => Math.abs(a - b) < epsilon;
/** Where a pose is seen: the GL camera looks down on the wall's plane (z = 0) from `cameraDistance`. */
function seen(m, pose, viewport) {
	const scale = m.cameraDistance(viewport) / (m.cameraDistance(viewport) - pose.z);
	return {
		x: viewport.width / 2 + (pose.x - viewport.width / 2) * scale,
		y: viewport.height / 2 + (pose.y - viewport.height / 2) * scale,
		width: pose.width * scale,
		height: pose.height * scale,
	};
}
const turned = (pose) => Math.max(Math.abs(pose.rotateX), Math.abs(pose.rotateY), Math.abs(pose.rotateZ));

test("arrival timing does not change with the spatial bucket size", () => {
	const { m, wall, geometry } = sceneFor(VIEWPORTS[1]);
	const slot = { ...wall.items[0], key: "entry-probe", seed: 42, rect: { x: 2600, y: 200, width: 170, height: 140 } };
	const normal = m.slotDescent(slot, wall);
	assert.ok(close(normal.start, 21.747299814740884), "the pre-masonry entry time");
	assert.ok(close(normal.touchdown, 22.726097591474147), "the pre-masonry landing time");
	const reindexed = m.slotDescent(slot, { ...wall, geometry: { ...geometry, bucketWidth: geometry.bucketWidth * 2 } });
	assert.deepEqual(reindexed, normal);
});

test("an oversized card starts settling at the same leading-edge position as the original wide card", () => {
	const { m, wall } = sceneFor(VIEWPORTS[1]);
	const slot = { ...wall.items[0], key: "small-entry", seed: 42, rect: { x: 2600, y: 200, width: 377.3968253968254, height: 140 } };
	const reference = m.slotDescent(slot, wall);
	const larger = m.slotDescent({ ...slot, key: "wide-entry", rect: { ...slot.rect, width: 650 } }, wall);
	assert.deepEqual(larger, reference);
});

test("the mega bento never exists on the bento's rest frame (reduced motion)", () => {
	const { m, wall, drops, viewport } = sceneFor(VIEWPORTS[0]);
	assert.equal(m.WALL_CUE.start, m.CUE.end);
	assert.equal(m.wallActive(m.FINALE_REST_TIME), false);
	assert.equal(m.wallActive(m.FINALE_REST_TIME + 1 / 120), true);
	assert.deepEqual(m.wallSheetsAt(m.FINALE_REST_TIME, wall, drops, viewport), []);
	// Its columns mount, hidden, on the held frame after the last tile has built, not on the act's first frame.
	const lastBuilt = m.tileRevealStart(5) + m.CUE.reveal;
	assert.equal(m.wallMounted(lastBuilt), false);
	assert.equal(m.wallMounted(m.FINALE_REST_TIME), true);
});

test("a grey container's landing sheet and accents match its 20px DOM corners", () => {
	const { m, wall, drops, viewport } = sceneFor(VIEWPORTS[1]);
	const slot = wall.items.find((slot) => slot.content.kind === "piece" && m.slotDescent(slot, wall));
	assert.ok(slot);
	const time = m.slotDescent(slot, wall).touchdown + 0.05;
	const sheet = m.wallSheetsAt(time, wall, drops, viewport).find((sheet) => sheet.key === `card-${slot.key}`);
	assert.equal(sheet.radius, 20);
	const landing = m.wallLandingsAt(time, wall, drops).find((landing) => landing.key === slot.key);
	assert.equal(landing.radius, 20);
});

test("the bento's six tiles are thrown faces and all from exactly where they lie", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, drops } = sceneFor(viewport);
		assert.equal(drops.length, 7, "six tiles and the title");
		assert.equal(drops.filter((drop) => drop.kind === "title").length, 1);
		for (const drop of drops) {
			// MCB drags the title in instead (see its own tests).
			if (drop.kind === "title") continue;
			assert.equal(m.bentoSheetPose(drop, drops, m.bentoTossTime() - 1e-3, geometry, viewport), null, "its DOM card shows until the throw");
			const pose = m.bentoSheetPose(drop, drops, m.bentoTossTime(), geometry, viewport);
			const at = seen(m, pose, viewport);
			assert.ok(close(at.x, drop.from.x + drop.from.width / 2, 1e-4) && close(at.y, drop.from.y + drop.from.height / 2, 1e-4), "seen on its card, on the slide");
			assert.ok(close(at.width, drop.from.width, 1e-4) && close(at.height, drop.from.height, 1e-4), "at its size");
			assert.equal(pose.face, 0, "its printed face up");
			assert.equal(turned(pose), 0);
		}
	}
});

test("the mega bento appears only from the throw on, from the middle of the frame out", () => {
	const { m, wall, drops, viewport, geometry } = sceneFor(VIEWPORTS[0]);
	const present = Array.from({ length: wall.periodBuckets }, (_, column) => wall.bucket(column)).flat().filter((slot) => slot.reserved === undefined && !m.slotDescent(slot, wall));
	assert.ok(present.length > 10);
	for (const slot of present) assert.equal(m.wallSlotPresence(slot, wall, drops, m.bentoTossTime() - 0.01).opacity, 0, "nothing before the throw");
	const settled = m.WALL_CUE.start + m.WALL_CUE.revealAt + m.WALL_CUE.revealS + m.WALL_CUE.revealFadeS;
	for (const slot of present) {
		const shown = m.wallSlotPresence(slot, wall, drops, settled);
		assert.ok(close(shown.opacity, 1) && close(shown.scale, 1) && shown.revealStart === null, "all there, built, by the time the cards land");
	}
	const centre = { x: viewport.width / 2, y: viewport.height / 2 };
	const distance = (slot) => {
		const rect = m.slotOnScreen(slot, 0, geometry);
		return Math.hypot(rect.x + rect.width / 2 - centre.x, rect.y + rect.height / 2 - centre.y);
	};
	const byDistance = [...present].sort((a, b) => distance(a) - distance(b));
	const midway = m.WALL_CUE.start + m.WALL_CUE.revealAt + m.WALL_CUE.revealS * 0.45;
	const near = byDistance.slice(0, 4).map((slot) => m.wallSlotPresence(slot, wall, drops, midway).opacity);
	const far = byDistance.slice(-4).map((slot) => m.wallSlotPresence(slot, wall, drops, midway).opacity);
	assert.ok(Math.min(...near) > Math.max(...far), "the middle first");
});

test("a thrown card falls away from the lens onto the wall like paper: never toward the viewer, turning as it leaves", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, drops } = sceneFor(viewport);
		const distance = m.cameraDistance(viewport);
		const spins = [];
		// MCB lowers the title by hand (`finale-title-drag.test.js`).
		for (const drop of drops.filter((each) => each.kind === "tile")) {
			const toss = m.bentoTossTime();
			const touchdown = m.bentoTouchdown(drop, drops);
			const gap = drop.slot.rect;
			// Regression: cards once rose toward the lens and loomed larger than their tiles.
			let previous = { z: Number.POSITIVE_INFINITY, width: Number.POSITIVE_INFINITY };
			for (let time = toss; time <= touchdown; time += 1 / 60) {
				const pose = m.bentoSheetPose(drop, drops, time, geometry, viewport);
				const at = seen(m, pose, viewport);
				assert.ok(pose.z <= previous.z + 1e-6 && pose.z >= -1e-6, `card ${drop.order} only ever comes down onto the wall`);
				assert.ok(at.width <= previous.width + 1e-6 && at.width <= drop.from.width + 1e-6, "and is only ever seen shrinking, from its tile toward its gap");
				assert.ok(distance - pose.z >= distance * 0.3, "it never reaches the lens's fade");
				previous = { z: pose.z, width: at.width };
			}
			// Fast as it leaves the hand: most of its shrink, in log terms, is over by a third of the way.
			const third = seen(m, m.bentoSheetPose(drop, drops, toss + (touchdown - toss) / 3, geometry, viewport), viewport);
			const shrunk = Math.log(drop.from.width / third.width) / Math.log(drop.from.width / gap.width);
			assert.ok(shrunk > 0.45, `card ${drop.order} falls away fastest as it leaves (${shrunk.toFixed(2)})`);
			spins.push(turned(m.bentoSheetPose(drop, drops, toss + (touchdown - toss) * 0.25, geometry, viewport)));
			const falling = m.bentoSheetPose(drop, drops, m.bentoFallStart(drop, drops), geometry, viewport);
			assert.ok(turned(falling) < 1.2, `card ${drop.order}'s turns are spent before it comes down`);
			assert.ok(falling.lift === 1, "airborne cloth");
		}
		assert.ok(spins.some((spin) => spin > 1.5), "some flip or spin through whole turns as they leave");
	}
});

test("Team 26 gains a white card on the slide, then its GL sheet flips it end over end, like paper, to its black back, and MCB takes it as it lands", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, drops } = sceneFor(viewport);
		const title = drops.find((drop) => drop.kind === "title");
		const flip = m.bentoTitleFlipTime();
		const toss = m.bentoTossTime();
		const pose = (time) => m.bentoSheetPose(title, drops, time, geometry, viewport);
		// The white card forms on the DOM slide, quickly, and the GL sheet takes it from there.
		assert.equal(m.bentoTitleForm(m.WALL_CUE.start), 0);
		assert.equal(m.bentoTitleForm(flip), 1, "formed when its sheet takes over");
		assert.ok(flip - m.WALL_CUE.start <= 0.3, "and soon after the bento's final frame");
		assert.equal(pose(flip - 1e-3), null, "its DOM card shows until the flip");
		const handover = pose(flip);
		const at = seen(m, handover, viewport);
		assert.ok(close(at.x, title.from.x + title.from.width / 2, 1e-4) && close(at.y, title.from.y + title.from.height / 2, 1e-4), "exactly on its DOM card");
		assert.ok(close(at.width, title.from.width, 1e-4) && close(at.height, title.from.height, 1e-4) && handover.z === 0 && handover.lift === 0, "flat on the slide");
		assert.ok(close(Math.abs(handover.rotateX), Math.PI) && handover.rotateY === 0 && handover.rotateZ === 0, "white side up: the sheet's back");
		// It turns over on a spring, top edge away first, through edge-on in about a tenth of a second.
		const step = 1 / 120;
		const flown = m.titleHeldTime();
		const samples = [];
		for (let time = flip; time <= flown + 0.2; time += step) samples.push({ time, pose: pose(time) });
		assert.ok(samples[1].pose.rotateX < samples[0].pose.rotateX, "its top edge tips away first");
		const edgeOn = samples.find(({ pose: each }) => Math.abs(each.rotateX) <= Math.PI / 2);
		assert.ok(edgeOn && edgeOn.time - flip < 0.15, `whips through edge-on (${(edgeOn.time - flip).toFixed(3)}s)`);
		assert.ok(edgeOn.time < toss, "and the tiles are thrown just after");
		assert.ok(edgeOn.pose.z > 0 && edgeOn.pose.lift > 0.5, "hopping toward the lens as airborne paper as it turns");
		// Still turning and in the air as its black face comes up and the tiles go: MCB takes it as it lands, so it never comes to rest in its box.
		const thrown = pose(toss);
		assert.ok(Math.cos(thrown.rotateX) > 0 && thrown.rotateX > 0.2 && thrown.z > 0 && thrown.lift > 0.5, "mid-flip as the tiles are thrown");
		assert.ok(m.titleGrabTime() > toss && m.titleGrabTime() - flip < 0.6, "taken as its flip lands");
		// Regression: the hop once jumped the card ~3% larger on the flip's first frame.
		const first = seen(m, pose(flip + 1 / 60), viewport);
		assert.ok(first.width / at.width < 1.02, `leaves its box smoothly (${first.width / at.width})`);
		const sheetAt = (time) => m.wallSheetsAt(time, wall, drops, viewport).find((each) => each.texture === "title");
		samples.forEach(({ time, pose: each }, index) => {
			if (index === 0) return;
			const { pose: before, time: then } = samples[index - 1];
			const now = seen(m, each, viewport);
			const was = seen(m, before, viewport);
			const moved = Math.hypot(now.x - was.x, now.y - was.y) + Math.abs(now.width - was.width) + Math.abs(each.rotateX - before.rotateX) * title.from.height;
			assert.ok(moved > 0.25, `never at rest (${time.toFixed(3)}s)`);
			assert.ok(Math.abs(each.rotateX - before.rotateX) < 0.3, "turns continuously");
			assert.ok(Math.hypot(now.x - was.x, now.y - was.y) < 0.02 * viewport.width && Math.abs(now.width / was.width - 1) < 0.02, "flies continuously");
			// Regression: blending the flip into the throw across their depths read to the cloth as a rush toward the lens.
			const v = sheetAt(time).velocity;
			const u = sheetAt(then).velocity;
			assert.ok(Math.hypot(v.x - u.x, v.y - u.y, v.z - u.z) < 600, `its cloth feels no jolt at ${time.toFixed(3)}s`);
		});
		// The GL layer draws it black-fronted and white-backed, its cloth answering the hop, unshadowed and unsmeared.
		const sheet = sheetAt(edgeOn.time);
		assert.ok(sheet && sheet.color !== sheet.back, "two faces");
		assert.ok(Math.hypot(sheet.velocity.x, sheet.velocity.y, sheet.velocity.z) > 100, "its cloth feels the hop");
		assert.equal(sheet.shadow, null);
		assert.equal(sheet.chroma, 0);
	}
});

test("a thrown card's smear eases in as it leaves the hand and out as it comes down, landing crisp", () => {
	for (const viewport of VIEWPORTS) {
		const { m, wall, drops } = sceneFor(viewport);
		for (const drop of drops) {
			const touchdown = m.bentoTouchdown(drop, drops);
			const key = `bento-${drop.order}`;
			const chroma = (time) => m.wallSheetsAt(time, wall, drops, viewport).find((sheet) => sheet.key === key)?.chroma ?? 0;
			const series = [];
			for (let time = m.bentoTossTime(); time <= touchdown + 0.1; time += 1 / 60) series.push(chroma(time));
			const lit = series.map((value, index) => (value > 0 ? index : -1)).filter((index) => index >= 0);
			// Regression: a sin^0.8 swell stepped ~0.05 on its first and last frames, so the smear popped on and snapped off.
			assert.ok(series[lit[0]] < 0.01 && series[lit.at(-1)] < 0.01, `card ${drop.order}'s smear eases at both ends`);
			series.forEach((value, index) => {
				if (index > 0) assert.ok(Math.abs(value - series[index - 1]) < 0.1, "and never steps");
			});
			assert.equal(chroma(touchdown), 0, "crisp as it lands");
		}
	}
});

test("the flipped title stays black side up in MCB's hand: its white back never shows again", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, drops } = sceneFor(viewport);
		const title = drops.find((drop) => drop.kind === "title");
		const touchdown = m.bentoTouchdown(title, drops);
		for (let time = m.bentoTossTime(); time <= touchdown; time += 1 / 60) {
			const pose = m.bentoSheetPose(title, drops, time, geometry, viewport);
			// The sheet's normal toward the lens, as `poseSheet` turns it (XYZ): cos x · cos y.
			assert.ok(Math.cos(pose.rotateX) * Math.cos(pose.rotateY) > 0, `faces the lens at ${time.toFixed(2)}s`);
		}
	}
});

test("each card lands in its own gap exactly as on the slide, one after another, the title last, then hands over to its built DOM card", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, drops } = sceneFor(viewport);
		const touchdowns = drops.filter((drop) => drop.kind === "tile").map((drop) => m.bentoTouchdown(drop, drops)).sort((a, b) => a - b);
		touchdowns.forEach((time, index) => {
			if (index > 0) assert.ok(close(time - touchdowns[index - 1], m.WALL_CUE.landStagger), "the tiles a beat apart");
		});
		const title = m.bentoTouchdown(drops.find((drop) => drop.kind === "title"), drops);
		assert.ok(title - touchdowns.at(-1) >= m.WALL_CUE.landStagger - 1e-9, "MCB sets the title down a beat after the last tile");
		assert.equal(m.bentoLandedTime(wall.gaps.length), title, "the last of the bento's cards down");
		assert.equal(new Set(drops.map((drop) => drop.slot.key)).size, 7, "distinct gaps");
		for (const drop of drops) {
			const touchdown = m.bentoTouchdown(drop, drops);
			for (const after of [0, 0.3]) {
				const pose = m.bentoSheetPose(drop, drops, touchdown + after, geometry, viewport);
				const gap = m.slotOnScreen(drop.slot, m.wallOffset(touchdown + after, geometry), geometry);
				assert.ok(close(pose.x, gap.x + gap.width / 2) && close(pose.y, gap.y + gap.height / 2) && pose.z === 0, "flat in its gap");
				assert.ok(close(pose.width, gap.width) && close(pose.height, gap.height), "at the gap's size");
				assert.ok(close(pose.waveAge, after), "Peel's landing wave runs from touchdown");
			}
			assert.equal(m.bentoSheetPose(drop, drops, touchdown + m.CUE.handoff + 0.13, geometry, viewport), null);
			const presence = m.wallSlotPresence(drop.slot, wall, drops, touchdown + 0.1);
			assert.equal(presence.opacity, 0, "the gap waits, empty");
			assert.equal(presence.revealStart, null, "and takes its card already built");
		}
	}
});

test("the wall is already gliding as the thrown cards come down, eased in from rest, and each lands on its moving gap through the hand-over", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, drops } = sceneFor(viewport);
		const speed = m.wallSpeed(geometry);
		const ramp = m.WALL_CUE.driftRamp;
		const drift = m.wallDriftStart();
		const pace = (time, dt = 1e-4) => (m.wallOffset(time + dt / 2, geometry) - m.wallOffset(time - dt / 2, geometry)) / dt;
		const touchdowns = drops.map((drop) => m.bentoTouchdown(drop, drops)).sort((a, b) => a - b);
		// Regression: the wall sat still until every card was down, then waited before it began to glide.
		assert.ok(drift > m.bentoTossTime() && drift < touchdowns[0], "it starts to glide mid-throw, before the first card is down");
		assert.equal(m.wallOffset(m.bentoTossTime(), geometry), 0, "the cards are thrown at a wall at rest");
		assert.ok(pace(touchdowns[0]) > speed * 0.15, "the first card lands on a wall already moving");
		assert.ok(pace(touchdowns.at(-1)) > speed * 0.6, "the last on one nearly at its pace");
		// Eased in from rest: no jump in speed, nor a kick of acceleration, as it starts or as it meets its pace.
		assert.equal(pace(drift - 1e-3), 0);
		assert.ok(pace(drift + 1e-3) < speed * 1e-5, "it leaves rest without a jump in speed");
		const step = 1 / 240;
		let previous = pace(drift - 0.5);
		for (let time = drift - 0.5 + step; time < drift + ramp + 0.5; time += step) {
			const now = pace(time);
			assert.ok(now >= previous - 1e-6 && now - previous <= ((1.5 * speed) / ramp) * step * 1.001, `it only ever picks up speed, smoothly (${time.toFixed(3)}s)`);
			previous = now;
		}
		assert.ok((pace(drift + 0.02) - pace(drift)) / 0.02 < speed * 0.01, "no kick of acceleration as it starts");
		assert.ok(close(pace(drift + ramp), speed, speed * 1e-4) && close(pace(drift + ramp + 0.05), speed, speed * 1e-4), "and it meets its pace as smoothly");
		for (const drop of drops) {
			const touchdown = m.bentoTouchdown(drop, drops);
			const handedOver = touchdown + m.CUE.handoff + 0.12;
			assert.ok(m.wallOffset(handedOver, geometry) - m.wallOffset(touchdown, geometry) > speed * 0.15, `card ${drop.order}'s gap moves on under it as it lands`);
			for (let time = touchdown; time < handedOver; time += 1 / 120) {
				const pose = m.bentoSheetPose(drop, drops, time, geometry, viewport);
				// Where `FinaleWall` shows its DOM card: the slot's rect on the track, translated by the wall's travel.
				const left = drop.slot.rect.x + geometry.originX - m.wallOffset(time, geometry);
				assert.ok(pose && pose.z === 0, `card ${drop.order} is flat on the wall from touchdown`);
				assert.ok(close(pose.x, left + drop.slot.rect.width / 2) && close(pose.y, drop.slot.rect.y + drop.slot.rect.height / 2), `card ${drop.order} stays exactly on its moving gap (${(time - touchdown).toFixed(3)}s down)`);
				assert.ok(close(pose.width, drop.slot.rect.width) && close(pose.height, drop.slot.rect.height));
			}
			const crossfade = touchdown + m.CUE.handoff + 0.06;
			const handing = m.wallSlotPresence(drop.slot, wall, drops, crossfade).opacity;
			assert.ok(handing > 0 && handing < 1 && m.bentoSheetPose(drop, drops, crossfade, geometry, viewport), "its sheet and its DOM card cross-fade in the same place");
			// It comes down with the gap's motion: no skid as it touches down.
			const h = 1e-3;
			const across = (time) => seen(m, m.bentoSheetPose(drop, drops, time, geometry, viewport), viewport).x;
			const gapPace = -pace(touchdown);
			assert.ok(Math.abs((across(touchdown) - across(touchdown - h)) / h - gapPace) < speed * 0.02, `card ${drop.order} arrives moving with its gap`);
			assert.ok(Math.abs((across(touchdown + h) - across(touchdown)) / h - gapPace) < speed * 0.02, "and rides on with it");
		}
	}
});

test("new cards wait in the air at the leading edge, tilted and turned, and come down each at its own moment", () => {
	const { m, wall, drops, viewport } = sceneFor(VIEWPORTS[1]);
	const column = firstArrivingColumn(m, wall);
	const waiting = arrivals(m, wall, column);
	const starts = waiting.map(({ descent }) => descent.start).sort((a, b) => a - b);
	assert.ok(starts.at(-1) - starts[0] > 0.6, "a column fills raggedly, not as a block");
	assert.ok(starts.every((start) => start > m.wallDriftStart()), "only once the wall glides");
	for (const { slot, descent } of waiting) {
		const sheet = (time) => m.wallSheetsAt(time, wall, drops, viewport).find((each) => each.key === `card-${slot.key}`);
		const aloft = sheet(descent.start - 0.05);
		if (aloft) {
			assert.ok(aloft.pose.z > 0 && aloft.pose.lift === 1, "up in the air");
			assert.ok(turned(aloft.pose) > 0.15, "tilted");
			assert.ok(close(aloft.chroma, 1), "filmed through the field's smear");
		}
		const landed = sheet(descent.touchdown + 0.2);
		assert.ok(landed && landed.pose.z === 0 && turned(landed.pose) < 0.01 && landed.chroma === 0, "flat in its slot, the smear gone");
		assert.ok(close(landed.pose.waveAge, 0.2), "with the landing wave");
		const presence = m.wallSlotPresence(slot, wall, drops, descent.touchdown + m.CUE.handoff + 0.2);
		assert.ok(presence.opacity === 1 && close(presence.revealStart, m.landingRevealStart(descent.touchdown)), "then its DOM card builds");
	}
});

test("the wall glides at a steady pace and its arrivals loop without a seam", () => {
	const { m, geometry, wall } = sceneFor(VIEWPORTS[0]);
	assert.ok(close(m.wallOffset(m.wallDriftStart(), geometry), 0));
	const paced = m.wallDriftStart() + m.WALL_CUE.driftRamp;
	for (const time of [paced, paced + 7.3, paced + 60]) assert.ok(close(m.wallOffset(time + 1, geometry) - m.wallOffset(time, geometry), m.wallSpeed(geometry), 1e-6), "a steady pace once up to speed");
	for (const offset of [0.5, 12, 80, 400, 5000]) assert.ok(close(m.wallOffset(m.wallTimeAt(offset, geometry), geometry), offset), `${offset}px inverts`);
	const loop = m.wallLoop(wall);
	for (const column of [wall.periodBuckets + 2, wall.periodBuckets + 5]) {
		wall.bucket(column).forEach((slot, index) => {
			const next = wall.bucket(column + wall.periodBuckets)[index];
			assert.deepEqual(next.content, slot.content, "the next copy holds the same card");
			const now = m.slotDescent(slot, wall);
			const later = m.slotDescent(next, wall);
			if (!now) return;
			assert.ok(close(later.start - now.start, loop, 1e-6) && close(later.touchdown - now.touchdown, loop, 1e-6), "and brings it down one loop later");
		});
	}
});

test("the GL layer draws the thrown cards with their faces, and every sheet once", () => {
	const { m, wall, drops, viewport } = sceneFor(VIEWPORTS[0]);
	const thrown = m.wallSheetsAt(m.bentoTossTime() + 0.6, wall, drops, viewport).filter((sheet) => sheet.kind === "bento");
	assert.equal(thrown.length, 7);
	assert.deepEqual(thrown.map((sheet) => sheet.texture).sort(), ["bento-0", "bento-1", "bento-2", "bento-3", "bento-4", "bento-5", "title"]);
	assert.ok(thrown.every((sheet) => sheet.chroma > 0 && sheet.shadow), "smeared in flight, shadowed as they come down");
	const column = firstArrivingColumn(m, wall);
	const { descent } = arrivals(m, wall, column)[0];
	const keys = m.wallSheetsAt(descent.start, wall, drops, viewport).map((sheet) => sheet.key);
	assert.equal(new Set(keys).size, keys.length, "unique keys");
});

test("landing accents live from touchdown until the content has built", () => {
	const { m, wall, drops } = sceneFor(VIEWPORTS[0]);
	const drop = drops[0];
	const touchdown = m.bentoTouchdown(drop, drops);
	const keys = (time) => m.wallLandingsAt(time, wall, drops).map((landing) => landing.key);
	assert.ok(!keys(touchdown - 0.01).includes(`bento-${drop.order}`));
	assert.ok(keys(touchdown + 0.5).includes(`bento-${drop.order}`));
	assert.ok(!keys(m.landingSettled(touchdown) + 0.01).includes(`bento-${drop.order}`));
	const column = firstArrivingColumn(m, wall);
	const { slot, descent } = arrivals(m, wall, column)[0];
	assert.ok(m.wallLandingsAt(descent.touchdown + 0.4, wall, drops).some((landing) => landing.key === slot.key));
});

test("identity shapes morph by resampled, aligned rings and rest between morphs", () => {
	const m = load();
	const ring = (count, radius, turn = 0) => Array.from({ length: count }, (_, index) => {
		const angle = turn + (index / count) * Math.PI * 2;
		return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
	});
	const from = ring(24, 40);
	const aligned = m.alignRing(from, [...ring(24, 30, 0.5)].reverse());
	assert.equal(aligned.length, from.length);
	const wind = (points) => points.reduce((sum, a, index) => { const b = points[(index + 1) % points.length]; return sum + a.x * b.y - b.x * a.y; }, 0);
	assert.ok(Math.sign(wind(aligned)) === Math.sign(wind(from)), "the target winds the same way");
	assert.deepEqual(m.blendRings(from, aligned, 0), from);
	assert.deepEqual(m.blendRings(from, aligned, 1), aligned);
	assert.match(m.ringPath(from), /^M[\d. L]+Z$/u);
	assert.deepEqual(m.shapeStepAt(1, 6), { index: 0, progress: 0 });
	const morphing = m.shapeStepAt(m.SHAPE_HOLD_S + m.SHAPE_MORPH_S / 2, 6);
	assert.ok(morphing.index === 0 && morphing.progress > 0 && morphing.progress < 1);
});
