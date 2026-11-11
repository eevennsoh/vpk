const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

const menuSource = `
	import { AgentSessionsMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-session-menu";
	import { TooltipProvider } from "@/components/ui/tooltip";
	export default function Menu(props) { return <TooltipProvider><AgentSessionsMenu {...props} /></TooltipProvider>; }
`;
const themeMock = { "@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });" };
const disclosure = { name: "Sessions from your teammates" };
const session = (id, role, extras = {}) => ({ id, title: `${id} work`, agent: { name: "Sample agent" }, state: "complete", host: "cloud", role, ...extras });
const menuProps = (items, extras = {}) => ({ items, onSelectSession() {}, ...extras });
const renderMenu = (props) => renderComponent({ source: menuSource, props, mocks: themeMock });

test("session menu folds teammate sessions into one flat list after own sessions without headings or counts", async () => {
	const items = [session("team-first", "viewer", { invokedBy: { name: "Sample Alpha" } }), session("mine", "owner"), session("team-second", "viewer"), session("legacy", undefined)];
	const view = await renderMenu(menuProps(items));
	try {
		const trigger = view.getByRole("button", disclosure);
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.deepEqual(view.getAllByRole("listitem").map((row) => row.getAttribute("data-testid")), ["agent-session-row-mine", "agent-session-row-legacy"]);
		assert.equal(view.queryByText("team-first work"), null);
		assert.equal(view.tabOrder().some((name) => name.includes("team-first")), false);
		assert.equal(trigger.textContent.includes("sessions ·"), false);
		assert.equal(trigger.textContent.includes("2 sessions"), false);
		assert.equal(view.container.querySelectorAll("hr").length, 1);
		await view.press(trigger, "Enter");
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		const lists = view.getAllByRole("list");
		assert.equal(lists.length, 2);
		assert.deepEqual([...lists[1].children].map((row) => row.getAttribute("data-testid")), ["agent-session-row-team-first", "agent-session-row-team-second"]);
		assert.equal([...view.container.querySelectorAll("ul")].every((list) => [...list.children].every((child) => child.tagName === "LI")), true);
		assert.equal(view.queryByRole("heading"), null);
		assert.equal(view.queryByRole("group", { name: "Sample Alpha" }), null);
		await view.press(trigger, " ");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(view.getAllByRole("listitem").length, 2);
	} finally { await view.unmount(); }
});

test("owner-only, viewer-only, expired and empty menus retain their separate semantics without an assignment footer", async () => {
	const view = await renderMenu(menuProps([session("mine", "owner")]));
	try {
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.queryByRole("separator"), null);
		assert.equal(view.queryByRole("button", { name: /^(Add|Assign) agent$/u }), null);
		await view.rerender(menuProps([session("teammate", "viewer")]));
		assert.equal(view.queryByRole("list"), null);
		assert.equal(view.queryByRole("separator"), null);
		await view.click(view.getByRole("button", disclosure));
		assert.equal(view.getAllByRole("listitem").length, 1);
		await view.rerender(menuProps([session("expired", "expired"), session("teammate", "viewer")]));
		assert.equal(view.getByText("expired work").closest("article").querySelector("button")?.getAttribute("aria-label"), "More actions for expired work");
		assert.equal(view.queryByRole("separator"), null);
		assert.equal(view.queryByRole("button", { name: /^expired work/u }), null);
		await view.rerender(menuProps([]));
		assert.equal(view.getByText("No agents assigned").textContent, "No agents assigned");
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.queryByRole("list"), null);
		assert.equal(view.queryByRole("button", { name: /^(Add|Assign) agent$/u }), null);
		await view.rerender(menuProps([session("teammate", "viewer")]));
		assert.equal(view.getByRole("button", disclosure).getAttribute("aria-expanded"), "false");
	} finally { await view.unmount(); }
});

