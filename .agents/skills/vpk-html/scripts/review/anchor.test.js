#!/usr/bin/env node

// ws1 anchoring (T-AN1-T-AN10): linkedom basic.html -> edited.html through the
// real stamper, runtime-rendered content, and Node/happy-dom index parity.
// Assertions compare strings, numbers and booleans only (no DOM nodes).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const FIXTURES = path.join(__dirname, "fixtures");
const load = name => import(path.join(__dirname, `${name}.mjs`));
const readFixture = name => fs.readFileSync(path.join(FIXTURES, name), "utf8");

let pairPromise = null;
function stampedPair() {
	pairPromise ||= (async () => {
		const { stampDocument, parseDocument } = await load("stamp");
		const { buildTextIndex } = await load("anchor");
		const before = stampDocument(readFixture("basic.html"), { seed: "anchor-test", timestamp: "2026-10-11T09:00:00.000Z" });
		const after = stampDocument(readFixture("edited.html"), { ledger: before.ledger, seed: "anchor-test-edited", timestamp: "2026-10-12T09:00:00.000Z" });
		const side = stamped => {
			const document = parseDocument(stamped.html);
			return { ...stamped, document, index: buildTextIndex(document.querySelector("main")) };
		};
		return { before: side(before), after: side(after) };
	})();
	return pairPromise;
}

async function anchorOn(index, quote, occurrence = 0) {
	const { createTextAnchor } = await load("anchor");
	let at = -1;
	for (let count = 0; count <= occurrence; count++) at = index.text.indexOf(quote, at + 1);
	assert.ok(at >= 0, `quote present: ${quote}`);
	return createTextAnchor(index, { start: at, end: at + quote.length });
}

async function resolveOn(quote, occurrence = 0) {
	const { resolveAnchor } = await load("anchor");
	const { before, after } = await stampedPair();
	const anchor = await anchorOn(before.index, quote, occurrence);
	const result = resolveAnchor(after.index, anchor);
	const text = typeof result.start === "number" ? after.index.text.slice(result.start, result.end) : null;
	return { anchor, result, text, after, before };
}

test("T-AN1 exact: an unchanged sentence resolves exactly in its block", async () => {
	const { anchor, result, text } = await resolveOn("Everything below is about this film.");
	assert.equal(result.status, "exact");
	assert.equal(result.blockId, anchor.blockId);
	assert.equal(text, "Everything below is about this film.");
	assert.equal(anchor.blockTag, "p");
	assert.deepEqual(anchor.headingPath, ["Drag it to Done"]);
	assert.deepEqual(anchor.position, { start: 0, end: 36 });
	assert.match(anchor.css.path, /^html > body > main > header > p:nth-of-type\(2\)$/);
	assert.equal(anchor.quote.suffix.length, 32);
});

test("T-AN2 moved: a sentence moved to another block follows its unique quote", async () => {
	const { anchor, result, text } = await resolveOn("This sentence will move to another paragraph later.");
	assert.equal(result.status, "moved");
	assert.notEqual(result.blockId, anchor.blockId, "the block id is updated");
	assert.equal(text, "This sentence will move to another paragraph later.");
});

test("T-AN3 fuzzy: curly quotes and case fold to the same text", async () => {
	const { anchor, result, text } = await resolveOn("the \"Done\" column ships");
	assert.equal(result.status, "fuzzy");
	assert.equal(result.blockId, anchor.blockId, "carry-over kept the paragraph id");
	assert.equal(text, "the “Done” column ships");
});

test("T-AN4 fuzzy + changedText: prefix and suffix bracket the rewritten words", async () => {
	const { result, text } = await resolveOn("three times");
	assert.equal(result.status, "fuzzy");
	assert.equal(result.changedText, "five times");
	assert.equal(text, "five times");
});

