"use strict";

/**
 * One Rovo chat turn: its phase, the facts it has shown or seen, and its stream-recovery counts.
 *
 * Phases: streaming (attempt n) → retry-pending → streaming … → post-stream → completed.
 * aborted and failed can follow any phase. Terminal phases ignore every later event.
 *
 * Facts are sticky for the whole turn, across tool-first retries and stuck-port reruns; only the
 * plan card's loading state goes back to false. A relevant tool call is also an actionable one,
 * and a pause handed to the paused tool call is also a deferred tool request.
 */

const ROVO_CHAT_TURN_PHASES = Object.freeze(["streaming", "retry-pending", "post-stream", "completed", "aborted", "failed"]);
const TERMINAL_PHASES = new Set(["completed", "aborted", "failed"]);

/**
 * After an attempt the turn either reruns the same attempt (a recovered stream), asks the
 * tool-first retry plan, or ends its stream phase.
 * @typedef {"rerun" | "plan-retry" | "end"} RovoChatTurnNextStep
 */

function createRovoChatTurnFacts() {
	return {
		actionableToolCall: false,
		deferredToolRequest: false,
		genuiWidget: false,
		pausedToolCallHandled: false,
		plan: { data: false, loading: false, signal: false },
		planFeedbackToolBlocked: false,
		port: null,
		questionCard: false,
		relevantActionableToolCall: false,
		toolExecution: false,
	};
}

function createRovoChatTurnState({
	activeAttemptMessage = null,
	attempt = 1,
	forcePortRecoveryAttempts = 0,
	retriedAsDeferredToolResponse = false,
	stuckPortRetries = 0,
} = {}) {
	return {
		activeAttemptMessage,
		attempt,
		facts: createRovoChatTurnFacts(),
		/** @type {RovoChatTurnNextStep | null} */
		next: null,
		phase: "streaming",
		recovery: { forcePortRecoveryAttempts, retriedAsDeferredToolResponse, stuckPortRetries },
	};
}

function withFacts(state, update) {
	return { ...state, facts: { ...state.facts, ...update } };
}

function withPlan(state, update) {
	return withFacts(state, { plan: { ...state.facts.plan, signal: true, ...update } });
}

function applyRecovery(state, recovery = {}) {
	const next = recovery.shouldContinueToolFirstRetry === false || recovery.action === "stream-timeout"
		? "end"
		: recovery.action === "retry-stream" ? "rerun" : "plan-retry";
	return {
		...state,
		activeAttemptMessage: recovery.activeAttemptMessage || state.activeAttemptMessage,
		next,
		recovery: {
			forcePortRecoveryAttempts: recovery.forcePortRecoveryAttemptCount ?? state.recovery.forcePortRecoveryAttempts,
			retriedAsDeferredToolResponse: state.recovery.retriedAsDeferredToolResponse || recovery.hasRetriedAsDeferredToolResponse === true,
			stuckPortRetries: recovery.stuckPortRecoveryRetryCount ?? state.recovery.stuckPortRetries,
		},
	};
}

function rovoChatTurnReducer(state, event) {
	if (TERMINAL_PHASES.has(state.phase)) {
		return state;
	}
	switch (event?.type) {
		case "port-acquired":
			return withFacts(state, { port: event.port });
		case "question-card-emitted":
			return withFacts(state, { questionCard: true });
		case "plan-loading":
			return withPlan(state, { loading: event.loading === true });
		case "plan-data":
			return withPlan(state, { data: true });
		case "genui-widget-emitted":
			return withFacts(state, { genuiWidget: true });
		case "tool-execution-observed":
			return withFacts(state, { toolExecution: true });
		case "tool-call-observed":
			return withFacts(state, {
				actionableToolCall: true,
				relevantActionableToolCall: state.facts.relevantActionableToolCall || event.relevant === true,
			});
		case "deferred-tool-request-observed":
			return withFacts(state, { deferredToolRequest: true });
		case "paused-tool-call-handled":
			return withFacts(state, { deferredToolRequest: true, pausedToolCallHandled: true });
		case "plan-feedback-tool-blocked":
			return withFacts(state, { planFeedbackToolBlocked: true });
		case "attempt-started":
			return {
				...state,
				activeAttemptMessage: event.activeAttemptMessage ?? state.activeAttemptMessage,
				attempt: event.attempt ?? state.attempt,
				next: null,
				phase: "streaming",
			};
		case "attempt-finished":
			return state.phase === "streaming" ? { ...state, next: "plan-retry" } : state;
		case "attempt-failed":
			return state.phase === "streaming" ? applyRecovery(state, event.recovery) : state;
		case "retry-scheduled":
			return state.phase === "streaming" ? { ...state, next: null, phase: "retry-pending" } : state;
		case "post-stream-started":
			return { ...state, next: null, phase: "post-stream" };
		case "completed":
			return state.phase === "post-stream" ? { ...state, phase: "completed" } : state;
		case "aborted":
			return { ...state, next: null, phase: "aborted" };
		case "failed":
			return { ...state, next: null, phase: "failed" };
		default:
			return state;
	}
}

/** A turn's single owner of its state; callbacks dispatch, readers get the current state. */
function createRovoChatTurn(initialState) {
	let state = createRovoChatTurnState(initialState);
	return {
		dispatch(event) {
			state = rovoChatTurnReducer(state, event);
			return state;
		},
		getState: () => state,
	};
}

module.exports = {
	ROVO_CHAT_TURN_PHASES,
	createRovoChatTurn,
	createRovoChatTurnState,
	rovoChatTurnReducer,
};
