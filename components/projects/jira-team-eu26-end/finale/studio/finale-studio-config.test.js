const assert = require("node:assert/strict");
const test = require("node:test");

const {
	DEFAULT_FINALE_STUDIO,
	finaleAppearanceFromSearch,
	finaleStudioPieceStyles,
	normalizeFinaleStudio,
	orderedByStudio,
	studioCardOn,
	studioPieceFor,
	studioPieceOn,
	studioPiecePadding,
	studioPieceScale,
	studioPieceTile,
	studioWallIsU1F,
	studioWithCard,
	studioWithPiece,
	U1F_WALL,
} = require("./finale-studio-config.ts");

test("lanyard identity, avatar and pulse settings survive save normalization and reach every player", () => {
	const changed = studioWithPiece(DEFAULT_FINALE_STUDIO, "agentLanyard", {
		agentId: "codex", avatarId: "workflow-builder-flow", agentName: "My coding agent", animateGrid: false, pulseInterval: 6,
	});
	const saved = normalizeFinaleStudio(JSON.parse(JSON.stringify(changed)));
	assert.deepEqual(finaleStudioPieceStyles({}, saved).agentLanyard, {
		agentId: "codex", avatarId: "workflow-builder-flow", agentName: "My coding agent", animateGrid: false, pulseInterval: 6,
	});
	const reset = studioWithPiece(saved, "agentLanyard", {
		agentId: undefined, avatarId: undefined, agentName: undefined, animateGrid: undefined, pulseInterval: undefined,
	});
	assert.deepEqual(reset.pieces, {});
	assert.deepEqual(finaleStudioPieceStyles({}, reset), {});
});

test("lanyard settings reject malformed values and bound the pulse interval and display name", () => {
	const invalid = normalizeFinaleStudio({ pieces: { agentLanyard: { agentId: "../bad", avatarId: 42, agentName: "   ", animateGrid: "false", pulseInterval: Infinity } } });
	assert.deepEqual(invalid.pieces, {});
	const bounded = normalizeFinaleStudio({ pieces: { agentLanyard: { agentName: "x".repeat(100), pulseInterval: -4 } } });
	assert.equal(bounded.pieces.agentLanyard.agentName.length, 80);
	assert.equal(bounded.pieces.agentLanyard.pulseInterval, 2);
});

test("any settings read as a valid config, out-of-range values clamped and the unreadable dropped", () => {
	assert.deepEqual(normalizeFinaleStudio(null), DEFAULT_FINALE_STUDIO);
	const studio = normalizeFinaleStudio({
		version: 2,
		pieces: { search: { on: false, scale: 9, play: "sometimes", surface: false, tile: false }, voice: "nope", chat: { tile: true } },
		order: ["a", "b", "a", 3],
		cards: { "poster-1": { on: false }, "print-0": { on: "no" }, flow: 3 },
		swaps: { "library-search": "voice", broken: 4 },
		gaps: { x: -10, y: 400 },
	});
	assert.deepEqual(studio.cards, { "poster-1": { on: false } });
	assert.deepEqual(studio.pieces, { search: { on: false, surface: false, tile: false, scale: 1.6 } });
	assert.equal(studioPieceTile(studio, "search"), false);
	assert.equal(studioPieceTile(studio, "chat"), true);
	assert.deepEqual(studio.order, ["a", "b"]);
	assert.deepEqual(studio.swaps, { "library-search": "voice" });
	assert.deepEqual(studio.gaps, { x: 0, y: 160 });
	assert.equal(normalizeFinaleStudio({ order: [] }).order, null);
});

test("a piece is on the wall, at its own size, showing itself, until the studio says otherwise", () => {
	const studio = normalizeFinaleStudio({ pieces: { search: { on: false }, voice: { scale: 1.2 } }, swaps: { "library-chat": "voice" } });
	assert.equal(studioPieceOn(studio, "search"), false);
	assert.equal(studioPieceOn(studio, "chat"), true);
	assert.equal(studioPieceScale(studio, "voice"), 1.2);
	assert.equal(studioPieceScale(studio, "chat"), 1);
	assert.equal(studioPieceFor(studio, "library-chat", "chat"), "voice");
	assert.equal(studioPieceFor(studio, "library-search", "search"), "search");
});

