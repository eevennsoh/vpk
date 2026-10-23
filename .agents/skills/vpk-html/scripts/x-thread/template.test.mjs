// T5 + T6 (ws5-xthread): the committed template and demo equal buildTargets() byte for byte, sit
// at the ws0 runtime-pipeline fixed point and pass the template/HTML checks; the bundled runtime
// evaluates in a fresh vm context, matches its source modules and keeps the bundle conventions.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { collectColorTokenIssues, collectPresentationIssues, collectSelfReferentialCustomPropertyIssues, collectSmilMotionIssues, collectSvgGrammarIssues, validateHtmlString } from "../check-html.mjs";
import { collectFontFaceIssues } from "../font-faces.mjs";
import { serializeJsonIsland } from "../json-island.mjs";
import { retrofitDocumentNav } from "../presentation.mjs";
import { applyRuntimePipeline } from "../runtime/pipeline.mjs";
import { collectFaviconIssues } from "../shared.mjs";
import { parseTweet } from "./twitter-text.mjs";
import { BUNDLE_NOTICE, bundleRuntime } from "./bundle.mjs";
import { DEMO_PATH, TEMPLATE_PATH, buildTargets, readExample } from "./build-template.mjs";
import { canonicalJson, readIslands } from "./islands.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTORS = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "twitter-text-v3-vectors.json"), "utf8"));
const HOSTILE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "content-hostile.json"), "utf8"));
const TARGETS = buildTargets();
const TEMPLATE = fs.readFileSync(TEMPLATE_PATH, "utf8");
const DEMO = fs.readFileSync(DEMO_PATH, "utf8");
const BUNDLE = bundleRuntime();
const localText = vector => (vector.repeat === undefined ? vector.text : vector.repeat.repeat(vector.times));

function runtimeScript(html) {
	return /<script data-vpk-x-thread-runtime>\n([\s\S]*?)\n<\/script>/.exec(html)?.[1];
}

