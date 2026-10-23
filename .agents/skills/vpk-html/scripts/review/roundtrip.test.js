#!/usr/bin/env node

// ws1 round trip in CI (T-RT1): --inject-review, anchors made on the stamped file, a regeneration
// without ids, --stamp against the ledger, --review --format json. Plus the lite CLI halves
// (T-LITE1-2), the check-html review rules (ws1 4.16) and the reviewed-copy contract with and
// without content providers (T-SJ3, R19 R1) and decisions under happy-dom.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SKILL = path.resolve(__dirname, "../..");
const FIXTURES = path.join(__dirname, "fixtures");
const T1 = "2026-10-11T09:00:00.000Z";

const load = name => import(path.join(__dirname, `${name}.mjs`));
const loadSkill = name => import(path.join(SKILL, "scripts", name));
const readFixture = name => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "vpk-roundtrip-"));
const silent = () => {
	const lines = [];
	return { lines, io: { out: line => lines.push(line), err: line => lines.push(line), raw: text => lines.push(text), now: () => T1 } };
};

const REVIEWER = { id: "u_rt0000001", name: "Rae Tan", initials: "RT", tone: 2, updatedAt: T1 };

function comment(id, anchor, body, kind = "text") {
	return { id, parentId: null, kind, authorId: REVIEWER.id, createdAt: T1, revision: "r1", body, bodyAt: T1, status: "open", deleted: false, anchor };
}

async function anchorsFor(html, quotes) {
	const { parseDocument } = await load("stamp");
	const { buildTextIndex, createTextAnchor, createBlockAnchor, findQuote } = await load("anchor");
	const doc = parseDocument(html);
	const index = buildTextIndex(doc.querySelector("main"));
	const out = {};
	for (const [key, text] of Object.entries(quotes)) {
		const [start] = findQuote(index.text, text);
		assert.ok(start >= 0, `quote ${key} found`);
		out[key] = createTextAnchor(index, { start, end: start + text.length });
	}
	const svg = doc.querySelector("main svg[data-vpk-id]");
	if (svg) out.svg = createBlockAnchor(index, svg);
	return out;
}

