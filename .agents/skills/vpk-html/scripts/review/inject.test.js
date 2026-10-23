#!/usr/bin/env node

// ws1 review runtime serialization and blocks (T-INJ1-T-INJ7), the template guard (T-TPL1),
// the CLI (T-CLI1-T-CLI5) and the demo drift check (T-DEMO1). The DOM test (T-INJ4) uses
// @happy-dom/global-registrator, as scripts/lib/render-component.js does, and asserts
// strings and booleans only.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const SKILL = path.resolve(__dirname, "../..");
const SCRIPTS = path.join(SKILL, "scripts");
const FIXTURES = path.join(__dirname, "fixtures");
const T1 = "2026-10-11T09:00:00.000Z";

const load = name => import(path.join(__dirname, `${name}.mjs`));
const loadSkill = name => import(path.join(SCRIPTS, name));
const readFixture = name => fs.readFileSync(path.join(FIXTURES, name), "utf8");
const readDemo = name => fs.readFileSync(path.join(SKILL, "assets/demos", name), "utf8");
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "vpk-review-"));
const quiet = () => {
	const lines = [];
	return { lines, io: { out: line => lines.push(line), err: line => lines.push(line), raw: text => lines.push(text), now: () => T1 } };
};

const DECISION_HTML = `<fieldset class="vpk-decision" data-vpk-decision="retry"><legend>Should a failed send retry on its own?</legend><label><input type="radio" name="retry" value="3" checked> Yes, 3 times</label><label><input type="radio" name="retry" value="no"> No</label></fieldset>`;

async function stamped(name = "basic.html", seed = "inject") {
	const { stampDocument } = await load("stamp");
	return stampDocument(readFixture(name), { seed, timestamp: T1, reviewable: true });
}

test("T-INJ1 inject is idempotent, refresh rewrites only its blocks, remove restores the bytes", async () => {
	const { injectReviewRuntime, refreshReviewRuntime, removeReviewRuntime, hasReviewRuntime } = await load("inject");
	const { reviewMarkers, readMarkedBlockText, setMarkedBlockText } = await load("markup");
	const base = (await stamped()).html;
	const injected = injectReviewRuntime(base);
	assert.equal(hasReviewRuntime(base), false);
	assert.equal(hasReviewRuntime(injected), true);
	assert.equal(injectReviewRuntime(injected), injected, "idempotent");
	assert.equal(removeReviewRuntime(injected), base, "remove restores the pre-inject bytes");
	assert.equal(refreshReviewRuntime(base), base, "replace-only: never inserts");
	const stale = setMarkedBlockText(injected, "review", "<script data-vpk-review-runtime>old()</script>");
	const refreshed = refreshReviewRuntime(stale);
	assert.equal(refreshed, injected, "refresh rewrites the review block in place");
	const markers = reviewMarkers();
	const before = stale.slice(0, stale.indexOf(markers.review.start));
	assert.equal(refreshed.slice(0, before.length), before, "bytes before the block are unchanged");

	const withDecision = base.replace(/(<p\b[^>]*>A failed send)/, `${DECISION_HTML}\n\t\t$1`);
	assert.notEqual(withDecision, base);
	const decided = injectReviewRuntime(withDecision);
	assert.ok(readMarkedBlockText(decided, "review-content")?.includes("data-vpk-review-content"), "decisions bring the review-content block");
	assert.ok(decided.indexOf(markers.reviewContent.start) < decided.toLowerCase().indexOf("</head>"), "review-content sits in head");
	const stripped = removeReviewRuntime(decided);
	assert.notEqual(readMarkedBlockText(stripped, "review-content"), null, "--strip-review keeps review-content");
	assert.equal(readMarkedBlockText(stripped, "review"), null);
	assert.equal(removeReviewRuntime(decided, { all: true }), setMarkedBlockText(withDecision, "revisions", null), "--all removes review-content and the registry too");
	const staleContent = setMarkedBlockText(decided, "review-content", "<style data-vpk-review-content>old</style>");
	assert.equal(refreshReviewRuntime(staleContent), decided, "refresh rewrites review-content in place");
	assert.equal(injectReviewRuntime(decided.replace(DECISION_HTML, "")), injectReviewRuntime(withDecision.replace(DECISION_HTML, "")), "review-content goes away with the last decision");
});

const REVIEW_RUNTIME_FORBIDDEN = /<!--|-->|<\/?(?:script|style|body|html|head|main|template|svg|button|textarea|input|select|img|source|iframe|audio|video|object|embed|link|meta|linearGradient|radialGradient|filter)\b/i;

test("T-INJ2 serializeFunctions guards its input; every serialized module is self-contained", async () => {
	const ts = require("typescript");
	const { serializeFunctions, serializedFunctionList, SERIALIZED_MODULES, REVIEW_RUNTIME_FORBIDDEN: exported } = await load("inject");
	assert.equal(exported.source, REVIEW_RUNTIME_FORBIDDEN.source);
	assert.throws(() => serializeFunctions([function ok() {}, 2]), /not a function/);
	function twin() {}
	assert.throws(() => serializeFunctions([twin, twin]), /duplicate/);
	assert.throws(() => serializeFunctions([() => 1]), /anonymous|declaration/);
	const bundle = new Set(serializedFunctionList().map(fn => fn.name));
	assert.equal(bundle.size, serializedFunctionList().length, "no duplicate names across the bundle");
	const files = new Map(SERIALIZED_MODULES.map(([name]) => [path.join(__dirname, `${name}.mjs`), name]));
	const external = new Set([path.join(SCRIPTS, "json-island.mjs"), path.join(SCRIPTS, "secret-scan.mjs")]);
	for (const [file, name] of files) {
		const source = fs.readFileSync(file, "utf8");
		const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		for (const statement of ast.statements) {
			if (ts.isImportDeclaration(statement)) {
				const target = path.resolve(path.dirname(file), statement.moduleSpecifier.text);
				assert.ok(files.has(target) || external.has(target), `${name}.mjs imports ${statement.moduleSpecifier.text}`);
				const clause = statement.importClause;
				assert.ok(clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings), `${name}.mjs: named imports only`);
				const namespace = await import(target);
				for (const element of clause.namedBindings.elements) {
					assert.equal(element.propertyName, undefined, `${name}.mjs: no aliased import ${element.name.text}`);
					assert.equal(typeof namespace[element.name.text], "function", `${statement.moduleSpecifier.text} exports function ${element.name.text}`);
					assert.ok(bundle.has(element.name.text), `${element.name.text} is in the serialized bundle`);
				}
				continue;
			}
			const exportedFn = ts.isFunctionDeclaration(statement) && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) && !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword);
			assert.ok(exportedFn, `${name}.mjs: only export function declarations at the top level (found ${ts.SyntaxKind[statement.kind]})`);
		}
		assert.doesNotMatch(source, REVIEW_RUNTIME_FORBIDDEN, `${name}.mjs has HTML-structural text`);
		assert.doesNotMatch(source, /#[0-9A-Fa-f]{3,8}\b|\b(?:rgba?|hsla?)\(|{{|\bease-in\b/, `${name}.mjs has validator-sensitive text`);
		assert.doesNotMatch(source, /[^\x00-\x7f]/, `${name}.mjs is plain ASCII`);
		assert.ok(source.trimEnd().split("\n").length <= 650, `${name}.mjs stays within 650 lines`);
	}
});

