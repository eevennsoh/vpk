const assert = require("node:assert/strict");
const { test } = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const subtasks = [
	{ issueKey: "PD-41", summary: "Choose a date range", status: "Done", priority: "major" },
	{ issueKey: "PD-42", summary: "Support keyboard input", status: "In Progress", priority: "critical" },
	{ issueKey: "PD-43", summary: "Test date-range edge cases", status: "To Do", priority: "minor" },
];

test("Project butter renders explicit card metadata and a subtask progress popover", async () => {
	const opened = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-summary.tsx",
		exportName: "ProjectButterSummary",
		props: {
			issueKey: "PD-40",
			summary: "Implement advanced date-range filter",
			priority: "critical",
			metadata: {
				issueType: "story",
				dueDate: "2026-04-11",
				dueDateWarning: true,
				storyPoints: 3,
				flagged: true,
			},
			subtasks,
			onSubtaskOpen: (subtask) => opened.push(subtask.issueKey),
			showPriorityIndicator: true,
		},
	});
	assert.equal(view.container.textContent.includes("PD-40"), true);
	assert.equal(view.container.textContent.includes("Apr 11"), true);
	assert.equal(view.container.textContent.includes("3 story points"), true);
	assert.equal(view.container.querySelector('[aria-label="Flagged"]') !== null, true);
	const trigger = view.getByRole("button", { name: "1 of 3 subtasks complete" });
	const arcs = Array.from(trigger.querySelectorAll('[data-slot="progress-circle"] circle'));
	assert.equal(arcs.length, 3);
	const circumference = 2 * Math.PI * Number(arcs[0].getAttribute("r"));
	const arcLength = arcs.reduce((sum, arc) => sum + Number.parseFloat(arc.getAttribute("stroke-dasharray")), 0);
	assert.equal(arcLength < circumference - 0.1, true, "Status groups have visible gaps");
	await view.click(trigger);
	await view.click(view.getByRole("button", { name: "Open PD-42: Support keyboard input" }));
	assert.deepEqual(opened, ["PD-42"]);
});

test("Project butter keeps unavailable subtask rows read-only and omits absent metadata", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-summary.tsx",
		exportName: "ProjectButterSummary",
		props: { issueKey: "PD-40", summary: "No extra metadata", priority: "medium", subtasks },
	});
	assert.equal(view.container.querySelector("time"), null);
	assert.equal(view.container.querySelector('[aria-label="Flagged"]'), null);
	await view.click(view.getByRole("button", { name: "1 of 3 subtasks complete" }));
	assert.equal(view.getByRole("button", { name: "Open PD-41: Choose a date range" }).disabled, true);
});

test("the unassigned picker commits a person and has no dead trigger without assignment capability", async () => {
	const chosen = [];
	const person = { id: "andrea", name: "Andrea Wilson", avatarSrc: "/andrea.png" };
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-assignee.tsx",
		exportName: "ProjectButterAssignee",
		props: { issueKey: "PD-40", options: [person], onAssign: (value) => chosen.push(value.id) },
	});
	await view.click(view.getByRole("button", { name: "Assign PD-40" }));
	await view.click(view.getByRole("button", { name: "Andrea Wilson" }));
	assert.deepEqual(chosen, ["andrea"]);
	await view.rerender({ issueKey: "PD-40", options: [person] });
	assert.equal(view.container.querySelectorAll("button").length, 0);
});

test("the swatch parent picker changes and removes its parent while unavailable actions are disabled", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-epic/components/jira-epic.tsx",
		exportName: "JiraEpic",
		props: {
			appearance: "swatch",
			epics: [
				{ id: "a", issueKey: "EP-1", name: "Design system", color: "purple" },
				{ id: "b", issueKey: "EP-2", name: "AI studio", color: "teal" },
			],
			showLabel: false,
		},
	});
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	assert.equal(view.getByRole("menuitem", { name: "Add parent" }).getAttribute("aria-disabled"), "true");
	await view.click(view.getByRole("menuitem", { name: "AI studio" }));
	assert.equal(view.container.textContent.includes("AI studio"), true);
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	await view.click(view.getByRole("menuitem", { name: "Remove parent" }));
	assert.equal(view.container.textContent.includes("Add parent"), true);
});

