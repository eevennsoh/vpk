// T3 (ws5-xthread): content and state islands through json-island.mjs, the slice splice,
// canonical detection, HTML text escaping, id slugs and defensive normalisation.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseJsonIsland, serializeJsonIsland } from "../json-island.mjs";
import { validateHtmlString } from "../check-html.mjs";
import * as islands from "./islands.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOSTILE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "content-hostile.json"), "utf8"));
const LS = String.fromCharCode(0x2028);
const STATE = { ...islands.emptyState("hostile-thread"), posts: { p2: { status: "approved", approvedHash: "habc" } }, media: { "media/p1-1.png": "data:image/png;base64,iVBORw0KGgo=" } };

function page(content = HOSTILE.content, state = STATE) {
	return `<!doctype html><html><head><title>t</title></head><body><main><p>before $& $1</p>\n${islands.contentIslandTag(content)}\n<p>between $' $\`</p>\n${islands.stateIslandTag(state)}\n<p>after</p></main></body></html>`;
}

test("the fixture carries every hostile string the spec lists", () => {
	const text = HOSTILE.content.posts.map(post => post.text).join(" ");
	for (const needle of ["</script>", "#dead #2026", "{{x}}", "{{{y}}}", "rgb(1,2,3)", "hsl(1 2 3)", LS, "$&", "$1", "$`", "$'", String.fromCodePoint(0x1f44d, 0x1f3fd)]) {
		assert.ok(text.includes(needle), `fixture has ${JSON.stringify(needle)}`);
	}
	assert.equal(HOSTILE.type, "x-thread");
});

test("round trip: both islands read back exactly what was written", () => {
	const read = islands.readIslands(page());
	assert.deepEqual(read.issues, []);
	assert.deepEqual(read.content, HOSTILE.content);
	assert.deepEqual(read.state, STATE);
});

test("the islands use json-island escapes: no raw markup, colour or placeholder text survives", () => {
	const html = page();
	const tag = islands.contentIslandTag(HOSTILE.content);
	assert.equal(tag.indexOf("</script>"), tag.length - "</script>".length, "only the closing tag");
	for (const raw of ["#dead", "{{", "rgb(", "hsl(", "<svg", LS]) assert.equal(tag.includes(raw), false, `no raw ${JSON.stringify(raw)}`);
	assert.match(html, /data-vpk-content="x-thread"/);
	assert.match(html, /data-vpk-x-thread-state="vpk-x-thread-state\/1"/);
});

test("writeIslands replaces only the two payloads and keeps $ sequences intact", () => {
	const before = page();
	const content = { ...HOSTILE.content, title: "Changed $& $1 $` $' title" };
	const state = { ...STATE, stateRevision: 7 };
	const after = islands.writeIslands(before, { content, state });
	const a = islands.findIsland(before, islands.CONTENT_ATTR), b = islands.findIsland(after, islands.CONTENT_ATTR);
	const sa = islands.findIsland(before, islands.STATE_ATTR), sb = islands.findIsland(after, islands.STATE_ATTR);
	assert.equal(after.slice(0, b.openEnd), before.slice(0, a.openEnd), "bytes before the content payload");
	assert.equal(after.slice(b.closeStart, sb.openEnd), before.slice(a.closeStart, sa.openEnd), "bytes between the payloads");
	assert.equal(after.slice(sb.closeStart), before.slice(sa.closeStart), "bytes after the state payload");
	assert.deepEqual(islands.readIslands(after).content, content);
	assert.equal(islands.readIslands(after).state.stateRevision, 7);
	assert.equal(islands.writeIslands(after, { content, state }), after, "idempotent");
	assert.ok(after.includes("<p>before $& $1</p>") && after.includes("<p>between $' $`</p>"));
});

