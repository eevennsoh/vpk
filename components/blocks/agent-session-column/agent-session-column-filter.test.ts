import assert from "node:assert/strict";
import test from "node:test";

import type { AgentSessionItem } from "../agent-session/agent-session-types";

import { AGENT_SESSION_FILTER_AGENT_OPTIONS, EMPTY_AGENT_SESSION_COLUMN_FILTER, UNASSIGNED_OWNER_ID, agentSessionContainsArtifacts, agentSessionFilterToggleTriState, agentSessionHasLinkSuggestion, agentSessionOwnerId, applyAgentSessionColumnFilter, collectAgentSessionFilterOwners, countAgentSessionColumnFilterSelections, resolveAgentSessionFilterAgentId, resolveAgentSessionFilterDaysRange, shouldKeepAgentSessionFilterMenuOpen, toggleFilterId, toggleFilterTriState, toLocalIsoDate } from "./agent-session-column-filter.ts";

function session(
	id: string,
	overrides: Partial<AgentSessionItem> = {},
): AgentSessionItem {
	return {
		agent: { brandName: "claude", id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		state: "complete",
		title: `${id} title`,
		...overrides,
	};
}

test("toggleFilterId adds and removes a value without mutating the original", () => {
	const initial = ["priya"] as const;
	const added = toggleFilterId(initial, "jordan");
	const removed = toggleFilterId(added, "priya");

	assert.deepEqual(initial, ["priya"]);
	assert.deepEqual(added, ["priya", "jordan"]);
	assert.deepEqual(removed, ["jordan"]);
});

test("toggleFilterTriState treats a second click as clear", () => {
	assert.equal(toggleFilterTriState(null, "yes"), "yes");
	assert.equal(toggleFilterTriState("yes", "yes"), null);
	assert.equal(toggleFilterTriState("yes", "no"), "no");
});

test("overflow-style toggles map on to yes and off to an inactive filter", () => {
	assert.equal(agentSessionFilterToggleTriState(true), "yes");
	assert.equal(agentSessionFilterToggleTriState(false), null);
});

test("the filter menu stays open for in-menu clicks and nested calendar presses", () => {
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: false,
			nextOpen: true,
			reason: "trigger-press",
		}),
		false,
	);
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: false,
			focusOutStayedInside: true,
			nextOpen: false,
			reason: "focus-out",
		}),
		true,
	);
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: false,
			nextOpen: false,
			reason: "focus-out",
		}),
		false,
	);
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: false,
			nextOpen: false,
			reason: "outside-press",
		}),
		false,
	);
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: true,
			nextOpen: false,
			reason: "outside-press",
		}),
		true,
	);
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: true,
			nextOpen: false,
			reason: "escape-key",
		}),
		false,
	);
	assert.equal(
		shouldKeepAgentSessionFilterMenuOpen({
			customCalendarOpen: false,
			nextOpen: false,
			reason: "trigger-press",
		}),
		false,
	);
});

test("owners collect uniquely and keep Unassigned when a session has no invoker", () => {
	const items = [
		session("a", {
			invokedBy: {
				avatarSrc: "/avatar-user/priya.png",
				name: "Priya Raman",
			},
		}),
		session("b", {
			invokedBy: {
				avatarSrc: "/avatar-user/priya.png",
				name: "Priya Raman",
			},
		}),
		session("c"),
	];

	assert.equal(agentSessionOwnerId(items[2]!), UNASSIGNED_OWNER_ID);
	assert.deepEqual(
		collectAgentSessionFilterOwners(items).map((owner: { id: string }) => owner.id),
		["/avatar-user/priya.png", UNASSIGNED_OWNER_ID],
	);
});

test("agent ids resolve from brand, id, and Copilot aliases", () => {
	assert.equal(
		resolveAgentSessionFilterAgentId(session("claude")),
		"claude",
	);
	assert.equal(
		resolveAgentSessionFilterAgentId(session("codex", {
			agent: { brandName: "openai-codex", id: "codex", kind: "agent", name: "Codex" },
		})),
		"codex",
	);
	assert.equal(
		resolveAgentSessionFilterAgentId(session("cursor", {
			agent: { brandName: "cursor", id: "cursor", kind: "agent", name: "Cursor" },
		})),
		"cursor",
	);
	assert.equal(
		resolveAgentSessionFilterAgentId(session("copilot", {
			agent: {
				brandName: "github-copilot",
				id: "github-copilot",
				kind: "agent",
				name: "GitHub Copilot",
			},
		})),
		"copilot",
	);
	assert.equal(
		resolveAgentSessionFilterAgentId(session("rovo", {
			agent: { id: "rovo-dev", kind: "agent", name: "Rovo", vpkLogo: "rovo" },
		})),
		null,
	);
	assert.deepEqual(
		AGENT_SESSION_FILTER_AGENT_OPTIONS.map((option: { name: string }) => option.name),
		["Claude", "Codex", "Cursor", "Copilot"],
	);
});

