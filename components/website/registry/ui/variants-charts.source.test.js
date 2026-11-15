const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ROOT = join(__dirname, "..", "..", "..", "..");
const REGISTRY_SOURCE = readFileSync(join(__dirname, "variants-charts.ts"), "utf8");
const DETAIL_SOURCE = readFileSync(join(ROOT, "app", "data", "details", "ui", "chart.ts"), "utf8");

/**
 * Every chart block in the @shadcn registry, in the order of ui.shadcn.com/charts/<group>.
 * chart-radar-icons and chart-radar-radius are in the registry but not on the gallery page,
 * so they close the Radar group. When shadcn adds or renames a chart, copy it into
 * components/charts/<group>/<name>.tsx, register it in variants-charts.ts, add the example in
 * app/data/details/ui/chart.ts, and update this list.
 */
const SHADCN_CHARTS = {
	Area: ["chart-area-interactive", "chart-area-default", "chart-area-linear", "chart-area-step", "chart-area-legend", "chart-area-stacked", "chart-area-stacked-expand", "chart-area-icons", "chart-area-gradient", "chart-area-axes"],
	Bar: ["chart-bar-interactive", "chart-bar-default", "chart-bar-horizontal", "chart-bar-multiple", "chart-bar-stacked", "chart-bar-label", "chart-bar-label-custom", "chart-bar-mixed", "chart-bar-active", "chart-bar-negative"],
	Line: ["chart-line-interactive", "chart-line-default", "chart-line-linear", "chart-line-step", "chart-line-multiple", "chart-line-dots", "chart-line-dots-custom", "chart-line-dots-colors", "chart-line-label", "chart-line-label-custom"],
	Pie: ["chart-pie-simple", "chart-pie-separator-none", "chart-pie-label", "chart-pie-label-custom", "chart-pie-label-list", "chart-pie-legend", "chart-pie-donut", "chart-pie-donut-active", "chart-pie-donut-text", "chart-pie-stacked", "chart-pie-interactive"],
	Radar: ["chart-radar-default", "chart-radar-dots", "chart-radar-lines-only", "chart-radar-label-custom", "chart-radar-grid-custom", "chart-radar-grid-none", "chart-radar-grid-circle", "chart-radar-grid-circle-no-lines", "chart-radar-grid-circle-fill", "chart-radar-grid-fill", "chart-radar-multiple", "chart-radar-legend", "chart-radar-icons", "chart-radar-radius"],
	Radial: ["chart-radial-simple", "chart-radial-label", "chart-radial-grid", "chart-radial-text", "chart-radial-shape", "chart-radial-stacked"],
	Tooltip: ["chart-tooltip-default", "chart-tooltip-indicator-line", "chart-tooltip-indicator-none", "chart-tooltip-label-custom", "chart-tooltip-label-formatter", "chart-tooltip-label-none", "chart-tooltip-formatter", "chart-tooltip-icons", "chart-tooltip-advanced"],
};
const SHADCN_SLUGS = Object.values(SHADCN_CHARTS).flat();

function galleryFiles() {
	return Object.keys(SHADCN_CHARTS).flatMap((group) =>
		readdirSync(join(ROOT, "components", "charts", group.toLowerCase()))
			.filter((file) => file.endsWith(".tsx"))
			.map((file) => `${group.toLowerCase()}/${file.replace(/\.tsx$/u, "")}`),
	);
}

function registryImportsBySlug() {
	const entries = new Map();
	for (const match of REGISTRY_SOURCE.matchAll(/"(chart-[a-z0-9-]+)": dynamic\(\s*\(\) =>\s*import\("([^"]+)"\)/gu)) {
		entries.set(match[1], match[2]);
	}
	const dynamicCalls = REGISTRY_SOURCE.match(/\bdynamic\(/gu)?.length ?? 0;
	assert.equal(
		entries.size,
		dynamicCalls,
		"variants-charts.ts has dynamic() entries this test could not parse; keep the `\"slug\": dynamic(() => import(\"…\")` shape or update the regex",
	);
	return entries;
}

function detailExamples() {
	return [...DETAIL_SOURCE.matchAll(/\{([^{}]*demoSlug: "[^"]+"[^{}]*)\}/gu)].map((match) => ({
		id: match[1].match(/\bid: "([^"]+)"/u)?.[1],
		group: match[1].match(/\bgroup: "([^"]+)"/u)?.[1],
		demoSlug: match[1].match(/demoSlug: "([^"]+)"/u)[1],
	}));
}

test("components/charts holds exactly the shadcn chart registry, one file per upstream name", () => {
	const expected = Object.entries(SHADCN_CHARTS).flatMap(([group, slugs]) => slugs.map((slug) => `${group.toLowerCase()}/${slug}`));
	assert.deepEqual(
		galleryFiles().sort(),
		expected.sort(),
		"components/charts/* no longer matches the shadcn chart registry; add or rename the chart files and update SHADCN_CHARTS",
	);
});

test("every shadcn chart is registered as a lazy ui variant under its upstream name", () => {
	const registry = registryImportsBySlug();
	for (const [group, slugs] of Object.entries(SHADCN_CHARTS)) {
		for (const slug of slugs) {
			assert.equal(registry.get(slug), `../../../charts/${group.toLowerCase()}/${slug}`, `${slug} is not registered in variants-charts.ts`);
		}
	}
	assert.equal(
		REGISTRY_SOURCE.match(/\{ ssr: false \}/gu)?.length,
		registry.size,
		"every chart variant stays a client-only lazy import",
	);
});

test("every registered chart variant is rendered as an example on /components/ui/chart", () => {
	const slugs = detailExamples().map((example) => example.demoSlug);
	assert.equal(new Set(slugs).size, slugs.length, "chart examples reference a demoSlug twice");
	assert.deepEqual([...registryImportsBySlug().keys()].sort(), [...slugs].sort());
});

test("shadcn chart examples keep shadcn's order, upstream anchors and group headings", () => {
	const gallery = detailExamples().filter((example) => !example.demoSlug.startsWith("chart-demo-"));
	assert.deepEqual(
		gallery.map((example) => example.demoSlug),
		SHADCN_SLUGS,
	);
	for (const example of gallery) {
		assert.equal(example.id, example.demoSlug, `${example.demoSlug} should anchor at its shadcn name`);
		assert.ok(SHADCN_CHARTS[example.group]?.includes(example.demoSlug), `${example.demoSlug} has group ${example.group}`);
	}
});
