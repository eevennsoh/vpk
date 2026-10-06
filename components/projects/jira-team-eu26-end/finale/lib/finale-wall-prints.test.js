const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

/*
 * Each work item has its own print slot, GL sheet, cursor hold and landing
 * accents. The slot's spare space must not become extra paper or shadow.
 */

const ENTRY = `
export * from "./finale-wall-layout";
export * from "./finale-wall-motion";
export * from "./finale-wall-cursors";
export { hash01 } from "./finale-math";
export { CUE } from "../data/finale-cues";
export { finaleBentoLayout, FINALE_FEATURES } from "../data/finale-stories";
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
	}).outputFiles[0].text, "finale-wall-prints-harness.cjs");
	return motionModule;
}

const VIEWPORTS = [
	{ width: 1728, height: 1117 },
	{ width: 1920, height: 1080 },
	{ width: 1024, height: 768 },
];

/** Done cards print a little apart in height (one title wraps, another does not); a board card is 388.5 × 185 with 8px corners. */
const CANVAS = { width: 777, height: 370 };
function printOf(code) {
	const taller = Number(code.replace(/\D/gu, "")) % 3;
	return { width: CANVAS.width, height: CANVAS.height + taller * 24, dataset: { finaleCorner: String(8 / 388.5) } };
}

function sceneFor(viewport, missing = new Set()) {
	const m = load();
	const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
	const bento = m.finaleBentoLayout(viewport, scale);
	const features = m.FINALE_FEATURES;
	const geometry = m.wallGeometry(scale, viewport);
	const wall = m.buildFinaleWall(geometry, bento, features, []);
	const drops = m.bentoDrops(wall, bento.slots.map((slot) => slot.rect), bento.title);
	const prints = m.wallPrintShapes((code) => (missing.has(code) ? undefined : printOf(code)));
	return { m, viewport, geometry, wall, drops, prints };
}

/** The first arriving print slots holding `count` cards. */
function arrivingPrints(m, wall, count, take = 2) {
	const found = [];
	for (let column = 0; column < 80 && found.length < take; column += 1) {
		for (const slot of wall.bucket(column)) {
			if (slot.content.kind === "print" && slot.content.codes.length === count && m.slotDescent(slot, wall) && found.length < take) found.push(slot);
		}
	}
	assert.equal(found.length, take, `arriving ${count}-card print slots`);
	return found;
}

/** The old DOM stack (`Prints`, before each card was its own), in slot px: the layout every card must keep. */
function oldStack(size, codes, print, gap) {
	const share = (size.height - gap * (codes.length - 1)) / codes.length;
	const cards = codes.map((code) => print(code)).filter(Boolean);
	const fits = cards.map((each) => Math.min(size.width / each.width, share / each.height));
	const total = cards.reduce((sum, each, index) => sum + each.height * fits[index], 0) + gap * (cards.length - 1);
	let y = (size.height - total) / 2;
	return cards.map((each, index) => {
		const rect = { x: (size.width - each.width * fits[index]) / 2, y, width: each.width * fits[index], height: each.height * fits[index] };
		y += rect.height + gap;
		return rect;
	});
}

const close = (a, b, epsilon = 1e-6) => Math.abs(a - b) < epsilon;
const sameRect = (a, b, epsilon = 1e-6) => close(a.x, b.x, epsilon) && close(a.y, b.y, epsilon) && close(a.width, b.width, epsilon) && close(a.height, b.height, epsilon);
const centre = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

/** A print slot's card `card` on screen at `time`. */
function cardOnScreen(m, slot, card, time, geometry) {
	const at = m.slotOnScreen(slot, m.wallOffset(time, geometry), geometry);
	return { x: at.x + card.rect.x, y: at.y + card.rect.y, width: card.rect.width, height: card.rect.height };
}

/** When each of a print slot's cards touches down, read off its landing accents (live from touchdown). */
function touchdowns(m, slot, wall, drops, prints) {
	const descent = m.slotDescent(slot, wall);
	const time = descent.touchdown + 0.5;
	const landings = m.wallLandingsAt(time, wall, drops, prints);
	return slot.content.codes.map((_, index) => landings.find((landing) => landing.key === `${slot.key}#${index}`)?.touchdown);
}

