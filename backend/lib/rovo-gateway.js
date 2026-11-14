/**
 * Rovo Gateway — bridges Rovo Serve SSE events into the AI SDK
 * `createUIMessageStream` writer protocol.
 *
 * This module lets us keep `@ai-sdk/react` `useChat()` on the frontend
 * while routing all LLM traffic through Rovo Serve on the backend.
 *
 * Usage in an Express route:
 *
 *   const { streamViaRovo, generateTextViaRovo } = require("./rovo-gateway");
 *
 *   // Streaming (inside createUIMessageStream execute callback)
 *   await streamViaRovo({ message: fullMessage, onTextDelta: handleStreamTextDelta });
 *
 *   // Non-streaming (title, suggestions, clarification)
 *   const text = await generateTextViaRovo({ system, prompt });
 */

const {
	sendMessageStreaming,
	replayStreaming,
	sendMessageSync,
	cancelChat,
	getRovoPort,
	resumeToolCalls,
} = require("./rovo-client");
const {
	createAbortCancelFailedError,
	createAbortError,
	createChatInProgressTimeoutError,
	createPortStuckError,
	isChatInProgressError,
	isPromptTooLongError,
	retryChatInProgress,
	shouldCancelConflictingTurn,
	throwIfAborted,
	RETRY_TIMEOUT_MS,
	WAIT_FOR_TURN_TIMEOUT_MS,
} = require("./rovo-gateway-conflict-retry");
const {
	buildThinkingStatusFromToolEvent,
	getThinkingActivityFromToolName,
	isGenericIntegrationWrapperToolName,
	parseToolCallArgsInput,
	resolveToolCallInput,
	resolveToolNameForToolEvent,
} = require("./rovo-gateway-tool-events");
const {
	buildSseEventError,
	buildWarningEvent,
	parseSseEventPayload,
} = require("./rovo-gateway-sse-events");
const {
	createRovoToolEventDispatcher,
} = require("./rovo-gateway-tool-event-dispatcher");
const {
	enqueueTextGeneration,
} = require("./rovo-gateway-text-generation-queue");
const {
	createRovoPortLease,
	createUnpooledPortHandle,
} = require("./rovo-port-lease");

/** @type {import("./rovo-pool").Pool | null} */
let _pool = null;

/**
 * Inject the Rovo port pool. Called once from server.js at startup.
 * @param {import("./rovo-pool").Pool | null} pool
 */
function initPool(pool) {
	_pool = pool;
}

/**
 * Acquire a port handle. When a pool is available, delegates to pool.acquire().
 * Otherwise returns a dummy handle using the single env-var port.
 *
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {AbortSignal} [opts.signal]
 * @param {number} [opts.preferredPort]
 * @param {number[]} [opts.avoidPorts]
 * @returns {Promise<import("./rovo-pool").PortHandle>}
 */
async function acquirePort({
	timeoutMs = 30_000,
	signal,
	preferredPort,
	avoidPorts,
} = {}) {
	if (!_pool) {
		return createUnpooledPortHandle(getRovoPort());
	}
	return _pool.acquire({ timeoutMs, signal, preferredPort, avoidPorts });
}

