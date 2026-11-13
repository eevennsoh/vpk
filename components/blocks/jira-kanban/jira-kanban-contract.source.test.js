const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const EXPERIMENTAL_SOURCE = readFileSync(join(__dirname, "experimental", "experimental-jira-kanban.tsx"), "utf8");
const EXPERIMENTAL_CARD_SOURCE = readFileSync(join(__dirname, "experimental", "experimental-jira-kanban-card.tsx"), "utf8");
const EXPERIMENTAL_PAGE_SOURCE = [
	readFileSync(join(__dirname, "experimental", "page.tsx"), "utf8"),
	readFileSync(join(__dirname, "experimental", "experimental-page-types.ts"), "utf8"),
].join("\n");

test("finished runs retain Local or Cloud metadata through the assignment and detail presenters", () => {
	const completedSource = readFileSync(join(__dirname, "..", "jira-issue", "completed-agent-runs.tsx"), "utf8");
	function loadMapper(source, name) {
		const compiled = ts.transpileModule(source, {
			compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
		}).outputText;
		return runInNewContext(`${compiled}; ${name}`, { exports: {}, require: () => ({}) });
	}
	const toAssigned = loadMapper(EXPERIMENTAL_CARD_SOURCE, "toAssignedAgentFromDoneRun");
	const toListItem = loadMapper(completedSource, "toCompletedAgentListItem");
	for (const host of ["local", "cloud", undefined]) {
		const run = {
			id: "PAY-101:claude-code",
			agentName: "Claude",
			host,
			issueKey: "PAY-101",
			issueSummary: "Map v1 call sites",
			relativeTime: "This week",
			state: "done",
			summary: "Captured inventory",
		};
		const assigned = toAssigned("PAY-101", run);
		assert.equal(assigned.host, host ?? "cloud");
		assert.equal(assigned.statusKind, "finished");
		assert.equal(assigned.timeLabel, "This week");
		assert.equal(toListItem(run).sessionDetails.host, host ?? "cloud");
	}
});

test("Kanban assignment catalog starts from the shared AgentSelector directory", () => {
	const catalogSource = readFileSync(join(__dirname, "lib", "agent-catalog.ts"), "utf8");
	assert.match(catalogSource, /export function mergeJiraKanbanAgentCatalog\(/u);
	assert.match(catalogSource, /ROVO_AGENT_SELECTOR_AGENTS/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /ROVO_AGENT_SELECTOR_AGENTS/u);
});

test("Experimental kanban variant reuses the shared board data contracts", () => {
	// Types and state helpers stay shared so both variants remain swappable
	// inside an owning surface.
	assert.match(EXPERIMENTAL_SOURCE, /import type \{[\s\S]*JiraKanbanProps,\n\} from "\.\.\/index";/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /import \{ createJiraKanbanColumns \} from "\.\.\/jira-kanban-data";/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /\} from "\.\.\/state";/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /^export interface JiraKanbanProps/mu);
});
