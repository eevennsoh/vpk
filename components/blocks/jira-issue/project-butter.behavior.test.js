const assert = require("node:assert/strict");
const { test } = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const subtasks = [
	{ issueKey: "PD-41", summary: "Choose a date range", status: "Done", priority: "major" },
	{ issueKey: "PD-42", summary: "Support keyboard input", status: "In Progress", priority: "critical" },
	{ issueKey: "PD-43", summary: "Test date-range edge cases", status: "To Do", priority: "minor" },
];

test("Jira Local Agent remembers the last used agent and copies the work item prompt", async (t) => {
	window.localStorage.removeItem("jira-local-agent-last-used");
	const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	const copied = [];
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => copied.push(value) } });
	t.after(() => { window.localStorage.removeItem("jira-local-agent-last-used"); if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard); else delete navigator.clipboard; });
	const view = await renderComponent({ entry: "components/blocks/jira-local-agent/index.tsx", exportName: "JiraLocalAgent", props: { workItem: { code: "PAY-118", summary: "Billing", description: "Carry the artwork" } } });
	assert.equal(view.queryByRole("button", { name: "Claude" }), null);
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	assert.equal(view.queryByRole("combobox", { name: "Search agents" }), null);
	for (const name of ["Claude", "Cursor", "Codex", "GitHub Copilot", "Rovo CLI"]) {
		assert.equal(view.getByRole("button", { name: name === "Rovo CLI" ? /^Rovo CLI$/u : new RegExp(name, "u") }) !== null, true);
	}
	for (const name of ["Claude", "Cursor", "Codex", "GitHub Copilot"]) {
		assert.equal(view.getByRole("button", { name: new RegExp(name, "u") }).hasAttribute("aria-haspopup"), false);
	}
	assert.equal(view.getByRole("button", { name: "Rovo CLI" }).hasAttribute("aria-haspopup"), false);
	assert.equal(view.getByRole("button", { name: "Configure Rovo CLI" }).getAttribute("aria-haspopup"), "dialog");
	assert.equal(view.queryByRole("button", { name: /Jira Coding Agent/u }), null);
	assert.equal(view.queryByRole("button", { name: /Figma/u }), null);
	await view.click(view.getByRole("button", { name: "Codex" }));
	assert.equal(view.container.ownerDocument.querySelectorAll("[data-agent-id]")[0].textContent.includes("Codex"), true);
	assert.equal(view.container.ownerDocument.querySelectorAll("hr").length, 2);
	assert.equal(view.queryByRole("menuitem", { name: "Open in Codex" }), null);
	assert.equal(view.queryByRole("menuitem", { name: "Run on cloud" }), null);
	const copilot = view.getByRole("button", { name: /GitHub Copilot/u });
	assert.equal(copilot.disabled, true);
	assert.equal(copilot.textContent.includes("Not installed"), true);
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	assert.equal(view.container.ownerDocument.querySelectorAll("[data-agent-id]")[0].textContent.includes("Codex"), true);
	assert.equal(view.container.ownerDocument.querySelectorAll("[data-agent-id]").length, 5);
	assert.equal(view.container.ownerDocument.querySelectorAll("hr").length, 2);
	await view.click(view.getByRole("button", { name: "Copy prompt" }));
	assert.deepEqual(copied, ["PAY-118: Billing\n\nCarry the artwork"]);
	assert.equal(view.getByRole("button", { name: "Prompt copied" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Rovo CLI" }));
	assert.equal(view.container.ownerDocument.querySelectorAll("[data-agent-id]")[0].textContent.includes("Rovo CLI"), true);
	assert.equal(view.queryByRole("textbox", { name: "Choose your directory" }), null);
	await view.click(view.getByRole("button", { name: "Configure Rovo CLI" }));
	assert.equal(view.queryByRole("button", { name: "Open in Rovo CLI" }), null);
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }) !== null, true);
	await view.unmount();
});

