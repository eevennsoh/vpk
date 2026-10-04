import assert from "node:assert/strict";
import test from "node:test";

import type { AgentSessionItem } from "../agent-session/agent-session-types";

import { collectLinkableAgentSessions, isAgentSessionLinkable, linkAllAgentSessions } from "./agent-session-column-overflow.ts";

function session(id: string, issueKey?: string): AgentSessionItem {
	return {
		agent: { id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		sessionDetails: issueKey === undefined
			? { host: "local", issueSummary: `${id} work` }
			: { host: "local", issueKey, issueSummary: `${issueKey} work` },
		state: "complete",
		title: `${id} title`,
	};
}

test("captured sessions are not linkable", () => {
	const captured = session("lw-captured", "PAY-101");
	const open = session("lw-open", "PAY-102");

	assert.equal(isAgentSessionLinkable(captured, new Set(["lw-captured"])), false);
	assert.equal(isAgentSessionLinkable(open, new Set(["lw-captured"])), true);
	assert.equal(isAgentSessionLinkable(captured), true);
});

test("collectLinkableAgentSessions skips captured ids and keeps the rest", () => {
	const items = [
		session("lw-a", "PAY-101"),
		session("lw-b", "PAY-102"),
		session("lw-c", "PAY-103"),
	];

	assert.deepEqual(
		collectLinkableAgentSessions(items, new Set(["lw-b"])).map((item: AgentSessionItem) => item.id),
		["lw-a", "lw-c"],
	);
	assert.deepEqual(
		collectLinkableAgentSessions(items).map((item: AgentSessionItem) => item.id),
		["lw-a", "lw-b", "lw-c"],
	);
});

test("linkAllAgentSessions offers each uncaptured session its resolved key", () => {
	const items = [
		session("lw-a", "PAY-101"),
		session("lw-b", "PAY-102"),
		session("lw-c"),
	];
	const linked: Array<readonly [string, string | undefined]> = [];

	linkAllAgentSessions(items, {
		capturedItemIds: new Set(["lw-b"]),
		getSuggestedWorkItemKeys: (item: AgentSessionItem) =>
			item.id === "lw-a" ? ["PAY-201", "PAY-101"] : undefined,
		onLinkWorkItem: (item: AgentSessionItem, workItemKey?: string) => {
			linked.push([item.id, workItemKey]);
		},
	});

	assert.deepEqual(linked, [
		["lw-a", "PAY-201"],
		["lw-c", undefined],
	]);
});