test("an individual work item keeps its print's aspect and its own fitted rectangle", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, prints } = sceneFor(viewport);
		const gap = m.wallPrintGap(geometry);
		assert.ok(close(gap, (8 * geometry.typeScale) / m.WALL_SCALE), "the DOM stack's gap, scaled with the type");
		for (const count of [1]) {
			const [slot] = arrivingPrints(m, wall, count, 1);
			const cards = m.wallPrintCards(slot.rect, slot.content.codes, prints, gap);
			const before = oldStack(slot.rect, slot.content.codes, printOf, gap);
			assert.equal(cards.length, count);
			cards.forEach((card, index) => {
				assert.equal(card.index, index);
				assert.equal(card.code, slot.content.codes[index]);
				assert.ok(sameRect(card.rect, before[index], 1e-6), `${count}-card slot, card ${index}: where the stack always put it`);
				assert.ok(close(card.rect.width / card.rect.height, printOf(card.code).width / printOf(card.code).height, 1e-9), "at its print's own shape");
				assert.ok(card.rect.x >= -1e-9 && card.rect.y >= -1e-9 && card.rect.x + card.rect.width <= slot.rect.width + 1e-9 && card.rect.y + card.rect.height <= slot.rect.height + 1e-9, "inside its slot");
				assert.ok(close(card.radius, (8 / 388.5) * card.rect.width), "rounded as the board's card");
				if (index > 0) assert.ok(close(card.rect.y - (cards[index - 1].rect.y + cards[index - 1].rect.height), gap), "the stack's gap between cards");
			});
		}
		// An image that has not loaded must leave its single print absent.
		const [band] = arrivingPrints(m, wall, 1, 1);
		const missing = new Set([band.content.codes[0]]);
		const partial = m.wallPrintCards(band.rect, band.content.codes, sceneFor(viewport, missing).prints, gap);
		const expected = oldStack(band.rect, band.content.codes, (code) => (missing.has(code) ? undefined : printOf(code)), gap);
		assert.deepEqual(partial.map((card) => card.index), []);
		partial.forEach((card, index) => assert.ok(sameRect(card.rect, expected[index])));
	}
});