test("folding preserves cloud actions, local continuation, expired Delete and portalled menu callbacks", async () => {
	const calls = [];
	const menuChanges = [];
	const items = [session("cloud", "owner"), session("local", "owner", { host: "local" }), session("old", "expired"), session("team", "viewer")];
	const view = await renderMenu(menuProps(items, {
		onSelectSession: (item) => calls.push(["view", item.id]),
		onRenameSession: (item) => calls.push(["rename", item.id]),
		onDeleteSession: (item) => calls.push(["delete", item.id]),
		onToggleVisibility: (item) => calls.push(["archive", item.id]),
		onContinueInAgent: (item) => calls.push(["continue", item.id]),
		onMoreMenuOpenChange: (open) => menuChanges.push(open),
	}));
	try {
		await view.click(view.getByRole("button", disclosure));
		await view.click(view.getByRole("button", { name: /^cloud work/u }));
		for (const name of ["Rename", "Delete", "Dismiss"]) {
			await view.click(view.getByRole("button", { name: "More actions for cloud work" }));
			assert.equal(view.container.contains(view.getByRole("menu")), false);
			await view.click(view.getByRole("menuitem", { name }));
			assert.equal(view.getByRole("button", disclosure).getAttribute("aria-expanded"), "true");
		}
		await view.click(view.getByRole("button", { name: /^local work/u }));
		await view.click(view.getByRole("menuitem", { name: "Sample agent" }));
		await view.click(view.getByRole("button", { name: "More actions for old work" }));
		assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent.trim()), ["Delete"]);
		await view.click(view.getByRole("menuitem", { name: "Delete" }));
		assert.deepEqual(calls, [["view", "cloud"], ["rename", "cloud"], ["delete", "cloud"], ["archive", "cloud"], ["continue", "local"], ["delete", "old"]]);
		assert.equal(menuChanges.includes(true), true);
		assert.equal(menuChanges.at(-1), false);
	} finally { await view.unmount(); }
});

test("viewer keyboard activation stays read-only; Escape dismisses its tooltip before folding and returns focus", async () => {
	let selected = 0;
	const view = await renderMenu(menuProps([session("team", "viewer", { invokedBy: { name: "Sample Alpha" } })], { onSelectSession: () => { selected++; } }));
	try {
		const trigger = view.getByRole("button", disclosure);
		await view.press(trigger, "Enter");
		const card = view.getByText("team work").closest("article");
		assert.equal(card.tabIndex, 0);
		assert.equal(card.querySelector("button"), null);
		await view.click(card);
		await view.focus(trigger);
		await view.focus(card);
		await view.press(card, "Enter");
		await view.press(card, " ");
		assert.equal(selected, 0);
		await view.press(card, "Escape");
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		await view.press(card, "Escape");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(view.isFocused(trigger), true);
		assert.equal(view.tabOrder().some((name) => name.includes("team work")), false);
	} finally { await view.unmount(); }
});

test("header avatars deduplicate supplied identities, preserve distinct faces, and bound missing or large data without counts", async () => {
	const previousImage = window.Image;
	const sources = [];
	window.Image = class extends previousImage {
		set src(value) { sources.push(value); super.src = value; }
		get src() { return super.src; }
	};
	const people = [
		{ name: " Sample Alpha ", avatarSrc: "/sample-alpha.svg" },
		{ name: "Sample Alpha", avatarSrc: "/sample-alpha.svg" },
		{ name: "Sample Alpha", avatarSrc: "/different-alpha.svg" },
		{ name: "Sample Beta" }, undefined, { name: " " },
	];
	const view = await renderMenu(menuProps(people.map((invokedBy, index) => session(`s${index}`, "viewer", { invokedBy }))));
	try {
		const trigger = view.getByRole("button", disclosure);
		assert.deepEqual([...trigger.querySelectorAll('[data-slot="avatar"]')].map((avatar) => avatar.getAttribute("title")), ["Sample Alpha", "Sample Alpha", "Sample Beta", "Teammate"]);
		assert.deepEqual(sources, ["/sample-alpha.svg", "/different-alpha.svg"]);
		await view.rerender(menuProps(Array.from({ length: 30 }, (_, index) => session(`s${index}`, "viewer", { invokedBy: { name: `Sample ${index}` } }))));
		const nextTrigger = view.getByRole("button", disclosure);
		assert.equal(nextTrigger.querySelectorAll('[data-slot="avatar"]').length, 6);
		assert.equal(nextTrigger.textContent.includes("30"), false);
		assert.equal(nextTrigger.textContent.includes("…"), true);
		await view.click(nextTrigger);
		assert.equal(view.getAllByRole("listitem").length, 30, "avatar overflow must not drop sessions");
	} finally { await view.unmount(); window.Image = previousImage; }
});

