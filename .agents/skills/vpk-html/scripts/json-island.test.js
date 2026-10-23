#!/usr/bin/env node
// T2 (ws6 §8, integration K9): json-island.mjs escaping, parsing and module shape.
// Escape sequences are built at run time (esc()), never written as literals in this file.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MODULE_PATH = path.join(__dirname, "json-island.mjs");
const SKILL_ROOT = path.join(__dirname, "..");
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const esc = code => "\\" + "u" + code.toString(16).padStart(4, "0");

// ws1 §4.6 rule 1: serialized runtime text must not match this.
const REVIEW_RUNTIME_FORBIDDEN = /<!--|-->|<\/?(?:script|style|body|html|head|main|template|svg|button|textarea|input|select|img|source|iframe|audio|video|object|embed|link|meta|linearGradient|radialGradient|filter)\b/i;
// ws5 T6: tokens the bundled x-thread runtime must not contain.
const XTHREAD_BUNDLE_FORBIDDEN = ["{{", "@@", "URL(\"http", "</script", "</body", "console.", "window.open", "new Function"];

const HOSTILE = [
	"#cafe #feed #2026",
	"{{x}}",
	"{{{y}}}",
	"rgb(1,2,3)",
	"hsl(1 2% 3%)",
	"</script><svg onload=x><button>go</button>",
	"<!-- /Users/x -->",
	"url(https://x.example)",
	"@import https://x.example/s.css",
	"style='border-left:4px solid'",
	`line${LS}separator${PS}paragraph`,
	"emoji 😀 and CJK 日本語",
	"back\\slash \"quoted\" 'single'",
	"& ampersand > greater < less",
];

function hostileValue() {
	return {
		title: HOSTILE[0],
		"{{key}}": HOSTILE[1],
		list: HOSTILE,
		nested: { deep: [{ text: HOSTILE[5], n: 42, ok: true, none: null }] },
	};
}

function stringLiterals(json) {
	return json.match(/"(?:[^"\\]|\\[\s\S])*"/g) || [];
}

async function load() {
	return import("./json-island.mjs");
}

test("hostile vectors serialize to escape-only text and round-trip deep-equal", async () => {
	const { serializeJsonIsland, parseJsonIsland } = await load();
	for (const space of [undefined, "\t", 2]) {
		for (const value of [hostileValue(), ...HOSTILE]) {
			const out = serializeJsonIsland(value, space);
			for (const forbidden of ["<", ">", "&", "#", "(", ")", "'", "@", LS, PS]) {
				assert.ok(!out.includes(forbidden), `raw ${JSON.stringify(forbidden)} in ${out}`);
			}
			for (const literal of stringLiterals(out)) {
				assert.ok(!/[{}]/.test(literal), `brace inside string literal ${literal}`);
			}
			assert.deepEqual(parseJsonIsland(out), value);
			assert.deepEqual(JSON.parse(out), value);
		}
	}
});

test("escapes use lowercase six-character sequences and keep JSON structure braces", async () => {
	const { serializeJsonIsland } = await load();
	const out = serializeJsonIsland({ a: "<#>" });
	assert.equal(out, `{"a":"${esc(0x3c)}${esc(0x23)}${esc(0x3e)}"}`);
	assert.equal(serializeJsonIsland({ k: [1, { b: "{" }] }), `{"k":[1,{"b":"${esc(0x7b)}"}]}`);
	assert.equal(serializeJsonIsland(`${LS}${PS}`), `"${esc(0x2028)}${esc(0x2029)}"`);
});

test("serialization is canonical: the same value gives the same bytes", async () => {
	const { serializeJsonIsland, parseJsonIsland } = await load();
	const first = serializeJsonIsland(hostileValue(), "\t");
	assert.equal(serializeJsonIsland(hostileValue(), "\t"), first);
	assert.equal(serializeJsonIsland(parseJsonIsland(first), "\t"), first);
});

