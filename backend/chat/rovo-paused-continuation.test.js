"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
	abandonPausedRovoToolCall,
	buildPausedRovoResumeDecisions,
	runPausedRovoToolContinuation,
} = require("./rovo-paused-continuation");

function createPausedRecord(overrides = {}) {
	return {
		handle: {
			settleLease: () => true,
		},
		kind: "clarification",
		port: 43124,
		toolCallId: "paused-tool-1",
		...overrides,
	};
}

test("buildPausedRovoResumeDecisions builds clarification decisions", () => {
	const decisions = buildPausedRovoResumeDecisions({
		adaptClarificationAnswersForToolContract: () => "adapted",
		buildClarificationResumeDecision: ({
			buildDenyMessageFn,
			clarificationSubmission,
			clarificationToolCallId,
			setChatAccepted,
		}) => ({
			tool_call_id: clarificationToolCallId,
			deny_message: buildDenyMessageFn(clarificationSubmission),
			setChatAccepted,
		}),
		buildClarificationResumeDenyMessage: (_submission, adapt) => adapt(),
		clarificationSubmission: { answers: { choice: "A" } },
		hasPausedClarificationToolCall: true,
		pausedToolCallRecord: createPausedRecord(),
	});

	assert.deepEqual(decisions, [{
		tool_call_id: "paused-tool-1",
		deny_message: "adapted",
		setChatAccepted: false,
	}]);
});

test("runPausedRovoToolContinuation resumes, replays, and releases on success", async () => {
	const replayCalls = [];
	const resumeCalls = [];
	let releaseCount = 0;
	const pausedToolCallRecord = createPausedRecord({
		handle: {
			settleLease(disposition) {
				if (disposition === "release") releaseCount += 1;
				return true;
			},
		},
	});

	await runPausedRovoToolContinuation({
		approvalSubmission: { decision: "approved" },
		buildApprovalResumeDecision: (approvalSubmission) => approvalSubmission.decision,
		getPausedToolCallHandled: () => false,
		hasPausedApprovalToolCall: true,
		logger: { info() {} },
		pausedToolCallRecord,
		replayViaRovo: async (options) => {
			replayCalls.push({
				port: options.port,
				skipReplayUntilToolCallId: options.skipReplayUntilToolCallId,
			});
		},
		rovoCancelChat: async () => {
			throw new Error("cancel should not run");
		},
		rovoResumeToolCalls: async (...args) => {
			resumeCalls.push(args);
		},
		streamCommonOptions: {
			onTextDelta() {},
		},
	});

	assert.deepEqual(resumeCalls, [[
		43124,
		{
			decisions: [{
				tool_call_id: "paused-tool-1",
				deny_message: "approved",
			}],
		},
	]]);
	assert.deepEqual(replayCalls, [{
		port: 43124,
		skipReplayUntilToolCallId: "paused-tool-1",
	}]);
	assert.equal(releaseCount, 1);
});

test("runPausedRovoToolContinuation cancels and releases when replay fails", async () => {
	const cancelCalls = [];
	let releaseCount = 0;
	const pausedToolCallRecord = createPausedRecord({
		handle: {
			settleLease(disposition) {
				if (disposition === "release") releaseCount += 1;
				return true;
			},
		},
	});

	await assert.rejects(
		runPausedRovoToolContinuation({
			approvalSubmission: { decision: "approved" },
			buildApprovalResumeDecision: (approvalSubmission) => approvalSubmission.decision,
			getPausedToolCallHandled: () => false,
			hasPausedApprovalToolCall: true,
			logger: { info() {} },
			pausedToolCallRecord,
			replayViaRovo: async () => {
				throw new Error("replay failed");
			},
			rovoCancelChat: async (...args) => {
				cancelCalls.push(args);
			},
			rovoResumeToolCalls: async () => {},
			streamCommonOptions: {},
		}),
		/replay failed/u,
	);

	assert.deepEqual(cancelCalls, [[43124, { timeoutMs: 3_000 }]]);
	assert.equal(releaseCount, 1);
});

test("a continuation with no resume decision cancels the paused turn and ends its lease", async () => {
	const settles = [];
	const cancels = [];
	const pausedToolCallRecord = createPausedRecord({
		handle: {
			settleLease: (disposition, options) => {
				settles.push([disposition, options]);
				return true;
			},
		},
	});

	await assert.rejects(
		runPausedRovoToolContinuation({
			pausedToolCallRecord,
			rovoCancelChat: async (port, options) => {
				cancels.push([port, options.timeoutMs]);
			},
		}),
		/missing a resume decision/u,
	);

	assert.deepEqual(cancels, [[43124, 3000]]);
	assert.deepEqual(settles, [["release", {}]]);
});

test("an abandoned paused call whose cancel fails is quarantined", async () => {
	const settles = [];
	await abandonPausedRovoToolCall(
		createPausedRecord({
			handle: {
				settleLease: (disposition, options) => {
					settles.push([disposition, options]);
					return true;
				},
			},
		}),
		{
			rovoCancelChat: async () => {
				throw new Error("cancel failed");
			},
		},
	);
	assert.deepEqual(settles, [["unhealthy", { reason: "paused tool call abandoned" }]]);
});
