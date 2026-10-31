const assert = require("node:assert/strict");
const test = require("node:test");

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
	assert.equal(view.queryByRole("button", { name: "Open Project butter" }), null);
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
	if (!view.queryByRole("button", { name: `Open ${name} session` })) await view.click(view.getByRole("button", { name: /^Working on this work item\./u }));
	await view.click(view.getByRole("button", { name: `Open ${name} session` }));
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
	assert.equal(view.queryByText("Troubleshoot 403 API errors") !== null, true);
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
	assert.equal(view.queryByText("Ship the MVP path first"), null);
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
					{item.selection ? <ProjectButterJiraWorkItem {...item.selection} initialPreset="filled" open={item.open} onClose={item.closeWorkItem} /> : null}
				</SidebarProvider></ThemeWrapper>;
			}`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
				export const useRovoChatControls = () => controls;
				export const useOptionalRovoChatControls = () => controls;
				export const useOptionalRovoChat = () => null;`,
		},
	});
	assert.equal(view.queryByRole("dialog"), null);
	await view.click(view.getByRole("button", { name: "Open first card" }));
	assert.equal(view.queryByRole("heading", { name: "First board item" }) !== null, true);
	assert.equal(view.queryByText("PAY-118") !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change status, To do" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change priority. Current priority: High" }) !== null, true);
	assert.equal(view.queryByText("Board owner") !== null, true);
	assert.equal(view.queryByText("Draft billing flow PRD"), null);
	assert.equal(view.queryByRole("button", { name: /Working on this work item\. Board owner, Working\. Claude, Needs input/u }) !== null, true);
	assert.equal(view.queryByText("Sarah Lim"), null);
	await view.click(view.getByRole("button", { name: "Edit description" }));
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "First card saved scope");
	await view.click(view.getByRole("button", { name: "Save" }));
	await view.click(view.getByRole("button", { name: /^Inspect payment calls/u }));
	await view.fill(view.getByRole("textbox", { name: "Reply to Claude" }), "First card reply draft");
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	assert.equal(view.queryByRole("dialog"), null);
	await view.click(view.getByRole("button", { name: "Open second card" }));
	assert.equal(view.queryByRole("heading", { name: "Second board item" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change status, Done" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change priority. Current priority: Low" }) !== null, true);
	assert.equal(view.queryByText("First card saved scope"), null);
	await view.click(view.getByRole("button", { name: /^Review rollback/u }));
	assert.equal(view.getByRole("textbox", { name: "Reply to Codex" }).value, "");
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.click(view.getByRole("button", { name: "Open first card" }));
	assert.equal(view.getByRole("button", { name: "Edit description" }).textContent, "First card saved scope");
	assert.equal(view.getByRole("textbox", { name: "Reply to Claude" }).value, "First card reply draft");
	await view.press(document.body, "Escape");
	assert.equal(view.queryByRole("dialog"), null);
	await view.click(view.getByRole("button", { name: "Open third card" }));
	await view.click(view.getByRole("button", { name: "Add agent" }));
	assert.equal(view.queryByRole("heading", { name: "Work on PAY-120" }) !== null, true);
	assert.equal(view.queryByText("Ready to work on PAY-120.") !== null, true);
	assert.equal(view.queryByText("Draft billing flow PRD"), null);
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.click(view.getByRole("button", { name: "Open critical card" }));
	assert.equal(view.queryByRole("heading", { name: "Critical board item" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change priority. Current priority: Highest" }) !== null, true);
});

test("empty Project butter can create a coding session", async () => {
	const view = await renderWorkItem({ initialPreset: "empty" });
	assert.equal(view.queryByText("Draft billing flow PRD"), null);
	await view.click(view.getByRole("button", { name: "Add agent" }));
	assert.equal(view.queryByRole("textbox", { name: "Reply to Jira Coding agent" }) !== null, true);
	assert.equal(view.queryByText("No agent sessions yet. Start coding to begin work on this item."), null);
});

test("description edits and comment drafts survive closing and reopening the work item", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Edit description" }));
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Updated onboarding scope");
	await view.click(view.getByRole("button", { name: "Save" }));
	await view.fill(await commentEditor(view), "Keep this draft");
	await view.rerender({ initialPreset: "filled", onClose() {}, open: false });
	await view.rerender({ initialPreset: "filled", onClose() {}, open: true });
	assert.equal(view.getByRole("button", { name: "Edit description" }).textContent, "Updated onboarding scope");
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
	assert.equal(view.queryByText("feature/onboarding"), null);
	await view.rerender({ items: [item], density: "long", variant: "large", showBranch: true });
	assert.equal(view.queryByText("feature/onboarding") !== null, true);
});