test("unserializable values and non-whitespace space arguments throw TypeError", async () => {
	const { serializeJsonIsland, parseJsonIsland } = await load();
	assert.throws(() => serializeJsonIsland(undefined), TypeError);
	assert.throws(() => serializeJsonIsland(() => 1), TypeError);
	assert.throws(() => serializeJsonIsland({ a: 1 }, "#"), TypeError);
	assert.throws(() => parseJsonIsland("{nope"), /^SyntaxError: invalid JSON island: /);
	assert.throws(() => parseJsonIsland(null), TypeError);
});

test("an island built with the C1 set passes validateHtmlString; a less-than-only island fails (V30)", async () => {
	const { serializeJsonIsland } = await load();
	const { validateHtmlString } = await import("./check-html.mjs");
	const demo = fs.readFileSync(path.join(SKILL_ROOT, "assets", "demos", "demo-one-pager.html"), "utf8");
	assert.equal(validateHtmlString(demo, "demo-one-pager").ok, true, "baseline demo must pass check-html");

	const value = { facts: ["#cafe #feed {{x}}", "url(https://x.example/a.png)", "@import https://x.example/s.css", "rgb(1,2,3)", "</script><svg>"] };
	const embed = body => demo.replace(/<\/body>/i, `<script type="application/json" data-vpk-content="document">${body}</script>\n</body>`);

	const safe = validateHtmlString(embed(serializeJsonIsland(value)), "safe");
	assert.deepEqual(safe.failures, []);

	const lessThanOnly = JSON.stringify(value).replace(/</g, esc(0x3c));
	const unsafe = validateHtmlString(embed(lessThanOnly), "unsafe").failures.join("\n");
	assert.match(unsafe, /unresolved \{\{\.\.\.\}\} placeholder/);
	assert.match(unsafe, /remote runtime asset reference: url\(https:\/\//);
	assert.match(unsafe, /remote runtime asset reference: @import https:\/\//);
	assert.match(unsafe, /raw color literals/);
});

test("findJsonIslands matches attribute names exactly and only application/json scripts", async () => {
	const { findJsonIslands, extractJsonScript, parseJsonIsland } = await load();
	const html = [
		`<script type="application/json" data-vpk-review-runtime>{"wrong":1}</script>`,
		`<script data-vpk-review>{"notJson":true}</script>`,
		`<script data-vpk-review TYPE='application/json' id="r">{"comments":[]}</script>`,
		`<script type="application/json" data-vpk-review="v1">{"second":2}</SCRIPT >`,
	].join("\n");
	const islands = findJsonIslands(html, "data-vpk-review");
	assert.equal(islands.length, 2);
	assert.deepEqual(parseJsonIsland(islands[0].raw), { comments: [] });
	assert.equal(islands[0].attrs.id, "r");
	assert.equal(islands[0].attrs["data-vpk-review"], "");
	assert.equal(islands[1].attrs["data-vpk-review"], "v1");
	assert.equal(html.slice(islands[1].start, islands[1].end), html.split("\n")[3]);
	assert.equal(html.slice(islands[1].contentStart, islands[1].contentEnd), `{"second":2}`);
	assert.equal(extractJsonScript(html, "data-vpk-review"), `{"comments":[]}`);
	assert.equal(extractJsonScript(html, "data-vpk-revisions"), null);
	assert.equal(findJsonIslands(html, "data-vpk-review-runtime").length, 1);
	assert.throws(() => findJsonIslands(html, "bad name"), TypeError);
});

test("jsonIslandTag writes a parseable island and rejects unsafe attributes", async () => {
	const { jsonIslandTag, findJsonIslands, parseJsonIsland } = await load();
	const tag = jsonIslandTag({ "data-vpk-content": "x-thread", id: "x-thread-data" }, hostileValue(), "\t");
	assert.match(tag, /^<script type="application\/json" data-vpk-content="x-thread" id="x-thread-data">/);
	assert.match(tag, /<\/script>$/);
	const [island] = findJsonIslands(`<main>${tag}</main>`, "data-vpk-content");
	assert.deepEqual(parseJsonIsland(island.raw), hostileValue());

	assert.throws(() => jsonIslandTag({ "data-x": "a b" }, 1), TypeError);
	assert.throws(() => jsonIslandTag({ "data-x": "a\"b" }, 1), TypeError);
	assert.throws(() => jsonIslandTag({ "data-x": "<" }, 1), TypeError);
	assert.throws(() => jsonIslandTag({ "data-x": 3 }, 1), TypeError);
	assert.throws(() => jsonIslandTag({ type: "text/plain" }, 1), TypeError);
	assert.throws(() => jsonIslandTag({ "Bad Name": "x" }, 1), TypeError);
	assert.equal(jsonIslandTag({ "data-vpk-review": "" }, []), `<script type="application/json" data-vpk-review="">[]</script>`);
});

test("module shape: only export function declarations, no imports, ASCII, no markup characters", async () => {
	const mod = await load();
	const source = fs.readFileSync(MODULE_PATH, "utf8");
	let rest = source;
	for (const fn of Object.values(mod)) {
		assert.equal(typeof fn, "function");
		const text = fn.toString();
		const at = rest.indexOf(text);
		assert.ok(at >= 0, `function ${fn.name} source not found verbatim`);
		rest = rest.slice(0, at) + rest.slice(at + text.length);
	}
	rest = rest.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\bexport\b/g, "");
	assert.equal(rest.trim(), "", "top level holds only export function declarations and comments");
	assert.doesNotMatch(source, /^\s*import\b/m);
	assert.doesNotMatch(source, /[^\x00-\x7f]/, "source stays ASCII");
	assert.ok(!source.includes("<"), "source contains no less-than character");
	for (const token of XTHREAD_BUNDLE_FORBIDDEN) {
		assert.ok(!source.includes(token), `module text contains ${token}`);
	}
});

test("serializeJsonIsland and parseJsonIsland are self-contained and serializer-safe (ws1 C15)", async () => {
	const { serializeJsonIsland, parseJsonIsland } = await load();
	for (const fn of [serializeJsonIsland, parseJsonIsland]) {
		assert.doesNotMatch(fn.toString(), REVIEW_RUNTIME_FORBIDDEN);
	}
	const sandbox = vm.createContext({});
	vm.runInContext(`${serializeJsonIsland.toString()}\n${parseJsonIsland.toString()}`, sandbox);
	const isolated = vm.runInContext("serializeJsonIsland", sandbox);
	const isolatedParse = vm.runInContext("parseJsonIsland", sandbox);
	assert.equal(isolated(hostileValue(), "\t"), serializeJsonIsland(hostileValue(), "\t"));
	assert.equal(JSON.stringify(isolatedParse(isolated(hostileValue()))), JSON.stringify(hostileValue()));

	let esbuild = null;
	try { esbuild = require("esbuild"); } catch { /* optional: skill installed without esbuild */ }
	if (esbuild) {
		const code = `(() => { "use strict"; ${serializeJsonIsland.toString()} ${parseJsonIsland.toString()} return { serializeJsonIsland, parseJsonIsland }; })()`;
		const minified = esbuild.transformSync(code, { loader: "js", minifyWhitespace: true }).code;
		assert.doesNotMatch(minified, REVIEW_RUNTIME_FORBIDDEN);
		const fns = vm.runInContext(minified, vm.createContext({}));
		assert.equal(fns.serializeJsonIsland(hostileValue()), serializeJsonIsland(hostileValue()));
	}
});

test("a page that inlines the whole module still passes validateHtmlString (ws5 bundle rule)", async () => {
	const { validateHtmlString } = await import("./check-html.mjs");
	const demo = fs.readFileSync(path.join(SKILL_ROOT, "assets", "demos", "demo-one-pager.html"), "utf8");
	const bundled = fs.readFileSync(MODULE_PATH, "utf8").replace(/^export /gm, "");
	const page = demo.replace(/<\/body>/i, `<script>\n(() => {\n${bundled}\n})();\n</script>\n</body>`);
	assert.deepEqual(validateHtmlString(page, "bundled").failures, []);
});