test("each of a print slot's Done cards is a GL sheet of its own, no larger than the card it shows, as are its shadow and landing accents", () => {
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, drops, prints } = sceneFor(viewport);
		for (const count of [1]) {
			for (const slot of arrivingPrints(m, wall, count)) {
				const cards = m.wallPrintCards(slot.rect, slot.content.codes, prints, m.wallPrintGap(geometry));
				const descent = m.slotDescent(slot, wall);
				const downs = touchdowns(m, slot, wall, drops, prints);
				for (const time of [descent.start - 0.2, (descent.start + descent.touchdown) / 2, Math.max(...downs) + 0.2]) {
					const sheets = m.wallSheetsAt(time, wall, drops, viewport, prints).filter((sheet) => sheet.key.startsWith(`card-${slot.key}`));
					assert.ok(!sheets.some((sheet) => sheet.key === `card-${slot.key}`), "no sheet spans the whole slot");
					assert.deepEqual(sheets.map((sheet) => sheet.key).sort(), cards.map((card) => `card-${slot.key}#${card.index}`).sort(), `${count} sheets for ${count} cards`);
					for (const sheet of sheets) {
						const card = cards[Number(sheet.key.split("#")[1])];
						assert.equal(sheet.print, card.code, "printed with its own card");
						assert.ok(close(sheet.pose.width, card.rect.width) && close(sheet.pose.height, card.rect.height), "the card's size, never the slot's");
						assert.ok(sheet.shadow && close(sheet.shadow.pose.width, card.rect.width) && close(sheet.shadow.pose.height, card.rect.height), "its shadow cast by the card alone");
						assert.ok(close(sheet.radius, card.radius), "rounded as the card is");
						assert.equal(sheet.pose.face, 0, "its print face up");
					}
				}
				// Landed, each sheet lies exactly on its DOM card.
				const landedAt = Math.max(...downs) + 0.2;
				for (const sheet of m.wallSheetsAt(landedAt, wall, drops, viewport, prints).filter((each) => each.key.startsWith(`card-${slot.key}#`))) {
					const card = cards[Number(sheet.key.split("#")[1])];
					const rect = cardOnScreen(m, slot, card, landedAt, geometry);
					assert.ok(sheet.pose.z === 0 && close(sheet.pose.x, centre(rect).x) && close(sheet.pose.y, centre(rect).y), "on its DOM card's rect");
				}
				// Each card's border glow traces that card.
				const landings = m.wallLandingsAt(Math.max(...downs) + 0.1, wall, drops, prints).filter((landing) => landing.key.startsWith(slot.key));
				assert.ok(!landings.some((landing) => landing.key === slot.key), "no accent traces the slot");
				assert.equal(landings.length, count, "one landing per card");
				for (const landing of landings) {
					const card = cards[Number(landing.key.split("#")[1])];
					assert.ok(sameRect(landing.rect, cardOnScreen(m, slot, card, Math.max(...downs) + 0.1, geometry), 1e-6), "the glow on the card's own rect");
					assert.ok(close(landing.radius, card.radius), "round its own corners");
				}
				assert.equal(new Set(landings.map((landing) => landing.seed)).size, count, "each with a look of its own");
			}
		}
	}
});

test("one printed work item arrives on its own and hands over to its own DOM card on every pass", () => {
	const { m, geometry, wall, drops, prints, viewport } = sceneFor(VIEWPORTS[0]);
	const [slot] = arrivingPrints(m, wall, 1, 1);
	const cards = m.wallPrintCards(slot.rect, slot.content.codes, prints, m.wallPrintGap(geometry));
	const descent = m.slotDescent(slot, wall);
	assert.equal(cards.length, 1, "one independently carried card");
	const waitingAt = descent.start - 0.2;
	const waiting = m.wallSheetsAt(waitingAt, wall, drops, viewport, prints).filter((sheet) => sheet.key.startsWith(`card-${slot.key}`));
	assert.equal(waiting.length, 1);
	assert.ok(waiting[0].pose.z > 0, "the single card waits up in the air");
	const downs = touchdowns(m, slot, wall, drops, prints);
	assert.ok(close(downs[0], descent.touchdown), "the one card lands on its own beat");
	// Each card's DOM card takes over from its own sheet, in the same place.
	const before = m.wallSlotPresence(slot, wall, drops, descent.touchdown, prints);
	assert.deepEqual(before.cards, [0]);
	assert.equal(before.opacity, 0, "nothing shows before the first hand-over");
	for (const [index, touchdown] of downs.entries()) {
		// Early in its hand-over: its DOM card coming up, its sheet still there.
		const crossfade = touchdown + m.CUE.handoff + 0.03;
		const presence = m.wallSlotPresence(slot, wall, drops, crossfade, prints);
		assert.equal(presence.opacity, 1, "the slot shows while any card does");
		assert.ok(presence.cards[index] > 0 && presence.cards[index] < 1, `card ${index} hands over on its own`);
		presence.cards.forEach((shown, other) => {
			if (downs[other] + m.CUE.handoff + 0.12 <= crossfade) assert.equal(shown, 1, "the cards above it are already over");
			if (downs[other] + m.CUE.handoff >= crossfade) assert.equal(shown, 0, "the ones below it still to come");
		});
		const sheet = m.wallSheetsAt(crossfade, wall, drops, viewport, prints).find((each) => each.key === `card-${slot.key}#${index}`);
		const rect = cardOnScreen(m, slot, cards[index], crossfade, geometry);
		assert.ok(sheet && close(sheet.pose.x, centre(rect).x) && close(sheet.pose.y, centre(rect).y), "its sheet still on its DOM card as they cross");
		assert.ok(!m.wallSheetsAt(touchdown + m.CUE.handoff + 0.13, wall, drops, viewport, prints).some((each) => each.key === `card-${slot.key}#${index}`), "then gone");
	}
	assert.equal(m.wallSlotPresence(slot, wall, drops, downs.at(-1) + m.CUE.handoff + 0.2, prints).cards.every((shown) => shown === 1), true);
	// A first arrival can be in the startup ramp. The next pass crosses the same entry line one wall period farther on.
	const next = wall.bucket(slot.bucket + wall.periodBuckets).find((each) => each.key.split(":").slice(1).join(":") === slot.key.split(":").slice(1).join(":"));
	const nextDescent = m.slotDescent(next, wall);
	assert.ok(close(m.wallOffset(nextDescent.start, geometry) - m.wallOffset(descent.start, geometry), wall.periodWidth), "the same entry position on the next pass");
	const nextDowns = touchdowns(m, next, wall, drops, prints);
	nextDowns.forEach((touchdown, index) => assert.ok(close(touchdown - downs[index], nextDescent.start - descent.start), "the same peel timing after the startup ramp"));
	// Both later passes are at full pace, so every card lands exactly one loop later.
	const third = wall.bucket(next.bucket + wall.periodBuckets).find((each) => each.key.split(":").slice(1).join(":") === slot.key.split(":").slice(1).join(":"));
	const loop = m.wallLoop(wall);
	touchdowns(m, third, wall, drops, prints).forEach((touchdown, index) => assert.ok(close(touchdown - nextDowns[index], loop, 1e-6), "seamless round the loop at full pace"));
});