test("artifacts follow PR status, pull request number, or a worktree", () => {
	assert.equal(agentSessionContainsArtifacts(session("plain")), false);
	assert.equal(
		agentSessionContainsArtifacts(session("pr", { prStatus: "created" })),
		true,
	);
	assert.equal(
		agentSessionContainsArtifacts(session("key", {
			sessionDetails: { host: "local", pullRequestNumber: 12 },
		})),
		true,
	);
	assert.equal(
		agentSessionContainsArtifacts(session("tree", {
			sessionDetails: { host: "local", worktreePath: ".worktrees/pay-101" },
		})),
		true,
	);
});

test("link suggestions read the session key and host overrides", () => {
	assert.equal(agentSessionHasLinkSuggestion(session("none")), false);
	assert.equal(
		agentSessionHasLinkSuggestion(session("named", {
			sessionDetails: { host: "local", issueKey: "PAY-101" },
		})),
		true,
	);
	assert.equal(
		agentSessionHasLinkSuggestion(
			session("override"),
			() => "PAY-200",
		),
		true,
	);
});

test("applyAgentSessionColumnFilter intersects owner, agent, artifacts, and link filters", () => {
	const priya = session("priya-claude", {
		invokedBy: { avatarSrc: "/avatar-user/priya.png", name: "Priya Raman" },
		prStatus: "created",
		sessionDetails: { host: "local", issueKey: "PAY-101" },
	});
	const jordan = session("jordan-cursor", {
		agent: { brandName: "cursor", id: "cursor", kind: "agent", name: "Cursor" },
		invokedBy: { avatarSrc: "/avatar-user/jordan.png", name: "Jordan Okafor" },
	});
	const items = [priya, jordan];

	assert.deepEqual(
		applyAgentSessionColumnFilter(items, EMPTY_AGENT_SESSION_COLUMN_FILTER).map(
			(item: AgentSessionItem) => item.id,
		),
		["priya-claude", "jordan-cursor"],
	);
	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			ownerIds: ["/avatar-user/priya.png"],
		}).map((item: AgentSessionItem) => item.id),
		["priya-claude"],
	);
	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			agentIds: ["cursor"],
		}).map((item: AgentSessionItem) => item.id),
		["jordan-cursor"],
	);
	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			containsArtifacts: "yes",
		}).map((item: AgentSessionItem) => item.id),
		["priya-claude"],
	);
	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			hasLinkSuggestion: "no",
		}).map((item: AgentSessionItem) => item.id),
		["jordan-cursor"],
	);
});

test("date presets and custom ranges include the session timestamp", () => {
	const now = new Date(2026, 8, 7, 12, 0, 0);
	const today = session("today", { startedAtMs: new Date(2026, 8, 7, 9, 0, 0).getTime() });
	const lastWeek = session("last-week", { startedAtMs: new Date(2026, 7, 31, 9, 0, 0).getTime() });
	const items = [today, lastWeek];

	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			days: { preset: "today" },
		}, { now }).map((item: AgentSessionItem) => item.id),
		["today"],
	);
	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			days: { preset: "last-7-days" },
		}, { now }).map((item: AgentSessionItem) => item.id),
		["today"],
	);
	assert.deepEqual(
		applyAgentSessionColumnFilter(items, {
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			days: { preset: "last-30-days" },
		}, { now }).map((item: AgentSessionItem) => item.id),
		["today", "last-week"],
	);

	const customRange = resolveAgentSessionFilterDaysRange({
		customEnd: toLocalIsoDate(now),
		customStart: toLocalIsoDate(now),
		endTime: "18:00",
		preset: "custom",
		startTime: "08:00",
	}, now);
	assert.ok(customRange);
	assert.equal(customRange.start.getHours(), 8);
	assert.equal(customRange.end.getHours(), 18);
});

test("countAgentSessionColumnFilterSelections treats each facet as one or more chips", () => {
	assert.equal(countAgentSessionColumnFilterSelections(EMPTY_AGENT_SESSION_COLUMN_FILTER), 0);
	assert.equal(
		countAgentSessionColumnFilterSelections({
			agentIds: ["claude", "cursor"],
			containsArtifacts: "yes",
			days: { preset: "today" },
			hasLinkSuggestion: null,
			ownerIds: ["/avatar-user/priya.png"],
		}),
		5,
	);
	assert.equal(
		countAgentSessionColumnFilterSelections({
			...EMPTY_AGENT_SESSION_COLUMN_FILTER,
			days: { customStart: "2026-09-01", preset: "custom" },
		}),
		0,
	);
});