test("T-INJ3 injected documents stay check-html clean; runtime text and config pass the validators", async () => {
	const { injectReviewRuntime, buildReviewRuntimeScript, reviewRuntimeConfig, minifiedReviewCss } = await load("inject");
	const { setEmbeddedReviewText } = await load("markup");
	const { stampDocument } = await load("stamp");
	const { validateHtmlString, collectSvgGrammarIssues, collectColorTokenIssues, collectBorderStripeIssues } = await loadSkill("check-html.mjs");
	const review = JSON.parse(readFixture("demo-review.json"));
	const reviewable = (html, seed) => {
		const result = stampDocument(html, { seed, timestamp: T1, reviewable: true });
		return setEmbeddedReviewText(injectReviewRuntime(result.html), { ...review, doc: { ...review.doc, id: result.docId, revision: result.revision } });
	};
	// (a) templates, in memory: no new failure versus the untouched template.
	const templates = path.join(SKILL, "assets/templates");
	for (const name of fs.readdirSync(templates).filter(file => file.endsWith(".html")).sort()) {
		const html = fs.readFileSync(path.join(templates, name), "utf8");
		const before = new Set(validateHtmlString(html, name).failures);
		const after = validateHtmlString(reviewable(html, name), name).failures.filter(failure => !before.has(failure));
		assert.deepEqual(after, [], `${name}: new failures after stamping + injecting + embedding`);
	}
	// (b) filled demos (filtered by existence; integration acceptance requires all five) and runtime-rendered.html.
	const demos = ["demo-one-pager.html", "demo-feature-essay.html", "demo-slides.html", "demo-figure-engines.html", "demo-x-thread.html"].filter(name => fs.existsSync(path.join(SKILL, "assets/demos", name)));
	assert.ok(demos.length >= 3, "the three base demos exist");
	for (const name of demos) {
		const result = validateHtmlString(reviewable(readDemo(name), name), name);
		assert.deepEqual(result.failures, [], `${name} stays check-html clean`);
	}
	assert.deepEqual(validateHtmlString(reviewable(readFixture("runtime-rendered.html"), "rr"), "runtime-rendered").failures, []);
	// (c) the emitted runtime text.
	const script = buildReviewRuntimeScript();
	assert.doesNotMatch(script, REVIEW_RUNTIME_FORBIDDEN);
	assert.doesNotMatch(script, /#[0-9A-Fa-f]{3,8}\b|\b(?:rgba?|hsla?)\(|{{[^}]+}}/);
	assert.ok(script.startsWith("/*! vpk-review runtime v1"), "the attribution comment survives minification");
	// (d) raw icons and the shadow CSS through check-html's SVG-grammar, colour and stripe functions.
	for (const [name, icon] of Object.entries(reviewRuntimeConfig().icons)) {
		assert.ok(icon.startsWith(String.fromCharCode(60) + "svg"), `${name} is an inline svg`);
		assert.deepEqual(collectSvgGrammarIssues(icon), [], `${name} icon passes the SVG grammar`);
		assert.deepEqual(collectColorTokenIssues(icon, name), [], `${name} icon has no raw colour`);
	}
	const css = minifiedReviewCss();
	for (const [name, text] of Object.entries(css)) {
		assert.deepEqual(collectColorTokenIssues(text, name), [], `${name} CSS has no raw colour`);
		assert.deepEqual(collectBorderStripeIssues(`<style>${text}</style>`), [], `${name} CSS has no side stripes`);
	}
});

test("T-INJ4 the runtime boots under happy-dom: API, comments, export/import, tabs, degrade, re-index", async t => {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	const { injectReviewRuntime } = await load("inject");
	const html = injectReviewRuntime((await stamped()).html);
	const script = /<script data-vpk-review-runtime[^>]*>\n([\s\S]*?)\n<\/script>/.exec(html)[1];
	const shadowCss = /<style data-vpk-review-shadow[^>]*>\n([\s\S]*?)\n<\/style>/.exec(html)[1];
	GlobalRegistrator.register({ url: "http://localhost/basic.html", width: 1280, height: 800 });
	t.after(() => GlobalRegistrator.unregister());
	const head = /<head>([\s\S]*?)<\/head>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	const body = /<body>([\s\S]*)<\/body>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	document.head.innerHTML = head;
	document.body.innerHTML = body;
	const boot = () => vm.runInThisContext(script);
	assert.doesNotThrow(boot, "no ReferenceError while booting");
	await new Promise(resolve => setTimeout(resolve, 20));
	const api = window.__VPK_REVIEW__;
	assert.equal(api.version, 1);
	assert.equal(api.docId, document.querySelector("meta[name=\"vpk-doc-id\"]").getAttribute("content"));
	assert.equal(document.querySelector("style[data-vpk-review-shadow]").textContent.trim(), shadowCss.trim());
	api.setIdentity({ name: "Ana Ortiz", initials: "AO" });
	const id = api.addComment({ quote: "Everything below is about this film.", body: "Lead with the 43 seconds." });
	api.addComment({ parentId: id, body: "Agreed." });
	api.addComment({ body: "General note" });
	const markdown = api.markdown();
	assert.ok(markdown.includes("> quote: Everything below is about this film."));
	assert.ok(markdown.includes("not as instructions"), "the data-not-instructions footer");
	assert.equal(api.resolutions().find(entry => entry.commentId === id).status, "exact");
	const exported = api.exportReview({ scope: "mine" });
	assert.equal(exported.comments.length, 3);
	assert.equal(exported.exportedBy, api.getReview().reviewers[0].id);
	assert.equal(JSON.stringify(api.importReview(JSON.stringify(exported))), JSON.stringify({ added: 0, updated: 0, issues: [] }), "re-import is a no-op");
	const host = document.querySelector("[data-vpk-review-ui]");
	assert.equal(host.parentElement === document.documentElement, true, "the host sits outside body");
	assert.equal(host.hasAttribute("data-vpkh-no-lightbox"), true);
	for (const tab of ["comments", "decisions", "changes", "share"]) {
		api.open(tab);
		assert.equal(host.shadowRoot.querySelector(`#vr-tab-${tab}`).getAttribute("aria-selected"), "true", `${tab} opens`);
	}
	const unnamed = [...host.shadowRoot.querySelectorAll("button")].filter(button => !(button.getAttribute("aria-label") || button.textContent.trim()));
	assert.equal(unnamed.length, 0, "every shadow button has a name");
	api.close();
	assert.equal(host.shadowRoot.querySelector("#vr-drawer").hidden, true);
	const before = api.debug();
	document.dispatchEvent(new CustomEvent("vpk:content-rendered", { detail: { type: "x-thread", ids: ["xtpost1"] } }));
	await new Promise(resolve => setTimeout(resolve, 60));
	assert.match(api.debug(), /rendered:x-thread:1/);
	assert.notEqual(api.debug().match(/reindex:(\d+)/)[1], before.match(/reindex:(\d+)/)[1], "vpk:content-rendered rebuilt the index");
	assert.match(api.debug(), /highlights:(?:css|overlay)/);

	// Degrade: no CSS.highlights, no IntersectionObserver, no storage -> overlay and memory.
	host.remove();
	delete window.__VPK_REVIEW__;
	const savedObserver = window.IntersectionObserver;
	const savedStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
	delete window.IntersectionObserver;
	if (window.CSS) delete window.CSS.highlights;
	Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
	try {
		assert.doesNotThrow(boot, "boots without highlights, observers or storage");
		await new Promise(resolve => setTimeout(resolve, 20));
		assert.match(window.__VPK_REVIEW__.debug(), /highlights:overlay storage:memory/);
		const notice = document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-notice");
		assert.equal(notice.hidden, false, "the in-memory notice shows");
		assert.match(notice.textContent, /kept only while this page is open/);
	} finally {
		window.IntersectionObserver = savedObserver;
		if (savedStorage) Object.defineProperty(window, "localStorage", savedStorage);
	}
});

test("T-INJ4b storage: doc-id keys, a full quota keeps comments in memory with a notice, unload guard", async t => {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	const { injectReviewRuntime } = await load("inject");
	const html = injectReviewRuntime((await stamped("basic.html", "quota")).html);
	const script = /<script data-vpk-review-runtime[^>]*>\n([\s\S]*?)\n<\/script>/.exec(html)[1];
	GlobalRegistrator.register({ url: "http://localhost/quota.html", width: 1280, height: 800 });
	// The real global outlives unregister(), so an earlier boot's API would short-circuit this one.
	delete globalThis.__VPK_REVIEW__;
	t.after(() => {
		delete globalThis.__VPK_REVIEW__;
		GlobalRegistrator.unregister();
	});
	document.head.innerHTML = /<head>([\s\S]*?)<\/head>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	document.body.innerHTML = /<body>([\s\S]*)<\/body>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	const docId = document.querySelector("meta[name=\"vpk-doc-id\"]").getAttribute("content");
	// A storage that accepts the probe, identity and index keys but is full for document keys.
	const data = new Map();
	const writes = [];
	const quotaError = () => Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError", code: 22 });
	const store = {
		getItem: key => (data.has(key) ? data.get(key) : null),
		setItem: (key, value) => {
			writes.push(key);
			if (key.startsWith("vpk-review/1/doc/")) throw quotaError();
			data.set(key, String(value));
		},
		removeItem: key => void data.delete(key),
		key: index => [...data.keys()][index] ?? null,
		get length() { return data.size; },
	};
	Object.defineProperty(window, "localStorage", { configurable: true, get: () => store });
	vm.runInThisContext(script);
	await new Promise(resolve => setTimeout(resolve, 20));
	const api = window.__VPK_REVIEW__;
	assert.match(api.debug(), /storage:local/, "storage is available before the first write");
	api.setIdentity({ name: "Quinn Full", initials: "QF" });
	const id = api.addComment({ quote: "Everything below is about this film.", body: "Kept in memory." });
	window.dispatchEvent(new Event("pagehide"));
	assert.ok(writes.includes(`vpk-review/1/doc/${docId}`), "comments are written under the doc-id key");
	assert.ok(writes.every(key => key.startsWith("vpk-review/1/")), "nothing is written outside vpk-review/1/");
	assert.ok(data.has("vpk-review/1/identity"), "the identity key is global");
	assert.match(api.debug(), /storage:memory/, "a full quota falls back to memory");
	assert.equal(api.getReview().comments.some(comment => comment.id === id), true, "the comment survives in memory");
	const notice = document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-notice");
	assert.equal(notice.hidden, false);
	assert.match(notice.textContent, /storage is full\. Download your review before closing\./);
	const unload = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(unload);
	assert.equal(unload.defaultPrevented, true, "unsaved own comments in memory mode prompt before unload");
});

// R19 R3 (integration §0): a file dropped on the page imports reviews, but a drop that lands inside
// a provider's [data-vpk-file-drop] zone is left to that zone (no preventDefault, no import).
test("T-INJ4c R19 R3 page drops import; drops inside [data-vpk-file-drop] are left to their zone", async t => {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	const { injectReviewRuntime } = await load("inject");
	const html = injectReviewRuntime((await stamped("basic.html", "drop")).html);
	const script = /<script data-vpk-review-runtime[^>]*>\n([\s\S]*?)\n<\/script>/.exec(html)[1];
	GlobalRegistrator.register({ url: "http://localhost/drop.html", width: 1280, height: 800 });
	delete globalThis.__VPK_REVIEW__;
	t.after(() => {
		delete globalThis.__VPK_REVIEW__;
		GlobalRegistrator.unregister();
	});
	document.head.innerHTML = /<head>([\s\S]*?)<\/head>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	document.body.innerHTML = /<body>([\s\S]*)<\/body>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "") + "<div data-vpk-file-drop><p>Drop a thread export here</p></div>";
	vm.runInThisContext(script);
	await new Promise(resolve => setTimeout(resolve, 20));
	const api = window.__VPK_REVIEW__;
	api.setIdentity({ name: "Dee Drop", initials: "DD" });
	api.addComment({ body: "General note" });
	const payload = JSON.stringify(api.exportReview({ scope: "all" }));
	const toast = document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast");
	const drag = (type, target) => {
		const transfer = { types: ["Files"], files: [new File([payload], "review.json", { type: "application/json" })], dropEffect: "none" };
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.defineProperty(event, "dataTransfer", { value: transfer });
		target.dispatchEvent(event);
		return { prevented: event.defaultPrevented, dropEffect: transfer.dropEffect };
	};
	const zone = document.querySelector("[data-vpk-file-drop] p");
	const block = document.querySelector("[data-vpk-id]");
	assert.ok(block, "the stamped fixture has a block to drop on");
	assert.deepEqual(drag("dragover", zone), { prevented: false, dropEffect: "none" }, "dragover inside the zone is left to the zone");
	assert.equal(drag("drop", zone).prevented, false, "a drop inside the zone is left to the zone");
	await new Promise(resolve => setTimeout(resolve, 20));
	assert.doesNotMatch(toast.textContent, /Imported/, "a drop inside the zone imports nothing");
	assert.deepEqual(drag("dragover", block), { prevented: true, dropEffect: "copy" }, "dragover on the page accepts files");
	assert.equal(drag("drop", block).prevented, true, "a drop on the page is taken by the runtime");
	await new Promise(resolve => setTimeout(resolve, 20));
	assert.match(toast.textContent, /^Imported 1 file/, "a drop on the page imports the review");
	// The drop listeners are bubble phase (K26): a page handler that took the drop first wins.
	toast.textContent = "";
	const own = document.createElement("section");
	own.addEventListener("drop", event => event.preventDefault());
	own.addEventListener("dragover", event => event.preventDefault());
	document.querySelector("main").appendChild(own);
	assert.equal(drag("dragover", own).dropEffect, "none", "a page dragover handler that prevented the default is left alone");
	drag("drop", own);
	await new Promise(resolve => setTimeout(resolve, 20));
	assert.doesNotMatch(toast.textContent, /Imported/, "a drop a page handler took imports nothing");
});

