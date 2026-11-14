/**
 * Rovo Serve Mode API client.
 *
 * Communicates with a locally running `rovo serve <port>` instance
 * using the V3 REST + SSE API.
 *
 * Key endpoints used:
 *   POST /v3/set_chat_message  — queue a message for processing
 *   GET  /v3/stream_chat       — execute the queued message and stream response (SSE)
 *   POST /v3/resume_tool_calls — resume paused tool calls
 *   GET  /v3/sessions/current_session
 *   POST /v3/sessions/create
 *   GET  /v3/sessions/{session_id}
 *   POST /v3/sessions/{session_id}/restore
 *   GET  /v3/status            — get agent status and session info
 *   GET  /healthcheck          — server health
 *   POST /v3/cancel            — cancel ongoing operation
 */

const http = require("http");
const {
	toPreview,
} = require("./tool-output-sanitizer");

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_PORT = 8000;
const DEFAULT_STREAM_FIRST_EVENT_TIMEOUT_MS = 45_000;
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 60_000;

function getPort() {
	const envPort = process.env.ROVO_PORT;
	if (envPort) {
		const parsed = parseInt(envPort, 10);
		if (!isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return DEFAULT_PORT;
}

function getBaseUrlForPort(port) {
	const resolvedPort = typeof port === "number" && port > 0 ? port : getPort();
	return `http://127.0.0.1:${resolvedPort}`;
}

function parseToolInputValue(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value;
	}

	if (typeof value !== "string") {
		return null;
	}

	const trimmedValue = value.trim();
	if (!trimmedValue) {
		return null;
	}

	try {
		const parsedValue = JSON.parse(trimmedValue);
		return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
			? parsedValue
			: null;
	} catch {
		return null;
	}
}

function getToolCallInput(part) {
	if (!part || typeof part !== "object") {
		return null;
	}

	const nestedInput =
		parseToolInputValue(part.input) ||
		parseToolInputValue(part.arguments) ||
		parseToolInputValue(part.params) ||
		parseToolInputValue(part.payload);
	if (nestedInput) {
		return nestedInput;
	}

	return parseToolInputValue(part.args);
}

function getToolCallIdFromPayload(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	return (
		payload.tool_call_id ||
		payload.toolCallId ||
		payload.call_id ||
		payload.callId ||
		""
	);
}

function getToolNameFromPayload(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	return (
		payload.tool_name ||
		payload.toolName ||
		payload.name ||
		""
	);
}

function getSubagentMetadataFromPayload(payload) {
	if (!payload || typeof payload !== "object") {
		return {};
	}

	const subagentName =
		typeof payload.subagent_name === "string" && payload.subagent_name.trim()
			? payload.subagent_name.trim()
			: typeof payload.subagentName === "string" && payload.subagentName.trim()
				? payload.subagentName.trim()
				: undefined;
	const subagentToolCallId =
		typeof payload.subagent_tool_call_id === "string" && payload.subagent_tool_call_id.trim()
			? payload.subagent_tool_call_id.trim()
			: typeof payload.subagentToolCallId === "string" && payload.subagentToolCallId.trim()
				? payload.subagentToolCallId.trim()
				: undefined;

	return {
		...(subagentName ? { subagentName } : {}),
		...(subagentToolCallId ? { subagentToolCallId } : {}),
	};
}

const TOOL_RESULT_OUTPUT_FIELDS = [
	"content",
	"output",
	"result",
	"value",
	"data",
	"error",
];
const TOOL_RESULT_METADATA_FIELDS = new Set([
	"status",
	"success",
	"ok",
	"is_error",
	"isError",
	"tool_name",
	"toolName",
	"tool_call_id",
	"toolCallId",
	"call_id",
	"callId",
	"mcp_server",
	"mcpServer",
	"subagent_name",
	"subagentName",
	"subagent_tool_call_id",
	"subagentToolCallId",
]);

function getToolResultFieldEntries(payload) {
	if (!payload || typeof payload !== "object") {
		return [];
	}

	return TOOL_RESULT_OUTPUT_FIELDS.flatMap((key) => {
		const value = payload[key];
		return value !== undefined && value !== null ? [[key, value]] : [];
	});
}

function getToolResultPayloadEntries(payload) {
	if (!payload || typeof payload !== "object") {
		return [];
	}

	return Object.entries(payload).flatMap(([key, value]) => {
		if (TOOL_RESULT_METADATA_FIELDS.has(key) || value === undefined) {
			return [];
		}

		return [[key, value]];
	});
}

function resolveToolResultOutput(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	if (payload.content !== undefined && payload.content !== null) {
		return payload.content;
	}
	if (payload.output !== undefined && payload.output !== null) {
		return payload.output;
	}
	if (payload.result !== undefined && payload.result !== null) {
		return payload.result;
	}
	if (payload.value !== undefined && payload.value !== null) {
		return payload.value;
	}
	if (payload.data !== undefined && payload.data !== null) {
		return payload.data;
	}
	if (payload.error !== undefined && payload.error !== null) {
		return payload.error;
	}

	return "";
}

function resolveToolResultRawOutput(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	const payloadEntries = getToolResultPayloadEntries(payload);
	if (payloadEntries.length === 1) {
		const [key, value] = payloadEntries[0];
		return TOOL_RESULT_OUTPUT_FIELDS.includes(key) ? value : { [key]: value };
	}
	if (payloadEntries.length > 1) {
		return Object.fromEntries(payloadEntries);
	}

	const entries = getToolResultFieldEntries(payload);
	if (entries.length === 1) {
		return entries[0][1];
	}
	if (entries.length > 1) {
		return Object.fromEntries(entries);
	}

	return payload;
}

function isGenericSuccessText(value) {
	if (typeof value !== "string") {
		return false;
	}

	const normalizedValue = value.trim().toLowerCase();
	return (
		normalizedValue === "ok" ||
		normalizedValue === "success" ||
		normalizedValue === "successful" ||
		normalizedValue === "done" ||
		normalizedValue === "complete" ||
		normalizedValue === "completed"
	);
}

function resolveToolResultPreviewSource(payload, rawOutput) {
	const preferredOutput = resolveToolResultOutput(payload);
	if (preferredOutput === "" || preferredOutput === null) {
		return rawOutput;
	}

	if (isGenericSuccessText(preferredOutput) && preferredOutput !== rawOutput) {
		return rawOutput;
	}

	return preferredOutput;
}

function parseStructuredToolResultOutput(outputValue) {
	if (!outputValue) {
		return null;
	}

	if (typeof outputValue === "object" && !Array.isArray(outputValue)) {
		return outputValue;
	}

	if (typeof outputValue !== "string") {
		return null;
	}

	const trimmedValue = outputValue.trim();
	if (!trimmedValue || (trimmedValue[0] !== "{" && trimmedValue[0] !== "[")) {
		return null;
	}

	try {
		const parsedValue = JSON.parse(trimmedValue);
		return parsedValue && typeof parsedValue === "object" ? parsedValue : null;
	} catch {
		return null;
	}
}

function resolveToolResultIsError(payload, outputPreview, rawOutput) {
	const status =
		typeof payload?.status === "string" ? payload.status.trim().toLowerCase() : "";
	const hasExplicitError =
		payload?.is_error === true ||
		payload?.isError === true ||
		payload?.success === false ||
		status === "error" ||
		status === "failed" ||
		status === "failure";
	if (hasExplicitError) {
		return true;
	}

	const hasExplicitSuccess =
		payload?.success === true ||
		status === "ok" ||
		status === "success" ||
		status === "completed" ||
		status === "complete" ||
		status === "done";
	if (hasExplicitSuccess) {
		return false;
	}

	if (payload?.error !== undefined && payload?.error !== null) {
		return true;
	}

	const structuredOutput = parseStructuredToolResultOutput(rawOutput);
	if (structuredOutput && typeof structuredOutput === "object") {
		const nestedStatus =
			typeof structuredOutput.status === "string"
				? structuredOutput.status.trim().toLowerCase()
				: "";
		if (
			structuredOutput.error !== undefined ||
			structuredOutput.is_error === true ||
			structuredOutput.isError === true ||
			structuredOutput.success === false ||
			structuredOutput.ok === false ||
			nestedStatus === "error" ||
			nestedStatus === "failed" ||
			nestedStatus === "failure" ||
			(Array.isArray(structuredOutput.errors) && structuredOutput.errors.length > 0)
		) {
			return true;
		}

		const httpStatus =
			typeof structuredOutput.httpStatus === "number"
				? structuredOutput.httpStatus
				: typeof structuredOutput.statusCode === "number"
					? structuredOutput.statusCode
					: null;
		if (typeof httpStatus === "number" && httpStatus >= 400) {
			return true;
		}
	}

	return /\b(error|errors|failed|failure|exception)\b/i.test(outputPreview);
}

function resolveWarningText(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	const message =
		typeof payload.message === "string" ? payload.message.trim() : "";
	const title = typeof payload.title === "string" ? payload.title.trim() : "";
	const detail =
		typeof payload.detail === "string" ? payload.detail.trim() : "";

	if (message) {
		return message;
	}
	if (title) {
		return detail ? `${title} - ${detail}` : title;
	}
	return detail;
}

function buildWarningChunk(parsed) {
	const rawWarningText = resolveWarningText(parsed);
	const preview = toPreview(rawWarningText || JSON.stringify(parsed ?? {}));
	const warningTitle =
		parsed && typeof parsed === "object" && typeof parsed.title === "string" && parsed.title.trim()
			? parsed.title.trim()
			: undefined;

	return {
		type: "warning",
		text: preview.text,
		warningTitle,
		outputPreview: preview.text,
		outputTruncated: preview.truncated,
		outputBytes: preview.bytes,
		rawOutput: parsed,
	};
}

/**
 * Extract structured content from an SSE event, handling the Rovo Dev event format.
 *
 * Rovo Dev V3 stream_chat uses these event types:
 *   - "user-prompt"         → echo of user input (skip)
 *   - "part_start"          → first chunk; text in parsed.part.content, or tool call
 *   - "part_delta"          → subsequent chunks; text delta or tool call args delta
 *   - "on_call_tools_start" → tool execution begins
 *   - "retry-prompt"        → tool result/error feedback
 *   - "request-usage"       → token usage stats (skip)
 *   - "close"               → stream end (skip)
 *
 * Returns
 * { type, text, toolName?, toolCallId?, toolInput?, outputPreview?, outputTruncated?, outputBytes?, rawOutput? }
 * or null if the event should be skipped.
 */
function extractChunkFromEvent(eventName, parsed) {
	const subagentMetadata = getSubagentMetadataFromPayload(parsed);
	// Events to skip entirely
	const skipEvents = [
		"user-prompt", "request-usage", "close", "done", "end",
		"ping", "heartbeat", "keep-alive", "keepalive",
		"message_start", "content_block_start", "content_block_stop",
		"status", "usage",
		"run_start", "run_end", "agent_run_start", "agent_run_end",
		"message_complete", "message_stop", "complete", "message_end",
	];

	if (skipEvents.includes(eventName)) {
		return null;
	}

	if (eventName === "text") {
		const text =
			typeof parsed?.content === "string"
				? parsed.content
				: typeof parsed?.text === "string"
					? parsed.text
					: "";
		return text ? { type: "text", text, ...subagentMetadata } : null;
	}

	// ── Tool call / tool result events ──────────────────────────────────

	if (eventName === "tool-call") {
		const toolInput = getToolCallInput(parsed);
		const toolName =
			getToolNameFromPayload(parsed) ||
			(typeof toolInput?.tool_name === "string" ? toolInput.tool_name : "unknown");
		const mcpServer =
			typeof parsed?.mcp_server === "string" && parsed.mcp_server.trim()
				? parsed.mcp_server.trim()
				: undefined;

		return {
			type: "tool_call_start",
			text:
				typeof parsed?.args === "string"
					? parsed.args
					: toolInput
						? JSON.stringify(toolInput, null, 2)
						: "",
			toolName,
			toolCallId: getToolCallIdFromPayload(parsed),
			toolInput,
			mcpServer,
			...subagentMetadata,
		};
	}

	if (eventName === "on_call_tools_start") {
		const parts = parsed?.parts || [];
		if (parts.length > 0) {
			const part = parts[0];
			let toolName = part?.tool_name || "unknown";
			const toolInput = getToolCallInput(part);
			if (toolInput && typeof toolInput.tool_name === "string" && toolInput.tool_name.trim()) {
				toolName = toolInput.tool_name.trim();
			}

			const args = typeof part?.args === "string"
				? part.args
				: toolInput
					? JSON.stringify(toolInput, null, 2)
					: "";

			const mcpServer =
				typeof part?.mcp_server === "string" && part.mcp_server.trim()
					? part.mcp_server.trim()
					: undefined;

			const toolCallId = part?.tool_call_id;
			const permissions = parsed?.permissions;
			const permissionScenario =
				toolCallId &&
				permissions &&
				typeof permissions === "object" &&
				typeof permissions[toolCallId] === "string"
					? permissions[toolCallId]
					: undefined;

			return {
				type: "tool_call_start",
				text: args,
				toolName,
				toolCallId,
				toolInput,
				mcpServer,
				permissionScenario,
				...subagentMetadata,
			};
		}
		return null;
	}

	if (
		eventName === "retry-prompt" ||
		eventName === "tool-return" ||
		eventName === "tool_result"
	) {
		const rawContent = resolveToolResultRawOutput(parsed);
		const previewSource = resolveToolResultPreviewSource(parsed, rawContent);
		const preview = toPreview(previewSource);
		const rawContentPreview = toPreview(rawContent);
		const content = preview.text;
		const toolName = getToolNameFromPayload(parsed);
		const toolCallId = getToolCallIdFromPayload(parsed);
		const isError = resolveToolResultIsError(parsed, content, rawContent);
		return {
			type: isError ? "tool_error" : "tool_result",
			text: content,
			toolName,
			toolCallId,
			outputPreview: content,
			outputTruncated: preview.truncated,
			outputBytes: rawContentPreview.bytes,
			rawOutput: rawContent,
			...subagentMetadata,
		};
	}

	if (eventName === "tool_use") {
		return null;
	}

	if (eventName === "warning") {
		return buildWarningChunk(parsed);
	}

	// ── Part start ──────────────────────────────────────────────────────

	if (eventName === "part_start") {
		const partKind = parsed?.part?.part_kind;

		if (partKind === "tool-call") {
			const toolInput = getToolCallInput(parsed?.part);
			const toolName =
				parsed?.part?.tool_name ||
				(typeof toolInput?.tool_name === "string" ? toolInput.tool_name : "unknown");
			const mcpServer =
				typeof parsed?.part?.mcp_server === "string" && parsed.part.mcp_server.trim()
					? parsed.part.mcp_server.trim()
					: undefined;
			return {
				type: "tool_call_start",
				text: "",
				toolName,
				toolCallId: parsed?.part?.tool_call_id,
				toolInput,
				mcpServer,
				...subagentMetadata,
			};
		}

		const text = parsed?.part?.content ?? "";
		return text ? { type: "text", text, ...subagentMetadata } : null;
	}

	// ── Part delta ──────────────────────────────────────────────────────

	if (eventName === "part_delta") {
		const deltaKind = parsed?.delta?.part_delta_kind;

		if (deltaKind === "tool_call") {
			const argsDelta = parsed?.delta?.args_delta ?? "";
			return argsDelta ? {
				type: "tool_call_args",
				text: argsDelta,
				toolCallId: parsed?.delta?.tool_call_id,
				...subagentMetadata,
			} : null;
		}

		const text = parsed?.delta?.content_delta ?? "";
		return text ? { type: "text", text, ...subagentMetadata } : null;
	}

	// ── Deferred tool request ───────────────────────────────────────────

	if (eventName === "deferred-request") {
		// Rovo sends { calls: [{ tool_name, args (JSON string), tool_call_id }], approvals, metadata }
		const calls = Array.isArray(parsed?.calls) ? parsed.calls : [];
		const firstCall = calls[0];
		if (firstCall) {
			let toolInput = firstCall.args;
			if (typeof toolInput === "string") {
				try { toolInput = JSON.parse(toolInput); } catch { /* keep as string */ }
			}
			return {
				type: "deferred-tool-request",
				toolName: firstCall.tool_name,
				toolCallId: firstCall.tool_call_id,
				toolInput,
				...subagentMetadata,
			};
		}
		return null;
	}

	// ── Fallback for unknown events ─────────────────────────────────────

	const rawText =
		parsed?.text ??
		parsed?.content ??
		parsed?.delta?.text ??
		parsed?.delta?.content ??
		parsed?.message?.content ??
		parsed?.choices?.[0]?.delta?.content ??
		"";

	const preview = toPreview(rawText);
	const text = preview.text;
	return text ? { type: "text", text, ...subagentMetadata } : null;
}

function createAbortError(message = "Rovo request aborted") {
	const error = new Error(message);
	error.name = "AbortError";
	error.code = "ABORT_ERR";
	return error;
}

function createStreamSilenceTimeoutError({
	timeoutMs,
	hadActivity,
}) {
	const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
	const error = new Error(
		hadActivity
			? `Rovo stream stalled after ${timeoutSeconds}s without SSE activity`
			: `Rovo stream never produced any SSE activity after ${timeoutSeconds}s`
	);
	error.code = "ROVO_STREAM_IDLE_TIMEOUT";
	error.timeoutMs = timeoutMs;
	error.hadActivity = hadActivity === true;
	return error;
}

function createCancelCleanupError({ port, payload, rawData } = {}) {
	const message =
		typeof payload?.message === "string" && payload.message.trim().length > 0
			? payload.message.trim()
			: typeof rawData === "string" && rawData.trim().length > 0
				? rawData.trim()
				: "Rovo chat cancellation failed";
	const timedOut = /timed out/i.test(message);
	const error = new Error(message);
	error.code = timedOut ? "ROVO_CANCEL_TIMEOUT" : "ROVO_CANCEL_FAILED";
	if (Number.isInteger(port) && port > 0) {
		error.port = port;
	}
	if (payload && typeof payload === "object") {
		error.cancelResponse = payload;
	}
	if (typeof rawData === "string" && rawData.length > 0) {
		error.response = rawData;
	}
	return error;
}

/**
 * Make a JSON request to the Rovo serve API.
 */
function request(method, path, body, timeoutMs = 10000, port, signal) {
	return new Promise((resolve, reject) => {
		const resolvedPort = typeof port === "number" && port > 0 ? port : getPort();
		const url = new URL(path, `http://127.0.0.1:${resolvedPort}`);
		const headers = {
			"Content-Type": "application/json",
			"Accept": "application/json",
		};
		const sessionToken = (process.env.ROVO_SESSION_TOKEN ?? "").trim();
		if (sessionToken) {
			headers["Authorization"] = `Bearer ${sessionToken}`;
		}
		const options = {
			hostname: url.hostname,
			port: url.port,
			path: `${url.pathname}${url.search}`,
			method,
			headers,
			timeout: timeoutMs,
		};

		let settled = false;
		let abortHandler = null;

		const finish = (callback, value) => {
			if (settled) {
				return;
			}
			settled = true;
			if (signal && abortHandler) {
				signal.removeEventListener("abort", abortHandler);
			}
			callback(value);
		};

		const req = http.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () =>
				finish(resolve, {
					status: res.statusCode || 0,
					data,
					headers: res.headers ?? {},
				})
			);
		});

		req.on("timeout", () => {
			req.destroy();
			finish(reject, new Error("Request timed out"));
		});
		req.on("error", (err) => {
			if (signal?.aborted || err?.name === "AbortError" || err?.code === "ABORT_ERR") {
				finish(reject, createAbortError());
				return;
			}
			finish(
				reject,
				new Error(
					`Rovo connection failed: ${err.message}. Is "rovo serve" running on port ${resolvedPort}?`
				)
			);
		});

		if (signal) {
			abortHandler = () => {
				req.destroy(createAbortError());
				finish(reject, createAbortError());
			};

			if (signal.aborted) {
				abortHandler();
				return;
			}

			signal.addEventListener("abort", abortHandler, { once: true });
		}

		if (body) {
			req.write(JSON.stringify(body));
		}
		req.end();
	});
}

