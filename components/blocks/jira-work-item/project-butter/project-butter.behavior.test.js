const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");

const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const { JIRA_WORK_ITEM_DETAIL } = require("../../../../app/data/details/blocks/jira-work-item.ts");
const { reorderProjectButterPanels, PROJECT_BUTTER_PANEL_ORDER } = require("./panel-order.ts");

test("one catalog demo opens each presentation directly and keeps its Empty setting", async () => {
	assert.deepEqual(JIRA_WORK_ITEM_DETAIL.examples.filter((example) => example.demoSlug.startsWith("jira-work-item-demo-project-butter")).map((example) => example.title), ["Project butter"]);
	const view = await renderComponent({
		entry: "components/website/demos/blocks/jira-work-item-project-butter-demo.tsx",
		exportName: "ProjectButterDemo",
		mocks: {
			"@/components/blocks/jira-work-item": `import React from "react";
				export default function JiraWorkItem({ projectButterPresentation, initialExperimentalPreset, onIssueClose }) {
					return <div role="dialog" aria-label={projectButterPresentation}><p>{initialExperimentalPreset}</p><button type="button" onClick={onIssueClose}>Close work item</button></div>;
				}`,
		},
	});
	assert.equal(view.queryByRole("button", { name: "Open Project butter" }) === null, true);
	assert.equal(view.getByRole("switch", { name: "Suggestion" }).getAttribute("aria-checked"), "false");
	for (const empty of [false, true]) {
		if (empty) await view.click(view.getByRole("switch", { name: "Empty" }));
		assert.equal(view.queryByRole("dialog"), null, "the Empty toggle must not launch a work item");
		for (const [label, presentation] of [["Full screen", "full-screen"], ["Modal", "modal"], ["Side panel", "side-panel"]]) {
			const button = view.getByRole("button", { name: label });
			assert.equal(button.getAttribute("aria-pressed"), null, "presentation buttons launch rather than toggle selection");
			await view.click(button);
			assert.equal(view.queryByRole("dialog", { name: presentation }) !== null, true);
			assert.equal(view.queryByText(empty ? "empty" : "filled") !== null, true);
			await view.click(view.getByRole("button", { name: "Close work item" }));
		}
	}
});

async function commentEditor(view) {
	const trigger = view.queryByRole("button", { name: "Add a comment" });
	if (trigger) await view.click(trigger);
	else if (!view.queryByRole("textbox", { name: "Comment editor" })) await view.press(document.body, "m");
	return view.getByRole("textbox", { name: "Comment editor" });
}

async function openSession(view, name) {
	if (!view.queryByRole("dialog", { name: "Agent sessions" })) await view.click(view.getByRole("button", { name: /^Working on this work item\./u }));
	const menu = view.getByRole("dialog", { name: "Agent sessions" });
	const titles = { Claude: "Review Teamwork onboarding guide", "Jira Coding agent": "Draft billing flow PRD", Codex: "Review rollback" };
	const row = [...menu.querySelectorAll("li")].find((item) => item.textContent.includes(titles[name] ?? name));
	assert.ok(row, `No session for ${name}`);
	await view.click(row.querySelector("button"));
}

