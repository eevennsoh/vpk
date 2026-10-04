// State-lifetime contract for a session row's "Link work item" panel, rendered
// for real (the row's AgentSessionMoreMenu + Base UI submenu, tabs and nested
// type picker) in happy-dom. The sibling source suite pins how the reset is
// spelled; this one proves what a viewer actually gets back after closing,
// switching tabs, submitting, or moving to another session.
// Assertions compare strings and booleans only; see scripts/lib/render-component.js.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

// One menu per row, keyed by session id, with the row owning its open state:
// the same shape AgentSession + useAgentSessionMenu give each AgentSessionCard.
const SESSION_MENUS_SOURCE = `
	import { useState } from "react";
	import { AgentSessionMoreMenu } from "@/components/blocks/agent-session/agent-session-more-menu";

	function SessionRow({ item, onEvent, workItemOptions }) {
		const [open, setOpen] = useState(false);
		return (
			<li>
				<AgentSessionMoreMenu
					actions={{
						onCreateWorkItem: (draft) => onEvent(\`create \${item.id} \${draft.issueType} "\${draft.summary}"\`),
						onLinkWorkItem: (workItemKey) => onEvent(\`link \${item.id} \${workItemKey}\`),
					}}
					isCloud
					item={item}
					onOpenChange={setOpen}
					open={open}
					workItemOptions={workItemOptions}
				/>
			</li>
		);
	}

	export function SessionMenus({ items, onEvent, workItemOptions }) {
		return (
			<ul>
				{items.map((item) => (
					<SessionRow item={item} key={item.id} onEvent={onEvent} workItemOptions={workItemOptions} />
				))}
			</ul>
		);
	}
`;

const SESSION_A = { host: "cloud", id: "session-a", state: "running", title: "Session A" };
const SESSION_B = { host: "cloud", id: "session-b", state: "completed", title: "Session B" };
const WORK_ITEMS = [
	{ issueType: "story", key: "PAY-1", summary: "Alpha" },
	{ issueType: "bug", key: "PAY-2", summary: "Beta" },
];

async function renderSessionMenus(items = [SESSION_A, SESSION_B]) {
	const events = [];
	const props = { items, onEvent: (event) => events.push(event), workItemOptions: WORK_ITEMS };
	const view = await renderComponent({ exportName: "SessionMenus", props, source: SESSION_MENUS_SOURCE });
	const trigger = (session) => view.getByRole("button", { name: `More actions for ${session.title}` });
	const search = () => view.getByRole("textbox", { name: "Search work items" });
	const name = () => view.getByRole("textbox", { name: "Name this work item" });
	const panel = {
		/** Opens the row menu, then the panel the way a keyboard user does (ArrowRight on the row). */
		open: async (session) => {
			if (!panel.isMenuOpen(session)) await view.click(trigger(session));
			const row = view.getByRole("menuitem", { name: "Link work item" });
			await view.focus(row);
			await view.press(row, "ArrowRight");
		},
		isMenuOpen: (session) => trigger(session).getAttribute("aria-expanded") === "true",
		isOpen: () => view.queryByRole("dialog", { name: "Link work item" }) !== null,
		selectedTab: () => view.getAllByRole("tab").filter((tab) => tab.getAttribute("aria-selected") === "true").map(accessibleName).join(),
		showTab: (tabName) => view.click(view.getByRole("tab", { name: tabName })),
		search: () => search().value,
		fillSearch: (value) => view.fill(search(), value),
		results: () => view.getAllByRole("button").map(accessibleName).filter((label) => /^PAY-\d/u.test(label)),
		name: () => name().value,
		fillName: (value) => view.fill(name(), value),
		type: () => accessibleName(view.getByRole("menuitem", { name: /^Work item type:/u })),
		pickType: async (typeName) => {
			const picker = view.getByRole("menuitem", { name: /^Work item type:/u });
			await view.focus(picker);
			await view.press(picker, "ArrowRight");
			await view.click(view.getByRole("menuitemradio", { name: typeName }));
		},
		/** A draft the viewer can see in both tabs, read without changing the active tab. */
		draft: async () => {
			const tab = panel.selectedTab();
			await panel.showTab("Link to existing");
			const query = panel.search();
			await panel.showTab("Create new");
			const draft = { name: panel.name(), query, type: panel.type() };
			await panel.showTab(tab);
			return draft;
		},
	};
	return { events, panel, rerender: (next) => view.rerender({ ...props, ...next }), trigger, view };
}

const EMPTY_DRAFT = { name: "", query: "", type: "Work item type: Task" };

