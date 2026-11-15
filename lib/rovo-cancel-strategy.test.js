const test = require("node:test");
const assert = require("node:assert/strict");

const {
	shouldSendExplicitRovoCancel,
} = require("./rovo-cancel-strategy.ts");

test("shouldSendExplicitRovoCancel skips explicit cancel when a useChat turn stops in time", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: true,
			stopSettledInTime: true,
		}),
		false,
	);
});

test("shouldSendExplicitRovoCancel escalates when a useChat turn does not stop in time", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: true,
			stopSettledInTime: false,
		}),
		true,
	);
});

test("shouldSendExplicitRovoCancel still allows explicit cancel for non-useChat turns", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: false,
			stopSettledInTime: true,
		}),
		true,
	);
});

test("shouldSendExplicitRovoCancel escalates when background work remains cancelable", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			hasBackgroundCancelableWork: true,
			hasUseChatTurn: true,
			stopSettledInTime: true,
		}),
		true,
	);
});

test("shouldSendExplicitRovoCancel always cancels on an explicit user Stop, even when stop() settled in time", () => {
	assert.equal(
		shouldSendExplicitRovoCancel({
			explicitUserCancel: true,
			hasBackgroundCancelableWork: false,
			hasUseChatTurn: true,
			stopSettledInTime: true,
		}),
		true,
	);
});