/**
 * Streams a message through Rovo Serve, calling `onTextDelta` for each
 * text chunk — matching the same callback interface as
 * `streamBedrockGatewayManualSse` and `streamGoogleGatewayManualSse`.
 *
 * This is designed to be called *inside* the `createUIMessageStream`
 * execute function where widget-marker parsing, text buffering and
 * writer calls are already handled.
 *
 * If a 409 "chat already in progress" error occurs, the function retries with
 * bounded backoff. The `conflictPolicy` controls whether to cancel the
 * conflicting turn ("cancel-and-retry") or wait patiently ("wait-for-turn").
 *
 * @param {object} params
 * @param {string} params.message - The full message to send to Rovo
 * @param {function} params.onTextDelta - Called with each text delta string
 * @param {function} [params.onThinkingStatus] - Called when Rovo emits tool events that map to thinking status labels/content
 * @param {function} [params.onThinkingEvent] - Called with structured tool timeline events
 * @param {function} [params.onWarning] - Called with structured warning events emitted by the Serve stream
 * @param {function} [params.onToolCallStart] - Called with structured tool-call details when a tool starts
 * @param {function} [params.onToolCallInputResolved] - Called with merged tool input once args deltas are complete or a start payload fallback is available
 * @param {function} [params.onToolCallResult] - Called with raw tool-result output (before preview truncation) for post-processing needs like question-card payload extraction
 * @param {function} [params.onDeferredToolRequest] - Called when Serve emits a deferred tool request after all available text/tool stream events
 * @param {function} [params.onPausedToolCalls] - Called when `pause_on_call_tools_start=true` pauses Serve tool execution
 * @param {boolean} [params.enableDeferredTools] - Enables Serve deferred-tool mode without pausing every tool start
 * @param {boolean} [params.pauseOnCallToolsStart] - Explicitly enable Serve's paused tool-start approval mode
 * @param {function} [params.onRetry] - Called when a 409 retry is about to happen (for UI indicators)
 * @param {function} [params.onRetryProgress] - Called for each 409 retry progress update
 * @param {"cancel-and-retry" | "wait-for-turn"} [params.conflictPolicy] - Conflict resolution policy
 * @param {number} [params.timeoutMs] - Max time to wait for chat-turn acquisition before timeout
 * @param {string} [params.sessionId] - Optional Serve session to restore before streaming
 * @param {AbortSignal} [params.signal] - Optional signal to abort the stream (e.g. on client disconnect)
 * @param {(port: number) => void} [params.onPortAcquired] - Called once with the resolved port after acquisition
 * @param {boolean} [params.cancelOnComplete] - Cancel lingering chat state before releasing the port after a successful stream
 * @param {boolean} [params.failOnError] - Reject on non-409 stream errors instead of writing inline warning text
 * @param {(stage: string, details?: object) => void} [params.onTimingStage] - Optional callback for low-level timing milestones
 * @param {number} [params.port] - Reuse an existing reserved port instead of acquiring one
 * @param {import("./rovo-pool").PortHandle} [params.portHandle] - Reserved handle paired with `port`
 * @returns {Promise<void>}
 */
