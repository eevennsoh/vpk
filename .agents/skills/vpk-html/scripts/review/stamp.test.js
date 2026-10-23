#!/usr/bin/env node

// ws1 stamping (T-ST1-T-ST8), revisions, rebuild restoration and lite sync
// (T-LITE1-2, module level; the CLI halves land with review/cli.mjs).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SKILL = path.resolve(__dirname, "../..");
const FIXTURES = path.join(__dirname, "fixtures");
const load = name => import(path.join(__dirname, `${name}.mjs`));
const readFixture = name => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const readDemo = name => fs.readFileSync(path.join(SKILL, "assets/demos", name), "utf8");
const T1 = "2026-10-11T09:00:00.000Z";
const T2 = "2026-10-12T09:00:00.000Z";

const stripIds = html => html.replace(/ data-vpk-id="[^"]*"/g, "");
const idsOf = html => [...html.matchAll(/data-vpk-id="([^"]+)"/g)].map(match => match[1]);
const marksOf = html => [...html.matchAll(/data-vpk-id="([^"]+)" data-vpk-revision="(r\d+)"/g)].map(match => `${match[1]}@${match[2]}`);

test("T-ST1 the scanner skips raw text, comments and quoted attribute values", async () => {
	const { scanStartTags } = await load("stamp");
	const html = [
		"<!doctype html><html><head><style>p > a { content: \"<main>\"; }</style><title><p>t</p></title></head>",
		"<body><!-- <main><p>x</p></main> --><main id=m>",
		"<p class='a>b' data-x=\"<p>\">One</p>",
		"<script>var s = \"<p>no</p>\"; if (a < b) {}</script>",
		"<textarea><p>raw</p></textarea>",
		"<svg viewBox=\"0 0 1 1\" aria-hidden=\"true\"><g><rect/></g></svg>",
		"<template><p>tpl</p></template>",
		"<br/><img src=x/ alt=y></main><p>after</p></body></html>",
	].join("");
	const tags = scanStartTags(html);
	assert.deepEqual(tags.map(tag => tag.name), ["html", "head", "style", "title", "body", "main", "p", "script", "textarea", "svg", "g", "rect", "template", "p", "br", "img", "p"]);
	const named = name => tags.filter(tag => tag.name === name);
	const [inMain, inTemplate, after] = named("p");
	assert.equal(inMain.inMain, true);
	assert.equal(html.slice(inMain.attrs[0].valueStart, inMain.attrs[0].valueEnd), "a>b");
	assert.equal(inMain.attrs[1].quote, "\"");
	assert.equal(inTemplate.inTemplate, true);
	assert.equal(after.inMain, false);
	assert.equal(named("svg")[0].inSvg, false, "the svg root is not inside an svg");
	assert.equal(named("g")[0].inSvg, true);
	assert.equal(named("rect")[0].selfClosing, true);
	const br = named("br")[0];
	assert.equal(br.selfClosing, true);
	assert.equal(html.slice(br.insertAt, br.end), "/>");
	const img = named("img")[0];
	assert.equal(img.selfClosing, false, "a slash inside an unquoted value is part of the value");
	assert.equal(html.slice(img.attrs[0].valueStart, img.attrs[0].valueEnd), "x/");
});

