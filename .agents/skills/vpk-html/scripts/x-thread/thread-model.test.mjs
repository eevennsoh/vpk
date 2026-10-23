// T2 (ws5-xthread): the pure thread model. Composer split, severity table, structure ops with
// undo, approvals, the posting queue (intents, posted URLs) and the numbering/fit stretch pieces.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { weightedLength } from "./twitter-text.mjs";
import * as model from "./thread-model.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THREAD_MD = fs.readFileSync(path.join(__dirname, "fixtures", "thread.md"), "utf8");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "thread.expected.json"), "utf8"));
const VECTORS = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "twitter-text-v3-vectors.json"), "utf8"));
const NOW = Date.UTC(2026, 9, 11, 9, 12, 0);
const ZWJ = String.fromCodePoint(0x200d);
const FAMILY = [0x1f468, 0x1f469, 0x1f467].map(point => String.fromCodePoint(point)).join(ZWJ);

function deepFreeze(value) {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

function makeDoc(posts, statePosts = {}, settings = {}) {
	return deepFreeze({
		content: { title: "Test thread", author: { name: "Ada", handle: "@Ada" }, posts },
		state: { schema: "vpk-x-thread-state/1", threadId: "test-thread", stateRevision: 1, settings: { numbering: "none", ...settings }, posts: statePosts, media: {} },
	});
}

// The composer oracle as content: six valid posts, p2 with a planned image.
const sixDoc = () => makeDoc(EXPECTED.posts.map((post, index) => ({ id: `p${index + 1}`, ...post })));
// The eval posts as content: p4 is over the limit.
const evalDoc = () => makeDoc(VECTORS.evalPosts.posts.map(post => ({ id: post.id, text: post.text })));
const ids = doc => doc.content.posts.map(post => post.id);
const texts = doc => doc.content.posts.map(post => post.text);
const codes = (issues, severity) => issues.filter(issue => !severity || issue.severity === severity).map(issue => issue.code);
const issueFor = (doc, id, code) => model.postIssues(doc, id).find(issue => issue.code === code);
const approved = (doc, id) => ({ status: "approved", approvedHash: model.hashText(model.composePostText(doc, id)) });
const postedEntry = (id, inReplyTo, text) => ({ status: "posted", posted: { id, url: `https://x.com/ada/status/${id}`, ...(inReplyTo ? { inReplyTo } : {}), at: "2026-10-11T09:12:00.000Z", text } });

function approveAll(doc) {
	const result = model.approveAllValid(doc);
	assert.deepEqual(result.blocked, []);
	return result.doc;
}

test("constants and hashText", () => {
	assert.deepEqual(model.STATUSES, ["draft", "approved", "skipped", "posted"]);
	assert.deepEqual([model.MAX_POSTS, model.MAX_MEDIA, model.MAX_WEIGHT, model.MAX_TEXT_CHARS, model.NUMBERING_RESERVE], [25, 4, 280, 1000, 7]);
	assert.equal(model.NUMBERING_RESERVE, weightedLength("\n\n25/25"), "the reserve fits the widest suffix");
	assert.equal(model.hashText(""), "h" + (0x811c9dc5).toString(36), "FNV-1a offset basis for empty input");
	assert.match(model.hashText("Ship it"), /^h[0-9a-z]+$/);
	assert.equal(model.hashText("Ship it"), model.hashText("Ship it"));
	assert.notEqual(model.hashText("Ship it"), model.hashText("Ship it."));
});

test("composer: fixtures/thread.md deep-equals fixtures/thread.expected.json", () => {
	assert.deepEqual(model.splitSource(THREAD_MD), EXPECTED);
	assert.deepEqual(model.splitSource(THREAD_MD.replace(/\n/g, "\r\n")), EXPECTED, "CRLF input");
});

test("composer: separator, numbered, bullet and paragraph detection", () => {
	for (const rule of ["***", "___", "===", "-----"]) {
		assert.deepEqual(model.splitSource(`One\n${rule}\nTwo`), { mode: "separators", posts: [{ text: "One" }, { text: "Two" }] }, rule);
	}
	for (const [marker, label] of [["1.", "dot"], ["1)", "paren"], ["1/", "slash"], ["1/6", "fraction"]]) {
		const second = marker.replace("1", "2");
		const result = model.splitSource(`${marker} First post\n${second} Second post`);
		assert.deepEqual(result, { mode: "numbered", posts: [{ text: "First post" }, { text: "Second post" }] }, label);
	}
	const numbered = model.splitSource("Intro line\n1. First\ncontinues here (1/2)\n\n2. Second 2/2");
	assert.deepEqual(numbered.posts.map(post => post.text), ["Intro line", "First\ncontinues here", "Second"]);
	const bullets = model.splitSource("- Alpha\n- Beta\n  - nested stays\n\u2022 Gamma");
	assert.equal(bullets.mode, "bullets");
	assert.deepEqual(bullets.posts.map(post => post.text), ["Alpha", "Beta\n  - nested stays", "Gamma"]);
	assert.deepEqual(model.splitSource("One\nstill one\n\nTwo\n\n\n\nThree"), { mode: "paragraphs", posts: [{ text: "One\nstill one" }, { text: "Two" }, { text: "Three" }] });
	assert.deepEqual(model.splitSource("1. only one numbered line\n\nnext"), { mode: "paragraphs", posts: [{ text: "1. only one numbered line" }, { text: "next" }] }, "one marker line is not a numbered list");
	assert.deepEqual(model.splitSource("A\n---\nB", { mode: "paragraphs" }).posts, [{ text: "A\n---\nB" }], "an explicit mode wins");
	assert.deepEqual(model.splitSource("   \n\n "), { mode: "auto", posts: [] });
});

test("composer: JSON input", () => {
	assert.deepEqual(model.splitSource('["**bold** stays", " two "]'), { mode: "json", posts: [{ text: "**bold** stays" }, { text: "two" }] });
	const object = model.splitSource(JSON.stringify({ title: "Launch", posts: [{ text: "One", note: "n", media: [{ alt: "Chart", asset: "media/p1-1.png" }, { kind: "gif", alt: "Loop", asset: "../escape.gif" }] }, "Two"] }));
	assert.deepEqual(object, {
		title: "Launch",
		mode: "json",
		posts: [{ text: "One", note: "n", media: [{ kind: "image", alt: "Chart", asset: "media/p1-1.png" }, { kind: "gif", alt: "Loop" }] }, { text: "Two" }],
	});
	const envelope = model.splitSource(JSON.stringify({ type: "x-thread", content: { title: "T", posts: [{ id: "p1", text: "From an envelope" }] } }));
	assert.deepEqual(envelope.posts, [{ text: "From an envelope" }]);
	assert.equal(model.splitSource("[not json").mode, "paragraphs", "broken JSON falls back to text in auto mode");
	assert.equal(model.splitSource("[not json", { mode: "json" }).error, "bad-json");
	assert.equal(model.splitSource('[{"nope": 1}]').mode, "paragraphs", "JSON that is not a thread is text");
});

test("composer: markdown stripping keeps hashtags, snake_case and literal text", () => {
	const plain = source => model.markdownToPlain(source).text;
	assert.equal(plain("#cafe and #2026 stay"), "#cafe and #2026 stay");
	assert.equal(plain("## Heading ##\nbody"), "Heading\nbody");
	assert.equal(plain("snake_case and a_b_c and a__b__c stay"), "snake_case and a_b_c and a__b__c stay");
	assert.equal(plain("**bold**, __strong__, *em*, _em_ and `code`"), "bold, strong, em, em and code");
	assert.equal(plain("2 * 3 * 4 and a*b*c"), "2 * 3 * 4 and a*b*c");
	assert.equal(plain("\\*literal\\* and \\_x\\_ and \\#tag"), "*literal* and _x_ and #tag");
	assert.equal(plain("> quoted\n>> nested"), "quoted\nnested");
	assert.equal(plain("See [the docs](https://example.com/docs \"Docs\")"), "See the docs https://example.com/docs");
	assert.equal(plain("[https://example.com](https://example.com)"), "https://example.com");
	assert.equal(plain("[example.com](https://example.com/)"), "https://example.com/");
	assert.equal(plain("Keep {{x}} and $1 $& $` $'"), "Keep {{x}} and $1 $& $` $'");
	assert.deepEqual(model.markdownToPlain("Text\n![Alt one](a.png)\n![](b.png)\n<!-- note: First -->\n<!-- private -->\n<!--note: Second-->"), {
		text: "Text",
		note: "First · Second",
		media: [{ kind: "image", alt: "Alt one" }, { kind: "image", alt: "" }],
	});
	assert.deepEqual(model.splitSource("**kept**\n\n_also_", { stripMarkdown: false }).posts, [{ text: "**kept**" }, { text: "_also_" }]);
});

test("composer: more than 25 posts is an error, and fit splits long chunks", () => {
	const many = model.splitSource(Array.from({ length: 26 }, (_, index) => `Post ${index + 1}`).join("\n\n"));
	assert.equal(many.error, "too-many-posts");
	assert.equal(many.posts.length, 26);
	assert.equal(model.splitSource(Array.from({ length: 25 }, (_, index) => `Post ${index + 1}`).join("\n\n")).error, undefined);
	const long = Array.from({ length: 12 }, (_, index) => `Sentence number ${index + 1} explains one more detail of the release in plain words.`).join(" ");
	const fitted = model.splitSource(`Short one\n\n${long}`, { fit: true });
	assert.equal(fitted.posts[0].text, "Short one");
	assert.ok(fitted.posts.length > 3);
	for (const post of fitted.posts) assert.ok(weightedLength(post.text) <= 280, post.text);
	assert.equal(fitted.posts.slice(1).map(post => post.text).join(" "), long);
	const reserved = model.splitSource(long, { fit: true, reserve: model.NUMBERING_RESERVE });
	for (const post of reserved.posts) assert.ok(weightedLength(post.text) <= 280 - 7);
});

test("severity: every row of the table, per status", () => {
	const longText = "word ".repeat(250).trim();
	const cases = [
		["over-limit", { text: "a".repeat(300) }, { draft: "warning", approved: "error", posted: "warning", skipped: "info" }],
		["invalid-chars", { text: "Bad " + String.fromCodePoint(0xffff) }, { draft: "warning", approved: "error", posted: "warning", skipped: "info" }],
		["empty", { text: "  " }, { draft: "warning", approved: "error", posted: "error", skipped: "info" }],
		["data-needed", { text: "Ship on [DATA NEEDED: date]" }, { draft: "warning", approved: "error", posted: "error", skipped: "info" }],
		["too-long", { text: longText.padEnd(1001, "!") }, { draft: "warning", approved: "error", posted: "error", skipped: "warning" }],
		["media-alt", { text: "Pic", media: [{ kind: "image", alt: "", asset: "media/p1-1.png" }] }, { draft: "warning", approved: "error", posted: null, skipped: "info" }],
		["media-alt", { text: "Pic", media: [{ kind: "image", alt: "[DATA NEEDED: alt text for image 1]", asset: "media/p1-1.png" }] }, { draft: "warning", approved: "error", posted: null, skipped: "info" }],
		["media-planned", { text: "Pic", media: [{ kind: "image", alt: "Chart" }] }, { draft: "info", approved: "warning", posted: null, skipped: "info" }],
	];
	for (const [code, post, expected] of cases) {
		for (const [status, severity] of Object.entries(expected)) {
			const base = { id: "p1", ...post };
			const probe = makeDoc([base]);
			const entry = status === "draft" ? null
				: status === "approved" ? approved(probe, "p1")
					: status === "posted" ? postedEntry("1844", null, base.text)
						: { status: "skipped" };
			const doc = makeDoc([base], entry ? { p1: entry } : {});
			assert.equal(issueFor(doc, "p1", code)?.severity ?? null, severity, `${code} / ${status}`);
		}
	}
	const stale = makeDoc([{ id: "p1", text: "Now" }], { p1: { status: "approved", approvedHash: model.hashText("Before") } });
	assert.equal(issueFor(stale, "p1", "approval-stale")?.severity, "error");
	const drifted = makeDoc([{ id: "p1", text: "Now" }], { p1: postedEntry("1844", null, "Before") });
	assert.equal(issueFor(drifted, "p1", "posted-text-changed")?.severity, "warning");
	assert.equal(issueFor(makeDoc([{ id: "p1", text: "Fine" }]), "p1", "over-limit"), undefined);
	assert.deepEqual(model.postIssues(sixDoc(), "missing"), []);
});

test("approval: blockers, hashes and approve-all", () => {
	const doc = evalDoc();
	const over = model.setStatus(doc, "p4", "approved");
	assert.equal(over.error, "approve-blocked");
	assert.equal(over.doc, doc, "a failed op returns the input doc");
	assert.match(over.message, /^Over by 99 \(379 \/ 280\)$/);
	assert.equal(codes(model.postIssues(doc, "p4"), "warning")[0], "over-limit", "an over-limit draft is only a warning");
	const blockedText = model.setStatus(makeDoc([{ id: "p1", text: "Due [DATA NEEDED: date]" }]), "p1", "approved");
	assert.equal(blockedText.error, "approve-blocked");
	const blockedAlt = model.setStatus(makeDoc([{ id: "p1", text: "Pic", media: [{ kind: "image", alt: " ", asset: "media/p1-1.png" }] }]), "p1", "approved");
	assert.equal(blockedAlt.issues[0].code, "media-alt");
	const planned = model.setStatus(sixDoc(), "p2", "approved");
	assert.equal(planned.error, undefined, "a planned slot does not block approval");
	assert.equal(planned.doc.state.posts.p2.approvedHash, model.hashText(EXPECTED.posts[1].text));
	const all = model.approveAllValid(doc);
	assert.equal(all.approved, 5);
	assert.deepEqual(all.blocked.map(item => [item.id, item.code]), [["p4", "approve-blocked"]]);
	assert.deepEqual(all.info, ["Approved 5 posts; post 4: over by 99 (379 / 280)"]);
	assert.equal(model.statusOf(all.doc, "p4"), "draft");
	const cleared = model.clearApprovals(all.doc);
	assert.equal(cleared.cleared, 5);
	assert.ok(ids(doc).every(id => model.statusOf(cleared.doc, id) === "draft"));
	const skipped = model.setStatus(doc, "p3", "skipped");
	assert.equal(model.statusOf(skipped.doc, "p3"), "skipped");
	assert.deepEqual(model.chain(skipped.doc).map(post => post.id), ["p1", "p2", "p4", "p5", "p6"]);
	assert.equal(model.setStatus(doc, "p1", "posted").error, "bad-status");
});

test("approval and posting refuse a post whose parenthesised URL tail takes it over 280", () => {
	// Upstream ends the URL at "run", so ",(aaa...)" counts as text: 308. A port that kept
	// "(aaa...)" inside the URL counted 35, approved it and opened an X intent that X rejects.
	const { text } = VECTORS.local.weighted.find(entry => entry.text?.startsWith("Benchmarks: https://example.com/run,("));
	assert.equal(weightedLength(text), 308);
	const doc = makeDoc([{ id: "p1", text }]);
	const refused = model.setStatus(doc, "p1", "approved");
	assert.equal(refused.error, "approve-blocked");
	assert.equal(refused.message, "Over by 28 (308 / 280)");
	const step = model.nextStep(makeDoc([{ id: "p1", text }], { p1: approved(doc, "p1") }));
	assert.deepEqual([step.kind, step.reason], ["blocked", "invalid"], "an approval stored under the wrong count opens no intent");
});

test("approval: text changes revert to draft, and revalidateApprovals reports it", () => {
	const doc = approveAll(sixDoc());
	const edited = model.setText(doc, "p3", "Budgets sync now.\r\nSecond line");
	assert.equal(model.statusOf(edited.doc, "p3"), "draft");
	assert.equal(edited.doc.content.posts[2].text, "Budgets sync now.\nSecond line");
	assert.deepEqual(edited.info, ["Post 3 went back to draft: its text changed after approval"]);
	assert.equal(model.setText(doc, "p3", EXPECTED.posts[2].text).doc, doc, "an unchanged text is a no-op");
	const hacked = makeDoc(doc.content.posts, { ...doc.state.posts, p1: { status: "approved", approvedHash: "hstale" } });
	const checked = model.revalidateApprovals(hacked);
	assert.equal(model.statusOf(checked.doc, "p1"), "draft");
	assert.equal(checked.info.length, 1);
	assert.equal(model.revalidateApprovals(doc).doc, doc);
});

test("validateThread: clean thread and every chain rule", () => {
	const clean = model.validateThread(sixDoc());
	assert.deepEqual(clean.errors, []);
	assert.deepEqual(clean.info.map(item => item.message), ["Post 2 (p2): Image 1 is not attached yet"]);
	const evalCheck = model.validateThread(evalDoc());
	assert.deepEqual(evalCheck.errors, []);
	assert.deepEqual(evalCheck.warnings.map(item => [item.id, item.code]), [["p4", "over-limit"]]);
	const base = sixDoc().content.posts;
	const gap = makeDoc(base, { p2: postedEntry("1845", null, base[1].text) });
	assert.deepEqual(codes(model.validateThread(gap).errors), ["posted-gap"]);
	const chained = makeDoc(base, { p1: postedEntry("1844", null, base[0].text), p2: postedEntry("1845", "9999", base[1].text) });
	assert.deepEqual(codes(model.validateThread(chained).errors), ["reply-chain"]);
	const duplicate = makeDoc(base, { p1: postedEntry("1844", null, base[0].text), p2: postedEntry("1844", "1844", base[1].text) });
	assert.deepEqual(codes(model.validateThread(duplicate).errors), ["duplicate-posted-id"]);
	const unknown = makeDoc(base, { p42: { status: "approved" } });
	assert.deepEqual(model.validateThread(unknown).warnings.map(item => [item.code, item.position, item.message]), [
		["unknown-state", 0, "p42: State for a post that is not in the content (fill drops it)"],
	]);
	const mismatch = makeDoc(base, { p1: { status: "posted" } });
	assert.ok(codes(model.validateThread(mismatch).errors).includes("status-mismatch"));
	const media = Array.from({ length: 5 }, (_, index) => ({ kind: "image", alt: "x", asset: `media/p1-${index + 1}.png` }));
	const structural = makeDoc([{ id: "p1", text: "a", media }, { id: "post-2", text: "b" }, { id: "p1", text: "c" }]);
	assert.deepEqual(codes(model.validateThread(structural).errors).sort(), ["bad-id", "duplicate-id", "too-many-media"]);
	assert.deepEqual(codes(model.validateThread(makeDoc([])).errors), ["no-posts"]);
	const crowded = makeDoc(Array.from({ length: 26 }, (_, index) => ({ id: `p${index + 1}`, text: `Post ${index + 1}` })));
	assert.deepEqual(codes(model.validateThread(crowded).errors), ["too-many-posts"]);
	const replyTo = makeDoc(base, { p1: postedEntry("1844", "1000", base[0].text) }, { replyToId: "1000" });
	assert.deepEqual(model.validateThread(replyTo).errors, [], "the first post may reply to settings.replyToId");
});

test("structure: nextPostId and insertPost", () => {
	assert.equal(model.nextPostId(sixDoc()), "p7");
	assert.equal(model.nextPostId(makeDoc([{ id: "p99", text: "x" }, { id: "p1", text: "y" }])), "p2");
	assert.equal(model.nextPostId(makeDoc(Array.from({ length: 99 }, (_, index) => ({ id: `p${index + 1}`, text: "x" })))), null);
	const doc = sixDoc();
	const appended = model.insertPost(doc);
	assert.deepEqual([appended.id, appended.index, ids(appended.doc).at(-1)], ["p7", 6, "p7"]);
	const after = model.insertPost(doc, "p2", "New\r\ntext");
	assert.deepEqual(ids(after.doc), ["p1", "p2", "p7", "p3", "p4", "p5", "p6"]);
	assert.equal(after.doc.content.posts[2].text, "New\ntext");
	assert.deepEqual(ids(model.insertPost(doc, null).doc)[0], "p7");
	assert.equal(model.insertPost(doc, "nope").error, "not-found");
	const full = makeDoc(Array.from({ length: 25 }, (_, index) => ({ id: `p${index + 1}`, text: "x" })));
	assert.equal(model.insertPost(full).error, "too-many-posts");
	const posted = makeDoc(doc.content.posts, { p1: postedEntry("1844", null, doc.content.posts[0].text) });
	assert.equal(model.insertPost(posted, null).error, "posted-locked");
	assert.equal(model.insertPost(posted, "p1").error, undefined, "without numbering, posts can follow a posted post");
});

test("structure: move keeps posted posts and everything above them in place", () => {
	const doc = sixDoc();
	const moved = model.movePost(doc, "p5", 1);
	assert.deepEqual(ids(moved.doc), ["p1", "p5", "p2", "p3", "p4", "p6"]);
	assert.deepEqual(moved.info, ["Post 5 moved to position 2"]);
	assert.deepEqual(ids(model.movePost(doc, "p1", 99).doc), ["p2", "p3", "p4", "p5", "p6", "p1"], "clamps to the end");
	assert.equal(model.movePost(doc, "p3", 2).doc, doc, "same index is a no-op");
	const base = doc.content.posts;
	const locked = makeDoc(base, { p1: { status: "skipped" }, p2: postedEntry("1844", null, base[1].text) });
	assert.equal(model.movePost(locked, "p2", 4).error, "posted-locked");
	assert.equal(model.movePost(locked, "p1", 4).error, "posted-locked", "posts above a posted post can't move");
	assert.deepEqual(ids(model.movePost(locked, "p6", 0).doc), ["p1", "p2", "p6", "p3", "p4", "p5"], "targets clamp below the locked prefix");
	const intent = makeDoc(base, { p1: { ...approved(doc, "p1"), intent: { openedAt: "2026-10-11T09:00:00.000Z", textHash: "h1" } } });
	assert.equal(model.movePost(intent, "p1", 3).error, "posted-locked", "an open intent locks its post too");
});

test("structure: split at the caret with grapheme snapping, and undo", () => {
	const doc = makeDoc([{ id: "p1", text: "One." }, { id: "p3", text: "First sentence. Second sentence.", media: [{ kind: "image", alt: "Chart" }], note: "From notes" }]);
	const approvedDoc = model.setStatus(doc, "p3", "approved").doc;
	const split = model.splitPost(approvedDoc, "p3", "First sentence. ".length - 1);
	assert.equal(split.id, "p4");
	assert.deepEqual(split.doc.content.posts.slice(1), [
		{ id: "p3", text: "First sentence.", media: [{ kind: "image", alt: "Chart" }], note: "From notes" },
		{ id: "p4", text: "Second sentence.", note: "Split from p3" },
	]);
	assert.equal(model.statusOf(split.doc, "p3"), "draft", "the shortened first half needs approval again");
	assert.deepEqual(split.info, ["Post 2 split into posts 2 and 3", "Post 2 went back to draft: its text changed after approval"]);
	const undone = model.undo(split.doc, split.undo);
	assert.deepEqual(undone.doc.content, approvedDoc.content);
	assert.equal(model.statusOf(undone.doc, "p3"), "approved", "undo restores the approval");
	const emoji = makeDoc([{ id: "p1", text: `Hi ${FAMILY} there` }]);
	const inside = model.splitPost(emoji, "p1", 3 + 3);
	assert.deepEqual(texts(inside.doc), ["Hi", `${FAMILY} there`], "an offset inside a ZWJ sequence snaps down");
	const pair = makeDoc([{ id: "p1", text: `ab${String.fromCodePoint(0x1f9f5)}cd` }]);
	assert.deepEqual(texts(model.splitPost(pair, "p1", 3).doc), ["ab", `${String.fromCodePoint(0x1f9f5)}cd`], "never splits a surrogate pair");
	for (const offset of [0, 2, 99]) assert.equal(model.splitPost(makeDoc([{ id: "p1", text: "  Hello  " }]), "p1", offset).error, "split-empty", String(offset));
	const edited = model.setText(split.doc, "p3", "Changed");
	assert.equal(model.undo(edited.doc, split.undo).error, "undo-stale");
	const posted = makeDoc([{ id: "p1", text: "A. B." }], { p1: postedEntry("1844", null, "A. B.") });
	assert.equal(model.splitPost(posted, "p1", 2).error, "posted-locked");
});

test("structure: merge with next, media and note limits, and undo", () => {
	const media = count => Array.from({ length: count }, (_, index) => ({ kind: "image", alt: `i${index}`, asset: `media/x-${count}-${index}.png` }));
	const doc = makeDoc([
		{ id: "p1", text: "Top  ", note: "A", media: media(1) },
		{ id: "p2", text: "  Bottom", note: "B", media: media(2) },
		{ id: "p3", text: "Last", media: media(3) },
	]);
	const merged = model.mergeWithNext(doc, "p1");
	assert.deepEqual(merged.doc.content.posts[0], { id: "p1", text: "Top\n\nBottom", media: [...media(1), ...media(2)], note: "A · B" });
	assert.deepEqual(ids(merged.doc), ["p1", "p3"]);
	assert.deepEqual(merged.info, ["Posts 1 and 2 merged"]);
	assert.deepEqual(model.undo(merged.doc, merged.undo).doc.content, doc.content);
	assert.equal(model.mergeWithNext(doc, "p2").error, "too-many-media");
	assert.equal(model.mergeWithNext(doc, "p3").error, "no-next");
	const longNotes = makeDoc([{ id: "p1", text: "a", note: "n".repeat(200) }, { id: "p2", text: "b", note: "m".repeat(200) }]);
	assert.equal(model.mergeWithNext(longNotes, "p1").doc.content.posts[0].note.length, model.MAX_NOTE_CHARS);
	const posted = makeDoc(doc.content.posts, { p2: postedEntry("1844", null, doc.content.posts[1].text) });
	assert.equal(model.mergeWithNext(posted, "p1").error, "posted-locked");
});

test("structure: delete with one-step undo, including media bytes", () => {
	const base = sixDoc();
	const withImage = model.fillPlannedSlot(base, "p2", 0, { asset: "media/p2-1.png", dataUrl: "data:image/png;base64,AAAA" }).doc;
	const approvedDoc = model.setStatus(withImage, "p2", "approved").doc;
	const removed = model.deletePost(approvedDoc, "p2");
	assert.deepEqual(ids(removed.doc), ["p1", "p3", "p4", "p5", "p6"]);
	assert.equal(removed.doc.state.posts.p2, undefined);
	assert.deepEqual(removed.doc.state.media, {}, "orphaned bytes leave with the post");
	assert.deepEqual(removed.info, ["Post 2 deleted"]);
	const restored = model.undo(removed.doc, removed.undo);
	assert.deepEqual(restored.doc.content, approvedDoc.content);
	assert.deepEqual(restored.doc.state, approvedDoc.state);
	assert.equal(model.undo(model.insertPost(removed.doc, null).doc, { ...removed.undo, post: { ...removed.undo.post, id: "p7" } }).error, "undo-stale", "a reused id makes the undo stale");
	assert.equal(model.undo(base, null).error, "no-undo");
	assert.equal(model.deletePost(makeDoc([{ id: "p1", text: "only" }]), "p1").error, "last-post");
	const posted = makeDoc(base.content.posts, { p1: postedEntry("1844", null, base.content.posts[0].text) });
	assert.equal(model.deletePost(posted, "p1").error, "posted-locked");
	const later = model.recordPosted(model.setStatus(removed.doc, "p1", "approved").doc, "p1", "1844", NOW).doc;
	const afterPost = model.recordPosted(model.setStatus(later, "p3", "approved").doc, "p3", "1845", NOW).doc;
	assert.equal(model.undo(afterPost, removed.undo).error, "posted-locked", "can't undo a delete above posted posts");
});

test("media: add, remove, alt and planned slots", () => {
	const doc = makeDoc([{ id: "p1", text: "Look" }, { id: "p3", text: "Other", media: [{ kind: "image", alt: "x", asset: "media/p3-1.png" }] }]);
	assert.equal(model.mediaAssetName(doc, "p3", "PNG"), "media/p3-2.png");
	assert.equal(model.mediaAssetName(doc, "p1", ".webp"), "media/p1-1.webp");
	const added = model.addMedia(doc, "p1", { kind: "image", alt: "A chart", asset: "media/p1-1.png", dataUrl: "data:image/png;base64,AAAA" });
	assert.deepEqual(added.doc.content.posts[0].media, [{ kind: "image", alt: "A chart", asset: "media/p1-1.png" }]);
	assert.equal(added.doc.state.media["media/p1-1.png"], "data:image/png;base64,AAAA");
	assert.equal(model.addMedia(added.doc, "p1", { alt: "dup", asset: "media/p1-1.png" }).error, "duplicate-asset");
	for (const asset of ["../x.png", "/abs.png", "data:x", "C:\\x.png", "media//x.png", "a\\b.png"]) {
		assert.equal(model.addMedia(doc, "p1", { alt: "x", asset }).error, "bad-asset", asset);
	}
	assert.equal(model.addMedia(doc, "p1", { kind: "audio", alt: "x" }).error, "bad-kind");
	assert.equal(model.addMedia(doc, "p1", { alt: "x", dataUrl: "data:image/png;base64,AAAA" }).error, "bad-data");
	let full = doc;
	for (let n = 1; n <= 4; n++) full = model.addMedia(full, "p1", { alt: `i${n}`, asset: `media/p1-${n}.png` }).doc;
	assert.equal(model.addMedia(full, "p1", { alt: "five", asset: "media/p1-5.png" }).error, "too-many-media");
	const removed = model.removeMedia(added.doc, "p1", "media/p1-1.png");
	assert.equal(removed.doc.content.posts[0].media, undefined);
	assert.deepEqual(removed.doc.state.media, {});
	assert.equal(model.removeMedia(added.doc, "p1", 3).error, "not-found");
	assert.equal(model.setMediaAlt(added.doc, "p1", 0, "Better alt").doc.content.posts[0].media[0].alt, "Better alt");
	const approvedDoc = model.setStatus(added.doc, "p1", "approved").doc;
	const keep = model.addMedia(approvedDoc, "p1", { alt: "Second", asset: "media/p1-2.png" });
	assert.equal(model.statusOf(keep.doc, "p1"), "approved", "an approvable media edit keeps the approval");
	const lose = model.setMediaAlt(approvedDoc, "p1", 0, "");
	assert.equal(model.statusOf(lose.doc, "p1"), "draft");
	assert.deepEqual(lose.info, ["Post 1 went back to draft: image 1 needs alt text"]);
	const planned = sixDoc();
	const filled = model.fillPlannedSlot(planned, "p2", 0, { asset: "media/p2-1.png", dataUrl: "data:image/png;base64,AAAA" });
	assert.deepEqual(filled.doc.content.posts[1].media, [{ kind: "image", alt: EXPECTED.posts[1].media[0].alt, asset: "media/p2-1.png" }]);
	assert.equal(model.fillPlannedSlot(filled.doc, "p2", 0, { asset: "media/p2-2.png" }).error, "not-planned");
	const posted = makeDoc(doc.content.posts, { p1: postedEntry("1844", null, "Look") });
	assert.equal(model.addMedia(posted, "p1", { alt: "x" }).error, "posted-locked");
});

test("posting: buildIntentUrl encodes text and validates in_reply_to", () => {
	assert.equal(model.INTENT_BASE, "https://x.com/intent/tweet");
	assert.equal(model.buildIntentUrl({ text: "a b\nc #tag & more?" }), "https://x.com/intent/tweet?text=a%20b%0Ac%20%23tag%20%26%20more%3F");
	assert.equal(model.buildIntentUrl({ text: "hi", inReplyTo: "1844000000000000001" }), "https://x.com/intent/tweet?text=hi&in_reply_to=1844000000000000001");
	assert.equal(model.buildIntentUrl({ text: "hi", inReplyTo: null }), "https://x.com/intent/tweet?text=hi");
	assert.throws(() => model.buildIntentUrl({ text: "hi", inReplyTo: "12&x=1" }), RangeError);
});

test("posting: parsePostedUrl accepts X links and raw ids, rejects everything else", () => {
	const accept = [
		["https://x.com/ada/status/1844000000000000001", "1844000000000000001", "ada"],
		["https://twitter.com/Ada_99/status/42", "42", "Ada_99"],
		["mobile.twitter.com/ada/status/42", "42", "ada"],
		["http://www.x.com/ada/statuses/42", "42", "ada"],
		["https://x.com/i/web/status/42", "42", null],
		["https://x.com/i/status/42", "42", null],
		["https://x.com/ada/status/42?s=46&t=AbC-123", "42", "ada"],
		["https://x.com/ada/status/42/photo/1", "42", "ada"],
		["  https://x.com/ada/status/42#frag  ", "42", "ada"],
		["1844000000000000001", "1844000000000000001", null],
	];
	for (const [input, id, handle] of accept) {
		const parsed = model.parsePostedUrl(input);
		assert.deepEqual(parsed, { id, handle, url: `https://x.com/${handle || "i"}/status/${id}` }, input);
	}
	assert.equal(typeof model.parsePostedUrl("1844000000000000001").id, "string", "19-digit ids stay strings");
	for (const input of ["", "https://example.com/ada/status/42", "javascript:alert(1)", "https://x.com/ada", "https://x.com/ada/status/abc", "123456789012345678901", "https://x.com.evil.com/ada/status/42", "https://evilx.com/ada/status/42", "https://x.com/way_too_long_handle_here/status/42"]) {
		assert.ok(model.parsePostedUrl(input).error, input);
	}
});

test("posting: a scripted six-post chain replies 1 to 2 to ... to 5, then reports done", () => {
	let doc = approveAll(sixDoc());
	const replies = [];
	const postedId = n => `18440000000000000${n}`;
	for (let n = 1; n <= 6; n++) {
		const step = model.nextStep(doc);
		assert.equal(step.kind, "open");
		assert.deepEqual([step.postId, step.position, step.total], [`p${n}`, n, 6]);
		assert.equal(step.text, EXPECTED.posts[n - 1].text);
		const href = model.buildIntentUrl(step);
		replies.push(new URLSearchParams(href.split("?")[1]).get("in_reply_to"));
		assert.equal(new URLSearchParams(href.split("?")[1]).get("text"), step.text);
		doc = model.markIntentOpened(doc, step.postId, NOW).doc;
		assert.equal(model.nextStep(doc).kind, "await-url");
		const recorded = model.recordPosted(doc, step.postId, `https://x.com/ada/status/${postedId(n)}`, NOW + n);
		assert.equal(recorded.error, undefined);
		assert.equal(recorded.warnings, undefined);
		doc = recorded.doc;
	}
	assert.deepEqual(replies, [null, postedId(1), postedId(2), postedId(3), postedId(4), postedId(5)]);
	assert.deepEqual(model.nextStep(doc), { kind: "done", posted: 6 });
	assert.deepEqual(model.validateThread(doc).errors, []);
	assert.deepEqual(doc.state.posts.p2.posted, {
		id: postedId(2),
		url: `https://x.com/ada/status/${postedId(2)}`,
		inReplyTo: postedId(1),
		at: new Date(NOW + 2).toISOString(),
		text: EXPECTED.posts[1].text,
	});
	assert.equal(doc.state.posts.p6.intent, undefined, "recording clears the intent");
});

test("posting: blocked reasons, skipped posts and the empty chain", () => {
	const reasons = [
		[{ text: "" }, "empty"],
		[{ text: "Due [DATA NEEDED: date]" }, "data-needed"],
		[{ text: "Pic", media: [{ kind: "image", alt: "[DATA NEEDED: alt text for image 1]", asset: "media/p1-1.png" }] }, "data-needed"],
		[{ text: "a".repeat(281) }, "invalid"],
		[{ text: "Fine" }, "not-approved"],
	];
	for (const [post, reason] of reasons) {
		const step = model.nextStep(makeDoc([{ id: "p1", ...post }]));
		assert.deepEqual([step.kind, step.postId, step.reason], ["blocked", "p1", reason], reason);
	}
	const doc = evalDoc();
	const skipped = model.setStatus(approveAll(model.setStatus(doc, "p4", "skipped").doc), "p1", "approved").doc;
	assert.deepEqual(model.chain(skipped).map(post => post.id), ["p1", "p2", "p3", "p5", "p6"]);
	assert.equal(model.nextStep(skipped).total, 5);
	const allSkipped = makeDoc([{ id: "p1", text: "a" }], { p1: { status: "skipped" } });
	assert.deepEqual(model.nextStep(allSkipped), { kind: "empty" });
	assert.deepEqual(model.nextStep(makeDoc([])), { kind: "empty" });
	const stale = makeDoc([{ id: "p1", text: "Now" }], { p1: { status: "approved", approvedHash: "hold" } });
	assert.equal(model.nextStep(stale).reason, "not-approved", "a stale approval does not open an intent");
});

test("posting: recordPosted errors and warnings, unrecord and cancel", () => {
	const doc = approveAll(sixDoc());
	assert.equal(model.recordPosted(doc, "p2", "42", NOW).error, "not-current");
	assert.equal(model.recordPosted(doc, "p1", "https://example.com/x", NOW).error, "bad-url");
	assert.equal(model.recordPosted(doc, "p1", { error: "nope" }, NOW).error, "bad-url");
	assert.equal(model.recordPosted(makeDoc([{ id: "p1", text: "Draft" }]), "p1", "42", NOW).error, "not-approved");
	const first = model.recordPosted(doc, "p1", "https://x.com/ada/status/500", NOW);
	assert.deepEqual(first.info, ["Post 1 recorded. Next: post 2."]);
	assert.equal(model.recordPosted(first.doc, "p2", "https://x.com/ada/status/500", NOW).error, "duplicate");
	const other = model.recordPosted(first.doc, "p2", "https://x.com/bob/status/400", NOW);
	assert.deepEqual(other.warnings, ["The link is from @bob, not @ada", "The post id is older than the post it replies to"]);
	const raw = model.recordPosted(first.doc, "p2", "600", NOW);
	assert.equal(raw.warnings, undefined, "a raw id has no handle to compare");
	assert.equal(model.unrecordPosted(raw.doc, "p1").error, "not-last");
	const undone = model.unrecordPosted(raw.doc, "p2");
	assert.equal(model.statusOf(undone.doc, "p2"), "approved");
	assert.equal(model.nextStep(undone.doc).postId, "p2");
	assert.equal(model.unrecordPosted(doc, "p1").error, "not-posted");
	const opened = model.markIntentOpened(doc, "p1", NOW).doc;
	assert.deepEqual(opened.state.posts.p1.intent, { openedAt: new Date(NOW).toISOString(), textHash: model.hashText(EXPECTED.posts[0].text) });
	assert.equal(model.setText(opened, "p1", "edit").error, "intent-open");
	assert.equal(model.setStatus(opened, "p1", "draft").error, "intent-open");
	assert.equal(model.markIntentOpened(doc, "p3", NOW).error, "not-current");
	const cancelled = model.cancelIntent(opened, "p1");
	assert.equal(cancelled.doc.state.posts.p1.intent, undefined);
	assert.equal(model.statusOf(cancelled.doc, "p1"), "approved");
	assert.equal(model.cancelIntent(doc, "p1").doc, doc);
});

test("posting: unrecord refuses while a later post is open in X; a drifted intent records the parent X got", () => {
	const stale = result => result.warnings.filter(issue => issue.code === "intent-stale").map(issue => issue.id);
	const replyTo = step => new URLSearchParams(model.buildIntentUrl(step).split("?")[1]).get("in_reply_to");
	// Regression: record post 1, open post 2 in X (in_reply_to = 1000), then press Undo on post 1's toast.
	let doc = model.recordPosted(approveAll(sixDoc()), "p1", "https://x.com/ada/status/1000", NOW).doc;
	assert.equal(replyTo(model.nextStep(doc)), "1000");
	doc = model.markIntentOpened(doc, "p2", NOW).doc;
	assert.deepEqual(stale(model.validateThread(doc)), [], "a fresh intent is not stale");
	const refused = model.unrecordPosted(doc, "p1");
	assert.deepEqual([refused.error, refused.message], ["intent-open", "Post 2 is open in X; cancel it before unrecording post 1"]);
	assert.equal(refused.doc, doc);
	// Cancelling post 2 first allows the undo; the reopened intent then replies to the new record.
	const undone = model.unrecordPosted(model.cancelIntent(doc, "p2").doc, "p1");
	assert.equal(undone.error, undefined);
	assert.equal(model.nextStep(undone.doc).postId, "p1");
	const again = model.recordPosted(undone.doc, "p1", "https://x.com/ada/status/2000", NOW).doc;
	assert.equal(replyTo(model.nextStep(again)), "2000");
	const reopened = model.markIntentOpened(again, "p2", NOW).doc;
	const fixed = model.recordPosted(reopened, "p2", "https://x.com/ada/status/3000", NOW);
	assert.deepEqual([fixed.doc.state.posts.p2.posted.inReplyTo, fixed.warnings], ["2000", undefined]);
	assert.deepEqual(model.validateThread(fixed.doc).errors, []);
	// State that drifted outside the model ops (a merged local record): post 2's intent still says 1000.
	const drifted = makeDoc(doc.content.posts, { ...again.state.posts, p2: doc.state.posts.p2 });
	assert.deepEqual(stale(model.validateThread(drifted)), ["p2"]);
	assert.equal(model.validateThread(drifted).warnings.find(issue => issue.code === "intent-stale").message, "Post 2 (p2): Open in X, but the queue moved on since; cancel it and open it again");
	const recorded = model.recordPosted(drifted, "p2", "https://x.com/ada/status/3000", NOW);
	assert.equal(recorded.doc.state.posts.p2.posted.inReplyTo, "1000", "records the parent X was given, not the queue's");
	assert.deepEqual(recorded.warnings, ["Post 2 was opened in X as a reply to 1000, but the queue expects 2000"]);
	assert.deepEqual(model.validateThread(recorded.doc).errors.map(issue => issue.code), ["reply-chain"]);
	// An intent on a post that is not the queue's current one is stale too.
	const ahead = makeDoc(doc.content.posts, { p1: approved(doc, "p1"), p2: doc.state.posts.p2 });
	assert.deepEqual(stale(model.validateThread(ahead)), ["p2"]);
});

test("numbering (S1): suffix and prefix over the chain, reserve, and the lock after the first post", () => {
	const doc = approveAll(sixDoc());
	const suffix = model.setNumbering(doc, "suffix");
	assert.equal(model.composePostText(suffix.doc, "p2"), `${EXPECTED.posts[1].text}\n\n2/6`);
	assert.equal(model.statusOf(suffix.doc, "p2"), "draft", "approvals revert when numbering changes the text");
	assert.equal(suffix.info.length, 6);
	const prefix = model.setNumbering(sixDoc(), "prefix").doc;
	assert.equal(model.composePostText(prefix, "p1"), `1/6 ${EXPECTED.posts[0].text}`);
	const skipped = model.setStatus(prefix, "p1", "skipped").doc;
	assert.equal(model.composePostText(skipped, "p2"), `1/5 ${EXPECTED.posts[1].text}`);
	assert.equal(model.composePostText(skipped, "p1"), EXPECTED.posts[0].text, "skipped posts are not numbered");
	assert.equal(model.setNumbering(doc, "roman").error, "bad-numbering");
	let started = approveAll(suffix.doc);
	started = model.recordPosted(started, "p1", "700", NOW).doc;
	assert.equal(model.setNumbering(started, "none").error, "numbering-locked");
	assert.equal(model.insertPost(started).error, "numbering-locked");
	assert.equal(model.deletePost(started, "p6").error, "numbering-locked");
	assert.equal(model.splitPost(started, "p6", 10).error, "numbering-locked");
	assert.equal(model.setStatus(started, "p6", "skipped").error, "numbering-locked");
	assert.equal(model.mergeWithNext(started, "p5").error, "numbering-locked");
	assert.equal(model.movePost(started, "p6", 1).error, undefined, "reordering keeps the total");
	const intentOnly = model.markIntentOpened(approveAll(model.setNumbering(sixDoc(), "suffix").doc), "p1", NOW).doc;
	assert.equal(model.setNumbering(intentOnly, "none").error, "numbering-locked", "an open intent also freezes numbering");
});

test("fit (S2): splitToFit and fitPost keep every word and respect the reserve", () => {
	const post4 = VECTORS.evalPosts.posts[3].text;
	const pieces = model.splitToFit(post4);
	assert.ok(pieces.length === 2 && pieces.every(piece => weightedLength(piece) <= 280));
	assert.equal(pieces.join(" "), post4, "splits at a sentence end without losing text");
	assert.deepEqual(model.splitToFit("short"), ["short"]);
	const url = "https://example.com/" + "a".repeat(300);
	const withUrl = model.splitToFit(`${"word ".repeat(60)}${url} tail`);
	assert.ok(withUrl.some(piece => piece.includes(url)), "a URL is never cut");
	const word = "x".repeat(600);
	const hard = model.splitToFit(word);
	assert.deepEqual(hard.map(piece => piece.length), [280, 280, 40]);
	assert.ok(model.splitToFit(post4, 280, 7).every(piece => weightedLength(piece) <= 273));
	const fitted = model.fitPost(evalDoc(), "p4");
	assert.deepEqual(fitted.ids, ["p4", "p7"]);
	assert.deepEqual(ids(fitted.doc), ["p1", "p2", "p3", "p4", "p7", "p5", "p6"]);
	assert.equal(fitted.doc.content.posts[4].note, "Split from p4");
	assert.deepEqual(model.validateThread(fitted.doc).warnings, []);
	assert.deepEqual(model.fitPost(evalDoc(), "p1").ids, ["p1"]);
});

test("reply-to (S7): the first intent replies to settings.replyToId", () => {
	const doc = approveAll(sixDoc());
	const set = model.setReplyToId(doc, "https://x.com/ada/status/123");
	assert.equal(set.doc.state.settings.replyToId, "123");
	const step = model.nextStep(set.doc);
	assert.equal(step.inReplyTo, "123");
	assert.match(model.buildIntentUrl(step), /&in_reply_to=123$/);
	assert.equal(model.setReplyToId(doc, "not a link").error, "bad-url");
	assert.equal(model.setReplyToId(set.doc, null).doc.state.settings.replyToId, undefined);
	const started = model.recordPosted(set.doc, "p1", "124", NOW).doc;
	assert.equal(started.state.posts.p1.posted.inReplyTo, "123");
	assert.equal(model.setReplyToId(started, "9").error, "posted-locked");
});

test("operations never mutate their input (deep-frozen docs)", () => {
	const doc = sixDoc();
	const steps = [
		d => model.setText(d, "p1", "changed"),
		d => model.insertPost(d, "p1", "x"),
		d => model.deletePost(d, "p2"),
		d => model.movePost(d, "p6", 0),
		d => model.splitPost(d, "p1", 10),
		d => model.mergeWithNext(d, "p4"),
		d => model.setStatus(d, "p1", "approved"),
		d => model.approveAllValid(d),
		d => model.addMedia(d, "p1", { alt: "x", asset: "media/p1-1.png", dataUrl: "data:image/png;base64,AA" }),
		d => model.fillPlannedSlot(d, "p2", 0, { asset: "media/p2-1.png" }),
		d => model.setNumbering(d, "suffix"),
		d => model.fitPost(d, "p1"),
	];
	const snapshot = JSON.stringify(doc);
	for (const step of steps) assert.doesNotThrow(() => step(doc));
	assert.equal(JSON.stringify(doc), snapshot);
});

test("module conventions: pure, bundle-safe and validator-safe source", () => {
	const source = fs.readFileSync(path.join(__dirname, "thread-model.mjs"), "utf8");
	assert.deepEqual(source.match(/^import .*$/gm), ['import { parseTweet, weightedLength } from "./twitter-text.mjs";']);
	assert.equal(/\b(?:document|window|localStorage|console|fetch|require)\b/.test(source.replace(/^\/\/.*$/gm, "")), false);
	assert.equal(source.includes('URL("http'), false);
	assert.equal(/\{\{|@@/.test(source), false);
	assert.equal(/<!--|-->|<\/?script|<\/body/i.test(source), false, "no HTML comment or script delimiters in inlined code");
	assert.equal(/#[0-9A-Fa-f]{3,8}\b/.test(source), false);
	assert.equal(/\b(?:rgba?|hsla?)\(/.test(source), false);
	assert.equal(/\bexport\s+(?:default|\{|\*)/.test(source), false, "bundle.mjs strips only leading export keywords");
	// ws5 spec §5 budget (acceptance A14), counted like scripts/verify-file-size-budget.js.
	const lines = (source.match(/\n/g)?.length ?? 0) + (source.endsWith("\n") ? 0 : 1);
	assert.ok(lines <= 650, `thread-model.mjs has ${lines} lines; the ws5 §5 budget is 650`);
});
