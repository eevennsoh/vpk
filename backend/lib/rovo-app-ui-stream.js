const { getAiSdk } = require("./ai-sdk-runtime");

function unwrapUiMessageChunk(result) {
	if (result && typeof result === "object") {
		if (result.success === true) {
			return result.value;
		}
		if (result.success === false) {
			if (result.error instanceof Error) {
				throw result.error;
			}

			const details =
				result.rawValue !== undefined
					? ` Received: ${JSON.stringify(result.rawValue)}`
					: "";
			throw new Error(`Invalid Rovo UI message chunk.${details}`);
		}
	}

	throw new Error("Unexpected Rovo UI message chunk shape.");
}

function toUiMessageChunkStream(stream) {
	const { parseJsonEventStream, uiMessageChunkSchema } = getAiSdk();
	return parseJsonEventStream({
		schema: uiMessageChunkSchema,
		stream,
	}).pipeThrough(
		new TransformStream({
			transform(result, controller) {
				try {
					controller.enqueue(unwrapUiMessageChunk(result));
				} catch {
					// Stream was closed (e.g. consumer aborted) — drop the chunk.
				}
			},
		}),
	);
}

function normalizeRoutingDecision(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const candidate = value;
	const intent = typeof candidate.intent === "string" ? candidate.intent.trim() : "";
	const presentation =
		typeof candidate.presentation === "string"
			? candidate.presentation.trim()
			: "";
	const confidence =
		typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
			? Math.max(0, Math.min(1, candidate.confidence))
			: null;
	const reason = typeof candidate.reason === "string" ? candidate.reason.trim() : "";
	const origin = typeof candidate.origin === "string" ? candidate.origin.trim() : "";
	if (!intent || !presentation || confidence === null || !reason || !origin) {
		return null;
	}

	return {
		intent,
		presentation,
		confidence,
		reason,
		origin,
	};
}

function shouldSuppressRouteDecisionChunk(chunk, routeDecisionToSuppress) {
	if (!routeDecisionToSuppress || chunk?.type !== "data-route-decision") {
		return false;
	}

	const normalizedChunkDecision = normalizeRoutingDecision(chunk.data);
	const normalizedSuppressedDecision = normalizeRoutingDecision(routeDecisionToSuppress);
	if (!normalizedChunkDecision || !normalizedSuppressedDecision) {
		return false;
	}

	return (
		normalizedChunkDecision.intent === normalizedSuppressedDecision.intent &&
		normalizedChunkDecision.presentation === normalizedSuppressedDecision.presentation &&
		normalizedChunkDecision.confidence === normalizedSuppressedDecision.confidence &&
		normalizedChunkDecision.reason === normalizedSuppressedDecision.reason &&
		normalizedChunkDecision.origin === normalizedSuppressedDecision.origin
	);
}

function createTappedChunkStream(
	stream,
	{
		onChunk,
		routeDecisionToSuppress,
	} = {},
) {
	const chunkStream = toUiMessageChunkStream(stream);

	return chunkStream.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				if (shouldSuppressRouteDecisionChunk(chunk, routeDecisionToSuppress)) {
					return;
				}

				if (typeof onChunk === "function") {
					onChunk(chunk);
				}
				try {
					controller.enqueue(chunk);
				} catch {
					// Stream was closed (e.g. consumer aborted) — drop the chunk.
				}
			},
		}),
	);
}

function createUiMessageChunkSseStream({
	onChunk,
	routeDecisionToSuppress,
	stream,
}) {
	const { JsonToSseTransformStream } = getAiSdk();
	return createTappedChunkStream(stream, {
		onChunk,
		routeDecisionToSuppress,
	}).pipeThrough(new JsonToSseTransformStream());
}

function upsertMessage(messages, nextMessage) {
	const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);
	if (existingIndex === -1) {
		return [...messages, nextMessage];
	}

	return messages.map((message) =>
		message.id === nextMessage.id ? nextMessage : message,
	);
}

// `onStreamMessage` receives each message exactly as the response stream yielded it:
// built from the stream's chunks alone, before it is merged into `initialMessages`
// (which hold the request's history and may come from a client).
async function collectUiMessagesFromResponseStream({
	initialMessages = [],
	onChunk,
	onMessagesUpdated,
	onStreamMessage,
	routeDecisionToSuppress,
	stream,
}) {
	const { readUIMessageStream } = getAiSdk();
	const messages = Array.isArray(initialMessages) ? [...initialMessages] : [];

	try {
		for await (const message of readUIMessageStream({
			stream: createTappedChunkStream(stream, {
				onChunk,
				routeDecisionToSuppress,
			}),
		})) {
			if (typeof onStreamMessage === "function") {
				onStreamMessage(message);
			}
			messages.splice(0, messages.length, ...upsertMessage(messages, message));
			if (typeof onMessagesUpdated === "function") {
				void Promise.resolve(onMessagesUpdated([...messages])).catch(() => {});
			}
		}
	} catch (error) {
		// The AI SDK's createAsyncIterableStream .throw() method rethrows
		// instead of returning { done: true }, which causes V8 to emit
		// "generator didn't stop after athrow()" when the underlying stream
		// errors (e.g. Rovo disconnect mid-stream). Swallow it here —
		// the run-level catch in startManagedRovoAppRun handles the
		// failure via failRovoAppRun.
		const msg = error instanceof Error ? error.message : String(error);
		if (/generator didn.t stop after athrow/i.test(msg)) {
			console.warn("[FUTURE-CHAT] Stream iterator athrow — partial messages collected:", {
				messageCount: messages.length,
			});
		} else {
			throw error;
		}
	}

	return messages;
}

module.exports = {
	collectUiMessagesFromResponseStream,
	createUiMessageChunkSseStream,
	createTappedChunkStream,
	toUiMessageChunkStream,
};