test("writeIslands throws when an island is missing; readIslands reports it without throwing", () => {
	const noState = `<body>${islands.contentIslandTag(HOSTILE.content)}</body>`;
	assert.throws(() => islands.writeIslands(noState, { content: HOSTILE.content, state: STATE }), /content island and a state island/);
	const read = islands.readIslands(noState);
	assert.equal(read.state, undefined);
	assert.ok(read.issues.some(issue => /no state island/.test(issue)));
	const broken = islands.readIslands(page().replace('"title":', '"title"'));
	assert.equal(broken.content, undefined);
	assert.ok(broken.issues.some(issue => /not valid JSON/.test(issue)));
	assert.equal(islands.readIslands(page() + islands.stateIslandTag(STATE)).issues.length, 1, "two state islands");
});

test("findIslands keeps only x-thread content islands", () => {
	const other = `<script type="application/json" data-vpk-content="document">{"title":"x"}</script>`;
	const html = other + page();
	assert.equal(islands.findIslands(html, islands.CONTENT_ATTR).length, 1);
	assert.deepEqual(islands.readIslands(html).content, HOSTILE.content);
});

test("isCanonicalIsland: true for written islands, false after a hand edit", () => {
	const html = page();
	const content = islands.findIsland(html, islands.CONTENT_ATTR), state = islands.findIsland(html, islands.STATE_ATTR);
	assert.equal(islands.isCanonicalIsland(content.raw), true);
	assert.equal(islands.isCanonicalIsland(state.raw), true);
	const edited = content.raw.replace("\\u0023dead", "#cafe");
	assert.notEqual(edited, content.raw);
	assert.equal(islands.isCanonicalIsland(edited), false);
	assert.equal(islands.isCanonicalIsland("{nope"), false);
	assert.equal(serializeJsonIsland(parseJsonIsland(content.raw)), content.raw);
});

test("escapeHtmlText writes entities for markup, # { } and the paren after colour functions", () => {
	assert.equal(islands.escapeHtmlText("#cafe {{x}} rgb(0,0,0) <b> & \"q\""), "&#35;cafe &#123;&#123;x&#125;&#125; rgb&#40;0,0,0) &lt;b&gt; &amp; &quot;q&quot;");
	assert.equal(islands.escapeHtmlText("HSLA(1 2 3)"), "HSLA&#40;1 2 3)");
	assert.equal(islands.escapeHtmlText(null), "");
});

test("a rendered page with hostile content and an escaped title passes validateHtmlString", async () => {
	const { renderXThreadHtml } = await import("./render.mjs");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "x-thread-"));
	const html = renderXThreadHtml({ content: HOSTILE.content, state: islands.emptyState("hostile-thread"), filePath: path.join(dir, "hostile.html") });
	const result = validateHtmlString(html, "hostile.html");
	assert.deepEqual(result.failures, []);
	assert.ok(html.includes("Why rgb&#40;0,0,0) matters &#35;cafe &#123;&#123;x&#125;&#125;"), "title escaped");
	assert.deepEqual(islands.readIslands(html).content, HOSTILE.content);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("slugifyThreadId and the thread id pattern", () => {
	assert.equal(islands.slugifyThreadId("x-thread-AbC12z"), "x-thread-abc12z");
	assert.equal(islands.slugifyThreadId(""), "x-thread");
	assert.equal(islands.slugifyThreadId("  Café Launch!! 2026 "), "cafe-launch-2026");
	assert.equal(islands.slugifyThreadId("a".repeat(80) + "-b").length, 64);
	assert.ok(islands.THREAD_ID_PATTERN.test(islands.slugifyThreadId("Ünïcödé thread")));
	assert.equal(islands.storageKey("demo-x-thread"), "vpk-x-thread:demo-x-thread");
});

