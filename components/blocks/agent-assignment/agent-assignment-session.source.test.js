const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { act } = require("react");
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
const disclosure = { name: /^(?:using|\d+ other) agents?$/iu };
const session = (id, role, extras = {}) => ({ id, title: `${id} work`, agent: { name: "Sample agent" }, state: "complete", host: "cloud", role, ...extras });
const menuProps = (items, extras = {}) => ({ items, onSelectSession() {}, ...extras });
const renderMenu = (props) => renderComponent({ source: menuSource, props, mocks: themeMock });

test("session menu shows each session's lifecycle indicator", async () => {
	const states = [["running", "Working"], ["needs-input", "Needs input"], ["complete", "Finished"]];
	const view = await renderMenu(menuProps(states.map(([state]) => session(state, "owner", { state }))));
	try {
		for (const [state, label] of states) {
			const row = view.container.querySelector(`[data-testid="agent-session-row-${state}"]`);
			assert.equal(row.querySelector(`[role="img"][aria-label="${label}"]`) !== null, true, `${label} indicator is visible`);
			assert.equal(row.querySelector('[data-slot="spinner"]') !== null, state === "running");
		}
	} finally { await view.unmount(); }
});

test("session menu puts needs-input sessions first within each ownership group", async () => {
	const items = [session("running", "owner", { state: "running" }), session("waiting", "owner", { state: "needs-input" }), session("complete", "owner"), session("team-running", "viewer", { state: "running" }), session("team-waiting", "viewer", { state: "needs-input" })];
	const view = await renderMenu(menuProps(items, { teammateSessionsPresentation: "expanded" }));
	try {
		const lists = view.getAllByRole("list");
		assert.deepEqual([...lists[0].children].map((row) => row.getAttribute("data-testid")), ["agent-session-row-waiting", "agent-session-row-running", "agent-session-row-complete"]);
		assert.deepEqual([...lists[1].children].map((row) => row.getAttribute("data-testid")), ["agent-session-row-team-waiting", "agent-session-row-team-running"]);
		for (const row of view.container.querySelectorAll("[data-agent-session-agent]")) {
			assert.equal(row.textContent, "");
		}
		assert.deepEqual(items.map((item) => item.id), ["running", "waiting", "complete", "team-running", "team-waiting"]);
	} finally { await view.unmount(); }
});

test("person attribution reveals their name on keyboard focus", async () => {
	const view = await renderMenu(menuProps([session("mine", "owner", { invokedBy: { name: "Maya" } })]));
	try {
		const avatar = view.getByRole("img", { name: "Maya" });
		await view.focus(avatar);
		assert.equal(view.getByRole("tooltip").textContent, "Maya");
	} finally { await view.unmount(); }
});

test("session cards use the shared agent avatar preview across densities", async () => {
	const view = await renderComponent({
		source: `
			import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
			import { AgentSessionAvatarPreviewContext } from "@/components/blocks/agent-session/agent-session-avatar-preview";
			export default function Example({ item, density }) {
				return <AgentSessionAvatarPreviewContext value={(agent, avatar) => <button key="agent" aria-label={"Preview " + agent.name}>{avatar}</button>}><ul><AgentSessionCard density={density} item={item} /></ul></AgentSessionAvatarPreviewContext>;
			}
		`,
		props: { item: session("team", "viewer", { agent: { name: "Cursor" }, invokedBy: { name: "Jordan" } }), density: "long" },
		mocks: themeMock,
	});
	try {
		assert.equal(Boolean(view.getByRole("button", { name: "Preview Cursor" })), true);
		await view.rerender({ item: session("team", "viewer", { agent: { name: "Cursor" }, invokedBy: { name: "Jordan" } }), density: "short" });
		assert.equal(Boolean(view.getByRole("button", { name: "Preview Cursor" })), true);
		await view.rerender({ item: session("team", "viewer", { agent: { name: "Cursor" }, invokedBy: { name: "Jordan" } }), density: "unlinked" });
		assert.equal(Boolean(view.getByRole("button", { name: "Preview Cursor" })), true);
	} finally { await view.unmount(); }
});