test("Jira Local Agent can expand Rovo CLI inline with workspace options", async (t) => {
	window.localStorage.removeItem("jira-local-agent-last-used");
	t.after(() => window.localStorage.removeItem("jira-local-agent-last-used"));
	const view = await renderComponent({ entry: "components/blocks/jira-local-agent/index.tsx", exportName: "JiraLocalAgent", props: { presentation: "inline", workItem: { code: "PAY-118", summary: "Billing", description: "" } } });
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	assert.equal(view.queryByRole("textbox", { name: "Search agents" }), null);
	assert.equal(view.getByRole("button", { name: "Copy prompt" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Rovo CLI" }));
	assert.equal(view.getByRole("button", { name: "Rovo CLI" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.getByRole("button", { name: "Open in Rovo CLI" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Configure directory" }), null);
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }) !== null, true);
	await view.unmount();
});

test("finished runs dismiss independently without removing failures or interrupting an open flyout", async () => {
	const originalSet = window.setTimeout;
	const originalClear = window.clearTimeout;
	const pending = new Map();
	let nextTimer = 0;
	window.setTimeout = (callback, delay) => {
		assert.equal(delay, 5000);
		pending.set(++nextTimer, callback);
		return nextTimer;
	};
	window.clearTimeout = (id) => pending.delete(id);
	const runs = [{ id: "one", state: "done" }, { id: "failed", state: "failed" }];
	const source = `
		import { useVisibleCompletedRuns } from "@/components/blocks/jira-issue/use-visible-completed-runs";
		export function Fixture({ runs, enabled = true, paused = false }) {
			return <output>{useVisibleCompletedRuns(runs, enabled, paused).map((run) => run.id).join(",")}</output>;
		}
	`;
	try {
		const view = await renderComponent({ source, exportName: "Fixture", props: { runs } });
		assert.equal(view.container.textContent, "one,failed");
		const firstTimer = [...pending.keys()][0];
		await view.rerender({ runs: [...runs] });
		assert.deepEqual([...pending.keys()], [firstTimer]);
		const addedRuns = [...runs, { id: "two", state: "done" }];
		await view.rerender({ runs: addedRuns });
		assert.equal(pending.size, 2);
		await act(async () => { const callback = pending.get(firstTimer); pending.delete(firstTimer); callback(); });
		assert.equal(view.container.textContent, "failed,two");
		await view.rerender({ runs: addedRuns, paused: true });
		assert.equal(pending.size, 0);
		assert.equal(view.container.textContent, "failed,two");
		await view.rerender({ runs: addedRuns, paused: false });
		const secondTimer = [...pending.keys()][0];
		await act(async () => { const callback = pending.get(secondTimer); pending.delete(secondTimer); callback(); });
		assert.equal(view.container.textContent, "failed");
		await view.rerender({ runs: [{ id: "failed", state: "failed" }] });
		await view.rerender({ runs: addedRuns, enabled: false });
		assert.equal(view.container.textContent, "one,failed,two");
		assert.equal(pending.size, 0);
		await view.rerender({ runs: addedRuns, enabled: true });
		assert.equal(pending.size, 2);
		await view.unmount();
		assert.equal(pending.size, 0);
	} finally {
		window.setTimeout = originalSet;
		window.clearTimeout = originalClear;
	}
});

test("an open split completed-run flyout pauses dismissal until it closes", async () => {
	const originalSet = window.setTimeout;
	const originalClear = window.clearTimeout;
	const pending = new Map();
	let nextTimer = 0;
	window.setTimeout = (callback, delay, ...args) => {
		if (delay !== 5000) return originalSet(callback, delay, ...args);
		pending.set(--nextTimer, callback);
		return nextTimer;
	};
	window.clearTimeout = (id) => {
		if (pending.has(id)) pending.delete(id);
		else originalClear(id);
	};
	const runs = ["one", "two"].map((id) => ({ id, state: "done", agentName: id, summary: id, issueKey: "PD-40", issueSummary: "Issue" }));
	try {
		const view = await renderComponent({
			source: `
				import { useState } from "react";
				import { JiraIssueAgentDone } from "@/components/blocks/jira-issue/completed-agent-runs";
				import { useVisibleCompletedRuns } from "@/components/blocks/jira-issue/use-visible-completed-runs";
				export function Fixture({ runs }) {
					const [open, setOpen] = useState(false);
					const visible = useVisibleCompletedRuns(runs, true, open);
					return <JiraIssueAgentDone layout="split" runs={visible} onOpenChange={setOpen} usesStrokeChrome />;
				}
			`,
			exportName: "Fixture",
			mocks: {
				"@/components/blocks/product-sidebar/variants/jira-session-flyout": `
					export const createJiraSessionFlyoutHandle = () => ({});
					export function JiraSessionFlyoutTrigger({ render }) { return render; }
					export function JiraSessionFlyoutSurface({ onOpenChange }) {
						return <><button onClick={() => onOpenChange?.(true)}>Open preview</button><button onClick={() => onOpenChange?.(false)}>Close preview</button></>;
					}
				`,
			},
			props: { runs },
		});
		assert.equal(pending.size, 2);
		await view.click(view.getAllByRole("button", { name: "Open preview" })[0]);
		assert.equal(pending.size, 0);
		assert.equal(view.getAllByRole("button", { name: /finished:/u }).length, 2);
		await view.click(view.getAllByRole("button", { name: "Open preview" })[1]);
		await view.click(view.getAllByRole("button", { name: "Close preview" })[0]);
		assert.equal(pending.size, 0);
		await view.click(view.getAllByRole("button", { name: "Close preview" })[1]);
		assert.equal(pending.size, 2);
		await view.click(view.getAllByRole("button", { name: "Open preview" })[1]);
		assert.equal(pending.size, 0);
		await view.rerender({ runs: [runs[0]] });
		assert.equal(pending.size, 1);
		await view.rerender({ runs });
		assert.equal(pending.size, 2);
		await act(async () => {
			for (const [id, callback] of pending) {
				pending.delete(id);
				callback();
			}
		});
		assert.equal(view.container.textContent.includes("Open preview"), false);
		await view.unmount();
	} finally {
		window.setTimeout = originalSet;
		window.clearTimeout = originalClear;
	}
});

test("JiraIssue defaults to Project butter and keeps the earlier appearance available", async () => {
	const view = await renderComponent({
		source: `
			import { JiraIssue } from "@/components/blocks/jira-issue";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			export function Fixture(props) { return <ThemeWrapper><JiraIssue {...props} /></ThemeWrapper>; }
		`,
		exportName: "Fixture",
		props: { issueKey: "PD-40", summary: "Default card" },
	});
	assert.equal(view.container.querySelector('[data-slot="jira-issue-project-butter"]') !== null, true);
	await view.rerender({ issueKey: "PD-40", summary: "Earlier card", appearance: "default" });
	assert.equal(view.container.querySelector('[data-slot="jira-issue-project-butter"]'), null);
});

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
	const search = view.getByRole("combobox", { name: "Search agents" });
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
	assert.equal(avatar.classList.contains("size-6"), true);
	assert.equal(option.classList.contains("h-9"), true);
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
	assert.equal(option.querySelector("img")?.getAttribute("src"), "/3p/openai-codex/24.svg");
});

test("Butter uses the shared coding avatar treatments for Cursor and GitHub Copilot", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [
				{ id: "test-agent", name: "Cursor", byline: "", brandName: "cursor" },
				{ id: "release-agent", name: "GitHub Copilot", byline: "", brandName: "github-copilot" },
			], onAgentAssign: () => {} },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	const cursor = view.getByRole("option", { name: /Cursor/u });
	assert.equal(cursor.querySelector('[data-slot="avatar-hexagon-artwork"] > span').style.backgroundColor, "#14120B");
	assert.equal(cursor.querySelector("img")?.getAttribute("src"), "/3p/cursor/24.svg");
	const copilot = view.getByRole("option", { name: /GitHub Copilot/u });
	assert.equal(copilot.querySelector('[data-slot="avatar-hexagon-artwork"] > span').style.backgroundColor, "#000000");
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
	const search = view.getByRole("combobox", { name: "Search agents" });
	await view.fill(search, "copilot");
	assert.equal(view.getByRole("option", { name: /GitHub Copilot/u }) !== null, true);
	await view.fill(search, "rovo cli");
	assert.equal(view.getByRole("option", { name: /Rovo CLI/u }) !== null, true);
	await view.fill(search, "writer byline");
	assert.equal(view.getByRole("option", { name: /Writing agent/u }) !== null, true);
});

test("Rovo CLI retains editable codebase workspaces", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [
				{ id: "rovo-cli", name: "Rovo CLI", byline: "" },
				{ id: "release-agent", name: "GitHub Copilot", byline: "" },
				{ id: "claude-code", name: "Claude", byline: "" },
			], onAgentAssign: (agent) => assigned.push(agent.id) },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Rovo CLI/u }));
	const dialog = view.getByRole("dialog", { name: "Rovo CLI local options" });
	const avatar = view.getByRole("option", { name: /Rovo CLI/u }).querySelector('[data-slot="avatar"]');
	assert.equal(avatar.classList.contains("size-6"), true);
	assert.equal(avatar.parentElement.classList.contains("size-6"), true);
	assert.equal(dialog.textContent.includes("Run on cloud"), false);
	assert.equal(view.queryByRole("button", { name: "Configure directory" }), null);
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }) !== null, true);
	assert.equal(view.getByRole("status").textContent, "");
	await view.click(view.getByRole("button", { name: "Open in Rovo CLI" }));
	assert.equal(view.getByRole("button", { name: "Command copied" }) !== null, true);
	assert.equal(view.getByRole("status").textContent, "Command copied");
	await act(() => new Promise((resolve) => setTimeout(resolve, 1850)));
	assert.equal(view.getByRole("button", { name: "Open in Rovo CLI" }) !== null, true);
	assert.deepEqual(assigned, []);
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
	assert.equal(view.queryByRole("button", { name: "Open in Rovo CLI" }), null);
	assert.equal(view.queryByRole("button", { name: "Configure directory" }), null);
	assert.equal(view.queryByRole("textbox", { name: "Choose your directory" }), null);
	const unavailable = view.getByRole("menuitem", { name: /Open in VS Code.*Not installed/u });
	assert.equal(unavailable.getAttribute("aria-disabled"), "true");
	await view.click(unavailable);
	assert.equal(view.queryByRole("button", { name: "Command copied" }), null);
	assert.deepEqual(assigned, []);
	await view.click(view.getByRole("option", { name: /Rovo CLI/u }));
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

