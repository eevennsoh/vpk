const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ROOT = join(__dirname, "..", "..", "..", "..");
const REGISTRY_SOURCE = readFileSync(join(__dirname, "variants-charts.ts"), "utf8");
const DETAIL_SOURCE = readFileSync(join(ROOT, "app", "data", "details", "ui", "chart.ts"), "utf8");
const CHART_GROUPS = ["area", "bar", "line", "pie", "radar", "radial", "tooltip"];

function galleryFiles() {
	return CHART_GROUPS.flatMap((group) =>
		readdirSync(join(ROOT, "components", "charts", group))
			.filter((file) => file.endsWith(".tsx"))
			.map((file) => `${group}/${file.replace(/\.tsx$/u, "")}`),
	);
}

function registryImportsBySlug() {
	const entries = new Map();
	for (const match of REGISTRY_SOURCE.matchAll(/"(chart-[a-z0-9-]+)": dynamic\(\s*\(\) =>\s*import\("([^"]+)"\)/gu)) {
		entries.set(match[1], match[2]);
	}
	return entries;
}

function detailDemoSlugs() {
	return [...DETAIL_SOURCE.matchAll(/demoSlug: "([^"]+)"/gu)].map((match) => match[1]);
}

test("every shadcn chart gallery component is registered as a lazy ui variant", () => {
	const importedFiles = new Set(
		[...registryImportsBySlug().values()]
			.filter((importPath) => importPath.startsWith("../../../charts/"))
			.map((importPath) => importPath.slice("../../../charts/".length)),
	);
	const files = galleryFiles();
	assert.equal(files.length, 68);
	for (const file of files) {
		assert.ok(importedFiles.has(file), `components/charts/${file}.tsx is not registered in variants-charts.ts`);
	}
});

test("every registered chart variant is rendered as an example on /components/ui/chart", () => {
	const slugs = detailDemoSlugs();
	assert.equal(new Set(slugs).size, slugs.length, "chart examples reference a demoSlug twice");
	assert.deepEqual([...registryImportsBySlug().keys()].sort(), [...slugs].sort());
});

test("chart examples follow shadcn's group order", () => {
	const groupOrder = detailDemoSlugs()
		.filter((slug) => !slug.startsWith("chart-demo-"))
		.map((slug) => slug.split("-")[1])
		.filter((group, index, all) => group !== all[index - 1]);
	assert.deepEqual(groupOrder, CHART_GROUPS);
});