test("detached and selectable session avatars expose the host preview", async () => {
	const view = await renderComponent({
		source: `
			import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
			import { AgentSessionMediumCard } from "@/components/blocks/agent-session/agent-session-medium-card";
			import { AgentSessionAvatarPreviewContext } from "@/components/blocks/agent-session/agent-session-avatar-preview";
			export default function Example({ item, marked }) {
				return <AgentSessionAvatarPreviewContext value={(agent, avatar, options) => options?.hoverOnly ? <span key="agent" data-testid="detached-preview">{avatar}</span> : <button key="agent" aria-label={"Preview " + agent.name}>{avatar}</button>}>
					<AgentSessionMediumCard isArriving={false} isNew={false} item={item} />
					<ul><AgentSessionCard density="unlinked" item={item} triageRow={{ approve: null, mark: { isMarked: marked, onActivate() {} } }} /></ul>
				</AgentSessionAvatarPreviewContext>;
			}
		`,
		props: { item: session("team", "owner", { agent: { name: "Cursor" }, invokedBy: { name: "Jordan" }, host: "local" }), marked: false },
		mocks: themeMock,
	});
	try {
		assert.equal(Boolean(view.container.querySelector('[data-testid="detached-preview"]')), true);
		assert.equal(Boolean(view.getByRole("button", { name: "Preview Cursor" })), true);
		await view.rerender({ item: session("team", "owner", { agent: { name: "Cursor" }, invokedBy: { name: "Jordan" }, host: "local" }), marked: true });
		assert.equal(Boolean(view.queryByRole("button", { name: "Preview Cursor" })), false);
	} finally { await view.unmount(); }
});

test("Rovo session avatars open the Rovo agent lanyard", async () => {
	const view = await renderComponent({
		source: `
			import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
			import { HeaderLanyards } from "@/components/projects/shared/components/eu26-header-lanyards";
			export default function Example({ item }) { return <HeaderLanyards><ul><AgentSessionCard density="long" item={item} /></ul></HeaderLanyards>; }
		`,
		props: { item: session("rovo", "owner", { agent: { id: "rovo-dev", name: "Rovo", vpkLogo: "rovo" }, invokedBy: { name: "Maya" } }) },
		mocks: { ...themeMock, "@/app/contexts/context-rovo-chat-controls": "export const useRovoChatControls = () => ({ openChat() {}, selectAgent() {} });" },
	});
	try {
		await view.click(view.getByRole("button", { name: "Preview Rovo" }));
		assert.equal(view.getByRole("heading", { name: "Rovo" }).textContent, "Rovo");
		assert.equal(view.getByText("Atlassian").textContent, "Atlassian");
		assert.equal(Boolean(document.querySelector('[data-slot="agent-lanyard-avatar"] svg')), true);
		assert.equal(document.querySelector('[data-slot="agent-lanyard-grid"]').dataset.animated, "false");
	} finally { await view.unmount(); }
});

test("session menu uses avatar-only agent metadata and retains its Rovo avatar", async () => {
	const view = await renderMenu(menuProps([
		session("figma", "owner", { agent: { name: "Figma", brandName: "figma" } }),
		session("rovo", "owner", { agent: { name: "Rovo", vpkLogo: "rovo" } }),
	]));
	try {
		const figma = view.container.querySelector('[data-testid="agent-session-row-figma"]');
		const rovo = view.container.querySelector('[data-testid="agent-session-row-rovo"]');
		assert.equal(figma.querySelector('[data-agent-session-agent]').textContent, "");
		assert.equal(figma.querySelector('[data-agent-list-title]').textContent, "figma work");
		assert.equal(Boolean(rovo.querySelector('[data-agent-session-agent] svg')), true);
	} finally { await view.unmount(); }
});