/**
 * Create an HTTP status error with structured metadata.
 */
function createHttpStatusError(message, status, endpoint, data) {
	const error = new Error(message);
	error.status = status;
	error.statusCode = status;
	error.endpoint = endpoint;
	if (typeof data === "string" && data.length > 0) {
		error.response = data;
	}
	return error;
}

function parseJsonResponseData(endpoint, data) {
	if (typeof data !== "string" || !data.trim()) {
		return null;
	}

	try {
		return JSON.parse(data);
	} catch {
		throw new Error(`Failed to parse JSON response from ${endpoint}: ${data}`);
	}
}

async function requestJson(method, path, body, timeoutMs = 10000, port, signal) {
	const response = await request(method, path, body, timeoutMs, port, signal);
	if (response.status < 200 || response.status >= 300) {
		throw createHttpStatusError(
			`${method} ${path} failed (status ${response.status}): ${response.data}`,
			response.status,
			path,
			response.data
		);
	}

	return {
		data: parseJsonResponseData(path, response.data),
		headers: response.headers ?? {},
	};
}

function buildSessionsListPath({ page, pageSize } = {}) {
	const url = new URL("/v3/sessions/list", "http://127.0.0.1");
	if (Number.isInteger(page) && page > 0) {
		url.searchParams.set("page", String(page));
	}
	if (Number.isInteger(pageSize) && pageSize > 0) {
		url.searchParams.set("page_size", String(pageSize));
	}
	return `${url.pathname}${url.search}`;
}

