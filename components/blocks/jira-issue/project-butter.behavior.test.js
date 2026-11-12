const assert = require("node:assert/strict");
const { test } = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const subtasks = [
	{ issueKey: "PD-41", summary: "Choose a date range", status: "Done", priority: "major" },
	{ issueKey: "PD-42", summary: "Support keyboard input", status: "In Progress", priority: "critical" },
	{ issueKey: "PD-43", summary: "Test date-range edge cases", status: "To Do", priority: "minor" },
];

test("Butter cloud picker recommends Claude and keeps The Council selectable", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-inline-agent-picker.tsx",
		exportName: "ProjectButterCloudAgentPicker",
		mocks: { "@/components/ui-custom/agent-avatar-visual": "export function AgentAvatarVisual() { return null; }" },
		props: { onAssign: (agent) => assigned.push(agent.id) },
	});
	assert.equal(view.container.querySelector("[data-agent-id]")?.getAttribute("data-agent-id"), "claude-code");
	assert.equal(view.container.querySelectorAll('[data-agent-id="claude-code"]').length, 1);
	await view.click(view.getByRole("button", { name: "Claude (Recommended)" }));
	assert.deepEqual(assigned, ["claude-code"]);
	await view.fill(view.getByRole("textbox", { name: "Search agents" }), "The Council");
	await view.click(view.getByRole("button", { name: "The Council" }));
	assert.deepEqual(assigned, ["claude-code", "the-council"]);
	await view.unmount();
});

test("Butter cloud picker previews the supplied reason only for recommended Claude and keeps keyboard selection", async () => {
	const assigned = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-inline-agent-picker.tsx", exportName: "ProjectButterCloudAgentPicker",
		mocks: { "@/components/ui-custom/agent-avatar-visual": "export function AgentAvatarVisual() { return null; }" },
		props: { onAssign: (agent) => assigned.push(agent.id), recommendationReason: "Illustrative caller-supplied reason for Claude." },
	});
	try {
		const claude = view.getByRole("button", { name: "Claude (Recommended)" });
		await view.focus(claude);
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
		const card = document.querySelector('article[data-variant="recommended"]');
		assert.equal(card?.dataset.agentId, "claude");
		assert.equal(card.textContent.includes("Collaborate on code with an AI that gives smart suggestions and reviews."), true);
		assert.equal(view.getByRole("heading", { name: "Why recommended" }).nextElementSibling.textContent, "Illustrative caller-supplied reason for Claude.");
		assert.equal(card.querySelectorAll("button, a, input").length, 0);
		await view.focus(view.getByRole("button", { name: "Cursor", exact: true }));
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
		assert.equal(document.querySelector('article[data-agent-id="cursor"]')?.dataset.variant, "agent");
		assert.equal(document.querySelector('[data-slot="agent-lanyard-recommendation"]') === null, true);
		await view.focus(claude);
		await view.press(claude, "Enter");
		assert.deepEqual(assigned, ["claude-code"]);
	} finally { await view.unmount(); }
});

test("Butter cloud picker falls back to the safe demo reason for missing, empty or whitespace reasons", async () => {
	for (const recommendationReason of [undefined, "", " \t\n "]) {
		const assigned = [];
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/project-butter-inline-agent-picker.tsx", exportName: "ProjectButterCloudAgentPicker",
			mocks: { "@/components/ui-custom/agent-avatar-visual": "export function AgentAvatarVisual() { return null; }" },
			props: { recommendationReason, onAssign: (agent) => assigned.push(agent.id) },
		});
		try {
			const claude = view.getByRole("button", { name: "Claude (Recommended)" });
			await view.focus(claude);
			await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
			assert.equal(view.getByRole("heading", { name: "Why recommended" }).nextElementSibling.textContent, "Claude can help with code suggestions and reviews.");
			assert.equal(document.querySelector('article[data-variant="recommended"]')?.dataset.agentId, "claude");
			await view.press(claude, "Enter");
			assert.deepEqual(assigned, ["claude-code"]);
		} finally { await view.unmount(); }
	}
});