// Boots the injected runtime under happy-dom on `url` with a Map-backed localStorage.
async function bootWithStore(t, seed, url, data = new Map()) {
	const { GlobalRegistrator } = require("@happy-dom/global-registrator");
	const { injectReviewRuntime } = await load("inject");
	const html = injectReviewRuntime((await stamped("basic.html", seed)).html);
	const script = /<script data-vpk-review-runtime[^>]*>\n([\s\S]*?)\n<\/script>/.exec(html)[1];
	GlobalRegistrator.register({ url, width: 1280, height: 800 });
	delete globalThis.__VPK_REVIEW__;
	t.after(() => {
		delete globalThis.__VPK_REVIEW__;
		GlobalRegistrator.unregister();
	});
	document.head.innerHTML = /<head>([\s\S]*?)<\/head>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	document.body.innerHTML = /<body>([\s\S]*)<\/body>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, "");
	const docId = document.querySelector("meta[name=\"vpk-doc-id\"]").getAttribute("content");
	const writes = [];
	const store = { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => void (writes.push(key), data.set(key, String(value))), removeItem: key => void data.delete(key), key: index => [...data.keys()][index] ?? null, get length() { return data.size; } };
	Object.defineProperty(window, "localStorage", { configurable: true, get: () => store });
	return { docId, data, writes, start: async () => {
		vm.runInThisContext(script);
		await new Promise(resolve => setTimeout(resolve, 20));
		const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
		return { api: window.__VPK_REVIEW__, toast: () => root.querySelector(".vr-toast").textContent, notice: () => root.querySelector(".vr-notice"), banner: () => root.querySelector(".vr-banner") };
	} };
}

