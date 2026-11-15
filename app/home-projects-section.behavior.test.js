// The home Projects view mounts one live prototype iframe (the most recently updated project)
// while the heading still counts the whole catalog. Arts keep the full sortable list.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const MANIFEST_MOCK = `
const entry = (slug, name) => ({ slug, name, importPath: "@/components/projects/" + slug });
export const PROJECT_COMPONENTS = [entry("alpha", "Alpha"), entry("butter-v1", "Project Butter v1"), entry("zeta", "Zeta")];
export const ART_COMPONENTS = [entry("art-a", "Art A"), entry("art-b", "Art B")];
`;

function iframeSources(view) {
	return [...view.container.querySelectorAll("iframe")].map((frame) => frame.getAttribute("src"));
}

function sortControlCount(view) {
	return view.queryByRole("button", { name: /^Sort:/ }) ? 1 : 0;
}

test("the Projects view renders only the most recently updated project, live", async () => {
	const view = await renderComponent({
		entry: "app/home-projects-section.tsx",
		exportName: "HomeProjectsSection",
		mocks: { "@/app/data/component-manifest": MANIFEST_MOCK },
		props: {
			projectComponents: [
				{ slug: "alpha", name: "Alpha", importPath: "", updatedAt: "2026-11-01T00:00:00Z" },
				{ slug: "butter-v1", name: "Project Butter v1", importPath: "", updatedAt: "2026-11-14T00:00:00Z" },
				{ slug: "zeta", name: "Zeta", importPath: "", updatedAt: null },
			],
		},
	});

	assert.deepEqual(iframeSources(view), ["/preview/projects/butter-v1?embedded=1"]);
	assert.match(view.container.querySelector("#projects").textContent, /^Projects\s*3$/, "the heading still counts every project");
	assert.ok(view.getByText(/Showing the latest of 3 projects\..*sidebar's Projects list/), "the note explains where the rest are");
	assert.equal(view.container.querySelector("iframe").getAttribute("loading"), "eager", "the only card is the page's main content");
	assert.equal(sortControlCount(view), 0, "a single card has nothing to sort");
});

test("without dates the Projects view falls back to one project by name", async () => {
	const view = await renderComponent({
		entry: "app/home-projects-section.tsx",
		exportName: "HomeProjectsSection",
		mocks: { "@/app/data/component-manifest": MANIFEST_MOCK },
	});

	assert.deepEqual(iframeSources(view), ["/preview/projects/alpha?embedded=1"]);
});

test("the Arts view still lists every piece with the sort control", async () => {
	const view = await renderComponent({
		entry: "app/home-arts-section.tsx",
		exportName: "HomeArtsSection",
		mocks: { "@/app/data/component-manifest": MANIFEST_MOCK },
	});

	assert.deepEqual(iframeSources(view), ["/preview/arts/art-a?embedded=1", "/preview/arts/art-b?embedded=1"]);
	assert.equal(sortControlCount(view), 1);
	assert.equal(view.queryByText(/Showing the latest/), null, "a full list needs no note");
});
