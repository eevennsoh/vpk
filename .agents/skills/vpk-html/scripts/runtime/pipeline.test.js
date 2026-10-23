#!/usr/bin/env node

// runtime pipeline contract: kinds, idempotency, block placement, import graph (ws0 T-P*, T-X2).

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const SCRIPTS = path.resolve(__dirname, "..");
const SKILL_ROOT = path.resolve(SCRIPTS, "..");
const REPO_ROOT = path.resolve(SKILL_ROOT, "..", "..", "..");

const MINIMAL_VALID_PAGE = `<!doctype html><html><head><style>@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); } :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style></head><body><main><p>x</p></main></body></html>`;
const ARTIFACT_PAGE = `<!doctype html><html><head><style>@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); } :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style></head><body><main><section><h2>One</h2><p>Visible copy.</p></section><section><h2>Two</h2><p>More visible copy.</p></section><svg aria-label="x"><rect width="10"><animate attributeName="width" from="0" to="10" begin="80ms" dur="200ms" fill="freeze"/></rect></svg></main></body></html>`;

const load = name => import(pathToFileURL(path.join(SCRIPTS, name)).href);
const count = (source, needle) => source.split(needle).length - 1;

test("T-P1 classifyTarget maps every kind row, symlinked paths and outside paths", async () => {
	const { classifyTarget } = await load("runtime/pipeline.mjs");
	const rows = [
		["index.html", "index"],
		["assets/templates/one-pager.html", "template"],
		["assets/demos/demo-one-pager.html", "demo"],
		["assets/diagrams/gantt.html", "diagram"],
		["assets/illustrations/exploded-assembly.html", "illustration"],
		["assets/landing/docs-site.html", "landing"],
		["assets/html-effectiveness/10-svg-illustrations.html", "skip"],
		["assets/video/landing-demo-separation/index.html", "skip"],
		["assets/lab/fixtures/rehearsal-target.html", "skip"],
		["assets/demos/media/nested.html", "artifact"],
		["assets/templates/not-yet-created.html", "template"],
	];
	for (const [rel, kind] of rows) assert.equal(classifyTarget(path.join(SKILL_ROOT, rel)), kind, rel);
	assert.equal(classifyTarget(path.join(REPO_ROOT, "artifacts/vpk-html/x/x.html")), "artifact");
	assert.equal(classifyTarget(path.join(os.tmpdir(), "outside", "x.html")), "artifact");
	assert.equal(classifyTarget(path.join(REPO_ROOT, ".claude/skills/vpk-html/assets/templates/one-pager.html")), "template", "symlinked skill path");
	const virtualRoot = path.join(os.tmpdir(), "vpk-virtual-skill");
	assert.equal(classifyTarget(path.join(virtualRoot, "assets/demos/x.html"), { root: virtualRoot }), "demo");
});

test("T-P2 the pipeline is idempotent for artifact, template, diagram, landing and index kinds", async () => {
	const { runRuntimePipeline } = await load("runtime/pipeline.mjs");
	const corrupt = ARTIFACT_PAGE.replace("<style>", "<style>@font-face { font-family: var(--font-mono)\"Geist Mono\"; src: url(data:font/woff2;base64,AA==); } body { font-family: var(--font-mono)\"Geist\", var(--font-sans); } ");
	const fixtures = [
		[path.join(REPO_ROOT, "artifacts/vpk-html/x/x.html"), "artifact"],
		[path.join(SKILL_ROOT, "assets/templates/__fixture.html"), "template"],
		[path.join(SKILL_ROOT, "assets/diagrams/__fixture.html"), "diagram"],
		[path.join(SKILL_ROOT, "assets/landing/__fixture.html"), "landing"],
		[path.join(SKILL_ROOT, "index.html"), "index"],
	];
	for (const [filePath, kind] of fixtures) {
		const once = runRuntimePipeline(corrupt, { filePath });
		const twice = runRuntimePipeline(once.html, { filePath });
		assert.notEqual(once.html, corrupt, `${kind}: the fixture needs work`);
		assert.equal(twice.html, once.html, `${kind}: apply(apply(x)) === apply(x)`);
		assert.deepEqual(twice.steps.filter(id => id !== "enhancements"), [], `${kind}: only enhancements may re-run, and it must be a byte no-op`);
	}
});

