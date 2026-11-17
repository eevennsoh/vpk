"use strict";

// Drives one Rovo chat turn through the composed turn runner with a stand-in Rovo stream, for the
// turn-level behavior suites. The end-of-turn facts are read from the routing telemetry, which
// receives the turn's flags after the stream.

const { createRovoTurnRunner } = require("./rovo-chat-stream");
const { createContractDependencies, createRequestState } = require("./chat-sdk-handler.fixture");

function createTurn(overrides = {}) {
	return {
		...createRequestState({ backendPreference: "rovo" }),
		isStrictToolFirstTurn: false,
		isTaskLikeRequest: false,
		prefersGenuiCardExperience: false,
		smartGenerationActive: false,
		stageTrace: { mark() {}, requestId: "request-1" },
		toolFirstPolicy: { domains: [], enforcement: {}, relevanceDomains: [] },
		userMessageText: "Hello",
		...overrides,
	};
}

function createPortStuckError(port) {
	return Object.assign(new Error(`Rovo port ${port} is stuck`), { code: "ROVO_PORT_STUCK", port });
}

async function runTurn(dependencyOverrides = {}, turnOverrides = {}, signal = new AbortController().signal) {
	const parts = [];
	const attempts = [];
	let endOfTurnFacts = null;
	const { dependencies } = createContractDependencies({
		buildRovoTurnRoutingTelemetry: (facts) => {
			endOfTurnFacts = facts;
			return facts;
		},
		recordToolFirstAttempt: (_state, { isRetry }) => attempts.push(isRetry ? "retry" : "first"),
		...dependencyOverrides,
	});
	let result;
	let error;
	try {
		result = await createRovoTurnRunner(dependencies)(createTurn(turnOverrides), {
			signal,
			emit: (part) => parts.push(part),
		});
	} catch (caught) {
		error = caught;
	}
	return { activeRequests: dependencies.activeRequests, attempts, endOfTurnFacts, error, parts, result };
}

function visibleText(parts) {
	return parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
}

function widgetParts(parts, type) {
	return parts.filter((part) => part.data?.type === type).map((part) =>
		part.type === "data-widget-loading" ? `loading:${part.data.loading}` : part.type.replace(/^data-widget-/u, ""),
	);
}

function endsWithTurnComplete(parts) {
	return parts.at(-1)?.type === "data-turn-complete";
}

const BUSY_NOTICE = "⚠️ Rovo is busy.";

/** A stream that sends `chunks`, then fails on a stuck port that cannot recover. */
function failingAfterChunks(chunks, overrides = {}) {
	return {
		buildInteractiveStuckPortFailureMessage: () => "Rovo is busy.",
		restartRovoPort: async () => ({ recovered: false }),
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			for (const chunk of [chunks].flat()) {
				if (chunk) {
					onTextDelta(chunk);
				}
			}
			throw createPortStuckError(43123);
		},
		...overrides,
	};
}

module.exports = {
	BUSY_NOTICE,
	createPortStuckError,
	endsWithTurnComplete,
	failingAfterChunks,
	runTurn,
	visibleText,
	widgetParts,
};
