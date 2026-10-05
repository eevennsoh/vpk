const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let model;
function load() {
	model ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: 'export * from "./finale-confetti"; export { FLASH_TIMING, FLASH_ROVO_COLORS } from "./finale-column-flash"; export { CUE } from "../data/finale-cues";', resolveDir: __dirname, loader: "ts" },
		bundle: true, format: "cjs", platform: "node", write: false,
	}).outputFiles[0].text, "finale-confetti-harness.cjs");
	return model;
}

let look;
/** The renderer's look (its shutter and focus), bundled on its own: it brings three.js. */
function loadLook() {
	look ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: 'export { FINALE_CONFETTI_LOOK } from "./finale-confetti-renderer";', resolveDir: __dirname, loader: "ts" },
		bundle: true, format: "cjs", platform: "node", write: false,
	}).outputFiles[0].text, "finale-confetti-look-harness.cjs").FINALE_CONFETTI_LOOK;
	return look;
}

// A 1440×900 board whose Done column sits at the right.
const COLUMN = { x: 1090, y: 240, width: 322, height: 630, radius: 8 };
const STAGE = { width: 1440, height: 900, column: COLUMN };

// Where a drop lands on that board: one card in Done, a bulk drag's stack (the
// union of its cards), a card at the far left (its right edge faces the
// viewport's centre, so a lifted piece there projects back toward it), and a
// tiny, very round box.
const CARD = { x: 1101, y: 300, width: 300, height: 120, radius: 8 };
const LANDINGS = {
	card: CARD,
	stack: { x: 1101, y: 252, width: 300, height: 420, radius: 8 },
	left: { x: 16, y: 690, width: 280, height: 110, radius: 6 },
	tiny: { x: 1300, y: 40, width: 60, height: 30, radius: 12 },
};
const puffOn = (landing) => ({ width: STAGE.width, height: STAGE.height, size: "small", landing });