test("T-P3 the enhancement block is applied once, last, with the </html> fallback and a missing-body error", async () => {
	const { applyRuntimePipeline } = await load("runtime/pipeline.mjs");
	const { insertBeforeBodyEnd } = await load("runtime/blocks.mjs");
	const filePath = path.join(REPO_ROOT, "artifacts/vpk-html/x/x.html");
	const once = applyRuntimePipeline(MINIMAL_VALID_PAGE, { filePath });
	const twice = applyRuntimePipeline(once, { filePath });
	assert.equal(twice, once);
	assert.equal(count(once, "<!-- vpkh-enhance:begin -->"), 1);
	assert.ok(once.lastIndexOf("<!-- vpkh-enhance:end -->") > once.lastIndexOf("<!-- vpk-theme-runtime:end -->"), "enhancements run last");

	const noBodyEnd = "<!doctype html><html><head></head><body><main>x</main></html>";
	const fallback = insertBeforeBodyEnd(noBodyEnd, "<!-- b -->");
	assert.equal(fallback, "<!doctype html><html><head></head><body><main>x</main><!-- b -->\n</body>\n</html>");
	assert.throws(() => insertBeforeBodyEnd("<!doctype html><html><head></head></html>", "<!-- b -->"), /missing <\/body>/);
	assert.throws(() => applyRuntimePipeline("<p>fragment</p>", { filePath }), /missing <\/body>/);

	for (const rel of ["assets/diagrams/__fixture.html", "assets/illustrations/__fixture.html"]) {
		const out = applyRuntimePipeline(MINIMAL_VALID_PAGE, { filePath: path.join(SKILL_ROOT, rel) });
		assert.doesNotMatch(out, /vpkh-enhance/, `${rel} never receives the enhancement block`);
	}
});

test("T-P4 in-place registry steps reach a fixed point in one run; a move-to-end step does not", async () => {
	const { runRuntimePipeline } = await load("runtime/pipeline.mjs");
	const { defineMarkedRuntime } = await load("runtime/define.mjs");
	const { markerPair, moveMarkedBlockToBodyEnd } = await load("runtime/blocks.mjs");
	const { smilStarterStep } = await load("runtime/smil-starter.mjs");
	const { ENHANCEMENT_BLOCK } = await load("inject-enhancements.mjs");
	const filePath = path.join(REPO_ROOT, "artifacts/vpk-html/x/x.html");
	const fixture = ARTIFACT_PAGE.replace("</body>", `${ENHANCEMENT_BLOCK}\n</body>`);

	const inPlace = defineMarkedRuntime({ id: "test-in-place", kinds: ["artifact"], appliesTo: () => true, build: () => `${markerPair("test-in-place").start}\n<script data-test-in-place>1</script>\n${markerPair("test-in-place").end}`, budgetBytes: 1024 });
	const run1 = runRuntimePipeline(fixture, { filePath, steps: [inPlace, smilStarterStep] }).html;
	const run2 = runRuntimePipeline(run1, { filePath, steps: [inPlace, smilStarterStep] }).html;
	assert.equal(run2, run1, "in-place steps: fixed point after run 1");
	assert.ok(run1.indexOf("vpk-smil-starter:end") < run1.indexOf("vpkh-enhance:begin"), "X SMIL ENH after one run");

	const marker = markerPair("test-move");
	const block = `${marker.start}\n<script data-test-move>1</script>\n${marker.end}`;
	const moveToEnd = { id: "test-move", kinds: ["artifact"], apply: html => moveMarkedBlockToBodyEnd(html, { ...marker, block }) };
	const moved1 = runRuntimePipeline(fixture, { filePath, steps: [moveToEnd, smilStarterStep] }).html;
	const moved2 = runRuntimePipeline(moved1, { filePath, steps: [moveToEnd, smilStarterStep] }).html;
	assert.notEqual(moved2, moved1, "a move-to-end registry step is not a fixed point after one run");
});