test("T-AN5 block-only: the block survives but the quote is gone", async () => {
	const { anchor, result, text, after } = await resolveOn("quick brown fox");
	assert.equal(result.status, "block-only");
	assert.equal(result.blockId, anchor.blockId);
	assert.equal(text, "Alpha teams try it first. Beta teams follow two weeks later.");
	assert.ok(after.index.blocks.has(anchor.blockId));
});

test("T-AN6 orphaned: a phrase in a deleted paragraph", async () => {
	const { anchor, result } = await resolveOn("deleted entirely in the edited version");
	assert.equal(result.status, "orphaned");
	assert.equal(result.start, null);
	assert.equal(result.blockId, anchor.blockId, "orphans keep their last block id");
	assert.match(anchor.blockText, /^This paragraph will be deleted entirely/);
});

test("T-AN7 a repeated phrase resolves to the same occurrence by context", async () => {
	const { resolveAnchor } = await load("anchor");
	const { result, text, after } = await resolveOn("the same phrase", 1);
	assert.equal(result.status, "exact");
	const second = after.index.text.indexOf("the same phrase", after.index.text.indexOf("the same phrase") + 1);
	assert.equal(result.start, second, "the second occurrence, not the first");
	assert.equal(text, "the same phrase");
	const { before } = await stampedPair();
	const first = await anchorOn(before.index, "the same phrase", 0);
	assert.equal(resolveAnchor(after.index, first).start, after.index.text.indexOf("the same phrase"));
	const lost = await anchorOn(before.index, "Repeated paragraph text", 1);
	const moved = resolveAnchor(after.index, { ...lost, blockId: "gone00" });
	assert.equal(moved.status, "moved", "context picks the second of two identical paragraphs");
	assert.equal(moved.start, after.index.text.lastIndexOf("Repeated paragraph text"));
});

test("T-AN8 css path with own-text hash, used when the quote is ambiguous", async () => {
	const { resolveAnchor } = await load("anchor");
	const { before, after } = await stampedPair();
	const original = await anchorOn(before.index, "Repeated paragraph text", 1);
	const ambiguous = { ...original, blockId: "gone00", quote: { exact: "Repeated paragraph text", prefix: "", suffix: "" } };
	const result = resolveAnchor(after.index, ambiguous);
	assert.equal(result.status, "css");
	assert.equal(result.start, after.index.text.lastIndexOf("Repeated paragraph text"));
	assert.match(original.css.path, /^\[id="css-case"\] > p:nth-of-type\(2\)$/, "rooted at the unique section id");
	assert.equal(resolveAnchor(after.index, { ...ambiguous, blockHash: "0000000" }).status, "orphaned", "a hash mismatch rejects the css path");
	assert.equal(resolveAnchor(after.index, { ...ambiguous, css: { ...ambiguous.css, path: "main >>> nonsense" } }).status, "orphaned", "an invalid selector is ignored");
});

test("excluded subtrees never enter the index", async () => {
	const { before } = await stampedPair();
	const text = before.index.text;
	for (const hidden of ["Copy link", "Live region text", "Speaker notes are excluded", "Ignored subtree text", "not a tag", "commented out", "fixtureFlag", "font-family"]) {
		assert.equal(text.includes(hidden), false, hidden);
	}
	for (const shown of ["A div with direct text is a block.", "Attribute values with angle brackets.", "To Do Done", "Doing to Done 31"]) assert.ok(text.includes(shown), shown);
	assert.ok(!/\s{2}/.test(text) && text === text.trim(), "whitespace is collapsed");
});

