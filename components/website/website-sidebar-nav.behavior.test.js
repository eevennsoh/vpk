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

const PROJECT_ITEMS = [{ name: "Project Butter v1", href: "/components/projects/butter-v1" }];

// The runtime mock's usePathname() returns "/".
function renderProjectsSection(openOnPaths) {
	return renderComponent({
		entry: "components/website/website-sidebar-nav.tsx",
		exportName: "WebsiteSidebarNav",
		props: { sections: [{ title: "Projects", href: "/projects", defaultOpen: false, openOnPaths, items: PROJECT_ITEMS }] },
	});
}

test("a collapsed section opens on its landing route so its links are visible there", async () => {
	const view = await renderProjectsSection(["/", "/projects"]);
	assert.equal(view.getByRole("link", { name: "Project Butter v1" }).getAttribute("href"), "/components/projects/butter-v1");
});

test("a collapsed section stays closed on routes that are not its landing route", async () => {
	const view = await renderProjectsSection(["/projects"]);
	assert.equal(view.queryByRole("link", { name: "Project Butter v1" }), null);
});
