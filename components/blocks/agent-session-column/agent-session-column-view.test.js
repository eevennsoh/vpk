// Behavioral contract for the session column's one list/count owner: every
// number the column shows (header, rail, footer, newly synced) must describe
// the rows it paints, under every header filter and in both pools.
const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const {
	EMPTY_AGENT_SESSION_COLUMN_FILTER,
	scopeAgentSessionColumnPools,
	selectAgentSessionColumnView,
} = loadCjsModuleFromText(esbuild.buildSync({
	stdin: {
		contents: `
			export { EMPTY_AGENT_SESSION_COLUMN_FILTER } from "./agent-session-column-filter";
			export * from "./agent-session-column-view";
		`,
		loader: "ts",
		resolveDir: __dirname,
	},
	bundle: true,
	format: "cjs",
	platform: "node",
	tsconfig: path.join(process.cwd(), "tsconfig.json"),
	write: false,
}).outputFiles[0].text, "agent-session-column-view-harness.cjs");

const CODEX = { brandName: "openai-codex", id: "codex", kind: "agent", name: "Codex" };
const PRIYA = { avatarSrc: "/priya.png", name: "Priya" };
const JORDAN = { avatarSrc: "/jordan.png", name: "Jordan" };

function session(id, overrides = {}) {
	return {
		agent: { brandName: "claude", id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		state: "running",
		title: `${id} title`,
		...overrides,
	};
}

// Active pool: two Claude rows (Priya, Jordan) and a Codex row with a PR.
const ACTIVE = [
	session("a-claude-priya", { invokedBy: PRIYA }),
	session("a-claude-jordan", { invokedBy: JORDAN }),
	session("a-codex-priya", { agent: CODEX, invokedBy: PRIYA, prStatus: "open" }),
];
// Archived pool: one Claude row and one Codex row.
const ARCHIVED = [
	session("h-claude-jordan", { invokedBy: JORDAN }),
	session("h-codex-priya", { agent: CODEX, invokedBy: PRIYA }),
];
// Newly synced: one row per active agent plus one archived row.
const NEW_IDS = new Set(["a-claude-jordan", "a-codex-priya", "h-codex-priya"]);

const FILTERS = {
	none: EMPTY_AGENT_SESSION_COLUMN_FILTER,
	agent: { ...EMPTY_AGENT_SESSION_COLUMN_FILTER, agentIds: ["claude"] },
	owner: { ...EMPTY_AGENT_SESSION_COLUMN_FILTER, ownerIds: [PRIYA.avatarSrc] },
	artifacts: { ...EMPTY_AGENT_SESSION_COLUMN_FILTER, containsArtifacts: "yes" },
	"no-match": { ...EMPTY_AGENT_SESSION_COLUMN_FILTER, agentIds: ["cursor"] },
};

function select(filter, view, overrides = {}) {
	return selectAgentSessionColumnView({
		activeItems: ACTIVE,
		filter,
		hiddenItems: ARCHIVED,
		newItemIds: NEW_IDS,
		showFilter: true,
		view,
		...overrides,
	});
}

const ids = (items) => items.map((item) => item.id);

for (const [name, filter] of Object.entries(FILTERS)) {
	test(`every count describes the painted rows under the ${name} filter`, () => {
		for (const view of ["active", "hidden"]) {
			const shown = select(filter, view);
			const opened = select(filter, view === "active" ? "hidden" : "active");

			assert.equal(shown.sessionCount, shown.displayedItems.length, `${view}: header total`);
			assert.equal(
				shown.newCount,
				shown.displayedItems.filter((item) => NEW_IDS.has(item.id)).length,
				`${view}: newly synced count names only painted rows`,
			);
			assert.equal(
				shown.footerCount,
				opened.displayedItems.length,
				`${view}: the footer promises exactly the rows the other pool opens with`,
			);
			assert.equal(shown.footerCount, opened.sessionCount, `${view}: footer and next header agree`);
		}
	});
}

test("a filter that removes newly synced sessions stops announcing them (PR #1599)", () => {
	const claudeOnly = select(FILTERS.agent, "active");

	assert.equal(select(FILTERS.none, "active").newCount, 2);
	assert.deepEqual(ids(claudeOnly.displayedItems), ["a-claude-priya", "a-claude-jordan"]);
	// Previously 2: `a-codex-priya` was still counted after the Claude filter
	// removed it from the rail, so the collapsed label said "2 sessions, 2 newly synced".
	assert.equal(claudeOnly.newCount, 1);
	assert.equal(claudeOnly.sessionCount, 2);
});

test("the archived footer counts filtered archived rows", () => {
	assert.equal(select(FILTERS.none, "active").footerCount, 2);
	assert.equal(select(FILTERS.owner, "active").footerCount, 1);
	assert.deepEqual(ids(select(FILTERS.owner, "hidden").displayedItems), ["h-codex-priya"]);
});

test("the archived footer appears only for archived rows the host handed in", () => {
	assert.equal(select(FILTERS.none, "active").showWellFooter, true);
	// A header filter that matches no archived row keeps the footer, truthfully at 0.
	assert.equal(select(FILTERS["no-match"], "active").showWellFooter, true);
	assert.equal(select(FILTERS["no-match"], "active").footerCount, 0);
	// Archived ids whose rows the host omitted (an Agents focus) raise no footer.
	assert.equal(select(FILTERS.none, "active", { hiddenItems: [] }).showWellFooter, false);
	// The archived view always keeps its Back footer.
	assert.equal(select(FILTERS.none, "hidden", { hiddenItems: [] }).showWellFooter, true);
});

test("a host count overrides only the unfiltered active total", () => {
	const hostCount = { count: 12 };

	assert.equal(select(FILTERS.none, "active", hostCount).sessionCount, 12);
	assert.equal(select(FILTERS.none, "hidden", hostCount).footerCount, 12, "Back to … names the same pool");
	assert.equal(select(FILTERS.none, "hidden", hostCount).sessionCount, ARCHIVED.length);
	assert.equal(select(FILTERS.agent, "active", hostCount).sessionCount, 2, "a filter makes the rows the truth");
	assert.equal(select(FILTERS.agent, "hidden", hostCount).footerCount, 2);
});

test("hosts that omit the filter show every row even with a stale selection", () => {
	const unscoped = select(FILTERS.agent, "active", { showFilter: false });

	assert.equal(unscoped.hasActiveFilters, false);
	assert.deepEqual(ids(unscoped.displayedItems), ids(ACTIVE));
	assert.equal(unscoped.sessionCount, ACTIVE.length);
	assert.equal(unscoped.newCount, 2);
	assert.equal(select(FILTERS.agent, "active").hasActiveFilters, true);
	assert.equal(select(FILTERS.none, "active").hasActiveFilters, false);
});

test("unfiltered pools keep identity so row effects stay stable", () => {
	const pools = scopeAgentSessionColumnPools({
		activeItems: ACTIVE,
		filter: FILTERS.none,
		hiddenItems: ARCHIVED,
		showFilter: true,
	});

	assert.equal(pools.activeRows, ACTIVE);
	assert.equal(pools.hiddenRows, ARCHIVED);
	assert.equal(pools.hasArchivedRows, true);
	assert.equal(select(FILTERS.none, "active").displayedItems, ACTIVE);
});

test("no newly synced ids means no unread count", () => {
	assert.equal(select(FILTERS.none, "active", { newItemIds: undefined }).newCount, 0);
});
