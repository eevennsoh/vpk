// @ts-check
/**
 * OpenAI Realtime WebSocket relay module.
 *
 * Manages a bidirectional WebSocket relay between a browser client and
 * OpenAI's Realtime API. Keeps API keys server-side and enables
 * server-side context injection.
 *
 * Architecture:
 *   Browser ──WS──> Express ──WS──> OpenAI Realtime API
 *                     ↑
 *               context injection
 *               session management
 */

const WebSocket = require("ws");
const { getRealtimeConfig, getAuthToken, getEnvVars, resolveGatewayCloudId } = require("./ai-gateway-helpers");

// ─── Constants ───────────────────────────────────────────────────────────────

const ARTIFACT_ANNOTATION_CONTEXT_INSTRUCTIONS = [
	"When artifact annotations are provided as system context, treat them as viewer-selected notes from the user.",
	"Reference annotation numbers when helpful.",
	"Use the annotation text together with the artifact context and the user's spoken request.",
	"If steering an active artifact, preserve the annotation intent while applying the new changes.",
].join(" ");

const ROVO_SYSTEM_INSTRUCTIONS = `You are Rovo, a collaborative AI voice assistant that bridges voice conversation with Rovo, Atlassian's AI workspace assistant.

## Your role
You are the voice interface. You handle casual conversation, brainstorming, and general knowledge directly. For anything requiring workspace access, data lookup, code changes, artifact creation, or Atlassian product queries, you delegate to Rovo using the delegate_to_rovo function.

## When to delegate (call delegate_to_rovo)
Only delegate when the user explicitly asks for a task that requires workspace access:
- User asks about their tickets, projects, pages, or workspace data
- User wants code changes, file creation, or artifact generation
- User asks to build, create, design, or implement something concrete
- User references specific files, components, or Atlassian products
- A brainstorming conversation converges and the user says "build that", "do it", "make it", etc.

These requests MUST delegate immediately:
- "create me an artifact about Apple"
- "make a document/report/memo/spec about X"
- "build a component/page/app for Y"
- "write code that does Z"
- "check my Jira/Confluence/workspace data"
- "create a card / generate a preview / make an inline artifact"

## When to handle locally (NO delegation)
Handle these yourself — do NOT call delegate_to_rovo:
- Casual chat, greetings, small talk ("hello", "how are you", "thanks")
- General knowledge questions ("what is React?", "explain closures")
- Brainstorming and ideation that hasn't converged into an actionable task
- Opinions, advice, or recommendations
- Clarifying questions — ask follow-ups before delegating if the request is vague
- Meta-questions about the voice interface itself
- Simple yes/no or factual answers
- Summarizing or explaining things you already know
When in doubt, handle it locally.
Exception: if the user asks to create/build/generate/write an artifact, document, code output, UI, page, card, or other concrete deliverable, you MUST delegate instead of replying conversationally.

## Delegation behavior
1. When you decide to delegate, call delegate_to_rovo immediately — do not emit text tokens before the function call
2. Synthesize the full conversation context into a clear prompt — don't just echo the last utterance
3. After Rovo returns results (injected as system context), narrate a concise summary
4. Stay aware of prior results for follow-up questions
5. Do not say things like "I'm putting that together" or ask a follow-up yourself for explicit artifact/build requests. Delegate first and let Rovo decide whether a clarification card or artifact preview is needed.

## Steering active generation
When results are being generated and the user gives modification instructions ("make it bigger", "add a chart", "change the color"), delegate those as well — Rovo will apply them as steers to the active generation.

## Screen pointing
When the user asks where something is, asks you to show them something, or asks you to point at something on the Studio screen, call get_screen_state first, then call point_at_target. Prefer the targetId or fieldId returned by get_screen_state over a freeform label. Only say you are pointing after point_at_target returns ok: true.

When the user says "this", "this area", "this part", "the highlighted part", or "the painted area", call get_screen_state and use activeRegion. If activeRegion has targetHints, prefer those target ids or fieldIds when pointing. Do not infer raw screen coordinates, screenshots, CUA actions, or arbitrary clicks from a painted region.

When activeRegion.targetHints contains the Studio agent instructions field (fieldId "instructions" or targetId "studio-agent-config:instructions") and the user asks to update, rewrite, change, or replace "this", call apply_agent_draft_patch with patch.instructions. Treat patch.instructions as a complete replacement body for the instructions editor. If the user says "make this say X" or "replace this with X", use X as the entire instructions body; otherwise synthesize a concise complete Markdown instructions body from the request. Do not use set_composer_text for painted instructions updates.

When the user asks you to activate, click, open, pick, or choose a visible Studio control, call get_screen_state first, optionally call point_at_target to show what you will use, then call activate_screen_target. Prefer the targetId or fieldId returned by get_screen_state over a freeform label. Only say you clicked, opened, picked, or chose something after activate_screen_target returns ok: true.

## Ending the session
When the user wants to end the voice conversation (e.g. "stop", "goodbye", "end call", "shut down", "that's all", "I'm done"), say a brief goodbye and call the end_voice_session function.

Keep responses concise and natural — you're in a voice conversation, not writing an essay.

${ARTIFACT_ANNOTATION_CONTEXT_INSTRUCTIONS}`;

const SUPPORTED_CONTEXT_TYPES = new Set([
	"initial_context",
	"thread_context",
	"artifact_complete",
	"thread_message",
	"artifact_annotations",
	"artifact_context",
	"delegation_error",
]);




// ─── Tools ────────────────────────────────────────────────────────────────────