test("assignment activity keeps its private access mark in the session menu", async () => {
	const view = await renderComponent({
		source: `
			import { AssignedAgentsSessionMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-session-menu";
			import { toAgentAssignmentAgent } from "@/components/blocks/jira-issue/agent-activity";
			import { TooltipProvider } from "@/components/ui/tooltip";
			export default function Menu({ activity }) { return <TooltipProvider><AssignedAgentsSessionMenu rows={[toAgentAssignmentAgent(activity)]} onSelectAgent={() => {}} /></TooltipProvider>; }
		`,
		props: { activity: { id: "private", name: "Cursor", label: "Reviewing", state: "working", role: "viewer", invokedBy: { name: "Jordan" }, privateTo: "Jordan" } },
		mocks: themeMock,
	});
	try {
		assert.ok(view.getByRole("img", { name: "Private session by Jordan" }));
		assert.equal(view.container.querySelector('[data-access-mark="team"]'), null);
	} finally { await view.unmount(); }
});

test("teammate-only menus show the rows directly and mixed menus label their disclosure", async () => {
	const team = [session("first", "viewer"), session("second", "viewer")];
	const view = await renderMenu(menuProps(team, { teammateSessionsPresentation: "count" }));
	try {
		assert.equal(view.queryByText(/using agents|other agents/iu) === null, true);
		assert.equal(view.getAllByRole("listitem").length, 2);
		await view.rerender(menuProps(team));
		assert.equal(view.queryByText(/using agents|other agents/iu) === null, true);
		await view.rerender(menuProps([session("mine", "owner"), team[0]], { teammateSessionsPresentation: "expanded" }));
		const trigger = view.getByRole("button", { name: "1 other agent" });
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		assert.equal(view.getByText("first work").textContent.includes("first work"), true);
		await view.click(trigger);
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(trigger.getAttribute("aria-label"), "Using agent");
		assert.equal(view.queryByText("first work"), null);
		await view.rerender(menuProps([team[0]], { teammateSessionsPresentation: "count" }));
		assert.equal(view.queryByText(/using agent|other agent/iu) === null, true);
		assert.equal(view.getAllByRole("listitem").length, 1);
		const onePerson = team.map((item) => ({ ...item, invokedBy: { name: "Jordan" } }));
		await view.rerender(menuProps([session("mine", "owner"), ...onePerson], { teammateSessionsPresentation: "count" }));
		const singlePersonTrigger = view.getByRole("button", { name: "Using agents" });
		await view.click(singlePersonTrigger);
		assert.equal(singlePersonTrigger.getAttribute("aria-label"), "2 other agents");
	} finally { await view.unmount(); }
});

test("mixed sessions show teammates expanded by default and can collapse", async () => {
	const view = await renderMenu(menuProps([session("mine", "owner"), session("team", "viewer")]));
	try {
		const trigger = view.getByRole("button", { name: "1 other agent" });
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		assert.equal(Boolean(view.getByText("team work")), true);
		await view.click(trigger);
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(view.queryByText("team work"), null);
	} finally { await view.unmount(); }
});

test("session menu folds teammate sessions into one flat list after own sessions without headings or counts", async () => {
	const items = [session("team-first", "viewer", { invokedBy: { name: "Sample Alpha" } }), session("mine", "owner"), session("team-second", "viewer"), session("legacy", undefined)];
	const view = await renderMenu(menuProps(items, { teammateSessionsPresentation: "count" }));
	try {
		const trigger = view.getByRole("button", disclosure);
		assert.equal(trigger.getAttribute("aria-label"), "Using agents");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(Boolean(trigger.querySelector('[data-slot="avatar-group"]')), true);
		assert.deepEqual(view.getAllByRole("listitem").map((row) => row.getAttribute("data-testid")), ["agent-session-row-mine", "agent-session-row-legacy"]);
		assert.equal(view.queryByText("team-first work"), null);
		assert.equal(view.tabOrder().some((name) => name.includes("team-first")), false);
		assert.equal(trigger.textContent.includes("sessions ·"), false);
		assert.equal(trigger.textContent.includes("2 sessions"), false);
		assert.equal(view.container.querySelectorAll('[data-slot="dropdown-menu-separator"]').length, 1);
		await view.press(trigger, "Enter");
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		assert.equal(trigger.getAttribute("aria-label"), "2 other agents");
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
		assert.equal(trigger.querySelector('[data-slot="avatar-group"]').getAttribute("aria-hidden"), "true");
		const lists = view.getAllByRole("list");
		assert.equal(lists.length, 2);
		assert.deepEqual([...lists[1].children].map((row) => row.getAttribute("data-testid")), ["agent-session-row-team-first", "agent-session-row-team-second"]);
		assert.equal([...view.container.querySelectorAll("ul")].every((list) => [...list.children].every((child) => child.tagName === "LI")), true);
		assert.equal(view.queryByRole("heading"), null);
		assert.equal(view.queryByRole("group", { name: "Sample Alpha" }), null);
		await view.press(trigger, " ");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(Boolean(trigger.querySelector('[data-slot="avatar-group"]')), true);
		assert.equal(view.getAllByRole("listitem").length, 2);
	} finally { await view.unmount(); }
});