test("T-RT1 CLI round trip: inject, comment, regenerate without ids, stamp, review", async () => {
	const { runReviewCli } = await load("cli");
	const { readMetaContent } = await load("markup");
	const dir = tempDir();
	const file = path.join(dir, "doc.html");
	fs.writeFileSync(file, readFixture("basic.html"));
	const { io, lines } = silent();
	assert.equal(await runReviewCli(["--inject-review", file, "--seed", "rt1"], io), 0, lines.join("\n"));
	const injected = fs.readFileSync(file, "utf8");
	const docId = readMetaContent(injected, "vpk-doc-id");
	const anchors = await anchorsFor(injected, {
		exact: "Everything below is about this film.",
		moved: "This sentence will move to another paragraph later.",
		curly: "once the \"Done\" column ships to everyone",
		changed: "retries three times before",
		blockOnly: "The quick brown fox jumps over the lazy dog.",
		orphan: "This paragraph will be deleted entirely",
	});
	const ids = { exact: "c_rt000001_exact001", moved: "c_rt000002_moved002", curly: "c_rt000003_curly003", changed: "c_rt000004_chang004", blockOnly: "c_rt000005_block005", orphan: "c_rt000006_orphn006", svg: "c_rt000007_svgbl007", doc: "c_rt000008_gener008" };
	const review = {
		schema: "vpk-review/1",
		doc: { id: docId, revision: "r1", title: "Drag it to Done" },
		reviewers: [REVIEWER],
		comments: [
			...["exact", "moved", "curly", "changed", "blockOnly", "orphan"].map(key => comment(ids[key], anchors[key], `About ${key}`)),
			comment(ids.svg, anchors.svg, "About the figure", "block"),
			comment(ids.doc, null, "General note", "doc"),
		],
		decisions: [],
	};
	const reviewFile = path.join(dir, "review.json");
	fs.writeFileSync(reviewFile, JSON.stringify(review, null, 2));

	// Regenerate: the edited source has no ids, no metas and no runtime.
	fs.writeFileSync(file, readFixture("edited.html"));
	assert.equal(await runReviewCli(["--stamp", file, "--revision-label", "Edits", "--addresses", ids.changed], io), 0, lines.join("\n"));
	const restamped = fs.readFileSync(file, "utf8");
	assert.equal(readMetaContent(restamped, "vpk-doc-id"), docId, "the ledger keeps the doc id");
	assert.equal(readMetaContent(restamped, "vpk-doc-revision"), "r2");
	assert.match(restamped, /data-vpk-review-runtime/, "a reviewable ledger re-injects the runtime");
	assert.ok(lines.some(line => /stamped \d+ blocks .* r2: \d+ changed, \d+ added, \d+ removed · addresses 1 comment · runtime refreshed/.test(line)), lines.join("\n"));

	const tasksFile = path.join(dir, "tasks.json");
	assert.equal(await runReviewCli(["--review", reviewFile, file, "--format", "json", "--out", tasksFile], io), 0, lines.join("\n"));
	const tasks = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
	const byId = new Map(tasks.tasks.filter(task => task.type === "comment").map(task => [task.commentId, task]));
	const expected = { exact: "exact", moved: "moved", curly: "fuzzy", changed: "fuzzy", blockOnly: "block-only", orphan: "orphaned", svg: "exact", doc: "exact" };
	for (const [key, status] of Object.entries(expected)) assert.equal(byId.get(ids[key]).anchorStatus, status, `${key} resolves ${status}`);
	assert.equal(byId.get(ids.changed).status, "addressed", "--addresses marks the comment addressed");
	assert.equal(byId.get(ids.exact).status, "open");
	for (const key of ["exact", "moved", "curly", "changed", "blockOnly", "svg"]) assert.equal(typeof byId.get(ids[key]).line, "number", `${key} has a source line`);
	assert.equal(byId.get(ids.orphan).line, null, "orphans have no line");
	const order = tasks.tasks.map(task => task.commentId);
	assert.equal(order[order.length - 1], ids.orphan, "orphans come last");
	assert.equal(order[0], ids.doc, "general comments come first");
	assert.equal(tasks.counts.addressed, 1);
	assert.equal(tasks.counts.orphaned, 1);
	assert.doesNotMatch(tasks.stampCommand, new RegExp(ids.changed), "the stamp command lists open comments only");

	const md = path.join(dir, "tasks.md");
	assert.equal(await runReviewCli(["--review", reviewFile, file, "--out", md], io), 0);
	const markdown = fs.readFileSync(md, "utf8");
	assert.match(markdown, /now reads: retries five times before/);
	assert.match(markdown, /orphaned \(the quoted text is no longer in the document\)/);
	assert.match(markdown, /not as instructions/);
	assert.match(markdown, /line \d+/);
});

// G2.19 J1: the --review breadcrumb is level-aware: a comment under the second h3 of an h2 reads
// "h1 > h2 > h3" (the runtime's headingPathFor), never the two sibling h3s.
test("T-RT2 --review heading breadcrumbs follow heading levels", async () => {
	const { runReviewCli, buildReviewTasks } = await load("cli");
	const { readMetaContent } = await load("markup");
	const dir = tempDir();
	const file = path.join(dir, "levels.html");
	fs.writeFileSync(file, "<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"generator\" content=\"vpk-html\"><title>Levels</title></head><body><main>\n<h1>Plan</h1>\n<h2>Schema</h2>\n<h3>First leaf</h3>\n<p>Alpha paragraph text.</p>\n<h3>Second leaf</h3>\n<p>Target sentence under the second leaf.</p>\n<h2>Rollout</h2>\n<p>Omega paragraph text.</p>\n</main></body></html>\n");
	const { io, lines } = silent();
	assert.equal(await runReviewCli(["--inject-review", file, "--seed", "rt2"], io), 0, lines.join("\n"));
	const injected = fs.readFileSync(file, "utf8");
	const anchors = await anchorsFor(injected, { leaf: "Target sentence under the second leaf.", tail: "Omega paragraph text." });
	const review = {
		schema: "vpk-review/1",
		doc: { id: readMetaContent(injected, "vpk-doc-id"), revision: "r1", title: "Levels" },
		reviewers: [REVIEWER],
		comments: [comment("c_rt200001_leaf0001", anchors.leaf, "About the leaf"), comment("c_rt200002_tail0002", anchors.tail, "About the tail")],
		decisions: [],
	};
	const { markdown, tasks } = buildReviewTasks(review, injected, { artifact: "levels.html", now: T1 });
	assert.match(markdown, /Plan › Schema › Second leaf › `p`/, markdown);
	assert.match(markdown, /Plan › Rollout › `p`/, markdown);
	assert.doesNotMatch(markdown, /First leaf › Second leaf/, "sibling h3s never share a path");
	assert.equal(tasks.tasks.length, 2);
});