test("T-ST2 only candidates inside main are stamped (engine roots yes, svg parts and exclusions no)", async () => {
	const { stampBlocks, parseDocument } = await load("stamp");
	const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<header><p>Outside main</p></header>
<main>
<section><h2>Title</h2><p>Para</p>
<div class="eyebrow">Direct text</div>
<div class="wrap"><span>no direct text</span></div>
<div data-vpk-engine="iso-kit" data-vpk-figure="stack"><div class="vpk-iso-plate__chrome" data-vpk-review-ignore><p>chrome</p></div><figure><svg aria-label="Stack"><g><text>part</text></g></svg><figcaption>Cap</figcaption></figure></div>
<div data-vpk-figure-engine="anatomy"><span>legacy attribute (R3)</span></div>
<aside class="speaker-notes"><p>notes</p></aside>
<div data-vpk-generated><p>generated</p></div>
<template><p>tpl</p></template>
<noscript><p>ns</p></noscript>
<span data-vpk-block>opt-in span</span>
<fieldset class="vpk-decision" data-vpk-decision="retry"><legend>Retry?</legend><label><input type="radio" name="retry" value="3" checked> Yes</label></fieldset>
<span data-vpk-id="x-post:p3">IR id kept</span>
</section>
</main></body></html>`;
	const { html: out, blocks } = stampBlocks(html, { seed: "candidates" });
	const document = parseDocument(out);
	const stamped = [...document.querySelectorAll("[data-vpk-id]")].map(el => {
		const label = el.getAttribute("data-vpk-engine") || el.getAttribute("data-vpk-decision") || el.getAttribute("class") || el.textContent.replace(/\s+/g, " ").trim().slice(0, 9);
		return `${el.localName}:${label}`;
	});
	assert.deepEqual(stamped, ["section:TitlePara", "h2:Title", "p:Para", "div:eyebrow", "div:iso-kit", "figure:partCap", "svg:part", "figcaption:Cap", "span:opt-in sp", "fieldset:retry", "span:IR id kep"]);
	assert.ok(document.querySelector("span[data-vpk-id=\"x-post:p3\"]"), "existing IR-derived ids are kept");
	assert.equal(blocks.length, stamped.length);
	assert.equal(blocks.find(block => block.tag === "svg").parent, blocks.find(block => block.tag === "figure").id);
	assert.equal(blocks.find(block => block.tag === "h2").parent, blocks.find(block => block.tag === "section").id);
});

test("T-ST3 stamping only inserts attributes; bytes elsewhere are unchanged", async () => {
	const { stampBlocks, stampDocument } = await load("stamp");
	for (const source of [readFixture("basic.html"), readDemo("demo-long-doc.html"), readDemo("demo-implementation-plan.html")]) {
		const { html } = stampBlocks(source, { seed: "bytes" });
		assert.ok(idsOf(html).length > 10);
		assert.equal(stripIds(html), source);
	}
	const first = stampDocument(readFixture("basic.html"), { seed: "bytes", timestamp: T1 });
	assert.equal(stampDocument(first.html, { ledger: first.ledger, seed: "other", timestamp: T2 }).html, first.html, "re-stamping a stamped file is a no-op");
});

test("T-ST4 seeded ids are deterministic and well formed", async () => {
	const { stampBlocks } = await load("stamp");
	const source = readFixture("basic.html");
	const a = stampBlocks(source, { seed: "demo-review-loop" });
	const b = stampBlocks(source, { seed: "demo-review-loop" });
	const c = stampBlocks(source, { seed: "another-seed" });
	assert.equal(a.html, b.html);
	assert.notDeepEqual(idsOf(a.html), idsOf(c.html));
	const ids = idsOf(a.html);
	assert.ok(ids.every(id => /^[a-z][a-z0-9]{5}$/.test(id)));
	assert.equal(new Set(ids).size, ids.length, "unique");
});

function unchangedCarryOver(ledgerBlocks, nextBlocks) {
	const key = block => `${block.tag}|${block.hash}|${block.sig}`;
	const previous = new Map();
	for (const block of ledgerBlocks) previous.set(key(block), [...(previous.get(key(block)) || []), block.id]);
	let unchanged = 0;
	let kept = 0;
	for (const block of nextBlocks) {
		const ids = previous.get(key(block));
		if (!ids) continue;
		unchanged++;
		if (ids.includes(block.id)) kept++;
	}
	return { unchanged, kept, ratio: unchanged ? kept / unchanged : 1 };
}

test("T-ST5 carry-over keeps at least 95% of unchanged blocks; duplicate ids are re-ided", async () => {
	const { stampDocument, parseDocument } = await load("stamp");
	const basic = stampDocument(readFixture("basic.html"), { seed: "carry", timestamp: T1 });
	const edited = stampDocument(readFixture("edited.html"), { ledger: basic.ledger, seed: "carry-2", timestamp: T2 });
	const fixtureRatio = unchangedCarryOver(basic.ledger.blocks, edited.ledger.blocks);
	assert.ok(fixtureRatio.unchanged >= 30 && fixtureRatio.ratio >= 0.95, JSON.stringify(fixtureRatio));

	const source = readDemo("demo-long-doc.html");
	const first = stampDocument(source, { seed: "carry-demo", timestamp: T1 });
	const document = parseDocument(source);
	const main = document.querySelector("main");
	const paragraphs = [...main.querySelectorAll("p")];
	const inserted = document.createElement("p");
	inserted.textContent = "A new opening paragraph inserted at the top of main.";
	main.insertBefore(inserted, main.firstChild);
	paragraphs[3].textContent = "This paragraph was rewritten from scratch with different words entirely.";
	paragraphs[6].remove();
	const sections = [...main.children].filter(el => el.localName === "section");
	assert.ok(sections.length >= 4);
	main.appendChild(sections[1]);
	const rebuilt = stripIds(document.toString());
	const second = stampDocument(rebuilt, { ledger: first.ledger, seed: "carry-demo-2", timestamp: T2 });
	const demoRatio = unchangedCarryOver(first.ledger.blocks, second.ledger.blocks);
	assert.ok(demoRatio.unchanged >= 60 && demoRatio.ratio >= 0.95, JSON.stringify(demoRatio));
	const sectionIds = html => [...parseDocument(html).querySelector("main").children].filter(el => el.localName === "section").map(el => el.getAttribute("data-vpk-id"));
	const sectionsBefore = sectionIds(first.html);
	const sectionsAfter = sectionIds(second.html);
	assert.equal(sectionsAfter.at(-1), sectionsBefore[1], "the moved section keeps its id");
	assert.deepEqual([...sectionsAfter].sort(), [...sectionsBefore].sort(), "no section ids are swapped or lost");

	const duplicated = basic.html.replace(/<p data-vpk-id="([^"]+)">Repeated paragraph text for the css fallback test\.<\/p>\n(\t+)<p data-vpk-id="[^"]+">/, (all, id, indent) => `<p data-vpk-id="${id}">Repeated paragraph text for the css fallback test.</p>\n${indent}<p data-vpk-id="${id}">`);
	const ids = idsOf(duplicated);
	assert.equal(ids.length - new Set(ids).size, 1, "fixture has one duplicated id");
	const fixed = stampDocument(duplicated, { ledger: basic.ledger, seed: "dupes", timestamp: T2 });
	assert.equal(fixed.stats.reided, 1);
	const after = idsOf(fixed.html);
	assert.equal(new Set(after).size, after.length, "ids are unique again");
});

test("T-ST5 carry-over never gives a deleted container's id to a new container (shared empty-own-text hash)", async () => {
	const { stampDocument, parseDocument } = await load("stamp");
	const { buildTextIndex, createBlockAnchor, resolveAnchor } = await load("anchor");
	const { hashText } = await load("text");
	const before = stampDocument(readFixture("basic.html"), { seed: "containers", timestamp: T1 });
	const beforeDoc = parseDocument(before.html);
	const beforeIndex = buildTextIndex(beforeDoc.querySelector("main"));
	const deleted = ["table", "figure", "section#css-case"].map(selector => beforeDoc.querySelector(selector));
	const anchors = deleted.map(el => createBlockAnchor(beforeIndex, el));
	assert.ok(anchors.every(anchor => anchor.blockHash === hashText("")), "all three share the anonymous hash");
	const appendix = "<section id=\"appendix\"><h2>Appendix</h2><table><caption>Other timings</caption><tbody><tr><td>A</td><td>1</td></tr></tbody></table><figure><img src=\"data:image/gif;base64,R0lGODlhAQABAAAAACw=\" alt=\"Other\"><figcaption>Other figure</figcaption></figure></section>";
	const edited = readFixture("edited.html").replace(/<figure>[\s\S]*?<\/figure>/, "").replace(/<table>[\s\S]*?<\/table>/, "").replace(/<section id="css-case">[\s\S]*?<\/section>/, "").replace("<footer>", `${appendix}\n<footer>`);
	const after = stampDocument(edited, { ledger: before.ledger, timestamp: T2 });
	const afterDoc = parseDocument(after.html);
	const afterIndex = buildTextIndex(afterDoc.querySelector("main"));
	const oldIds = deleted.map(el => el.getAttribute("data-vpk-id"));
	const fresh = ["#appendix table", "#appendix figure", "#appendix"].map(selector => afterDoc.querySelector(selector));
	for (const [position, el] of fresh.entries()) {
		const id = el.getAttribute("data-vpk-id");
		assert.ok(!oldIds.includes(id), `${el.localName} gets a new id`);
		assert.ok(after.diff.added.includes(id), `${el.localName} is in diff.added`);
		assert.equal(el.getAttribute("data-vpk-revision"), "r2", `${el.localName} is marked`);
		assert.equal(el.getAttribute("data-vpk-revision-kind"), "added", `${el.localName} is marked as added (the reveal chip reads this)`);
		assert.ok(after.diff.removed.some(item => item.id === oldIds[position]), `the deleted ${deleted[position].localName} is in diff.removed`);
		assert.equal(resolveAnchor(afterIndex, anchors[position]).status, "orphaned", `a comment on the deleted ${deleted[position].localName} is orphaned`);
	}

	const page = sections => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><main>${sections}</main></body></html>`;
	const section = (heading, text) => `<section><h2>${heading}</h2><p>${text}</p></section>`;
	const rollout = section("Rollout order", "Ship to staging first, then production.");
	const retry = section("Retry policy", "Retry three times, five minutes apart.");
	const monitoring = section("Monitoring", "Page the on-call engineer when errors exceed one percent.");
	const first = stampDocument(page(rollout + retry), { seed: "rebuild", timestamp: T1 });
	const firstDoc = parseDocument(first.html);
	const [rolloutId, retryId] = [...firstDoc.querySelectorAll("section")].map(el => el.getAttribute("data-vpk-id"));
	const rolloutAnchor = createBlockAnchor(buildTextIndex(firstDoc.querySelector("main")), firstDoc.querySelector("section"));
	const rebuilt = stampDocument(page(retry + monitoring), { ledger: first.ledger, seed: "rebuild-2", timestamp: T2 });
	const rebuiltDoc = parseDocument(rebuilt.html);
	const [retryAfter, monitoringAfter] = [...rebuiltDoc.querySelectorAll("section")].map(el => el.getAttribute("data-vpk-id"));
	assert.equal(retryAfter, retryId, "the surviving section keeps its id through its children");
	assert.notEqual(monitoringAfter, rolloutId, "the new section does not inherit the deleted one's id");
	assert.ok(rebuilt.diff.removed.some(item => item.id === rolloutId) && rebuilt.diff.added.includes(monitoringAfter));
	assert.equal(resolveAnchor(buildTextIndex(rebuiltDoc.querySelector("main")), rolloutAnchor).status, "orphaned");
});