test("normalizeContent never throws and repairs damaged shapes", () => {
	for (const damaged of [null, undefined, 3, "x", [], {}, { posts: "x" }, { title: 4, posts: [null, 1, { id: "p1" }, { id: "p1", text: 2 }, { id: "zz", text: "t", media: "m" }] }]) {
		const { content, issues } = islands.normalizeContent(damaged);
		assert.equal(typeof content.title, "string");
		assert.ok(Array.isArray(content.posts));
		assert.ok(Array.isArray(issues));
	}
	const { content, issues } = islands.normalizeContent({ title: "T", posts: [{ id: "p1", text: "a" }, { id: "p1", text: "b" }, { id: "p3", text: "c", media: [{ kind: "x", alt: "a", asset: "../up.png" }, { kind: "gif", alt: "b", asset: "media/p3-1.gif" }] }] });
	assert.deepEqual(content.posts.map(post => post.id), ["p1", "p2", "p3"]);
	assert.deepEqual(content.posts[2].media, [{ kind: "image", alt: "a" }, { kind: "gif", alt: "b", asset: "media/p3-1.gif" }]);
	assert.ok(issues.some(issue => /repeated id/.test(issue)) && issues.some(issue => /leaves the thread folder/.test(issue)));
	const many = islands.normalizeContent({ title: "T", posts: Array.from({ length: 30 }, (_, n) => ({ id: `p${n + 1}`, text: "x" })) });
	assert.equal(many.content.posts.length, 25);
});

test("normalizeState drops unknown ids and posted entries without a link, and keeps valid media", () => {
	const content = { title: "T", posts: [{ id: "p1", text: "a" }, { id: "p2", text: "b" }] };
	const { state, issues } = islands.normalizeState({
		schema: "vpk-x-thread-state/1", threadId: "Bad Id", stateRevision: 0, settings: { numbering: "weird", replyToId: "123" },
		posts: { p1: { status: "posted", posted: { id: "x" } }, p2: { status: "approved", approvedHash: "h1" }, p9: { status: "draft" } },
		media: { "media/p1-1.png": "data:image/png;base64,AA==", "/abs.png": "data:image/png;base64,AA==", "media/p2-1.png": 4 },
	}, content);
	assert.equal(state.threadId, "x-thread");
	assert.equal(state.stateRevision, 1);
	assert.deepEqual(state.settings, { numbering: "none", replyToId: "123" });
	assert.deepEqual(state.posts, { p2: { status: "approved", approvedHash: "h1" } });
	assert.deepEqual(Object.keys(state.media), ["media/p1-1.png"]);
	assert.ok(issues.some(issue => /p9/.test(issue)) && issues.some(issue => /without a valid post link/.test(issue)));
	assert.deepEqual(islands.normalizeState(undefined, content).state, islands.emptyState("x-thread"));
});

// B2 decision 15a: posted.url is rebuilt from the id and handle, so no stored link can carry another scheme or host.
// B2 decision 15a, round 2: the page turns state.media into blob: download links typed by the data URL's own MIME type, so
// text/html or image/svg+xml bytes from an imported file would open as a same-origin document that runs its script.
test("normalizeState keeps only PNG, JPEG, GIF and WebP base64 data URLs as media, and reports every value it drops", () => {
	const content = { title: "T", posts: [{ id: "p1", text: "a" }] };
	const b64 = "PHNjcmlwdD5kb2N1bWVudC50aXRsZT0iUFdORUQiPC9zY3JpcHQ+";
	const good = { "media/p1-1.png": "data:image/png;base64,iVBORw0KGgo=", "media/p1-2.jpg": "data:image/jpeg;base64,/9j/4AAQ", "media/p1-3.gif": "data:image/gif;base64,R0lGODlh", "media/p1-4.webp": "data:image/webp;base64,UklGRg==" };
	const hostile = {
		"media/h-html.png": `data:text/html;base64,${b64}`,
		"media/h-svg.png": `data:image/svg+xml;base64,${b64}`,
		"media/h-svg-utf8.png": "data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E",
		"media/h-js.png": "javascript:alert(1)",
		"media/h-plain.png": "data:image/png,not-base64",
		"media/h-type.png": `data:image/png;charset=utf-8;base64,${b64}`,
		"media/h-upper.png": `DATA:text/html;base64,${b64}`,
		"media/h-tail.png": `data:image/png;base64,${b64}\n<script>`,
		"media/h-empty.png": "data:image/png;base64,",
		"media/h-num.png": 4,
	};
	const { state, issues } = islands.normalizeState({ schema: "vpk-x-thread-state/1", threadId: "t", stateRevision: 1, posts: {}, media: { ...good, ...hostile } }, content);
	assert.deepEqual(state.media, good);
	assert.equal(issues.filter(issue => /^Image .* was dropped/.test(issue)).length, Object.keys(hostile).length, issues.join(" | "));
	assert.ok(issues.includes("Image media/h-html.png was dropped: its bytes are not a PNG, JPEG, GIF or WebP base64 data URL"));
	assert.deepEqual(Object.keys(islands.normalizeState({ media: { "../h.png": `data:text/html;base64,${b64}` } }, content).state.media), [], "a bad path never gets in either");
	for (const value of Object.values(good)) assert.equal(islands.isImageDataUrl(value), true, value);
	for (const value of [...Object.values(hostile), undefined, null, {}]) assert.equal(islands.isImageDataUrl(value), false, String(value));
});