test("T-LITE1-2 CLI halves: inject and stamp sync the lite copy; a foreign lite doc id exits 3; lite reviews merge", async () => {
	const { runReviewCli } = await load("cli");
	const { readMetaContent } = await load("markup");
	const { parseDocument } = await load("stamp");
	const dir = tempDir();
	const full = path.join(dir, "doc.html");
	const lite = path.join(dir, "doc.lite.html");
	fs.writeFileSync(full, readFixture("lite/doc.html"));
	fs.writeFileSync(lite, readFixture("lite/doc.lite.html"));
	const { io, lines } = silent();
	assert.equal(await runReviewCli(["--inject-review", full, "--seed", "lite"], io), 0, lines.join("\n"));
	assert.ok(lines.some(line => /lite variant synced/.test(line)));
	const fullHtml = fs.readFileSync(full, "utf8");
	let liteHtml = fs.readFileSync(lite, "utf8");
	const docId = readMetaContent(fullHtml, "vpk-doc-id");
	assert.equal(readMetaContent(liteHtml, "vpk-doc-id"), docId);
	assert.match(liteHtml, /data-vpk-review-runtime/, "the lite copy carries the runtime");
	const liteDoc = parseDocument(liteHtml);
	assert.equal(liteDoc.querySelector(".vpk-lite-note").getAttribute("data-vpk-id"), null, "the lite note stays unstamped");
	const fullIds = new Set([...parseDocument(fullHtml).querySelectorAll("[data-vpk-id]")].map(el => el.getAttribute("data-vpk-id")));
	for (const el of liteDoc.querySelectorAll("[data-vpk-id]")) assert.ok(fullIds.has(el.getAttribute("data-vpk-id")), "lite ids come from the full file");

	// A review made on the lite copy merges into the full file through --review.
	const anchors = await anchorsFor(liteHtml, { a: liteDoc.querySelector("main p[data-vpk-id]").textContent.trim().slice(0, 30) });
	{
		const review = { schema: "vpk-review/1", doc: { id: docId, revision: "r1", title: "Lite" }, reviewers: [REVIEWER], comments: [comment("c_lite0001_lite0001", anchors.a, "From the lite copy")], decisions: [] };
		const reviewFile = path.join(dir, "lite-review.json");
		fs.writeFileSync(reviewFile, JSON.stringify(review));
		const out = path.join(dir, "tasks.json");
		assert.equal(await runReviewCli(["--review", reviewFile, full, "--format", "json", "--out", out], io), 0);
		const task = JSON.parse(fs.readFileSync(out, "utf8")).tasks.find(item => item.commentId === "c_lite0001_lite0001");
		assert.equal(task.anchorStatus, "exact", "the lite anchor resolves on the full file");
	}

	fs.writeFileSync(full, fullHtml.replace("Watch the card move", "Watch each card move"));
	assert.equal(await runReviewCli(["--stamp", full, "--revision-label", "Caption"], io), 0, lines.join("\n"));
	liteHtml = fs.readFileSync(lite, "utf8");
	assert.equal(readMetaContent(liteHtml, "vpk-doc-revision"), "r2", "--stamp syncs the lite revision");
	fs.writeFileSync(lite, liteHtml.replace(docId, "zzzzzzzz0000"));
	assert.equal(await runReviewCli(["--stamp", full], io), 3, "a lite copy of another document exits 3");
	assert.equal(await runReviewCli(["--stamp", full, "--force-doc"], io), 0);
});