test("T-ST5 re-stamping the library without ids restores every id; deleting a section never reuses its ids", async () => {
	const { stampDocument, parseDocument } = await load("stamp");
	let blocks = 0;
	for (const dir of ["assets/demos", "assets/templates"]) {
		for (const name of fs.readdirSync(path.join(SKILL, dir)).filter(file => file.endsWith(".html"))) {
			const first = stampDocument(fs.readFileSync(path.join(SKILL, dir, name), "utf8"), { seed: "library", timestamp: T1 });
			const again = stampDocument(stripIds(first.html), { ledger: first.ledger, seed: "library-2", timestamp: T2 });
			assert.deepEqual(again.ledger.blocks.map(block => block.id), first.ledger.blocks.map(block => block.id), `${name}: every id comes back`);
			blocks += first.ledger.blocks.length;
		}
	}
	assert.ok(blocks > 3000, `covers the library (${blocks} blocks)`);
	// Duplicated text (repeated headings, footers, "A"/"B" labels), featureless checklist items, nested sections.
	const cases = [["templates", "status-report.html"], ["templates", "changelog.html"], ["demos", "demo-changelog.html"], ["demos", "demo-agent-slides.html"], ["demos", "demo-code-review-pr.html"], ["demos", "demo-design-system.html"]];
	for (const [dir, name] of cases) {
		const first = stampDocument(fs.readFileSync(path.join(SKILL, "assets", dir, name), "utf8"), { seed: "delete", timestamp: T1 });
		const sections = [...parseDocument(first.html).querySelectorAll("main section[data-vpk-id]")].slice(0, 6).map(el => el.getAttribute("data-vpk-id"));
		assert.ok(sections.length >= 2, `${name} has sections`);
		for (const sectionId of sections) {
			const document = parseDocument(first.html);
			const target = document.querySelector(`[data-vpk-id="${sectionId}"]`);
			const gone = new Set([target, ...target.querySelectorAll("[data-vpk-id]")].map(el => el.getAttribute("data-vpk-id")));
			target.remove();
			const next = stampDocument(stripIds(document.toString()), { ledger: first.ledger, seed: "delete-2", timestamp: T2 });
			const ids = new Set(next.ledger.blocks.map(block => block.id));
			assert.deepEqual([...gone].filter(id => ids.has(id)), [], `${name} without ${sectionId}: no deleted id is reused`);
			assert.deepEqual(first.ledger.blocks.filter(block => !gone.has(block.id) && !ids.has(block.id)).map(block => block.id), [], `${name} without ${sectionId}: every survivor keeps its id`);
			assert.equal(next.diff.removed.length, Math.min(gone.size, 50));
		}
	}
});