function normalizeChatRequestInput(input) {
	if (typeof input === "string") {
		return {
			message: input,
		};
	}

	if (!input || typeof input !== "object") {
		throw new Error("Rovo chat input must be a string or an object.");
	}

	const rawMessage = input.message;
	const messageIsText =
		typeof rawMessage === "string" && rawMessage.trim().length > 0;
	const messageIsDeferredToolResponse =
		rawMessage &&
		typeof rawMessage === "object" &&
		typeof rawMessage.tool_call_id === "string" &&
		rawMessage.tool_call_id.trim().length > 0 &&
		"result" in rawMessage;
	if (!messageIsText && !messageIsDeferredToolResponse) {
		throw new Error(
			"Rovo chat input must include a non-empty message string or DeferredToolResponse."
		);
	}

	const normalized = {
		message: messageIsText
			? rawMessage.trim()
			: {
				tool_call_id: rawMessage.tool_call_id.trim(),
				result: rawMessage.result,
			},
	};

	if (Array.isArray(input.context)) {
		normalized.context = input.context;
	}

	const enableDeepPlan =
		typeof input.enableDeepPlan === "boolean"
			? input.enableDeepPlan
			: typeof input.enable_deep_plan === "boolean"
				? input.enable_deep_plan
				: undefined;
	if (typeof enableDeepPlan === "boolean") {
		normalized.enable_deep_plan = enableDeepPlan;
	}

	return normalized;
}