test("check-html review rules 1-6 and their inertness (ws1 4.16)", async () => {
	const { collectReviewIssues, validateHtmlString } = await loadSkill("check-html.mjs");
	const { injectReviewRuntime } = await load("inject");
	const { setEmbeddedReviewText } = await load("markup");
	const { stampDocument } = await load("stamp");
	const empty = { failures: [], warnings: [] };
	assert.deepEqual(collectReviewIssues(fs.readFileSync(path.join(SKILL, "assets/demos/demo-one-pager.html"), "utf8")), empty, "inert on a plain demo");
	const stamped = stampDocument(readFixture("basic.html"), { seed: "rules", timestamp: T1, reviewable: true });
	const reviewable = injectReviewRuntime(stamped.html);
	assert.deepEqual(collectReviewIssues(reviewable), empty, "a fresh reviewable file is clean");
	// P4 item 1: text outside <main> cannot take comments, so a reviewable file warns about it.
	const outsideMain = collectReviewIssues(reviewable.replace("<main", "<header><h1>Masthead title</h1><p>Summary line</p></header><main"));
	assert.equal(outsideMain.failures.length, 0);
	assert.match(outsideMain.warnings.join("\n"), /2 text blocks outside <main> cannot take review comments.*Masthead title/);
	assert.deepEqual(collectReviewIssues(reviewable.replace("<main", "<nav><p>Skip</p></nav><main").replace("</main>", "<p>Inside</p></main>")).warnings.filter(warning => /outside <main>/.test(warning)), [], "nav and in-main text stay quiet");
	assert.deepEqual(collectReviewIssues(reviewable.replace("<main", "<p data-vpk-review-ignore>Chrome</p><main")).warnings, [], "an ignored block stays quiet");
	const decision = "<fieldset class=\"vpk-decision\" data-vpk-decision=\"retry\"><legend>Retry?</legend><label><input type=\"radio\" name=\"retry\" value=\"3\" checked> Yes</label></fieldset>";
	const rule1 = collectReviewIssues(stamped.html.replace("</main>", `${decision}</main>`));
	assert.equal(rule1.failures.length, 0);
	assert.match(rule1.warnings[0], /decision blocks are inert without the review runtime/);
	assert.deepEqual(collectReviewIssues(injectReviewRuntime(stamped.html.replace("</main>", `${decision}</main>`))).warnings, [], "the runtime silences rule 1");
	assert.match(collectReviewIssues(reviewable.replace(/<meta name="vpk-doc-id"[^>]*>/, "")).failures.join("\n"), /without a valid vpk-doc-id/);
	const id = /data-vpk-id="([^"]+)"/.exec(reviewable)[1];
	assert.match(collectReviewIssues(reviewable.replace("</main>", `<p data-vpk-id="${id}">copy</p></main>`)).failures.join("\n"), new RegExp(`duplicate data-vpk-id values: ${id}`));
	assert.match(collectReviewIssues(reviewable.replace("\"entries\":[", "\"entries\":[,")).failures.join("\n"), /data-vpk-revisions island is not valid JSON/);
	assert.match(collectReviewIssues(reviewable.replace("\"label\":\"Initial version\"", "\"label\":\"<b>\"")).failures.join("\n"), /raw "</);
	assert.match(collectReviewIssues(reviewable.replace("content=\"r1\"", "content=\"r9\"")).failures.join("\n"), /does not match the last revision entry/);
	assert.match(collectReviewIssues(reviewable.replace("<!-- vpk-review:end -->", "")).failures.join("\n"), /unbalanced vpk-review markers/);
	assert.match(collectReviewIssues(`${reviewable}<!-- vpk-revisions:start --><!-- vpk-revisions:end -->`).failures.join("\n"), /duplicated vpk-revisions markers/);
	const hostile = JSON.parse(readFixture("hostile-review.json"));
	const reviewed = setEmbeddedReviewText(reviewable, { ...hostile, doc: { ...hostile.doc, id: stamped.docId, revision: "r1" } });
	assert.deepEqual(validateHtmlString(reviewed, "hostile").failures, [], "a reviewed copy of hostile-review.json passes check-html");
});

async function bootPage(t, html, url = "http://localhost/doc.html") {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	GlobalRegistrator.register({ url, width: 1280, height: 800 });
	t.after(() => GlobalRegistrator.unregister());
	document.head.innerHTML = /<head>([\s\S]*?)<\/head>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	document.body.innerHTML = /<body>([\s\S]*)<\/body>/i.exec(html)[1].replace(/<script data-vpk-review-runtime[\s\S]*?<\/script>/gi, "");
	vm.runInThisContext(/<script data-vpk-review-runtime[^>]*>\n([\s\S]*?)\n<\/script>/.exec(html)[1]);
	await new Promise(resolve => setTimeout(resolve, 20));
	return window.__VPK_REVIEW__;
}