test("normalizeState rebuilds every posted link as https://x.com/<handle|i>/status/<id>", () => {
	const content = { title: "T", posts: ["p1", "p2", "p3", "p4", "p5"].map(id => ({ id, text: id })) };
	const posted = (id, url) => ({ status: "posted", posted: { id, url, at: "", text: "" } });
	const { state, issues } = islands.normalizeState({
		posts: {
			p1: posted("111", "javascript:alert(1)"),
			p2: posted("222", "https://twitter.com/Ledger_App/status/222?s=46"),
			p3: posted("333", "https://x.com/ledgerapp/status/999"),
			p4: posted("444", "https://x.com/ledgerapp/status/444"),
			p5: { status: "posted", posted: { id: "555" } },
		},
	}, content);
	const urls = Object.fromEntries(Object.entries(state.posts).map(([id, entry]) => [id, entry.posted.url]));
	assert.deepEqual(urls, {
		p1: "https://x.com/i/status/111",
		p2: "https://x.com/Ledger_App/status/222",
		p3: "https://x.com/i/status/333",
		p4: "https://x.com/ledgerapp/status/444",
		p5: "https://x.com/i/status/555",
	});
	assert.deepEqual(issues.filter(issue => /rebuilt/.test(issue)).map(issue => issue.split(":")[0]), ["p1", "p2", "p3"], "an already canonical or missing link raises no note");
	assert.equal(issues.join("\n").includes("javascript:"), false, "the hostile text never reaches the issue list");
	assert.equal(islands.canonicalPostedUrl({ id: "7", url: "data:text/html,x" }), "https://x.com/i/status/7");
});

test("canonicalJson sorts keys and contentHash is stable across key order", () => {
	assert.equal(islands.canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] }), '{"a":[{"c":3,"d":2}],"b":1}');
	assert.equal(islands.contentHash({ title: "T", posts: [] }), islands.contentHash({ posts: [], title: "T" }));
	assert.match(islands.contentHash({ title: "T" }), /^h[0-9a-z]+$/);
});

test("module conventions: bundle-safe imports, no own serializer or hashText, within budget", () => {
	const source = fs.readFileSync(path.join(__dirname, "islands.mjs"), "utf8");
	const imports = source.split("\n").filter(line => line.startsWith("import "));
	assert.deepEqual(imports.map(line => /from "([^"]+)"/.exec(line)[1]), ["../json-island.mjs", "./thread-model.mjs"]);
	assert.doesNotMatch(source, /function hashText|JSON\.stringify\(content|<!--|-->|<script|console\.|\{\{/);
	assert.ok(source.split("\n").length <= 250, "islands.mjs stays within its 250-line budget");
});