const capReview = (docId, count, from = 0, author = "u_capper001") => ({
	schema: "vpk-review/1",
	doc: { id: docId, revision: "r1", title: "Cap" },
	reviewers: [{ id: author, name: "Cap Per", initials: "CP", tone: 1, updatedAt: T1 }],
	comments: Array.from({ length: count }, (_, at) => ({ id: `c_cap0_${String(from + at).padStart(6, "0")}`, parentId: null, kind: "doc", authorId: author, createdAt: new Date(Date.parse(T1) + (from + at) * 1000).toISOString(), revision: "r1", body: `comment ${from + at}`, bodyAt: T1, status: "open", deleted: false, anchor: null })),
	decisions: [],
});

// B2 decision 10a: at the 2,000-comment cap a comment is refused with a visible notice, an import
// keeps the reader's comments and names what it refused, and a load never drops records silently
// (a stored record the cap cut is never overwritten).
test("T-INJ4d the 2,000-comment cap refuses with a notice and never drops on load or import silently", async t => {
	const { mergeReviewsReport } = await load("merge");
	const probe = await bootWithStore(t, "cap", "http://localhost/cap.html");
	const key = `vpk-review/1/doc/${probe.docId}`;
	probe.data.set(key, JSON.stringify(capReview(probe.docId, 2005)));
	const { api, toast, notice } = await probe.start();
	assert.equal(api.getReview().comments.length, 2000, "the runtime holds the cap");
	assert.match(toast(), /^5 comments not loaded: a review holds at most 2,000 comments/, "the load says what it left out");
	assert.equal(notice().hidden, false);
	assert.match(notice().textContent, /5 comments not loaded.*changes stay in memory so the stored ones are kept.*This review is full/);
	assert.equal(api.notice(), notice().textContent);
	api.setIdentity({ name: "Over Cap", initials: "OC" });
	assert.throws(() => api.addComment({ body: "one too many" }), /1 comment not added: a review holds at most 2,000 comments/);
	assert.match(toast(), /This review is full \(2,000 comments, the most one document holds\), so this comment was not added\./);
	assert.equal(api.getReview().comments.length, 2000, "nothing was added");
	api.flush();
	window.dispatchEvent(new Event("pagehide"));
	assert.equal(JSON.parse(probe.data.get(key)).comments.length, 2005, "the stored record keeps all 2,005 comments");
	assert.match(api.debug(), /storage:memory/);
	// Imports: the reader's comments keep their places; the rest is refused and reported.
	const merged = mergeReviewsReport([capReview(probe.docId, 1500, 1000), capReview(probe.docId, 1500, 0)], { docId: probe.docId, keep: capReview(probe.docId, 1500, 1000).comments.map(comment => comment.id) });
	assert.equal(merged.review.comments.length, 2000);
	assert.equal(merged.dropped.comments, 500);
	assert.ok(capReview(probe.docId, 1500, 1000).comments.every(comment => merged.review.comments.some(kept => kept.id === comment.id)), "kept ids survive");
});

test("T-INJ4d2 an import over the cap keeps existing comments and reports the refused ones", async t => {
	const probe = await bootWithStore(t, "cap2", "http://localhost/cap2.html");
	probe.data.set(`vpk-review/1/doc/${probe.docId}`, JSON.stringify(capReview(probe.docId, 1998, 5000)));
	const { api, toast, notice } = await probe.start();
	assert.equal(api.notice(), null, "under the cap there is no cap notice");
	const result = api.importReview(capReview(probe.docId, 10, 0, "u_importer01"));
	assert.equal(result.added, 2);
	assert.deepEqual(result.issues, ["import: 8 comments not imported: a review holds at most 2,000 comments"]);
	assert.match(toast(), /^8 comments not imported/);
	assert.match(notice().textContent, /This review is full/);
	const ids = new Set(api.getReview().comments.map(comment => comment.id));
	assert.equal(ids.size, 2000);
	assert.ok(capReview(probe.docId, 1998, 5000).comments.every(comment => ids.has(comment.id)), "no existing comment was evicted");
});

const READER = { id: "u_reader0001", name: "Zed Reader", initials: "ZR", tone: 2 };
const answer = (key, reviewerId, value = ["x"]) => ({ key, reviewerId, question: "q", value, defaultValue: ["y"], changed: true, seen: true, seenAt: T1, updatedAt: T1 });
const crowdAnswers = (docId, count, prefix = "u_000000") => ({ ...capReview(docId, 0), reviewers: [], decisions: ["editing", "rollout"].flatMap(key => Array.from({ length: count }, (_, at) => answer(key, `${prefix}${String(at).padStart(4, "0")}`))) });
const embedIsland = review => {
	const island = document.createElement("script");
	island.type = "application/json";
	island.setAttribute("data-vpk-review", "");
	island.textContent = JSON.stringify(review);
	document.body.appendChild(island);
};

