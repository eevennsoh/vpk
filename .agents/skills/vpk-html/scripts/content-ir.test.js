#!/usr/bin/env node
// T1 (ws6 §8, integration K10): content-ir.mjs schema subset, envelope, brief rules,
// coverage, content islands and the CLI. No Chromium, no network.

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SKILL_ROOT = path.join(__dirname, "..");
const MODULE = path.join(__dirname, "content-ir.mjs");
const BUILD = path.join(__dirname, "build.mjs");
const EXAMPLES = path.join(SKILL_ROOT, "references", "schemas", "examples");
const DEMO_STATUS = path.join(SKILL_ROOT, "assets", "demos", "demo-status-report.html");
const DOCUMENT_SCHEMA = fs.readFileSync(path.join(SKILL_ROOT, "references", "schemas", "document.json"), "utf8");

async function load() {
	return import("./content-ir.mjs");
}

function tempDir(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-content-ir-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

function write(file, text) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, text);
	return file;
}

function fixtureSkill(t, { schemas = {}, templates = ["one-pager.html", "status-report.html"], files = {} } = {}) {
	const root = tempDir(t);
	write(path.join(root, "references", "schemas", "document.json"), DOCUMENT_SCHEMA);
	for (const [type, schema] of Object.entries(schemas)) write(path.join(root, "references", "schemas", `${type}.json`), JSON.stringify(schema));
	for (const template of templates) write(path.join(root, "assets", "templates", template), "<!doctype html>");
	for (const [rel, text] of Object.entries(files)) write(path.join(root, rel), text);
	return root;
}

function brief(overrides = {}) {
	return {
		reader_job: { quick_read: "Decide the rollout.", deep_audit: "Audit the latency evidence." },
		template: "status-report.html",
		formats: ["html"],
		acceptance_checks: ["build.mjs --check-content"],
		...overrides,
	};
}

const page = body => `<!doctype html><html><head><title>t</title><style>p{}</style></head><body><main>${body}</main></body></html>`;
const messages = findings => findings.map(item => `${item.path}: ${item.message}`).join("\n");