for (const agentId of ["github-copilot", "release-agent"]) {
	test(`GitHub Copilot offers cloud and VS Code (${agentId})`, async () => {
		const assigned = [];
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/index.tsx",
			exportName: "JiraIssue",
			props: { appearance: "project-butter", issueKey: "PD-40", summary: "Test", assignment: {
				agents: [{ id: agentId, name: "GitHub Copilot", byline: "" }],
				onAgentAssign: (agent) => assigned.push(agent.id),
			} },
		});
		await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
		await view.click(view.getByRole("option", { name: /GitHub Copilot/u }));
		const cloud = view.getByRole("menuitem", { name: "Run on cloud" });
		const action = view.getByRole("menuitem", { name: /Open in VS Code.*Not installed/u });
		assert.equal(action.getAttribute("aria-disabled"), "true");
		assert.equal(view.queryByRole("button", { name: "Configure directory" }), null);
		await view.press(cloud, "ArrowDown");
		assert.equal(view.isFocused(action), true);
		await view.press(action, "Enter");
		assert.deepEqual(assigned, []);
		await view.press(action, "Escape");
		assert.equal(view.queryByRole("menu", { name: "Run GitHub Copilot on" }), null);
		assert.equal(view.isFocused(view.getByRole("combobox", { name: "Search agents" })), true);
		await view.click(view.getByRole("option", { name: /GitHub Copilot/u }));
		await view.click(view.getByRole("menuitem", { name: "Run on cloud" }));
		assert.deepEqual(assigned, [agentId]);
	});
}

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
	assert.equal(view.isFocused(field), true);
	await view.click(field);
	await view.click(view.getByRole("button", { name: "No workspace" }));
	assert.equal(field.value, "");
	assert.equal(view.isFocused(field), true);
});