test("T-P5 every marked runtime block fits its budget, carries its markers and validates in a minimal page", async () => {
	const { RUNTIME_STEPS } = await load("runtime/registry.mjs");
	const { insertBeforeBodyEnd } = await load("runtime/blocks.mjs");
	const { validateHtmlString } = await load("check-html.mjs");
	const marked = RUNTIME_STEPS.filter(step => typeof step.build === "function");
	assert.ok(marked.length >= 1, "smil-starter is registered");
	for (const step of marked) {
		const block = step.build();
		assert.ok(Buffer.byteLength(block) <= step.budgetBytes, `${step.id}: ${Buffer.byteLength(block)} B > ${step.budgetBytes} B`);
		assert.ok(block.startsWith(`<!-- vpk-${step.id}:start -->`), `${step.id} starts with its marker`);
		assert.ok(block.endsWith(`<!-- vpk-${step.id}:end -->`), `${step.id} ends with its marker`);
		assert.deepEqual(validateHtmlString(insertBeforeBodyEnd(MINIMAL_VALID_PAGE, block)).failures, [], step.id);
	}
});

test("T-P6 --inject-runtime output for an artifact is complete, valid, and drops the starter with the SVG", async () => {
	const { applyRuntimePipeline } = await load("runtime/pipeline.mjs");
	const { validateHtmlString } = await load("check-html.mjs");
	const filePath = path.join(REPO_ROOT, "artifacts/vpk-html/x/x.html");
	const out = applyRuntimePipeline(ARTIFACT_PAGE, { filePath });
	for (const marker of ["data-vpk-theme-init", "data-vpk-theme-runtime", "data-vpk-docnav-runtime"]) assert.match(out, new RegExp(marker));
	assert.equal(count(out, "<!-- vpkh-enhance:begin -->"), 1);
	assert.match(out, /begin="indefinite" data-vpk-begin="80ms"/);
	assert.equal(count(out, "<!-- vpk-smil-starter:start -->"), 1);
	assert.deepEqual(validateHtmlString(out).failures, []);

	const withoutSvg = out.replace(/<svg aria-label="x">[\s\S]*?<\/svg>/, "");
	const rerun = applyRuntimePipeline(withoutSvg, { filePath });
	assert.equal(count(rerun, "vpk-smil-starter"), 0, "starter removed once no gated SMIL remains");
});

