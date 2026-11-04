import assert from "node:assert/strict";
import { test } from "node:test";
import { agentInvocationReducer, INITIAL_AGENT_INVOCATION, matchesInvocationAgent } from "./project-butter-invocation-model.ts";

const claude = { id: "claude", name: "Claude", byline: "" };
const cursor = { id: "cursor", name: "Cursor", byline: "" };

test("a selected agent matches its attached session by id or identity", () => {
	assert.equal(matchesInvocationAgent({ id: "PAY-105:claude", name: "Claude" }, claude), true);
	assert.equal(matchesInvocationAgent({ id: "session-123", name: "CLAUDE" }, claude), true);
	assert.equal(matchesInvocationAgent({ id: "PAY-105:cursor", name: "Cursor" }, claude), false);
});

test("opening, browsing both directions and leaving retain the source preview sequence", () => {
	const open = agentInvocationReducer(INITIAL_AGENT_INVOCATION, { type: "open", source: "footer" });
	assert.equal(open.phase, "choosing");
	assert.equal(open.preview.agent, null);
	const first = agentInvocationReducer(open, { type: "preview", agent: claude, index: 6 });
	const backward = agentInvocationReducer(first, { type: "preview", agent: cursor, index: 5 });
	assert.equal(backward.preview.direction, -1);
	assert.equal(backward.preview.previousAgent?.id, "claude");
	const forward = agentInvocationReducer(backward, { type: "preview", agent: claude, index: 6 });
	assert.equal(forward.preview.direction, 1);
	assert.equal(agentInvocationReducer(forward, { type: "preview", agent: claude, index: 6 }), forward);
	assert.equal(
		agentInvocationReducer(forward, { type: "preview", agent: null, index: -1 }).preview.agent,
		null,
	);
});

test("cancel and reopen reset the preview and reject stale handoff completions", () => {
	const open = agentInvocationReducer(INITIAL_AGENT_INVOCATION, { type: "open", source: "footer" });
	const committed = agentInvocationReducer(open, { type: "commit", agent: claude, index: 6 });
	assert.equal(agentInvocationReducer(committed, { type: "close" }), committed);
	const cancelled = agentInvocationReducer(committed, { type: "reset" });
	const reopened = agentInvocationReducer(cancelled, { type: "open", source: "footer" });
	assert.equal(reopened.preview.agent, null);
	assert.equal(
		agentInvocationReducer(reopened, { type: "settle", sequence: committed.preview.sequence }),
		reopened,
	);
	assert.equal(agentInvocationReducer(committed, { type: "abort", sequence: committed.preview.sequence }).phase, "idle");
	assert.equal(agentInvocationReducer(reopened, { type: "abort", sequence: committed.preview.sequence }), reopened);
	assert.equal(
		agentInvocationReducer(committed, { type: "settle", sequence: committed.preview.sequence }).phase,
		"attached",
	);
});