async function streamViaRovo({
	message,
	onTextDelta,
	onSubagentTextDelta,
	onThinkingStatus,
	onThinkingEvent,
	onWarning,
	onToolCallStart,
	onToolCallInputResolved,
	onToolCallResult,
	onDeferredToolRequest,
	onPausedToolCalls,
	enableDeferredTools = false,
	pauseOnCallToolsStart = false,
	onRetry,
	onRetryProgress,
	conflictPolicy = "cancel-and-retry",
	timeoutMs,
	idleTimeoutMs,
	sessionId,
	signal,
	onPortAcquired,
	onComplete,
	cancelOnComplete = false,
	failOnError = false,
	onTimingStage,
	port: providedPort,
	portHandle: providedPortHandle,
	preferredPort,
	avoidPorts,
	skipSetChatMessage = false,
	includeSubagentEvents = false,
	cancelConflictTurn,
}) {
	const waitForTurn = conflictPolicy === "wait-for-turn";
	const resolvedTimeoutMs =
		typeof timeoutMs === "number" && timeoutMs > 0
			? timeoutMs
				: waitForTurn
					? WAIT_FOR_TURN_TIMEOUT_MS
					: RETRY_TIMEOUT_MS;
	if (typeof onTimingStage === "function") {
		onTimingStage("stream_acquire_start", {
			conflictPolicy,
			waitForTurn,
			timeoutMs: resolvedTimeoutMs,
		});
	}
	const acquireStartedAtMs = Date.now();
	const usingProvidedPort =
		Number.isInteger(providedPort) &&
		providedPort > 0 &&
		providedPortHandle &&
		typeof providedPortHandle === "object";
	if (usingProvidedPort) {
		providedPortHandle.resume?.();
	}
	const handle = usingProvidedPort
		? { ...providedPortHandle, port: providedPort }
		: await acquirePort({
			timeoutMs: waitForTurn
				? WAIT_FOR_TURN_TIMEOUT_MS
				: RETRY_TIMEOUT_MS,
			signal,
			preferredPort,
			avoidPorts,
		});
	if (typeof onTimingStage === "function") {
		onTimingStage("stream_acquire_complete", {
			stageMs: Date.now() - acquireStartedAtMs,
			port: handle.port,
			waitForTurn,
			reusedPort: usingProvidedPort,
		});
	}

	if (typeof onPortAcquired === "function") {
		onPortAcquired(handle.port);
	}

	// One owner of the port's lease; a paused tool call can take it over (handOff).
	const lease = createRovoPortLease(handle, { logPrefix: "streamViaRovo" });
	let abortedBySignal = false;

	try {
		const attempt = (port) =>
			new Promise((resolve, reject) => {
				if (signal?.aborted) {
					abortedBySignal = true;
					resolve();
					return;
				}

				let onAbort = null;
				let sawExceptionEvent = false;
				const toolEventDispatcher = createRovoToolEventDispatcher({
					onTextDelta,
					onSubagentTextDelta,
					suppressSubagentText: true,
					onThinkingStatus,
					onThinkingEvent,
					onToolCallStart,
					onToolCallInputResolved,
					onToolCallResult,
					onDeferredToolRequest,
				});

				const streamHandle = sendMessageStreaming(message, {
					onChunk: (chunk) => {
						toolEventDispatcher.handleChunk(chunk);
					},
					onPauseToolCalls: async (rawEvent, control) => {
						if (typeof onPausedToolCalls !== "function") {
							await resumeToolCalls(port, {
								decisions: (Array.isArray(rawEvent?.parts) ? rawEvent.parts : [])
									.map((part) => {
										const toolCallId =
											typeof part?.tool_call_id === "string" && part.tool_call_id.trim()
												? part.tool_call_id.trim()
												: null;
										return toolCallId
											? { tool_call_id: toolCallId, deny_message: null }
											: null;
									})
									.filter(Boolean),
							});
							return { disconnect: false };
						}

						return onPausedToolCalls({
							rawEvent,
							port,
							control: {
								port,
								disconnect: control.disconnect,
								resume: (decisions) => resumeToolCalls(port, decisions),
								reservePort: () => lease.handOff(),
							},
						});
					},
					onDone: () => {
							if (signal && onAbort) {
								signal.removeEventListener("abort", onAbort);
							}
							resolve();
						},
					onError: (err) => {
							if (signal && onAbort) {
								signal.removeEventListener("abort", onAbort);
							}
							if (sawExceptionEvent) {
								reject(err);
								return;
							}
							if (isChatInProgressError(err)) {
								reject(err);
								return;
							}
							console.error("[streamViaRovo] Error:", err.message);
							const userFacingErrorMessage = isPromptTooLongError(err)
								? "This conversation has become too long for the model to process. Please start a new chat session to continue."
								: `Rovo error: ${err.message}`;
							if (failOnError) {
								const streamError = new Error(userFacingErrorMessage);
								streamError.cause = err;
								reject(streamError);
								return;
							}
							onTextDelta(`\n\n⚠️ ${userFacingErrorMessage}`);
							resolve();
						},
						onEvent: (eventName, rawData) => {
							const normalizedEventName =
								typeof eventName === "string" ? eventName.trim() : "";
							if (!normalizedEventName) {
								return;
							}

							const parsed = parseSseEventPayload(rawData);
							if (normalizedEventName === "warning") {
								const warningEvent = buildWarningEvent(normalizedEventName, rawData, parsed);
								if (typeof onWarning === "function") {
									onWarning(warningEvent);
									return;
								}

								console.warn(
									`[streamViaRovo] Warning event received: ${warningEvent.message}`
								);
								return;
							}

							if (normalizedEventName === "exception") {
								sawExceptionEvent = true;
								const exceptionEvent = buildSseEventError(normalizedEventName, rawData, parsed);
								console.error(
									`[streamViaRovo] Exception event received: ${exceptionEvent.message}`
								);
							}
						},
					},
					port,
					{
						onTimingStage,
						sessionId,
						pauseOnCallToolsStart,
						includeSubagentEvents,
						enableDeferredTools,
						skipSetChatMessage,
						idleTimeoutMs,
					}
				);

				if (signal) {
					onAbort = () => {
						abortedBySignal = true;
						Promise.resolve(streamHandle.abort()).then(
							() => {
								resolve();
							},
							(error) => {
								reject(createAbortCancelFailedError(port, error));
							}
						);
					};

					if (signal.aborted) {
						onAbort();
					} else {
						signal.addEventListener("abort", onAbort, { once: true });
					}
				}
			});

		if (waitForTurn) {
			// Single attempt — no retry. 409 means the port is terminally
			// stuck and must be restarted (retrying won't help). The caller
			// catches ROVO_PORT_STUCK and triggers restartRovoPort.
			try {
				await attempt(handle.port);
			} catch (err) {
				if (isChatInProgressError(err)) {
					console.error(
						`[streamViaRovo] Port ${handle.port} stuck (409) — cancelling turn, marking unhealthy`
					);
					try {
						await cancelChat(handle.port, { timeoutMs: 3_000 });
					} catch {}
					lease.settle("unhealthy", "chat in progress after wait-for-turn");
					throw createPortStuckError(handle.port);
				}
				if (err?.code === "ROVO_ABORT_CANCEL_FAILED") {
					lease.settle("unhealthy", err.message);
				}
				throw err;
			}
			if (abortedBySignal || signal?.aborted) {
				return;
			}
		} else {
			// Cancel-and-retry mode for background tasks
			try {
				const { aborted } = await retryChatInProgress(
					() => attempt(handle.port),
					{
						signal,
						onRetry,
						onRetryProgress,
						logPrefix: "streamViaRovo",
						timeoutMs: resolvedTimeoutMs,
						cancelOnConflict: true,
						port: handle.port,
						...(typeof cancelConflictTurn === "function" ? { cancelConflictTurn } : {}),
					}
				);
				if (aborted || abortedBySignal || signal?.aborted) {
					return;
				}
			} catch (err) {
				if (isChatInProgressError(err)) {
					throw createChatInProgressTimeoutError(resolvedTimeoutMs, {
						logPrefix: "streamViaRovo",
						retryCount:
							typeof err?.chatInProgressRetryCount === "number"
								? err.chatInProgressRetryCount
								: undefined,
						elapsedMs:
							typeof err?.chatInProgressElapsedMs === "number"
								? err.chatInProgressElapsedMs
								: undefined,
					});
				}
				if (err?.code === "ROVO_ABORT_CANCEL_FAILED") {
					lease.settle("unhealthy", err.message);
				}
				throw err;
			}
		}
	} finally {
		// Run post-stream callback (e.g. suggestion generation) while
		// we still hold the port handle — avoids re-acquisition contention.
		// Skip once the lease is settled (a stuck port) or handed to a paused tool call.
		if (
			lease.isHeld() &&
			!abortedBySignal &&
			!signal?.aborted &&
			typeof onComplete === "function"
		) {
			try {
				await onComplete(handle.port);
			} catch (onCompleteErr) {
				console.warn(
					"[streamViaRovo] onComplete callback error:",
					onCompleteErr?.message || onCompleteErr
				);
			}
		}
		if (
			lease.isHeld() &&
			!abortedBySignal &&
			!signal?.aborted &&
			cancelOnComplete
		) {
			try {
				await cancelChat(handle.port, { timeoutMs: 3_000 });
			} catch (error) {
				console.warn(
					`[streamViaRovo] port ${handle.port} cancel failed during cleanup: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
				lease.settle(
					"unhealthy",
					error instanceof Error ? error.message : String(error)
				);
			}
		}
		lease.settle("release");
	}
}

async function replayViaRovo({
	port,
	portHandle,
	onTextDelta,
	onThinkingStatus,
	onThinkingEvent,
	onWarning,
	onToolCallStart,
	onToolCallInputResolved,
	onToolCallResult,
	onDeferredToolRequest,
	onPausedToolCalls,
	signal,
	failOnError = false,
	onTimingStage,
	skipReplayUntilToolCallId = null,
}) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			resolve();
			return;
		}

		let onAbort = null;
		let sawExceptionEvent = false;
		const normalizedSkipReplayUntilToolCallId =
			typeof skipReplayUntilToolCallId === "string" &&
			skipReplayUntilToolCallId.trim().length > 0
				? skipReplayUntilToolCallId.trim()
				: null;
		let hasCaughtUpToReplayBoundary = !normalizedSkipReplayUntilToolCallId;
		const normalizePausedToolCallId = (toolCallId) =>
			typeof toolCallId === "string" && toolCallId.trim()
				? toolCallId.trim()
				: null;
		const buildResumeDecisions = (parts) =>
			parts
				.map((part) => {
					const toolCallId = normalizePausedToolCallId(part?.tool_call_id);
					return toolCallId
						? { tool_call_id: toolCallId, deny_message: null }
						: null;
				})
				.filter(Boolean);
		const toolEventDispatcher = createRovoToolEventDispatcher({
			onTextDelta,
			onThinkingStatus,
			onThinkingEvent,
			onToolCallStart,
			onToolCallInputResolved,
			onToolCallResult,
			onDeferredToolRequest,
		});

		const streamHandle = replayStreaming({
			onChunk: (chunk) => {
				if (!hasCaughtUpToReplayBoundary) {
					return;
				}

				toolEventDispatcher.handleChunk(chunk);
			},
			onDone: () => {
				if (signal && onAbort) {
					signal.removeEventListener("abort", onAbort);
				}
				resolve();
			},
			onError: (err) => {
				if (signal && onAbort) {
					signal.removeEventListener("abort", onAbort);
				}
				if (sawExceptionEvent || isChatInProgressError(err)) {
					reject(err);
					return;
				}
				const userFacingErrorMessage = isPromptTooLongError(err)
					? "This conversation has become too long for the model to process. Please start a new chat session to continue."
					: `Rovo error: ${err.message}`;
				if (failOnError) {
					const replayError = new Error(userFacingErrorMessage);
					replayError.cause = err;
					reject(replayError);
					return;
				}
				onTextDelta(`\n\n⚠️ ${userFacingErrorMessage}`);
				resolve();
			},
			onEvent: (eventName, rawData) => {
				const normalizedEventName =
					typeof eventName === "string" ? eventName.trim() : "";
				if (!normalizedEventName) {
					return;
				}

				const parsed = parseSseEventPayload(rawData);
				if (normalizedEventName === "warning") {
					const warningEvent = buildWarningEvent(normalizedEventName, rawData, parsed);
					if (typeof onWarning === "function") {
						onWarning(warningEvent);
						return;
					}

					console.warn(
						`[replayViaRovo] Warning event received: ${warningEvent.message}`,
					);
					return;
				}

				if (normalizedEventName === "exception") {
					sawExceptionEvent = true;
					const exceptionEvent = buildSseEventError(normalizedEventName, rawData, parsed);
					console.error(
						`[replayViaRovo] Exception event received: ${exceptionEvent.message}`,
					);
				}
			},
			onPauseToolCalls: async (rawEvent, control) => {
				const replayPausedParts = Array.isArray(rawEvent?.parts) ? rawEvent.parts : [];
				if (!hasCaughtUpToReplayBoundary && normalizedSkipReplayUntilToolCallId) {
					const matchedBoundary = replayPausedParts.some(
						(part) =>
							normalizePausedToolCallId(part?.tool_call_id) ===
							normalizedSkipReplayUntilToolCallId
					);

					if (!matchedBoundary) {
						const decisions = buildResumeDecisions(replayPausedParts);
						if (decisions.length > 0) {
							await resumeToolCalls(port, { decisions });
						}
						return { disconnect: false };
					}

					hasCaughtUpToReplayBoundary = true;
				}

				const pausedParts =
					hasCaughtUpToReplayBoundary && normalizedSkipReplayUntilToolCallId
						? replayPausedParts.filter(
							(part) =>
								normalizePausedToolCallId(part?.tool_call_id) !==
								normalizedSkipReplayUntilToolCallId
						)
						: replayPausedParts;
				if (pausedParts.length === 0) {
					return { disconnect: false };
				}
				const filteredRawEvent =
					pausedParts === replayPausedParts
						? rawEvent
						: {
							...(rawEvent && typeof rawEvent === "object" ? rawEvent : {}),
							parts: pausedParts,
						};

				if (typeof onPausedToolCalls !== "function") {
					await resumeToolCalls(port, {
						decisions: buildResumeDecisions(pausedParts),
					});
					return { disconnect: false };
				}

				return onPausedToolCalls({
					rawEvent: filteredRawEvent,
					port,
					control: {
						port,
						disconnect: control.disconnect,
						resume: (decisions) => resumeToolCalls(port, decisions),
						reservePort: () => {
							portHandle?.reserve?.("paused tool call");
							return portHandle ?? null;
						},
					},
				});
			},
		}, port, {
			onTimingStage,
		});

		if (signal) {
			onAbort = () => {
				streamHandle.abort();
				cancelChat(port, { timeoutMs: 3_000 }).catch(() => {});
				resolve();
			};

			if (signal.aborted) {
				onAbort();
			} else {
				signal.addEventListener("abort", onAbort, { once: true });
			}
		}
	});
}

/**
 * Non-streaming text generation via Rovo Serve.
 *
 * Replaces `generateTextViaGateway()` for tasks like:
 * - Chat title generation
 * - Suggested questions
 * - Clarification question card generation
 *
 * Combines system + prompt into a single message since Rovo
 * manages its own system prompt / context.
 *
 * @param {object} params
 * @param {string} [params.system] - System instructions
 * @param {string} params.prompt - The user prompt
 * @param {"cancel-and-retry" | "wait-for-turn"} [params.conflictPolicy]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<string>} The response text
 */
async function generateTextViaRovo({
	system,
	prompt,
	conflictPolicy = "cancel-and-retry",
	timeoutMs,
	signal,
	preferredPort,
	avoidPorts,
}) {
	throwIfAborted(signal, "Rovo text generation aborted");

	const waitForTurn = conflictPolicy === "wait-for-turn";
	const retryTimeoutMs =
		typeof timeoutMs === "number" && timeoutMs > 0
			? timeoutMs
			: waitForTurn
				? WAIT_FOR_TURN_TIMEOUT_MS
				: RETRY_TIMEOUT_MS;

	// Combine system + prompt since Rovo takes a single message
	let fullMessage = "";
	if (system) {
		fullMessage += `[System Instructions]\n${system}\n[End System Instructions]\n\n`;
	}
	fullMessage += prompt;

	const handle = await acquirePort({
		timeoutMs: waitForTurn ? WAIT_FOR_TURN_TIMEOUT_MS : RETRY_TIMEOUT_MS,
		signal,
		preferredPort,
		avoidPorts,
	});

	let portKnownStuck = false;
	const lease = createRovoPortLease(handle, { logPrefix: "generateTextViaRovo" });
	let abortCleanupPromise = null;

	const captureAbortCleanupPromise = (error) => {
		if (
			!abortCleanupPromise &&
			error &&
			typeof error === "object" &&
			typeof error.cancelCleanupPromise?.then === "function"
		) {
			abortCleanupPromise = error.cancelCleanupPromise;
		}
	};



	try {
		const syncOptions = {
			...(typeof timeoutMs === "number" && timeoutMs > 0 ? { timeoutMs } : {}),
			port: handle.port,
			signal,
		};

		if (_pool) {
			throwIfAborted(signal, "Rovo text generation aborted");

			if (waitForTurn) {
				// Single attempt — no retry. 409 is terminal (see streamViaRovo).
				try {
					const value = await sendMessageSync(fullMessage, syncOptions);
					return typeof value === "string" ? value : "";
				} catch (error) {
					captureAbortCleanupPromise(error);
					if (isChatInProgressError(error)) {
						portKnownStuck = true;
						console.error(
							`[generateTextViaRovo] Port ${handle.port} stuck (409) — marking unhealthy`
						);
						throw createPortStuckError(handle.port);
					}
					throw error;
				}
			}

			// Cancel-and-retry mode for background tasks
			try {
				const { value, aborted } = await retryChatInProgress(
					() => sendMessageSync(fullMessage, syncOptions),
					{
						signal,
						logPrefix: "generateTextViaRovo",
						timeoutMs: retryTimeoutMs,
						cancelOnConflict: true,
						port: handle.port,
					}
				);

				if (aborted) {
					throw createAbortError("Rovo text generation aborted");
				}

				return typeof value === "string" ? value : "";
			} catch (error) {
				captureAbortCleanupPromise(error);
				if (isChatInProgressError(error)) {
					portKnownStuck = true;
				}
				throw error;
			}
		}

		// No pool — single port fallback
		if (waitForTurn) {
			// Serialize via global queue (single port → global = per-port)
			// Single attempt, fail fast on 409
			return await enqueueTextGeneration(async () => {
				throwIfAborted(signal, "Rovo text generation aborted");
				try {
					return await sendMessageSync(fullMessage, syncOptions);
				} catch (err) {
					captureAbortCleanupPromise(err);
					if (isChatInProgressError(err)) {
						throw createPortStuckError(handle.port);
					}
					throw err;
				}
			}, {
				logPrefix: "generateTextViaRovo",
			});
		}

		// No pool, cancel-and-retry mode
		try {
			return await sendMessageSync(fullMessage, syncOptions);
		} catch (err) {
			captureAbortCleanupPromise(err);
			if (isChatInProgressError(err)) {
				try {
					const { value, aborted } = await retryChatInProgress(
						() => sendMessageSync(fullMessage, syncOptions),
						{
							signal,
							logPrefix: "generateTextViaRovo",
							timeoutMs: retryTimeoutMs,
							cancelOnConflict: true,
							port: handle.port,
						}
					);
					if (aborted) {
						throw createAbortError("Rovo text generation aborted");
					}
					return typeof value === "string" ? value : "";
				} catch (retryError) {
					throw retryError;
				}
			}
			throw err;
		}
	} finally {
		// Cancel any lingering session before releasing the port back to the pool.
		// IMPORTANT: No _recoverPort() calls here — process kills are too aggressive
		// for routine situations like classifier timeouts. The pool's periodic health
		// check (every 30s) handles recovery for genuinely stuck ports.
		if (_pool) {
			if (portKnownStuck) {
				// Port genuinely stuck (409 from sendMessageSync).
				// Mark unhealthy so the pool doesn't hand it out.
				// The pool's periodic health check (every 30s) will
				// recover it once the session clears naturally.
				const stuckPort = handle.port;
				console.warn(
					`[generateTextViaRovo] port ${stuckPort} got 409 — marking unhealthy`
				);
				lease.settle("unhealthy", "chat in progress conflict");

				// Fire-and-forget cancel attempt — don't kill the process
				cancelChat(stuckPort, { timeoutMs: 3_000 }).catch(() => {});
			} else if (signal?.aborted) {
				let cleanupError = null;
				if (abortCleanupPromise) {
					try {
						await abortCleanupPromise;
					} catch (error) {
						cleanupError = error;
					}
				} else {
					try {
						await cancelChat(handle.port, { timeoutMs: 3_000 });
					} catch (error) {
						cleanupError = error;
					}
				}
				if (cleanupError) {
					lease.settle(
						"unhealthy",
						cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
					);
				} else {
					lease.settle("release");
				}
			} else if (waitForTurn) {
				// In wait-for-turn mode the request completed naturally; avoid
				// extra cancellation churn and release the port immediately.
				lease.settle("release");
			} else {
				// Normal completion — cancel any lingering session and release.
				try {
					await cancelChat(handle.port, { timeoutMs: 3_000 });
				} catch (error) {
					console.warn(
						`[generateTextViaRovo] port ${handle.port} cancel failed during cleanup: ${
							error instanceof Error ? error.message : String(error)
						}`
					);
					lease.settle(
						"unhealthy",
						error instanceof Error ? error.message : String(error)
					);
				}
				lease.settle("release");
			}
		} else {
			lease.settle("release");
		}
	}
}

module.exports = {
	streamViaRovo,
	replayViaRovo,
	generateTextViaRovo,
	isChatInProgressError,
	retryChatInProgress,
	shouldCancelConflictingTurn,
	createPortStuckError,
	isGenericIntegrationWrapperToolName,
	resolveToolNameForToolEvent,
	getThinkingActivityFromToolName,
	buildThinkingStatusFromToolEvent,
	parseToolCallArgsInput,
	resolveToolCallInput,
	initPool,
	WAIT_FOR_TURN_TIMEOUT_MS,
};