/** Signed distance (px) from `point` to the rounded `box`: negative over its face. */
function outside(box, point) {
	const r = Math.min(box.radius, box.width / 2, box.height / 2);
	const qx = Math.abs(point.x - (box.x + box.width / 2)) - box.width / 2 + r;
	const qy = Math.abs(point.y - (box.y + box.height / 2)) - box.height / 2 + r;
	return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** The border's outward normal at `point`: the gradient of `outside`. */
function normalAt(box, point) {
	const h = 1e-3;
	const x = outside(box, { x: point.x + h, y: point.y }) - outside(box, { x: point.x - h, y: point.y });
	const y = outside(box, { x: point.x, y: point.y + h }) - outside(box, { x: point.x, y: point.y - h });
	return { x: x / Math.hypot(x, y), y: y / Math.hypot(x, y) };
}

/** Where the camera draws `point` on the viewport: a lift off the page pushes it away from the centre. */
function projected(cameraDistance, stage, point) {
	const scale = cameraDistance / (cameraDistance - point.z);
	return { x: stage.width / 2 + (point.x - stage.width / 2) * scale, y: stage.height / 2 + (point.y - stage.height / 2) * scale };
}

/**
 * How far from its centre the renderer's quad for `piece` reaches, whatever its turn: the
 * piece shader's `confettiSurface` (its bend and helical pitch), over its padded footprint.
 */
function quadReach(piece, pad) {
	const { length: span, width, arc: bend, pitch } = piece.size;
	const arc = Math.max(bend, 0.001);
	const radius = Math.max(span, 0.001) / arc;
	let reach = 0;
	for (let step = 0; step <= 192; step++) {
		const along = (step / 192 - 0.5) * (span + 2 * pad);
		const a = along / Math.max(span, 0.001) * arc;
		// Across, the farthest point lies on one of the quad's two long edges.
		for (const across of [-(width / 2 + pad), width / 2 + pad]) {
			reach = Math.max(reach, Math.hypot(radius * Math.sin(a), across + along * pitch, 2 * radius * Math.sin(a / 2) ** 2));
		}
	}
	return reach;
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

test("the timeline composes the resolved VPK duration tokens and hands over in the flash's rise", () => {
	const { FINALE_CONFETTI_TIMING: T, FLASH_TIMING } = load();
	const css = readFileSync("app/tailwind-theme.css", "utf8");
	const token = (name) => Number(css.match(new RegExp(`--duration-${name}:\\s*(\\d+)ms`))[1]) / 1000;
	assert.equal(T.volley, token("slow"), "the cannons fire as a stream the eye can follow");
	assert.equal(T.gatherStart, token("slowest") + token("slower"), "a hang before the vortex opens");
	assert.equal(T.gatherSpread, token("slow"));
	assert.equal(T.glowIn, token("slow"), "the column's glow pulses in once, briefly");
	assert.equal(T.firstArrival, token("slowest") * 2 + token("medium"));
	// Regression: at 2.4s to the flash, the burst and its trace dragged.
	assert.equal(T.gathered, token("slowest") * 3, "the flash may ignite 1.8s after launch");
	assert.equal(T.glowOut, token("slow"), "the glow is spent over the last of the pull");
	assert.equal(T.release, FLASH_TIMING.rise, "whatever is still drawn clears over exactly the flash's own rise");
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

test("a drop's puff leaves from just outside every edge of its landing at once, outward, in a continuous ring", () => {
	const { createFinaleConfettiBurst, FINALE_CONFETTI_PAD, FLASH_ROVO_COLORS } = load();
	const css = readFileSync("app/tailwind-theme.css", "utf8");
	const impact = Number(css.match(/--duration-xxshort:\s*(\d+)ms/)[1]) / 1000;
	for (const [name, landing] of Object.entries(LANDINGS)) {
		const { pieces } = createFinaleConfettiBurst(puffOn(landing));
		const headings = [];
		/** Where on the border each piece sets off from, square to it. */
		const feet = [];
		for (const piece of pieces) {
			const extent = quadReach(piece, FINALE_CONFETTI_PAD);
			const clearance = outside(landing, piece.origin);
			// Regression: set off on the border itself, the launch streak swept back over the card's edge.
			assert.ok(clearance > extent - 1e-6, `${name}: it sets off outside the border by as far as its drawn quad reaches`);
			// …and no farther than that bound's slack: a coiled ribbon by its coil's reach, not its length.
			assert.ok(clearance < extent + 3, `${name}: just outside (${(clearance - extent).toFixed(2)}px spare on a ${piece.shape})`);
			assert.equal(piece.origin.z, 0, "from the page");
			const normal = normalAt(landing, piece.origin);
			feet.push({ x: piece.origin.x - normal.x * clearance, y: piece.origin.y - normal.y * clearance });
			headings.push(Math.acos((piece.velocity.x * normal.x + piece.velocity.y * normal.y) / Math.hypot(piece.velocity.x, piece.velocity.y)) * 180 / Math.PI);
			assert.ok(piece.delay >= 0 && piece.delay <= impact, `${name}: every piece leaves within one impact (--duration-xxshort)`);
			assert.equal(piece.corner, null, "from no cannon");
			assert.ok(FLASH_ROVO_COLORS.includes(piece.front) && FLASH_ROVO_COLORS.includes(piece.back) && piece.front !== piece.back, "two Rovo faces");
		}
		headings.sort((a, b) => a - b);
		assert.ok(headings.at(-1) < 70, `${name}: outward, never back along its edge (${headings.at(-1).toFixed(1)}°)`);
		assert.ok(headings[headings.length >> 1] < 20, `${name}: most leave nearly square to their edge`);
		assert.ok(mean(pieces.map((piece) => piece.delay)) < impact / 3, `${name}: front-loaded, a slam rather than a stream`);
		// Light but gapless round the border: one card's drop, not the finale's 600-piece burst.
		const r = Math.min(landing.radius, landing.width / 2, landing.height / 2);
		const slot = (2 * (landing.width + landing.height - 4 * r) + 2 * Math.PI * r) / pieces.length;
		assert.ok(slot <= 12 && pieces.length >= 40 && pieces.length <= 120, `${name}: a piece every ${slot.toFixed(1)}px of border, ${pieces.length} in all`);
		const sides = [
			{ on: (p) => Math.abs(p.y - landing.y) < 1e-6, along: (p) => p.x, span: [landing.x + r, landing.x + landing.width - r] },
			{ on: (p) => Math.abs(p.y - landing.y - landing.height) < 1e-6, along: (p) => p.x, span: [landing.x + r, landing.x + landing.width - r] },
			{ on: (p) => Math.abs(p.x - landing.x) < 1e-6, along: (p) => p.y, span: [landing.y + r, landing.y + landing.height - r] },
			{ on: (p) => Math.abs(p.x - landing.x - landing.width) < 1e-6, along: (p) => p.y, span: [landing.y + r, landing.y + landing.height - r] },
		];
		for (const side of sides) {
			const stops = [side.span[0], ...feet.filter(side.on).map(side.along), side.span[1]].sort((a, b) => a - b);
			const gap = Math.max(...stops.slice(1).map((stop, index) => stop - stops[index]));
			assert.ok(gap <= 2 * slot + 1e-9, `${name}: no gap along any side (${gap.toFixed(1)}px)`);
		}
	}
	const { pieces } = createFinaleConfettiBurst(puffOn(CARD));
	for (const hue of FLASH_ROVO_COLORS) {
		const share = pieces.filter((piece) => piece.front === hue).length / pieces.length;
		assert.ok(share > 0.2 && share < 0.3, `${hue} in proportion (${share.toFixed(2)})`);
	}
});

test("a drop's puff carries the finale's own variety: coiled ribbons, sequins, curled paper rects and discs, in a mixed scatter of poses", () => {
	const { createFinaleConfettiBurst, finaleConfettiRandom, FINALE_CONFETTI_SEED, SMALL_CONFETTI_TIMING: T } = load();
	const finale = createFinaleConfettiBurst(STAGE).pieces;
	const puffs = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((id) => createFinaleConfettiBurst(puffOn(LANDINGS.stack), finaleConfettiRandom(FINALE_CONFETTI_SEED + id)).pieces);
	// Regression: the puff once dropped the ribbons (the swirly ones) and kept only paper and sequins.
	const looks = [["ribbon", "ribbon", 0.07], ["sequin", "disc", 0.21], ["paper", "disc", 0.72 * 0.12], ["paper", "rect", 0.72 * 0.88]];
	for (const [material, shape, expected] of looks) {
		const share = (pieces) => pieces.filter((piece) => piece.material === material && piece.shape === shape).length / pieces.length;
		assert.ok(Math.abs(share(puffs) - expected) < 0.025, `${material} ${shape}s in the cannons' share (${share(puffs).toFixed(3)} of ${puffs.length})`);
		assert.ok(Math.abs(share(finale) - expected) < 0.04, `as the cannons themselves fire them (${share(finale).toFixed(3)})`);
	}
	for (const landing of [CARD, LANDINGS.stack]) assert.ok(createFinaleConfettiBurst(puffOn(landing)).pieces.some((piece) => piece.shape === "ribbon"), "every card's puff throws ribbons");
	// The cannons' own looks, at the puff's 0.7 size.
	const within = (value, low, high) => value >= low - 1e-9 && value <= high + 1e-9;
	const of = (shape) => puffs.filter((piece) => piece.shape === shape);
	for (const ribbon of of("ribbon")) {
		const { length, width, arc, pitch } = ribbon.size;
		assert.ok(within(length, 56, 87.5) && within(width, 3.15, 4.2), "long satin ribbons");
		assert.ok(within(arc, 0.8 * 2 * Math.PI, 1.4 * 2 * Math.PI) && within(pitch, 0.24, 0.4), "coiled through whole turns, at a helical pitch");
	}
	for (const rect of of("rect")) assert.ok(within(rect.size.length, 6.3, 9.8) && within(rect.size.width / rect.size.length, 0.45, 0.65), "paper rectangles");
	for (const disc of of("disc")) assert.ok(within(disc.size.length, 4.2, 6.3) && disc.size.width === disc.size.length, "round discs");
	const paper = puffs.filter((piece) => piece.material === "paper").map((piece) => piece.size.arc);
	// Regression: the puff once flattened its paper to half the cannons' bend.
	assert.ok(paper.every((arc) => within(arc, 0.2, 1)) && mean(paper) > 0.5 && Math.max(...paper) > 0.95, `paper curls as the cannons' does (mean ${mean(paper).toFixed(2)} rad)`);
	assert.ok(puffs.filter((piece) => piece.material === "sequin").every((piece) => piece.size.arc === 0.05), "sequins all but flat");
	// The poses the GPU turns them to (`confettiTurn`) as the fade begins: the share turned
	// face down, and how their lengths lie across the page, by quarter turn.
	const scatter = (pieces) => {
		const bins = [0, 0, 0, 0];
		let backs = 0;
		for (const piece of pieces) {
			const elapsed = T.fadeStart - piece.delay;
			const { phase, start, rest, decay } = piece.spin;
			const angle = phase + rest * elapsed + (start - rest) * (1 - Math.exp(-decay * elapsed)) / decay;
			const [c, s, k] = [Math.cos(angle), Math.sin(angle), piece.axis];
			// The turned face normal's z (toward the viewer), and the turned length axis.
			if (c + (1 - c) * k.z ** 2 < 0) backs += 1;
			const lying = Math.atan2(k.z * s + (1 - c) * k.x * k.y, c + (1 - c) * k.x ** 2);
			if (piece.shape !== "disc") bins[Math.min(3, Math.floor(((lying + Math.PI) % Math.PI) / (Math.PI / 4)))] += 1;
		}
		const long = bins.reduce((sum, count) => sum + count);
		return { backs: backs / pieces.length, bins: bins.map((count) => count / long) };
	};
	// Regression: every piece once settled face up, its length within ~20° of horizontal.
	const puff = scatter(puffs);
	const cannons = scatter(finale);
	assert.ok(puff.backs > 0.2 && Math.abs(puff.backs - cannons.backs) < 0.08, `both faces show, as in the finale (${puff.backs.toFixed(2)} turned over; ${cannons.backs.toFixed(2)})`);
	assert.ok(puff.bins.every((share, index) => share > 0.12 && Math.abs(share - cannons.bins[index]) < 0.08), `lengths lie every way across the page, as in the finale (${puff.bins.map((share) => share.toFixed(2)).join("/")})`);
});

test("the puff skids out low along the page, decelerating hard like dust, and never crosses back over the cards it came from", () => {
	const { createFinaleConfettiBurst, finaleConfettiCameraDistance, finaleConfettiFree, finaleConfettiRandom, FINALE_CONFETTI_PAD, FINALE_CONFETTI_SEED, SMALL_CONFETTI_TIMING: T } = load();
	const lens = finaleConfettiCameraDistance(STAGE.height);
	const gone = T.fadeStart + T.fade;
	const settled = {};
	for (const [name, landing] of Object.entries(LANDINGS)) {
		const stage = puffOn(landing);
		// The renderer draws each drop's puff afresh, seeded by its show.
		for (const id of [1, 2, 3]) {
			const { pieces } = createFinaleConfettiBurst(stage, finaleConfettiRandom(FINALE_CONFETTI_SEED + id));
			let nearest = Infinity;
			for (const piece of pieces) {
				const reach = quadReach(piece, FINALE_CONFETTI_PAD);
				for (let time = piece.delay; time <= gone; time += 1 / 120) {
					const at = finaleConfettiFree(piece, time);
					// Its whole quad, with its own lift and sway: it sets off clear of the edge and only ever leaves it.
					nearest = Math.min(nearest, outside(landing, projected(lens, stage, at)) - reach);
					assert.ok(at.z > -3 && at.z < lens * 0.05, `${name}: low to the page, and in focus`);
				}
			}
			assert.ok(nearest > -1e-6, `${name}: drawn clear of the cards throughout (${nearest.toFixed(2)}px at its nearest)`);
			// Regression: dust left square to each side, it parted at every corner, leaving a notch.
			const corners = [0, 0, 0, 0];
			for (const piece of pieces) {
				const at = finaleConfettiFree(piece, T.fadeStart);
				const right = at.x > landing.x + landing.width;
				const below = at.y > landing.y + landing.height;
				if ((right || at.x < landing.x) && (below || at.y < landing.y)) corners[(right ? 1 : 0) + (below ? 2 : 0)] += 1;
			}
			// Fanned, over a ninth of the dust settles beyond the corners (squared off, under a thirteenth).
			assert.ok(corners.every((count) => count >= 1) && corners.reduce((sum, count) => sum + count) > pieces.length * 0.09, `${name}: the ring rounds every corner (${corners.join("/")} of ${pieces.length})`);
		}
		const { pieces } = createFinaleConfettiBurst(stage);
		const distance = (time) => pieces.map((piece) => outside(landing, finaleConfettiFree(piece, time)));
		const travelled = (time) => mean(pieces.map((piece) => {
			const at = finaleConfettiFree(piece, time);
			return Math.hypot(at.x - piece.origin.x, at.y - piece.origin.y);
		}));
		const rest = travelled(gone);
		assert.ok(travelled(0.1) > 0.4 * rest, `${name}: a fast puff (${(travelled(0.1) / rest).toFixed(2)} of the way by 0.1s)…`);
		assert.ok(travelled(0.4) > 0.9 * rest, `${name}: …spent within 0.4s…`);
		const drift = mean(pieces.map((piece) => {
			const a = finaleConfettiFree(piece, T.fadeStart);
			const b = finaleConfettiFree(piece, gone);
			return Math.hypot(a.x - b.x, a.y - b.y);
		}));
		assert.ok(drift < 4, `${name}: …so the dust lies all but still as it fades (${drift.toFixed(1)}px)`);
		settled[name] = distance(T.fadeStart).sort((a, b) => a - b);
	}
	const { card, stack } = settled;
	assert.ok(card[card.length >> 1] < 45, `most settles close in (median ${card[card.length >> 1].toFixed(0)}px)…`);
	assert.ok(card.filter((reach) => reach > 70).length / card.length > 0.1, "…and a few flecks skid farther");
	assert.ok(card.at(-1) > 80 && card.at(-1) < 125, `one card's dust reaches tens of px, not across the board (${card.at(-1).toFixed(0)}px)`);
	assert.ok(stack.at(-1) > card.at(-1) * 1.15 && stack.at(-1) < 160, `a heavier stack puffs wider, within a cap (${stack.at(-1).toFixed(0)}px)`);
});

test("the launch streak, swept back to where each piece set off, stops at the landing's edge", () => {
	const { createFinaleConfettiBurst, finaleConfettiCameraDistance, finaleConfettiFree, finaleConfettiRandom, FINALE_CONFETTI_PAD, FINALE_CONFETTI_SEED } = load();
	const { shutter, focus } = loadLook();
	const lens = finaleConfettiCameraDistance(STAGE.height);
	// The piece shader sweeps each quad's trailing half back over `(1 + 5 launch)` shutters,
	// longest at the instant of launch. A shorter exposure sweeps back over less of the
	// same path, so the longest bounds every frame's streak.
	const exposure = shutter * 6;
	for (const [name, landing] of Object.entries(LANDINGS)) {
		const stage = puffOn(landing);
		let tipNearest = Infinity;
		let quadNearest = Infinity;
		for (const id of [1, 2, 3]) {
			for (const piece of createFinaleConfettiBurst(stage, finaleConfettiRandom(FINALE_CONFETTI_SEED + id)).pieces) {
				// Every vertex of the drawn quad, whatever its turn, lies within this of the swept path.
				const reach = quadReach(piece, FINALE_CONFETTI_PAD);
				for (let time = piece.delay + 1 / 240; time <= piece.delay + 0.2; time += 1 / 240) {
					const center = finaleConfettiFree(piece, time);
					assert.ok(center.z < focus * lens, `${name}: in focus, so the quad's margin is its pad alone`);
					const head = projected(lens, stage, center);
					// Right after launch the swept-back centre clamps to where the piece set off.
					const tail = projected(lens, stage, finaleConfettiFree(piece, time - exposure));
					const streak = Math.hypot(head.x - tail.x, head.y - tail.y);
					if (streak > 0) {
						const tip = { x: tail.x - (head.x - tail.x) / streak * reach, y: tail.y - (head.y - tail.y) / streak * reach };
						tipNearest = Math.min(tipNearest, outside(landing, tip));
					}
					for (let step = 0; step <= 8; step++) {
						const along = { x: tail.x + (head.x - tail.x) * step / 8, y: tail.y + (head.y - tail.y) * step / 8 };
						quadNearest = Math.min(quadNearest, outside(landing, along) - reach);
					}
				}
			}
		}
		// Regression: swept back to the border itself, the trailing tips outlined the card's edge for ~70ms.
		assert.ok(tipNearest > -1e-6, `${name}: the streak's trailing tip stops at the edge (${tipNearest.toFixed(2)}px at its nearest)`);
		assert.ok(quadNearest > -1e-6, `${name}: and no vertex of the swept quad reaches over the card (${quadNearest.toFixed(2)}px)`);
	}
});

test("the puff is a gentler, finer show than the finale's: slower, smaller, calmer", () => {
	const { createFinaleConfettiBurst } = load();
	const puff = createFinaleConfettiBurst(puffOn(CARD)).pieces;
	const finale = createFinaleConfettiBurst(STAGE).pieces;
	const speed = (piece) => Math.hypot(piece.velocity.x, piece.velocity.y, piece.velocity.z);
	assert.ok(mean(puff.map(speed)) < mean(finale.map(speed)) * 0.3, "a puff, not a cannon");
	assert.ok(mean(puff.map((piece) => piece.size.length)) < mean(finale.map((piece) => piece.size.length)) * 0.8, "smaller pieces");
	assert.ok(puff.every((piece) => piece.fall === 0), "no fall down the screen: seen from above there is no down");
	assert.ok(mean(puff.map((piece) => piece.spin.start)) < mean(finale.map((piece) => piece.spin.start)) * 0.7, "a calmer tumble…");
	const rest = (pieces, ribbon) => pieces.filter((piece) => (piece.shape === "ribbon") === ribbon).map((piece) => piece.spin.rest);
	assert.ok(Math.max(...rest(puff, false)) < Math.min(...rest(finale, false)), "…that, for paper and sequins, dies with the launch…");
	assert.ok(Math.min(...rest(puff, true)) > Math.max(...rest(puff, false)), "…while a ribbon's coil keeps twisting");
});

test("a drop's puff flies free (no vortex, no Done column), seeded, with finite GPU attributes", () => {
	const { createFinaleConfettiBurst, finaleConfettiCenter, finaleConfettiFree, finaleConfettiGather, finaleConfettiRandom, packFinaleConfettiBurst, FINALE_CONFETTI_SEED, FINALE_CONFETTI_TIMING: T } = load();
	const stage = puffOn(CARD);
	const small = createFinaleConfettiBurst(stage);
	for (const piece of small.pieces) {
		assert.equal(piece.gather, null, "a puff has no destination to gather into");
		for (const time of [0.1, 0.6, T.gatherStart, T.gathered]) {
			assert.deepEqual(finaleConfettiCenter(piece, time), finaleConfettiFree(piece, time));
			assert.equal(finaleConfettiGather(piece, time), 0);
		}
	}
	const attributes = packFinaleConfettiBurst(small);
	for (const [name, { array }] of Object.entries(attributes)) assert.ok(array.every(Number.isFinite), `${name} is finite`);
	assert.ok(attributes.aGather.array.every((value, index) => index % 4 === 3 || value === 0), "the GPU receives no pull or vortex");
	assert.ok(attributes.aSink.array.every((value) => value === 0), "no Done-column target");
	assert.deepEqual(createFinaleConfettiBurst(stage), small, "the same drop, the same puff");
	const next = createFinaleConfettiBurst(stage, finaleConfettiRandom(FINALE_CONFETTI_SEED + 1));
	assert.notDeepEqual(next.pieces, small.pieces, "each drop's puff is drawn afresh");
	const z = small.pieces.map((piece) => finaleConfettiFree(piece, 0.6).z);
	assert.ok(z.every((value, index) => index === 0 || value >= z[index - 1]), "drawn far to near: the highest dust on top");
	assert.deepEqual(createFinaleConfettiBurst(STAGE).pieces, createFinaleConfettiBurst({ ...STAGE, size: "large" }).pieces, "the finale's burst remains the default");
	// A degenerate landing still puffs, from a point, rather than producing NaNs.
	const point = packFinaleConfettiBurst(createFinaleConfettiBurst(puffOn({ x: 700, y: 400, width: 0, height: 0, radius: 0 })));
	for (const [name, { array }] of Object.entries(point)) assert.ok(array.length > 0 && array.every(Number.isFinite), `${name} is finite for a point`);
});

test("the puff settles sooner than the cannons' old small burst, on the resolved VPK duration tokens", () => {
	const { SMALL_CONFETTI_TIMING: T } = load();
	const css = readFileSync("app/tailwind-theme.css", "utf8");
	const token = (name) => Number(css.match(new RegExp(`--duration-${name}:\\s*(\\d+)ms`))[1]) / 1000;
	assert.equal(T.fadeStart, token("slowest"), "the dust lies a beat once its launch is spent…");
	assert.equal(T.fade, token("slower"), "…then settles away");
	// Regression: the corner burst's 1.2s hang and 0.25s fade outstayed a single card's drop.
	assert.ok(T.fadeStart + T.fade <= 1, "gone within a second");
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

test("the column's glow pulses in once, briefly, as the pull begins, then brightens as the pieces land", () => {
	const { createFinaleConfettiBurst, finaleConfettiCharge, finaleConfettiGlow, FINALE_CONFETTI_TIMING: T } = load();
	const burst = createFinaleConfettiBurst(STAGE);
	const glow = (time) => finaleConfettiGlow(time, finaleConfettiCharge(burst, time));
	const start = T.gatherStart;
	// Regression: it glowed in and set off while the pieces still hung in bullet time.
	for (let time = 0; time <= start; time += 0.01) assert.equal(glow(time), 0, "dark through the launch and the hang");
	// Regression: it popped on as the vortex opened, a third of its brightness in one frame.
	let steepest = 0;
	for (let time = 0; time < T.gathered; time += 1 / 120) steepest = Math.max(steepest, glow(time + 1 / 60) - glow(time));
	// A quick swell from nothing (its brief window) rises at most ~0.13 a frame; the pop was 0.35.
	assert.ok(steepest < 0.15, `it glows in from nothing, never popping on (${steepest.toFixed(3)} in a frame)`);
	// One pulse: it swells past the brightness it sets off at, then eases back to it.
	const samples = [];
	for (let time = start; time <= start + T.glowIn + 1e-9; time += 0.005) samples.push(glow(time));
	const turns = samples.slice(1, -1).map((value, index) => Math.sign(value - samples[index]) - Math.sign(samples[index + 2] - value));
	assert.equal(turns.filter((turn) => turn > 0).length, 1, "one swell…");
	assert.equal(turns.filter((turn) => turn < 0).length, 0, "…with no second beat…");
	assert.ok(Math.max(...samples) > glow(start + T.glowIn) * 1.15, "…that reads as a pulse…");
	assert.ok(Math.abs(glow(start + T.glowIn) - 0.65) < 1e-9, "…easing back as the pull gets going, before any piece lands");
	assert.ok(start + T.glowIn < T.firstArrival);
	// Regression: it pulsed at the top for twice as long, lingering there before the trace.
	assert.ok(T.glowIn <= T.gatherSpread + 1e-9, "brief: no longer than the pieces take to join the stream");
	let previous = 0;
	for (let time = start + T.glowIn; time <= T.gathered - T.glowOut; time += 0.01) {
		assert.ok(glow(time) >= previous - 1e-12 && glow(time) <= 1, "it only brightens with the arrivals, and never past full");
		previous = glow(time);
	}
	assert.ok(glow(T.gathered - T.glowOut) > glow(start + T.glowIn) + 0.1, "the pieces landing on it brighten it before it is spent");
});

test("the border glow is spent as the last piece lands, and stays dark however late the flash ignites", () => {
	const { createFinaleConfettiBurst, finaleConfettiCharge, finaleConfettiGlow, finaleConfettiRealTime: real, finaleConfettiShowTime: show, FINALE_CONFETTI_TIMING: T, CUE } = load();
	const { glowMeet } = loadLook();
	const burst = createFinaleConfettiBurst(STAGE);
	// The envelope of everything the column's glow draws: its stroke, its bloom, and the even band and halo.
	const glow = (time) => finaleConfettiGlow(time, finaleConfettiCharge(burst, time));
	// Milliseconds of real time from the moment the burst is absorbed (its last piece lands).
	const absorbed = real(T.gathered);
	const at = (ms) => show(absorbed + ms / 1000);
	const fadeFrom = T.gathered - T.glowOut;
	assert.ok(T.gatherStart + glowMeet * (T.gathered - T.gatherStart) < fadeFrom, "the two leads meet on the foot before it lets go, so the joined foot still burns for a beat");
	// It eases out across the last of the pull: the last arrivals lift it a hair as the ease sets
	// in, then it only dims.
	const fading = [];
	for (let time = fadeFrom; time <= T.gathered + 1e-9; time += 0.005) fading.push({ time, value: glow(time) });
	const brightest = fading.reduce((best, sample) => sample.value > best.value ? sample : best);
	assert.ok(brightest.value < glow(fadeFrom) + 0.05 && brightest.time < fadeFrom + T.glowOut / 3, "no flare as it is spent");
	fading.filter((sample) => sample.time >= brightest.time).forEach((sample, index, after) => {
		if (index > 0) assert.ok(sample.value <= after[index - 1].value + 1e-12, "it only dims once spent");
	});
	const fade = (absorbed - real(fadeFrom)) * 1000;
	const entrance = (real(T.gatherStart + T.glowIn) - real(T.gatherStart)) * 1000;
	assert.ok(fade > 150 && fade < 200 && fade < entrance - 100, `a brisk exit, well under its entrance (${fade.toFixed(0)}ms vs ${entrance.toFixed(0)}ms)`);
	assert.ok(glow(at(-50)) < 0.6, "already half gone as the last pieces pour in");
	// Regression: it held at full on the foot until the flash's release reached the renderer, then
	// bloomed outward as it went, ~110ms past the absorption (and as long again as the main thread stalled).
	assert.equal(glow(T.gathered), 0, "exactly dark at 0ms after the absorption…");
	// …and through the flash's whole sweep up the column, however late that ignites (a busy main
	// thread, the stall backstop), so nothing lingers on the border in its late travel either.
	for (let ms = 1000 / 120; ms <= (CUE.flashDuration + 3) * 1000; ms += 1000 / 120) assert.equal(glow(at(ms)), 0, `dark ${ms.toFixed(0)}ms after the absorption`);
});

test("the show explodes fast, drops into bullet time while the pieces hang, then rushes them in", () => {
	const { finaleConfettiRealTime: real, finaleConfettiShowTime: show, FINALE_CONFETTI_PACE: P, FINALE_CONFETTI_TIMING: T } = load();
	const pace = (at) => 1e-4 / (real(at + 1e-4) - real(at));
	assert.equal(real(0), 0);
	assert.ok(Math.abs(pace(T.volley / 2) - P.burst) < 1e-6, "the cannons explode fast…");
	assert.ok(Math.abs(pace((P.slow[1] + P.rush[0]) / 2) - P.hang) < 1e-6, "…the hang floats in bullet time…");
	assert.ok(Math.abs(pace((P.rush[1] + T.gathered) / 2) - P.pull) < 1e-6, "…and it picks up again to draw the pieces in");
	assert.ok(P.burst > 1.5 && P.hang < 0.6 && P.pull > 2 * P.hang);
	// Regression: at 2.6× the pieces were sucked into the column in ~0.5s.
	const pull = real(T.gathered) - real(T.gatherStart);
	assert.ok(pull > 0.65, `the pull is followable (${pull.toFixed(2)}s)`);
	assert.ok(P.slow[0] >= T.volley, "bullet time once the volley is out");
	assert.equal(P.rush[0], T.gatherStart, "the rush as the vortex opens");
	let previous = -1;
	for (let at = 0; at <= T.gathered + 0.5; at += 0.01) {
		assert.ok(real(at) > previous, "it never stops or runs backwards");
		assert.ok(Math.abs(show(real(at)) - at) < 1e-9, "and plays, holds and resumes on one exact clock");
		previous = real(at);
	}
	// Regression: held for most of the hang, bullet time dragged (~0.8s at half speed).
	const bullet = real(P.rush[0]) - real(P.slow[1]);
	assert.ok(bullet < 0.45, `bullet time is brief (${bullet.toFixed(2)}s)`);
	const flash = real(T.gathered);
	assert.ok(flash > 1.65 && flash < 1.9, `the flash may ignite ${flash.toFixed(2)}s after launch`);
});

test("the glow is traced on the burst's own clock: from the moment the pull begins, leaving bullet time slowly, then rushing down", () => {
	const { finaleConfettiTrace, finaleConfettiRealTime: real, finaleConfettiShowTime: show, FINALE_CONFETTI_TIMING: T } = load();
	const start = T.gatherStart;
	// Regression: it traced while the pieces still hung in bullet time.
	for (let time = 0; time <= start; time += 0.01) assert.equal(finaleConfettiTrace(time), 0, "not before the pieces start to pour in…");
	// Regression: it glowed in and pulsed in place at the top before setting off.
	assert.ok(finaleConfettiTrace(start + 1 / 60) > 0, "…already moving as it appears…");
	assert.equal(finaleConfettiTrace(T.gathered), 1, "…to the last piece landing");
	assert.equal(finaleConfettiTrace(T.gathered + 1), 1);
	// Steady in show time (paced by time, not the pieces, which once raced it down in 0.6s)…
	const step = 0.05;
	const rate = step / (T.gathered - start);
	for (let at = start; at < T.gathered - 1e-9; at += step) assert.ok(Math.abs(finaleConfettiTrace(at + step) - finaleConfettiTrace(at) - rate) < 1e-9);
	// …so in real time it keeps the burst's pace. Regression: its own ease read as no speed-up at all.
	const perSecond = (at) => (finaleConfettiTrace(show(real(at) + 0.02)) - finaleConfettiTrace(at)) / 0.02;
	assert.ok(perSecond(T.gathered - 0.2) > 2 * perSecond(start + 0.05), "it speeds up to over twice the pace it set off at");
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