test("assignment stays open when its disclosure folds and when an owner menu portals outside it", async () => {
	const calls = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-assignment/components/agent-assignment.tsx", exportName: "AgentAssignment", mocks: themeMock,
		props: {
			agents: [],
			assignedAgents: [
				{ id: "owner", name: "Sample owner", host: "cloud", role: "owner", statusKind: "finished" },
				{ id: "viewer", name: "Sample viewer", host: "cloud", role: "viewer", statusKind: "finished" },
			],
			onAssignedAgentIdsChange() {},
			onAssignedAgentSelect: (item) => calls.push(["select", item.id]),
			onRenameAssignedAgent: (item) => calls.push(["rename", item.id]),
		},
	});
	try {
		const assignment = view.getByRole("button", { name: "Edit agents" });
		await view.click(assignment);
		assert.equal(view.queryByRole("button", { name: "Assign agent" }), null);
		const trigger = view.getByRole("button", disclosure);
		await view.press(trigger, "Enter");
		await view.click(view.getByRole("button", { name: /More actions for/u }));
		await view.press(view.getByRole("menuitem", { name: "Rename" }), "Escape");
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		assert.equal(assignment.getAttribute("aria-expanded"), "true");
		await view.focus(trigger);
		await view.press(trigger, "Escape");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(assignment.getAttribute("aria-expanded"), "true");
		assert.equal(view.isFocused(trigger), true);
		await view.click(view.getByRole("button", { name: /More actions for/u }));
		await view.click(view.getByRole("menuitem", { name: "Rename" }));
		assert.deepEqual(calls, [["rename", "owner"]]);
		assert.equal(assignment.getAttribute("aria-expanded"), "true");
	} finally { await view.unmount(); }
});