test("directory label spacing dismisses the workspace menu without focusing its input", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-local-agent-menu.tsx",
		exportName: "ProjectButterLocalAgentMenu",
		props: { onPointerEnter: () => {}, onPointerLeave: () => {}, onSelectingFolderChange: () => {} },
	});
	const field = view.getByRole("textbox", { name: "Choose your directory" });
	const label = view.container.querySelector("label");
	assert.equal(label.control === field, true);
	await view.click(field);
	assert.equal(view.queryByRole("dialog", { name: "Codebase workspaces" }) !== null, true);
	await view.click(label.parentElement);
	assert.equal(view.queryByRole("dialog", { name: "Codebase workspaces" }), null);
	assert.equal(view.isFocused(field), false);
});

test("adding a workspace selects the chosen path, avoids duplicates, and handles cancellation", async (t) => {
	let choices = 0;
	t.mock.method(globalThis, "fetch", async (url) => {
		if (url === "/api/realtime/ws-url") return { ok: true, json: async () => ({ wsUrl: "ws://localhost:8400" }) };
		choices += 1;
		if (choices === 4) return { ok: false };
		return { ok: true, json: async () => ({ path: choices === 3 ? null : "/Users/example/project/" }) };
	});
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-local-agent-menu.tsx",
		exportName: "ProjectButterLocalAgentMenu",
		props: { onPointerEnter: () => {}, onPointerLeave: () => {}, onSelectingFolderChange: () => {} },
	});
	await view.click(view.getByRole("textbox", { name: "Choose your directory" }));
	assert.equal(view.getByRole("dialog", { name: "Codebase workspaces" }).querySelector("button")?.textContent, "Add workspace");
	await view.click(view.getByRole("button", { name: "Add workspace" }));
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }).value, "/Users/example/project/");
	assert.equal(view.getByRole("button", { name: "/Users/example/project/" }).getAttribute("aria-current"), "true");
	assert.equal(view.getByRole("dialog", { name: "Codebase workspaces" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add workspace" }));
	assert.equal(view.container.ownerDocument.querySelectorAll('button[aria-current="true"]').length, 1);
	await view.click(view.getByRole("button", { name: "Add workspace" }));
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }).value, "/Users/example/project/");
	await view.click(view.getByRole("button", { name: "Add workspace" }));
	assert.equal(view.getByRole("alert").textContent, "Could not open the folder chooser. You can still type a path.");
	assert.equal(view.getByRole("textbox", { name: "Choose your directory" }).value, "/Users/example/project/");
});