test("T-ST6 revisions mark only changed and added blocks; r1 has none; re-runs are byte-identical", async () => {
	const { stampDocument, readRegistry } = await load("stamp");
	const first = stampDocument(readFixture("basic.html"), { seed: "revisions", timestamp: T1 });
	assert.equal(first.revision, "r1");
	assert.equal(first.entry.label, "Initial version");
	assert.deepEqual(marksOf(first.html), [], "r1 has no marks");
	assert.match(first.html, /<meta name="vpk-doc-revision" content="r1">/);
	const second = stampDocument(readFixture("edited.html"), { ledger: first.ledger, seed: "revisions-2", timestamp: T2, label: "Tighten scope", addresses: ["c_mgl3x1a5_ana0002b", "not-a-comment"] });
	assert.equal(second.revision, "r2");
	assert.equal(second.docId, first.docId, "the doc id is carried by the ledger");
	const marked = marksOf(second.html).map(mark => mark.split("@")[0]).sort();
	assert.deepEqual(marked, [...second.diff.changed, ...second.diff.added].sort());
	assert.ok(second.diff.changed.length >= 3 && second.diff.added.length >= 1);
	assert.equal(second.entry.label, "Tighten scope");
	assert.deepEqual(second.entry.addresses, ["c_mgl3x1a5_ana0002b"]);
	assert.deepEqual(second.entry.removed.map(item => item.excerpt).filter(text => text.startsWith("This paragraph will be deleted")).length, 1);
	assert.deepEqual(readRegistry(second.html).registry.entries.map(entry => entry.id), ["r1", "r2"]);
	const again = stampDocument(second.html, { ledger: second.ledger, seed: "x", timestamp: "2026-10-13T09:00:00.000Z" });
	assert.equal(again.html, second.html, "nothing changed: byte-identical");
	assert.equal(again.entry, null);
	assert.equal(JSON.stringify(again.ledger), JSON.stringify(second.ledger), "the ledger is stable too");
	const addressed = stampDocument(second.html, { ledger: second.ledger, timestamp: "2026-10-13T09:00:00.000Z", addresses: ["c_mgl3x1a0_ana0001a"] });
	assert.equal(addressed.revision, "r3", "addresses alone record a revision");
	assert.deepEqual(addressed.diff.changed, []);

	let html = first.html;
	let ledger = first.ledger;
	const target = /Undo for the last move/;
	for (let round = 2; round <= 22; round++) {
		const day = String(round).padStart(2, "0");
		html = round === 2 ? html.replace(target, "Undo for the last two moves") : html.replace(/Board view with drag and drop[^<]*/, `Board view with drag and drop, round ${round}`);
		const stamped = stampDocument(html, { ledger, timestamp: `2026-11-${day}T09:00:00.000Z` });
		html = stamped.html;
		ledger = stamped.ledger;
	}
	const entries = readRegistry(html).registry.entries.map(entry => entry.id);
	assert.equal(entries.length, 20);
	assert.equal(entries[0], "r3");
	assert.equal(entries.at(-1), "r22");
	assert.ok(!/data-vpk-revision="r[12]"/.test(html), "marks of dropped revisions are removed");
	assert.match(html, /data-vpk-revision="r22" data-vpk-revision-kind="changed">Board view with drag and drop, round 22/);
	assert.ok(!html.replace(/ data-vpk-revision="[^"]*" data-vpk-revision-kind="[^"]*"/g, "").includes("data-vpk-revision-kind"), "a kind never outlives its revision mark");
});