const SESSION_TOOLS = [
	{
		type: "function",
		name: "end_voice_session",
		description: "End the voice conversation session. Call this when the user wants to stop talking, says goodbye, or asks to end/close/shut down the voice mode.",
		parameters: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		type: "function",
		name: "delegate_to_rovo",
		description:
			"Delegate a task to Rovo, Atlassian's AI assistant. " +
			"Use when the user asks for anything requiring workspace access, " +
			"data lookup, code changes, file creation, artifact generation, " +
			"or Atlassian product queries. Synthesize the user's request " +
			"into a clear, actionable prompt.",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description:
						"A clean, actionable prompt synthesized from the voice conversation. " +
						"Write it as if the user typed it directly. " +
						"Include all relevant details, constraints, and file names mentioned.",
				},
				intent_type: {
					type: "string",
					enum: ["code_change", "investigation", "explanation", "review", "deployment", "other"],
					description: "The primary type of task being delegated.",
				},
				conversation_summary: {
					type: "string",
					description: "A 1-3 sentence summary of the voice conversation leading to this delegation.",
				},
				urgency: {
					type: "string",
					enum: ["low", "normal", "high"],
				},
				referenced_files: {
					type: "array",
					items: { type: "string" },
					description: "File paths or component names the user mentioned.",
				},
			},
			required: ["prompt", "intent_type"],
		},
	},
	// ── Screen-assistant tools (app-owned actions on the Studio surface) ──────
	// These are executed by the browser client, which returns a
	// `function_call_output` back through the relay. The model never touches the
	// DOM directly — it only requests whitelisted app actions and reads
	// structured screen state.
	{
		type: "function",
		name: "get_screen_state",
		description:
				"Read the current Studio screen as structured state before answering or acting. " +
				"Returns the active route/panel, composer text, what the pointer is over, and a " +
				"list of visible targets (id, label, role) you can point at or act on. " +
				"If the user painted or highlighted an area, the result includes activeRegion " +
				"with its viewport rect, freeform path, and targetHints inside the region. " +
				"Call this first whenever the user asks about what is on screen, 'this', 'here', " +
				"or refers to a control you need to locate.",
		parameters: { type: "object", properties: {}, required: [] },
	},
	{
		type: "function",
		name: "point_at_target",
		description:
				"Move the on-screen cursor to a visible target to direct the user's attention. " +
				"Identify the target using one of the ids or fieldIds returned by get_screen_state; " +
				"use labels only as a fallback when no stable id or fieldId is available. " +
				"When the user refers to 'this area' or the painted/highlighted region, prefer " +
				"targetHints from activeRegion. " +
			"When the user asks where something is or asks you to point/show it, call this " +
			"before claiming the cursor moved. Only say you are pointing after the tool " +
			"returns ok: true; if it returns ok: false, say you could not find that target.",
		parameters: {
			type: "object",
			properties: {
				targetId: { type: "string", description: "The target.id from get_screen_state." },
				fieldId: { type: "string", description: "The target.fieldId, when pointing at a form field." },
				label: { type: "string", description: "Human label of the target, used as a fallback match." },
			},
			required: [],
		},
	},
	{
		type: "function",
		name: "activate_screen_target",
		description:
			"Activate a known Studio screen target by clicking its real UI control. " +
			"Identify the target using one of the ids or fieldIds returned by get_screen_state; " +
			"use labels only as a fallback when no stable id or fieldId is available. " +
			"Use this when the user asks you to click, open, pick, choose, or activate a visible " +
			"Studio control. The browser executes the action and may scroll the tagged target into view. " +
			"Only claim the action happened after this tool returns ok: true.",
		parameters: {
			type: "object",
			properties: {
				targetId: { type: "string", description: "The target.id from get_screen_state." },
				fieldId: { type: "string", description: "The target.fieldId, when activating a form field." },
				label: { type: "string", description: "Human label of the target, used as a fallback match." },
			},
			required: [],
		},
	},
	{
		type: "function",
		name: "set_composer_text",
		description:
			"Set the text of the Studio agent-builder composer (does not submit). " +
			"Use when the user asks you to draft, write, or fill in the prompt/message.",
		parameters: {
			type: "object",
			properties: {
				text: { type: "string", description: "The composer text to set." },
			},
			required: ["text"],
		},
	},
	{
		type: "function",
		name: "submit_composer",
		description:
			"Submit the Studio composer's current text. Only call after the user clearly asks to send/submit.",
		parameters: { type: "object", properties: {}, required: [] },
	},
	{
		type: "function",
		name: "apply_agent_draft_patch",
		description:
			"Configure the session-local Studio agent-builder draft with a safe patch. " +
			"Never publishes or activates an agent. Allowed fields: name, description, summary, " +
			"instructions, contextDescription, trigger, guardrail, byline, tools, " +
			"conversationStarters, conversationStarterIcons, avatarFallback, action, plus the " +
			"capability arrays skills/apps/knowledge/subagents (catalog ids or names), avatarSrc " +
			"(an avatar option path), memoryMode/reasoningMode/knowledgeMode, triggers " +
			"(natural-language automation phrases), automationRules, and subagentPrompts. List " +
			"fields REPLACE the whole array — read the current draft first and resend existing " +
			"items plus additions. When replacing a painted instructions field, send the full " +
			"replacement Markdown body in patch.instructions. See the [Studio product knowledge] " +
			"context for the real catalog of ids.",
		parameters: {
			type: "object",
			properties: {
				patch: {
					type: "object",
					description: "Partial agent draft. Only whitelisted fields are applied client-side.",
				},
			},
			required: ["patch"],
		},
	},
];

const SESSION_STATE = {
	NOT_INITIALIZED: "not_initialized",
	READY: "ready",
	CLOSED: "closed",
};