// build.mjs checkTemplate's assertions (it is not exported), kept in the same order.
function templateFailures(content) {
	const failures = [];
	for (const family of ["Geist", "Geist Mono", "Geist Mono Numeric"]) if (!content.includes(`font-family: "${family}"`)) failures.push(`missing @font-face ${family}`);
	failures.push(...collectFontFaceIssues(content), ...collectColorTokenIssues(content, TEMPLATE_PATH), ...collectSelfReferentialCustomPropertyIssues(content));
	failures.push(...collectPresentationIssues(content), ...collectSmilMotionIssues(content), ...collectSvgGrammarIssues(content), ...collectFaviconIssues(content));
	if (!/--ease-out:\s*cubic-bezier\(0\.16,1,0\.3,1\)/.test(content)) failures.push("missing --ease-out");
	if (!/--vpk-dur-enter:\s*140ms/.test(content)) failures.push("missing --vpk-dur-enter");
	if (!/@media\s+print\s*\{[\s\S]*?(?:animation|transition|transform):\s*none\s*!important/i.test(content)) failures.push("missing print motion neutralizer");
	if (!/@media\s+\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?--vpk-enter-y:\s*0px/i.test(content)) failures.push("missing reduced-motion override");
	if (/(^|[^-])ease-in(?!-)/i.test(content)) failures.push("bare ease-in");
	if (!/<body\b[^>]*\bdata-vpk-motion=/i.test(content)) failures.push("missing data-vpk-motion");
	if (!/<meta\s+name="generator"\s+content="vpk-html"/i.test(content)) failures.push("missing generator meta");
	if (!/<main\b/i.test(content)) failures.push("missing <main>");
	return failures;
}

test("T5 drift: the committed template and demo equal buildTargets() byte for byte", () => {
	assert.deepEqual(TARGETS.map(target => target.path), [TEMPLATE_PATH, DEMO_PATH]);
	assert.ok(TARGETS[0].html === TEMPLATE, "assets/templates/x-thread.html is current (run x-thread/build-template.mjs)");
	assert.ok(TARGETS[1].html === DEMO, "assets/demos/demo-x-thread.html is current (run x-thread/build-template.mjs)");
});

test("T5 validation: the demo passes validateHtmlString and both pass the template assertions", () => {
	const result = validateHtmlString(DEMO, DEMO_PATH);
	assert.deepEqual(result.failures, []);
	assert.deepEqual(result.warnings, []);
	assert.deepEqual(templateFailures(TEMPLATE), []);
	assert.deepEqual(templateFailures(DEMO), []);
	assert.deepEqual(validateHtmlString(TEMPLATE, TEMPLATE_PATH).failures, ["contains unresolved {{...}} placeholder tokens"], "the template only fails on its placeholders");
});

test("T5 fixed point: the runtime pipeline and the docnav retrofit leave both files unchanged", () => {
	for (const [file, html] of [[TEMPLATE_PATH, TEMPLATE], [DEMO_PATH, DEMO]]) {
		assert.ok(applyRuntimePipeline(html, { filePath: file }) === html, `${path.basename(file)} is at the pipeline fixed point`);
		assert.ok(retrofitDocumentNav(html) === html, `${path.basename(file)} opts out of docnav`);
		assert.match(html, /<body data-vpk-motion="document" data-vpk-docnav="off" data-vpk-x-thread>/);
		assert.doesNotMatch(html, /data-vpk-docnav-runtime|data-vpk-engine|vpk-figure-engine/);
		assert.equal(html.split("<!-- vpkh-enhance:begin -->").length, 2, "one enhancement block");
		assert.ok(html.indexOf("data-vpk-x-thread-runtime") < html.indexOf("<!-- vpkh-enhance:begin -->"), "the runtime precedes the enhancement block");
	}
});

test("T5 accessibility: svgs are named or hidden, icon-only buttons have labels, headings run h1 h2 h3", () => {
	for (const html of [TEMPLATE, DEMO]) {
		// Shared runtimes hold some svgs inside JS strings, hence the optional backslash.
		for (const tag of html.match(/<svg\b[^>]*>/gi)) assert.match(tag, /aria-hidden=\\?"true|aria-label=/, tag);
		for (const [, attrs, inner] of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
			if (!inner.replace(/<svg\b[\s\S]*?<\/svg>/gi, "").replace(/<[^>]+>/g, "").trim()) assert.match(attrs, /aria-label="[^"]+"/, `icon-only button needs aria-label: ${attrs}`);
		}
		const headings = [...html.replace(/<template\b[\s\S]*?<\/template>/gi, "").matchAll(/<h([1-6])\b/gi)].map(match => Number(match[1]));
		assert.deepEqual(headings, [1, 2, 2]);
		assert.match(html, /<template id="xt-post-template">[\s\S]*?<h3 class="xt-post__title">/);
	}
});

test("T5 islands: the demo island equals the schema example, the template keeps its placeholders out of the runtime", () => {
	const demo = readIslands(DEMO);
	assert.deepEqual(demo.issues, []);
	assert.equal(canonicalJson(demo.content), canonicalJson(readExample().content));
	assert.equal(demo.state.threadId, "demo-x-thread");
	const template = readIslands(TEMPLATE);
	assert.equal(template.state.threadId, "x-thread-template");
	assert.match(TEMPLATE, /<title>\{\{DOC_TITLE\}\}<\/title>/);
	assert.match(TEMPLATE, /<h1 id="xt-title">\{\{DOC_TITLE\}\}<\/h1>/);
	assert.doesNotMatch(runtimeScript(TEMPLATE), /\{\{/);
	assert.ok(runtimeScript(TEMPLATE) === BUNDLE && runtimeScript(DEMO) === BUNDLE, "the pages carry the current bundle");
});

test("T6 seam: the bundle evaluates in a fresh context without SyntaxError or TDZ errors", () => {
	const context = { __VPK_XTHREAD_TEST__: { manualBoot: true } };
	vm.runInNewContext(BUNDLE, context);
	const exports = context.__VPK_XTHREAD_TEST__.exports;
	for (const name of ["parseTweet", "weightedLength", "serializeJsonIsland", "splitSource", "nextStep", "buildIntentUrl", "parsePostedUrl", "bootXThread"]) assert.equal(typeof exports[name], "function", name);
	const quiet = {};
	vm.runInNewContext(BUNDLE, quiet);
	assert.equal(quiet.__VPK_XTHREAD_TEST__, undefined, "nothing is exposed without the seam");
});

test("T6 parity: the bundled counter and serializer match their modules", () => {
	const context = { __VPK_XTHREAD_TEST__: { manualBoot: true } };
	vm.runInNewContext(BUNDLE, context);
	const bundled = context.__VPK_XTHREAD_TEST__.exports;
	const texts = [...VECTORS.local.weighted.map(localText), ...VECTORS.local.urls.map(vector => vector.text), ...VECTORS.evalPosts.posts.map(post => post.text)];
	assert.ok(texts.length >= 20);
	for (const text of texts) assert.deepEqual({ ...bundled.parseTweet(text) }, parseTweet(text), text.slice(0, 40));
	for (const value of [HOSTILE, HOSTILE.content, ...HOSTILE.content.posts.map(post => post.text)]) assert.equal(bundled.serializeJsonIsland(value), serializeJsonIsland(value));
	assert.equal(bundled.buildIntentUrl({ text: "a b\nc #d", inReplyTo: "123" }), "https://x.com/intent/tweet?text=a%20b%0Ac%20%23d&in_reply_to=123");
});

test("T6 conventions: no placeholders, closing tags, console, window.open, eval or module syntax in the bundle", () => {
	assert.ok(BUNDLE.startsWith(`(() => {\n"use strict";\n${BUNDLE_NOTICE}\n`), "the Apache notice leads the bundle");
	for (const banned of [/\{\{/, /@@/, /URL\("http/, /<\/script/i, /<\/body/i, /console\./, /window\.open/, /new Function/, /\beval\(/, /^\s*(?:import|export)\b/m, /<!--/, /-->/, /<script/i, /<svg/i, /(^|[^-])ease-in(?!-)/i]) {
		assert.doesNotMatch(BUNDLE, banned);
	}
	assert.doesNotMatch(BUNDLE.replace(/&#[0-9A-Fa-f]+;/g, ""), /#[0-9A-Fa-f]{3,8}\b/, "no hex colour literal once numeric entities are stripped (check-html's rule)");
	assert.deepEqual(collectColorTokenIssues(`<script>${BUNDLE}</script>`), []);
});

test("module budgets and the grayscale rule (spec §5, §4.13)", () => {
	const budgets = { "runtime.mjs": 700, "runtime-queue.mjs": 700, "runtime-stretch.mjs": 700, "check.mjs": 120, "render.mjs": 200, "bundle.mjs": 100, "build-template.mjs": 160, "islands.mjs": 250, "x-thread.css": 450, "verify-runtime.mjs": 310, "../x-thread.mjs": 400 };
	for (const [file, max] of Object.entries(budgets)) {
		const lines = fs.readFileSync(path.join(__dirname, file), "utf8").split("\n").length - 1;
		assert.ok(lines <= max, `${file} has ${lines} lines; budget ${max}`);
	}
	const css = fs.readFileSync(path.join(__dirname, "x-thread.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
	assert.doesNotMatch(css, /--success|var\(--ds-|#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/);
	// B3 decision 29: native checkboxes take the ink accent (grayscale), and a long banner link wraps. The
	// computed values are asserted in a real browser by verify-runtime.mjs.
	assert.match(css, /\.xt-check input\s*\{\s*accent-color:\s*var\(--ink\)/);
	assert.match(css, /\.xt-banner\s*\{\s*overflow-wrap:\s*anywhere/);
});
