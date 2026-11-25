import assert from "node:assert/strict";
import test from "node:test";

import {
	isJiraIssueAttachChinArmed,
	JIRA_ISSUE_ATTACH_CHIN_NEARNESS,
	JIRA_ISSUE_MOTION_BACKDROP_NEARNESS,
	resolveJiraIssueAttachNearness,
} from "./attach-proximity.ts";
import { resolveAgentTintSeed } from "../agent-session/agent-brand-tint.ts";

test("the approach ramp is clamped to 0..1", () => {
	assert.equal(resolveJiraIssueAttachNearness(0, false), 0);
	assert.equal(resolveJiraIssueAttachNearness(0.42, false), 0.42);
	assert.equal(resolveJiraIssueAttachNearness(1, false), 1);
	assert.equal(resolveJiraIssueAttachNearness(-3, false), 0);
	assert.equal(resolveJiraIssueAttachNearness(4, false), 1);
});

test("a card with no board control behaves exactly as it does with no approach", () => {
	assert.equal(resolveJiraIssueAttachNearness(undefined, false), 0);
	assert.equal(resolveJiraIssueAttachNearness(Number.NaN, false), 0);
	assert.equal(resolveJiraIssueAttachNearness(Number.POSITIVE_INFINITY, false), 0);
});

test("reduced motion zeroes the ramp so the backdrop stays a binary switch", () => {
	// The reduced-motion branch spreads these values straight into `style` with
	// no transition, so a live ramp would repaint an opacity the user opted out
	// of on every pointer move.
	assert.equal(resolveJiraIssueAttachNearness(0.9, true), 0);
	assert.equal(resolveJiraIssueAttachNearness(1, true), 0);
	assert.equal(isJiraIssueAttachChinArmed(resolveJiraIssueAttachNearness(1, true)), false);
});

test("the chin opens at the threshold and not before", () => {
	assert.equal(JIRA_ISSUE_ATTACH_CHIN_NEARNESS, 0.55);
	assert.equal(isJiraIssueAttachChinArmed(0), false);
	assert.equal(isJiraIssueAttachChinArmed(0.54), false);
	assert.equal(isJiraIssueAttachChinArmed(0.55), true);
	assert.equal(isJiraIssueAttachChinArmed(1), true);
});

test("the backdrop catch-up uses duration-fast plus ease-out-practical", () => {
	assert.deepEqual(JIRA_ISSUE_MOTION_BACKDROP_NEARNESS, {
		duration: 0.1,
		ease: [0.4, 1, 0.6, 1],
	});
});

test("the tint seed prefers brand identity and lowercases it", () => {
	assert.equal(resolveAgentTintSeed({ brandName: "claude", name: "Claude" }), "claude");
	assert.equal(resolveAgentTintSeed({ brandName: "openai-codex", name: "Codex" }), "openai-codex");
	assert.equal(resolveAgentTintSeed({}), undefined);
	assert.equal(resolveAgentTintSeed({ vpkLogo: "  ", name: "Agent" }), "agent");
});

test("a Rovo session seeds the same tint whether it is detached or on a chin row", () => {
	// Detached still knows `vpkLogo`; the chin row has lost every brand field to
	// `toJiraIssueAgentActivityFromSession` and only still knows the name.
	const detached = resolveAgentTintSeed({ vpkLogo: "rovo", name: "Rovo" });
	const chin = resolveAgentTintSeed({ name: "Rovo" });
	assert.equal(detached, "rovo");
	assert.equal(chin, detached);
});