for (const presentation of ["full-screen", "modal", "side-panel"]) {
	for (const empty of [false, true]) {
		test(`${presentation} supports Empty ${empty ? "on" : "off"} through the global settings cog`, async () => {
			const view = await renderWorkItem({ initialPresentation: presentation, initialPreset: empty ? "empty" : "filled" });
			assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), presentation);
			assert.equal(view.queryByRole("heading", { name: "Agent sessions" }) !== null, !empty);
			assert.equal(view.queryByRole("button", { name: `Change status, ${empty ? "To do" : "In progress"}` }) !== null, true);
			await view.click(view.getByRole("button", { name: "Settings" }));
			assert.equal(document.querySelectorAll('[data-slot="dialog-overlay"]').length, 2, "nested settings must render their own backdrop above the prototype");
			assert.equal(view.getByRole("switch", { name: "Empty" }).getAttribute("aria-checked"), String(empty));
			await view.click(view.getByRole("switch", { name: "Empty" }));
			await view.click(view.getByRole("button", { name: "View prototype" }));
			assert.equal(view.queryByRole("heading", { name: "Agent sessions" }) !== null, empty);
			assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), presentation);
		});
	}
}

test("switching presentation and Empty preserves saved edits and clears dismissed comment drafts", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Edit description" }));
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Keep this scope");
	await view.click(view.getByRole("button", { name: "Save" }));
	await view.fill(await commentEditor(view), "Keep this comment draft");
	await view.click(view.getByRole("button", { name: "Settings" }));
	await view.click(view.getByRole("button", { name: "Side panel" }));
	await view.click(view.getByRole("switch", { name: "Empty" }));
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.equal(view.getByRole("button", { name: "Edit description" }).textContent, "Add description");
	assert.equal((await commentEditor(view)).textContent, "");
	await view.click(view.getByRole("button", { name: "Settings" }));
	await view.click(view.getByRole("switch", { name: "Empty" }));
	await view.click(view.getByRole("button", { name: "Modal" }));
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.equal(view.getByRole("button", { name: "Edit description" }).textContent, "Keep this scope");
	assert.equal((await commentEditor(view)).textContent, "");
});

test("attachments paginate and filter with keyboard-reachable row actions", async () => {
	const view = await renderWorkItem();
	const section = document.querySelector('section[aria-label="Attachments"]');
	const rowCount = () => section.querySelectorAll('ul[aria-label="Attachments"] > li').length;
	assert.equal(rowCount(), 5);
	assert.equal(view.tabOrder().includes("More actions for Q1 Marketing Strategy & Goals"), true);
	const showMore = view.getAllByRole("button", { name: "Show 3 more" }).find((button) => section.contains(button));
	await view.click(showMore);
	assert.equal(rowCount(), 8);
	await view.click(view.getByRole("tab", { name: "Images" }));
	assert.equal(rowCount(), 1);
	assert.equal(section.textContent.includes("Hero Image - Summer Launch.png"), true);
	await view.click(view.getByRole("tab", { name: "Videos" }));
	assert.equal(rowCount(), 2);
	await view.click(view.getByRole("tab", { name: "All" }));
	assert.equal(rowCount(), 5);
});