test("block anchors resolve by id, hash, similarity, else orphaned", async () => {
	const { createBlockAnchor, resolveAnchor } = await load("anchor");
	const { before, after } = await stampedPair();
	const svg = createBlockAnchor(before.index, before.document.querySelector("svg"));
	assert.equal(svg.blockTag, "svg");
	assert.equal(svg.blockText, "Board columns diagram");
	assert.deepEqual(resolveAnchor(after.index, svg), { status: "exact", start: after.index.blocks.get(svg.blockId).start, end: after.index.blocks.get(svg.blockId).end, blockId: svg.blockId });
	assert.equal(resolveAnchor(after.index, { ...svg, blockId: "gone00" }).status, "moved", "same media hash");
	const lede = createBlockAnchor(before.index, before.document.querySelector(".lede"));
	const similar = resolveAnchor(after.index, { ...lede, blockId: "gone00", blockHash: "0000000", blockText: "Everything below is about this film. The board shows how a card moves." });
	assert.equal(similar.status, "fuzzy");
	assert.equal(similar.blockId, lede.blockId);
	assert.equal(resolveAnchor(after.index, { blockId: "gone00", blockTag: "p", blockHash: "0000000", blockText: "nothing like this exists anywhere" }).status, "orphaned");
	assert.equal(resolveAnchor(after.index, null).status, "exact", "general comments have no anchor");
});