test("closing the panel or the whole menu discards the search, the draft name and the chosen type", async () => {
	const { panel, view } = await renderSessionMenus();

	await panel.open(SESSION_A);
	await panel.fillSearch("beta");
	assert.deepEqual(panel.results(), ["PAY-2 Beta"]);
	await panel.showTab("Create new");
	await panel.fillName("Draft title");
	await panel.pickType("Bug");
	assert.deepEqual(await panel.draft(), { name: "Draft title", query: "beta", type: "Work item type: Bug" });

	// Escape closes only the panel; the row menu stays open around it.
	await view.press(view.getByRole("textbox", { name: "Name this work item" }), "Escape");
	assert.equal(panel.isOpen(), false);
	assert.equal(panel.isMenuOpen(SESSION_A), true);
	await panel.open(SESSION_A);
	assert.equal(panel.selectedTab(), "Link to existing");
	assert.deepEqual(await panel.draft(), EMPTY_DRAFT);
	assert.deepEqual(panel.results(), ["PAY-1 Alpha", "PAY-2 Beta"]);

	// An outside press closes the row menu with the panel still open inside it.
	await panel.fillSearch("alpha");
	await panel.showTab("Create new");
	await panel.fillName("Second draft");
	await view.click(document.body);
	assert.equal(panel.isMenuOpen(SESSION_A), false);
	await panel.open(SESSION_A);
	assert.deepEqual(await panel.draft(), EMPTY_DRAFT);
});

test("switching tabs is a view switch inside one panel, so the draft survives it", async () => {
	const { panel } = await renderSessionMenus();

	await panel.open(SESSION_A);
	await panel.fillSearch("alp");
	await panel.showTab("Create new");
	await panel.fillName("Keep me");
	await panel.pickType("Story");
	await panel.showTab("Link to existing");
	assert.equal(panel.search(), "alp");
	assert.deepEqual(panel.results(), ["PAY-1 Alpha"]);
	await panel.showTab("Create new");
	assert.equal(panel.name(), "Keep me");
	assert.equal(panel.type(), "Work item type: Story");
});

test("a blank name is rejected in place, and only an accepted create clears the draft", async () => {
	const { events, panel, view } = await renderSessionMenus();

	await panel.open(SESSION_A);
	await panel.showTab("Create new");
	const create = () => view.getByRole("button", { name: "Create work item" });
	assert.equal(create().disabled, true);
	await panel.fillName("   ");
	await panel.pickType("Epic");
	assert.equal(create().disabled, true, "whitespace is not a name");
	await view.click(create());
	assert.deepEqual(events, []);
	assert.equal(panel.isOpen(), true, "a rejected submit keeps the panel open");
	assert.equal(panel.name(), "   ", "a rejected submit must not clear what was typed");
	assert.equal(panel.type(), "Work item type: Epic");

	await panel.fillName("  Fix login  ");
	await view.click(create());
	assert.deepEqual(events, ['create session-a epic "Fix login"']);
	assert.equal(panel.isMenuOpen(SESSION_A), false, "an accepted create closes the whole row menu");

	await panel.open(SESSION_A);
	assert.deepEqual(await panel.draft(), EMPTY_DRAFT);
});

test("linking closes the whole menu and the next opening starts from a fresh search", async () => {
	const { events, panel, view } = await renderSessionMenus();

	await panel.open(SESSION_A);
	await panel.fillSearch("beta");
	await view.click(view.getByRole("button", { name: "PAY-2 Beta" }));
	assert.deepEqual(events, ["link session-a PAY-2"]);
	assert.equal(panel.isMenuOpen(SESSION_A), false);

	await panel.open(SESSION_A);
	assert.equal(panel.search(), "");
	assert.deepEqual(panel.results(), ["PAY-1 Alpha", "PAY-2 Beta"]);
});

test("a same-session update keeps the draft, and no other session ever inherits it (A → B → A)", async () => {
	const { events, panel, rerender, view } = await renderSessionMenus();

	await panel.open(SESSION_A);
	await panel.fillSearch("pay-");
	await panel.showTab("Create new");
	await panel.fillName("For A");

	// A live refresh hands the row fresh objects for the same session and work items.
	await rerender({
		items: [{ ...SESSION_A, state: "completed" }, { ...SESSION_B }],
		workItemOptions: [...WORK_ITEMS, { issueType: "task", key: "PAY-3", summary: "Gamma" }],
	});
	assert.equal(panel.isOpen(), true, "an update for the same session is not a close");
	assert.deepEqual(await panel.draft(), { name: "For A", query: "pay-", type: "Work item type: Task" });
	await panel.showTab("Link to existing");
	assert.deepEqual(panel.results(), ["PAY-1 Alpha", "PAY-2 Beta", "PAY-3 Gamma"], "the kept query filters the refreshed options");

	await view.click(document.body);
	await panel.open(SESSION_B);
	assert.deepEqual(await panel.draft(), EMPTY_DRAFT, "B's panel never shows A's draft");
	await panel.fillSearch("gamma");
	await view.click(view.getByRole("button", { name: "PAY-3 Gamma" }));

	await panel.open(SESSION_A);
	assert.deepEqual(await panel.draft(), EMPTY_DRAFT, "returning to A starts fresh; drafts are discarded at close, never carried");
	assert.deepEqual(events, ["link session-b PAY-3"]);
});