test("rapidly toggling the teammate disclosure leaves one settled avatar stack", async () => {
	const view = await renderMenu(menuProps([session("mine", "owner"), session("teammate", "viewer", { invokedBy: { name: "Sample Alpha" } })], { teammateSessionsPresentation: "count" }));
	try {
		const trigger = view.getByRole("button", disclosure);
		for (let index = 0; index < 4; index++) await view.click(trigger);
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(trigger.querySelectorAll('[data-slot="avatar-group"]').length, 1);
		assert.equal(trigger.querySelectorAll('[data-slot="avatar"]').length, 1);
	} finally { await view.unmount(); }
});

test("owner-only, viewer-only, expired and empty menus retain their separate semantics without an assignment footer", async () => {
	let selected = 0;
	const onSelectSession = () => { selected++; };
	const view = await renderMenu(menuProps([session("mine", "owner")]));
	try {
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.queryByRole("separator"), null);
		assert.equal(view.queryByRole("button", { name: /^(Add|Assign) agent$/u }), null);
		await view.rerender(menuProps([session("teammate", "viewer")], { onSelectSession }));
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.queryByText(/using agent|other agent/iu) === null, true);
		const viewer = view.getByText("teammate work").closest("article");
		assert.equal(viewer.tabIndex, 0);
		await view.focus(viewer);
		assert.equal(view.getByText("You can see this session, but only its owner can act on it.").textContent, "You can see this session, but only its owner can act on it.");
		await view.press(viewer, "Enter");
		assert.equal(selected, 0);
		assert.equal(view.getAllByRole("listitem").length, 1);
		assert.equal(view.queryByRole("separator"), null);
		await view.rerender(menuProps([session("expired", "expired"), session("teammate", "viewer")], { teammateSessionsPresentation: "count" }));
		assert.equal(view.getByText("expired work").closest("article").querySelector("button")?.getAttribute("aria-label"), "More actions for expired work");
		assert.equal(view.queryByRole("separator"), null);
		assert.equal(view.queryByRole("button", { name: /^expired work/u }), null);
		assert.equal(view.getByRole("button", disclosure).getAttribute("aria-expanded"), "false");
		assert.equal(view.queryByText("teammate work"), null);
		await view.rerender(menuProps([]));
		assert.equal(view.getByText("No agents assigned").textContent, "No agents assigned");
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.queryByRole("list"), null);
		assert.equal(view.queryByRole("button", { name: /^(Add|Assign) agent$/u }), null);
		await view.rerender(menuProps([session("teammate", "viewer")]));
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.getByText("teammate work").textContent.includes("teammate work"), true);
	} finally { await view.unmount(); }
});

