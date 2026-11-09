const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = path.join(__dirname, "..", "..");

function readProjectFile(...segments) {
	return readFileSync(path.join(ROOT, ...segments), "utf8");
}

const EXPECTED_SLUGS = [
	"area-chart",
	"bar-chart",
	"candlestick-chart",
	"chart-utility",
	"choropleth-chart",
	"composed-chart",
	"funnel-chart",
	"gauge-chart",
	"heatmap-chart",
	"legend",
	"line-chart",
	"live-line-chart",
	"pie-chart",
	"profit-loss-line",
	"radar-chart",
	"radial-chart",
	"ring-chart",
	"sankey-chart",
	"scatter-chart",
	"sparkline",
	"stat-card-area-01",
	"stat-card-choropleth-01",
	"stat-card-line-01",
	"sunburst-chart",
];

test("ui-charts catalog section is wired through data, routes, previews, and registry", () => {
	const manifestSource = readProjectFile("app/data/component-manifest.ts");
	const componentSource = readProjectFile("app/data/components.ts");
	const tabSource = readProjectFile("app/data/category-tabs.ts");
	const categoryPageSource = readProjectFile("app/[category]/page.tsx");
	const componentPageSource = readProjectFile("app/components/[category]/[slug]/page.tsx");
	const homeSource = readProjectFile("app/home-content.tsx");
	const previewTypesSource = readProjectFile("app/preview/_shared/preview-types.ts");
	const previewPageSource = readProjectFile("app/preview/ui-charts/[slug]/page.tsx");
	const loaderSource = readProjectFile("components/website/demo-registry-loader.ts");
	const registrySource = readWebsiteRegistrySource();
	const detailsSource = readProjectFile("app/data/details/ui-charts.ts");
	const sidebarSource = readProjectFile("app/data/website-sidebar-nav.ts");
	const titleSource = readProjectFile("lib/project-page-title.ts");

	assert.match(manifestSource, /export const UI_CHART_COMPONENTS/u);
	assert.match(componentSource, /export const UI_CHART_COMPONENTS/u);
	assert.match(componentSource, /import \{ UI_CHART_DETAILS \} from "\.\/details\/ui-charts";/u);
	assert.match(tabSource, /\{ key: "ui-charts", title: "UI — Charts", count: UI_CHART_COMPONENTS\.length \}/u);
	assert.match(categoryPageSource, /"ui-charts"/u);
	assert.match(componentPageSource, /UI_CHART_COMPONENTS/u);
	assert.match(componentPageSource, /category !== "ui-charts"/u);
	assert.match(homeSource, /category === "ui-charts"/u);
	assert.match(homeSource, /<WebsitePreview slug=\{comp\.slug\} name=\{comp\.name\} importPath=\{comp\.importPath\} category="ui-charts" \/>/u);
	assert.match(previewTypesSource, /"ui-charts"/u);
	assert.match(previewPageSource, /getPreviewStaticParams\("ui-charts"\)/u);
	assert.match(loaderSource, /\| "ui-charts"/u);
	assert.match(registrySource, /const UI_CHARTS_DEMO/u);
	assert.match(registrySource, /const UI_CHARTS_VARIANT_DEMOS/u);
	assert.match(registrySource, /"ui-charts": UI_CHARTS_DEMO/u);
	assert.match(registrySource, /"ui-charts": UI_CHARTS_VARIANT_DEMOS/u);
	assert.match(detailsSource, /export const UI_CHART_DETAILS/u);
	assert.match(sidebarSource, /title: "UI — Charts"/u);
	assert.match(titleSource, /"ui-charts": "UI — Charts"/u);

	for (const slug of EXPECTED_SLUGS) {
		assert.match(manifestSource, new RegExp(`uiChartComponent\\("${slug}"`, "u"));
		assert.match(componentSource, new RegExp(`uiChartComponent\\("${slug}"`, "u"));
		assert.match(detailsSource, new RegExp(`"${slug}": chartDetail`, "u"));
		assert.match(registrySource, new RegExp(`"${slug}": dynamic\\(\\(\\) => import\\("\\./demos/ui-charts/${slug}-demo"`, "u"));
		assert.equal(
			existsSync(path.join(ROOT, "components/website/demos/ui-charts", `${slug}-demo.tsx`)),
			true,
			`${slug} demo file should exist`,
		);
	}
});