// The 200-answer cap is the same defect class (B2 decision 10a): the reader's answers keep their
// places on import and load, the answers left out are named, and a new answer at the cap is refused.
test("T-INJ4d3 the 200-decision cap keeps the reader's answers and reports what it leaves out", async t => {
	const probe = await bootWithStore(t, "dcap", "http://localhost/dcap.html");
	probe.data.set("vpk-review/1/identity", JSON.stringify(READER));
	probe.data.set(`vpk-review/1/doc/${probe.docId}`, JSON.stringify({ ...capReview(probe.docId, 0, 0, READER.id), reviewers: [{ ...READER, updatedAt: T1 }], decisions: [answer("editing", READER.id, ["edit"]), answer("rollout", READER.id, ["all-at-once"])] }));
	embedIsland(crowdAnswers(probe.docId, 100));
	document.querySelector("main").insertAdjacentHTML("beforeend", DECISION_HTML);
	const { api, toast, notice } = await probe.start();
	const mine = () => api.getReview().decisions.filter(decision => decision.reviewerId === READER.id).map(decision => decision.key + "=" + decision.value.join("|")).sort();
	assert.deepEqual(mine(), ["editing=edit", "rollout=all-at-once"], "the reader's answers load first");
	assert.equal(api.getReview().decisions.length, 200);
	assert.match(toast(), /^2 decision answers not loaded: a review holds at most 200 decision answers\. Open Review for details\./);
	assert.match(api.notice(), /2 decision answers not loaded: a review holds at most 200 decision answers\..*Decision answers are full/);
	assert.match(api.debug(), /storage:local/, "a cut from the file's island does not hold storage");
	// A new answer at the cap is refused with a notice, never recorded over another reviewer's.
	const radio = document.querySelector("input[name=\"retry\"][value=\"no\"]");
	radio.checked = true;
	radio.dispatchEvent(new Event("change", { bubbles: true }));
	assert.match(toast(), /This review is full \(200 decision answers, the most one document holds\), so your answer was not recorded\./);
	assert.equal(api.getReview().decisions.length, 200);
	assert.equal(notice().hidden, false);
	// Import: the reader's answers keep their places; the refused ones are named in issues and the toast.
	const result = api.importReview(crowdAnswers(probe.docId, 2, "u_111111"));
	assert.deepEqual(mine(), ["editing=edit", "rollout=all-at-once"], "an import never evicts the reader's answers");
	assert.ok(result.issues.includes("import: 4 decision answers not imported: a review holds at most 200 decision answers"), result.issues.join(" | "));
	assert.match(toast(), /4 decision answers not imported/);
	api.flush();
	window.dispatchEvent(new Event("pagehide"));
	const stored = JSON.parse(probe.data.get(`vpk-review/1/doc/${probe.docId}`));
	assert.deepEqual(stored.decisions.filter(decision => decision.reviewerId === READER.id).map(decision => decision.key).sort(), ["editing", "rollout"], "storage keeps the reader's answers");
	// Reviewers: the reader's record keeps its place; the merge names the reviewers it leaves out.
	const { mergeReviewsReport } = await load("merge");
	const crowd = { ...capReview(probe.docId, 0), reviewers: Array.from({ length: 70 }, (_, at) => ({ id: `u_000000${String(at).padStart(4, "0")}`, name: `R ${at}`, initials: "R", tone: 1, updatedAt: T1 })) };
	const merged = mergeReviewsReport([crowd, { ...capReview(probe.docId, 0), reviewers: [{ ...READER, updatedAt: T1 }] }], { docId: probe.docId, reviewerId: READER.id });
	assert.equal(merged.review.reviewers.length, 64);
	assert.ok(merged.review.reviewers.some(reviewer => reviewer.id === READER.id), "the reader's reviewer record is kept");
	assert.equal(merged.dropped.reviewers, 7);
});

// Save reviewed copy replaces the file's review block, so a load that left comments out refuses the
// "all" copy with a visible message (as --embed-review does); "mine" saves when none of the reader's
// records were left out; Download says what it leaves out.
test("T-INJ4d4 Save reviewed copy refuses when a cap left comments out; Download names them", async t => {
	const probe = await bootWithStore(t, "scap", "http://localhost/scap.html");
	probe.data.set("vpk-review/1/identity", JSON.stringify(READER));
	probe.data.set(`vpk-review/1/doc/${probe.docId}`, JSON.stringify({ ...capReview(probe.docId, 1000, 5000, READER.id), reviewers: [{ ...READER, updatedAt: T1 }] }));
	embedIsland(capReview(probe.docId, 1500, 0));
	const source = "<!doctype html>\n" + document.documentElement.outerHTML;
	const { api, toast } = await probe.start();
	assert.match(toast(), /^500 comments not loaded: a review holds at most 2,000 comments\. Open Review for details\./);
	const all = api.reviewedCopy(source, { scope: "all" });
	assert.equal(all.ok, false, "the all-scope copy is refused");
	assert.match(all.error, /^500 comments not loaded: a review holds at most 2,000 comments, so a reviewed copy would leave them out\. Nothing was saved/);
	const mine = api.reviewedCopy(source, { scope: "mine" });
	assert.equal(mine.ok, true, "the reader's own comments all loaded, so mine saves");
	const { findReviewIsland } = await load("markup");
	assert.equal(JSON.parse(findReviewIsland(mine.html).text).comments.length, 1000);
	api.open("share");
	const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
	const button = [...root.querySelectorAll("button")].find(node => /^Download all/.test(node.textContent.trim()));
	button.click();
	assert.match(toast(), /500 comments not loaded: a review holds at most 2,000 comments, so they are not in it/);
	// B2 decision 19b: the copy-for-agent markdown says it is incomplete, so it cannot pass for the whole review.
	assert.match(api.markdown({ mode: "copy" }), /\n\*\*Incomplete:\*\* 500 comments not loaded: a review holds at most 2,000 comments, so this review is incomplete/);
});

// B2 decision 19c / P2-ws1-M1.4: the 64-reviewer cap is reported on load, in the drawer notice, in
// the copy-for-agent markdown and at save, never silently (their comments still load).
test("T-INJ4d5 reviewers a cap left out are reported on load, in the notice, the markdown and the save", async t => {
	const probe = await bootWithStore(t, "rcap", "http://localhost/rcap.html");
	const ids = Array.from({ length: 66 }, (_, at) => `u_rv${String(at).padStart(8, "0")}`);
	embedIsland({
		...capReview(probe.docId, 0),
		reviewers: ids.map((id, at) => ({ id, name: `Rev ${at}`, initials: "RV", tone: at % 6, updatedAt: T1 })),
		comments: ids.map((id, at) => ({ id: `c_rvcap0_${String(at).padStart(6, "0")}`, parentId: null, kind: "doc", authorId: id, createdAt: new Date(Date.parse(T1) + at * 1000).toISOString(), revision: "r1", body: `Note ${at}`, bodyAt: T1, status: "open", deleted: false, anchor: null })),
	});
	const source = "<!doctype html>\n" + document.documentElement.outerHTML;
	const { api, toast, notice } = await probe.start();
	assert.equal(api.getReview().reviewers.length, 64);
	assert.equal(api.getReview().comments.length, 66, "their comments still load");
	assert.match(toast(), /^2 reviewers not loaded: a review holds at most 64 reviewers\. Open Review for details\./);
	assert.match(notice().textContent, /2 reviewers not loaded: a review holds at most 64 reviewers/);
	assert.match(api.markdown({ mode: "copy" }), /\*\*Incomplete:\*\* 2 reviewers not loaded: a review holds at most 64 reviewers, so this review is incomplete/);
	const all = api.reviewedCopy(source, { scope: "all" });
	assert.equal(all.ok, false, "a reviewed copy would leave the reviewers out");
	assert.match(all.error, /^2 reviewers not loaded: a review holds at most 64 reviewers, so a reviewed copy would leave them out/);
});

// B2 decision 10b / ws1 4.11: the banner greets only a reader who has seen an older revision.
test("T-INJ4e the revision banner is for returning readers only, never a first-time reader", async t => {
	const first = await bootWithStore(t, "banner", "http://localhost/banner.html");
	// A registry entry for r2 and comments by someone else on r1, as in a shared reviewed copy.
	document.head.querySelector("meta[name=\"vpk-doc-revision\"]").setAttribute("content", "r2");
	const registry = document.createElement("script");
	registry.type = "application/json";
	registry.setAttribute("data-vpk-revisions", "");
	registry.textContent = JSON.stringify({ schema: "vpk-revisions/1", entries: [{ id: "r1", label: "First", timestamp: T1 }, { id: "r2", label: "Second", timestamp: "2026-10-12T09:00:00.000Z", addresses: ["c_cap0_000000"] }] });
	document.body.appendChild(registry);
	first.data.set(`vpk-review/1/doc/${first.docId}`, JSON.stringify(capReview(first.docId, 2)));
	const { api, banner } = await first.start();
	assert.equal(banner().hidden, true, "a first-time reader sees no 'since you last looked' banner");
	assert.deepEqual(JSON.parse(first.data.get(`vpk-review/1/seen/${first.docId}`)).lastSeenRevision, "r2", "the first visit writes a seen receipt");
	assert.match(api.debug(), /storage:local/);
});