test("a print slot with nothing printed yet comes down as one blank card over its slot, as its DOM stand-in fills it", () => {
	const { m, geometry, wall, drops, viewport } = sceneFor(VIEWPORTS[1]);
	const [slot] = arrivingPrints(m, wall, 1, 1);
	const none = m.wallPrintShapes(() => undefined);
	const descent = m.slotDescent(slot, wall);
	const sheet = m.wallSheetsAt(descent.touchdown + 0.1, wall, drops, viewport, none).find((each) => each.key.startsWith(`card-${slot.key}`));
	assert.equal(sheet.key, `card-${slot.key}`);
	assert.ok(sheet.print === null && sheet.pose.face === 1, "a blank tile");
	assert.ok(close(sheet.pose.width, slot.rect.width) && close(sheet.pose.height, slot.rect.height) && close(sheet.radius, geometry.radius));
	assert.equal(m.wallSlotPresence(slot, wall, drops, descent.touchdown + 0.1, none).cards, null, "its DOM slot shows as one card");
});

test("a teammate holding a work-item print carries exactly one card by its middle", () => {
	let found = 0;
	for (const viewport of VIEWPORTS) {
		const { m, geometry, wall, drops, prints } = sceneFor(viewport);
		for (let column = 0; column < 120; column += 1) {
			for (const slot of wall.bucket(column)) {
				if (slot.content.kind !== "print") continue;
				assert.equal(slot.content.codes.length, 1, "a cursor never carries a group of work items");
				const descent = m.slotDescent(slot, wall);
				const cursor = descent && m.wallCursorsAt(descent.touchdown, wall, drops, viewport, prints).find((each) => each.key === slot.key);
				if (!cursor) continue;
				found += 1;
				const [top] = m.wallPrintCards(slot.rect, slot.content.codes, prints, m.wallPrintGap(geometry));
				const rect = cardOnScreen(m, slot, top, descent.touchdown, geometry);
				assert.ok(close(cursor.x, rect.x + rect.width / 2, 0.5) && close(cursor.y, rect.y + rect.height / 2, 0.5), "its tip on the top card's middle as it lands");
			}
		}
	}
	assert.ok(found > 0, "some print slot is set down by hand");
});