test("T-ST7 an island-only change records contentChanged without marks", async () => {
	const { stampDocument } = await load("stamp");
	const first = stampDocument(readFixture("runtime-rendered.html"), { seed: "island", timestamp: T1 });
	const changed = first.html.replace("Here is what changed", "Here is what we changed");
	const second = stampDocument(changed, { ledger: first.ledger, timestamp: T2 });
	assert.equal(second.revision, "r2");
	assert.equal(second.entry.contentChanged, true);
	assert.equal(second.entry.changed, 0);
	assert.equal(second.entry.added, 0);
	assert.deepEqual(marksOf(second.html), []);
	assert.notEqual(second.ledger.islands["data-vpk-content=x-thread"], first.ledger.islands["data-vpk-content=x-thread"]);
});

test("T-ST8 doc metas follow the generator meta, else charset, else open head; no head exits 2", async () => {
	const { ensureDocMetas, ReviewError } = await load("stamp");
	const withGenerator = ensureDocMetas(readFixture("lite/doc.html"), { docId: "k3v9q2m7xw1a", revision: "r1" });
	assert.match(withGenerator, /\t<meta name="generator" content="vpk-html">\n\t<meta name="vpk-doc-id" content="k3v9q2m7xw1a">\n\t<meta name="vpk-doc-revision" content="r1">\n\t<meta name="viewport"/);
	const withCharset = ensureDocMetas(readFixture("basic.html"), { docId: "k3v9q2m7xw1a", revision: "r1" });
	assert.match(withCharset, /\t<meta charset="utf-8">\n\t<meta name="vpk-doc-id" content="k3v9q2m7xw1a">\n\t<meta name="vpk-doc-revision" content="r1">\n/);
	const bare = ensureDocMetas("<html><head>\n  <title>x</title>\n</head><body></body></html>", { docId: "k3v9q2m7xw1a", revision: "r1" });
	assert.equal(bare, "<html><head>\n  <meta name=\"vpk-doc-id\" content=\"k3v9q2m7xw1a\">\n  <meta name=\"vpk-doc-revision\" content=\"r1\">\n  <title>x</title>\n</head><body></body></html>");
	const bumped = ensureDocMetas(withCharset, { revision: "r2" });
	assert.equal(bumped, withCharset.replace("content=\"r1\"", "content=\"r2\""), "updated in place");
	assert.equal(ensureDocMetas(bumped, { docId: "k3v9q2m7xw1a", revision: "r2" }), bumped, "idempotent");
	assert.throws(() => ensureDocMetas("<p>no head</p>", { docId: "k3v9q2m7xw1a" }), error => error instanceof ReviewError && error.exitCode === 2 && /no <head>/.test(error.message));
});