test("Butter overflow capabilities disable board actions and preserve real card actions", async () => {
	const actions = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/more-menu.tsx",
		exportName: "JiraIssueMoreMenu",
		props: {
			issueKey: "PD-40",
			availableActions: ["copy-key"],
			onActionSelect: (action) => actions.push(action),
		},
	});
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	assert.equal(view.getByRole("menuitem", { name: "Move work item" }).getAttribute("aria-disabled"), "true");
	await view.click(view.getByRole("menuitem", { name: "Copy key" }));
	assert.deepEqual(actions, ["copy-key"]);
});

test("Butter keeps overflow options enabled while unavailable actions remain no-ops", async () => {
	const actions = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			availableMoreActions: ["copy-key"], onMoreActionSelect: (action) => actions.push(action),
			moreMenuActions: {},
		},
	});
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	for (const name of ["Move work item", "Change status", "Copy link", "Copy key", "Add agent", "Link Confluence item", "Link work item", "Change parent", "Select cover", "Edit labels", "Add flag", "Select", "Archive", "Delete"]) {
		assert.notEqual(view.getByRole("menuitem", { name }).getAttribute("aria-disabled"), "true", name);
	}
	await view.click(view.getByRole("menuitem", { name: "Move work item" }));
	assert.deepEqual(actions, []);
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	await view.click(view.getByRole("menuitem", { name: "Copy key" }));
	assert.deepEqual(actions, ["copy-key"]);
});

test("Butter's hexagon action opens the shared directory and assigns an agent without opening the card", async () => {
	const actions = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter",
			issueKey: "PD-40",
			summary: "Implement advanced date-range filter",
			onClick: () => actions.push(["card"]),
			assignment: {
				agents: [
					{ id: "reviewer", name: "Review agent", byline: "Review changes" },
					{ id: "writer", name: "Writing agent", byline: "Draft updates" },
				],
				onAgentAssign: (agent) => actions.push(["assign", agent.id]),
				onAssignedAgentIdsChange: (ids) => actions.push(["ids", ids]),
			},
		},
	});
	const trigger = view.getByRole("button", { name: "Add agent to PD-40" });
	assert.equal(trigger.querySelector('[data-shape="hexagon"]') !== null, true);
	await view.click(trigger);
	const search = view.getByRole("textbox", { name: "Search agents" });
	await view.fill(search, "review");
	assert.equal(view.queryByRole("option", { name: /Writing agent/u }), null);
	await view.press(search, "Enter");
	assert.deepEqual(actions, [
		["assign", "reviewer"],
		["ids", ["reviewer"]],
	]);
});

test("Jira Coding Agent uses its green avatar in the Butter picker", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [{ id: "jira-coding", name: "Jira Coding Agent", byline: "", avatarSrc: "/1p/agent-lanyard/glyph-jira-coding.svg" }], onAgentAssign: () => {} },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	const option = view.getByRole("option", { name: /Jira Coding Agent/u });
	const avatar = option.querySelector('[data-slot="avatar"]');
	assert.equal(avatar.classList.contains("size-5"), true);
	assert.equal(avatar.parentElement.classList.contains("size-6"), true);
	assert.equal(option.querySelector('[data-slot="avatar-hexagon-artwork"] > span').style.backgroundColor, "#94C748");
});

test("Butter uses the coding artwork for the Codex picker avatar", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [{ id: "review-agent", name: "Codex", byline: "", brandName: "openai-codex" }], onAgentAssign: () => {} },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	const option = view.getByRole("option", { name: /Codex/u });
	assert.equal(option.querySelector("img")?.getAttribute("src"), "/3p/openai-codex/glyph.svg");
});