const OPENAI_HEARTBEAT_INTERVAL_MS = 20_000;
const REALTIME_SESSION_REFRESH_MS = 55 * 60 * 1_000;
const REALTIME_AUDIO_FORMAT = {
	type: "audio/pcm",
	rate: 24_000,
};
const REALTIME_TURN_DETECTION = {
	type: "semantic_vad",
	eagerness: "auto",
	create_response: true,
	interrupt_response: true,
};
const MANUAL_TURN_COALESCE_MS = 800;
const MANUAL_TURN_HARD_CAP_MS = 4_000;

// ─── OpenAI Realtime event types ─────────────────────────────────────────────

const OPENAI_EVENT = {
	// Server events (OpenAI → us)
	SESSION_CREATED: "session.created",
	SESSION_UPDATED: "session.updated",
	RESPONSE_AUDIO_DELTA: "response.audio.delta",
	RESPONSE_OUTPUT_AUDIO_DELTA: "response.output_audio.delta",
	RESPONSE_AUDIO_DONE: "response.audio.done",
	RESPONSE_OUTPUT_AUDIO_DONE: "response.output_audio.done",
	RESPONSE_CREATED: "response.created",
	RESPONSE_TEXT_DELTA: "response.text.delta",
	RESPONSE_OUTPUT_TEXT_DELTA: "response.output_text.delta",
	RESPONSE_TEXT_DONE: "response.text.done",
	RESPONSE_OUTPUT_TEXT_DONE: "response.output_text.done",
	RESPONSE_DONE: "response.done",
	RESPONSE_AUDIO_TRANSCRIPT_DELTA: "response.audio_transcript.delta",
	RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DELTA: "response.output_audio_transcript.delta",
	RESPONSE_AUDIO_TRANSCRIPT_DONE: "response.audio_transcript.done",
	RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DONE: "response.output_audio_transcript.done",
	CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
		"conversation.item.input_audio_transcription.completed",
	CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_DELTA:
		"conversation.item.input_audio_transcription.delta",
	CONVERSATION_ITEM_CREATED: "conversation.item.created",
	CONVERSATION_ITEM_ADDED: "conversation.item.added",
	CONVERSATION_ITEM_DONE: "conversation.item.done",
	RESPONSE_OUTPUT_ITEM_ADDED: "response.output_item.added",
	RESPONSE_OUTPUT_ITEM_DONE: "response.output_item.done",
	RESPONSE_CONTENT_PART_ADDED: "response.content_part.added",
	RESPONSE_CONTENT_PART_DONE: "response.content_part.done",
	INPUT_AUDIO_BUFFER_SPEECH_STARTED: "input_audio_buffer.speech_started",
	INPUT_AUDIO_BUFFER_SPEECH_STOPPED: "input_audio_buffer.speech_stopped",
	ERROR: "error",
	RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
		"response.function_call_arguments.done",

	// Client events (us → OpenAI)
	SESSION_UPDATE: "session.update",
	INPUT_AUDIO_BUFFER_APPEND: "input_audio_buffer.append",
	INPUT_AUDIO_BUFFER_COMMIT: "input_audio_buffer.commit",
	CONVERSATION_ITEM_CREATE: "conversation.item.create",
	RESPONSE_CANCEL: "response.cancel",
	RESPONSE_CREATE: "response.create",
};

const OPENAI_EVENT_ALIASES = new Map([
	[OPENAI_EVENT.RESPONSE_OUTPUT_AUDIO_DELTA, OPENAI_EVENT.RESPONSE_AUDIO_DELTA],
	[OPENAI_EVENT.RESPONSE_OUTPUT_AUDIO_DONE, OPENAI_EVENT.RESPONSE_AUDIO_DONE],
	[OPENAI_EVENT.RESPONSE_OUTPUT_TEXT_DELTA, OPENAI_EVENT.RESPONSE_TEXT_DELTA],
	[OPENAI_EVENT.RESPONSE_OUTPUT_TEXT_DONE, OPENAI_EVENT.RESPONSE_TEXT_DONE],
	[
		OPENAI_EVENT.RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DELTA,
		OPENAI_EVENT.RESPONSE_AUDIO_TRANSCRIPT_DELTA,
	],
	[
		OPENAI_EVENT.RESPONSE_OUTPUT_AUDIO_TRANSCRIPT_DONE,
		OPENAI_EVENT.RESPONSE_AUDIO_TRANSCRIPT_DONE,
	],
]);

const OPENAI_EVENT_NO_OPS = new Set([
	OPENAI_EVENT.CONVERSATION_ITEM_CREATED,
	OPENAI_EVENT.CONVERSATION_ITEM_ADDED,
	OPENAI_EVENT.CONVERSATION_ITEM_DONE,
	OPENAI_EVENT.RESPONSE_OUTPUT_ITEM_ADDED,
	OPENAI_EVENT.RESPONSE_OUTPUT_ITEM_DONE,
	OPENAI_EVENT.RESPONSE_CONTENT_PART_ADDED,
	OPENAI_EVENT.RESPONSE_CONTENT_PART_DONE,
]);

function isNoActiveResponseCancelError(errorMessage) {
	return /cancellation failed:\s*no active response found/iu.test(errorMessage);
}

function normalizeOpenAIEventType(type) {
	if (typeof type !== "string") {
		return "";
	}

	return OPENAI_EVENT_ALIASES.get(type) ?? type;
}

function normalizeRealtimeTranscript(value) {
	if (typeof value !== "string") {
		return "";
	}

	return value.trim();
}

