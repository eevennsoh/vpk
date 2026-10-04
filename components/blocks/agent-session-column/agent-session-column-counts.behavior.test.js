// Rendered proof that the session column's counts follow its header filter.
// agent-session-column-view.test.js covers the selector across every filter;
// this suite proves the column actually wires those counts to what a viewer
// and a screen reader get: the landmark, the collapsed label, and the footer.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const CODEX = { brandName: "openai-codex", id: "codex", kind: "agent", name: "Codex" };

function session(id, overrides = {}) {
	return {
		agent: { brandName: "claude", id: "claude", kind: "agent", name: "Claude" },
		host: "cloud",
		id,
		state: "running",
		title: `${id} title`,
		...overrides,
	};
}

const ITEMS = [session("claude-1"), session("claude-2"), session("codex-1", { agent: CODEX })];

function renderColumn(props = {}) {
	return renderComponent({
		entry: "components/blocks/agent-session-column/index.tsx",
		exportName: "AgentSessionColumn",
		props: { items: ITEMS, ...props },
	});
}

// Queries return happy-dom nodes; assert on booleans so a failure never inspects one.
const landmarkName = () => document.querySelector("section[data-agent-session-column]")?.getAttribute("aria-label");

async function filterByAgent(view, agentName) {
	await view.click(view.getByRole("button", { name: "Filter sessions" }));
	await view.click(view.getByRole("button", { name: `Filter by ${agentName}` }));
	await view.press(null, "Escape");
}

test("a header filter narrows the collapsed newly synced count (PR #1599)", async () => {
	const view = await renderColumn({ newItemIds: new Set(["claude-2", "codex-1"]) });

	await filterByAgent(view, "Claude");
	assert.equal(landmarkName(), "Unlink sessions, 2 sessions");

	await view.click(view.getByRole("button", { name: "Collapse Unlink sessions column" }));
	assert.equal(landmarkName(), "Unlink sessions, 2 sessions");
	// Before the shared selector the filtered-out Codex row still counted:
	// "2 sessions, 2 newly synced" over a rail with one unread notch.
	assert.equal(view.queryByText("2 sessions, 1 newly synced") !== null, true);
	assert.equal(view.queryByText("2 sessions, 2 newly synced") === null, true);
});

test("without a filter the collapsed label counts every newly synced row", async () => {
	const view = await renderColumn({ newItemIds: new Set(["claude-2", "codex-1"]) });

	await view.click(view.getByRole("button", { name: "Collapse Unlink sessions column" }));
	assert.equal(landmarkName(), "Unlink sessions, 3 sessions");
	assert.equal(view.queryByText("3 sessions, 2 newly synced") !== null, true);
});

test("the archived footer promises exactly the rows it opens under a filter", async () => {
	const view = await renderColumn();

	await view.click(view.getByRole("button", { name: "More actions for codex-1 title" }));
	await view.click(view.getByRole("menuitem", { name: "Dismiss" }));
	assert.equal(view.queryByRole("button", { name: "Show 1 archived session" }) !== null, true);

	await filterByAgent(view, "Claude");
	// The only archived row is Codex, which the Claude filter removes.
	assert.equal(view.queryByRole("button", { name: "Show 1 archived session" }) === null, true);
	await view.click(view.getByRole("button", { name: "Show 0 archived sessions" }));

	assert.equal(landmarkName(), "Archived, 0 sessions");
	assert.equal(view.queryByText("No matching sessions") !== null, true);
});