function renderWorkItem(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
				export const useRovoChatControls = () => controls;
				export const useOptionalRovoChatControls = () => controls;
				export const useOptionalRovoChat = () => null;`,
		},
		props: { initialPreset: "filled", onClose() {}, open: true, ...props },
	});
}

test("Project butter shows the reference sessions and keeps replies scoped to each session", async () => {
	const view = await renderWorkItem();
	assert.equal(view.queryByRole("complementary", { name: "Product navigation" }) !== null, true);
	assert.equal(document.querySelector('div[aria-label="Product navigation"]:not([role])') === null, true);
	assert.equal(view.queryByText("Draft billing flow PRD") !== null, true);
	assert.equal(view.queryByRole("button", { name: "Open Jira Scoping agent chat" }) !== null, true);
	assert.equal(view.queryByText("Review Teamwork onboarding guide") !== null, true);
	await view.click(view.getByRole("button", { name: /^Draft billing flow PRD/u }));
	await view.fill(view.getByRole("textbox", { name: "Reply to Jira Coding agent" }), "Ship the MVP path first");
	await openSession(view, "Claude");
	await view.fill(view.getByRole("textbox", { name: "Reply to Claude" }), "Focus on first-run setup");
	await openSession(view, "Jira Coding agent");
	assert.equal(view.getByRole("textbox", { name: "Reply to Jira Coding agent" }).value, "Ship the MVP path first");
	await view.click(view.getByRole("button", { name: "Send reply" }));
	assert.equal(view.getByRole("textbox", { name: "Reply to Jira Coding agent" }).value, "");
	assert.equal(view.queryByText("Ship the MVP path first") !== null, true);
	await openSession(view, "Claude");
	assert.equal(view.getByRole("textbox", { name: "Reply to Claude" }).value, "Focus on first-run setup");
	assert.equal(view.queryByText("Ship the MVP path first") === null, true);
});

test("Butter board activation opens the selected item and preserves edits separately for each card", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { useButterWorkItem } from "@/components/projects/butter/hooks/use-butter-work-item";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			const alpha = { code: "PAY-118", title: "First board item", priority: "major", tags: [], assignee: { id: "owner", name: "Board owner" },
				agentActivities: [{ id: "coding", name: "Claude", label: "Inspect payment calls", message: "Review the payment inventory", state: "awaiting-input", host: "cloud" }] };
			const beta = { code: "PAY-119", title: "Second board item", priority: "minor", tags: [],
				agentActivities: [{ id: "coding", name: "Codex", label: "Review rollback", message: "Check rollback safety", state: "working", host: "cloud" }] };
			const gamma = { code: "PAY-120", title: "Third board item", priority: "medium", tags: [] };
			const critical = { code: "PAY-121", title: "Critical board item", priority: "critical", tags: [] };
			export default function BoardProbe() {
				const item = useButterWorkItem();
				return <ThemeWrapper><SidebarProvider>
					<button onClick={() => item.openWorkItem(alpha, "To do")}>Open first card</button>
					<button onClick={() => item.openWorkItem(beta, "Done")}>Open second card</button>
					<button onClick={() => item.openWorkItem(gamma, "To do")}>Open third card</button>
					<button onClick={() => item.openWorkItem(critical, "In progress")}>Open critical card</button>
					{item.selection ? <ProjectButterJiraWorkItem {...item.selection} initialPreset="filled" initialPresentation="modal" shell="project" open={item.open} onClose={item.closeWorkItem} /> : null}
				</SidebarProvider></ThemeWrapper>;
			}`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
				export const useRovoChatControls = () => controls;
				export const useOptionalRovoChatControls = () => controls;
				export const useOptionalRovoChat = () => null;`,
		},
	});
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.click(view.getByRole("button", { name: "Open first card" }));
	assert.equal(view.queryByRole("heading", { name: "First board item" }) !== null, true);
	assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), "modal");
	assert.equal(view.queryByRole("complementary", { name: "Product navigation" }) === null, true);
	assert.equal(document.querySelectorAll('[data-slot="dialog-overlay"]').length, 1);
	assert.equal(view.getByRole("dialog", { name: "Project butter" }).getAttribute("aria-modal"), "true");
	assert.equal(view.queryByText("PAY-118") !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change status, To do" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change priority. Current priority: High" }) !== null, true);
	assert.equal(view.queryByText("Board owner") !== null, true);
	assert.equal(view.queryByText("Draft billing flow PRD") === null, true);
	assert.equal(view.queryByRole("button", { name: /Working on this work item\. Board owner, Working\. Claude, Needs input/u }) !== null, true);
	assert.equal(view.queryByText("Sarah Lim") === null, true);
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "First card saved scope");
	await view.focus(view.getByRole("button", { name: "Description" }));
	await view.click(view.getByRole("button", { name: /^Inspect payment calls/u }));
	await view.fill(view.getByRole("textbox", { name: "Reply to Claude" }), "First card reply draft");
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.click(view.getByRole("button", { name: "Open second card" }));
	assert.equal(view.queryByRole("heading", { name: "Second board item" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change status, Done" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change priority. Current priority: Low" }) !== null, true);
	assert.equal(view.queryByText("First card saved scope") === null, true);
	await openSession(view, "Codex");
	assert.equal(view.getByRole("textbox", { name: "Reply to Codex" }).value, "");
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.click(view.getByRole("button", { name: "Open first card" }));
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "First card saved scope");
	assert.equal(view.getByRole("textbox", { name: "Reply to Claude" }).value, "First card reply draft");
	await view.press(document.body, "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Reply to Claude" }) === null, true);
	await view.press(document.body, "Escape");
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.click(view.getByRole("button", { name: "Open third card" }));
	await view.click(view.getByRole("button", { name: "Start coding" }));
	assert.equal(view.getAllByRole("heading", { name: "Work on PAY-120" }).length > 0, true);
	assert.equal(view.queryByText("Ready to work on PAY-120.") !== null, true);
	assert.equal(view.queryByText("Draft billing flow PRD") === null, true);
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.click(view.getByRole("button", { name: "Open critical card" }));
	assert.equal(view.queryByRole("heading", { name: "Critical board item" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change priority. Current priority: Highest" }) !== null, true);
});

test("modal header centers the issue key with collapse and close", async () => {
	const view = await renderWorkItem({
		initialPresentation: "modal",
		shell: "project",
		workItem: { code: "PAY-118", title: "First board item" },
	});
	const row = document.querySelector("[data-project-butter-header-key-row]");
	const summary = view.getByRole("textbox", { name: "Work item summary" });
	assert.equal(row !== null, true);
	assert.match(row.className, /\bitems-center\b/);
	const key = view.getByRole("button", { name: "Copy work item key" });
	assert.equal(row.contains(key), true);
	const storyIcon = key.closest("[data-slot='breadcrumb-item']").querySelector("[aria-label='Story']");
	assert.match(storyIcon.parentElement.className, /\binline-flex\b/);
	assert.match(storyIcon.parentElement.className, /\bitems-center\b/);
	assert.match(storyIcon.parentElement.className, /\bleading-none\b/);
	assert.equal(row.contains(view.getByRole("button", { name: "Collapse work item" })), true);
	assert.equal(row.contains(view.getByRole("button", { name: "Close Project butter work item" })), true);
	assert.match(summary.className, /\bh-8\b/);
	assert.equal(summary.className.includes("hover:bg-bg-neutral-subtle-hovered"), false);
	await view.click(view.getByRole("button", { name: "Collapse work item" }));
	assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), "side-panel");
});

test("full screen keeps the issue key row without collapse or close and still closes on Escape", async () => {
	let closed = 0;
	const view = await renderWorkItem({
		initialPresentation: "full-screen",
		onClose: () => { closed += 1; },
		shell: "project",
		workItem: { code: "PAY-118", title: "First board item" },
	});
	assert.equal(view.queryByRole("button", { name: "Copy work item key" }) !== null, true);
	assert.equal(view.queryByText("PAY-118") !== null, true);
	assert.equal(view.queryByRole("button", { name: "Collapse work item" }) === null, true);
	assert.equal(view.queryByRole("button", { name: "Close Project butter work item" }) === null, true);
	await view.press(document.body, "Escape");
	assert.equal(closed, 1);
});

test("side panel header expands back to the modal with an icon button", async () => {
	const view = await renderWorkItem({ initialPresentation: "side-panel" });
	assert.equal(view.queryByRole("button", { name: "Full screen" }) === null, true);
	assert.equal(view.queryByRole("button", { name: "Expand work item" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Close Project butter work item" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Expand work item" }));
	assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), "modal");
});

test("side panel renders its chrome through the shared Panel and modal does not", async () => {
	let closed = 0;
	const view = await renderWorkItem({ initialPresentation: "side-panel", onClose: () => { closed += 1; } });
	const panel = document.querySelector('section[aria-label="Work item side panel view"]');
	assert.equal(panel.getAttribute("data-slot"), "panel-container");
	const header = panel.querySelector('[data-slot="panel-header"]');
	assert.equal(header?.querySelector('[data-slot="panel-title"]')?.textContent, "Jira work item");
	for (const name of ["Expand work item", "Close Project butter work item"]) {
		const action = view.getByRole("button", { name });
		assert.equal(action.getAttribute("data-slot"), "panel-action");
		assert.equal(header.contains(action), true);
	}
	assert.equal(view.getAllByRole("button", { name: "Close Project butter work item" }).length, 1);
	assert.equal(panel.contains(view.getByRole("textbox", { name: "Work item summary" })), true);
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	assert.equal(closed, 1);
});

test("modal keeps its own header outside the shared Panel", async () => {
	await renderWorkItem({ initialPresentation: "modal" });
	assert.equal(document.querySelector('[data-slot="panel-container"]'), null);
	assert.equal(document.querySelector('section[aria-label="Work item modal view"]') !== null, true);
});

test("board work item actions omit unsupported deep links and keep key copying available", async () => {
	const view = await renderWorkItem({
		initialPresentation: "modal",
		shell: "project",
		workItem: { code: "PAY-118", title: "First board item" },
	});
	assert.equal(view.queryByRole("button", { name: "Copy work item key" }) !== null, true);
	await view.click(view.getByRole("button", { name: "More work item actions" }));
	assert.equal(view.queryByRole("menuitem", { name: "Copy link" }) === null, true);
	assert.equal(view.queryByRole("menuitemcheckbox", { name: "Watch work item" }) !== null, true);
	assert.equal(view.queryByRole("menuitemcheckbox", { name: "Flag work item" }) !== null, true);
});

test("empty Project butter can create a coding session", async () => {
	const view = await renderWorkItem({ initialPreset: "empty" });
	assert.equal(view.queryByText("Draft billing flow PRD") === null, true);
	await view.click(view.getByRole("button", { name: "Start coding" }));
	assert.equal(view.queryByRole("textbox", { name: "Reply to Jira Coding agent" }) !== null, true);
	assert.equal(view.queryByText("No agent sessions yet. Start coding to begin work on this item.") === null, true);
});

test("activity header keeps only the more-actions menu in both states", async () => {
	for (const initialPreset of ["filled", "empty"]) {
		const view = await renderWorkItem({ initialPreset });
		assert.equal(view.queryByRole("button", { name: /^(Collapse|Expand) activity$/u }), null);
		assert.equal(view.queryByRole("button", { name: "More activity actions" }) !== null, true);
		await view.unmount();
	}
});

test("empty Project butter shows the reference empty layout without placeholder copy", async () => {
	const view = await renderWorkItem({ initialPreset: "empty", initialPresentation: "modal", shell: "project" });
	assert.equal(view.queryByText("No activity yet. Add a comment or an agent to get started."), null);
	assert.equal(view.queryByRole("button", { name: "Description" }), null);
	assert.equal(view.queryByRole("textbox", { name: "Work item description" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Add a comment" }) !== null, true);
});

test("empty secondary actions stay reachable by Tab without a prior hover", async () => {
	const view = await renderWorkItem({ initialPreset: "empty", initialPresentation: "modal", shell: "project" });
	const order = view.tabOrder();
	const index = order.indexOf("Attachment");
	assert.equal(index > 0, true, "the Attachment quick action must stay in the tab order while visually hidden");
	assert.deepEqual(order.slice(index, index + 3), ["Attachment", "Subtask", "Linked work"]);
	await view.focus(document.body);
	for (let step = 0; step <= index; step += 1) await view.press(null, "Tab");
	assert.equal(view.isFocused(view.getByRole("button", { name: "Attachment" })), true);
	await view.press(null, "Enter");
	assert.equal(document.querySelector('[data-related-type="attachments"]') !== null, true, "Enter opens the Attachments group");
});

test("clicking the description suppresses the focus ring that keyboard focus keeps", async () => {
	const view = await renderWorkItem();
	const editor = () => view.getByRole("group", { name: "Description editor" });
	const textbox = () => view.getByRole("textbox", { name: "Work item description" });
	assert.equal(editor().className.includes("focus-within:"), false);
	assert.equal(editor().hasAttribute("data-pointer-focused"), false);
	await view.click(textbox());
	assert.equal(view.isFocused(textbox()), true);
	assert.equal(editor().hasAttribute("data-pointer-focused"), true);
	await view.focus(view.getByRole("button", { name: "Description" }));
	assert.equal(editor().hasAttribute("data-pointer-focused"), false);
	await view.focus(textbox());
	assert.equal(view.isFocused(textbox()), true);
	assert.equal(editor().hasAttribute("data-pointer-focused"), false);
});

test("description edits and comment drafts survive closing and reopening the work item", async () => {
	const view = await renderWorkItem();
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Updated onboarding scope");
	await view.focus(view.getByRole("button", { name: "Description" }));
	await view.fill(await commentEditor(view), "Keep this draft");
	await view.rerender({ initialPreset: "filled", onClose() {}, open: false });
	await view.rerender({ initialPreset: "filled", onClose() {}, open: true });
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "Updated onboarding scope");
	assert.equal((await commentEditor(view)).textContent, "Keep this draft");
	await view.click(view.getByRole("button", { name: "Save comment" }));
	assert.equal(view.queryByText("Keep this draft") !== null, true);
	assert.equal((await commentEditor(view)).textContent, "");
});

test("branch metadata stays opt-in for existing agent session consumers", async () => {
	const item = { agent: { name: "Coding agent" }, branch: "feature/onboarding", id: "coding", state: "needs-input", title: "Draft the PRD", timeLabel: "19 May" };
	const view = await renderComponent({
		entry: "components/blocks/agent-session/index.tsx",
		exportName: "AgentSession",
		props: { items: [item], density: "long", variant: "large" },
	});
	assert.equal(view.queryByText("feature/onboarding") === null, true);
	await view.rerender({ items: [item], density: "long", variant: "large", showBranch: true });
	assert.equal(view.queryByText("feature/onboarding") !== null, true);
});

for (const presentation of ["full-screen", "modal", "side-panel"]) {
	for (const empty of [false, true]) {
		test(`${presentation} supports Empty ${empty ? "on" : "off"} through the global settings cog`, async () => {
			const view = await renderWorkItem({ initialPresentation: presentation, initialPreset: empty ? "empty" : "filled" });
			assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), presentation);
			assert.equal(document.querySelector('section[aria-label="Needs input"]') !== null, !empty);
			assert.equal(view.queryByRole("button", { name: `Change status, ${empty ? "To do" : "In progress"}` }) !== null, true);
			await view.click(view.getByRole("button", { name: "Settings" }));
			assert.equal(document.querySelectorAll('[data-slot="dialog-overlay"]').length, 2, "nested settings must render their own backdrop above the prototype");
			assert.equal(view.getByRole("switch", { name: "Empty" }).getAttribute("aria-checked"), String(empty));
			await view.click(view.getByRole("switch", { name: "Empty" }));
			await view.click(view.getByRole("button", { name: "View prototype" }));
			assert.equal(document.querySelector('section[aria-label="Needs input"]') !== null, empty);
			assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), presentation);
		});
	}
}

test("switching presentation and Empty preserves saved edits and clears dismissed comment drafts", async () => {
	const view = await renderWorkItem();
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Keep this scope");
	await view.focus(view.getByRole("button", { name: "Description" }));
	await view.fill(await commentEditor(view), "Keep this comment draft");
	await view.click(view.getByRole("button", { name: "Settings" }));
	await view.click(view.getByRole("button", { name: "Side panel" }));
	await view.click(view.getByRole("switch", { name: "Empty" }));
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "");
	assert.equal((await commentEditor(view)).textContent, "");
	await view.click(view.getByRole("button", { name: "Settings" }));
	await view.click(view.getByRole("switch", { name: "Empty" }));
	await view.click(view.getByRole("button", { name: "Modal" }));
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "Keep this scope");
	assert.equal((await commentEditor(view)).textContent, "");
});

test("attachment stacks expand independently and Escape returns focus without closing the work item", async () => {
	const view = await renderWorkItem();
	const documents = view.getByRole("button", { name: "Documents, 4 attachments" });
	assert.equal(documents.getAttribute("aria-expanded"), "false");
	assert.equal(view.tabOrder().includes("More actions for Q1 Marketing Strategy & Goals"), false, "piled cards are inert");
	assert.equal(view.tabOrder().includes("More actions for Hero Image - Summer Launch.png"), true, "single cards keep their actions");
	await view.click(documents);
	assert.equal(view.getByRole("button", { name: "Close documents" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.tabOrder().includes("More actions for Q1 Marketing Strategy & Goals"), true);
	await view.click(view.getByRole("button", { name: "Videos, 2 attachments" }));
	const video = view.getByRole("button", { name: "More actions for Team Offsite Recap" });
	await view.focus(video);
	await view.press(video, "Escape");
	assert.equal(view.queryByRole("dialog", { name: "Project butter" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Close documents" }) !== null, true);
	assert.equal(view.tabOrder().includes("More actions for Team Offsite Recap"), false);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Videos, 2 attachments" })), true);
	await view.click(view.getByRole("button", { name: "Close documents" }));
	assert.equal(view.tabOrder().includes("More actions for Q1 Marketing Strategy & Goals"), false);
});

test("attachments can be added as links and removed through the reference confirmation without losing others", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	const input = view.getByRole("combobox", { name: "Add attachment" });
	await view.fill(input, "https://example.com/design");
	assert.deepEqual([...view.getByRole("listbox", { name: "Matching attachments" }).querySelectorAll("[role=option]")].map((option) => option.textContent), ['Add link "Design"']);
	await act(async () => input.form.requestSubmit());
	await view.click(view.getByRole("button", { name: "Links, 2 attachments" }));
	assert.equal(document.querySelector("[data-attachment-arrival]") !== null, true, "the new card plays its arrival and stays inert meanwhile");
	assert.equal(view.queryByRole("button", { name: "More actions for Design" }), null);
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); });
	assert.equal(document.querySelector("[data-attachment-arrival]"), null);
	assert.equal(view.queryByRole("button", { name: /^Preview /u }), null, "cards have no preview");
	await view.click(view.getByRole("button", { name: "More actions for Design" }));
	await view.click(view.getByRole("menuitem", { name: "Remove" }));
	assert.equal(view.getByRole("dialog", { name: "Remove content?" }).textContent.includes("Once removed, it'll no longer appear in this work item."), true);
	await view.click(view.getByRole("button", { name: "Remove" }));
	assert.equal(view.queryByRole("button", { name: "More actions for Design" }), null);
	assert.equal(view.queryByRole("button", { name: "Documents, 4 attachments" }) !== null, true);
	assert.equal(view.queryByRole("dialog", { name: "Project butter" }) !== null, true);
});

test("panel ordering changes only for valid panel drops and keeps source data immutable", () => {
	const order = Object.freeze([...PROJECT_BUTTER_PANEL_ORDER]);
	assert.deepEqual(reorderProjectButterPanels(order, "development", "details"), ["development", "details", "automation", "apps"]);
	assert.deepEqual([...order], ["details", "development", "automation", "apps"]);
	assert.equal(reorderProjectButterPanels(order, "outside", "details"), order);
	assert.equal(reorderProjectButterPanels(order, "development", null), order);
});

test("panel controls remain reachable while collapsed and development settings change visible fields", async () => {
	const view = await renderWorkItem();
	assert.equal(view.tabOrder().includes("Drag to reorder Automation"), true);
	await view.click(view.getByRole("button", { name: "Development settings" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Show branches" }));
	await view.press(null, "Escape");
	assert.equal(view.queryByText("No branches linked") !== null, true);
	await view.click(view.getByRole("button", { name: "Automation" }));
	assert.equal(view.queryByText("Send reminder 24 hours before due date") !== null, true);
});

test("Details expands from an accessible chevron footer and hides that control with the panel", async () => {
	const view = await renderWorkItem();
	const expand = view.getByRole("button", { name: "Show more details" });
	assert.equal(expand.textContent.trim(), "");
	assert.equal(expand.getAttribute("aria-expanded"), "false");
	await view.click(expand);
	assert.equal(view.queryByRole("button", { name: "Change reporter" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "Show less details" }).getAttribute("aria-expanded"), "true");
	await view.click(view.getByRole("button", { name: "Details" }));
	assert.equal(view.queryByRole("button", { name: "Show less details" }) === null, true);
	await view.click(view.getByRole("button", { name: "Details" }));
	await view.click(view.getByRole("button", { name: "Show less details" }));
	assert.equal(view.queryByRole("button", { name: "Change reporter" }) === null, true);
});

test("keyboard panel dragging receives arrow keys and Escape cancels without closing the work item", async () => {
	let closed = false;
	const view = await renderWorkItem({ onClose() { closed = true; } });
	const handle = view.getByRole("button", { name: "Drag to reorder Development" });
	await view.press(handle, " ", { code: "Space" });
	assert.equal(handle.getAttribute("aria-pressed"), "true");
	let arrowReceived = false;
	const listen = (event) => { if (event.code === "ArrowUp") arrowReceived = true; };
	document.addEventListener("keydown", listen);
	try {
		await view.press(handle, "ArrowUp", { code: "ArrowUp" });
		assert.equal(arrowReceived, true);
		await view.press(handle, "Escape", { code: "Escape" });
		assert.equal(closed, false);
		assert.notEqual(handle.getAttribute("aria-pressed"), "true");
	} finally {
		document.removeEventListener("keydown", listen);
	}
});

test("Activity and Audit separate comments from paginated field history", async () => {
	const view = await renderWorkItem();
	assert.equal(document.querySelector('section[aria-label="Needs input"]') !== null, true);
	assert.equal(document.querySelectorAll("[data-project-butter-activity] [data-jira-activity-entry-id]").length, 8);
	assert.equal(view.queryByRole("button", { name: /Liam Estrada updated 2 fields/u }) === null, true);
	await view.click(view.getByRole("tab", { name: "Audit" }));
	assert.equal(document.querySelector('section[aria-label="Needs input"]'), null);
	assert.equal(document.querySelectorAll("[data-project-butter-activity] [data-jira-activity-entry-id]").length, 10);
	await view.click(view.getByRole("button", { name: "Show more audit updates" }));
	assert.equal(document.querySelectorAll("[data-project-butter-activity] [data-jira-activity-entry-id]").length, 20);
	await view.click(view.getByRole("tab", { name: /Activity/u }));
	assert.equal(document.querySelectorAll("[data-project-butter-activity] [data-jira-activity-entry-id]").length, 8);
});

test("activity order and scrubber follow timestamps in both directions", async () => {
	const view = await renderWorkItem();
	const labels = () => [...document.querySelectorAll('[aria-label="Navigate activity"] [role="option"]')].map((item) => item.textContent);
	const newest = labels();
	assert.match(newest[0], /Annie Cook: Visuals are looking strong/u);
	assert.match(newest.at(-1), /Annie Cook: First round of email nurture/u);
	await view.click(view.getByRole("button", { name: "More activity actions" }));
	await view.click(view.getByRole("menuitemradio", { name: "Oldest first" }));
	const oldest = labels();
	assert.match(oldest[0], /Annie Cook: First round of email nurture/u);
	assert.match(oldest.at(-1), /Annie Cook: Visuals are looking strong/u);
	assert.equal(oldest.length, newest.length);
});

test("activity navigation scrolls its content owner without moving the work item shell", async (t) => {
	const view = await renderWorkItem();
	const shell = document.querySelector("[data-project-butter-presentation] > section");
	const scrollport = document.querySelector("[data-project-butter-work-item]").firstElementChild;
	const row = document.querySelector("[data-project-butter-activity] [data-jira-activity-entry-id]");
	scrollport.style.overflowY = "auto";
	scrollport.scrollTop = 120;
	t.mock.method(scrollport, "getBoundingClientRect", () => ({ top: 200 }));
	t.mock.method(row, "getBoundingClientRect", () => ({ top: 500 }));
	const calls = [];
	t.mock.method(scrollport, "scrollTo", (options) => calls.push(options));
	await view.click(view.getAllByRole("option")[0]);
	assert.deepEqual(calls, [{ top: 308, behavior: "auto" }]);
	assert.equal(shell.scrollTop, 0);
});

test("typing M in the summary or its descendants keeps focus in the summary", async () => {
	const view = await renderWorkItem({ initialPresentation: "modal", shell: "project" });
	const summary = view.getByRole("textbox", { name: "Work item summary" });
	await view.focus(summary);
	await view.press(summary, "m");
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }) === null, true);
	assert.equal(view.isFocused(summary), true);
	const nested = document.createElement("span");
	summary.append(nested);
	await view.press(nested, "M");
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }) === null, true);
	assert.equal(view.isFocused(summary), true);
	await view.focus(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.press(null, "m");
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }) !== null, true);
});

test("related composers dismiss outside their row inside the work item dialog and retain nested picker interactions", async () => {
	const view = await renderWorkItem({ initialPresentation: "modal", shell: "project" });
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	const linked = view.getByRole("combobox", { name: "Add linked work" });
	await view.fill(linked, "analytics events");
	await view.click(view.getByRole("button", { name: "Relationship for the new linked work item: Clones. Edit" }));
	await view.click(view.getByRole("menuitem", { name: "Blocks" }));
	assert.equal(view.getByRole("combobox", { name: "Add linked work" }).value, "analytics events");
	await view.focus(linked);
	await view.click(view.getByRole("option", { name: /VITA-12Add analytics events for onboarding steps/u }));
	assert.equal(view.queryByRole("button", { name: "Edit relationship for VITA-12: Blocks. Edit" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	await view.fill(view.getByRole("combobox", { name: "Create child work item" }), "Keep the unfinished child");
	await view.click(view.getByRole("button", { name: "Description" }));
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 180)); });
	assert.equal(view.queryByRole("combobox", { name: "Create child work item" }) === null, true);
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	assert.equal(view.getByRole("combobox", { name: "Create child work item" }).value, "", "an outside dismiss drops the uncommitted query (reference parity)");
});

test("the source comment editor opens with M, clears cancelled drafts, resizes, and saves with the keyboard", async () => {
	let closed = false;
	const view = await renderWorkItem({ onClose() { closed = true; } });
	assert.equal(view.queryByRole("button", { name: "Add a comment" }) === null, true);
	await view.focus(view.getByRole("button", { name: "More work item actions" }));
	await view.press(null, "m");
	const editor = await commentEditor(view);
	assert.equal(view.getByRole("button", { name: "Save comment" }).disabled, true);
	assert.equal(view.queryByRole("button", { name: "Bold" }) !== null, true);
	await view.fill(editor, "Discard this draft");
	await view.press(editor, "Escape");
	assert.equal(closed, false);
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }) === null, true);
	const reopened = await commentEditor(view);
	assert.equal(reopened.textContent, "");
	const handle = view.getByRole("separator", { name: "Resize comment editor" });
	await view.press(handle, "Home");
	assert.equal(handle.getAttribute("aria-valuenow"), "144");
	await view.press(handle, "ArrowUp");
	assert.equal(handle.getAttribute("aria-valuenow"), "168");
	await view.press(handle, "End");
	assert.equal(handle.getAttribute("aria-valuenow"), handle.getAttribute("aria-valuemax"));
	await view.fill(reopened, "Keep the onboarding recovery copy");
	await view.press(reopened, "Enter", { ctrlKey: true });
	assert.equal(view.queryByText("Keep the onboarding recovery copy") !== null, true);
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }) === null, true);
});

test("outside click and the toolbar close control dismiss and clear the source editor", async () => {
	const view = await renderWorkItem();
	await view.fill(await commentEditor(view), "Do not publish this");
	await view.click(view.getByRole("button", { name: "Development" }));
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }) === null, true);
	assert.equal((await commentEditor(view)).textContent, "");
	await view.fill(view.getByRole("textbox", { name: "Comment editor" }), "Another discarded draft");
	await view.click(view.getByRole("button", { name: "Close comment editor" }));
	assert.equal((await commentEditor(view)).textContent, "");
	assert.equal(view.queryByText("Do not publish this") === null, true);
});

test("header and Details share status options and custom status updates", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Change status, In progress" }));
	assert.equal(view.queryByRole("menuitem", { name: "In progress" }) === null, true);
	await view.click(view.getByRole("menuitem", { name: "Done" }));
	assert.equal(view.queryByRole("button", { name: "Change status, Done" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Change status in details, Done" }));
	await view.click(view.getByRole("menuitem", { name: "Create status" }));
	await view.fill(view.getByRole("textbox", { name: "Status name" }), "In review");
	await view.click(view.getByRole("button", { name: "Create and apply" }));
	assert.equal(view.queryByRole("button", { name: "Change status, In review" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change status in details, In review" }) !== null, true);
	await view.click(view.getByRole("button", { name: "More work item actions" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Watch work item" }));
	await view.press(null, "Escape");
	await view.click(view.getByRole("button", { name: "More work item actions" }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Watch work item" }).getAttribute("aria-checked"), "true");
});


test("new audit records and comment replies survive changing activity views", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Change status, In progress" }));
	await view.click(view.getByRole("menuitem", { name: "Done" }));
	await view.click(view.getByRole("tab", { name: "Audit" }));
	await view.click(view.getByRole("button", { name: /Annie Cook\s*updated status\s*Just now/u }));
	const change = document.querySelector("[data-project-butter-activity] dl").textContent;
	assert.equal(change.includes("In progress"), true);
	assert.equal(change.includes("Done"), true);
	await view.click(view.getByRole("tab", { name: /Activity/u }));
	await view.click(view.getAllByRole("button", { name: "Reply" })[0]);
	await view.fill(view.getByRole("textbox", { name: "Leave a reply..." }), "Keep the reply draft");
	await view.click(view.getByRole("tab", { name: "Audit" }));
	await view.click(view.getByRole("tab", { name: /Activity/u }));
	await view.click(view.getAllByRole("button", { name: "Reply" })[0]);
	assert.equal(view.getByRole("textbox", { name: "Leave a reply..." }).textContent, "Keep the reply draft");
	await view.click(view.getByRole("button", { name: "Submit" }));
	assert.equal(view.queryByText("Keep the reply draft") !== null, true);
	await view.click(view.getByRole("tab", { name: "Audit" }));
	assert.equal(view.queryByRole("button", { name: /Annie Cook\s*updated status\s*Just now/u }) !== null, true);
	await view.fill(await commentEditor(view), "Posted from Audit");
	await view.click(view.getByRole("button", { name: "Save comment" }));
	assert.equal(view.getByRole("tab", { name: /Activity/u }).getAttribute("aria-selected"), "true");
	assert.equal(view.queryByText("Posted from Audit") !== null, true);
});

test("own comments can be edited and deleted with both actions recorded in Audit", async () => {
	const view = await renderWorkItem();
	await view.click(view.getAllByRole("button", { name: "Edit comment" })[0]);
	await view.fill(view.getByRole("textbox", { name: "Edit comment body" }), "Updated campaign review");
	await view.click(view.getByRole("button", { name: "Save comment" }));
	assert.equal(view.queryByText("Updated campaign review") !== null, true);
	await view.click(view.getAllByRole("button", { name: "More comment actions" })[0]);
	await view.click(view.getByRole("menuitem", { name: "Delete comment" }));
	assert.equal(view.queryByText("Updated campaign review") === null, true);
	await view.click(view.getByRole("tab", { name: "Audit" }));
	assert.equal(view.getAllByRole("button", { name: /Annie Cook\s*updated comment\s*Just now/u }).length, 2);
});


test("pinned local sessions open the work item chat directly", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: /^Review Teamwork onboarding guide/u }));
	assert.equal(view.queryByRole("textbox", { name: "Reply to Claude" }) !== null, true);
	assert.equal(view.queryByRole("menuitem", { name: "Terminal" }) === null, true);
	await view.press(document.body, "Escape");
	assert.equal(view.queryByRole("textbox", { name: "Reply to Claude" }) === null, true);
	assert.equal(view.queryByRole("dialog", { name: "Project butter" }) !== null, true);
});


test("timeline hover previews and continuous pointer seeking follow the click position", async (t) => {
	const { act } = require("react");
	const view = await renderComponent({
		source: `import React from "react";
			import {useTransform} from "motion/react";
			import {useProjectButterActivityNavigation} from "@/components/blocks/jira-work-item/project-butter/use-activity-navigation";
			import {ScrubberRail} from "@/components/blocks/scrubber/components/scrubber-rail";
			const entries = Array.from({length:8}, (_, index) => ({id:String(index)}));
			export default function Navigation({count=8,view="Activity"}) {
				const items = React.useMemo(()=>entries.slice(0,count),[count]);
				const navigation = useProjectButterActivityNavigation(items, false, null, view);
				const offset = useTransform(navigation.progress, (value) => 0.02 + value * 0.96);
				const marks = items.map((entry, index) => ({...entry, label:entry.id, heading:entry.id, kind:"minor", offset:0.02+(navigation.entryOffsets[entry.id] ?? index/7)*0.96}));
				return <div data-test-scroll-root style={{overflowY:"auto",height:600}}>
					<div data-project-butter-activity-header ref={navigation.headerRef} />
					<div data-project-butter-activity-timeline ref={navigation.timelineRef}><ScrubberRail activeIndex={Math.max(0,items.findIndex((entry)=>entry.id===navigation.visibleId))} activeOffset={offset} entries={marks} onSelect={navigation.scrollToEntry} onSeek={(value)=>navigation.seekToProgress((value-0.02)/0.96)} appearance="dots" selectionMode="drag" ariaLabel="Navigate activity" showPill={false} /></div>
					<div data-project-butter-activity-feed ref={navigation.feedRef}>{items.map((entry)=><div data-jira-activity-entry-id={entry.id} key={entry.id}>{entry.id}</div>)}</div>
				</div>;
			}`,
	});
	const root = document.querySelector("[data-test-scroll-root]");
	const feed = document.querySelector("[data-project-butter-activity-feed]");
	const header = document.querySelector("[data-project-butter-activity-header]");
	const timeline = document.querySelector("[data-project-butter-activity-timeline]");
	const rail = timeline.querySelector('[data-slot="scrubber-rail"]');
	const rows = [...feed.querySelectorAll("[data-jira-activity-entry-id]")];
	root.style.overflowY = "auto";
	root.scrollTop = 1000;
	Object.defineProperty(root, "clientHeight", { configurable: true, value: 600 });
	t.mock.method(root, "getBoundingClientRect", () => ({ top: 100, bottom: 700, height: 600 }));
	let headerTop = 100;
	t.mock.method(header, "getBoundingClientRect", () => ({ top:headerTop, height: 56 }));
	t.mock.method(timeline, "getBoundingClientRect", () => ({ height: 44 }));
	let feedHeight = 1600;
	t.mock.method(feed, "getBoundingClientRect", () => ({ top: 1212 - root.scrollTop, bottom: 1212 + feedHeight - root.scrollTop, height: feedHeight }));
	t.mock.method(rail, "getBoundingClientRect", () => ({ left: 0, top: 0, width: 1000, height: 14 }));
	for (const [index, row] of rows.entries()) {
		t.mock.method(row, "getBoundingClientRect", () => ({ top: 1212 + index * 200 - root.scrollTop, bottom: 1412 + index * 200 - root.scrollTop, height: 200 }));
	}
	Object.defineProperty(rail, "setPointerCapture", { configurable: true, value() {} });
	const calls = [];
	t.mock.method(root, "scrollTo", (options) => { calls.push(options.top); root.scrollTop = options.top; root.dispatchEvent(new Event("scroll")); });
	async function settle(action) {
		await act(async () => { action(); await new Promise((resolve) => setTimeout(resolve, 80)); });
	}
	await settle(() => root.dispatchEvent(new Event("scroll")));
	await settle(() => rail.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: 650, buttons: 0 })));
	const hover = rail.querySelector('[data-slot="scrubber-hover"]');
	assert.equal(hover.style.opacity, "1");
	assert.equal(hover.style.left, "65%");
	assert.equal(calls.length, 0, "hover must not move the feed");
	await settle(() => rail.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", pointerId: 7, clientX: 650, button: 0, buttons: 1 })));
	assert.equal(Math.abs(calls.at(-1) - 1729.75) < 0.1, true);
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 65) < 0.1, true);
	await settle(() => rail.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", pointerId: 7, clientX: 800, buttons: 1 })));
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 80) < 0.1, true);
	root.scrollTop = 1556;
	await settle(() => root.dispatchEvent(new Event("scroll")));
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 50) < 0.1, true, rail.querySelector('[data-slot="scrubber-playhead"]').style.left);
	feedHeight = 544;
	root.scrollTop = 1000;
	headerTop = 180;
	await view.rerender({count:1,view:"Audit"});
	assert.equal(root.scrollTop, 1080, "switching to a shorter feed must preserve the sticky header");
	headerTop = 100;
	await settle(() => root.dispatchEvent(new Event("scroll")));
	await settle(() => rail.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", pointerId: 8, clientX: 650, button: 0, buttons: 1 })));
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 65) < 0.1, true, "short feeds must retain continuous seeking");
});


test("suggestion state proposes empty details fields and accepts or dismisses one at a time", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	assert.equal(document.querySelector("[data-project-butter-state]")?.getAttribute("data-project-butter-state"), "suggestion");
	const suggestions = view.getByRole("button", { name: /8 Suggestions/u });
	assert.equal(suggestions.getAttribute("aria-expanded"), "false");
	assert.equal(view.queryByRole("list", { name: "Suggested field values" }), null);
	assert.equal(view.queryByRole("button", { name: "Accept all" }), null);
	assert.equal(view.queryByRole("button", { name: "Accept Due Date suggestion" }), null);
	await view.click(suggestions);
	assert.equal(suggestions.getAttribute("aria-expanded"), "true");
	assert.equal(view.queryByRole("list", { name: "Suggested field values" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Accept all" }) !== null, true);
	assert.equal(view.queryByText("Dec 15, 2026") !== null, true);
	await view.click(suggestions);
	assert.equal(suggestions.getAttribute("aria-expanded"), "false");
	assert.equal(view.queryByRole("button", { name: "Accept all" }), null);
	await view.click(suggestions);
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "8");
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "false");
	await view.click(view.getByRole("button", { name: "Accept Due Date suggestion" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "7");
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "false");
	await view.click(view.getByRole("button", { name: "Dismiss Reporter suggestion" }));
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "6");
	assert.equal(document.querySelector('[data-field-id="reporter"]')?.getAttribute("data-field-filled"), "false");
});

const SUGGESTION_FIELD_ORDER = ["dueDate", "parent", "labels", "components", "fixVersion", "acceptanceCriteria", "reporter", "costCenter"];

function detailRailOrder() {
	return [...document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id], [data-project-butter-detail-fields] [data-project-butter-suggestion-cursor]")].map((node) => node.getAttribute("data-field-id") ?? "filling-bar");
}

async function acceptAllSuggestions(view) {
	await view.click(view.getByRole("button", { name: /8 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept all" }));
}

function assertFilledInRailOrder() {
	assert.deepEqual(detailRailOrder().slice(0, 11), ["status", "assignee", "priority", ...SUGGESTION_FIELD_ORDER]);
	assert.equal(SUGGESTION_FIELD_ORDER.every((field) => document.querySelector(`[data-field-id="${field}"]`)?.getAttribute("data-field-filled") === "true"), true);
}

test("Accept all walks the filling bar down the rail one field at a time and keeps the field order", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await acceptAllSuggestions(view);
	const barSlots = [];
	const filledState = (field) => document.querySelector(`[data-field-id="${field}"]`)?.getAttribute("data-field-filled");
	for (let waited = 0; !view.queryByText("8 updated") && waited < 10_000; waited += 25) {
		const rail = detailRailOrder();
		const slot = rail.indexOf("filling-bar");
		if (slot > 0 && barSlots.at(-1) !== rail[slot - 1]) {
			barSlots.push(rail[slot - 1]);
			assert.equal(filledState(rail[slot - 1]), "true", "the row above the bar has been filled");
			if (SUGGESTION_FIELD_ORDER.includes(rail[slot + 1])) assert.equal(filledState(rail[slot + 1]), "false", "rows below the bar wait their turn");
		}
		await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
	}
	assert.deepEqual(barSlots, ["priority", ...SUGGESTION_FIELD_ORDER], "the bar enters below the last filled field, then moves below each suggestion in rail order");
	assert.equal(view.queryByText("8 updated") !== null, true);
	assert.equal(detailRailOrder().includes("filling-bar"), false);
	assertFilledInRailOrder();
});

test("the suggestion banner keeps one Teamwork Graph loader from loading to resting and back", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	const loader = () => document.querySelector('[data-slot="twg-loader"][aria-label="Teamwork Graph"]');
	const waitForState = async (state) => {
		for (let waited = 0; loader()?.getAttribute("data-state") !== state && waited < 10_000; waited += 50) {
			await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
		}
		return loader()?.getAttribute("data-state");
	};
	const original = loader();
	assert.equal(original !== null, true);
	assert.equal(await waitForState("resting"), "resting", "the intro settles to rest");
	await acceptAllSuggestions(view);
	assert.equal(await waitForState("loading"), "loading");
	assert.equal(loader() === original, true, "starting to fill keeps the resting loader");
	assert.equal(await waitForState("resting"), "resting");
	assert.equal(view.queryByText("8 updated") !== null, true);
	assert.equal(loader() === original, true, "the review banner keeps the loader that was filling");
	await view.click(view.getByRole("button", { name: "Undo" }));
	assert.equal(loader() === original, true, "undo keeps the same loader");
	await acceptAllSuggestions(view);
	assert.equal(await waitForState("loading"), "loading");
	assert.equal(loader() === original, true, "filling again resumes the same loader");
	await view.unmount();
});

test("Accept all under reduced motion fills instantly without the filling bar", async () => {
	const matchMedia = window.matchMedia;
	window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	try {
		const view = await renderWorkItem({ initialSuggestion: true });
		await acceptAllSuggestions(view);
		assert.equal(view.queryByText("8 updated") !== null, true);
		assert.equal(detailRailOrder().includes("filling-bar"), false);
		assertFilledInRailOrder();
		await view.unmount();
	} finally {
		window.matchMedia = matchMedia;
	}
});

test("settings can switch Project butter into the suggestion state", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Settings" }));
	assert.equal(view.getByRole("switch", { name: "Suggestion" }).getAttribute("aria-checked"), "false");
	await view.click(view.getByRole("switch", { name: "Suggestion" }));
	assert.equal(view.getByRole("switch", { name: "Empty" }).getAttribute("aria-checked"), "false");
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.equal(document.querySelector("[data-project-butter-state]")?.getAttribute("data-project-butter-state"), "suggestion");
	assert.equal(view.queryByRole("button", { name: "Accept Parent suggestion" }), null);
	await view.click(view.getByRole("button", { name: /Suggestions/u }));
	assert.equal(view.queryByRole("button", { name: "Accept Parent suggestion" }) !== null, true);
});

test("Butter timestamps disclose an exact date, time, and timezone on focus and retain format toggling", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/activity-comment-tools.tsx",
		exportName: "ProjectButterTimestamp",
		props: { item: { id: "comment", kind: "comment", actor: { id: "annie", name: "Annie Cook", kind: "person" }, body: [], timestamp: "45 minutes ago", createdAtMs: Date.UTC(2026, 10, 1, 15) } },
	});
	const trigger = view.getByRole("button", { name: "45 minutes ago. Show full timestamp" });
	assert.equal(trigger.querySelector("time").getAttribute("datetime"), "2026-11-01T15:00:00.000Z");
	await view.focus(trigger);
	const tooltip = view.getByRole("tooltip");
	assert.equal(trigger.getAttribute("aria-describedby"), tooltip.id);
	const details = tooltip.textContent;
	assert.equal(details.includes("Sunday, November 1, 2026"), true);
	assert.equal(details.includes("23:00:00"), true);
	assert.equal(details.includes("GMT+8"), true);
	await view.click(trigger);
	assert.equal(trigger.textContent.includes("Nov 1, 2026"), true);
	assert.equal(trigger.getAttribute("aria-pressed"), "true");
	await view.click(trigger);
	assert.equal(trigger.textContent, "45 minutes ago");
});
