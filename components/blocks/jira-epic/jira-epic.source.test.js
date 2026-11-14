const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const DEMO_SOURCE = readFileSync(join(process.cwd(), "components/website/demos/blocks/jira-epic-demo.tsx"), "utf8");
const DETAILS_SOURCE = readFileSync(join(process.cwd(), "app", "data", "details", "blocks", "jira-epic.ts"), "utf8");
const DETAILS_INDEX_SOURCE = readFileSync(join(process.cwd(), "app", "data", "details", "blocks.ts"), "utf8");
const COMPONENTS_SOURCE = readFileSync(join(process.cwd(), "app", "data", "component-manifest.ts"), "utf8");
const MANIFEST_SOURCE = readFileSync(join(process.cwd(), "app", "data", "component-manifest.ts"), "utf8");
const REGISTRY_SOURCE = readFileSync(join(process.cwd(), "components", "website", "registry", "blocks.ts"), "utf8");

const { renderComponent } = require("../../../scripts/lib/render-component.js");

const epics = [
	{ id: "a", issueKey: "EP-1", name: "Design system", color: "purple" },
	{ id: "b", issueKey: "EP-2", name: "AI studio", color: "blue" },
];

test("JiraEpic renders its selected parent in a Tag-backed dropdown trigger", async () => {
	const view = await renderComponent({ entry: "components/blocks/jira-epic/components/jira-epic.tsx", exportName: "JiraEpic", props: { epics } });
	assert.equal(view.getByRole("button", { name: "Select parent epic" }).textContent.includes("Design system"), true);
	assert.equal(view.container.querySelector('[data-slot="tag"]') !== null, true);
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	assert.equal(view.getByRole("menuitem", { name: "EP-1 Design system" }).textContent.includes("EP-1"), true);
});

test("JiraEpic selects, views, and removes a parent", async () => {
	const calls = [];
	const view = await renderComponent({ entry: "components/blocks/jira-epic/components/jira-epic.tsx", exportName: "JiraEpic", props: {
		epics, onEpicSelect: (id) => calls.push(id), onViewParent: () => calls.push("view"), onRemoveParent: () => calls.push("remove"),
	} });
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	await view.click(view.getByRole("menuitem", { name: "EP-2 AI studio" }));
	assert.equal(view.container.textContent.includes("AI studio"), true);
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	await view.click(view.getByRole("menuitem", { name: "View parent" }));
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	await view.click(view.getByRole("menuitem", { name: "Remove parent" }));
	assert.equal(view.container.textContent.includes("Add parent"), true);
	assert.deepEqual(calls, ["b", "view", "remove"]);
});

test("JiraEpic block has a page and website demo", () => {
	assert.match(PAGE_SOURCE, /<JiraEpic/u);
	assert.match(DEMO_SOURCE, /<JiraEpicPage \/>/u);
});

test("JiraEpic block is wired into docs detail, demo registry, and catalogs", () => {
	assert.match(DETAILS_SOURCE, /export const JIRA_EPIC_DETAIL/u);
	assert.match(DETAILS_INDEX_SOURCE, /import \{ JIRA_EPIC_DETAIL \} from "\.\/blocks\/jira-epic";/u);
	assert.match(DETAILS_INDEX_SOURCE, /"jira-epic": JIRA_EPIC_DETAIL/u);
	assert.match(COMPONENTS_SOURCE, /blockComponent\("jira-epic", "Jira Epic"\)/u);
	assert.match(MANIFEST_SOURCE, /blockComponent\("jira-epic", "Jira Epic"\)/u);
	assert.match(REGISTRY_SOURCE, /"jira-epic": dynamic\(\(\) => import\("\.\.\/demos\/blocks\/jira-epic-demo"\), \{\s*ssr: false,?\s*\}\)/u);
});
