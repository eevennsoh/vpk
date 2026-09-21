import assert from "node:assert/strict";
import test from "node:test";

import {
	nextJiraIssueDemoLinkedIds,
	splitJiraIssueDemoSessionsById,
	toJiraIssueDemoAttachedActivity,
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "./agent-session-demo-attach.ts";

const CLAUDE = {
	id: "lw-scope-thread",
	title: "The adapter keep-or-delete argument still lives in a local Claude session",
	state: "complete",
	agent: {
		brandName: "claude",
		id: "claude",
		kind: "agent",
		name: "Claude",
	},
} as const;

const CURSOR = {
	id: "lw-kickoff-killswitch-session",
	title: "Kill switch as a prerequisite still lives in a local Cursor session",
	state: "complete",
	agent: {
		brandName: "cursor",
		id: "cursor",
		kind: "agent",
		name: "Cursor",
	},
} as const;

test("attaching a complete detached session produces a working chin activity", () => {
	const activity = toJiraIssueDemoAttachedActivity(CLAUDE);

	assert.equal(activity.id, CLAUDE.id);
	assert.equal(activity.name, "Claude");
	assert.equal(activity.state, "working");
	assert.equal(activity.agentBrandName, "claude");
});

test("attaching a Rovo session retains its product mark", () => {
	const activity = toJiraIssueDemoAttachedActivity({
		...CLAUDE,
		agent: { name: "Rovo", vpkLogo: "rovo" },
	});

	assert.equal(activity.agentVpkLogo, "rovo");
});

test("needs-input detached sessions stay awaiting input after attach", () => {
	const activity = toJiraIssueDemoAttachedActivity({
		...CURSOR,
		state: "needs-input",
		title: "Needs the retention window",
	});

	assert.equal(activity.state, "awaiting-input");
	assert.equal(activity.label, "Needs the retention window");
});

test("linking one detached id does not drop another already linked", () => {
	const afterClaude = nextJiraIssueDemoLinkedIds([], CLAUDE.id, true);
	const afterBoth = nextJiraIssueDemoLinkedIds(afterClaude, CURSOR.id, true);

	assert.deepEqual(afterClaude, [CLAUDE.id]);
	assert.deepEqual(afterBoth, [CLAUDE.id, CURSOR.id]);
	assert.deepEqual(nextJiraIssueDemoLinkedIds(afterBoth, CLAUDE.id, true), afterBoth);
});

test("unlinking one attached session leaves the others on the work item", () => {
	const linked = [CLAUDE.id, CURSOR.id];

	assert.deepEqual(nextJiraIssueDemoLinkedIds(linked, CLAUDE.id, false), [CURSOR.id]);
	assert.deepEqual(nextJiraIssueDemoLinkedIds(linked, "missing", false), linked);
});

test("split keeps unlinked detached sessions available after the first attach", () => {
	const afterClaude = splitJiraIssueDemoSessionsById([CLAUDE, CURSOR], [CLAUDE.id]);

	assert.deepEqual(afterClaude.linked.map((session) => session.id), [CLAUDE.id]);
	assert.deepEqual(afterClaude.remaining.map((session) => session.id), [CURSOR.id]);

	const afterBoth = splitJiraIssueDemoSessionsById([CLAUDE, CURSOR], [CLAUDE.id, CURSOR.id]);
	assert.equal(afterBoth.linked.length, 2);
	assert.equal(afterBoth.remaining.length, 0);
});

test("attaching a session keeps the human who invoked it", () => {
	// Without this the chin row the session becomes drags as bare "Claude"
	// instead of "Claude with Priya Raman", and a later unlink hands the card
	// assignee back as the invoker.
	const invoker = { avatarSrc: "/avatar-user/priya.png", name: "Priya Raman" };
	const activity = toJiraIssueDemoAttachedActivity({ ...CLAUDE, invokedBy: invoker });

	assert.deepEqual(activity.invokedBy, invoker);
});

test("a session with no invoker attaches without inventing one", () => {
	assert.equal(toJiraIssueDemoAttachedActivity(CLAUDE).invokedBy, undefined);
	assert.ok(!("invokedBy" in toJiraIssueDemoAttachedActivity(CLAUDE)));
});