test("Butter groups agents, expands software agents, and searches the full catalog", async () => {
	const agents = [
		{ id: "jira-coding", name: "Jira Coding Agent", byline: "Jira byline" },
		{ id: "claude-code", name: "Claude", byline: "Claude byline" },
		{ id: "test-agent", name: "Cursor", byline: "Cursor byline" },
		{ id: "review-agent", name: "Codex", byline: "Codex byline" },
		{ id: "rovo-cli", name: "Rovo CLI", byline: "" },
		{ id: "release-agent", name: "GitHub Copilot", byline: "" },
		{ id: "github-copilot", name: "GitHub Copilot", byline: "" },
		{ id: "writer", name: "Writing agent", byline: "Writer byline" },
	];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: { appearance: "project-butter", issueKey: "PD-40", summary: "Test", assignment: { agents, onAgentAssign: () => {} } },
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	const software = view.getByRole("group", { name: "Software agents" }).textContent;
	assert.equal(software.indexOf("Jira Coding Agent") < software.indexOf("Claude"), true);
	assert.equal(software.indexOf("Claude") < software.indexOf("Cursor"), true);
	assert.equal(view.getByRole("group", { name: "Other agents" }).textContent.includes("Writing agent"), true);
	assert.equal(view.queryByRole("option", { name: /Codex/u }), null);
	assert.equal(view.queryByRole("option", { name: /Rovo CLI/u }), null);
	assert.equal(view.container.textContent.includes("Claude byline"), false);
	await view.click(view.getByRole("option", { name: "Show more" }));
	assert.equal(view.getByRole("option", { name: /Codex/u }) !== null, true);
	assert.equal(view.getByRole("option", { name: /Rovo CLI/u }) !== null, true);
	assert.equal(view.getByRole("option", { name: /GitHub Copilot/u }) !== null, true);
	const search = view.getByRole("textbox", { name: "Search agents" });
	await view.fill(search, "copilot");
	assert.equal(view.getByRole("option", { name: /GitHub Copilot/u }) !== null, true);
	await view.fill(search, "rovo cli");
	assert.equal(view.getByRole("option", { name: /Rovo CLI/u }) !== null, true);
	await view.fill(search, "writer byline");
	assert.equal(view.getByRole("option", { name: /Writing agent/u }) !== null, true);
});