test("block anchors on containers with empty own text never resolve on another container", async () => {
	const { stampDocument, parseDocument } = await load("stamp");
	const { buildTextIndex, createBlockAnchor, createTextAnchor, resolveAnchor } = await load("anchor");
	const { hashText } = await load("text");
	const section = (heading, body) => `<section><h2>${heading}</h2><p>${body}</p></section>`;
	const page = body => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><main>\n${body}\n</main></body></html>`;
	const stamped = stampDocument(page([section("Alpha", "Alpha body text one."), section("Beta", "Same twin text."), section("Gamma", "Same twin text."), section("Delta", "Same twin text.")].join("\n")), { seed: "containers", timestamp: "2026-10-11T09:00:00.000Z" });
	const document = parseDocument(stamped.html);
	const index = buildTextIndex(document.querySelector("main"));
	const [alpha, beta, gamma] = [...document.querySelectorAll("section")];
	const gammaAnchor = createBlockAnchor(index, gamma);
	assert.equal(gammaAnchor.blockHash, hashText(""), "a container with only stamped children has the anonymous hash");
	assert.equal(createBlockAnchor(index, alpha).blockHash, gammaAnchor.blockHash, "shared by every such container");
	const resolveIn = html => {
		const doc = parseDocument(html);
		const idx = buildTextIndex(doc.querySelector("main"));
		return { doc, idx, resolve: anchor => resolveAnchor(idx, anchor) };
	};
	assert.ok(stamped.html.includes(gamma.outerHTML), "the serialized section is found verbatim");
	const withoutGamma = resolveIn(stamped.html.replace(gamma.outerHTML, ""));
	assert.equal(withoutGamma.resolve(gammaAnchor).status, "orphaned", "a deleted section is orphaned, not moved onto Alpha");
	const reIded = resolveIn(stamped.html.replace(gamma.outerHTML, "").replace("<main>\n", `<main>\n${gamma.outerHTML.replace(/ data-vpk-id="[^"]+"/, " data-vpk-id=\"newsec\"")}`));
	assert.deepEqual([reIded.resolve(gammaAnchor).status, reIded.resolve(gammaAnchor).blockId], ["moved", "newsec"], "the same heading identifies a re-ided container");
	const twin = createBlockAnchor(index, gamma.querySelector("p"));
	assert.equal(withoutGamma.resolve(twin).status, "orphaned", "two identical twins elsewhere (Beta, Delta) are neither moved nor similar");
	const delta = document.querySelectorAll("section")[3];
	const lastTwin = resolveIn(stamped.html.replace(gamma.outerHTML, "").replace(beta.outerHTML, "")).resolve(twin);
	assert.deepEqual([lastTwin.status, lastTwin.blockId], ["moved", delta.querySelector("p").getAttribute("data-vpk-id")], "one block with the same text is a move");
	const betaTwin = createBlockAnchor(index, beta.querySelector("p"));
	const betaResult = resolveIn(stamped.html.replace(beta.querySelector("p").getAttribute("data-vpk-id"), "gone01")).resolve(betaTwin);
	assert.deepEqual([betaResult.status, betaResult.blockId], ["moved", "gone01"], "the heading path picks the right twin");
	const quoteAt = index.text.indexOf("Alpha body");
	const textAnchor = createTextAnchor(index, { start: quoteAt, end: quoteAt + 10 });
	const onContainer = { ...textAnchor, blockId: "gone00", blockHash: hashText(""), css: { ...textAnchor.css, path: "main > section:nth-of-type(2)" } };
	assert.equal(resolveAnchor(index, { ...onContainer, quote: { exact: "nowhere in the page", prefix: "", suffix: "" } }).status, "orphaned", "an anonymous css match needs the quote");
	assert.equal(resolveAnchor(index, { ...onContainer, quote: { exact: "Same twin text.", prefix: "zz", suffix: "zz" } }).status, "css");
});

test("anchors self-resolve exact, including quotes outside every block or past their block's end", async () => {
	const { stampDocument, parseDocument } = await load("stamp");
	const { buildTextIndex, createBlockAnchor, createTextAnchor, resolveAnchor } = await load("anchor");
	const loose = stampDocument("<!doctype html><html><head><meta charset=\"utf-8\"><title>t</title></head><body><main><p>Alpha paragraph.</p><span>Loose span text outside blocks.</span></main></body></html>", { seed: "loose" });
	const looseIndex = buildTextIndex(parseDocument(loose.html).querySelector("main"));
	const at = looseIndex.text.indexOf("Loose span");
	const outside = createTextAnchor(looseIndex, { start: at, end: at + 10 });
	assert.equal(outside.blockId, null);
	assert.equal(resolveAnchor(looseIndex, outside).status, "exact", "no block: the same place is exact");
	const across = createTextAnchor(looseIndex, { start: looseIndex.text.indexOf("paragraph"), end: at + 5 });
	assert.ok(across.blockId && !across.endBlockId, "the selection ends outside every block");
	assert.equal(resolveAnchor(looseIndex, across).status, "exact", "past the block's end: the same place is exact");
	assert.equal(resolveAnchor(looseIndex, { ...across, position: { start: 0, end: 5 } }).status, "moved", "another place is still a move");
	const random = (await load("schema")).createRandom("self-resolve");
	for (const name of ["demo-changelog.html", "demo-one-pager.html", "demo-editor-feature-flags.html", "demo-prototype-animation.html"]) {
		const stamped = stampDocument(fs.readFileSync(path.join(__dirname, "../../assets/demos", name), "utf8"), { seed: "self", timestamp: "2026-10-11T09:00:00.000Z" });
		const document = parseDocument(stamped.html);
		const index = buildTextIndex(document.querySelector("main"));
		for (let round = 0; round < 40; round++) {
			const start = Math.floor(random() * (index.text.length - 2));
			const end = start + 1 + Math.floor(random() * Math.min(120, index.text.length - start - 1));
			if (!index.text.slice(start, end).trim()) continue;
			const anchor = createTextAnchor(index, { start, end });
			const result = resolveAnchor(index, JSON.parse(JSON.stringify(anchor)));
			assert.deepEqual([result.status, index.text.slice(result.start, result.end)], ["exact", anchor.quote.exact], `${name} text anchor at ${start}`);
		}
		for (const el of document.querySelectorAll("main [data-vpk-id]")) {
			const anchor = createBlockAnchor(index, el);
			assert.deepEqual([resolveAnchor(index, anchor).status, resolveAnchor(index, anchor).blockId], ["exact", anchor.blockId], `${name} block ${anchor.blockId}`);
		}
	}
});

test("media hashes merge adjacent text: linkedom (split at character references) equals happy-dom", async t => {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	const { blockContentHash, mediaFingerprint } = await load("anchor");
	const { stampDocument, parseDocument } = await load("stamp");
	const html = "<html><body><main><svg data-vpk-id=\"svg001\" viewBox=\"0 0 10 10\"><text>&lt;Comment&gt; a &amp; b</text><text>x<!-- note --> y<animate attributeName=\"x\"/> z</text></svg></main></body></html>";
	const node = parseDocument(html);
	assert.ok(node.querySelector("text").childNodes.length > 1, "linkedom splits the text node");
	const nodeHash = blockContentHash(node.querySelector("svg"));
	assert.match(mediaFingerprint(node.querySelector("svg")), /\(text"<Comment> a & b"\)\(text"x y z"\)/);
	const merged = parseDocument(html);
	merged.querySelector("svg").normalize();
	assert.equal(blockContentHash(merged.querySelector("svg")), nodeHash, "normalize() does not change the hash");
	const demos = ["demo-implementation-plan.html", "demo-diagram-candlestick.html"].map(name => stampDocument(fs.readFileSync(path.join(__dirname, "../../assets/demos", name), "utf8"), { seed: "media", timestamp: "2026-10-11T09:00:00.000Z" }));
	const registered = !GlobalRegistrator.isRegistered;
	if (registered) GlobalRegistrator.register({ url: "http://localhost/" });
	t.after(() => {
		if (registered) GlobalRegistrator.unregister();
	});
	const browser = new globalThis.DOMParser().parseFromString(html, "text/html");
	assert.equal(browser.querySelector("text").childNodes.length, 1);
	assert.equal(blockContentHash(browser.querySelector("svg")), nodeHash, "linkedom and happy-dom agree");
	for (const stamped of demos) {
		const live = new globalThis.DOMParser().parseFromString(stamped.html, "text/html");
		const hashes = [...live.querySelectorAll("main svg[data-vpk-id]")].map(el => `${el.getAttribute("data-vpk-id")}|${blockContentHash(el)}`);
		assert.ok(hashes.length > 0);
		const ledger = new Map(stamped.ledger.blocks.map(block => [block.id, block.hash]));
		for (const line of hashes) assert.equal(line.split("|")[1], ledger.get(line.split("|")[0]), `ledger hash equals the live-DOM hash for svg ${line}`);
	}
});

test("index offsets and DOM points round-trip; selections are bounded", async () => {
	const { indexOffsetFor, domPointFor, createTextAnchor, headingPathFor, blockIdAt } = await load("anchor");
	const { before } = await stampedPair();
	const index = before.index;
	for (const entry of index.nodes) {
		const start = domPointFor(index, entry.start, "start");
		assert.equal(indexOffsetFor(index, start.node, start.offset), entry.start);
		const end = domPointFor(index, entry.end, "end");
		assert.equal(indexOffsetFor(index, end.node, end.offset), entry.end);
	}
	const main = before.document.querySelector("main");
	assert.equal(indexOffsetFor(index, main, 0), 0);
	assert.equal(indexOffsetFor(index, before.document.querySelector("title"), 0), -1, "outside the root");
	const button = before.document.querySelector("button").firstChild;
	assert.equal(indexOffsetFor(index, button, 0), index.text.indexOf("Attribute values"), "excluded text snaps to the next indexed character");
	const { parseDocument } = await load("stamp");
	const { buildTextIndex } = await load("anchor");
	const long = buildTextIndex(parseDocument(`<html><body><main><p data-vpk-id="long01">${"word ".repeat(600)}</p></main></body></html>`).querySelector("main"));
	assert.equal(createTextAnchor(long, { start: 3, end: 2003 }).quote.exact.length, 2000);
	assert.throws(() => createTextAnchor(long, { start: 2, end: 2003 }), /Select less text \(2,000 characters max\)/);
	assert.throws(() => createTextAnchor(index, { start: 5, end: 5 }), /Select some text/);
	assert.throws(() => createTextAnchor(index, { start: 0, end: index.text.length + 1 }), /Select text inside the document/);
	const scopeAt = index.text.indexOf("A failed send");
	assert.deepEqual(headingPathFor(index, scopeAt), ["Drag it to Done", "Scope"]);
	assert.equal(blockIdAt(index, scopeAt), (await anchorOn(index, "A failed send")).blockId);
	const spanning = createTextAnchor(index, { start: index.text.indexOf("Undo for"), end: index.text.indexOf("A failed send") + 13 });
	assert.ok(spanning.endBlockId && spanning.endBlockId !== spanning.blockId, "multi-block selections record endBlockId");
});

test("T-AN9 runtime-rendered ids resolve as runtime; script-rewritten text is block-only in Node", async () => {
	const { stampDocument, parseDocument } = await load("stamp");
	const { buildTextIndex, resolveAnchor } = await load("anchor");
	const rendered = stampDocument(readFixture("runtime-rendered.html"), { seed: "runtime" });
	const renderedIndex = buildTextIndex(parseDocument(rendered.html).querySelector("main"));
	assert.equal(renderedIndex.contentIslands, true);
	assert.equal(rendered.ledger.islands["data-vpk-content=x-thread"].length > 0, true, "the island hash is in the ledger");
	const blockAnchor = { blockId: "x-post:p2", blockTag: "li", blockText: "Here is what changed" };
	assert.equal(resolveAnchor(renderedIndex, blockAnchor).status, "runtime");
	const textAnchor = { blockId: "x-post:p2", quote: { exact: "Here is what changed", prefix: "", suffix: "" } };
	assert.equal(resolveAnchor(renderedIndex, textAnchor).status, "runtime");
	assert.equal(resolveAnchor(renderedIndex, textAnchor, { contentIslands: false }).status, "orphaned", "the runtime rule needs a content island");
	const rewritten = stampDocument(readFixture("runtime-text.html"), { seed: "runtime-text" });
	const rewrittenDoc = parseDocument(rewritten.html);
	const rewrittenIndex = buildTextIndex(rewrittenDoc.querySelector("main"));
	const heading = rewrittenDoc.querySelector("h2").getAttribute("data-vpk-id");
	assert.ok(heading, "the h2 is stamped");
	const seen = { blockId: heading, blockTag: "h2", quote: { exact: "Live stage title", prefix: "", suffix: " The paragraph under the stage t" } };
	assert.equal(resolveAnchor(rewrittenIndex, seen).status, "block-only");
});

test("T-AN10 happy-dom and linkedom build the same index and block hashes", async t => {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	const { buildTextIndex, blockContentHash, blockSignature, createTextAnchor } = await load("anchor");
	const { before } = await stampedPair();
	const registered = !GlobalRegistrator.isRegistered;
	if (registered) GlobalRegistrator.register({ url: "http://localhost/" });
	t.after(() => {
		if (registered) GlobalRegistrator.unregister();
	});
	const browserDocument = new globalThis.DOMParser().parseFromString(before.html, "text/html");
	const browserIndex = buildTextIndex(browserDocument.querySelector("main"));
	assert.equal(browserIndex.text, before.index.text, "index text");
	assert.deepEqual([...browserIndex.blocks.entries()], [...before.index.blocks.entries()], "block ranges");
	assert.deepEqual(browserIndex.headings, before.index.headings);
	const summary = document => [...document.querySelectorAll("main [data-vpk-id]")].map(el => [el.getAttribute("data-vpk-id"), blockContentHash(el), blockSignature(el)].join("|"));
	const nodeSummary = summary(before.document);
	assert.equal(nodeSummary.length, before.ledger.blocks.length);
	assert.deepEqual(summary(browserDocument), nodeSummary, "per-block hashes and signatures");
	assert.deepEqual(nodeSummary.map(line => line.split("|")[1]), before.ledger.blocks.map(block => block.hash), "the ledger agrees with the live-DOM hash");
	const at = before.index.text.indexOf("Repeated paragraph text", before.index.text.indexOf("Repeated paragraph text") + 1);
	const range = { start: at, end: at + 23 };
	assert.equal(JSON.stringify(createTextAnchor(browserIndex, range)), JSON.stringify(createTextAnchor(before.index, range)), "identical anchors");
});