test("a full rebuild that dropped ids, metas and the registry continues the revision history", async () => {
	const { stampDocument, readRegistry, ReviewError } = await load("stamp");
	const first = stampDocument(readFixture("basic.html"), { seed: "rebuild", timestamp: T1, reviewable: true });
	const second = stampDocument(readFixture("edited.html"), { ledger: first.ledger, timestamp: T2 });
	assert.deepEqual(second.ledger.registry.entries.map(entry => entry.id), ["r1", "r2"]);
	assert.equal(second.ledger.reviewable, true, "reviewable is carried");
	const rebuiltSource = readFixture("edited.html").replace("Fourth quarter of 2026", "First quarter of 2027");
	const third = stampDocument(rebuiltSource, { ledger: second.ledger, timestamp: "2026-10-13T09:00:00.000Z" });
	assert.equal(third.revision, "r3");
	assert.equal(third.docId, first.docId);
	assert.deepEqual(readRegistry(third.html).registry.entries.map(entry => entry.id), ["r1", "r2", "r3"]);
	assert.equal(marksOf(third.html).length, 1, "only the edited dd is marked");
	const untouched = stampDocument(readFixture("edited.html"), { ledger: second.ledger, timestamp: "2026-10-13T09:00:00.000Z" });
	assert.equal(untouched.revision, "r2", "an unchanged rebuild restores r2 without a new entry");
	assert.equal(untouched.entry, null);
	assert.deepEqual(readRegistry(untouched.html).registry.entries.map(entry => entry.id), ["r1", "r2"]);
	const foreign = first.html.replace(first.docId, "zzzzzzzz0000");
	assert.throws(() => stampDocument(foreign, { ledger: second.ledger }), error => error instanceof ReviewError && error.exitCode === 3);
	assert.equal(stampDocument(foreign, { ledger: second.ledger, forceDoc: true, timestamp: T2 }).docId, "zzzzzzzz0000");
	const fork = stampDocument(first.html, { ledger: first.ledger, newDocId: true, seed: "fork", timestamp: T2 });
	assert.notEqual(fork.docId, first.docId, "--new-doc-id mints a fresh id");
});