test("Butter local agents share editable codebase workspaces", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [
				{ id: "rovo-cli", name: "Rovo CLI", byline: "" },
				{ id: "release-agent", name: "GitHub Copilot", byline: "" },
			], onAgentAssign: (agent) => assigned.push(agent.id) },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Rovo CLI/u }));
	const dialog = view.getByRole("dialog", { name: "Rovo CLI local options" });
	const avatar = view.getByRole("option", { name: /Rovo CLI/u }).querySelector('[data-slot="avatar"]');
	assert.equal(avatar.classList.contains("size-5"), true);
	assert.equal(avatar.parentElement.classList.contains("size-6"), true);
	assert.equal(dialog.textContent.includes("Run on cloud"), false);
	const configure = view.getByRole("button", { name: "Configure directory" });
	assert.equal(configure.getAttribute("aria-expanded"), "false");
	assert.equal(view.queryByRole("textbox", { name: "Choose your directory" }), null);
	await view.click(configure);
	assert.equal(configure.getAttribute("aria-expanded"), "true");
	assert.equal(view.getByRole("status").textContent, "");
	await view.click(configure);
	assert.equal(configure.getAttribute("aria-expanded"), "false");
	assert.equal(view.queryByRole("textbox", { name: "Choose your directory" }), null);
	await view.click(view.getByRole("button", { name: "Copy command" }));
	assert.equal(view.getByRole("button", { name: "Command copied" }) !== null, true);
	assert.equal(view.getByRole("status").textContent, "Command copied");
	await act(() => new Promise((resolve) => setTimeout(resolve, 1850)));
	assert.equal(view.getByRole("button", { name: "Copy command" }) !== null, true);
	assert.deepEqual(assigned, []);
	await view.click(configure);
	const field = view.getByRole("textbox", { name: "Choose your directory" });
	assert.equal(field.getAttribute("placeholder"), "No workspace");
	await view.click(field);
	assert.equal(view.getByRole("button", { name: "No workspace" }).getAttribute("aria-current"), "true");
	await view.fill(field, "~/dev/project");
	await view.click(view.getByRole("button", { name: "Create “~/dev/project”" }));
	assert.equal(field.value, "~/dev/project");
	assert.equal(view.getByRole("dialog", { name: "Codebase workspaces" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "~/dev/project" }).getAttribute("aria-current"), "true");
	assert.equal(view.isFocused(field), false);
	assert.equal(view.isFocused(view.getByRole("button", { name: "~/dev/project" })), true);
	await view.click(view.getByRole("option", { name: /GitHub Copilot/u }));
	await view.click(view.getByRole("button", { name: "Configure directory" }));
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }).value, "~/dev/project");
	assert.equal(view.queryByRole("button", { name: "Choose workspace" }), null);
	await view.click(view.getByRole("textbox", { name: "Choose your directory" }));
	assert.equal(view.getByRole("button", { name: "~/dev/project" }).getAttribute("aria-current"), "true");
	assert.equal(view.getByRole("button", { name: "No workspace" }).getAttribute("aria-current"), null);
	await view.click(view.getByRole("button", { name: "Remove ~/dev/project" }));
	assert.equal(view.getByRole("button", { name: "No workspace" }).getAttribute("aria-current"), "true");
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }).value, "");
	assert.deepEqual(assigned, []);
});

test("creating a workspace with Enter keeps the new selected entry visible", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [{ id: "rovo-cli", name: "Rovo CLI", byline: "" }], onAgentAssign: () => {} },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Rovo CLI/u }));
	await view.press(view.getByRole("button", { name: "Configure directory" }), "Enter");
	const field = view.getByRole("textbox", { name: "Choose your directory" });
	await view.fill(field, "~/dev/enter-workspace");
	await view.press(field, "Enter");
	assert.equal(field.value, "~/dev/enter-workspace");
	assert.equal(view.isFocused(field), false);
	assert.equal(view.isFocused(view.getByRole("button", { name: "~/dev/enter-workspace" })), true);
	assert.equal(view.getByRole("dialog", { name: "Codebase workspaces" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "~/dev/enter-workspace" }).getAttribute("aria-current"), "true");
	await view.press(view.getByRole("button", { name: "~/dev/enter-workspace" }), "Enter");
	assert.equal(view.queryByRole("dialog", { name: "Codebase workspaces" }), null);
	assert.equal(view.isFocused(field), false);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Configure directory" })), true);
	await view.click(field);
	await view.click(view.getByRole("button", { name: "No workspace" }));
	assert.equal(field.value, "");
	assert.equal(view.isFocused(field), false);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Configure directory" })), true);
});