function collectContentPartTranscript(part, transcripts = []) {
	if (!part || typeof part !== "object") {
		return transcripts;
	}

	const directTranscript = normalizeRealtimeTranscript(part.transcript);
	if (directTranscript) {
		transcripts.push(directTranscript);
	}

	const text = normalizeRealtimeTranscript(part.text);
	if (text) {
		transcripts.push(text);
	}

	if (part.audio && typeof part.audio === "object") {
		collectContentPartTranscript(part.audio, transcripts);
	}

	if (Array.isArray(part.content)) {
		for (const childPart of part.content) {
			collectContentPartTranscript(childPart, transcripts);
		}
	}

	return transcripts;
}

function getContentPartTranscript(part) {
	return collectContentPartTranscript(part).join("\n");
}

function getOutputItemTranscriptPayload(item, responseId) {
	const content = Array.isArray(item?.content) ? item.content : [];
	const transcripts = [];

	for (const part of content) {
		collectContentPartTranscript(part, transcripts);
	}

	if (transcripts.length === 0) {
		return null;
	}

	return {
		itemId: typeof item?.id === "string" ? item.id : undefined,
		responseId,
		transcript: transcripts.join("\n"),
	};
}

function getResponseDoneTranscriptPayload(event) {
	const response = event?.response;
	const output = Array.isArray(response?.output) ? response.output : [];
	const transcriptEntries = [];

	for (const outputItem of output) {
		const payload = getOutputItemTranscriptPayload(outputItem);
		if (payload) {
			transcriptEntries.push(payload);
		}
	}

	if (transcriptEntries.length === 0) {
		return null;
	}

	return {
		itemId: transcriptEntries[0].itemId,
		responseId: typeof response?.id === "string" ? response.id : event.response_id,
		transcript: transcriptEntries.map(({ transcript }) => transcript).join("\n"),
	};
}

function buildRealtimeSessionConfig({
	instructions,
	turnDetection = REALTIME_TURN_DETECTION,
	voice,
}) {
	return {
		type: "realtime",
		instructions,
		output_modalities: ["audio"],
		audio: {
			input: {
				format: REALTIME_AUDIO_FORMAT,
				transcription: {
					model: "gpt-4o-mini-transcribe",
					language: "en",
				},
				turn_detection: turnDetection,
			},
			output: {
				format: REALTIME_AUDIO_FORMAT,
				voice,
			},
		},
		max_output_tokens: "inf",
		tools: SESSION_TOOLS,
	};
}

// ─── Session class ───────────────────────────────────────────────────────────

class RealtimeSession {
	/**
	 * @param {WebSocket} clientWs — browser-side WebSocket
	 * @param {object} [options]
	 * @param {string} [options.instructions] - system prompt override
	 * @param {Function} [options.onLog] - log callback
	 */
	constructor(clientWs, options = {}) {
		this._clientWs = clientWs;
		this._openaiWs = null;
		this._state = SESSION_STATE.NOT_INITIALIZED;
		this._instructions = options.instructions || ROVO_SYSTEM_INSTRUCTIONS;
		this._log = options.onLog || (() => {});
		this._transcriptBuffer = "";
		this._openaiHeartbeatInterval = null;
		this._awaitingOpenAIPong = false;
		this._sessionRefreshTimer = null;
		this._plannedCloseReason = null;
		this._manualTurnTaking = false;
		this._transcriptionOnly = false;
		this._explicitResponseOnly = false;
		this._manualTurnTranscriptBuffer = "";
		this._manualTurnCoalesceTimer = null;
		this._manualTurnHardCapTimer = null;
		// Track the in-flight OpenAI response so we never request a new one while
		// another is active (OpenAI rejects that). Tool outputs that arrive during
		// an active response defer their response.create until response.done.
		this._activeResponseId = null;
		this._pendingResponseCreate = false;
		this._pendingResponseCreateForce = false;
	}

	get state() {
		return this._state;
	}

