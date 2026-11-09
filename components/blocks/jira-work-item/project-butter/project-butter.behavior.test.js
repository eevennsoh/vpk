const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");

const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const { JIRA_WORK_ITEM_DETAIL } = require("../../../../app/data/details/blocks/jira-work-item.ts");
const { reorderProjectButterPanels, PROJECT_BUTTER_PANEL_ORDER } = require("./panel-order.ts");

test("Butter chat keeps the selected session's agent identity", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { BUTTER_CHAT_AGENT_PROFILES, resolveButterChatAgentId } from "@/components/projects/butter/data/chat-agent-profiles";
			import { PROJECT_BUTTER_SESSIONS } from "@/components/blocks/jira-work-item/project-butter/data";
			export default function ProfileProbe() {
				return <>{PROJECT_BUTTER_SESSIONS.filter((session) => session.host === "cloud").map((session) => {
					const id = resolveButterChatAgentId(session.agent, session.id);
					const profile = BUTTER_CHAT_AGENT_PROFILES.find((candidate) => candidate.id === id);
					return <output key={id}>{session.agent.name.toLowerCase()}:{profile?.name.toLowerCase()}</output>;
				})}</>;
			}`,
	});
	assert.equal(view.queryByText("jira scoping agent:jira scoping agent") !== null, true);
	assert.equal(view.queryByText("jira coding agent:jira coding agent") !== null, true);
});

test("the Agents field loader matches the selector's artwork and brand canvases", async () => {
	const names = ["Jira Coding Agent", "Claude", "Cursor", "Codex", "GitHub Copilot"];
	const view = await renderComponent({
		source: `import React, { useState } from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterCrew } from "@/components/blocks/jira-work-item/project-butter/project-butter-crew";
			export default function AvatarProbe({ name }) {
				const [selected, setSelected] = useState(null);
				const sessions = [name, "Other"].map((agentName, index) => ({ id: index ? "other" : "target", agent: { name: agentName }, title: agentName, host: "cloud", state: "running", timeLabel: "Now" }));
				return <ThemeWrapper><ProjectButterCrew field sessions={sessions} onOpenSession={setSelected} onStartAgent={setSelected} /><output>{selected?.name ?? selected?.title}</output></ThemeWrapper>;
			}`,
		props: { name: names[0] },
	});
	const visual = (avatar) => ({
		images: [...avatar.querySelectorAll("img")].map((image) => image.getAttribute("src")),
		paths: [...avatar.querySelectorAll("svg path")].map((path) => path.getAttribute("d")),
		canvases: [...avatar.querySelectorAll("[style]")].map((element) => element.style.backgroundColor).filter(Boolean),
	});
	for (const name of names) {
		await view.rerender({ name });
		const field = view.getByRole("group", { name: "Agents field" });
		const stacked = field.querySelector('[data-agent-id="target"] [data-slot="avatar"]');
		assert.notEqual(stacked, null, `${name} appears in the loader`);
		const stackVisual = visual(stacked);
		await view.click(field.querySelector("button"));
		const picker = view.getByRole("dialog", { name: "Add agent" });
		const option = [...picker.querySelectorAll("button[data-agent-id]")].find((button) => button.textContent.includes(name));
		assert.notEqual(option, undefined, `${name} appears in the selector`);
		assert.deepEqual(stackVisual, visual(option.querySelector('[data-slot="avatar"]')), name);
		await view.click(field.querySelector("button"));
	}
});

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
			// The demo hosts the real sidebar chat; its CSS modules don't bundle here and it isn't under test.
			"@/components/projects/sidebar-chat/page": `export default function ChatPanel() { return null; }`,
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

test("the catalog's top preview opens Project butter with its Rovo chat host", async () => {
	const workItemMock = `import React from "react";
		export default function JiraWorkItem({ variant, projectButterChat, onIssueClose }) {
			return <div role="dialog" aria-label={variant}>{projectButterChat ? <p>Hosted chat</p> : null}{projectButterChat?.panel}<button type="button" onClick={onIssueClose}>Close work item</button></div>;
		}`;
	const view = await renderComponent({
		entry: "components/website/demos/blocks/jira-work-item-demo.tsx",
		mocks: {
			// The page imports "./index"; both specifiers resolve to the mocked block.
			"@/components/blocks/jira-work-item": workItemMock,
			"@/components/blocks/jira-work-item/index": workItemMock,
			"@/components/projects/sidebar-chat/page": `export default function ChatPanel() { return null; }`,
		},
	});
	await view.click(view.getByRole("button", { name: "Open Project butter session" }));
	assert.equal(view.queryByRole("dialog", { name: "project-butter" }) !== null, true);
	assert.equal(view.queryByText("Hosted chat") !== null, true, "the top preview must give Project butter its chat host so Ask Rovo shows");
	await view.click(view.getByRole("button", { name: "Close work item" }));
	await view.click(view.getByRole("button", { name: "Open experimental session" }));
	assert.equal(view.queryByRole("dialog", { name: "experimental" }) !== null, true);
	assert.equal(view.queryByText("Hosted chat"), null, "other variants keep their own chat");
});

/** Opens every collapsed "N updates" row so individual changes are reachable. */
async function expandUpdates(view) {
	for (const button of [...document.querySelectorAll('[data-project-butter-update-group] button[aria-expanded="false"]')]) await view.click(button);
}

/** The feed pages 10 rows at a time; older session threads sit behind "Show more activity". */
async function showAllActivity(view) {
	for (let more = view.queryByRole("button", { name: "Show more activity" }); more; more = view.queryByRole("button", { name: "Show more activity" })) await view.click(more);
}

const feedIds = () => [...document.querySelectorAll("[data-project-butter-activity-feed] > div > ol > li")].map((row) => row.getAttribute("data-jira-activity-entry-id"));

const commentBarVisible = () => document.querySelector("[data-project-butter-comment-bar]")?.getAttribute("data-visible") === "true";

/** The comment box is always mounted; M reveals and focuses it when it is tucked away. */
async function commentEditor(view) {
	if (!commentBarVisible()) await view.press(document.body, "m");
	return view.getByRole("textbox", { name: "Comment editor" });
}

async function openSession(view, name) {
	const field = view.getByRole("group", { name: "Agents field" });
	const trigger = field.querySelector("button");
	assert.ok(trigger);
	await view.click(trigger);
	const menu = view.getByRole("dialog", { name: "Add agent" });
	const titles = { Claude: "Review Teamwork onboarding guide", "Jira Coding agent": "Draft billing flow PRD", "Jira Scoping agent": "Troubleshoot 403 API errors", Codex: "Review rollback" };
	await view.click([...menu.querySelectorAll("button[data-agent-id]")].find((button) => button.textContent.toLowerCase().includes(name.toLowerCase())));
	const title = titles[name] ?? name;
	const action = [...menu.querySelectorAll("button")].find((button) => button.textContent.trim() === title);
	assert.ok(action, `Session action ${title} appears in the agent selector`);
	await view.click(action);
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

test("a host chat shows Ask Rovo and receives agent session links instead of the floating session card", async () => {
	const opened = [];
	globalThis.__butterOpened = opened;
	const view = await renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem({ hosted = true }) {
				return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem chatPanel={hosted ? <aside aria-label="Host chat" /> : undefined} initialPreset="filled" onClose={() => {}} onOpenCloudSession={hosted ? (session) => { globalThis.__butterOpened.push(session.id); return true; } : undefined} open /></SidebarProvider></ThemeWrapper>;
			}`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
				export const useRovoChatControls = () => controls;
				export const useOptionalRovoChatControls = () => controls;
				export const useOptionalRovoChat = () => null;`,
		},
	});
	assert.equal(view.queryByRole("button", { name: "Ask Rovo" }) !== null, true, "a host chat exposes the global Ask Rovo pill");
	assert.equal(document.querySelector('aside[aria-label="Host chat"]') !== null, true, "the host chat mounts beside the work item");
	await view.click(view.getByRole("button", { name: /^Compare the Q3 revenue forecast/u }));
	assert.deepEqual(opened, ["butter-cursor-forecast"]);
	assert.equal(view.queryByRole("textbox", { name: "Reply to Cursor" }), null, "the floating session card must not open when a host owns the chat");
	await view.rerender({ hosted: false });
	assert.equal(view.queryByRole("button", { name: "Ask Rovo" }), null, "without a host chat there is nothing for Ask Rovo to open");
	await view.click(view.getByRole("button", { name: /^Compare the Q3 revenue forecast/u }));
	assert.equal(view.queryByRole("textbox", { name: "Reply to Cursor" }) !== null, true, "without a host the floating card stays the fallback");
	delete globalThis.__butterOpened;
});

test("Project butter shows the reference sessions and keeps replies scoped to each session", async () => {
	const view = await renderWorkItem();
	assert.equal(view.queryByRole("complementary", { name: "Product navigation" }) !== null, true);
	assert.equal(document.querySelector('div[aria-label="Product navigation"]:not([role])') === null, true);
	await showAllActivity(view);
	assert.equal(view.queryByText("Draft billing flow PRD") !== null, true);
	assert.equal(view.queryByRole("button", { name: /^Troubleshoot 403 API errors/u }) !== null, true);
	assert.equal(view.queryByText("Review Teamwork onboarding guide") !== null, true);
	await view.click(view.getByRole("button", { name: /^Draft billing flow PRD/u }));
	await view.fill(view.getByRole("textbox", { name: "Reply to Jira Coding agent" }), "Ship the MVP path first");
	await openSession(view, "Jira Scoping agent");
	await view.fill(view.getByRole("textbox", { name: "Reply to Jira Scoping agent" }), "Focus on first-run setup");
	await openSession(view, "Jira Coding agent");
	assert.equal(view.getByRole("textbox", { name: "Reply to Jira Coding agent" }).value, "Ship the MVP path first");
	await view.click(view.getByRole("button", { name: "Send reply" }));
	assert.equal(view.getByRole("textbox", { name: "Reply to Jira Coding agent" }).value, "");
	assert.equal(view.queryByText("Ship the MVP path first") !== null, true);
	await openSession(view, "Jira Scoping agent");
	assert.equal(view.getByRole("textbox", { name: "Reply to Jira Scoping agent" }).value, "Focus on first-run setup");
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
	assert.equal(view.queryByRole("group", { name: "Agents field" }) !== null, true);
	assert.equal(view.queryByText("Sarah Lim") === null, true);
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "First card saved scope");
	await view.focus(view.getByRole("button", { name: "Description" }));
	await showAllActivity(view);
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
	await view.click(view.getByRole("button", { name: "Configure repository" }));
	assert.equal(view.queryByRole("menuitem", { name: "Bitbucket Cloud" }) !== null, true);
	assert.equal(view.queryByText("Ready to work on PAY-120."), null);
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
	for (const name of ["Log work", "Add flag", "Start watching (4)", "Add vote (2)", "Add restriction", "Select cover", "Classify work item", "Clone", "Move", "Convert to subtask", /Open command palette/u, "Archive", "Delete", "Connect Slack channel", "Print", "Export to", "Share", "Give feedback", "Switch to classic experience"]) {
		const item = view.getByRole("menuitem", { name });
		assert.notEqual(item.getAttribute("aria-disabled"), "true", String(name));
	}
});

test("empty Project butter opens the configure repository menu", async () => {
	const view = await renderWorkItem({ initialPreset: "empty" });
	assert.equal(view.queryByText("Draft billing flow PRD") === null, true);
	await view.click(view.getByRole("button", { name: "Configure repository" }));
	assert.equal(view.queryByRole("menuitem", { name: "Bitbucket Cloud" }) !== null, true);
	assert.equal(view.queryByRole("textbox", { name: "Reply to Jira Coding agent" }), null);
});

test("activity header keeps only the filter menu in both states", async () => {
	for (const initialPreset of ["filled", "empty"]) {
		const view = await renderWorkItem({ initialPreset });
		assert.equal(view.queryByRole("button", { name: /^(Collapse|Expand) activity$/u }), null);
		assert.equal(view.queryByRole("tablist", { name: "Activity views" }) === null, true);
		assert.equal(view.queryByRole("button", { name: "Filter activity" }) !== null, true);
		await view.unmount();
	}
});

test("empty Project butter shows the reference empty layout without placeholder copy", async () => {
	const view = await renderWorkItem({ initialPreset: "empty", initialPresentation: "modal", shell: "project" });
	assert.equal(view.queryByText("No activity yet. Add a comment or an agent to get started."), null);
	assert.equal(view.queryByRole("button", { name: "Description" }), null);
	assert.equal(view.queryByRole("textbox", { name: "Work item description" }) !== null, true);
	assert.equal(commentBarVisible(), true);
	assert.equal(view.queryByRole("button", { name: "Mention an agent or person" }) !== null, true);
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
	await view.click(view.getByRole("button", { name: "Submit" }));
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
			const needsInputThread = () => document.querySelector('[data-jira-activity-entry-id="invocation-butter-claude"]') !== null;
			assert.equal(needsInputThread(), !empty);
			assert.equal(view.queryByRole("button", { name: `Change status, ${empty ? "To do" : "In progress"}` }) !== null, true);
			await view.click(view.getByRole("button", { name: "Settings" }));
			assert.equal(document.querySelectorAll('[data-slot="dialog-overlay"]').length, 2, "nested settings must render their own backdrop above the prototype");
			assert.equal(view.getByRole("switch", { name: "Empty" }).getAttribute("aria-checked"), String(empty));
			await view.click(view.getByRole("switch", { name: "Empty" }));
			await view.click(view.getByRole("button", { name: "View prototype" }));
			assert.equal(needsInputThread(), empty);
			assert.equal(document.querySelector("[data-project-butter-presentation]")?.getAttribute("data-project-butter-presentation"), presentation);
		});
	}
}

test("switching presentation and Empty keeps saved edits and comment drafts scoped to each preset", async () => {
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
	assert.equal((await commentEditor(view)).textContent, "Keep this comment draft");
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

test("panel controls remain reachable while collapsed and development settings show connections", async () => {
	const view = await renderWorkItem();
	assert.equal(view.tabOrder().includes("Drag to reorder Automation"), true);
	await view.click(view.getByRole("button", { name: "Configure", exact: true }));
	await view.focus(view.getByRole("menuitem", { name: "Connections", exact: true }));
	await view.press(null, "ArrowRight");
	assert.equal(view.queryByRole("button", { name: "Request GitLab for Jira Cloud" }) !== null, true);
	await view.press(null, "Escape");
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

test("one Activity feed pages rows and filters updates, agent sessions, and comments", async () => {
	const view = await renderWorkItem();
	assert.equal(view.queryByRole("tab", { name: "Audit" }) === null, true);
	assert.equal(feedIds().length, 10);
	assert.equal(feedIds()[0], "invocation-butter-claude", "the newest session thread leads, needs-input included");
	assert.equal(document.querySelectorAll("[data-project-butter-update-group]").length > 0, true, "adjacent field changes fold into one summary row");
	await view.click(view.getByRole("button", { name: "Show more activity" }));
	assert.equal(feedIds().length, 20);
	await view.click(view.getByRole("button", { name: "Filter activity" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Updates" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Agent sessions" }));
	assert.equal(document.querySelectorAll('[data-project-butter-activity-feed] [data-jira-activity-entry-kind="event"]').length, 0);
	assert.equal(feedIds().some((id) => id.startsWith("invocation-")), false);
	assert.equal(feedIds().every((id) => document.querySelector(`[data-jira-activity-entry-id="${id}"]`).dataset.jiraActivityEntryKind === "comment"), true);
	await view.click(view.getByRole("menuitemcheckbox", { name: "Updates" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Agent sessions" }));
	assert.equal(feedIds()[0], "invocation-butter-claude");
});

test("activity order follows timestamps in both directions", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Filter activity" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Updates" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Agent sessions" }));
	const text = (id) => document.querySelector(`[data-jira-activity-entry-id="${id}"]`).textContent;
	const newest = feedIds();
	assert.match(text(newest[0]), /Visuals are looking strong/u);
	assert.match(text(newest.at(-1)), /First round of email nurture/u);
	await view.click(view.getByRole("menuitemradio", { name: "Oldest first" }));
	const oldest = feedIds();
	assert.match(text(oldest[0]), /First round of email nurture/u);
	assert.match(text(oldest.at(-1)), /Visuals are looking strong/u);
	assert.equal(oldest.length, newest.length);
	const stops = [...document.querySelectorAll('[aria-label="Navigate activity"] [role="option"]')].map((item) => item.textContent);
	assert.equal(stops.length, oldest.length, "one timeline stop per rendered row");
	assert.match(stops[0], /First round of email nurture/u);
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
	// 120 + 500 - 200, less the reading line: the 64px header (timeline inline) plus 12px clearance.
	assert.deepEqual(calls, [{ top: 344, behavior: "auto" }]);
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

test("the compact comment composer opens with M, clears cancelled drafts, and saves with the keyboard", async () => {
	let closed = false;
	const view = await renderWorkItem({ onClose() { closed = true; } });
	assert.equal(commentBarVisible(), false);
	await view.focus(view.getByRole("button", { name: "More work item actions" }));
	await view.press(null, "m");
	assert.equal(commentBarVisible(), true);
	const editor = view.getByRole("textbox", { name: "Comment editor" });
	assert.equal(view.getByRole("button", { name: "Submit" }).disabled, true);
	assert.equal(view.queryByRole("button", { name: "Mention an agent or person" }) !== null, true);
	await view.fill(editor, "Discard this draft");
	assert.equal(view.getByRole("button", { name: "Submit" }).disabled, false);
	await view.press(editor, "Escape");
	assert.equal(closed, false);
	assert.equal(commentBarVisible(), false);
	const reopened = await commentEditor(view);
	assert.equal(reopened.textContent, "");
	await view.fill(reopened, "Keep the onboarding recovery copy");
	await view.press(reopened, "Enter");
	assert.equal(document.querySelector("[data-project-butter-activity-feed]").textContent.includes("Keep the onboarding recovery copy"), true);
	// Posting tucks the bar away again with an empty draft.
	assert.equal(commentBarVisible(), false);
	assert.equal(view.getByRole("textbox", { name: "Comment editor", hidden: true }).textContent, "");
});

test("outside click preserves the comment draft and explicit cancel clears it", async () => {
	const view = await renderWorkItem();
	await view.fill(await commentEditor(view), "Do not publish this");
	await view.click(view.getByRole("button", { name: "Development" }));
	assert.equal(commentBarVisible(), false);
	assert.equal((await commentEditor(view)).textContent, "Do not publish this");
	await view.fill(view.getByRole("textbox", { name: "Comment editor" }), "Another discarded draft");
	await view.press(view.getByRole("textbox", { name: "Comment editor" }), "Escape");
	assert.equal((await commentEditor(view)).textContent, "");
	assert.equal(view.queryByText("Do not publish this") === null, true);
});

test("closing and reopening the work item preserves its unsubmitted comment", async () => {
	const props = { initialPreset: "filled", initialPresentation: "modal", shell: "project", onClose() {}, open: true };
	const view = await renderWorkItem(props);
	await view.fill(await commentEditor(view), "Keep this unfinished merchant note");
	await view.click(view.getByRole("button", { name: "Close Project butter work item" }));
	await view.rerender({ ...props, open: false });
	await view.rerender(props);
	assert.equal((await commentEditor(view)).textContent, "Keep this unfinished merchant note");
	await view.click(view.getByRole("button", { name: "Submit" }));
	assert.equal(view.queryByText("Keep this unfinished merchant note") !== null, true);
});

test("reopened comment drafts report restored agent mentions before submission", async () => {
	let mentionedNames = [];
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/project-butter-comment-editor.tsx",
		exportName: "ProjectButterCommentEditor",
		props: {
			agents: [{ id: "claude-code", name: "Claude", byline: "Coding agent" }],
			focusRequest: 0,
			value: "@[subagent:claude-code] Keep the merchant checklist",
			onCancel() {}, onSave() {}, onValueChange() {},
			onMentionChange(names) { mentionedNames = names; },
		},
	});
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	assert.equal(view.getByRole("textbox", { name: "Comment editor" }).textContent.includes("Claude"), true);
	assert.deepEqual(mentionedNames, ["Claude"]);
});

test("header status offers options and custom status updates", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Change status, In progress" }));
	assert.equal(view.queryByRole("menuitem", { name: "In progress" }) === null, true);
	await view.click(view.getByRole("menuitem", { name: "Done" }));
	assert.equal(view.queryByRole("button", { name: "Change status, Done" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Change status, Done" }));
	await view.click(view.getByRole("menuitem", { name: "Create status" }));
	await view.fill(view.getByRole("textbox", { name: "Status name" }), "In review");
	await view.click(view.getByRole("button", { name: "Create and apply" }));
	assert.equal(view.queryByRole("button", { name: "Change status, In review" }) !== null, true);
	await view.click(view.getByRole("button", { name: "More work item actions" }));
	await view.click(view.getByRole("menuitem", { name: "Start watching (4)" }));
	await view.click(view.getByRole("button", { name: "More work item actions" }));
	assert.equal(view.queryByRole("menuitem", { name: "Stop watching (4)" }) !== null, true);
});

test("new audit records and comment replies survive changing activity filters", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Change status, In progress" }));
	await view.click(view.getByRole("menuitem", { name: "Done" }));
	await expandUpdates(view);
	await view.click(view.getByRole("button", { name: /Annie Cook\s*updated status\s*Just now/u }));
	const change = [...document.querySelectorAll("[data-project-butter-activity] dl")].map((node) => node.textContent).find((text) => text.includes("Done"));
	assert.equal(change.includes("In progress"), true);
	const ownComment = '[data-jira-activity-entry-id="butter-source-comment-1"]';
	const reply = () => view.getAllByRole("button", { name: "Reply" }).find((button) => button.closest(ownComment));
	await view.click(reply());
	await view.fill(view.getByRole("textbox", { name: "Leave a reply..." }), "Keep the reply draft");
	await view.click(view.getByRole("button", { name: "Filter activity" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Comments" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Comments" }));
	await view.press(document.body, "Escape");
	await view.click(reply());
	assert.equal(view.getByRole("textbox", { name: "Leave a reply..." }).textContent, "Keep the reply draft");
	await view.click(view.getByRole("button", { name: "Submit" }));
	assert.equal(view.queryByText("Keep the reply draft") !== null, true);
	await expandUpdates(view);
	assert.equal(view.queryByRole("button", { name: /Annie Cook\s*updated status\s*Just now/u }) !== null, true);
	await view.fill(await commentEditor(view), "Posted from the bar");
	await view.click(view.getByRole("button", { name: "Submit" }));
	assert.equal(view.queryByText("Posted from the bar") !== null, true);
});

test("own comments can be edited and deleted with both actions recorded in Activity", async () => {
	const view = await renderWorkItem();
	const ownComment = '[data-jira-activity-entry-id="butter-source-comment-1"]';
	await view.click(view.getAllByRole("button", { name: "Edit comment" }).find((button) => button.closest(ownComment)));
	await view.fill(view.getByRole("textbox", { name: "Edit comment body" }), "Updated campaign review");
	await view.click(view.getByRole("button", { name: "Save comment" }));
	// The edit's audit row also carries the new text in its collapsed change detail, so read the comment itself.
	assert.equal(document.querySelector(ownComment).textContent.includes("Updated campaign review"), true);
	await view.click(view.getAllByRole("button", { name: "More comment actions" }).find((button) => button.closest(ownComment)));
	await view.click(view.getByRole("menuitem", { name: "Delete comment" }));
	assert.equal(document.querySelector(ownComment) === null, true);
	await expandUpdates(view);
	assert.equal(view.getAllByRole("button", { name: /Annie Cook\s*updated comment\s*Just now/u }).length, 2);
});

test("pinned local sessions open the continuation menu in place", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: /^Review Teamwork onboarding guide/u }));
	assert.equal(view.queryByRole("textbox", { name: "Reply to Claude" }), null);
	assert.equal(view.queryByRole("menuitem", { name: /Terminal/u }) !== null, true);
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
				const marks = items.map((entry, index) => ({...entry, label:entry.id, heading:entry.id, kind:"minor", offset:0.02+(items.length < 2 ? 0 : index/(items.length-1))*0.96}));
				return <div data-test-scroll-root style={{overflowY:"auto",height:600}}>
					<div data-project-butter-activity-header ref={navigation.headerRef} />
					<div data-project-butter-activity-timeline><ScrubberRail activeIndex={Math.max(0,items.findIndex((entry)=>entry.id===navigation.visibleId))} activeOffset={offset} entries={marks} onSelect={navigation.scrollToEntry} onSeek={(value)=>navigation.seekToProgress((value-0.02)/0.96)} appearance="dots" selectionMode="drag" ariaLabel="Navigate activity" showPill={false} /></div>
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
	// The hover plate snaps to the nearest stop (stop 5 of 8 sits at 70.57%), never between dots.
	assert.equal(Math.abs(Number.parseFloat(hover.style.left) - 70.5714) < 0.01, true, hover.style.left);
	assert.equal(calls.length, 0, "hover must not move the feed");
	await settle(() => rail.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", pointerId: 7, clientX: 650, button: 0, buttons: 1 })));
	assert.equal(Math.abs(calls.at(-1) - 1744.875) < 0.1, true, String(calls.at(-1)));
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 65) < 0.1, true);
	await settle(() => rail.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", pointerId: 7, clientX: 800, buttons: 1 })));
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 80) < 0.1, true);
	// Scrolling back maps between stops: 1556 sits 3.36 stops in, so the playhead reads 48.02%.
	root.scrollTop = 1556;
	await settle(() => root.dispatchEvent(new Event("scroll")));
	assert.equal(Math.abs(Number.parseFloat(rail.querySelector('[data-slot="scrubber-playhead"]').style.left) - 48.0225) < 0.1, true, rail.querySelector('[data-slot="scrubber-playhead"]').style.left);
	assert.equal([...rail.querySelectorAll('[role="option"]')].findIndex((mark) => mark.getAttribute("aria-selected") === "true"), 3, "the row at the reading line is the selected stop");
	feedHeight = 200;
	root.scrollTop = 1000;
	headerTop = 180;
	await view.rerender({count:1,view:"Audit"});
	assert.equal(root.scrollTop, 1080, "switching to a shorter feed must preserve the sticky header");
	assert.equal(feed.style.minHeight, "", "short feeds must not create blank scroll space");
	headerTop = 100;
	await settle(() => root.dispatchEvent(new Event("scroll")));
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

// Regression (PR review): continuing a session from the comment bar passes the typed draft;
// the hosted chat must carry it into the opened session's composer, not drop it.
test("the hosted chat seeds an opened session's composer with the comment bar draft", async () => {
	const view = await renderComponent({
		entry: "components/website/demos/blocks/project-butter-chat-work-item.tsx",
		exportName: "ProjectButterChatWorkItem",
		mocks: {
			"@/components/blocks/jira-work-item": `import React from "react";
				export default function JiraWorkItem({ projectButterChat }) {
					const session = { id: "butter-claude", agent: { id: "claude", name: "Claude" }, message: "Hi", prompt: "Review the guide" };
					return <div>{projectButterChat.panel}<button type="button" onClick={() => projectButterChat.onOpenCloudSession(session, "Focus on returning users")}>Continue session</button><button type="button" onClick={() => projectButterChat.onOpenCloudSession(session)}>Open session</button></div>;
				}`,
			"@/app/contexts/context-rovo-chat": `export function RovoChatProvider({ children }) { return children; }`,
			"@/app/contexts/context-rovo-chat-controls": `export function useRovoChatControls() { return { chatSurface: "sidebar", openChat() {}, toggleChat() {} }; }`,
			"@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo": `export function useJgpAgentChatDemo() { return { chatContextBar: null, externalThinkingMessageId: null, isSwitchingSession: false, openAgentChat: async () => true }; }`,
			"@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay": `export function JgpRovoOverlay() { return null; }`,
			"@/components/projects/sidebar-chat/page": `import React from "react"; export default function ChatPanel({ composerPrefillRequest }) { return <p data-chat-prefill="">{composerPrefillRequest ? composerPrefillRequest.requestKey + ":" + composerPrefillRequest.text : "none"}</p>; }`,
		},
	});
	const prefill = () => document.querySelector("[data-chat-prefill]")?.textContent;
	assert.equal(prefill(), "none");
	await view.click(view.getByRole("button", { name: "Open session" }));
	assert.equal(prefill(), "none", "opening without a draft leaves the composer alone");
	await view.click(view.getByRole("button", { name: "Continue session" }));
	assert.equal(prefill(), "1:Focus on returning users");
});

test("the wide Details column has a keyboard-resizable separator like the experimental work items", async () => {
	const view = await renderWorkItem();
	const handle = view.getByRole("separator", { name: "Resize details panel" });
	assert.deepEqual(["aria-valuemin", "aria-valuemax", "aria-valuenow"].map((name) => handle.getAttribute(name)), ["280", "640", "420"]);
	await view.press(handle, "ArrowLeft");
	assert.equal(Number(handle.getAttribute("aria-valuenow")) > 420, true, "ArrowLeft widens the right-hand rail");
	await view.press(handle, "ArrowRight");
	assert.equal(handle.getAttribute("aria-valuenow"), "420");
});

// Regression (PR review): the resize bound follows the layout so the hook never runs past the rendered rail.
test("the Details rail's resize bound leaves the description 480px, between 280 and 640", async () => {
	await renderComponent({
		source: `import React from "react";
			import { projectButterDetailsMaxWidth } from "@/components/blocks/jira-work-item/project-butter/details-rail-model";
			export default function BoundProbe() { return <p>{[700, 920, 1000, 1280, 1600].map(projectButterDetailsMaxWidth).join(",")}</p>; }`,
	});
	assert.equal(document.querySelector("p").textContent, "280,440,520,640,640");
});
