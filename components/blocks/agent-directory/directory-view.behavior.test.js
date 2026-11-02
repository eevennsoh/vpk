const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");
const { act } = require("react");

const agents = [
	{ id: "alpha", name: "Alpha", byline: "Atlassian", description: "A planning agent", verified: true },
	{ id: "beta", name: "Beta", byline: "Team Operations", description: "A session agent" },
];
const templates = [{ id: "template", name: "Weekly summary", byline: "Template", description: "Summarise work", categoryId: "summarize" }];

test("browse tabs, search, and agent selection use the supplied catalogue", async () => {
	let selected;
	let selectedTemplate;
	const view = await renderComponent({
		entry: "components/blocks/agent-directory/components/directory-view.tsx",
		exportName: "AgentDirectoryView",
		mocks: { "@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }` },
		props: { agents, templateAgents: templates, ownedAgentIds: ["beta"], onSelectAgent: (agent) => { selected = agent; }, onSelectTemplateAgent: (agent) => { selectedTemplate = agent; } },
	});
	await view.click(view.getByRole("tab", { name: "Your agents" }));
	assert.equal(view.getByRole("heading", { name: "Owned by you" }).textContent, "Owned by you");
	await view.click(view.getByRole("button", { name: "View Beta" }));
	assert.equal(selected, agents[1]);
	await view.fill(view.getByRole("textbox", { name: "Search agents" }), "Alpha");
	assert.equal(view.getByRole("button", { name: "View Alpha" }).getAttribute("aria-label"), "View Alpha");
	assert.equal(view.queryByRole("button", { name: "View Beta" }) === null, true);
	await view.click(view.getByRole("tab", { name: "Templates" }));
	assert.equal(view.getByRole("textbox", { name: "Search agents" }).value, "");
	assert.equal(view.getByRole("heading", { name: "Weekly summary" }).textContent, "Weekly summary");
	await view.click(view.getByRole("button", { name: "Use Weekly summary template" }));
	assert.equal(selectedTemplate, templates[0]);
});

test("a requested template category opens directly and clears when navigating away", async () => {
	const view = await renderComponent({
		entry: "components/blocks/agent-directory/components/directory-view.tsx",
		exportName: "AgentDirectoryView",
		mocks: { "@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }` },
		props: { agents, templateAgents: [...templates, { id: "plan", name: "Planner", byline: "Template", categoryId: "brainstorm" }], initialTemplateCategory: "summarize" },
	});
	assert.equal(view.getByRole("tab", { name: "Templates" }).getAttribute("aria-selected"), "true");
	assert.equal(view.queryByRole("heading", { name: "Planner" }) === null, true);
	await view.click(view.getByRole("tab", { name: "All agents" }));
	await view.click(view.getByRole("tab", { name: "Templates" }));
	assert.equal(view.getByRole("heading", { name: "Planner" }).textContent, "Planner");
});

test("template cards use a monochrome glyph rather than the full agent avatar", async () => {
	const view = await renderComponent({
		entry: "components/blocks/agent-directory/components/directory-view.tsx",
		exportName: "AgentDirectoryView",
		mocks: { "@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }` },
		props: {
			agents: [],
			templateAgents: [
				{ id: "okr-generator", name: "OKR Generator", byline: "Template", categoryId: "brainstorm", avatarSrc: "/avatar-agent/product-agents/okr-generator.svg" },
				{ id: "custom", name: "Custom template", byline: "Template", avatarSrc: "/avatar-agent/teamwork-agents/progress-tracker.svg" },
				{ id: "decision-director", name: "Decision Director", byline: "Template" },
			],
		},
	});
	await view.click(view.getByRole("tab", { name: "Templates" }));
	for (const name of ["OKR Generator", "Custom template"]) {
		const card = view.getByRole("heading", { name }).closest("article");
		const avatar = card.querySelector('[data-slot="agent-lanyard-template-avatar"]');
		assert.equal(Boolean(avatar?.querySelector('img[src*="/avatar-agent/"]')), false);
		assert.equal(Boolean(avatar?.querySelector("svg")), true);
	}
	const known = view.getByRole("heading", { name: "Decision Director" }).closest("article");
	assert.equal(Boolean(known.querySelector('img[src$="/decision.svg"]')), true);
});

test("directory lanyards respond to hover while selection and actions stay independent", async () => {
	const selections = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-directory/components/directory-view.tsx",
		exportName: "AgentDirectoryView",
		mocks: {
			"@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }`,
			"@/hooks/use-media-query": `export function useMediaQuery() { return false; }`,
		},
		props: { agents, templateAgents: templates, onSelectAgent: (agent) => selections.push(agent.id), onSelectTemplateAgent: (agent) => selections.push(agent.id) },
	});
	await view.click(view.getByRole("tab", { name: "All agents" }));
	const cardButton = view.getByRole("button", { name: "View Alpha" });
	const card = cardButton.closest('[data-slot="agent-lanyard"]');
	const grid = card.querySelector('[data-slot="agent-lanyard-grid"]');
	assert.equal(grid.getAttribute("data-animated"), "false");
	await act(async () => { cardButton.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); });
	assert.equal(grid.getAttribute("data-animated"), "true");
	assert.equal(card.querySelector('[data-slot="agent-lanyard-surface"]').classList.contains("bg-surface-hovered"), true);
	await view.click(view.getByRole("button", { name: "Chat with Alpha" }));
	await view.click(cardButton);
	assert.deepEqual(selections, ["alpha", "alpha"]);
	await act(async () => { cardButton.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" })); });
	assert.equal(grid.getAttribute("data-animated"), "false");
	await view.click(view.getByRole("tab", { name: "Templates" }));
	const templateButton = view.getByRole("button", { name: "Use Weekly summary template" });
	const template = templateButton.closest('[data-slot="agent-lanyard"]');
	await act(async () => { templateButton.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); });
	assert.equal(template.querySelector('[data-slot="agent-lanyard-surface"]').classList.contains("bg-surface-hovered"), true);
	await view.click(templateButton);
	assert.deepEqual(selections, ["alpha", "alpha", "template"]);
});

test("v1 remains the default while v2 opens the lanyard directory", async () => {
	const view = await renderComponent({
		entry: "components/blocks/agent-directory/components/agent-directory.tsx",
		exportName: "AgentsDirectoryDialog",
		mocks: { "@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }` },
		props: { agents, templateAgents: templates, sessionTemplateAgents: [], open: true, onOpenChange: () => {} },
	});
	assert.equal(view.getByRole("heading", { name: "Browse agents" }).textContent, "Browse agents");
	assert.equal(view.queryByRole("tab", { name: "Recommended" }) === null, true);
	await view.rerender({ agents, templateAgents: templates, sessionTemplateAgents: [], open: true, onOpenChange: () => {}, variant: "standard-v1" });
	assert.equal(view.getByRole("heading", { name: "Browse agents" }).textContent, "Browse agents");
	await view.rerender({ agents, templateAgents: templates, sessionTemplateAgents: [], open: true, onOpenChange: () => {}, variant: "standard-v2" });
	assert.equal(view.getByRole("tab", { name: "Recommended" }).getAttribute("aria-selected"), "true");
	assert.equal(view.getByRole("heading", { name: "Our top recommendations for you" }).textContent, "Our top recommendations for you");
});
