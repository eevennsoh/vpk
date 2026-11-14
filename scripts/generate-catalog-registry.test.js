"use strict";

const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { BEGIN, END, main, renderRegistry } = require("./generate-catalog-registry");

const REGISTRY = { category: "blocks", demoDir: "blocks", file: "components/website/registry/blocks.ts", table: "BLOCK_DEMOS" };
const NESTED = { category: "ui", demoDir: "ui", file: "components/website/registry/ui/primary.ts", table: "UI_PRIMARY_DEMOS" };

function scratch(t, { demos = [], tables = {} } = {}) {
	const cwd = mkdtempSync(path.join(tmpdir(), "vpk-catalog-registry-"));
	t.after(() => rmSync(cwd, { force: true, recursive: true }));
	for (const demo of demos) {
		mkdirSync(path.dirname(path.join(cwd, demo)), { recursive: true });
		writeFileSync(path.join(cwd, demo), "export default function Demo() { return null; }\n");
	}
	for (const [file, source] of Object.entries(tables)) {
		mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
		writeFileSync(path.join(cwd, file), source);
	}
	return cwd;
}

const table = (name, body) => [
	'import dynamic from "next/dynamic";',
	"",
	`export const ${name} = {`,
	BEGIN,
	END,
	...body,
	"};",
	"",
].join("\n");

const COMPONENTS = [
	{ category: "blocks", slug: "zeta-card" },
	{ category: "blocks", slug: "agent" },
	{ category: "blocks", slug: "rovo-canvas" },
	{ category: "ui", slug: "button" },
];

test("the region holds one line per manifest slug in manifest order; hand-written keys are skipped", (t) => {
	const hand = ['\t// By hand: renders another file.', '\t"rovo-canvas": dynamic(() => import("../demos/blocks/rovo-canvas-direct-demo"), { ssr: false }),'];
	const cwd = scratch(t, {
		demos: ["components/website/demos/blocks/zeta-card-demo.tsx", "components/website/demos/blocks/agent-demo.tsx", "components/website/demos/blocks/rovo-canvas-demo.tsx"],
		tables: { [REGISTRY.file]: table("BLOCK_DEMOS", hand) },
	});
	const { problems, source } = renderRegistry(REGISTRY, COMPONENTS, { cwd });
	assert.deepEqual(problems, []);
	const region = source.slice(source.indexOf(BEGIN), source.indexOf(END));
	const entries = region.split("\n").filter((line) => line.includes("dynamic("));
	assert.deepEqual(entries, [
		'\t"zeta-card": dynamic(() => import("../demos/blocks/zeta-card-demo"), { ssr: false }),',
		'\tagent: dynamic(() => import("../demos/blocks/agent-demo"), { ssr: false }),',
	]);
	assert.match(region, /Do not edit inside these markers/u);
	// The hand-written part is untouched and keeps its own entry for rovo-canvas.
	assert.ok(source.endsWith(`${END}\n${hand.join("\n")}\n};\n`));
});

test("import paths are relative to a nested registry file", (t) => {
	const cwd = scratch(t, { demos: ["components/website/demos/ui/button-demo.tsx"], tables: { [NESTED.file]: table("UI_PRIMARY_DEMOS", []) } });
	assert.match(renderRegistry(NESTED, COMPONENTS, { cwd }).source, /\tbutton: dynamic\(\(\) => import\("\.\.\/\.\.\/demos\/ui\/button-demo"\), \{ ssr: false \}\),/u);
});

test("a slug without a <slug>-demo file and no hand entry, or missing markers, stops the file", (t) => {
	const cwd = scratch(t, { demos: ["components/website/demos/blocks/agent-demo.tsx"], tables: { [REGISTRY.file]: table("BLOCK_DEMOS", []) } });
	const { problems, source } = renderRegistry(REGISTRY, COMPONENTS, { cwd });
	assert.equal(source, null);
	assert.deepEqual(problems.map((problem) => problem.split(":")[0]), ["blocks/zeta-card", "blocks/rovo-canvas"]);

	const bare = scratch(t, { tables: { [REGISTRY.file]: 'export const BLOCK_DEMOS = {\n};\n' } });
	assert.match(renderRegistry(REGISTRY, COMPONENTS, { cwd: bare }).problems[0], /generated-region markers are missing in BLOCK_DEMOS/u);
});

test("--check reports a stale region with the refresh command; a write makes it current", (t) => {
	const cwd = scratch(t, {
		demos: ["components/website/demos/blocks/zeta-card-demo.tsx", "components/website/demos/blocks/agent-demo.tsx", "components/website/demos/blocks/rovo-canvas-demo.tsx"],
		tables: { [REGISTRY.file]: table("BLOCK_DEMOS", []) },
	});
	const errors = [];
	assert.equal(main(["--check"], { components: COMPONENTS, cwd, error: (line) => errors.push(line), log: () => {}, registries: [REGISTRY] }), 1);
	assert.match(errors.join("\n"), /blocks\.ts is stale\. Run: pnpm run fix:generated --only catalog-registry/u);
	assert.equal(main([], { components: COMPONENTS, cwd, error: () => {}, log: () => {}, registries: [REGISTRY] }), 0);
	assert.match(readFileSync(path.join(cwd, REGISTRY.file), "utf8"), /"rovo-canvas": dynamic\(\(\) => import\("\.\.\/demos\/blocks\/rovo-canvas-demo"\)/u);
	assert.equal(main(["--check"], { components: COMPONENTS, cwd, error: () => {}, log: () => {}, registries: [REGISTRY] }), 0);
});

test("a registry may quote every key or write the options on their own lines, as its file always has", (t) => {
	const charts = { category: "ui-charts", demoDir: "ui-charts", file: "components/website/registry/ui-charts.ts", quoteKeys: true, table: "UI_CHARTS_DEMO" };
	const visual = { blockOptions: true, category: "visual", demoDir: "visual", file: "components/website/registry/visual.ts", table: "VISUAL_DEMOS" };
	const cwd = scratch(t, {
		demos: ["components/website/demos/ui-charts/legend-demo.tsx", "components/website/demos/visual/peel-demo.tsx"],
		tables: { [charts.file]: table("UI_CHARTS_DEMO", []), [visual.file]: table("VISUAL_DEMOS", []) },
	});
	const components = [{ category: "ui-charts", slug: "legend" }, { category: "visual", slug: "peel" }];
	assert.match(renderRegistry(charts, components, { cwd }).source, /\t"legend": dynamic\(\(\) => import\("\.\.\/demos\/ui-charts\/legend-demo"\), \{ ssr: false \}\),/u);
	assert.match(renderRegistry(visual, components, { cwd }).source, /\tpeel: dynamic\(\(\) => import\("\.\.\/demos\/visual\/peel-demo"\), \{\n\t\tssr: false,\n\t\}\),/u);
});
