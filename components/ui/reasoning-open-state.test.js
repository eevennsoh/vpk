const test = require("node:test");
const assert = require("node:assert/strict");

const {
	shouldAutoExpandReasoning,
	shouldScheduleCompletionAutoCollapse,
	shouldScheduleTimelineAutoCollapse,
	shouldScheduleToolIdleAutoCollapse,
} = require("./reasoning-open-state.ts");

const AUTO_EXPAND_BASE = {
	autoExpandOnDetails: true,
	hasDetails: true,
	isStreaming: true,
	isOpen: false,
	isExplicitlyClosed: false,
	hasUserClosed: false,
};

test("auto-expands when details appear during streaming and user has not closed", () => {
	assert.equal(shouldAutoExpandReasoning(AUTO_EXPAND_BASE), true);
});

test("does not auto-expand after manual user collapse", () => {
	assert.equal(shouldAutoExpandReasoning({ ...AUTO_EXPAND_BASE, hasUserClosed: true }), false);
});

test("does not auto-expand when details are not available", () => {
	assert.equal(shouldAutoExpandReasoning({ ...AUTO_EXPAND_BASE, hasDetails: false }), false);
});

test("collapses when tools go idle while open", () => {
	assert.equal(shouldScheduleToolIdleAutoCollapse({ toolsRunning: false, prevToolsRunning: true, isOpen: true }), true);
	assert.equal(shouldScheduleToolIdleAutoCollapse({ toolsRunning: true, prevToolsRunning: true, isOpen: true }), false);
});

test("does not schedule timeline auto-collapse when disabled", () => {
	assert.equal(
		shouldScheduleTimelineAutoCollapse({
			allowAutoCollapse: false,
			isStreaming: true,
			isOpen: true,
			hasAutoCollapsedAtCount: false,
			timelineEntryCount: 6,
			autoCollapseAtCount: 5,
		}),
		false
	);
});

test("does not schedule completion auto-collapse when disabled", () => {
	assert.equal(
		shouldScheduleCompletionAutoCollapse({
			allowAutoCollapse: false,
			hasEverStreamed: true,
			isStreaming: false,
			isOpen: true,
			hasAutoCollapsedOnCompletion: false,
		}),
		false
	);
});

test("schedules completion auto-collapse only after streaming completes", () => {
	assert.equal(
		shouldScheduleCompletionAutoCollapse({
			allowAutoCollapse: true,
			hasEverStreamed: true,
			isStreaming: false,
			isOpen: true,
			hasAutoCollapsedOnCompletion: false,
		}),
		true
	);

	assert.equal(
		shouldScheduleCompletionAutoCollapse({
			allowAutoCollapse: true,
			hasEverStreamed: true,
			isStreaming: true,
			isOpen: true,
			hasAutoCollapsedOnCompletion: false,
		}),
		false
	);
});