test("Claude offers cloud and the shared local command and workspace picker", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [
				{ id: "claude-code", name: "Claude", byline: "" },
				{ id: "rovo-cli", name: "Rovo CLI", byline: "" },
			], onAgentAssign: (agent) => assigned.push(agent.id) },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Claude/u }));
	assert.equal(view.getByRole("dialog", { name: "Run Claude on" }) !== null, true);
	assert.equal(view.queryByText(/^Run on$/u), null);
	assert.equal(view.getByRole("button", { name: "Run on cloud" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Open in Claude app" }), null);
	await view.click(view.getByRole("button", { name: "Copy command" }));
	assert.equal(view.getByRole("button", { name: "Command copied" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Configure directory" }));
	const field = view.getByRole("textbox", { name: "Choose your directory" });
	await view.fill(field, "~/dev/claude-project");
	await view.press(field, "Enter");
	assert.equal(field.value, "~/dev/claude-project");
	await view.click(view.getByRole("option", { name: /Rovo CLI/u }));
	await view.click(view.getByRole("button", { name: "Configure directory" }));
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }).value, "~/dev/claude-project");
	await view.click(view.getByRole("option", { name: /Claude/u }));
	await view.click(view.getByRole("button", { name: "Run on cloud" }));
	assert.deepEqual(assigned, ["claude-code"]);
});

test("Butter software agents offer run locations before cloud assignment", async () => {
	const assigned = [];
	const agents = [
		{ id: "claude-code", name: "Claude", byline: "" },
		{ id: "test-agent", name: "Cursor", byline: "" },
		{ id: "review-agent", name: "Codex", byline: "" },
	];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: { appearance: "project-butter", issueKey: "PD-40", summary: "Test", assignment: { agents, onAgentAssign: (agent) => assigned.push(agent.id) } },
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	for (const [name, label] of [["Cursor", "Open in Cursor app"], ["Codex", "Open in Codex app"]]) {
		await view.click(view.getByRole("option", { name: new RegExp(name, "u") }));
		assert.equal(view.getByRole("menu", { name: `Run ${name} on` }) !== null, true);
		assert.equal(view.queryByText(/^Run on$/u), null);
		const local = view.getByRole("menuitem", { name: label });
		await view.press(view.getByRole("menuitem", { name: "Run on cloud" }), "ArrowDown");
		assert.equal(view.isFocused(local), true);
		assert.equal(local.disabled, false);
		await view.click(local);
		assert.equal(view.getByRole("menu", { name: `Run ${name} on` }) !== null, true);
		assert.deepEqual(assigned, []);
	}
	await view.click(view.getByRole("menuitem", { name: "Run on cloud" }));
	assert.deepEqual(assigned, ["review-agent"]);
});

test("Butter restores the add-agent control when assignment does not create a row", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter",
			issueKey: "PD-40",
			summary: "Implement advanced date-range filter",
			assignment: {
				agents: [{ id: "reviewer", name: "Review agent", byline: "Review changes" }],
				onAgentAssign: (agent) => assigned.push(agent.id),
			},
		},
	});
	const trigger = view.getByRole("button", { name: "Add agent to PD-40" });
	await view.click(trigger);
	await view.click(view.getByRole("option", { name: /Review agent/u }));
	assert.deepEqual(assigned, ["reviewer"]);
	assert.equal(trigger.disabled, true);
	await act(() => new Promise((resolve) => setTimeout(resolve, 3200)));
	assert.equal(trigger.disabled, false);
	await view.click(trigger);
	assert.equal(view.getByRole("option", { name: /Review agent/u }) !== null, true);
});

test("Butter omits the add-agent action during selection, dragging, and attached activity", async () => {
	for (const state of [
		{ selected: true },
		{ dragging: true },
		{ agentActivities: [{ id: "reviewer", name: "Review agent", state: "working", label: "Working" }] },
	]) {
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/index.tsx",
			exportName: "JiraIssue",
			props: {
				appearance: "project-butter",
				issueKey: "PD-40",
				summary: "Implement advanced date-range filter",
				assignment: { onAgentAssign: () => assert.fail("No assignment during this state") },
				...state,
			},
		});
		assert.equal(view.container.querySelector('[aria-label="Add agent to PD-40"]'), null);
	}
});

