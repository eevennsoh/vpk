const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

for (const chart of ["area", "line", "choropleth"]) {
	test(`${chart} stat-card trends use semantic appearances while preserving signed values`, async () => {
		const view = await renderComponent({
			entry: `components/ui-charts/stat-card-${chart}-01/components/trend-badge.tsx`,
			exportName: "TrendBadge",
			props: { value: 12.34 },
		});
		const badge = () => view.container.querySelector("[data-slot=badge]");
		assert.equal(badge().getAttribute("data-variant"), "success");
		assert.equal(badge().textContent, "+12.3%");
		await view.rerender({ value: -3.12 });
		assert.equal(badge().getAttribute("data-variant"), "danger");
		assert.equal(badge().textContent, "-3.1%");
		await view.rerender({ value: 0 });
		assert.equal(badge().getAttribute("data-variant"), "success");
		assert.equal(badge().textContent, "+0.0%");
	});
}