test("T-P7 every module imports cleanly as a fresh process entry, with no output", () => {
	const modules = ["check-html.mjs", "runtime/smil-starter.mjs", "runtime/define.mjs", "runtime/registry.mjs", "runtime/pipeline.mjs", "font-faces.mjs", "media/size-budget.mjs", "build-index.mjs", "retrofit.mjs", "inject-enhancements.mjs", "runtime/blocks.mjs", "theme.mjs", "pdf.mjs", "port-kami.mjs", "migrate-identity.mjs"];
	for (const name of modules) {
		const href = pathToFileURL(path.join(SCRIPTS, name)).href;
		const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(href)});`], { encoding: "utf8", cwd: os.tmpdir() });
		assert.equal(result.status, 0, `${name}: ${result.stderr}`);
		assert.equal(result.stdout, "", `${name} printed on import`);
		assert.equal(result.stderr, "", `${name} wrote to stderr on import`);
	}
});

test("T-P8 the legacy-starter strip keeps every marked block and removes unmarked starters", async () => {
	const { smilStarterStep } = await load("runtime/smil-starter.mjs");
	const svg = `<svg aria-label="x"><rect width="1"><animate attributeName="width" to="1" begin="indefinite" dur="1s" fill="freeze"/></rect></svg>`;
	const iso = `<!-- vpk-iso-runtime:begin --><script data-vpk-smil-starter>/* iso */</script><!-- vpk-iso-runtime:end -->`;
	const enhance = `<!-- vpkh-enhance:begin --><script data-vpkh-enhance>/* mentions data-vpk-smil-starter */</script><script data-vpk-smil-starter>/* inside enhance */</script><!-- vpkh-enhance:end -->`;
	const legacy = `<script data-vpk-smil-starter>\n(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; })();\n</script>`;
	const page = `<!doctype html><html><head></head><body><main>${svg}</main>\n${iso}\n${legacy}\n${enhance}\n</body></html>`;
	const out = smilStarterStep.apply(page);
	assert.ok(out.includes(iso), "a vpk-iso-runtime:begin block survives unchanged");
	assert.ok(out.includes(enhance), "a vpkh-enhance block containing the attribute survives");
	assert.ok(!out.includes(legacy), "the unmarked legacy starter is removed");
	assert.equal(count(out, "<!-- vpk-smil-starter:start -->"), 1);
	assert.equal(smilStarterStep.apply(out), out, "idempotent");
});

test("T-P9 marker helpers: function replacers, last-body insertion, head upsert", async () => {
	const { insertBeforeBodyEnd, markedRanges, removeMarkedBlock, replaceMarkedBlock, upsertMarkedBlock, upsertMarkedHeadBlock } = await load("runtime/blocks.mjs");
	const start = "<!-- vpk-t:start -->";
	const end = "<!-- vpk-t:end -->";
	const tricky = `${start}<script>const a = "$&$$ $' $\` $1";</script>${end}`;
	const html = `<html><head></head><body>${start}old${end}</body></html>`;
	assert.equal(replaceMarkedBlock(html, start, end, tricky), `<html><head></head><body>${tricky}</body></html>`, "$& and $$ round-trip");
	assert.equal(replaceMarkedBlock("<body></body>", start, end, tricky), null);
	assert.equal(upsertMarkedBlock("<body><p>1</p></body><body></body>", { start, end, block: tricky }), `<body><p>1</p></body><body>${tricky}\n</body>`, "inserts before the last </body>");
	assert.equal(removeMarkedBlock(upsertMarkedBlock("<body></body>", { start, end, block: tricky }), start, end), "<body></body>");
	assert.equal(upsertMarkedHeadBlock("<head><title>x</title></head><body></body>", { start, end, block: tricky }), `<head><title>x</title>${tricky}\n</head><body></body>`);
	const inPlace = upsertMarkedHeadBlock(`<head>${start}old${end}</head>`, { start, end, block: tricky });
	assert.equal(inPlace, `<head>${tricky}</head>`);
	assert.throws(() => upsertMarkedHeadBlock("<body></body>", { start, end, block: tricky }), /missing <\/head>/);
	assert.deepEqual(markedRanges(`a${start}b${end}c<!-- vpkh-enhance:begin -->d<!-- vpkh-enhance:end -->`).length, 2);
	assert.equal(insertBeforeBodyEnd("<BODY></BODY>", "x"), "<BODY>x\n</BODY>");
});

test("T-X2 PDF export renders with reduced motion", async () => {
	const { PDF_PAGE_OPTIONS } = await load("pdf.mjs");
	assert.equal(PDF_PAGE_OPTIONS.reducedMotion, "reduce");
});

test("refresh report: per-step rows, drift list and fix text", async () => {
	const { formatRefreshReport } = await load("runtime/pipeline.mjs");
	const clean = formatRefreshReport({ total: 207, changed: [], byStep: { retrofit: 0, "font-faces": 0, theme: 0, "smil-starter": 0, enhancements: 0, index: 0 } }, { check: true });
	assert.match(clean, /✓ library is at its fixed point \(207 files\)/);
	assert.match(clean, /^ {2}retrofit {10}0 changed$/m);
	const drift = formatRefreshReport({ total: 207, changed: [{ file: "index.html", steps: ["index"] }], byStep: { index: 1 } }, { check: true });
	assert.match(drift, /✗ vpk-html library drift: 1 of 207 files differ from the runtime pipeline/);
	assert.match(drift, /index\.html \(index\)/);
	assert.match(drift, /--refresh-library \(unsandboxed\)\. After a dependency update, @atlaskit\/icon glyphs/);
	assert.match(drift, /index {13}1 changed \(build-index\)/);
	assert.ok(fs.existsSync(path.join(SKILL_ROOT, "index.html")));
});