function normalizeResumeToolCallsInput(decisionsOrInput) {
	if (Array.isArray(decisionsOrInput)) {
		return { decisions: decisionsOrInput };
	}

	if (
		decisionsOrInput &&
		typeof decisionsOrInput === "object" &&
		Array.isArray(decisionsOrInput.decisions)
	) {
		return { decisions: decisionsOrInput.decisions };
	}

	throw new Error("Rovo resume_tool_calls requires a decisions array.");
}

function normalizeSessionId(sessionId) {
	return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if Rovo serve is running and healthy.
 * Note: The healthcheck endpoint may return 401/403 (missing credentials) which is OK -
 * it means the server is running and reachable.
 */
async function healthCheck(port) {
	const { status, data } = await request("GET", "/healthcheck", undefined, 10000, port);
	if (status !== 200 && status !== 401 && status !== 403) {
		throw new Error(`Health check failed with status ${status}: ${data}`);
	}
	if (status === 401 || status === 403) {
		// Server is running but requires auth - this is expected
		return { status: "reachable", requiresAuth: true };
	}
	return JSON.parse(data);
}

/**
 * Get the current agent status.
 */
async function getStatus(port) {
	const { status, data } = await request("GET", "/v3/status", undefined, 10000, port);
	if (status !== 200) {
		throw new Error(`Status check failed: ${data}`);
	}
	return JSON.parse(data);
}

async function listSessions(port, options = {}) {
	const path = buildSessionsListPath({
		page: options.page,
		pageSize: options.pageSize,
	});
	const response = await requestJson("GET", path, undefined, options.timeoutMs ?? 10000, port, options.signal);
	return response.data;
}

async function getCurrentSession(port, options = {}) {
	const response = await requestJson(
		"GET",
		"/v3/sessions/current_session",
		undefined,
		options.timeoutMs ?? 10000,
		port,
		options.signal
	);
	return response.data;
}

async function getSession(port, sessionId, options = {}) {
	const normalizedSessionId = normalizeSessionId(sessionId);
	if (!normalizedSessionId) {
		throw new Error("Rovo session ID is required.");
	}

	const response = await requestJson(
		"GET",
		`/v3/sessions/${encodeURIComponent(normalizedSessionId)}`,
		undefined,
		options.timeoutMs ?? 10000,
		port,
		options.signal
	);
	return response.data;
}

async function createSession(port, options = {}) {
	const body = {};
	if (typeof options.customTitle === "string" && options.customTitle.trim()) {
		body.custom_title = options.customTitle.trim();
	}

	const response = await requestJson(
		"POST",
		"/v3/sessions/create",
		Object.keys(body).length > 0 ? body : null,
		options.timeoutMs ?? 10000,
		port,
		options.signal
	);
	return response.data;
}

async function restoreSession(port, sessionId, options = {}) {
	const normalizedSessionId = normalizeSessionId(sessionId);
	if (!normalizedSessionId) {
		throw new Error("Rovo session ID is required.");
	}

	const response = await requestJson(
		"POST",
		`/v3/sessions/${encodeURIComponent(normalizedSessionId)}/restore`,
		null,
		options.timeoutMs ?? 10000,
		port,
		options.signal
	);
	return response.data;
}

async function resumeToolCalls(port, decisionsOrInput, options = {}) {
	const body = normalizeResumeToolCallsInput(decisionsOrInput);
	const response = await requestJson(
		"POST",
		"/v3/resume_tool_calls",
		body,
		options.timeoutMs ?? 10000,
		port,
		options.signal
	);
	return response.data;
}

// An SSE stream's phase (SM-BT-10): awaiting-first-event → streaming → done | paused |
// aborted | timeout | failed. The last five are terminal; `finish(reason)` is the one way
// in, and only its first call acts.
const SSE_STREAM_TERMINAL_PHASES = Object.freeze(["done", "paused", "aborted", "timeout", "failed"]);

function openSseStream({
	method = "GET",
	path,
	body,
	callbacks,
	port,
	abortController,
	firstEventTimeoutMs,
	idleTimeoutMs,
	onTimingStage,
	timingPrefix,
	firstSseStageName,
	firstTextStageName,
	manualDisconnectLabel,
}) {
	/** @type {"awaiting-first-event" | "streaming" | "done" | "paused" | "aborted" | "timeout" | "failed"} */
	let phase = "awaiting-first-event";
	let currentReq = null;
	let currentRes = null;
	let streamSilenceTimer = null;
	let settleStream = null;
	const startedAtMs = Date.now();
	let hasReportedFirstSseEvent = false;
	let hasReportedFirstTextDelta = false;

	const isFinished = () => SSE_STREAM_TERMINAL_PHASES.includes(phase);

	const clearStreamSilenceTimer = () => {
		if (streamSilenceTimer !== null) {
			clearTimeout(streamSilenceTimer);
			streamSilenceTimer = null;
		}
	};

	const cancelTimedOutStream = () => {
		const targetPort = typeof port === "number" && port > 0 ? port : undefined;
		request("POST", "/v3/cancel", undefined, 5_000, targetPort).catch(() => {
			// Ignore cancellation failures; this is best-effort cleanup.
		});
	};

	const destroySockets = (error) => {
		if (currentRes && !currentRes.destroyed) {
			currentRes.destroy(error);
		}
		if (currentReq) {
			currentReq.destroy(error);
		}
	};

	/**
	 * Ends the stream once. "done", "paused" and "aborted" resolve it; "timeout" and
	 * "failed" reject it with `error`. A timeout also cancels the turn on Rovo.
	 * @param {"done" | "paused" | "aborted" | "timeout" | "failed"} reason
	 * @param {Error} [error]
	 */
	const finish = (reason, error) => {
		if (isFinished()) {
			return false;
		}
		phase = reason;
		clearStreamSilenceTimer();
		if (reason === "timeout") {
			cancelTimedOutStream();
			destroySockets(error);
		} else if (reason === "paused" || reason === "aborted") {
			destroySockets();
		}
		settleStream?.(reason === "timeout" || reason === "failed" ? error : null);
		return true;
	};

	const armStreamSilenceTimer = () => {
		clearStreamSilenceTimer();
		if (isFinished()) {
			return;
		}
		const timedOutPhase = phase;
		const timeoutMs = timedOutPhase === "streaming" ? idleTimeoutMs : firstEventTimeoutMs;
		streamSilenceTimer = setTimeout(() => {
			streamSilenceTimer = null;
			const timeoutError = createStreamSilenceTimeoutError({
				timeoutMs,
				hadActivity: timedOutPhase === "streaming",
			});
			timeoutError.phase = timedOutPhase;
			finish("timeout", timeoutError);
		}, timeoutMs);
	};

	const noteStreamActivity = () => {
		if (isFinished()) {
			return;
		}
		phase = "streaming";
		armStreamSilenceTimer();
	};

	const disconnect = () => {
		finish("paused");
	};

	const streamPromise = new Promise((resolve, reject) => {
		settleStream = (error) => (error ? reject(error) : resolve());

		const url = new URL(path, getBaseUrlForPort(port));
		const sseHeaders = {
			Accept: "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		};
		const sseSessionToken = (process.env.ROVO_SESSION_TOKEN ?? "").trim();
		if (sseSessionToken) {
			sseHeaders.Authorization = `Bearer ${sseSessionToken}`;
		}
		const requestOptions = {
			hostname: url.hostname,
			port: url.port,
			path: url.pathname + url.search,
			method,
			headers: sseHeaders,
		};

		currentReq = http.request(requestOptions, (res) => {
			currentRes = res;
			if (res.socket) {
				res.socket.setTimeout(0);
			}

			if (res.statusCode !== 200) {
				// Refused: the stream will never produce events, so its timer stops now.
				clearStreamSilenceTimer();
				let errData = "";
				res.on("data", (chunk) => (errData += chunk));
				res.on("end", () =>
					finish(
						"failed",
						createHttpStatusError(
							`${timingPrefix} failed (status ${res.statusCode}): ${errData}`,
							typeof res.statusCode === "number" ? res.statusCode : 0,
							path,
							errData,
						),
					),
				);
				return;
			}

			if (onTimingStage) {
				onTimingStage(`${timingPrefix}_connected`, {
					stageMs: Date.now() - startedAtMs,
					port,
				});
			}

			console.log(`[rovo] ${manualDisconnectLabel} connected, waiting for events...`);
			armStreamSilenceTimer();

			let buffer = "";
			// An SSE event can span network chunks ("event:" in one, "data:" in the next),
			// so the pending event name lives with the stream, not with each chunk.
			let currentEvent = "";

			const handleChunk = async (chunk) => {
				if (isFinished()) {
					return;
				}
				noteStreamActivity();

				buffer += chunk.toString();

				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					if (isFinished()) {
						return;
					}
					if (line.startsWith("event: ")) {
						currentEvent = line.slice(7).trim();
						continue;
					}

					if (line.startsWith("data: ")) {
						const rawData = line.slice(6);
						const currentEventName = currentEvent || "message";

						if (!hasReportedFirstSseEvent && onTimingStage && firstSseStageName) {
							hasReportedFirstSseEvent = true;
							onTimingStage(firstSseStageName, {
								stageMs: Date.now() - startedAtMs,
								eventName: currentEventName,
								port,
							});
						}

						if (callbacks.onEvent) {
							callbacks.onEvent(currentEvent, rawData);
						}

						let parsed;
						try {
							parsed = JSON.parse(rawData);
						} catch {
							if (
								rawData &&
								(currentEvent === "text_delta" || currentEvent === "content_block_delta")
							) {
								if (
									!hasReportedFirstTextDelta &&
									onTimingStage &&
									firstTextStageName
								) {
									hasReportedFirstTextDelta = true;
									onTimingStage(firstTextStageName, {
										stageMs: Date.now() - startedAtMs,
										eventName: currentEventName,
										chars: rawData.length,
										port,
									});
								}
								callbacks.onChunk({ type: "text", text: rawData });
							}
							currentEvent = "";
							continue;
						}

						const chunkPayload = extractChunkFromEvent(currentEvent, parsed);
						if (chunkPayload !== null) {
							if (
								chunkPayload.type === "text" &&
								!hasReportedFirstTextDelta &&
								onTimingStage &&
								firstTextStageName
							) {
								hasReportedFirstTextDelta = true;
								onTimingStage(firstTextStageName, {
									stageMs: Date.now() - startedAtMs,
									eventName: currentEventName,
									chars: chunkPayload.text.length,
									port,
								});
							}
							callbacks.onChunk(chunkPayload);

							if (
								currentEventName === "on_call_tools_start" &&
								typeof callbacks.onPauseToolCalls === "function"
							) {
								const result = await callbacks.onPauseToolCalls(parsed, {
									port,
									chunk: chunkPayload,
									disconnect,
								});
								if (result?.disconnect === true) {
									console.info(
										"[rovo] Intentionally disconnecting paused SSE stream after tool boundary",
										{
											port,
											toolName: chunkPayload.toolName ?? null,
											toolCallId: chunkPayload.toolCallId ?? null,
											eventName: currentEventName,
										},
									);
									disconnect();
									return;
								}
							}
							currentEvent = "";
							continue;
						}

						if (currentEvent === "error" || currentEvent === "exception") {
							finish(
								"failed",
								new Error(parsed.message ?? parsed.error ?? JSON.stringify(parsed)),
							);
							return;
						}

						currentEvent = "";
						continue;
					}

					if (line.trim() === "") {
						currentEvent = "";
					}
				}
			};

			// Chunks are handled one at a time, in order: while a pause at a tool boundary
			// waits for its decision, later chunks wait too, so nothing after a pause that
			// disconnects is delivered.
			let chunkQueue = Promise.resolve();
			res.on("data", (chunk) => {
				chunkQueue = chunkQueue
					.then(() => handleChunk(chunk))
					.catch((error) => {
						finish("failed", error instanceof Error ? error : new Error(String(error)));
					});
			});

			res.on("end", () => {
				// The stream ends after every chunk it delivered has been handled.
				void chunkQueue.then(() => finish("done"));
			});

			res.on("error", (err) => {
				finish("failed", err);
			});
		});

		currentReq.setTimeout(0);

		currentReq.on("error", (err) => {
			if (isFinished()) {
				return;
			}
			if (err?.name === "AbortError" || err?.code === "ABORT_ERR") {
				finish("failed", createAbortError());
				return;
			}
			finish("failed", new Error(`SSE connection failed: ${err.message}`));
		});

		armStreamSilenceTimer();
		if (body !== undefined) {
			currentReq.write(JSON.stringify(body));
		}
		currentReq.end();
	});

	return {
		streamPromise,
		disconnect,
		getPhase: () => phase,
		wasManuallyDisconnected: () => phase === "paused",
		abort: () => {
			abortController.abort();
			finish("aborted");
		},
	};
}

/**
 * Send a message and stream the response via SSE.
 *
 * Uses the V3 two-step pattern by default:
 *   1. POST /v3/set_chat_message to queue the message
 *   2. GET /v3/stream_chat to stream the response
 *
 * For deferred-tool continuations, callers may set `skipSetChatMessage` to
 * reuse the current queued turn and open a fresh `/v3/stream_chat` without
 * queuing another user message first.
 *
 * @param {string|object} input - The chat message or documented request shape
 * @param {object} callbacks
 * @param {function} callbacks.onChunk - Called for each structured chunk { type, text, toolName?, toolCallId? }
 * @param {function} callbacks.onDone - Called when complete with full text
 * @param {function} callbacks.onError - Called on error
 * @param {function} [callbacks.onEvent] - Optional raw SSE event callback
 * @param {object} [options]
 * @param {number} [options.firstEventTimeoutMs]
 * @param {number} [options.idleTimeoutMs]
 * @param {function} [options.onTimingStage]
 * @param {string} [options.sessionId] - Restore this session before sending the message
 * @param {boolean} [options.includeSubagentEvents] - Include Serve subagent events in SSE payloads
 * @param {boolean} [options.pauseOnCallToolsStart] - Pause tool execution via documented SSE query flag
 * @param {boolean} [options.skipSetChatMessage] - Open `/v3/stream_chat` without calling `/v3/set_chat_message`
 * @returns {{ abort: () => void }}
 */
function sendMessageStreaming(input, callbacks, port, options = {}) {
	const abortController = new AbortController();
	let activeStreamHandle = null;
	const skipSetChatMessage = options.skipSetChatMessage === true;
	// The turn before its stream opens: restoring (the session) → queuing (the message) →
	// queued. A continuation reuses a turn that is already queued. Once the stream is open,
	// its own phase applies (getPhase).
	/** @type {"restoring" | "queuing" | "queued"} */
	let turnPhase = skipSetChatMessage ? "queued" : "queuing";
	let cancelPromise = null;
	const firstEventTimeoutMs =
		typeof options.firstEventTimeoutMs === "number" && options.firstEventTimeoutMs > 0
			? options.firstEventTimeoutMs
			: DEFAULT_STREAM_FIRST_EVENT_TIMEOUT_MS;
	const idleTimeoutMs =
		typeof options.idleTimeoutMs === "number" && options.idleTimeoutMs > 0
			? options.idleTimeoutMs
			: DEFAULT_STREAM_IDLE_TIMEOUT_MS;
	const onTimingStage =
		typeof options.onTimingStage === "function"
			? options.onTimingStage
			: null;
	const sessionId = normalizeSessionId(options.sessionId);
	const pauseOnCallToolsStart =
		options.pauseOnCallToolsStart === true ||
		options.pause_on_call_tools_start === true;
	const includeSubagentEvents =
		options.includeSubagentEvents === true ||
		options.include_subagent_events === true;
	const enableDeferredTools =
		options.enableDeferredTools === true ||
		options.enable_deferred_tools === true;

	// Only a queued turn exists on Rovo to cancel.
	const ensureCancellation = ({ timeoutMs = 10_000 } = {}) => {
		if (turnPhase !== "queued") {
			return Promise.resolve(null);
		}
		if (!cancelPromise) {
			cancelPromise = cancelChat(port, { timeoutMs });
		}
		return cancelPromise;
	};

	const run = async () => {
		try {
			if (sessionId) {
				if (!skipSetChatMessage) {
					turnPhase = "restoring";
				}
				console.log(`[rovo] Restoring session ${sessionId} before sending message...`);
				await restoreSession(port, sessionId, {
					timeoutMs: 30_000,
					signal: abortController.signal,
				});
			}

			// Step 1: Queue the message unless the caller is continuing an
			// existing deferred-tool turn that is already queued on the server.
			if (!skipSetChatMessage) {
				turnPhase = "queuing";
				console.log("[rovo] Queuing message via /v3/set_chat_message...");
				const setChatMessageStartedAtMs = Date.now();

				const chatRequestBody = normalizeChatRequestInput(input);

				const { status: setStatus, data: setData } = await request(
					"POST",
					"/v3/set_chat_message",
					chatRequestBody,
					30000,
					port,
					abortController.signal
				);
				if (setStatus !== 200) {
					throw createHttpStatusError(
						`Failed to queue message (status ${setStatus}): ${setData}`,
						setStatus,
						"/v3/set_chat_message",
						setData
					);
				}
				turnPhase = "queued";
				console.log("[rovo] Message queued successfully.");
				if (onTimingStage) {
					onTimingStage("rovo_set_chat_message_complete", {
						stageMs: Date.now() - setChatMessageStartedAtMs,
						status: setStatus,
						port,
						sessionId: sessionId || undefined,
						requestShape: typeof input === "string" ? "string" : "structured",
					});
				}
			} else {
				console.log("[rovo] Reusing the current queued turn and opening /v3/stream_chat...");
			}
			let fullText = "";

			// Step 2: Stream the response via SSE
			const url = new URL("/v3/stream_chat", getBaseUrlForPort(port));
			if (pauseOnCallToolsStart) {
				url.searchParams.set("pause_on_call_tools_start", "true");
			}
			if (includeSubagentEvents) {
				url.searchParams.set("include_subagent_events", "true");
			}
			if (enableDeferredTools) {
				url.searchParams.set("enable_deferred_tools", "true");
			}
			console.log("[rovo] Opening SSE stream:", url.pathname + url.search);
			activeStreamHandle = openSseStream({
				method: "GET",
				path: url.pathname + url.search,
				callbacks: {
					onChunk: (chunk) => {
						if (chunk.type === "text") {
							fullText += chunk.text;
						}
						callbacks.onChunk(chunk);
					},
					onEvent: callbacks.onEvent,
					onPauseToolCalls: callbacks.onPauseToolCalls,
				},
				port,
				abortController,
				firstEventTimeoutMs,
				idleTimeoutMs,
				onTimingStage,
				timingPrefix: "rovo_stream",
				firstSseStageName: "rovo_first_sse_event",
				firstTextStageName: "rovo_first_text_delta",
				manualDisconnectLabel: "SSE stream",
			});

			await activeStreamHandle.streamPromise;

			if (abortController.signal.aborted) {
				return;
			}

			if (activeStreamHandle.wasManuallyDisconnected()) {
				console.log(
					`[rovo] Stream intentionally disconnected. Partial response length: ${fullText.length}`
				);
				callbacks.onDone(fullText);
				return;
			}

			if (!abortController.signal.aborted) {
				console.log(`[rovo] Stream complete. Response length: ${fullText.length}`);
				if (onTimingStage) {
					onTimingStage("rovo_stream_complete", {
						stageMs: 0,
						responseChars: fullText.length,
						port,
					});
				}
				callbacks.onDone(fullText);
			}
		} catch (err) {
			if (!abortController.signal.aborted) {
				console.error("[rovo] Stream error:", err);
				callbacks.onError(err instanceof Error ? err : new Error(String(err)));
			}
		}
	};

	run();

	return {
		abort: async () => {
			abortController.abort();
			if (activeStreamHandle) {
				activeStreamHandle.abort();
			}
			return ensureCancellation({ timeoutMs: 10_000 });
		},
		disconnect: () => {
			if (activeStreamHandle) {
				activeStreamHandle.disconnect();
			}
		},
		getPhase: () => activeStreamHandle?.getPhase() ?? turnPhase,
	};
}

function replayStreaming(callbacks, port, options = {}) {
	const abortController = new AbortController();
	let activeStreamHandle = null;
	const firstEventTimeoutMs =
		typeof options.firstEventTimeoutMs === "number" && options.firstEventTimeoutMs > 0
			? options.firstEventTimeoutMs
			: DEFAULT_STREAM_FIRST_EVENT_TIMEOUT_MS;
	const idleTimeoutMs =
		typeof options.idleTimeoutMs === "number" && options.idleTimeoutMs > 0
			? options.idleTimeoutMs
			: DEFAULT_STREAM_IDLE_TIMEOUT_MS;
	const onTimingStage =
		typeof options.onTimingStage === "function"
			? options.onTimingStage
			: null;

	const run = async () => {
		try {
			let fullText = "";
			console.log("[rovo] Opening replay SSE stream: /v3/replay");
			activeStreamHandle = openSseStream({
				method: "POST",
				path: "/v3/replay",
				callbacks: {
					onChunk: (chunk) => {
						if (chunk.type === "text") {
							fullText += chunk.text;
						}
						callbacks.onChunk(chunk);
					},
					onEvent: callbacks.onEvent,
					onPauseToolCalls: callbacks.onPauseToolCalls,
				},
				port,
				abortController,
				firstEventTimeoutMs,
				idleTimeoutMs,
				onTimingStage,
				timingPrefix: "rovo_replay",
				firstSseStageName: "rovo_replay_first_sse_event",
				firstTextStageName: "rovo_replay_first_text_delta",
				manualDisconnectLabel: "Replay stream",
			});

			await activeStreamHandle.streamPromise;

			if (!abortController.signal.aborted && !activeStreamHandle.wasManuallyDisconnected()) {
				callbacks.onDone(fullText);
			}
		} catch (err) {
			if (!abortController.signal.aborted) {
				callbacks.onError(err instanceof Error ? err : new Error(String(err)));
			}
		}
	};

	run();

	return {
		abort: () => {
			if (activeStreamHandle) {
				activeStreamHandle.abort();
				return;
			}
			abortController.abort();
		},
		disconnect: () => {
			if (activeStreamHandle) {
				activeStreamHandle.disconnect();
			}
		},
	};
}

/**
 * Send a message and collect the full response (non-streaming).
 * Useful for background tasks like title generation, suggested questions, etc.
 *
 * @param {string|object} input - The chat message or documented request shape
 * @returns {Promise<string>} The full response text
 */
function sendMessageSync(input, options = {}) {
	const timeoutMs =
		typeof options.timeoutMs === "number" && options.timeoutMs > 0
			? options.timeoutMs
			: 120_000;
	const port = typeof options.port === "number" && options.port > 0 ? options.port : undefined;
	const signal = options.signal;

	return new Promise((resolve, reject) => {
		let fullText = "";
		let settled = false;
		let timeoutHandle = null;
		let abortHandler = null;

		const cleanup = () => {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			if (signal && abortHandler) {
				signal.removeEventListener("abort", abortHandler);
			}
		};

		const settleWith = (callback) => (value) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			callback(value);
		};

		const resolveOnce = settleWith(resolve);
		const rejectOnce = settleWith(reject);

		const streamHandle = sendMessageStreaming(input, {
			onChunk: (chunk) => {
				if (chunk.type === "text") {
					fullText += chunk.text;
				}
			},
			onDone: (text) => {
				resolveOnce(text || fullText);
			},
			onError: (err) => {
				rejectOnce(err);
			},
		}, port, options);

			if (signal) {
				abortHandler = () => {
					const abortError = createAbortError("Rovo sync request aborted");
					abortError.cancelCleanupPromise = Promise.resolve(streamHandle.abort());
					rejectOnce(abortError);
				};

			if (signal.aborted) {
				abortHandler();
				return;
			}

			signal.addEventListener("abort", abortHandler, { once: true });
		}

		timeoutHandle = setTimeout(() => {
			streamHandle.abort();
			rejectOnce(
				new Error(
					`Rovo sync response timed out after ${Math.ceil(timeoutMs / 1000)}s`
				)
			);
		}, timeoutMs);
	});
}

/**
 * Cancel an ongoing chat operation.
 */
async function cancelChat(port, { timeoutMs = 10000 } = {}) {
	const { status, data } = await request("POST", "/v3/cancel", undefined, timeoutMs, port);
	if (status !== 200) {
		throw createHttpStatusError(
			`Cancel failed (status ${status}): ${data}`,
			status,
			"/v3/cancel",
			data
		);
	}

	const payload = parseJsonResponseData("/v3/cancel", data);
	if (
		payload &&
		typeof payload === "object" &&
		"cancelled" in payload &&
		payload.cancelled !== true
	) {
		throw createCancelCleanupError({
			port,
			payload,
			rawData: data,
		});
	}

	return payload ?? { cancelled: true };
}

/**
 * Get the configured Rovo port.
 */
function getRovoPort() {
	return getPort();
}

module.exports = {
	healthCheck,
	getStatus,
	listSessions,
	getCurrentSession,
	getSession,
	createSession,
	restoreSession,
	resumeToolCalls,
	sendMessageStreaming,
	replayStreaming,
	sendMessageSync,
	cancelChat,
	getRovoPort,
	extractChunkFromEvent,
	request,
};
