const assert = require("node:assert/strict");
const test = require("node:test");
const { existsSync } = require("node:fs");
const { registerHooks } = require("node:module");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../../../../..");
registerHooks({
	load(url, context, nextLoad) {
		return nextLoad(url, url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context);
	},
	resolve(specifier, context, nextResolve) {
		const target = specifier.startsWith("@/")
			? path.join(root, specifier.slice(2))
			: specifier.startsWith(".") && context.parentURL?.startsWith("file:")
				? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
				: null;
		if (target && existsSync(`${target}.ts`)) return nextResolve(pathToFileURL(`${target}.ts`).href, context);
		if (target && specifier.startsWith("@/")) return nextResolve(pathToFileURL(target).href, context);
		return nextResolve(specifier, context);
	},
});

const { slotBaseKey, wallInventory } = require("./studio-inventory.ts");
const { buildFinaleWall, keynoteItems, wallGeometry } = require("../lib/finale-wall-layout.ts");
const { finaleBentoLayout, FINALE_FEATURES, FINALE_STORIES } = require("../data/finale-stories.ts");
const { DEFAULT_FINALE_STUDIO, studioWithCard } = require("./finale-studio-config.ts");
const kit = require("../../../../../public/1p/rovo-stage-kit/pieces.json");

const slot = (key, content, reserved) => ({ key, bucket: 0, seed: 0, rect: { x: 0, y: 0, width: 10, height: 10 }, content, ...(reserved === undefined ? {} : { reserved }) });
const piece = (key, ...ids) => slot(key, { kind: "piece", pieces: ids.map((id) => ({ id, scale: 1 })) });

test("every card on the wall lands in one of the Library's lists, counted per piece and per card", () => {
	const slots = [
		piece("0:library-search", "search"),
		piece("1:library-search-added", "search"),
		piece("1:library-chat", "chat", "voice"),
		slot("0:poster-1", { kind: "poster", word: "Context", fill: "lime", ink: "black" }),
		slot("2:poster-1", { kind: "poster", word: "Context", fill: "lime", ink: "black" }),
		slot("0:gap-0", { kind: "title" }, 6),
	];
	const inventory = wallInventory(slots, new Set(["search", "chat", "voice"]), new Set(["poster-1"]));
	assert.deepEqual([...inventory.pieces], [["search", 2], ["chat", 1], ["voice", 1]]);
	assert.deepEqual([...inventory.keynote], [["poster-1", 2]]);
	assert.deepEqual(inventory.landings.map(slotBaseKey), ["gap-0"]);
	assert.deepEqual(inventory.unlisted, []);
	assert.equal(inventory.total, 6);
});

test("a card the Library has no entry for is reported, never silently dropped", () => {
	const slots = [piece("0:library-ghost", "ghost"), slot("0:strip-x", { kind: "strip", strip: "flow" })];
	const inventory = wallInventory(slots, new Set(["search"]), new Set(["flow"]));
	assert.deepEqual(inventory.unlisted.map(slotBaseKey), ["library-ghost", "strip-x"]);
	assert.equal(inventory.pieces.size + inventory.keynote.size, 0);
});

test("a longer wall's repeats count toward their own card", () => {
	const { repeatKey, wallRootKey } = require("./studio-inventory.ts");
	assert.equal(repeatKey("poster-1", 2), "poster-1#2");
	assert.equal(wallRootKey("poster-1#2"), "poster-1");
	assert.equal(wallRootKey("flow"), "flow");
	const slots = [slot("0:poster-1", { kind: "poster", word: "Context", fill: "lime", ink: "black" }), slot("4:poster-1#2", { kind: "poster", word: "Context", fill: "lime", ink: "black" })];
	assert.deepEqual([...wallInventory(slots, new Set(), new Set(["poster-1"])).keynote], [["poster-1", 2]]);
});

function studioWall(studio = DEFAULT_FINALE_STUDIO) {
	const viewport = { width: 1920, height: 1080 };
	const geometry = wallGeometry(1, viewport, studio);
	const order = FINALE_STORIES.map((story) => story.code);
	return {
		wall: buildFinaleWall(geometry, finaleBentoLayout(viewport, 1), FINALE_FEATURES, order, studio),
		keynote: keynoteItems(geometry, FINALE_FEATURES, order),
	};
}

test("the Library lists every real wall card, including each presenter lanyard once", () => {
	const { wall, keynote } = studioWall();
	const lanyards = keynote.filter((item) => item.content.kind === "lanyard");
	assert.deepEqual(lanyards.map((item) => item.key), ["lanyard-0", "lanyard-1", "lanyard-2"]);
	const inventory = wallInventory(wall.items, new Set(kit.map((piece) => piece.id)), new Set(keynote.map((item) => item.key)));
	assert.deepEqual(inventory.unlisted.map(slotBaseKey), []);
	for (const item of lanyards) {
		assert.equal(inventory.keynote.get(item.key), 1);
		const placed = wall.items.find((slot) => slotBaseKey(slot) === item.key);
		assert.deepEqual(placed.content, item.content);
		assert.deepEqual([placed.rect.width, placed.rect.height], [item.width, item.height]);
	}
});

test("a lanyard can be turned off and restored without changing the remaining lanyards' identities", () => {
	const off = studioWithCard(DEFAULT_FINALE_STUDIO, "lanyard-1", false);
	const { wall, keynote } = studioWall(off);
	assert.deepEqual(wall.items.filter((slot) => slot.content.kind === "lanyard").map((slot) => [slotBaseKey(slot), slot.content.order]), [["lanyard-0", 0], ["lanyard-2", 2]]);
	assert.equal(keynote.filter((item) => item.content.kind === "lanyard").length, 3);
	const restored = studioWall(studioWithCard(off, "lanyard-1", true));
	assert.deepEqual(restored.wall.items, studioWall().wall.items);
});
