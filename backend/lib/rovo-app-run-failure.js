"use strict";

function getNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function createRovoAppRunFailure({
	canRetry = true,
	code = "future_chat_run_failed",
	details,
	message,
} = {}) {
	const resolvedMessage = getNonEmptyString(message) || "Rovo run failed";
	const error = new Error(resolvedMessage);
	error.code = getNonEmptyString(code) || "future_chat_run_failed";
	error.details = getNonEmptyString(details) || undefined;
	error.canRetry = canRetry !== false;
	error.isRovoAppRunFailure = true;
	return error;
}

function isRovoAppRunFailure(error) {
	return Boolean(
		error &&
		typeof error === "object" &&
		error.isRovoAppRunFailure === true &&
		getNonEmptyString(error.message),
	);
}

function getRovoAppRunFailurePayload(error, fallbackMessage) {
	if (!isRovoAppRunFailure(error)) {
		return {
			code: "future_chat_run_failed",
			message: getNonEmptyString(fallbackMessage) || "Rovo run failed",
			details: undefined,
			canRetry: true,
		};
	}

	return {
		code: getNonEmptyString(error.code) || "future_chat_run_failed",
		message: getNonEmptyString(error.message) || "Rovo run failed",
		details: getNonEmptyString(error.details) || undefined,
		canRetry: error.canRetry !== false,
	};
}

// An aborted run (cancelled, or replaced by a newer request) ends without a failure card.
function isAbortLikeRunFailure(error) {
	const { message } = getRovoAppRunFailurePayload(error);
	return (
		typeof error === "object"
		&& error !== null
		&& (
			("name" in error && error.name === "AbortError")
			|| /abort/i.test(message)
		)
	);
}

function createSseDataChunk(payload) {
	return `data: ${JSON.stringify(payload)}\n\n`;
}

function createRovoAppFailureSseChunks(
	errorOrMessage,
	{
		now = () => Date.now(),
		nowDate = () => new Date(),
	} = {},
) {
	const failurePayload = getRovoAppRunFailurePayload(
		errorOrMessage,
		typeof errorOrMessage === "string" ? errorOrMessage : undefined,
	);
	const text = failurePayload.message;
	const textId = `rovo-app-error-${now()}`;
	return [
		createSseDataChunk({ type: "text-start", id: textId }),
		createSseDataChunk({ type: "text-delta", id: textId, delta: text }),
		createSseDataChunk({ type: "text-end", id: textId }),
		createSseDataChunk({
			type: "data-widget-error",
			id: `rovo-app-error-widget-${now()}`,
			data: {
				type: "question-card",
				code: failurePayload.code,
				message: text,
				details: failurePayload.details,
				canRetry: failurePayload.canRetry,
			},
		}),
		createSseDataChunk({
			type: "data-turn-complete",
			data: { timestamp: nowDate().toISOString() },
		}),
	];
}

module.exports = {
	createRovoAppFailureSseChunks,
	createRovoAppRunFailure,
	createSseDataChunk,
	getRovoAppRunFailurePayload,
	isAbortLikeRunFailure,
	isRovoAppRunFailure,
};