test("ledger helpers validate shape and derive the sidecar path", async () => {
	const { normalizeLedger, ledgerPathFor, serializeLedger, stampDocument, ReviewError } = await load("stamp");
	assert.equal(ledgerPathFor("artifacts/vpk-html/a/a.html"), path.join("artifacts/vpk-html/a", "a.vpk-blocks.json"));
	assert.throws(() => normalizeLedger({ schema: "vpk-blocks/2" }), error => error instanceof ReviewError && error.exitCode === 2);
	assert.throws(() => normalizeLedger({ schema: "vpk-blocks/1", docId: "x", blocks: [] }), /invalid docId/);
	const { ledger } = stampDocument(readFixture("basic.html"), { seed: "ledger", timestamp: T1 });
	const parsed = normalizeLedger(JSON.parse(serializeLedger(ledger)));
	assert.deepEqual(parsed, ledger);
	assert.ok(serializeLedger(ledger).endsWith("}\n"));
	assert.ok(ledger.blocks.every(block => block.sig.length <= 400));
});

test("T-LITE1-2 lite sync copies metas and blocks, keeps ids, leaves the lite note unstamped", async () => {
	const { stampDocument, syncLiteVariant, parseDocument, ReviewError } = await load("stamp");
	const { readMarkedBlockText, setEmbeddedReviewText, readMetaContent } = await load("markup");
	const { buildTextIndex, createTextAnchor, resolveAnchor } = await load("anchor");
	const full = stampDocument(readFixture("lite/doc.html"), { seed: "lite", timestamp: T1, reviewable: true });
	const synced = syncLiteVariant(full.html, readFixture("lite/doc.lite.html"), { ledger: full.ledger });
	assert.equal(readMetaContent(synced.html, "vpk-doc-id"), full.docId);
	assert.equal(readMetaContent(synced.html, "vpk-doc-revision"), "r1");
	assert.equal(readMarkedBlockText(synced.html, "revisions"), readMarkedBlockText(full.html, "revisions"));
	const fullDoc = parseDocument(full.html);
	const liteDoc = parseDocument(synced.html);
	const fullIds = new Map([...fullDoc.querySelectorAll("[data-vpk-id]")].map(el => [el.textContent.trim().slice(0, 30), el.getAttribute("data-vpk-id")]));
	for (const el of liteDoc.querySelectorAll("[data-vpk-id]")) assert.equal(el.getAttribute("data-vpk-id"), fullIds.get(el.textContent.trim().slice(0, 30)), "lite ids equal full ids");
	assert.equal(liteDoc.querySelector(".vpk-lite-note").getAttribute("data-vpk-id"), null, "the lite note stays unstamped");
	assert.equal(synced.stats.minted, 0, "lite sync never mints");
	assert.equal(syncLiteVariant(full.html, synced.html, { ledger: full.ledger }).html, synced.html, "idempotent");

	const fullWithReview = setEmbeddedReviewText(full.html, JSON.parse(readFixture("three-reviewers/ana.json")));
	assert.equal(readMarkedBlockText(syncLiteVariant(fullWithReview, synced.html, { ledger: full.ledger }).html, "review-data"), null, "R21: no review-data unless the lite copy keeps one");
	const keeping = setEmbeddedReviewText(synced.html, { schema: "vpk-review/1", doc: { id: full.docId, revision: "r1", title: "" }, reviewers: [], comments: [], decisions: [] });
	assert.equal(readMarkedBlockText(syncLiteVariant(fullWithReview, keeping, { ledger: full.ledger }).html, "review-data"), readMarkedBlockText(fullWithReview, "review-data"));

	const foreign = synced.html.replace(full.docId, "zzzzzzzz0000");
	assert.throws(() => syncLiteVariant(full.html, foreign, { ledger: full.ledger }), error => error instanceof ReviewError && error.exitCode === 3);
	assert.equal(readMetaContent(syncLiteVariant(full.html, foreign, { ledger: full.ledger, forceDoc: true }).html, "vpk-doc-id"), full.docId);

	const liteIndex = buildTextIndex(liteDoc.querySelector("main"));
	const quote = "Undo removed most of the support questions.";
	const at = liteIndex.text.indexOf(quote);
	const anchor = createTextAnchor(liteIndex, { start: at, end: at + quote.length });
	const onFull = resolveAnchor(buildTextIndex(fullDoc.querySelector("main")), anchor);
	assert.equal(onFull.status, "exact", "a comment made on the lite copy resolves on the full file");
	assert.equal(onFull.blockId, anchor.blockId);
});