test("Claude offers cloud and Open in Claude like the other coding agents", async () => {
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
	assert.equal(view.getByRole("menu", { name: "Run Claude on" }) !== null, true);
	assert.equal(view.queryByText(/^Run on$/u), null);
	const cloud = view.getByRole("menuitem", { name: "Run on cloud" });
	const local = view.getByRole("menuitem", { name: "Open in Claude" });
	assert.equal(view.queryByRole("button", { name: "Open in Rovo CLI" }), null);
	assert.equal(view.queryByRole("button", { name: "Configure directory" }), null);
	await view.press(cloud, "ArrowDown");
	assert.equal(view.isFocused(local), true);
	await view.click(local);
	assert.deepEqual(assigned, []);
	await view.click(cloud);
	assert.deepEqual(assigned, ["claude-code"]);
});

test("searching closes the run-location submenu for a filtered agent", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: { agents: [
				{ id: "claude-code", name: "Claude", byline: "" },
				{ id: "test-agent", name: "Cursor", byline: "" },
			], onAgentAssign: (agent) => assigned.push(agent.id) },
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Claude/u }));
	assert.equal(view.getByRole("menu", { name: "Run Claude on" }) !== null, true);
	await view.fill(view.getByRole("combobox", { name: "Search agents" }), "Cursor");
	assert.equal(view.queryByRole("menu", { name: "Run Claude on" }), null);
	assert.equal(view.queryByRole("option", { name: /Claude/u }), null);
	assert.equal(view.getByRole("option", { name: /Cursor/u }) !== null, true);
	assert.deepEqual(assigned, []);
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
	for (const [name, label] of [["Cursor", "Open in Cursor"], ["Codex", "Open in Codex"]]) {
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

test("Butter labels the single resumable session and continues it", async () => {
	const opened = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter", issueKey: "PD-40", summary: "Test",
			assignment: {
				agents: [{ id: "test-agent", name: "Cursor", byline: "" }],
				onAgentAssign: () => undefined,
				sessions: [{ id: "session-1", title: "Sample session", state: "running", host: "cloud", agent: { id: "test-agent", name: "Cursor" } }],
				onOpenSession: (session) => opened.push(session.id),
			},
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Cursor/u }));
	await view.click(view.getByRole("menuitem", { name: "Continue with last session" }));
	assert.deepEqual(opened, ["session-1"]);
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

