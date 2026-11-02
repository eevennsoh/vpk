const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderCard(props) {
	return renderComponent({
		source: `
			import { ExperimentalJiraKanbanCard } from "@/components/blocks/jira-kanban/experimental/experimental-jira-kanban-card";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			export function Fixture(props) {
				return <ThemeWrapper><ExperimentalJiraKanbanCard {...props} /></ThemeWrapper>;
			}
		`,
		exportName: "Fixture",
		props,
	});
}

function fixture(events, overrides = {}) {
	return {
		active: false,
		agentActivityLayout: "merged",
		agentSessionTargetHighlighted: false,
		card: {
			code: "PAY-118",
			title: "Build the wallet picker",
			priority: "critical",
			tags: [{ text: "wallet", color: "purple" }],
			issueType: "story",
			dueDate: "2026-12-01",
		},
		chrome: "raised",
		columnTitle: "To Do",
		detachedAgentSessions: [],
		dragging: false,
		generativeActionAgents: [],
		generativeActionPresentation: "more-actions",
		generativeActionSkills: [],
		onClick: () => events.push("open"),
		onDragStart: () => events.push("drag-start"),
		onDragEnd: () => events.push("drag-end"),
		selected: false,
		...overrides,
	};
}

test("Butter board cards render the shared appearance and commit an agent assignment once", async () => {
	const events = [];
	const view = await renderCard(fixture(events, {
			appearance: "project-butter",
			agents: [{ id: "board-agent", name: "Board agent", byline: "Coding agent" }],
			onAssignedAgentIdsChange: (issueKey, ids) => events.push([issueKey, ids]),
		}));
	assert.equal(view.container.querySelector('[data-slot="jira-issue-project-butter"]') !== null, true);
	assert.equal(view.container.textContent.includes("Dec 1"), true);
	assert.equal(view.getByRole("img", { name: "story" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add agent to PAY-118" }));
	await view.click(view.getByRole("option", { name: /Board agent/u }));
	assert.deepEqual(events, [["PAY-118", ["board-agent"]]]);
});

test("Butter card selector opens its supplied directory and creation actions", async () => {
	const events = [];
	const view = await renderCard(fixture(events, {
		appearance: "project-butter",
		generativeActionFooterActions: {
			onBrowseAgents: () => events.push("browse"),
			onCreateAgent: () => events.push("create"),
		},
		onAssignedAgentIdsChange: () => events.push("assign"),
	}));
	const trigger = view.getByRole("button", { name: "Add agent to PAY-118" });
	await view.click(trigger);
	await view.click(view.getByRole("button", { name: "Browse agents" }));
	assert.deepEqual(events, ["browse"]);
	await view.click(trigger);
	await view.click(view.getByRole("button", { name: "Create agent" }));
	assert.deepEqual(events, ["browse", "create"]);
});

test("Butter board cards omit assignment without a capability and preserve every issue type", async () => {
	for (const issueType of ["task", "story", "epic", "bug", "subtask"]) {
		const props = fixture([], { appearance: "project-butter" });
		props.card.issueType = issueType;
		const view = await renderCard(props);
		assert.equal(view.getByRole("img", { name: issueType }) !== null, true);
		assert.equal(view.queryByRole("button", { name: "Add agent to PAY-118" }) === null, true);
	}
});

test("boards that omit the appearance keep the existing card and activation behavior", async () => {
	const events = [];
	const view = await renderCard(fixture(events));
	assert.equal(view.container.querySelector('[data-slot="jira-issue-project-butter"]') === null, true);
	assert.equal(view.queryByRole("button", { name: "Add agent to PAY-118" }) === null, true);
	await view.press(view.getByRole("button", { name: "PAY-118: Build the wallet picker" }), "Enter");
	assert.deepEqual(events, ["open"]);
});