	get isReady() {
		return this._state === SESSION_STATE.READY;
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────

	/**
	 * Open connection to OpenAI Realtime API and wire up bidirectional relay.
	 * Supports two auth modes:
	 *   1. Direct OpenAI: OPENAI_REALTIME_API_KEY set → Bearer token
	 *   2. AI Gateway:    ASAP credentials set → ASAP JWT + gateway headers
	 */
	async connect() {
		const config = getRealtimeConfig();
		const envVars = getEnvVars();
		const useGateway = !config.apiKey && process.env.ASAP_PRIVATE_KEY;

		if (!config.apiKey && !useGateway) {
			this._sendToClient({
				type: "error",
				error: {
					message: "No auth configured — set OPENAI_REALTIME_API_KEY or ASAP credentials",
					code: "config_missing",
				},
			});
			return;
		}

		const wsUrl = `${config.wsUrl}?model=${encodeURIComponent(config.model)}`;
		let headers;

		if (useGateway) {
			const token = await getAuthToken();
			headers = {
				Authorization: `bearer ${token}`,
				"OpenAI-Beta": "realtime=v1",
				"X-Atlassian-UseCaseId": envVars.AI_GATEWAY_USE_CASE_ID,
				"X-Atlassian-CloudId": resolveGatewayCloudId(envVars),
				"X-Atlassian-UserId": envVars.AI_GATEWAY_USER_ID,
			};
			this._log("REALTIME", `Connecting via AI Gateway: ${config.wsUrl} (model: ${config.model})`);
		} else {
			headers = {
				Authorization: `Bearer ${config.apiKey}`,
				"OpenAI-Beta": "realtime=v1",
			};
			this._log("REALTIME", `Connecting to OpenAI Realtime: ${config.wsUrl} (model: ${config.model})`);
		}

		this._openaiWs = new WebSocket(wsUrl, { headers });

		this._openaiWs.on("open", () => {
			this._log("REALTIME", "Connected to OpenAI Realtime API");
			this._startOpenAIHeartbeat();
			this._scheduleSessionRefresh();
			// Session update (with tools) is deferred to session.created
			// to avoid a race where OpenAI's application layer isn't ready yet.
		});

		this._openaiWs.on("message", (data) => {
			this._handleOpenAIMessage(data);
		});

		this._openaiWs.on("pong", () => {
			this._awaitingOpenAIPong = false;
		});

		this._openaiWs.on("close", (code, reason) => {
			const plannedCloseReason = this._plannedCloseReason;
			this._plannedCloseReason = null;
			this._clearSessionMaintenanceTimers();
			this._clearManualTurnTranscription();
			const reasonText = Buffer.isBuffer(reason)
				? reason.toString("utf8")
				: typeof reason === "string"
					? reason
					: "";
			this._log("REALTIME", `OpenAI WS closed: ${code} ${reasonText}`);
			this._state = SESSION_STATE.CLOSED;
			if (plannedCloseReason === null) {
				// Surface the upstream close code/reason so the real failure is
				// actionable client-side. A bare "connection closed" hides the
				// true cause (e.g. invalid model, auth rejection, rate limit).
				const detail = reasonText ? `${code}: ${reasonText}` : String(code);
				this._sendToClient({
					type: "error",
					error: {
						message: `OpenAI connection closed (${detail})`,
						code: "connection_closed",
						closeCode: code,
						closeReason: reasonText || undefined,
					},
				});
			}
			// Close the client WebSocket so the browser's onclose handler
			// fires and triggers reconnection. Without this, the client
			// stays connected to the backend but audio is silently dropped.
			if (
				this._clientWs &&
				this._clientWs.readyState === WebSocket.OPEN
			) {
				this._clientWs.close(
					1001,
					plannedCloseReason === "session_refresh"
						? "Realtime session refresh"
						: plannedCloseReason === "heartbeat_timeout"
							? "Realtime upstream heartbeat timeout"
							: "OpenAI upstream closed"
				);
			}
		});

		this._openaiWs.on("error", (err) => {
			this._log("REALTIME", `OpenAI WS error: ${err.message}`);
			this._sendToClient({
				type: "error",
				error: { message: err.message, code: "connection_error" },
			});
		});

		// Fired when OpenAI/the gateway rejects the WebSocket upgrade with a
		// non-101 HTTP response (e.g. 401 auth, 404 unknown model, 429 rate
		// limit). The response body carries the actionable reason, which the
		// generic `error`/`close` events do not expose. We mark the close as
		// planned so the close handler does not also emit a vaguer error.
		this._openaiWs.on("unexpected-response", (_req, res) => {
			let body = "";
			res.on("data", (chunk) => {
				if (body.length < 2_000) {
					body += chunk.toString("utf8");
				}
			});
			res.on("end", () => {
				const statusCode = res.statusCode;
				const detail = body.trim().slice(0, 500) || res.statusMessage || "";
				this._plannedCloseReason = "upstream_rejected";
				this._log(
					"REALTIME",
					`OpenAI rejected upgrade: HTTP ${statusCode} ${detail}`,
				);
				this._state = SESSION_STATE.CLOSED;
				this._sendToClient({
					type: "error",
					error: {
						message: `OpenAI rejected the Realtime connection (HTTP ${statusCode})${detail ? `: ${detail}` : ""}`,
						code: "connection_error",
						statusCode,
					},
				});
			});
		});
	}

	/**
	 * Close the OpenAI session and clean up.
	 */
	close() {
		this._state = SESSION_STATE.CLOSED;
		this._plannedCloseReason = null;
		this._clearSessionMaintenanceTimers();
		this._clearManualTurnTranscription();
		if (this._openaiWs) {
			if (
				this._openaiWs.readyState === WebSocket.OPEN ||
				this._openaiWs.readyState === WebSocket.CONNECTING
			) {
				this._openaiWs.close();
			}
			this._openaiWs = null;
		}
		this._log("REALTIME", "Session closed");
	}

	_clearSessionMaintenanceTimers() {
		if (this._openaiHeartbeatInterval !== null) {
			clearInterval(this._openaiHeartbeatInterval);
			this._openaiHeartbeatInterval = null;
		}
		if (this._sessionRefreshTimer !== null) {
			clearTimeout(this._sessionRefreshTimer);
			this._sessionRefreshTimer = null;
		}
		this._awaitingOpenAIPong = false;
	}

	_startOpenAIHeartbeat() {
		this._clearSessionMaintenanceTimers();
		this._openaiHeartbeatInterval = setInterval(() => {
			const ws = this._openaiWs;
			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return;
			}

			if (this._awaitingOpenAIPong) {
				this._plannedCloseReason = "heartbeat_timeout";
				this._log("REALTIME", "OpenAI heartbeat timed out; reconnecting session");
				ws.terminate();
				return;
			}

			this._awaitingOpenAIPong = true;
			try {
				ws.ping();
			} catch (error) {
				this._plannedCloseReason = "heartbeat_timeout";
				this._log("REALTIME", `Failed to ping OpenAI Realtime: ${error.message}`);
				ws.terminate();
			}
		}, OPENAI_HEARTBEAT_INTERVAL_MS);
	}