test("the keynote's cards are on the wall until turned off, and back on clears the entry", () => {
	const off = studioWithCard(DEFAULT_FINALE_STUDIO, "poster-1", false);
	assert.equal(studioCardOn(off, "poster-1"), false);
	assert.equal(studioCardOn(off, "poster-0"), true);
	assert.deepEqual(studioWithCard(off, "poster-1", true).cards, {});
});

test("the composer's order puts the cards it names first, in its order, the rest after in their own", () => {
	const items = ["a", "b", "c", "d"].map((key) => ({ key }));
	assert.equal(orderedByStudio(items, null), items);
	assert.deepEqual(orderedByStudio(items, ["c", "a", "gone"]).map((item) => item.key), ["c", "a", "b", "d"]);
});

test("a piece's settings change one at a time, and an entry back at its defaults goes away", () => {
	const off = studioWithPiece(DEFAULT_FINALE_STUDIO, "search", { on: false });
	assert.deepEqual(off.pieces, { search: { on: false } });
	const restyled = studioWithPiece(off, "search", { play: "loop" });
	assert.deepEqual(restyled.pieces, { search: { on: false, play: "loop" } });
	assert.deepEqual(studioWithPiece(restyled, "search", { on: undefined, play: undefined }).pieces, {});
});

test("the studio's cards and play modes lay over the kit's piece styles", () => {
	const base = { search: { surface: true, play: "once", rest: 2 }, chat: { play: "loop" } };
	const studio = normalizeFinaleStudio({ pieces: { search: { surface: false }, voice: { play: "live" }, chat: { scale: 1.1 } } });
	assert.deepEqual(finaleStudioPieceStyles(base, studio), {
		search: { surface: false, play: "once", rest: 2 },
		chat: { play: "loop" },
		voice: { play: "live" },
	});
});

test("a page address sets the theme on load, nothing else", () => {
	assert.equal(finaleAppearanceFromSearch("?finale=8.17&appearance=dark"), "dark");
	assert.equal(finaleAppearanceFromSearch("?appearance=sepia"), null);
	assert.equal(finaleAppearanceFromSearch(""), null);
});

test("there is one wall, U1F's: a copy without one (a browser's, an old file) takes it, and its old px gaps go", () => {
	const old = normalizeFinaleStudio({ version: 1, pieces: { search: { on: false } }, order: ["a"], gaps: { x: 28, y: 28 } });
	assert.deepEqual(old.wall, U1F_WALL);
	assert.equal(old.gaps, null);
	assert.deepEqual(old.pieces, { search: { on: false } });
	assert.deepEqual(old.order, ["a"]);
	assert.equal(studioWallIsU1F(old), true);
	assert.deepEqual(normalizeFinaleStudio({}).wall, U1F_WALL);
});

test("the wall's look reads in the stage's own terms, clamped, anything unreadable taking U1F's", () => {
	const tuned = normalizeFinaleStudio({ version: 2, wall: { zoom: 9, density: "sparse", length: 1, pace: "fast" }, gaps: { x: 40, y: 20 } });
	assert.deepEqual(tuned.wall, { zoom: 1, density: "dense", length: 10, pace: 0.3, padding: { x: 40, y: 40 } });
	assert.deepEqual(tuned.gaps, { x: 40, y: 20 });
	assert.equal(studioWallIsU1F(tuned), false);
});

test("the saved file is the one wall, U1F's", () => {
	const saved = normalizeFinaleStudio(require("../data/finale-studio.json"));
	assert.equal(saved.version, 2);
	assert.equal(studioWallIsU1F(saved), true);
});

test("every wall tile is padded alike, 40 pt each way, unless a piece has its own (wider and shorter, say)", () => {
	assert.deepEqual(DEFAULT_FINALE_STUDIO.wall.padding, { x: 40, y: 40 });
	const studio = normalizeFinaleStudio({ version: 2, wall: { padding: { x: 60, y: 20 } }, pieces: { search: { padding: { x: 300, y: -5 } }, chat: { padding: { x: 10 } } } });
	assert.deepEqual(studio.wall.padding, { x: 60, y: 20 });
	assert.deepEqual(studioPiecePadding(studio, "search"), { x: 160, y: 0 });
	assert.deepEqual(studioPiecePadding(studio, "chat"), { x: 60, y: 20 });
	assert.deepEqual(studioWithPiece(studio, "search", { padding: undefined }).pieces, {});
});
