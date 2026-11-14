"use strict";

function getHandleReleaseErrorLogger(onReleaseError) {
	return typeof onReleaseError === "function"
		? onReleaseError
		: () => {};
}

function releasePausedToolHandle(
	record,
	{
		markUnhealthy = false,
		onReleaseError,
		unhealthyReason = "paused tool cleanup failed",
	} = {},
) {
	const logReleaseError = getHandleReleaseErrorLogger(onReleaseError);
	if (!record?.handle) {
		return;
	}

	try {
		record.handle.settleLease?.(
			markUnhealthy ? "unhealthy" : "release",
			markUnhealthy ? { reason: unhealthyReason } : {},
		);
	} catch (error) {
		logReleaseError(error);
	}
}

async function cancelActiveDeferredToolCallRecord(
	record,
	{
		cancelChat,
		timeoutMs = 3_000,
		waitForReady,
	} = {},
) {
	if (!record) {
		return null;
	}

	if (typeof cancelChat !== "function" || typeof waitForReady !== "function") {
		throw new TypeError(
			"cancelActiveDeferredToolCallRecord requires cancelChat and waitForReady functions.",
		);
	}

	await cancelChat(record.port, { timeoutMs });
	await waitForReady(record.port);
	return record;
}

async function cancelPausedDeferredToolCallRecord(
	record,
	{
		cancelChat,
		onReleaseError,
		timeoutMs = 3_000,
		unhealthyReason = "paused tool cleanup failed",
		waitForReady,
	} = {},
) {
	if (!record) {
		return null;
	}

	if (typeof cancelChat !== "function" || typeof waitForReady !== "function") {
		throw new TypeError(
			"cancelPausedDeferredToolCallRecord requires cancelChat and waitForReady functions.",
		);
	}

	try {
		await cancelChat(record.port, { timeoutMs });
		await waitForReady(record.port);
		releasePausedToolHandle(record, { onReleaseError });
		return record;
	} catch (error) {
		releasePausedToolHandle(record, {
			markUnhealthy: true,
			onReleaseError,
			unhealthyReason,
		});
		throw error;
	}
}

module.exports = {
	cancelActiveDeferredToolCallRecord,
	cancelPausedDeferredToolCallRecord,
};
