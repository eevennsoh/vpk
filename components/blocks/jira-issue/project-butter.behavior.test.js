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

test("the public Butter card disables overflow actions when no handler is supplied", async () => {
	const actions = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter",
			issueKey: "PD-40",
			summary: "Implement advanced date-range filter",
		},
	});
	assert.equal(view.container.querySelector('[aria-label="Add agent to PD-40"]'), null);
	await view.click(view.getByRole("button", { name: "More actions for PD-40" }));
	assert.equal(view.getByRole("menuitem", { name: "Copy key" }).getAttribute("aria-disabled"), "true");
	assert.equal(view.getByRole("menuitem", { name: "Move work item" }).getAttribute("aria-disabled"), "true");
	await view.rerender({
		appearance: "project-butter",
		issueKey: "PD-40",
		summary: "Implement advanced date-range filter",
		onMoreActionSelect: (action) => actions.push(action),
	});
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
				agents: [{ id: "reviewer", name: "Review agent", byline: "Review changes" }],
				onAgentAssign: (agent) => actions.push(["assign", agent.id]),
				onAssignedAgentIdsChange: (ids) => actions.push(["ids", ids]),
			},
		},
	});
	const trigger = view.getByRole("button", { name: "Add agent to PD-40" });
	assert.equal(trigger.querySelector('[data-shape="hexagon"]') !== null, true);
	await view.click(trigger);
	await view.click(view.getByRole("menuitem", { name: "Review agent" }));
	assert.deepEqual(actions, [
		["assign", "reviewer"],
		["ids", ["reviewer"]],
	]);
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
	await view.click(view.getByRole("menuitem", { name: "Review agent" }));
	assert.deepEqual(assigned, ["reviewer"]);
	assert.equal(trigger.disabled, true);
	await act(() => new Promise((resolve) => setTimeout(resolve, 3200)));
	assert.equal(trigger.disabled, false);
	await view.click(trigger);
	assert.equal(view.getByRole("menuitem", { name: "Review agent" }) !== null, true);
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