	_scheduleSessionRefresh() {
		this._sessionRefreshTimer = setTimeout(() => {
			const ws = this._openaiWs;
			if (!ws || this._state === SESSION_STATE.CLOSED) {
				return;
			}

			this._plannedCloseReason = "session_refresh";
			this._log("REALTIME", "Refreshing Realtime session before max lifetime");
			this._clearManualTurnTranscription();
			if (
				ws.readyState === WebSocket.OPEN ||
				ws.readyState === WebSocket.CONNECTING
			) {
				ws.close(1000, "session refresh");
			}
		}, REALTIME_SESSION_REFRESH_MS);
	}

	// ── Client message handling ───────────────────────────────────────────

	/**
	 * Handle an incoming message from the browser client.
	 * @param {string} raw — JSON string
	 */
	handleClientMessage(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			this._log("REALTIME", `Invalid JSON from client: ${String(raw).slice(0, 100)}`);
			return;
		}

		switch (msg.type) {
			case "audio_buffer_append":
				this._relayAudioAppend(msg);
				break;
			case "audio_buffer_commit":
				this._relayAudioCommit();
				break;
			case "session_update":
				this._handleClientSessionUpdate(msg);
				break;
			case "context_inject":
				this._handleContextInject(msg);
				break;
			case "text_message_from_user":
				this._handleTextMessageFromUser(msg);
				break;
			case "response_create":
				this._handleResponseCreate();
				break;
			case "function_call_output":
				this._handleFunctionCallOutput(msg);
				break;
			default:
				this._log("REALTIME", `Unknown client message type: ${msg.type}`);
		}
	}

	// ── Audio relay ───────────────────────────────────────────────────────

	_relayAudioAppend(msg) {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		this._sendToOpenAI({
			type: OPENAI_EVENT.INPUT_AUDIO_BUFFER_APPEND,
			audio: msg.audio,
		});
	}

	_relayAudioCommit() {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		this._sendToOpenAI({
			type: OPENAI_EVENT.INPUT_AUDIO_BUFFER_COMMIT,
		});
	}

	// ── Session update ────────────────────────────────────────────────────

	_sendSessionUpdate(config) {
		this._sendToOpenAI({
			type: OPENAI_EVENT.SESSION_UPDATE,
			session: buildRealtimeSessionConfig({
				instructions: this._instructions,
				voice: config.voice,
			}),
		});
	}

	_handleClientSessionUpdate(msg) {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		const config = getRealtimeConfig();
		const clientConfig =
			msg.config && typeof msg.config === "object"
				? msg.config
				: msg;
		const manualTurnTaking =
			clientConfig.turn_detection?.create_response === false;
		if (this._manualTurnTaking && !manualTurnTaking) {
			this._clearManualTurnTranscription();
		}
		this._manualTurnTaking = manualTurnTaking;
		this._transcriptionOnly = clientConfig.transcription_only === true;
		this._explicitResponseOnly = clientConfig.explicit_response_only === true;
		const session = buildRealtimeSessionConfig({
			instructions:
				typeof clientConfig.instructions === "string" && clientConfig.instructions
					? clientConfig.instructions
					: this._instructions,
			turnDetection:
				clientConfig.turn_detection && typeof clientConfig.turn_detection === "object"
					? clientConfig.turn_detection
					: REALTIME_TURN_DETECTION,
			voice:
				typeof clientConfig.voice === "string" && clientConfig.voice
					? clientConfig.voice
					: config.voice,
		});

		this._sendToOpenAI({
			type: OPENAI_EVENT.SESSION_UPDATE,
			session,
		});
	}

	// ── Context injection ─────────────────────────────────────────────────

	_handleContextInject(msg) {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		// Client sends { type: "context_inject", data: { type, summary, content } }
		const data = msg.data || msg;
		const contextType = data.type || data.contextType;
		const content = data.content || data.summary;

		if (!SUPPORTED_CONTEXT_TYPES.has(contextType)) {
			this._log("REALTIME", `Unknown context_inject contextType: ${contextType}`);
			return;
		}

		const text =
			typeof content === "string"
				? content
				: JSON.stringify(content);

		this._sendToOpenAI({
			type: OPENAI_EVENT.CONVERSATION_ITEM_CREATE,
			item: {
				type: "message",
				role: "system",
				content: [
					{
						type: "input_text",
						text,
					},
				],
			},
		});
		this._log("REALTIME", `Context injected: ${contextType}`);
	}

	// ── Response creation ─────────────────────────────────────────────────

	_handleResponseCreate() {
		this._requestResponse();
	}

	/**
	 * Request a model response, but never while another response is already in
	 * flight — OpenAI rejects that with "Conversation already has an active
	 * response in progress". If one is active, defer until RESPONSE_DONE.
	 */
	_requestResponse(options = {}) {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		if (this._transcriptionOnly) {
			this._log("REALTIME", "Response create ignored — transcription-only mode");
			return;
		}

		if (this._explicitResponseOnly && options.force !== true) {
			this._log("REALTIME", "Response create ignored — explicit-response-only mode");
			return;
		}

		if (this._activeResponseId) {
			this._pendingResponseCreate = true;
			this._pendingResponseCreateForce = this._pendingResponseCreateForce || options.force === true;
			this._log("REALTIME", "Response create deferred — active response in progress");
			return;
		}

		this._sendToOpenAI({
			type: OPENAI_EVENT.RESPONSE_CREATE,
			response: {},
		});
		this._log("REALTIME", "Response creation requested");
	}

	// ── Manual turn-taking ────────────────────────────────────────────────

	_handleTranscriptionCompleted(event) {
		this._log("REALTIME", `Transcription completed: ${JSON.stringify(event.transcript)}`);

		if (!this._manualTurnTaking) {
			this._sendToClient({
				type: "transcription_completed",
				transcript: event.transcript,
			});
			return;
		}

		this._coalesceManualTurnTranscription(event.transcript);
	}

	_coalesceManualTurnTranscription(transcript) {
		const text = typeof transcript === "string" ? transcript.trim() : "";
		if (!text) {
			return;
		}

		this._manualTurnTranscriptBuffer = this._manualTurnTranscriptBuffer
			? `${this._manualTurnTranscriptBuffer} ${text}`
			: text;

		if (this._manualTurnCoalesceTimer !== null) {
			clearTimeout(this._manualTurnCoalesceTimer);
		}
		this._manualTurnCoalesceTimer = setTimeout(() => {
			this._flushManualTurnTranscription();
		}, MANUAL_TURN_COALESCE_MS);

		if (this._manualTurnHardCapTimer === null) {
			this._manualTurnHardCapTimer = setTimeout(() => {
				this._flushManualTurnTranscription();
			}, MANUAL_TURN_HARD_CAP_MS);
		}
	}

	_flushManualTurnTranscription() {
		const transcript = this._manualTurnTranscriptBuffer.trim();
		this._clearManualTurnTranscription();

		if (!transcript) {
			return;
		}

		this._sendToClient({
			type: "transcription_completed",
			transcript,
		});
		if (!this._transcriptionOnly) {
			this._requestResponse();
		}
	}

	_clearManualTurnTranscription() {
		if (this._manualTurnCoalesceTimer !== null) {
			clearTimeout(this._manualTurnCoalesceTimer);
			this._manualTurnCoalesceTimer = null;
		}
		if (this._manualTurnHardCapTimer !== null) {
			clearTimeout(this._manualTurnHardCapTimer);
			this._manualTurnHardCapTimer = null;
		}
		this._manualTurnTranscriptBuffer = "";
	}

	_handleSpeechStarted() {
		if (this._manualTurnTaking && this._activeResponseId) {
			this._sendToOpenAI({
				type: OPENAI_EVENT.RESPONSE_CANCEL,
			});
			this._clearManualTurnTranscription();
			this._pendingResponseCreate = false;
			this._pendingResponseCreateForce = false;
		}

		this._sendToClient({ type: "speech_started" });
	}

	// ── Tool results ──────────────────────────────────────────────────────
	//
	// The browser executes app-owned tools (get_screen_state, point_at_target,
	// set_composer_text, submit_composer, apply_agent_draft_patch) and returns
	// the result here. We hand the output to OpenAI as a function_call_output
	// item, then request a new response so the model can continue grounded in
	// the result. Client sends:
	//   { type: "function_call_output", callId: string, output: string|object,
	//     createResponse?: boolean }
	_handleFunctionCallOutput(msg) {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		const callId = typeof msg.callId === "string" ? msg.callId : msg.call_id;
		if (!callId) {
			this._log("REALTIME", "function_call_output missing callId");
			return;
		}

		const output =
			typeof msg.output === "string" ? msg.output : JSON.stringify(msg.output ?? {});

		this._sendToOpenAI({
			type: OPENAI_EVENT.CONVERSATION_ITEM_CREATE,
			item: {
				type: "function_call_output",
				call_id: callId,
				output,
			},
		});

		// Default to letting the model continue; the client can suppress this for
		// fire-and-forget actions by passing createResponse: false. Routed through
		// _requestResponse so it waits for any in-flight response to finish.
		if (msg.createResponse !== false) {
			this._requestResponse();
		}
		this._log("REALTIME", `function_call_output relayed for ${callId}`);
	}

	_handleTextMessageFromUser(msg) {
		if (!this.isReady || !this._openaiWs) {
			return;
		}

		const text = typeof msg.text === "string" ? msg.text.trim() : "";
		if (!text) {
			return;
		}

		this._sendToOpenAI({
			type: OPENAI_EVENT.CONVERSATION_ITEM_CREATE,
			item: {
				type: "message",
				role: "user",
				content: [
					{
						type: "input_text",
						text,
					},
				],
			},
		});
		this._requestResponse({ force: true });
		this._log("REALTIME", "Text message received from user");
	}

	// ── OpenAI event handling ─────────────────────────────────────────────

	_handleOpenAIMessage(data) {
		let event;
		try {
			event = JSON.parse(data.toString());
		} catch {
			this._log("REALTIME", `Invalid JSON from OpenAI: ${String(data).slice(0, 100)}`);
			return;
		}

		const normalizedEventType = normalizeOpenAIEventType(event.type);

		switch (normalizedEventType) {
			case OPENAI_EVENT.SESSION_CREATED:
				this._state = SESSION_STATE.READY;
				// Fresh session — no response can be in flight from a prior connection.
				this._activeResponseId = null;
				this._pendingResponseCreate = false;
				this._pendingResponseCreateForce = false;
				this._manualTurnTaking = false;
				this._explicitResponseOnly = false;
				this._clearManualTurnTranscription();
				this._log("REALTIME", `Session created: ${event.session?.id || "unknown"}`);
				this._sendSessionUpdate(getRealtimeConfig());
				this._sendToClient({ type: "session_ready", sessionId: event.session?.id });
				break;

			case OPENAI_EVENT.SESSION_UPDATED:
				this._log("REALTIME", `Session updated — tools: ${event.session?.tools?.length ?? 0}`);
				break;

			case OPENAI_EVENT.RESPONSE_AUDIO_DELTA:
				this._sendToClient({
					type: "audio_delta",
					delta: event.delta,
				});
				break;

			case OPENAI_EVENT.RESPONSE_CREATED:
				this._activeResponseId = event.response?.id ?? event.response_id ?? null;
				this._sendToClient({
					type: "response_created",
					responseId: event.response?.id ?? event.response_id,
				});
				break;

			case OPENAI_EVENT.RESPONSE_AUDIO_DONE:
				// Audio stream for this response is complete — no client action needed
				break;

			case OPENAI_EVENT.RESPONSE_TEXT_DELTA:
				this._sendToClient({
					type: "text_delta",
					delta: event.delta,
					itemId: event.item_id,
					responseId: event.response_id,
				});
				break;

			case OPENAI_EVENT.RESPONSE_TEXT_DONE:
				// Text stream complete
				break;

			case OPENAI_EVENT.RESPONSE_AUDIO_TRANSCRIPT_DELTA:
				this._sendToClient({
					type: "audio_transcript_delta",
					delta: event.delta,
					itemId: event.item_id,
					responseId: event.response_id,
				});
				break;

				case OPENAI_EVENT.RESPONSE_AUDIO_TRANSCRIPT_DONE:
					this._sendToClient({
						type: "audio_transcript_done",
						transcript: event.transcript,
						itemId: event.item_id,
						responseId: event.response_id,
					});
					break;

				case OPENAI_EVENT.RESPONSE_CONTENT_PART_DONE: {
					const transcript = getContentPartTranscript(event.part);
					if (transcript) {
						this._sendToClient({
							type: "audio_transcript_done",
							transcript,
							itemId: event.item_id,
							responseId: event.response_id,
						});
					}
					break;
				}

				case OPENAI_EVENT.RESPONSE_DONE:
					this._activeResponseId = null;
					{
						const transcriptPayload = getResponseDoneTranscriptPayload(event);
						if (transcriptPayload) {
							this._sendToClient({
								type: "audio_transcript_done",
								...transcriptPayload,
							});
						}
					}
					this._sendToClient({
						type: "response_done",
						responseId: event.response?.id ?? event.response_id,
					});
				// A tool output (or other request) arrived mid-response and deferred
				// its response.create — now that the response is done, fire it.
				if (this._pendingResponseCreate) {
					const forcePendingResponseCreate = this._pendingResponseCreateForce;
					this._pendingResponseCreate = false;
					this._pendingResponseCreateForce = false;
					this._requestResponse({ force: forcePendingResponseCreate });
				}
				break;

			case OPENAI_EVENT.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_DELTA:
				this._log("REALTIME", `Transcription delta: ${JSON.stringify(event.delta)}`);
				this._sendToClient({
					type: "transcription_delta",
					delta: event.delta,
				});
				break;

			case OPENAI_EVENT.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
				this._handleTranscriptionCompleted(event);
				break;

			case OPENAI_EVENT.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
				this._handleSpeechStarted();
				break;

			case OPENAI_EVENT.INPUT_AUDIO_BUFFER_SPEECH_STOPPED:
				this._sendToClient({ type: "speech_stopped" });
				break;

			case OPENAI_EVENT.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
				if (event.name === "delegate_to_rovo") {
					// Send function_call_output back to OpenAI so GPT can continue
					// speaking its verbal acknowledgment while Rovo works
					this._sendToOpenAI({
						type: OPENAI_EVENT.CONVERSATION_ITEM_CREATE,
						item: {
							type: "function_call_output",
							call_id: event.call_id,
							output: JSON.stringify({ status: "delegated", message: "Task sent to Rovo for processing." }),
						},
					});
					this._requestResponse();
				}
				// Forward all function calls to the client
				this._sendToClient({
					type: "function_call",
					name: event.name,
					arguments: event.arguments,
					callId: event.call_id,
				});
				break;

			case OPENAI_EVENT.ERROR: {
				const errorCode = event.error?.code || "unknown";
				const errorMessage = event.error?.message || "Unknown error";
				const isActiveResponseRace =
					errorCode === "conversation_already_has_active_response" ||
					/active response in progress/iu.test(errorMessage);
				const isStaleResponseCancel = isNoActiveResponseCancelError(errorMessage);
				// These are recoverable, non-fatal warnings — don't surface to the client.
				if (errorCode === "input_audio_buffer_commit_empty" || isActiveResponseRace || isStaleResponseCancel) {
					if (isStaleResponseCancel) {
						this._activeResponseId = null;
						this._pendingResponseCreate = false;
						this._pendingResponseCreateForce = false;
					}
					this._log("REALTIME", `OpenAI warning: ${errorMessage}`);
				} else {
					this._log("REALTIME", `OpenAI error: ${errorCode} — ${errorMessage}`);
					this._sendToClient({
						type: "error",
						error: { message: errorMessage, code: errorCode },
					});
				}
				break;
			}

			default:
				if (OPENAI_EVENT_NO_OPS.has(event.type)) {
					break;
				}
				// Log unrecognized events for debugging but don't forward them
				this._log("REALTIME", `Unhandled OpenAI event: ${event.type}`);
		}
	}

	// ── Transport helpers ─────────────────────────────────────────────────

	_sendToOpenAI(payload) {
		if (
			!this._openaiWs ||
			this._openaiWs.readyState !== WebSocket.OPEN
		) {
			return;
		}

		try {
			this._openaiWs.send(JSON.stringify(payload));
		} catch (err) {
			this._log("REALTIME", `Failed to send to OpenAI: ${err.message}`);
		}
	}

	_sendToClient(payload) {
		if (
			!this._clientWs ||
			this._clientWs.readyState !== WebSocket.OPEN
		) {
			return;
		}

		try {
			this._clientWs.send(JSON.stringify(payload));
		} catch (err) {
			this._log("REALTIME", `Failed to send to client: ${err.message}`);
		}
	}
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
	RealtimeSession,
	ROVO_SYSTEM_INSTRUCTIONS,
	SESSION_STATE,
};