test("folding preserves cloud actions, local continuation, expired Delete and portalled menu callbacks", async () => {
	const calls = [];
	const menuChanges = [];
	const items = [session("cloud", "owner"), session("local", "owner", { host: "local" }), session("old", "expired"), session("team", "viewer")];
	const view = await renderMenu(menuProps(items, {
		teammateSessionsPresentation: "count",
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
		for (const name of ["Rename", "Delete"]) {
			await view.click(view.getByRole("button", { name: "More actions for cloud work" }));
			assert.equal(view.container.contains(view.getByRole("menu")), false);
			assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent.trim()), ["Stop session", "Pin", "Rename", "Delete"]);
			await view.click(view.getByRole("menuitem", { name }));
			assert.equal(view.getByRole("button", disclosure).getAttribute("aria-expanded"), "true");
		}
		await view.click(view.getByRole("button", { name: "More actions for local work" }));
		assert.equal(view.getAllByRole("menuitem").length, 2);
		assert.ok(view.getByRole("menuitem", { name: "Copy prompt" }));
		await view.click(view.getByRole("menuitem", { name: "Sample agent" }));
		await view.click(view.getByRole("button", { name: /^local work/u }));
		await view.click(view.getByRole("menuitem", { name: "Sample agent" }));
		await view.click(view.getByRole("button", { name: "More actions for old work" }));
		assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent.trim()), ["Delete"]);
		await view.click(view.getByRole("menuitem", { name: "Delete" }));
		assert.deepEqual(calls, [["view", "cloud"], ["rename", "cloud"], ["delete", "cloud"], ["continue", "local"], ["continue", "local"], ["delete", "old"]]);
		assert.equal(menuChanges.includes(true), true);
		assert.equal(menuChanges.at(-1), false);
	} finally { await view.unmount(); }
});

test("private viewer keyboard activation stays read-only; Escape dismisses its tooltip before folding and returns focus", async () => {
	let selected = 0;
	const view = await renderMenu(menuProps([session("mine", "owner"), session("team", "viewer", { privateTo: "Sample Alpha", invokedBy: { name: "Sample Alpha" } })], { teammateSessionsPresentation: "count", onSelectSession: () => { selected++; } }));
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

test("header avatars deduplicate identities and count people beyond the first four", async () => {
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
	const view = await renderMenu(menuProps([session("mine", "owner"), ...people.map((invokedBy, index) => session(`s${index}`, "viewer", { invokedBy }))], { teammateSessionsPresentation: "count" }));
	try {
		const trigger = view.getByRole("button", disclosure);
		assert.deepEqual([...trigger.querySelectorAll('[data-slot="avatar"]')].map((avatar) => avatar.getAttribute("aria-label")), ["Sample Alpha", "Sample Alpha", "Sample Beta", "Teammate"]);
		assert.deepEqual(sources, ["/sample-alpha.svg", "/different-alpha.svg"]);
		assert.equal(Boolean(trigger.querySelector('[data-slot="avatar-group-count"]')), false);
		await view.rerender(menuProps([session("mine", "owner"), ...Array.from({ length: 5 }, (_, index) => session(`s${index}`, "viewer", { invokedBy: { name: `Sample ${index}` } }))]));
		assert.equal(trigger.querySelector('[data-slot="avatar-group-count"]').textContent, "+1");
		await view.rerender(menuProps([session("mine", "owner"), ...Array.from({ length: 30 }, (_, index) => session(`s${index}`, "viewer", { invokedBy: { name: `Sample ${index}` } }))]));
		const nextTrigger = view.getByRole("button", disclosure);
		assert.equal(nextTrigger.querySelectorAll('[data-slot="avatar"]').length, 4);
		assert.equal(nextTrigger.querySelector('[data-slot="avatar-group-count"]').textContent, "+26");
		await view.click(nextTrigger);
		assert.equal(view.getAllByRole("listitem").length, 31, "avatar overflow must not drop sessions");
	} finally { await view.unmount(); window.Image = previousImage; }
});

test("assignment stays open when its disclosure folds and when an owner menu portals outside it", async () => {
	const calls = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-assignment/components/agent-assignment.tsx", exportName: "AgentAssignment", mocks: themeMock,
		props: {
			agents: [],
			teammateSessionsPresentation: "count",
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

test("Default uses the activity row and small session cards; Simple keeps the facepile", () => {
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
	assert.match(sessionMenu, /density="short"/u);
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
	assert.match(sessionMenu, /className=\{cn\("flex w-full flex-col outline-none", dropdownStyles\.padding\)\}/u);
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
	assert.doesNotMatch(sessionMenu, /density="long"/u);
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