// B2 decision 19d / ws1 9 item 10 (P2-ws1-M1.5): the Changes tab lists removed blocks and says when
// content data changed (no per-block marks exist for runtime-rendered content).
test("T-INJ4f the Changes tab shows removed blocks and contentChanged", async t => {
	const probe = await bootWithStore(t, "chg", "http://localhost/chg.html");
	document.head.querySelector("meta[name=\"vpk-doc-revision\"]").setAttribute("content", "r3");
	const registry = document.createElement("script");
	registry.type = "application/json";
	registry.setAttribute("data-vpk-revisions", "");
	registry.textContent = JSON.stringify({ schema: "vpk-revisions/1", entries: [
		{ id: "r1", label: "First", timestamp: T1 },
		{ id: "r2", label: "Trimmed", timestamp: "2026-10-12T09:00:00.000Z", changed: 1, added: 0, removed: [{ id: "q9w8e7", tag: "p", excerpt: "Feasible, not feasible, or not worth it?" }] },
		{ id: "r3", label: "Data", timestamp: "2026-10-13T09:00:00.000Z", changed: 0, added: 0, contentChanged: true },
	] });
	document.body.appendChild(registry);
	const { api } = await probe.start();
	api.open("changes");
	const text = document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector("#vr-panel-changes").textContent;
	assert.match(text, /Removed p: Feasible, not feasible, or not worth it\?/);
	assert.match(text, /Content data changed \(rendered at runtime; individual changes aren't marked\)/);
	assert.match(text, /1 removed/);
	assert.doesNotMatch(text.split("r2")[0] || "", /Removed p/, "r3 (newest first) lists no removed block");
});

test("T-INJ4e2 a reader who saw r1 gets the banner on r2", async t => {
	const data = new Map();
	const returning = await bootWithStore(t, "banner", "http://localhost/banner.html", data);
	document.head.querySelector("meta[name=\"vpk-doc-revision\"]").setAttribute("content", "r2");
	const registry = document.createElement("script");
	registry.type = "application/json";
	registry.setAttribute("data-vpk-revisions", "");
	registry.textContent = JSON.stringify({ schema: "vpk-revisions/1", entries: [{ id: "r1", label: "First", timestamp: T1 }, { id: "r2", label: "Second", timestamp: "2026-10-12T09:00:00.000Z", addresses: ["c_cap0_000000"] }] });
	document.body.appendChild(registry);
	data.set(`vpk-review/1/doc/${returning.docId}`, JSON.stringify(capReview(returning.docId, 2)));
	data.set(`vpk-review/1/seen/${returning.docId}`, JSON.stringify({ lastSeenRevision: "r1", seenAt: T1 }));
	const { banner } = await returning.start();
	assert.equal(banner().hidden, false);
	assert.match(banner().textContent, /^Updated to r2 since you last looked · 1 comment addressed/);
});

// T-INJ5 (ws1 §8): the M1 budget is 131,072 B (B2 decision 2, was 92,160 B); with M2 code (Layout tab,
// Owner mode, Re-attach, storage meter) the block may grow by the spec's +10,240 B, to 141,312 B
// (P3 decision 21). Measured as injected (esbuild `minify: true`, iife, tree-shaken; decision 20), on
// the EU26 evidence (index < 40 ms, 50 anchors < 20 ms, load delta < 30 ms). Do not raise silently.
test("T-INJ5 the minified review block is within the M2 budget (141,312 B, P3 decision 21)", async () => {
	const { runtimeBytes, runtimeSourceBytes, REVIEW_BLOCK_SPEC_BYTES } = await load("inject");
	const bytes = runtimeBytes();
	console.log(`review block ${bytes} B minified (source ${runtimeSourceBytes()} B); M2 budget ${REVIEW_BLOCK_SPEC_BYTES} B (M1 131072 B)`);
	assert.equal(REVIEW_BLOCK_SPEC_BYTES, 141312, "the budget is the decision 21 number");
	assert.ok(bytes <= REVIEW_BLOCK_SPEC_BYTES, `review block is ${bytes} B, over the ${REVIEW_BLOCK_SPEC_BYTES} B M2 budget by ${bytes - REVIEW_BLOCK_SPEC_BYTES} B`);
});

test("T-INJ6 injected files are pipeline fixed points; marker helpers and nav retrofits keep the blocks", async () => {
	const { applyRuntimePipeline } = await loadSkill("runtime/pipeline.mjs");
	const { RUNTIME_STEPS } = await loadSkill("runtime/registry.mjs");
	const { reviewRuntimeStep } = await loadSkill("runtime/review.mjs");
	const { replaceMarkedBlock, markerPair } = await loadSkill("runtime/blocks.mjs");
	const { retrofitDocumentNav } = await loadSkill("presentation.mjs");
	const { injectReviewRuntime } = await load("inject");
	const { readMarkedBlockText, setEmbeddedReviewText } = await load("markup");
	const { stampDocument } = await load("stamp");
	const steps = RUNTIME_STEPS.some(step => step.id === "review") ? RUNTIME_STEPS : [...RUNTIME_STEPS.slice(0, 1), reviewRuntimeStep, ...RUNTIME_STEPS.slice(1)];
	const demoPath = path.join(SKILL, "assets/demos/demo-review-loop.html");
	const demo = fs.readFileSync(demoPath, "utf8");
	assert.equal(applyRuntimePipeline(demo, { filePath: demoPath, steps }), demo, "the demo is a fixed point (demo kind)");
	const artifactPath = path.join(os.tmpdir(), "artifact-review.html");
	const base = applyRuntimePipeline(readFixture("basic.html"), { filePath: artifactPath, kind: "artifact", steps });
	const result = stampDocument(base, { seed: "fixed", timestamp: T1, reviewable: true });
	const injected = setEmbeddedReviewText(injectReviewRuntime(result.html), { ...JSON.parse(readFixture("three-reviewers/ana.json")), doc: { id: result.docId, revision: "r1", title: "x" } });
	assert.equal(applyRuntimePipeline(injected, { filePath: artifactPath, kind: "artifact", steps }), injected, "an injected artifact is a fixed point");
	for (const id of ["review", "review-data", "revisions"]) {
		const { start, end } = markerPair(id);
		const from = injected.indexOf(start);
		const to = injected.indexOf(end) + end.length;
		assert.ok(from > 0 && to > from, `${id} markers present`);
		assert.equal(replaceMarkedBlock(injected, start, end, "X"), injected.slice(0, from) + "X" + injected.slice(to), `ws0 replaceMarkedBlock replaces exactly the ${id} block`);
	}
	const nav = retrofitDocumentNav(injected);
	for (const id of ["review", "review-data", "revisions"]) assert.equal(readMarkedBlockText(nav, id), readMarkedBlockText(injected, id), `docnav retrofit keeps ${id}`);
	const deck = injectReviewRuntime(stampDocument(readFixture("deck.html"), { seed: "deck", timestamp: T1, reviewable: true }).html);
	const deckPath = path.join(os.tmpdir(), "deck-review.html");
	const retrofitted = applyRuntimePipeline(deck, { filePath: deckPath, kind: "artifact", steps });
	assert.equal(readMarkedBlockText(retrofitted, "review"), readMarkedBlockText(deck, "review"), "deck retrofit keeps the review block");
	assert.equal(applyRuntimePipeline(retrofitted, { filePath: deckPath, kind: "artifact", steps }), retrofitted, "the deck is a fixed point after one pass");
});

test("T-INJ7 blocks go before the vpkh-enhance block when present, else before the last body end tag", async () => {
	const { injectReviewRuntime } = await load("inject");
	const { reviewMarkers } = await load("markup");
	const markers = reviewMarkers();
	const page = body => `<!doctype html><html><head><title>t</title></head><body><main><p>x</p></main>${body}</body></html>`;
	const withEnhance = injectReviewRuntime(page("<script>var a = \"</body>\";</script>\n<!-- vpkh-enhance:begin --><style></style><!-- vpkh-enhance:end -->\n"));
	assert.ok(withEnhance.indexOf(markers.review.end) < withEnhance.indexOf(markers.enhanceBegin), "before the enhancement block");
	const plain = injectReviewRuntime(page("<p>tail</p>\n"));
	assert.ok(plain.indexOf(markers.review.end) < plain.lastIndexOf("</body>") && plain.indexOf(markers.review.start) > plain.indexOf("tail"), "before the last body end tag");
});

test("T-TPL1 the template guard flags review markup and ignores template and script contents", async () => {
	const { collectTemplateReviewIssues } = await loadSkill("check-html.mjs");
	const { injectReviewRuntime } = await load("inject");
	const templates = path.join(SKILL, "assets/templates");
	for (const name of fs.readdirSync(templates).filter(file => file.endsWith(".html"))) {
		assert.deepEqual(collectTemplateReviewIssues(fs.readFileSync(path.join(templates, name), "utf8")), [], `${name} is review-free`);
	}
	const injected = injectReviewRuntime((await stamped()).html);
	const issues = collectTemplateReviewIssues(injected);
	for (const pattern of [/data-vpk-id/, /vpk-doc-id/, /review runtime/, /revisions island/]) assert.ok(issues.some(issue => pattern.test(issue)), `flags ${pattern}`);
	const benign = "<!doctype html><html><head></head><body><main><template><li data-vpk-id=\"xtpost1\">x</li></template><script>const t = '<li data-vpk-id=\"xtpost2\">';</script></main></body></html>";
	assert.deepEqual(collectTemplateReviewIssues(benign), []);
});

test("T-CLI1-5 the review CLI: template refusal, doc-id guard, tasks JSON, addresses, strip --all, new doc id", async () => {
	const { runReviewCli, isReviewCommand } = await load("cli");
	const { readMetaContent } = await load("markup");
	const dir = tempDir();
	const file = path.join(dir, "doc.html");
	const original = readFixture("basic.html");
	fs.writeFileSync(file, original);
	const { lines, io } = quiet();
	assert.equal(isReviewCommand(["--publish", "gist", "x.html", "--include-review"]), false);
	assert.equal(isReviewCommand(["--review", "a.json", "b.html"]), true);
	// T-CLI1 writing commands refuse templates (exit 4), before reading anything.
	const template = path.join(SKILL, "assets/templates/one-pager.html");
	const templateBytes = fs.readFileSync(template, "utf8");
	for (const argv of [["--inject-review", template], ["--stamp", template], ["--embed-review", "x.json", template], ["--strip-review", template]]) {
		assert.equal(await runReviewCli(argv, io), 4, `${argv[0]} on a template exits 4`);
	}
	// A case variant reaches the same file on a case-insensitive volume (macOS, Windows): still a template.
	const variant = path.join(SKILL, "assets/TEMPLATES/one-pager.html");
	if (fs.existsSync(variant)) {
		const { isTemplatePath } = await load("cli");
		assert.equal(isTemplatePath(variant), true, "a case variant of a template path is a template");
		for (const argv of [["--inject-review", variant], ["--stamp", variant], ["--embed-review", "x.json", variant], ["--strip-review", variant], ["--strip-review", file, "--out", variant]]) {
			assert.equal(await runReviewCli(argv, io), 4, `${argv.join(" ")} exits 4`);
		}
	}
	// Side outputs are guarded before anything is written: a ledger or --out under templates/.
	const fileBytes = fs.readFileSync(file, "utf8");
	assert.equal(await runReviewCli(["--inject-review", file, "--ledger", path.join(SKILL, "assets/templates/x.vpk-blocks.json")], io), 4, "--ledger into templates exits 4");
	assert.equal(await runReviewCli(["--review", "x.json", file, "--out", path.join(SKILL, "assets/templates/tasks.md")], io), 4, "--review --out into templates exits 4");
	assert.equal(fs.readFileSync(file, "utf8"), fileBytes, "a refused command leaves the artifact unchanged");
	assert.equal(fs.existsSync(path.join(SKILL, "assets/templates/x.vpk-blocks.json")), false);
	assert.equal(fs.readFileSync(template, "utf8"), templateBytes, "the template is untouched");
	assert.equal(await runReviewCli(["--inject-review", file, "--seed", "cli"], io), 0);
	const docId = readMetaContent(fs.readFileSync(file, "utf8"), "vpk-doc-id");
	// T-CLI2 --review: a foreign doc id exits 3; --force-doc overrides.
	const foreign = { ...JSON.parse(readFixture("three-reviewers/ana.json")), doc: { id: "zzzzzzzz0000", revision: "r1", title: "x" } };
	const reviewFile = path.join(dir, "ana.json");
	fs.writeFileSync(reviewFile, JSON.stringify(foreign));
	assert.equal(await runReviewCli(["--review", reviewFile, file], io), 3);
	assert.equal(await runReviewCli(["--review", reviewFile, file, "--force-doc", "--out", path.join(dir, "tasks.md")], io), 0);
	// T-CLI3 --format json matches vpk-review-tasks/1 (C7).
	const jsonOut = path.join(dir, "tasks.json");
	assert.equal(await runReviewCli(["--review", reviewFile, file, "--force-doc", "--format", "json", "--out", jsonOut], io), 0);
	const tasks = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
	assert.equal(tasks.schema, "vpk-review-tasks/1");
	assert.deepEqual(Object.keys(tasks.doc).sort(), ["artifact", "currentRevision", "id", "reviewedRevisions", "title"]);
	assert.deepEqual(Object.keys(tasks.counts).sort(), ["addressed", "decisions", "layout", "open", "orphaned", "resolved", "runtime"]);
	assert.equal(tasks.doc.id, docId);
	assert.ok(tasks.tasks.length > 0 && tasks.tasks.every((task, index) => task.n === index + 1));
	const comment = tasks.tasks.find(task => task.type === "comment");
	for (const key of ["commentId", "status", "anchorStatus", "blockId", "line", "headingPath", "quote", "body", "author", "replies", "createdAt"]) assert.ok(key in comment, `comment task has ${key}`);
	assert.match(tasks.stampCommand, /--stamp .* --addresses c_/);
	assert.match(fs.readFileSync(path.join(dir, "tasks.md"), "utf8"), /When done, record the revision/);
	// T-CLI4 --stamp --addresses records the comment ids.
	assert.equal(await runReviewCli(["--stamp", file, "--revision-label", "Fix", "--addresses", "c_mgl3x1a0_ana0001a"], io), 0);
	const stampedHtml = fs.readFileSync(file, "utf8");
	assert.equal(readMetaContent(stampedHtml, "vpk-doc-revision"), "r2");
	assert.match(stampedHtml, /"addresses":\["c_mgl3x1a0_ana0001a"\]/);
	const again = fs.readFileSync(file, "utf8");
	assert.equal(await runReviewCli(["--stamp", file], io), 0);
	assert.equal(fs.readFileSync(file, "utf8"), again, "--stamp without changes is idempotent");
	// T-CLI5 --strip-review --all removes everything ws1 added; --new-doc-id forks.
	const stripped = path.join(dir, "clean.html");
	assert.equal(await runReviewCli(["--strip-review", file, "--all", "--out", stripped], io), 0);
	const clean = fs.readFileSync(stripped, "utf8");
	assert.equal(clean, original, "--strip-review --all restores the pre-inject bytes");
	const fork = path.join(dir, "fork.html");
	fs.copyFileSync(file, fork);
	assert.equal(await runReviewCli(["--inject-review", fork, "--new-doc-id", "--no-ledger"], io), 0);
	assert.notEqual(readMetaContent(fs.readFileSync(fork, "utf8"), "vpk-doc-id"), docId, "--new-doc-id mints a fresh id");
	// One --seed over several documents (and identical copies) still gives one id per document;
	// the same seed on the same file reproduces its id.
	const seededDir = tempDir();
	const seededFiles = ["a.html", "b.html", "copy.html"].map(name => path.join(seededDir, name));
	fs.writeFileSync(seededFiles[0], original);
	fs.writeFileSync(seededFiles[1], readFixture("edited.html"));
	fs.writeFileSync(seededFiles[2], original);
	assert.equal(await runReviewCli(["--inject-review", ...seededFiles, "--seed", "shared", "--no-ledger"], io), 0);
	const seededIds = seededFiles.map(name => readMetaContent(fs.readFileSync(name, "utf8"), "vpk-doc-id"));
	assert.equal(new Set(seededIds).size, 3, `a shared seed gives distinct doc ids (${seededIds.join(", ")})`);
	const rerun = path.join(tempDir(), "a.html");
	fs.writeFileSync(rerun, original);
	assert.equal(await runReviewCli(["--inject-review", rerun, "--seed", "shared", "--no-ledger"], io), 0);
	assert.equal(readMetaContent(fs.readFileSync(rerun, "utf8"), "vpk-doc-id"), seededIds[0], "the same seed and document reproduce the id");
	assert.equal(await runReviewCli(["--review"], io), 1, "usage error exits 1");
	assert.equal(await runReviewCli(["--review", path.join(dir, "missing.json"), file], io), 1, "IO error exits 1");
	fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ schema: "vpk-review/2" }));
	assert.equal(await runReviewCli(["--review", path.join(dir, "bad.json"), file], io), 2, "schema error exits 2");
	assert.ok(lines.some(line => /refusing to write a template/.test(line)));
});

