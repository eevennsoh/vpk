import assert from "node:assert/strict";
import test from "node:test";

import {
	isJiraIssueSessionAttachPreview,
	isWithinJiraIssueDropZoneHalo,
	nextJiraIssueSessionTransferArmed,
	shouldCommitJiraIssueSessionTransferDrop,
} from "./agent-session-transfer-model.ts";

const UNLINK_RECT = { bottom: 40, left: 0, right: 100, top: 0 } as const;

test("a pointer inside the rect is within the halo", () => {
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 20 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 0, y: 0 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 100, y: 40 }, UNLINK_RECT, 12), true);
});

test("a pointer outside the rect but inside the halo still matches", () => {
	// Past every edge in turn: below, above, left, right.
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 48 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: -8 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: -10, y: 20 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 110, y: 20 }, UNLINK_RECT, 12), true);
});

test("halo edges are inclusive", () => {
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 52 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 53 }, UNLINK_RECT, 12), false);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: -12, y: 20 }, UNLINK_RECT, 12), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: -13, y: 20 }, UNLINK_RECT, 12), false);
});

test("a pointer outside the halo does not match", () => {
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 70 }, UNLINK_RECT, 12), false);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 500, y: 500 }, UNLINK_RECT, 12), false);
});

test("both axes must be inside: one axis alone is not enough", () => {
	// Inside horizontally, far outside vertically — and the reverse.
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 500 }, UNLINK_RECT, 12), false);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 500, y: 20 }, UNLINK_RECT, 12), false);
});

test("the halo defaults to zero so only rect containment matches", () => {
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 40 }, UNLINK_RECT), true);
	assert.equal(isWithinJiraIssueDropZoneHalo({ x: 50, y: 41 }, UNLINK_RECT), false);
});

test("a transfer drop commits on idle reset while the target was armed", () => {
	assert.equal(
		shouldCommitJiraIssueSessionTransferDrop({ armed: true, cancelled: false, dragging: false }),
		true,
	);
	assert.equal(
		shouldCommitJiraIssueSessionTransferDrop({ armed: false, cancelled: false, dragging: false }),
		false,
		"releasing off-target must not attach or unlink",
	);
	assert.equal(
		shouldCommitJiraIssueSessionTransferDrop({ armed: true, cancelled: false, dragging: true }),
		false,
		"commit waits for the idle transition, not a move while dragging",
	);
	assert.equal(
		shouldCommitJiraIssueSessionTransferDrop({ armed: true, cancelled: true, dragging: false }),
		false,
		"a cancelled gesture must not commit the armed target",
	);
});

test("an armed well stays armed when the target slides under a still pointer", () => {
	assert.equal(
		nextJiraIssueSessionTransferArmed({
			dragging: true,
			overTarget: true,
			pointerMoved: false,
			previousArmed: false,
		}),
		true,
	);
	assert.equal(
		nextJiraIssueSessionTransferArmed({
			dragging: true,
			overTarget: false,
			pointerMoved: false,
			previousArmed: true,
		}),
		true,
		"chin collapse must not disarm a well the pointer has not left",
	);
	assert.equal(
		nextJiraIssueSessionTransferArmed({
			dragging: true,
			overTarget: false,
			pointerMoved: true,
			previousArmed: true,
		}),
		false,
		"moving off the well still disarms",
	);
	assert.equal(
		nextJiraIssueSessionTransferArmed({
			dragging: false,
			overTarget: false,
			pointerMoved: false,
			previousArmed: true,
		}),
		false,
		"idle clears the arm so a later hover cannot commit",
	);
	assert.equal(
		nextJiraIssueSessionTransferArmed({
			dragging: true,
			overTarget: false,
			pointerMoved: false,
			previousArmed: false,
		}),
		false,
	);
});

test("attach chin preview is live-gesture only, not a leftover detached source", () => {
	assert.equal(isJiraIssueSessionAttachPreview(true, "detached"), true);
	assert.equal(isJiraIssueSessionAttachPreview(false, "detached"), false);
	assert.equal(isJiraIssueSessionAttachPreview(true, "chin"), false);
	assert.equal(isJiraIssueSessionAttachPreview(false, "chin"), false);
});