test("the public Butter card opens work items without activating through nested controls", async () => {
	const opened = [];
	const view = await renderComponent({
		source: `
			import { JiraIssue } from "@/components/blocks/jira-issue";
			import { JiraEpic } from "@/components/blocks/jira-epic";
			export function Fixture({ onOpen }) {
				return <JiraIssue appearance="project-butter" issueKey="PD-40" summary="Implement advanced date-range filter" onClick={onOpen} tags={[{text:"date-range"}]}
					parentEpicControl={<JiraEpic appearance="swatch" epics={[{id:"parent",issueKey:"EP-1",name:"Design system",color:"purple"}]} />} />;
			}
		`,
		exportName: "Fixture",
		props: { onOpen: () => opened.push("PD-40") },
	});
	await view.click(view.getByText("date-range", { exact: true }));
	assert.deepEqual(opened, []);
	await view.click(view.getByRole("button", { name: "Select parent epic" }));
	assert.deepEqual(opened, []);
	await view.press(null, "Escape");
	await view.press(
		view.getByRole("button", { name: "PD-40: Implement advanced date-range filter" }),
		"Enter",
	);
	assert.deepEqual(opened, ["PD-40"]);
});

test("a Butter card does not open when its portalled overflow menu is clicked", async () => {
	const opened = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter",
			issueKey: "PD-40",
			summary: "Implement advanced date-range filter",
			onClick: () => opened.push("PD-40"),
		},
	});
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	assert.deepEqual(opened, []);
	await view.click(view.getAllByRole("separator")[0]);
	assert.deepEqual(opened, []);
	await view.press(null, "Escape");
	await view.click(view.getByText("Implement advanced date-range filter", { exact: true }));
	assert.deepEqual(opened, ["PD-40"]);
});

test("a Butter card does not open when an interactive assignee control is clicked", async () => {
	const actions = [];
	const view = await renderComponent({
		source: `
			import { JiraIssue } from "@/components/blocks/jira-issue";
			export function Fixture({ onOpen, onAssignee }) {
				return <JiraIssue appearance="project-butter" issueKey="PD-40" summary="Implement advanced date-range filter" onClick={onOpen}
					assigneeControl={<div role="button" tabIndex={0} onClick={onAssignee}><span>Manage assignee</span></div>} />;
			}
		`,
		exportName: "Fixture",
		props: { onOpen: () => actions.push("card"), onAssignee: () => actions.push("assignee") },
	});
	await view.click(view.getByText("Manage assignee", { exact: true }));
	assert.deepEqual(actions, ["assignee"]);
});

test("the Butter playground commits labels and supports flagging and selection", async () => {
	const view = await renderComponent({
		source: `
			import { JiraIssue } from "@/components/blocks/jira-issue";
			import { ProjectButterPlayground } from "@/components/blocks/jira-issue/project-butter-demo";
			export function Fixture() {
				return <ProjectButterPlayground participants={[{id:"andrea",name:"Andrea Wilson",avatarSrc:"/andrea.png"}]}>
					{(props) => <JiraIssue issueKey="PD-40" summary="Implement advanced date-range filter" {...props} />}
				</ProjectButterPlayground>;
			}
		`,
		exportName: "Fixture",
	});
	const activation = view.getByRole("button", { name: "PD-40: Implement advanced date-range filter" });
	await view.click(view.getByText("Implement advanced date-range filter", { exact: true }));
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.press(activation, "Enter");
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	await view.click(view.getByRole("menuitem", { name: "Edit labels" }));
	await view.fill(view.getByRole("textbox", { name: "Labels" }), "keyboard, a11y");
	await view.click(view.getByRole("button", { name: "Save labels" }));
	assert.equal(view.container.textContent.includes("keyboard"), true);
	assert.equal(view.container.textContent.includes("FE Development"), false);
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	await view.click(view.getByRole("menuitem", { name: "Add flag" }));
	assert.equal(view.container.querySelector('[aria-label="Flagged"]') !== null, true);
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	await view.click(view.getByRole("menuitem", { name: "Remove flag" }));
	assert.equal(view.container.querySelector('[aria-label="Flagged"]'), null);
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	await view.click(view.getByRole("menuitem", { name: "Select" }));
	assert.equal(activation.getAttribute("aria-pressed"), "true");
	await view.click(activation);
	assert.equal(activation.getAttribute("aria-pressed"), "false");
});