test("PR icon identifies draft and failed pull requests", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-summary.tsx",
		exportName: "ProjectButterSummary",
		props: { issueKey: "PAY-1", summary: "Payments", pullRequestNumber: 42, pullRequestStatus: "draft" },
	});
	const draft = view.getByRole("button", { name: "Draft pull request #42: Payments" });
	assert.equal(draft.classList.contains("group-hover/jira-issue:text-icon-subtle"), true);
	await view.click(draft);
	assert.equal(view.getByRole("dialog", { name: "Pull request #42 details" }).textContent.includes("Draft"), true);
	await view.unmount();
	const failedView = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-summary.tsx",
		exportName: "ProjectButterSummary",
		props: { issueKey: "PAY-1", summary: "Payments", pullRequestNumber: 42, pullRequestStatus: "failed" },
	});
	const failed = failedView.getByRole("button", { name: "Pull request failed #42: Payments" });
	assert.equal(failed.classList.contains("group-hover/jira-issue:text-icon-danger"), true);
	await failedView.click(failed);
	assert.equal(failedView.getByRole("dialog", { name: "Pull request #42 details" }).textContent.includes("Failed"), true);
});

test("multiple PRs show open, failed, draft, then merged, retaining order within a status", async () => {
	const item = (number, status) => ({ number, status, preview: { title: `PR ${number}`, additions: 0, deletions: 0 } });
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/project-butter-summary.tsx",
		exportName: "ProjectButterSummary",
		props: { issueKey: "PAY-1", summary: "Payments", pullRequestNumber: 1, pullRequests: [item(1, "merged"), item(2, "draft"), item(3, "open"), item(4, "failed"), item(5, "open")] },
	});
	await view.click(view.getByRole("button", { name: "Pull requests for PAY-1" }));
	const list = view.getByRole("list", { name: "Pull requests" });
	assert.deepEqual(Array.from(list.querySelectorAll("button"), (button) => button.textContent), ["#3 PR 3Open", "#5 PR 5Open", "#4 PR 4Failed", "#2 PR 2Draft", "#1 PR 1Merged"]);
});

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
	assert.equal(view.queryByRole("heading", { name: "Open in" }) === null, true);
	for (const name of ["Claude", "Cursor", "Codex", "GitHub Copilot", "Rovo CLI", "VS Code"]) {
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
	assert.equal(view.getByRole("button", { name: "Codex" }).closest(".group\\/agent").nextElementSibling?.tagName, "HR");
	assert.equal(view.queryByRole("menuitem", { name: "Open in Codex" }), null);
	assert.equal(view.queryByRole("menuitem", { name: "Run on cloud" }), null);
	const copilot = view.getByRole("button", { name: /GitHub Copilot/u });
	assert.equal(copilot.disabled, true);
	assert.equal(copilot.textContent.includes("Not installed"), true);
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	assert.equal(view.container.ownerDocument.querySelectorAll("[data-agent-id]")[0].textContent.includes("Codex"), true);
	assert.notEqual(view.queryByRole("button", { name: "VS Code" }), null);
	assert.equal(view.container.ownerDocument.querySelectorAll("hr").length, 2);
	await view.click(view.getByRole("button", { name: "Copy prompt" }));
	assert.deepEqual(copied, ["PAY-118: Billing\n\nCarry the artwork"]);
	assert.equal(view.getByRole("button", { name: "Prompt copied" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Rovo CLI" }));
	assert.equal(view.container.ownerDocument.querySelectorAll("[data-agent-id]")[0].getAttribute("data-agent-id"), "rovo-cli");
	assert.equal([...document.querySelectorAll('[role="status"]')].some((status) => status.textContent === "Command copied"), true);
	assert.equal(view.getByRole("button", { name: "Command copied" }).querySelector(".text-icon-success") !== null, true);
	assert.equal(view.queryByRole("button", { name: "Rovo CLI" }), null);
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