test("T-SJ3 + R19 R1 reviewed copies differ only inside review-data (and provider islands); mine scope; decisions", async t => {
	const { injectReviewRuntime } = await load("inject");
	const { readIslandJson, setMarkedBlockText } = await load("markup");
	const { stampDocument } = await load("stamp");
	const decision = "<fieldset class=\"vpk-decision\" data-vpk-decision=\"retry\"><legend>Should a failed send retry on its own?</legend><label><input type=\"radio\" name=\"retry\" value=\"3\" checked> Yes, 3 times</label><label><input type=\"radio\" name=\"retry\" value=\"no\"> No</label></fieldset>";
	const island = "<script type=\"application/json\" data-vpk-content=\"x-thread\">{\"posts\":[{\"id\":\"p1\",\"text\":\"old\"}]}</script>";
	const source = injectReviewRuntime(stampDocument(readFixture("basic.html").replace("</main>", `${decision}\n</main>\n${island}`), { seed: "sj3", timestamp: T1, reviewable: true }).html);
	const api = await bootPage(t, source);
	api.setIdentity({ name: "Ben Ito", initials: "BI" });
	const mine = api.addComment({ quote: "Undo for the last move", body: "Keep this." });
	api.importReview({ ...JSON.parse(readFixture("three-reviewers/ana.json")), doc: { id: api.docId, revision: "r1", title: "x" } });
	const radio = document.querySelector("input[value=\"no\"]");
	radio.checked = true;
	radio.dispatchEvent(new Event("change", { bubbles: true }));
	const decisionRecord = api.getReview().decisions.find(item => item.key === "retry");
	assert.equal(decisionRecord.changed, true, "a changed answer is recorded");
	assert.equal(decisionRecord.seen, true);
	assert.equal(document.querySelector("fieldset.vpk-decision").getAttribute("data-vpk-decision-state"), "changed");
	assert.equal(document.querySelectorAll(".vpk-decision__suggested[data-vpk-generated]").length, 1, "the recommendation gets one suggested tag");
	assert.match(api.markdown(), /Should a failed send retry on its own\?[\s\S]*No[\s\S]*was: Yes, 3 times/);

	const outside = html => setMarkedBlockText(html, "review-data", null);
	const all = api.reviewedCopy(source, { scope: "all" });
	assert.equal(all.ok, true);
	const embedded = readIslandJson(all.html);
	assert.equal(embedded.comments.length, api.getReview().comments.length);
	assert.equal(outside(all.html), source, "byte-identical outside the review-data block");
	const scoped = readIslandJson(api.reviewedCopy(source, { scope: "mine" }).html);
	assert.deepEqual(scoped.comments.map(item => item.id), [mine], "mine holds only the saver's comments");
	assert.ok(scoped.decisions.every(item => item.reviewerId === scoped.reviewers[0].id), "mine holds only the saver's decisions");
	assert.equal(api.reviewedCopy(source.replace(api.docId, "zzzzzzzz0000"), {}).ok, false, "another document is refused");

	window.__VPK_CONTENT__ = { "x-thread": { applyToSource: html => html.replace("{\"posts\":[{\"id\":\"p1\",\"text\":\"old\"}]}", "{\"posts\":[{\"id\":\"p1\",\"text\":\"new\"}]}") } };
	const provided = api.reviewedCopy(source, { scope: "all" });
	const withoutProvider = outside(provided.html).replace("\"text\":\"new\"", "\"text\":\"old\"");
	assert.equal(withoutProvider, source, "differences are limited to review-data plus the provider's island");
	window.__VPK_CONTENT__ = { broken: { applyToSource() { throw new Error("boom"); } } };
	const failed = api.reviewedCopy(source, { scope: "all" });
	assert.equal(failed.ok, true, "a throwing provider keeps the source");
	assert.equal(failed.warning, "Content state not saved: boom");
	delete window.__VPK_CONTENT__;
});
