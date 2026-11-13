const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

test("the component sidebar searches all components without ADS tags or a filter", async () => {
	const view = await renderComponent({
		entry: "components/website/website-sidebar-nav.tsx",
		exportName: "WebsiteSidebarNav",
		props: {
			sections: [{
				title: "UI",
				defaultOpen: true,
				items: [
					{ name: "Lozenge", href: "/components/ui/lozenge" },
					{ name: "Button", href: "/components/ui/button" },
				],
			}],
		},
	});

	assert.equal(view.queryByRole("button", { name: "Show ADS components only" }) === null, true);
	assert.equal(view.container.textContent.includes("ADS"), false);
	assert.equal(view.getByRole("link", { name: "Lozenge" }).getAttribute("href"), "/components/ui/lozenge");

	await view.fill(view.getByRole("textbox", { name: "Search components" }), "lozenge");
	assert.equal(view.queryByRole("link", { name: "Button" }) === null, true);
	assert.equal(view.getByRole("link", { name: "Lozenge" }).getAttribute("href"), "/components/ui/lozenge");

	await view.click(view.getByRole("button", { name: "Clear search" }));
	assert.equal(view.getByRole("link", { name: "Button" }).getAttribute("href"), "/components/ui/button");
});