test("Butter lets a card with attached activity add another agent", async () => {
	const assignments = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/index.tsx",
		exportName: "JiraIssue",
		props: {
			appearance: "project-butter",
			issueKey: "PD-40",
			summary: "Implement advanced date-range filter",
			agentActivities: [{ id: "reviewer", name: "Review agent", state: "working", label: "Working" }],
			assignment: {
				agents: [{ id: "writer", name: "Writing agent", byline: "Draft updates" }],
				assignedAgents: [{ id: "reviewer", name: "Review agent" }],
				onAssignedAgentIdsChange: (ids) => assignments.push(ids),
			},
		},
	});
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	assert.equal(view.container.querySelector('[data-slot="jira-issue-agent-invocation-preview"]') !== null, true);
	const actual = view.container.querySelector('[data-slot="jira-issue-agent-invocation-actual"]');
	assert.equal(actual.hasAttribute("inert"), true);
	assert.equal(actual.getAttribute("aria-hidden"), "true");
	await view.press(null, "Escape");
	assert.equal(actual.hasAttribute("inert"), false);
	assert.equal(actual.hasAttribute("aria-hidden"), false);
	assert.equal(view.getByRole("button", { name: "Review agent: Working" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
	await view.click(view.getByRole("option", { name: /Writing agent/u }));
	assert.deepEqual(assignments, [["reviewer", "writer"]]);
});

for (const role of ["owner", "viewer"]) {
	test(`Butter can start another Cursor session when a ${role} session exists`, async () => {
		const assignments = [];
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/index.tsx",
			exportName: "JiraIssue",
			props: {
				appearance: "project-butter",
				issueKey: "PD-40",
				summary: "Test",
				agentActivities: [{ id: "test-agent", name: "Cursor", state: "working", label: "Working", role }],
				assignment: {
					agents: [{ id: "test-agent", name: "Cursor", byline: "" }],
					assignedAgents: [{ id: "test-agent", name: "Cursor" }],
					onAssignedAgentIdsChange: (ids) => assignments.push(ids),
				},
			},
		});
		await view.click(view.getByRole("button", { name: "Add agent to PD-40" }));
		await view.click(view.getByRole("option", { name: /Cursor/u }));
		await view.click(view.getByRole("menuitem", { name: "Run on cloud" }));
		assert.deepEqual(assignments, [["test-agent", "test-agent"]]);
	});
}

test("Butter omits the add-agent action during selection and dragging", async () => {
	for (const state of [
		{ selected: true },
		{ dragging: true },
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