test("validateNode covers type, enum, trimmed lengths, items, additionalProperties, pattern and nested paths", async () => {
	const { validateNode } = await load();
	const schema = {
		type: "object",
		additionalProperties: false,
		required: ["name", "list"],
		properties: {
			name: { type: "string", minLength: 2, maxLength: 4 },
			kind: { type: "string", enum: ["a", "b"] },
			count: { type: "integer", minimum: 1, maximum: 3 },
			ratio: { type: "number" },
			list: { type: "array", minItems: 1, maxItems: 2, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", pattern: "^[a-z]+$" } } } },
		},
	};
	assert.deepEqual(validateNode({ name: "  ab  ", kind: "a", count: 2, ratio: 2, list: [{ id: "ok" }] }, schema), []);
	const errors = validateNode({ name: "   a  ", kind: "c", count: 1.5, ratio: "x", list: [{ id: "Bad", extra: 1 }, {}, {}], other: true }, schema);
	const text = messages(errors);
	assert.match(text, /^name: must be at least 2 characters \(trimmed\)$/m);
	assert.match(text, /^kind: must be one of: a, b$/m);
	assert.match(text, /^count: expected integer, got number$/m);
	assert.match(text, /^ratio: expected number, got string$/m);
	assert.match(text, /^list: must have at most 2 items$/m);
	assert.match(text, /^list\[0\]\.id: must match \^\[a-z\]\+\$$/m);
	assert.match(text, /^list\[0\]\.extra: is not an allowed field$/m);
	assert.match(text, /^other: is not an allowed field$/m);
	assert.match(messages(validateNode({}, schema)), /^name: is required$/m);
	assert.match(messages(validateNode("x", { type: "string", maxLength: 0 })), /^\(root\): must be at most 0 characters/);
	assert.deepEqual(validateNode(3, { type: "number" }), [], "an integer is a number");
});

test("every committed schema uses only supported keywords; unknown keywords are reported", async () => {
	const { schemaKeywordIssues, contentSchemaTypes, loadSchema } = await load();
	const types = contentSchemaTypes(SKILL_ROOT);
	assert.ok(types.includes("document"));
	for (const type of types) {
		const { schema, issues } = loadSchema(type);
		assert.ok(schema, `${type} schema loads`);
		assert.deepEqual(issues, [], `${type} schema keywords`);
	}
	const issues = schemaKeywordIssues({ type: "object", properties: { a: { oneOf: [], "x-coverage": "maybe" } } });
	assert.match(issues.join("\n"), /\$\.properties\.a: unsupported schema keyword "oneOf"/);
	assert.match(issues.join("\n"), /x-coverage must be "skip" or "verbatim"/);
});

test("envelope rejects unknown fields, a bad lang and an unknown type; a brief-only sidecar is valid", async t => {
	const { validateEnvelope } = await load();
	const skillRoot = fixtureSkill(t);
	assert.deepEqual(validateEnvelope({ type: "document", lang: "en-GB", brief: brief() }, { skillRoot }).findings, []);
	const bad = messages(validateEnvelope({ type: "nope", lang: "english!", brief: brief(), extra: 1 }, { skillRoot }).findings);
	assert.match(bad, /^extra: is not an allowed field/m);
	assert.match(bad, /^type: unknown content type "nope"; known: document$/m);
	assert.match(bad, /^lang: must be a language tag/m);
	assert.match(messages(validateEnvelope({ type: "document" }, { skillRoot }).findings), /^lang: is required$[\s\S]*^brief: is required$/m);
	assert.match(messages(validateEnvelope([], { skillRoot }).findings), /sidecar must be a JSON object/);
	const contentErrors = validateEnvelope({ type: "document", lang: "en", brief: brief(), content: { title: "T", facts: [] } }, { skillRoot }).findings;
	assert.ok(contentErrors.every(item => item.rule === "content.contract"));
	assert.match(messages(contentErrors), /^content\.title: must be at least 2 characters/m);
	assert.match(messages(contentErrors), /^content\.facts: must have at least 1 items$/m);
});

test("brief rules B1–B9 each fire", async t => {
	const { briefContractIssues, validateEnvelope } = await load();
	const skillRoot = fixtureSkill(t, { schemas: { "x-test": { type: "object" } }, templates: ["status-report.html", "x-test.html"] });
	const run = (value, options = {}) => briefContractIssues(value, { skillRoot, ...options });
	const text = (value, options) => messages(run(value, options));
	assert.deepEqual(run(brief()), []);
	assert.deepEqual(run(brief({ template: "status-report" })), [], "a bare stem resolves");
	assert.match(text(brief({ template: "missing.html" })), /B1: template missing\.html does not exist/);
	assert.match(text(brief({ formats: ["pdf"] })), /B2: formats must include html/);
	assert.match(text(brief({ publish: ["gist"] })), /B3: publish target gist is missing from formats/);
	const iso = { id: "flow", kind: "illustration", engine: "iso-kit", job: "Show the request path." };
	const hero = { id: "dial", kind: "explainer", engine: "anatomy-hero", job: "Explain the gauge.", tier: "figure" };
	assert.match(text(brief({ figures: [iso] })), /B4: iso-kit or anatomy-hero figures need/);
	assert.match(text(brief({ figure_engine: "none", figures: [iso] })), /B4:/);
	assert.match(text(brief({ figure_engine: "iso-kit", figures: [iso, hero] })), /B5: figure_engine iso-kit excludes anatomy-hero figures/);
	assert.match(text(brief({ figure_engine: "anatomy-hero", figures: [iso, hero] })), /B5: figure_engine anatomy-hero excludes iso-kit figures/);
	assert.match(text(brief({ figure_engine: "both", figures: [iso] })), /B5: figure_engine both needs/);
	assert.deepEqual(run(brief({ figure_engine: "both", figures: [iso, hero] })), []);
	const twoHeroes = [hero, { ...hero, id: "dial-2" }];
	// B6 is retired: several anatomy heroes need no deviation.
	assert.deepEqual(run(brief({ figure_engine: "anatomy-hero", figures: twoHeroes })), []);
	const b7 = run(brief({ figure_engine: "iso-kit", figure_engine_source: "default", figures: [iso] }));
	assert.equal(b7.length, 1);
	assert.equal(b7[0].severity, "warning");
	assert.match(b7[0].message, /B7:/);
	assert.match(text(brief({ template: "status-report.html" }), { type: "x-test" }), /B8: a "x-test" sidecar must use x-test\.html/);
	assert.match(text(brief({ figures: [{ ...iso, tier: "hero" }, iso], figure_engine: "iso-kit" })), /tier applies only to anatomy-hero[\s\S]*duplicate figure id "flow"/);

	const withMeta = page("").replace("<head>", "<head><meta name=\"vpk-figure-engine\" content=\"iso-kit\">");
	assert.match(text(brief({ figure_engine: "both", figures: [iso, hero] }), { html: withMeta }), /B9: brief\.figure_engine is "both" but the HTML records/);
	assert.match(text(brief({ figure_engine: "iso-kit", figures: [iso] }), { html: page("") }), /B9: the brief plans engine figures; record the engine/);
	assert.deepEqual(run(brief({ figure_engine: "iso-kit", figures: [iso] }), { html: withMeta }), []);
	assert.deepEqual(run(brief(), { html: page("") }), [], "absent meta means none");
	const schemaErrors = validateEnvelope({ type: "document", lang: "en", brief: brief({ figure_engine: "iso", figures: [{ id: "Bad_Id", kind: "chart", engine: "iso", job: "x" }] }) }, { skillRoot }).findings;
	assert.match(messages(schemaErrors), /^brief\.figure_engine: must be one of: none, iso-kit, anatomy-hero, both$/m, "R3 vocabulary only");
	assert.match(messages(schemaErrors), /^brief\.figures\[0\]\.id: must match/m);
	assert.match(messages(schemaErrors), /^brief\.figures\[0\]\.engine: must be one of: static, iso-kit, anatomy-hero$/m);
});

test("visible text drops head, scripts, styles, templates, noscript, comments, speaker notes and hidden elements", async () => {
	const { visibleText } = await load();
	const html = `<html><head><title>Head only</title></head><body><main>
		<h1>Visible &mdash; title&nbsp;here</h1><script>scriptText()</script><style>.styleText{}</style>
		<template>templateText</template><noscript>noscriptText</noscript><!-- commentText -->
		<aside class="speaker-notes" aria-hidden="true">notesText</aside><div hidden>hiddenText</div>
		<p class="visually-hidden">srText</p><p><span>62</span><span>%</span> and <b>14</b>&#160;PRs</p></main></body></html>`;
	const text = visibleText(html);
	for (const gone of ["Head only", "scriptText", "styleText", "templateText", "noscriptText", "commentText", "notesText", "hiddenText"]) {
		assert.ok(!text.includes(gone), `${gone} should not be visible`);
	}
	assert.match(text, /Visible — title here/);
	assert.match(text, /srText/);
	assert.match(text, /62% and 14 PRs/);
});

test("coverage honours boundaries, skips long or skip-marked values and counts island strings", async () => {
	const { coverageIssues, loadSchema } = await load();
	const { schema } = loadSchema("document");
	const content = facts => ({ title: "Weekly status", facts });
	const run = (facts, body) => coverageIssues(content(facts), schema, page(`<h1>Weekly status</h1>${body}`));
	assert.equal(run([{ label: "rate", value: "62%" }], "<p>error rate 162%</p>").findings.length, 1, "62% must not match 162%");
	assert.equal(run([{ label: "rate", value: "62%" }], "<p>error rate <span>62</span><span>%</span></p>").findings.length, 0, "inline split joins");
	assert.equal(run([{ label: "rate", value: "62%" }], "<table><tr><td>62</td><td>%</td></tr></table>").findings.length, 0, "block split uses the whitespace-free fallback");
	assert.equal(run([{ label: "pass", value: "99" }], "<p>suite 99.1%</p>").findings.length, 1, "99 must not match 99.1");
	assert.equal(run([{ label: "deploys", value: "6" }], "<p>6 deploys</p>").findings.length, 0);

	const long = "x".repeat(81);
	const result = run([{ label: "only in data", value: "47 minutes", source: "never rendered source" }, { label: "long", value: long.slice(0, 80) }], "<p>47 minutes</p>");
	assert.equal(result.findings.length, 1, "the 80-character value is checked");
	assert.match(result.findings[0].message, /does not appear in the HTML/);
	assert.equal(result.findings[0].path, "content.facts[1].value");

	const skipped = coverageIssues({ title: "Weekly status", summary: long, facts: [{ label: "l", value: "v1" }] }, schema, page("<p>Weekly status v1</p>"));
	assert.deepEqual(skipped.findings, []);
	assert.equal(skipped.checked, 2, "title and value");
	assert.equal(skipped.skipped, 2, "summary is too long and the label is x-coverage skip");

	const numbers = coverageIssues({ n: 1500, ok: 3 }, { type: "object" }, page("<p>1,500 requests and 3 retries</p>"));
	assert.deepEqual(numbers.findings, [], "numbers match plain or en-US grouped");

	const island = `<script type="application/json" data-vpk-content="document">${JSON.stringify({ title: "Rendered at runtime" })}</script>`;
	assert.deepEqual(coverageIssues({ title: "Rendered at runtime", facts: [{ label: "l", value: "Rendered at runtime" }] }, schema, page(island)).findings, [], "island string leaves count");
	const verbatim = coverageIssues({ quote: long }, { type: "object", properties: { quote: { type: "string", "x-coverage": "verbatim" } } }, page("<p>short</p>"));
	assert.equal(verbatim.findings.length, 1, "x-coverage verbatim forces a long value");
});

test("islands: unknown types, missing hooks, awaited stub hooks and sidecar equality", async t => {
	const { checkIslands, CONTENT_TYPE_HOOKS } = await load();
	const schemas = { "x-test": { type: "object", required: ["posts"], properties: { posts: { type: "array" } } } };
	const skillRoot = fixtureSkill(t, { schemas, templates: ["x-test.html"], files: { "scripts/x-test/check.mjs": "" } });
	const islandOf = (type, value) => `<script type="application/json" data-vpk-content="${type}">${typeof value === "string" ? value : JSON.stringify(value)}</script>`;
	let resolved = false;
	const hooks = { "x-test": { template: "x-test.html", module: "./x-test/check.mjs", check: "checkX" }, ...CONTENT_TYPE_HOOKS };
	const importModule = async () => ({
		checkX: async html => {
			await new Promise(resolve => setTimeout(resolve, 20));
			resolved = true;
			return { ok: false, errors: [`saw ${html.length > 0}`], warnings: ["soft"] };
		},
	});
	const result = await checkIslands(page(islandOf("x-test", { posts: [] })), { skillRoot, hooks, importModule });
	assert.equal(resolved, true, "the hook is awaited");
	assert.deepEqual(result.islands, [{ type: "x-test", ok: false }]);
	assert.deepEqual(result.findings.map(item => [item.severity, item.message]), [["error", "saw true"], ["warning", "soft"]]);

	const clean = await checkIslands(page(islandOf("x-test", { posts: [] })), { skillRoot, hooks, importModule: async () => ({ checkX: () => ({ ok: true, errors: [], warnings: [] }) }) });
	assert.deepEqual(clean, { islands: [{ type: "x-test", ok: true }], findings: [] });

	const unknown = await checkIslands(page(islandOf("mystery", {})), { skillRoot, hooks, importModule });
	assert.match(messages(unknown.findings), /unknown content type "mystery"/);
	assert.equal(unknown.islands[0].ok, false);

	const missingRoot = fixtureSkill(t, { schemas, templates: ["x-test.html"] });
	const missing = await checkIslands(page(islandOf("x-test", { posts: [] })), { skillRoot: missingRoot, hooks, importModule });
	assert.match(messages(missing.findings), /validator \.\/x-test\/check\.mjs not found for x-test/);
	const pendingRoot = fixtureSkill(t, { schemas, templates: [] });
	const pending = await checkIslands(page(islandOf("x-test", { posts: [] })), { skillRoot: pendingRoot, hooks, importModule });
	assert.deepEqual(pending.findings.map(item => item.severity), ["info"], "before its template lands the hook is optional");

	const broken = await checkIslands(page(islandOf("x-test", "{nope") + islandOf("x-test", {})), { skillRoot: pendingRoot, hooks: {} });
	assert.match(messages(broken.findings), /invalid JSON island/);
	assert.match(messages(broken.findings), /content\.posts is required/);

	const sidecar = { type: "x-test", lang: "en", brief: brief(), content: { posts: [1, 2] } };
	const same = await checkIslands(page(islandOf("x-test", { posts: [1, 2] })), { skillRoot: pendingRoot, hooks: {}, sidecar });
	assert.deepEqual(same.findings, []);
	const differs = await checkIslands(page(islandOf("x-test", { posts: [2, 1] })), { skillRoot: pendingRoot, hooks: {}, sidecar });
	assert.match(messages(differs.findings), /island content differs from the sidecar content/);
	const twice = await checkIslands(page(islandOf("x-test", { posts: [1, 2] }) + islandOf("x-test", { posts: [1, 2] })), { skillRoot: pendingRoot, hooks: {}, sidecar });
	assert.match(messages(twice.findings), /more than one data-vpk-content="x-test" island/);
});

test("every registered hook whose template exists ships its module and named check export", async () => {
	const { CONTENT_TYPE_HOOKS } = await load();
	for (const [type, hook] of Object.entries(CONTENT_TYPE_HOOKS)) {
		if (!fs.existsSync(path.join(SKILL_ROOT, "assets", "templates", hook.template))) continue;
		const file = path.join(__dirname, hook.module);
		assert.ok(fs.existsSync(file), `${type}: ${hook.module} must exist once ${hook.template} exists`);
		const mod = await import(file);
		assert.equal(typeof mod[hook.check], "function", `${type}: ${hook.module} exports ${hook.check}`);
	}
});

test("committed example sidecars validate, and the document example passes full coverage on the status demo", async () => {
	const { checkContent } = await load();
	for (const name of fs.readdirSync(EXAMPLES).filter(file => file.endsWith(".content.json"))) {
		const result = await checkContent(path.join(EXAMPLES, name));
		assert.equal(result.ok, true, `${name}: ${messages(result.findings)}`);
		assert.equal(result.mode, "contract-only");
	}
	const full = await checkContent(path.join(EXAMPLES, "document.content.json"), DEMO_STATUS);
	assert.equal(full.ok, true, messages(full.findings));
	assert.equal(full.mode, "full");
	assert.equal(full.checked, 11);
	assert.deepEqual(Object.keys(full).sort(), ["checked", "findings", "html", "islands", "mode", "ok", "sidecar", "skipped", "type"]);
});

test("checkContent resolves paths both ways, maps findings to C3 rules and handles the object form", async t => {
	const { checkContent, ContentUsageError } = await load();
	const dir = tempDir(t);
	const html = write(path.join(dir, "report.html"), page("<h1>Weekly status</h1><p>uptime 99.9%</p>"));
	const envelope = { type: "document", lang: "en", brief: brief({ size_budget_kb: 10 }), content: { title: "Weekly status", facts: [{ label: "uptime", value: "99.9%" }, { label: "missing", value: "404 errors" }] } };
	const sidecar = write(path.join(dir, "report.content.json"), JSON.stringify(envelope));
	for (const result of [await checkContent(html), await checkContent(sidecar), await checkContent({ htmlPath: html }), await checkContent(html, sidecar)]) {
		assert.equal(result.mode, "full");
		assert.equal(result.sidecar.endsWith("report.content.json"), true);
		assert.equal(result.ok, false);
		assert.deepEqual(result.findings.map(item => item.rule), ["content.coverage"]);
		assert.match(result.findings[0].message, /"404 errors" does not appear/);
	}
	write(html, page(`<h1>Weekly status</h1><p>uptime 99.9% and 404 errors</p>${" ".repeat(11 * 1024)}`));
	const sized = await checkContent(html);
	assert.equal(sized.ok, true);
	assert.deepEqual(sized.findings.map(item => [item.rule, item.severity]), [["content.size", "warning"]]);
	write(sidecar, "{ not json");
	assert.match(messages((await checkContent(html)).findings), /invalid JSON/);
	await assert.rejects(() => checkContent(path.join(dir, "missing.html")), ContentUsageError);
	await assert.rejects(() => checkContent(path.join(dir, "notes.txt")), ContentUsageError);
	await assert.rejects(() => checkContent(undefined), ContentUsageError);
	const lone = write(path.join(dir, "lone.html"), page("<p>no sidecar</p>"));
	const islandsOnly = await checkContent(lone);
	assert.deepEqual([islandsOnly.mode, islandsOnly.ok, islandsOnly.sidecar], ["islands-only", true, null]);
});

test("runCheckContent returns exit codes, never a Promise to assign; the CLIs print C3 JSON", async t => {
	const { runCheckContent } = await load();
	const dir = tempDir(t);
	const good = write(path.join(dir, "good.html"), page("<h1>Weekly status</h1><p>14 PRs</p>"));
	write(path.join(dir, "good.content.json"), JSON.stringify({ type: "document", lang: "en", brief: brief(), content: { title: "Weekly status", facts: [{ label: "PRs", value: "14" }] } }));
	const bad = write(path.join(dir, "bad.html"), page("<h1>Other</h1>"));
	write(path.join(dir, "bad.content.json"), JSON.stringify({ type: "document", lang: "en", brief: brief(), content: { title: "Weekly status", facts: [{ label: "PRs", value: "14" }] } }));
	const quiet = { log: () => {}, error: () => {} };
	const pending = runCheckContent({ file: good }, quiet);
	assert.ok(pending instanceof Promise);
	assert.equal(await pending, 0);
	assert.equal(await runCheckContent({ file: bad }, quiet), 1);
	assert.equal(await runCheckContent({ file: path.join(dir, "nope.html") }, quiet), 2);

	const cli = (script, args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	const direct = cli(MODULE, [good, "--json"]);
	assert.equal(direct.status, 0, direct.stderr);
	const json = JSON.parse(direct.stdout);
	assert.deepEqual(Object.keys(json).sort(), ["checked", "findings", "html", "islands", "mode", "ok", "sidecar", "skipped", "type"]);
	assert.equal(json.mode, "full");
	assert.equal(cli(MODULE, [bad]).status, 1);
	assert.match(cli(MODULE, [good]).stdout, /OK: .*good\.content\.json: valid document contract[\s\S]*all 2 atomic content values present/);
	assert.equal(cli(MODULE, [path.join(dir, "nope.json")]).status, 2);

	const buildHasFlag = fs.readFileSync(BUILD, "utf8").includes("--check-content");
	await t.test("build.mjs --check-content dispatches to the same runner", { skip: !buildHasFlag && "build.mjs --check-content lands at B1 (integration §3)" }, () => {
		assert.equal(cli(BUILD, ["--check-content", good]).status, 0);
		assert.equal(cli(BUILD, ["--check-content", bad, "--json"]).status, 1);
		assert.equal(cli(BUILD, ["--check-content", path.join(dir, "nope.html")]).status, 2);
	});
});