test("attachments can be added, previewed, and removed without losing other attachments", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	await view.fill(view.getByRole("textbox", { name: "Attachment name or URL" }), "https://example.com/design");
	await view.click(document.querySelector('section[aria-label="Attachments"] button[type="submit"]'));
	await view.click(view.getByRole("button", { name: "https://example.com/design" }));
	assert.equal(view.getByRole("link", { name: "Open link" }).getAttribute("href"), "https://example.com/design");
	await view.click(view.getByRole("button", { name: "Close" }));
	await view.click(view.getByRole("button", { name: "More actions for https://example.com/design" }));
	await view.click(view.getByRole("menuitem", { name: "Remove" }));
	await view.click(view.getByRole("button", { name: "Remove" }));
	assert.equal(view.queryByRole("button", { name: "https://example.com/design" }), null);
	assert.equal(view.queryByRole("button", { name: "Q1 Marketing Strategy & Goals" }) !== null, true);
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
	assert.equal(view.queryByRole("button", { name: "Show less details" }), null);
	await view.click(view.getByRole("button", { name: "Details" }));
	await view.click(view.getByRole("button", { name: "Show less details" }));
	assert.equal(view.queryByRole("button", { name: "Change reporter" }), null);
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

test("activity navigation and filters operate on the populated reference feed", async () => {
	const view = await renderWorkItem();
	assert.equal(view.queryByRole("heading", { name: "Session summary" }) !== null, true);
	const options = view.getAllByRole("option");
	assert.equal(options.length > 40, true);
	const total = options.length;
	await view.press(options[0], "End");
	assert.equal(options.at(-1).getAttribute("aria-selected"), "true");
	await view.click(view.getByRole("button", { name: "More activity actions" }));
	await view.click(view.getByRole("menuitemradio", { name: "Comments" }));
	assert.equal(view.getAllByRole("option").length, 9);
	await view.press(null, "Escape");
	await view.click(view.getByRole("button", { name: "More activity actions" }));
	await view.click(view.getByRole("menuitemradio", { name: "History" }));
	assert.equal(view.getAllByRole("option").length, total - 9);
	assert.equal(view.queryByRole("heading", { name: "Session summary" }), null);
	await view.press(null, "Escape");
	await view.click(view.getByRole("button", { name: "More activity actions" }));
	await view.click(view.getByRole("menuitemradio", { name: "All activity" }));
	assert.equal(view.getAllByRole("option").length, total);
});

test("activity order and timeline follow timestamps in both directions", async () => {
	const view = await renderWorkItem();
	let options = view.getAllByRole("option");
	assert.match(options[0].textContent, /Liam Estrada: updated 2 fields/u);
	assert.match(options.at(-1).textContent, /Claude with Annie Cook: Published the Teamwork onboarding inventory/u);
	await view.click(view.getByRole("button", { name: "More activity actions" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Newest first" }));
	options = view.getAllByRole("option");
	assert.match(options[0].textContent, /Claude with Annie Cook: Published the Teamwork onboarding inventory/u);
	assert.match(options.at(-1).textContent, /Liam Estrada: updated 2 fields/u);
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
	assert.deepEqual(calls, [{ top: 356, behavior: "auto" }]);
	assert.equal(shell.scrollTop, 0);
});

test("the source comment editor opens with M, clears cancelled drafts, resizes, and saves with the keyboard", async () => {
	let closed = false;
	const view = await renderWorkItem({ onClose() { closed = true; } });
	assert.equal(view.queryByRole("button", { name: "Add a comment" }), null);
	await view.focus(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.press(null, "m");
	const editor = await commentEditor(view);
	assert.equal(view.getByRole("button", { name: "Save comment" }).disabled, true);
	assert.equal(view.queryByRole("button", { name: "Bold" }) !== null, true);
	await view.fill(editor, "Discard this draft");
	await view.press(editor, "Escape");
	assert.equal(closed, false);
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }), null);
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
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }), null);
});

test("outside click and the toolbar close control dismiss and clear the source editor", async () => {
	const view = await renderWorkItem();
	await view.fill(await commentEditor(view), "Do not publish this");
	await view.click(view.getByRole("button", { name: "Development" }));
	assert.equal(view.queryByRole("textbox", { name: "Comment editor" }), null);
	assert.equal((await commentEditor(view)).textContent, "");
	await view.fill(view.getByRole("textbox", { name: "Comment editor" }), "Another discarded draft");
	await view.click(view.getByRole("button", { name: "Close comment editor" }));
	assert.equal((await commentEditor(view)).textContent, "");
	assert.equal(view.queryByText("Do not publish this"), null);
});

test("status changes use the matching treatment and watching updates the count", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Change status, In progress" }));
	await view.click(view.getByRole("menuitem", { name: "Done" }));
	assert.equal(view.queryByRole("button", { name: "Change status, Done" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Watch work item. 4 watchers" }));
	assert.equal(view.getByRole("button", { name: "Stop watching work item. 5 watchers" }).getAttribute("aria-pressed"), "true");
});
