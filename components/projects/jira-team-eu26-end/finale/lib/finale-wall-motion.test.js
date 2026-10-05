const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ENTRY = `
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export * from "./finale-shape-morph";
export { cameraDistance, tileRevealStart } from "./finale-card-motion";
export { CUE, FINALE_REST_TIME, WALL_CUE } from "../data/finale-cues";
export { FINALE_STORIES, finaleBentoLayout, selectFinaleFeatures } from "../data/finale-stories";
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
	const features = m.selectFinaleFeatures(dragOrder);
	const geometry = m.wallGeometry(bento, scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, features, dragOrder);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	return { m, viewport, scale, bento, features, geometry, wall, drops };
}

/** Arriving slots (not on the wall when it appears) of a column, with their descents. */
function arrivals(m, wall, column) {
	return wall.column(column).filter((slot) => slot.reserved === undefined).map((slot) => ({ slot, descent: m.slotDescent(slot, wall) })).filter((each) => each.descent);
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

test("the bento's seven cards, its title among them, are thrown faces and all from exactly where they lie", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, drops } = sceneFor(viewport);
		assert.equal(drops.length, 7, "six tiles and the title");
		assert.equal(drops.filter((drop) => drop.kind === "title").length, 1);
		assert.deepEqual(m.bentoTitleFlip(m.WALL_CUE.start), { form: 0, turn: 0 });
		assert.deepEqual(m.bentoTitleFlip(m.bentoTossTime()), { form: 1, turn: 1 }, "the title has turned over to its black card by the throw");
		for (const drop of drops) {
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
	const present = Array.from({ length: m.WALL_PERIOD }, (_, column) => wall.column(column)).flat().filter((slot) => slot.reserved === undefined && !m.slotDescent(slot, wall));
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
		for (const drop of drops) {
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

test("Team 26 gains a white card and turns it over to its black back before the throw", () => {
	const { m } = sceneFor(VIEWPORTS[0]);
	const at = (share) => m.bentoTitleFlip(m.WALL_CUE.start + m.WALL_CUE.titleCardAt + m.WALL_CUE.titleCardS * share);
	assert.ok(at(0.2).form > 0.5 && at(0.2).turn === 0, "the card forms first");
	assert.ok(at(0.32).form < 1 && at(0.32).turn > 0, "and turns before it has quite settled");
	const turns = Array.from({ length: 41 }, (_, index) => at(index / 40).turn);
	assert.ok(turns.every((turn, index) => index === 0 || turn >= turns[index - 1]), "it turns one way, without settling back");
	assert.ok(m.WALL_CUE.titleCardAt + m.WALL_CUE.titleCardS <= m.WALL_CUE.tossAt, "turned over before the throw");
});

test("each card lands in its own gap exactly as on the slide, one after another, then hands over to its built DOM card", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, drops } = sceneFor(viewport);
		const touchdowns = drops.map((drop) => m.bentoTouchdown(drop, drops)).sort((a, b) => a - b);
		touchdowns.forEach((time, index) => {
			if (index > 0) assert.ok(close(time - touchdowns[index - 1], m.WALL_CUE.landStagger), "a beat apart");
		});
		assert.ok(touchdowns.at(-1) < m.WALL_CUE.start + m.WALL_CUE.driftAt, "all down before the wall glides");
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

test("new cards wait in the air at the leading edge, tilted and turned, and come down each at its own moment", () => {
	const { m, wall, drops, viewport } = sceneFor(VIEWPORTS[1]);
	const column = firstArrivingColumn(m, wall);
	const waiting = arrivals(m, wall, column);
	const starts = waiting.map(({ descent }) => descent.start).sort((a, b) => a - b);
	assert.ok(starts.at(-1) - starts[0] > 0.6, "a column fills raggedly, not as a block");
	assert.ok(starts.every((start) => start > m.WALL_CUE.start + m.WALL_CUE.driftAt), "only once the wall glides");
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
	assert.ok(close(m.wallOffset(m.WALL_CUE.start + m.WALL_CUE.driftAt, geometry), 0));
	for (const offset of [0.5, 12, 80, 400, 5000]) assert.ok(close(m.wallOffset(m.wallTimeAt(offset, geometry), geometry), offset), `${offset}px inverts`);
	const loop = m.wallLoop(geometry, m.WALL_PERIOD);
	for (const column of [m.WALL_PERIOD + 2, m.WALL_PERIOD + 5]) {
		wall.column(column).forEach((slot, index) => {
			const next = wall.column(column + m.WALL_PERIOD)[index];
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

test("now and then a presenter sets a waiting card down, one card at a time each", () => {
	const { m, wall, viewport } = sceneFor(VIEWPORTS[0]);
	let held = 0;
	for (let time = m.WALL_CUE.start + 8; time < m.WALL_CUE.start + 60; time += 0.25) {
		const cursors = m.wallCursorsAt(time, wall, viewport);
		const presenters = cursors.map((cursor) => cursor.presenter);
		assert.equal(new Set(presenters).size, presenters.length, "one card per presenter at a time");
		for (const cursor of cursors) {
			assert.ok(cursor.presenter >= 0 && cursor.presenter < 4 && cursor.opacity >= 0 && cursor.opacity <= 1);
			if (cursor.opacity === 1) held += 1;
		}
	}
	assert.ok(held > 0, "they do reach in");
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