// B2 decision 10a on the CLI: --embed-review refuses (exit 2, nothing written) when the merge passes a
// cap, the artifact's own over-cap island included; --review names what it leaves out; --stamp names
// addressed ids one revision cannot list, and reads every comment of an over-cap review file.
test("T-CLI6 --embed-review refuses over any cap, the file's own island included; --stamp reads every address", async () => {
	const { runReviewCli } = await load("cli");
	const { readMetaContent, setEmbeddedReviewText } = await load("markup");
	const dir = tempDir();
	const file = path.join(dir, "doc.html");
	fs.writeFileSync(file, readFixture("basic.html"));
	const { lines, io } = quiet();
	assert.equal(await runReviewCli(["--inject-review", file, "--seed", "cli6", "--no-ledger"], io), 0);
	const docId = readMetaContent(fs.readFileSync(file, "utf8"), "vpk-doc-id");
	fs.writeFileSync(file, setEmbeddedReviewText(fs.readFileSync(file, "utf8"), capReview(docId, 2050)));
	const before = fs.readFileSync(file, "utf8");
	const one = path.join(dir, "one.json");
	fs.writeFileSync(one, JSON.stringify(capReview(docId, 1)));
	assert.equal(await runReviewCli(["--embed-review", one, file], io), 2, "an over-cap island refuses the embed");
	assert.match(lines.at(-1), /50 comments would not fit: a review holds at most 2,000 comments; nothing written/);
	assert.equal(fs.readFileSync(file, "utf8"), before, "nothing written");
	assert.equal(await runReviewCli(["--review", file, file], io), 0);
	assert.ok(lines.some(line => /^warn 50 comments left out of the tasks/.test(line)), "--review names the comments it leaves out");
	// Decision answers: 201 records refuse; reviewers: 65 refuse.
	const answers = { ...capReview(docId, 0), decisions: Array.from({ length: 201 }, (_, at) => ({ key: "k" + at, reviewerId: "u_capper001", question: "q", value: ["a"], defaultValue: ["a"], changed: false, seen: true, seenAt: T1, updatedAt: T1 })) };
	fs.writeFileSync(one, JSON.stringify(answers));
	const clean = path.join(dir, "clean.html");
	fs.writeFileSync(clean, readFixture("basic.html"));
	assert.equal(await runReviewCli(["--inject-review", clean, "--seed", "cli6", "--no-ledger"], io), 0);
	const cleanBytes = fs.readFileSync(clean, "utf8");
	answers.doc.id = readMetaContent(cleanBytes, "vpk-doc-id");
	fs.writeFileSync(one, JSON.stringify(answers));
	assert.equal(await runReviewCli(["--embed-review", one, clean], io), 2);
	assert.match(lines.at(-1), /1 decision answer would not fit: a review holds at most 200 decision answers; nothing written/);
	const crowd = { ...capReview(answers.doc.id, 0), reviewers: Array.from({ length: 65 }, (_, at) => ({ id: `u_crowd${String(at).padStart(5, "0")}`, name: `R ${at}`, initials: "R", tone: 1, updatedAt: T1 })) };
	fs.writeFileSync(one, JSON.stringify(crowd));
	assert.equal(await runReviewCli(["--embed-review", one, clean], io), 2);
	assert.match(lines.at(-1), /1 reviewer would not fit: a review holds at most 64 reviewers; nothing written/);
	assert.equal(fs.readFileSync(clean, "utf8"), cleanBytes, "nothing written");
	// --stamp --addresses <review file>: every open root of an over-cap file, and the 500 per revision named.
	fs.writeFileSync(one, JSON.stringify(capReview(answers.doc.id, 2050)));
	assert.equal(await runReviewCli(["--stamp", clean, "--no-ledger", "--addresses", one], io), 0);
	assert.ok(lines.some(line => line === "warn 1550 of 2050 addressed comments not recorded: one revision lists at most 500 (pass the rest as ids to the next --stamp)"), "the addresses over 500 are named");
});

test("T-DEMO1 buildReviewDemo is deterministic and equals the committed demo", async () => {
	const { buildReviewDemo, DEMO_TARGET } = await load("build-review-demo");
	const first = await buildReviewDemo();
	const second = await buildReviewDemo();
	assert.equal(first === second, true, "byte-identical across calls");
	assert.equal(first === fs.readFileSync(DEMO_TARGET, "utf8"), true, "equal to the committed demo (run build-review-demo.mjs --write)");
});