test("Default uses the activity row and long session cards; Simple keeps the facepile", () => {
	const source = readProjectFile("components/blocks/agent-assignment/components/agent-assignment.tsx");
	const field = readProjectFile("components/blocks/agent-assignment/components/agent-assignment-default-field.tsx");
	const sessionMenu = readProjectFile(
		"components/blocks/agent-assignment/components/assigned-agents-session-menu.tsx",
	);
	const mapper = readProjectFile("components/blocks/agent-assignment/components/assignment-session.ts");
	const page = readProjectFile("components/blocks/agent-assignment/page.tsx");
	const details = readProjectFile("app/data/details/blocks/agent-assignment.ts");

	assert.match(source, /variant\?: AgentAssignmentVariant;/u);
	assert.match(source, /variant = "default"/u);
	assert.match(source, /variant === "simple" \? \(/u);
	assert.match(source, /<AssignedAgentsMenu/u);
	assert.match(source, /<AssignedAgentsSessionMenu/u);
	assert.match(source, /onContinueInAgent=\{onContinueExistingSession/u);
	assert.match(source, /onDeleteSession=\{onDeleteAssignedAgent[\s\S]*runAssignedSessionAction\(assignedAgents, item\.id, onDeleteAssignedAgent\)/u);
	assert.doesNotMatch(source, /onDeleteSession=\{onAssignedAgentIdsChange/u);
	assert.match(source, /onRenameSession=\{onRenameAssignedAgent/u);
	assert.match(source, /onToggleVisibility=\{onAssignedAgentIdsChange/u);
	assert.match(source, /variant === "default"[\s\S]*view === "assigned"[\s\S]*reason === "focus-out"/u);
	assert.match(source, /<AgentAssignmentDefaultField[\s\S]*?assignedAgents=\{assignedAgents\}[\s\S]*?\/>/u);
	assert.match(source, /aria-label=\{shown\.length === 0 \? addAgentLabel : triggerLabel\}/u);

	assert.match(field, /<JiraIssueAgentActivityRows/u);
	assert.match(field, /showAssignmentFlyout=\{false\}/u);
	assert.match(field, /avatarLayout="animated"/u);
	assert.match(field, /inheritChinSurface/u);
	assert.match(mapper, /export function toAssignmentActivity/u);
	assert.match(mapper, /export function toAssignmentSessionItem/u);
	assert.match(mapper, /state: assignmentSessionState\(statusKind\)/u);
	assert.match(mapper, /const invokedBy = agent\.invokedBy;/u);
	assert.match(mapper, /\.\.\.\(invokedBy \? \{ invokedBy \} : \{\}\)/u);
	assert.match(mapper, /\.\.\.\(agent\.host !== undefined \? \{ host: agent\.host \} : \{\}\)/u);
	assert.match(mapper, /import \{ assignmentSessionRole \} from "@\/components\/blocks\/agent-assignment\/components\/assignment-session-role";/u);
	assert.match(mapper, /const role = assignmentSessionRole\(statusKind, agent\.role\);/u);
	assert.match(mapper, /\.\.\.\(role !== undefined \? \{ role \} : \{\}\)/u);

	assert.match(sessionMenu, /<AgentSessionCard/u);
	assert.match(sessionMenu, /density="long"/u);
	assert.match(sessionMenu, /showLifecycleLabel=\{false\}/u);
	assert.match(sessionMenu, /padding="compact"/u);
	assert.doesNotMatch(sessionMenu, /showMoreMenu=\{false\}/u);
	assert.match(sessionMenu, /onContinueInAgent=\{onContinueInAgent\}/u);
	assert.match(sessionMenu, /onView=\{item\.host === "local" && localSessionAction === "continue" \? undefined : \(\) => onSelectSession\(item\)\}/u);
	assert.match(source, /<AssignedAgentsSessionMenu[\s\S]*onSelectAgent=\{handleAssignedAgentSelect\}/u);
	assert.match(sessionMenu, /onDeleteSession=\{onDeleteSession\}/u);
	assert.match(sessionMenu, /onRenameSession=\{onRenameSession\}/u);
	assert.match(sessionMenu, /onToggleVisibility=\{onToggleVisibility\}/u);
	assert.match(sessionMenu, /overlayPositionerClassName = "z-\[600\]"[\s\S]*moreMenuPositionerClassName=\{overlayPositionerClassName\}/u);
	assert.match(sessionMenu, /tooltipPositionerClassName=\{overlayPositionerClassName\}/u);
	assert.match(sessionMenu, /moreMenuPortalled=\{true\}/u);
	assert.doesNotMatch(sessionMenu, /moreMenuPortalled=\{false\}/u);
	assert.match(sessionMenu, /onMoreMenuOpenChange=\{onMoreMenuOpenChange\}/u);
	assert.match(source, /const moreMenuOpenRef = useRef\(false\);/u);
	assert.match(
		source,
		/moreMenuOpenRef\.current[\s\S]*reason === "outside-press"[\s\S]*reason === "trigger-hover"/u,
	);
	assert.match(source, /onMoreMenuOpenChange=\{\(open\) => \{\s*moreMenuOpenRef\.current = open;/u);
	assert.match(sessionMenu, /className="flex w-full flex-col gap-1 p-1 outline-none"/u);
	assert.match(sessionMenu, /className="flex w-full flex-col gap-0"/u);
	assert.match(mapper, /const invokedBy = agent\.invokedBy;/u);
	assert.match(mapper, /\.\.\.\(invokedBy \? \{ invokedBy \} : \{\}\)/u);
	assert.doesNotMatch(mapper, /DEFAULT_ASSIGNMENT_INVOKER/u);
	assert.doesNotMatch(mapper, /Priya Raman/u);
	assert.match(mapper, /\.\.\.\(agent\.host !== undefined \? \{ host: agent\.host \} : \{\}\)/u);
	assert.match(mapper, /const role = assignmentSessionRole\(statusKind, agent\.role\);/u);
	assert.match(mapper, /\.\.\.\(role !== undefined \? \{ role \} : \{\}\)/u);
	assert.doesNotMatch(mapper, /host: "cloud"/u);
	const demoAgents = readProjectFile("components/blocks/agent-assignment/demo-assigned-agents.ts");
	assert.match(demoAgents, /DEMO_INVOKERS\[agent\.id\]/u);
	assert.match(demoAgents, /host: demoStatus\.host/u);
	assert.match(demoAgents, /role: demoStatus\.role/u);
	assert.match(
		demoAgents,
		/const DEMO_INVOKERS: Readonly<Record<string, AgentListInvoker>> = \{\n\t"release-notes-drafter":/u,
	);
	assert.match(demoAgents, /"readiness-checker": \{\n\t\tavatarSrc: "\/avatar-user\/ting-chen/u);
	assert.doesNotMatch(
		demoAgents,
		/const DEMO_INVOKERS: Readonly<Record<string, AgentListInvoker>> = \{\n\t"github-copilot"/u,
	);
	assert.match(sessionMenu, /rows\.map\(toAssignmentSessionItem\)/u);
	assert.doesNotMatch(sessionMenu, /density="short"/u);
	assert.doesNotMatch(sessionMenu, /mx-1/u);
	assert.doesNotMatch(mapper, /timeLabel: agent\.statusLabel/u);
	assert.match(mapper, /\.\.\.\(agent\.timeLabel \? \{ timeLabel: agent\.timeLabel \} : \{\}\)/u);
	assert.match(demoAgents, /timeLabel: demoStatus\.timeLabel/u);
	assert.match(demoAgents, /timeLabel: "18m"/u);
	assert.match(demoAgents, /timeLabel: "Yesterday"/u);
	assert.match(demoAgents, /timeLabel: "3h"/u);
	assert.match(demoAgents, /timeLabel: "Last week"/u);

	assert.match(page, /variant = "default"/u);
	assert.match(page, /variant=\{variant\}/u);
	assert.ok(details.indexOf('title: "Default"') < details.indexOf('title: "Simple"'));
});

test("needs-input preserves explicit viewer ownership", () => {
	const { assignmentSessionRole } = require("./components/assignment-session-role.ts");

	assert.equal(assignmentSessionRole("needs-input", "viewer"), "viewer");
	assert.equal(assignmentSessionRole("needs-input"), "owner");
	assert.equal(assignmentSessionRole("needs-input", "expired"), "expired");
	assert.equal(assignmentSessionRole("working", "viewer"), "viewer");
	assert.equal(assignmentSessionRole("idle", "owner"), "owner");
	assert.equal(assignmentSessionRole("finished"), undefined);
});

test("Simple add action and empty assignment trigger still open the selector", async () => {
	const props = {
		agents: [{ id: "available", name: "Available agent", byline: "Sample capability" }],
		assignedAgents: [{ id: "owner", name: "Sample owner", byline: "Sample capability", statusLabel: "Finished", host: "cloud", role: "owner", statusKind: "finished" }],
		onAssignedAgentIdsChange() {},
		variant: "simple",
	};
	const view = await renderComponent({
		entry: "components/blocks/agent-assignment/components/agent-assignment.tsx",
		exportName: "AgentAssignment", mocks: themeMock, props,
	});
	try {
		await view.click(view.getByRole("button", { name: "Edit agents" }));
		await view.click(view.getByRole("button", { name: "Assign agent" }));
		assert.equal(view.queryByRole("combobox", { name: "Search agents" }) !== null, true);
	} finally { await view.unmount(); }
	for (const variant of ["default", "simple"]) {
		const empty = await renderComponent({
			entry: "components/blocks/agent-assignment/components/agent-assignment.tsx",
			exportName: "AgentAssignment", mocks: themeMock, props: { ...props, assignedAgents: [], variant },
		});
		try {
			await empty.click(empty.getByRole("button", { name: "Assign agent" }));
			assert.equal(empty.queryByRole("combobox", { name: "Search agents" }) !== null, true, variant);
		} finally { await empty.unmount(); }
	}
});

test("Simple keeps its external add callback while Default has no assignment footer", async () => {
	let requested = 0;
	const props = {
		agents: [],
		assignedAgents: [{ id: "owner", name: "Sample owner", byline: "Sample capability", statusLabel: "Finished", host: "cloud", role: "owner", statusKind: "finished" }],
		onAssignedAgentIdsChange() {},
		onRequestAddAgent() { requested++; },
	};
	for (const variant of ["simple", "default"]) {
		const view = await renderComponent({
			entry: "components/blocks/agent-assignment/components/agent-assignment.tsx",
			exportName: "AgentAssignment", mocks: themeMock, props: { ...props, variant },
		});
		try {
			await view.click(view.getByRole("button", { name: "Edit agents" }));
			if (variant === "simple") {
				await view.click(view.getByRole("button", { name: "Assign agent" }));
				assert.equal(requested, 1);
				assert.equal(view.queryByRole("dialog", { name: "Agent assignment" }), null);
			} else {
				assert.equal(view.queryByRole("button", { name: "Assign agent" }), null);
				assert.equal(requested, 1);
			}
		} finally { await view.unmount(); }
	}
});
