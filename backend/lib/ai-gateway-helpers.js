const crypto = require("crypto");

const DEBUG = process.env.DEBUG === "true";

function debugLog(section, message, data) {
	if (DEBUG) {
		console.log(`[DEBUG][${section}] ${message}`, data ? JSON.stringify(data, null, 2) : "");
	}
}

// Transient gateway responses worth retrying: 429 (use-case quota breach) and
// 503 (upstream briefly unavailable). The shared AI Gateway use-case quota can
// be momentarily exceeded when several dev stacks share it, which otherwise
// kills the whole turn (e.g. Studio agent creation produces no result).
const GATEWAY_RETRYABLE_STATUSES = new Set([429, 503]);
const DEFAULT_GATEWAY_MAX_ATTEMPTS = 4;
const DEFAULT_GATEWAY_BASE_DELAY_MS = 750;
const MAX_GATEWAY_RETRY_DELAY_MS = 8000;
const STAGING_DUMMY_CLOUD_ID_PREFIX = "internal-dummy-";
const FALLBACK_STAGING_DUMMY_CLOUD_ID = "internal-dummy-vpk-local";
const LEGACY_LOCAL_TESTING_CLOUD_ID = "local-testing";
const TENANT_CLOUD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUMMY_CLOUD_ID_PATTERN = /^(internal|external)-dummy-/i;

let hasWarnedStagingCloudIdRemap = false;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Resolve a `Retry-After` header (delta-seconds or HTTP-date) to milliseconds.
// Returns null when absent/unparseable so the caller falls back to backoff.
function parseRetryAfterMs(headerValue) {
	if (!headerValue) {
		return null;
	}
	const seconds = Number(headerValue);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return Math.min(seconds * 1000, MAX_GATEWAY_RETRY_DELAY_MS);
	}
	const dateMs = Date.parse(headerValue);
	if (Number.isFinite(dateMs)) {
		const delta = dateMs - Date.now();
		return delta > 0 ? Math.min(delta, MAX_GATEWAY_RETRY_DELAY_MS) : 0;
	}
	return null;
}

/**
 * Issues a gateway request with bounded retry on transient rate-limit/unavailable
 * responses. Retrying with exponential backoff (honoring `Retry-After` when
 * present) converts a momentary quota breach into a short delay instead of a
 * hard turn failure. Only the request/status step is retried — safe because a
 * 429/503 is returned before any SSE body is read.
 *
 * `doFetch` must return a Fetch `Response`. Non-retryable responses (success or
 * other error statuses) are returned unchanged so existing error handling and
 * streaming continue to apply.
 *
 * @param {() => Promise<Response>} doFetch
 * @param {{maxAttempts?: number, baseDelayMs?: number, sleepFn?: (ms:number)=>Promise<void>}} [options]
 * @returns {Promise<Response>}
 */
async function fetchGatewayWithRateLimitRetry(
	doFetch,
	{ maxAttempts = DEFAULT_GATEWAY_MAX_ATTEMPTS, baseDelayMs = DEFAULT_GATEWAY_BASE_DELAY_MS, sleepFn = sleep } = {},
) {
	let attempt = 0;
	let response = await doFetch();
	while (GATEWAY_RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts - 1) {
		const retryAfterMs = parseRetryAfterMs(
			typeof response.headers?.get === "function" ? response.headers.get("retry-after") : null,
		);
		const backoffMs = Math.min(baseDelayMs * 2 ** attempt, MAX_GATEWAY_RETRY_DELAY_MS);
		const delayMs = retryAfterMs == null ? backoffMs : retryAfterMs;
		debugLog(
			"GATEWAY_RETRY",
			`status ${response.status}; retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts - 1})`,
		);
		await sleepFn(delayMs);
		attempt += 1;
		response = await doFetch();
	}
	return response;
}


function getEnvVars() {
	return {
		AI_GATEWAY_URL: process.env.AI_GATEWAY_URL,
		AI_GATEWAY_URL_GOOGLE: process.env.AI_GATEWAY_URL_GOOGLE,
		AI_GATEWAY_USE_CASE_ID: process.env.AI_GATEWAY_USE_CASE_ID,
		AI_GATEWAY_CLOUD_ID: process.env.AI_GATEWAY_CLOUD_ID,
		AI_GATEWAY_USER_ID: process.env.AI_GATEWAY_USER_ID,
		OPENAI_MODEL: process.env.OPENAI_MODEL,
		GOOGLE_IMAGE_MODEL: process.env.GOOGLE_IMAGE_MODEL,
		GOOGLE_TTS_MODEL: process.env.GOOGLE_TTS_MODEL,
		GOOGLE_STT_MODEL: process.env.GOOGLE_STT_MODEL,
	};
}

function describeGatewayCloudIdKind(value) {
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (!trimmed) {
		return "MISSING";
	}
	if (isDummyGatewayCloudId(trimmed)) {
		return "DUMMY";
	}
	if (trimmed === LEGACY_LOCAL_TESTING_CLOUD_ID) {
		return "LOCAL_TESTING";
	}
	if (looksLikeTenantCloudId(trimmed)) {
		return "UUID";
	}
	return "OTHER";
}

function getAIGatewayConfigReport(envVars = getEnvVars()) {
	const realtimeConfig = getRealtimeConfig();
	const resolvedCloudId = resolveGatewayCloudId(envVars);
	return {
		AI_GATEWAY_URL: envVars.AI_GATEWAY_URL ? "SET" : "MISSING",
		AI_GATEWAY_URL_GOOGLE: envVars.AI_GATEWAY_URL_GOOGLE ? "SET" : "MISSING",
		AI_GATEWAY_USE_CASE_ID: envVars.AI_GATEWAY_USE_CASE_ID ? "SET" : "MISSING",
		AI_GATEWAY_CLOUD_ID: envVars.AI_GATEWAY_CLOUD_ID ? "SET" : "MISSING",
		AI_GATEWAY_CLOUD_ID_KIND: describeGatewayCloudIdKind(envVars.AI_GATEWAY_CLOUD_ID),
		AI_GATEWAY_CLOUD_ID_RESOLVED_KIND: describeGatewayCloudIdKind(resolvedCloudId),
		AI_GATEWAY_USER_ID: envVars.AI_GATEWAY_USER_ID ? "SET" : "MISSING",
		ASAP_ISSUER: process.env.ASAP_ISSUER ? "SET" : "MISSING",
		ASAP_KID: process.env.ASAP_KID ? "SET" : "MISSING",
		ASAP_PRIVATE_KEY: process.env.ASAP_PRIVATE_KEY ? "SET" : "MISSING",
		OPENAI_REALTIME_MODEL: realtimeConfig.model,
		OPENAI_REALTIME_WS_URL: realtimeConfig.wsUrl ? "SET" : "MISSING",
		OPENAI_REALTIME_VOICE: realtimeConfig.voice,
	};
}

function hasGatewayUrlConfigured(envVars = getEnvVars()) {
	return Boolean(envVars.AI_GATEWAY_URL || envVars.AI_GATEWAY_URL_GOOGLE);
}

function isStagingAiGatewayUrl(url) {
	return typeof url === "string" && /\.staging\.atl-paas\.net/i.test(url);
}

function isDummyGatewayCloudId(value) {
	return DUMMY_CLOUD_ID_PATTERN.test(String(value || "").trim());
}

function looksLikeTenantCloudId(value) {
	return TENANT_CLOUD_ID_PATTERN.test(String(value || "").trim());
}

function buildStagingDummyCloudId(useCaseId) {
	const trimmed = typeof useCaseId === "string" ? useCaseId.trim() : "";
	return trimmed ? `${STAGING_DUMMY_CLOUD_ID_PREFIX}${trimmed}` : FALLBACK_STAGING_DUMMY_CLOUD_ID;
}

function shouldReplaceStagingCloudId(configured) {
	return !configured
		|| configured === LEGACY_LOCAL_TESTING_CLOUD_ID
		|| looksLikeTenantCloudId(configured);
}

/**
 * Staging AI Gateway rejects tenant CloudIDs that are not provisioned there,
 * including the old `local-testing` alias. Local/dev (and Proximity) use a
 * dummy CloudID of the form `internal-dummy-<use-case-id>`.
 *
 * Production gateway URLs keep a real provisioned CloudID unchanged.
 */
function resolveGatewayCloudId(envVars = {}) {
	const configured = typeof envVars.AI_GATEWAY_CLOUD_ID === "string"
		? envVars.AI_GATEWAY_CLOUD_ID.trim()
		: "";

	if (isDummyGatewayCloudId(configured)) {
		return configured;
	}

	const gatewayUrl = envVars.AI_GATEWAY_URL || envVars.AI_GATEWAY_URL_GOOGLE || "";
	if (!isStagingAiGatewayUrl(gatewayUrl)) {
		return configured;
	}

	if (!shouldReplaceStagingCloudId(configured)) {
		return configured;
	}

	const resolved = buildStagingDummyCloudId(envVars.AI_GATEWAY_USE_CASE_ID);
	if (!hasWarnedStagingCloudIdRemap) {
		hasWarnedStagingCloudIdRemap = true;
		console.warn(
			"[AI_GATEWAY] Staging CloudID is missing, `local-testing`, or a tenant UUID. " +
				`Using ${resolved}. Set AI_GATEWAY_CLOUD_ID=internal-dummy-<use-case-id> in .env.local to match Proximity.`,
		);
	}
	return resolved;
}

function describeGatewayCloudIdError(errorText) {
	const text = String(errorText || "");
	if (!/CloudID is invalid or not provisioned/i.test(text)) {
		return text;
	}

	return (
		`${text.trim()} Staging AI Gateway rejects tenant UUIDs and \`local-testing\`. ` +
		"Set AI_GATEWAY_CLOUD_ID=internal-dummy-<use-case-id> (same dummy CloudID Proximity uses), then restart."
	);
}

function base64UrlEncode(value) {
	const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
	return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signJwtRs256(payload, privateKey, kid) {
	const header = {
		alg: "RS256",
		typ: "JWT",
		kid,
	};
	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;

	const signer = crypto.createSign("RSA-SHA256");
	signer.update(signingInput);
	signer.end();
	const signature = signer.sign(privateKey);

	return `${signingInput}.${base64UrlEncode(signature)}`;
}

function generateAsapToken() {
	let privateKey = process.env.ASAP_PRIVATE_KEY;
	if (!privateKey) {
		throw new Error("ASAP_PRIVATE_KEY not found in environment");
	}

	debugLog("AUTH", `Processing ASAP_PRIVATE_KEY (length: ${privateKey.length})`);

	if (privateKey.trim().startsWith("data:")) {
		debugLog("AUTH", "Detected data URI format, attempting to decode...");
		const match = privateKey.match(/^data:[^;]*;base64,(.+)$/is);
		if (match && match[1]) {
			try {
				privateKey = Buffer.from(match[1], "base64").toString("utf-8");
				debugLog("AUTH", "Successfully decoded data URI");
			} catch (error) {
				debugLog("AUTH", `Failed to decode base64: ${error.message}`);
			}
		}
	}

	privateKey = privateKey.replace(/\\n/g, "\n").trim();

	if (!privateKey.includes("-----BEGIN")) {
		debugLog("AUTH", "Key doesn't contain -----BEGIN. Trying base64 decode...");
		try {
			const decoded = Buffer.from(privateKey, "base64").toString("utf-8");
			if (decoded.includes("-----BEGIN")) {
				privateKey = decoded;
				debugLog("AUTH", "Successfully decoded base64 to PEM format");
			}
		} catch {
			// keep original value
		}
	}

	if (!privateKey.startsWith("-----BEGIN")) {
		throw new Error("ASAP_PRIVATE_KEY is not in valid PEM format");
	}

	const issuer = process.env.ASAP_ISSUER || process.env.AI_GATEWAY_USE_CASE_ID;
	const kid = process.env.ASAP_KID;
	if (!issuer || !kid) {
		throw new Error("Missing ASAP configuration: ASAP_ISSUER and ASAP_KID must be set in .env.local");
	}

	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: issuer,
		sub: issuer,
		aud: ["ai-gateway"],
		iat: now,
		exp: now + 60,
		jti: `${issuer}-${now}-${Math.random().toString(36).substring(2, 10)}`,
	};

	return signJwtRs256(payload, privateKey, kid);
}

async function getAuthToken() {
	debugLog("AUTH", "Using ASAP authentication");
	return generateAsapToken();
}

function detectEndpointType(url) {
	const aiGatewayUrl = url || process.env.AI_GATEWAY_URL || "";
	if (/\/v1\/bedrock\/model\//.test(aiGatewayUrl) || /\/provider\/bedrock\//.test(aiGatewayUrl)) {
		return "bedrock";
	}
	if (/\/v1\/google\//.test(aiGatewayUrl)) {
		return "google";
	}
	return "openai";
}


function getGatewayHeaders(envVars, token, stream = false) {
	const headers = {
		"Content-Type": "application/json",
		Authorization: `bearer ${token}`,
		"X-Atlassian-UseCaseId": envVars.AI_GATEWAY_USE_CASE_ID,
		"X-Atlassian-CloudId": resolveGatewayCloudId(envVars),
		"X-Atlassian-UserId": envVars.AI_GATEWAY_USER_ID,
	};

	if (stream) {
		return {
			...headers,
			Accept: "text/event-stream",
		};
	}

	return headers;
}

function translateGoogleUrl(gatewayUrl) {
	if (!gatewayUrl || typeof gatewayUrl !== "string") {
		return gatewayUrl;
	}

	const withSuffix = /\/v1\/google\/v1\/publishers\/([^/]+)\/models\/(.+):streamRawPredict$/;
	const withoutSuffix = /\/v1\/google\/v1\/publishers\/([^/]+)\/models\/(.+)$/;
	const match = gatewayUrl.match(withSuffix) || gatewayUrl.match(withoutSuffix);
	if (!match) {
		return gatewayUrl;
	}

	const [fullMatch, publisher, model] = match;
	const baseUrl = gatewayUrl.slice(0, gatewayUrl.length - fullMatch.length);

	if (publisher === "anthropic") {
		console.warn(
			`[AI_GATEWAY] Claude model "${model}" detected on Google endpoint. ` +
				`Routing to Bedrock instead. For Claude models, use: ` +
				`AI_GATEWAY_URL=...v1/bedrock/model/${model}/invoke-with-response-stream`,
		);
		return `${baseUrl}/provider/bedrock/format/openai/v1/chat/completions`;
	}

	return `${baseUrl}/v1/google/publishers/google/v1/chat/completions`;
}

function resolveGatewayUrl(gatewayUrl) {
	if (!gatewayUrl) {
		return null;
	}

	// Keep Bedrock URLs unchanged. Rewriting them to provider/bedrock/openai can
	// fail auth checks in some environments even when direct Bedrock works.
	if (detectEndpointType(gatewayUrl) === "bedrock") {
		return gatewayUrl;
	}

	return translateGoogleUrl(gatewayUrl);
}

function resolveBaseURL(gatewayUrl) {
	const resolved = resolveGatewayUrl(gatewayUrl);
	if (!resolved) {
		return null;
	}

	return resolved.replace(/\/chat\/completions$/, "");
}

function getModelId(gatewayUrl) {
	if (!gatewayUrl || typeof gatewayUrl !== "string") {
		return "";
	}

	const bedrockMatch = gatewayUrl.match(/\/model\/([^/]+)\/invoke(?:-with-response-stream)?$/);
	if (bedrockMatch?.[1]) {
		return decodeURIComponent(bedrockMatch[1]);
	}

	const googleMatch = gatewayUrl.match(/\/models\/([^/:]+)(?::[A-Za-z]+)?$/);
	if (googleMatch?.[1]) {
		return decodeURIComponent(googleMatch[1]);
	}

	const publisherMatch = gatewayUrl.match(/\/publishers\/[^/]+\/models\/([^/:]+)(?::[A-Za-z]+)?$/);
	if (publisherMatch?.[1]) {
		return decodeURIComponent(publisherMatch[1]);
	}

	return "";
}

function extractGatewayImageData(parsedChunk) {
	const delta = parsedChunk?.choices?.[0]?.delta;
	if (!delta) {
		return [];
	}

	const images = [];

	if (delta.audio?.data && typeof delta.audio.data === "string") {
		let mimeType = "image/png";
		if (delta.audio.data.startsWith("/9j/")) {
			mimeType = "image/jpeg";
		} else if (delta.audio.data.startsWith("R0lGOD")) {
			mimeType = "image/gif";
		} else if (delta.audio.data.startsWith("UklGR")) {
			mimeType = "image/webp";
		}
		images.push({ mimeType, base64Data: delta.audio.data });
	}

	const content = delta.content;
	if (Array.isArray(content)) {
		for (const part of content) {
			if (!part || typeof part !== "object") {
				continue;
			}

			if (part.type === "image_url" && part.image_url?.url) {
				const dataUrlMatch = part.image_url.url.match(/^data:(image\/[^;]+);base64,(.+)$/s);
				if (dataUrlMatch) {
					images.push({ mimeType: dataUrlMatch[1], base64Data: dataUrlMatch[2] });
				} else {
					images.push({ mimeType: "image/png", url: part.image_url.url });
				}
				continue;
			}

			if (part.inline_data?.data) {
				images.push({
					mimeType: part.inline_data.mime_type || "image/png",
					base64Data: part.inline_data.data,
				});
			}
		}
	}

	return images;
}

function extractGatewayTextDelta(parsedChunk) {
	const content = parsedChunk?.delta?.text ?? parsedChunk?.choices?.[0]?.delta?.content ?? null;
	if (Array.isArray(content)) {
		const textParts = content
			.filter((part) => part?.type === "text" && typeof part.text === "string")
			.map((part) => part.text)
			.join("");
		return textParts.length > 0 ? textParts : null;
	}
	return typeof content === "string" ? content : null;
}

async function streamBedrockGatewayManualSse({ gatewayUrl, envVars, system, prompt, messages, maxOutputTokens, onTextDelta, signal }) {
	const token = await getAuthToken();

	const resolvedMessages = [];
	if (Array.isArray(messages)) {
		resolvedMessages.push(...messages);
	}
	if (prompt) {
		resolvedMessages.push({
			role: "user",
			content: [{ type: "text", text: prompt }],
		});
	}

	const payload = {
		anthropic_version: "bedrock-2023-05-31",
		max_tokens: typeof maxOutputTokens === "number" ? maxOutputTokens : 2000,
		messages: resolvedMessages,
	};
	if (system) {
		// No cache_control yet. buildAIGatewaySystemPrompt returns a single
		// string whose tail carries the timestamp and runtimeContext, so a
		// breakpoint here would put volatile text inside the cached prefix and
		// miss on most turns. Caching needs stable and volatile emitted as
		// separate content blocks, which means threading the split through
		// gateway-stream -> ai-gateway-provider -> here. Tracked separately.
		payload.system = system;
	}

	debugLog("BEDROCK_SSE", `Streaming to: ${gatewayUrl}`);

	const requestInit = {
		method: "POST",
		headers: getGatewayHeaders(envVars, token, true),
		body: JSON.stringify(payload),
		signal,
	};
	const response = await fetchGatewayWithRateLimitRetry(() => fetch(gatewayUrl, requestInit));

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`AI Gateway Bedrock error ${response.status}: ${describeGatewayCloudIdError(errorText).slice(0, 400)}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("AI Gateway Bedrock response body is empty");
	}

	const decoder = new TextDecoder();
	let buffer = "";
	let fullText = "";
	const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

	const processLine = (line) => {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) {
			return;
		}

		const dataContent = trimmed.slice(5).trim();
		if (!dataContent || dataContent === "[DONE]") {
			return;
		}

		let parsed;
		try {
			parsed = JSON.parse(dataContent);
		} catch {
			return;
		}

		if (parsed.type === "message_start" && parsed.message?.usage) {
			const messageUsage = parsed.message.usage;
			usage.inputTokens = messageUsage.input_tokens ?? 0;
			usage.cacheReadTokens = messageUsage.cache_read_input_tokens ?? 0;
			usage.cacheWriteTokens = messageUsage.cache_creation_input_tokens ?? 0;
		}
		if (parsed.type === "message_delta" && parsed.usage?.output_tokens) {
			usage.outputTokens = parsed.usage.output_tokens;
		}

		if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
			const text = parsed.delta.text;
			if (text) {
				fullText += text;
				if (onTextDelta) {
					onTextDelta(text);
				}
			}
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		let newlineIndex = buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex);
			buffer = buffer.slice(newlineIndex + 1);
			processLine(line);
			newlineIndex = buffer.indexOf("\n");
		}
	}

	if (buffer.length > 0) {
		processLine(buffer);
	}

	debugLog(
		"BEDROCK_SSE",
		`Stream complete - ${fullText.length} chars, in=${usage.inputTokens} out=${usage.outputTokens} cacheRead=${usage.cacheReadTokens} cacheWrite=${usage.cacheWriteTokens}`,
	);
	return { text: fullText, usage };
}

async function streamGoogleGatewayManualSse({
	gatewayUrl,
	envVars,
	model,
	messages,
	system,
	prompt,
	maxOutputTokens,
	temperature,
	responseModalities,
	onTextDelta,
	onFile,
	signal,
}) {
	const token = await getAuthToken();

	const resolvedMessages = [];
	if (system) {
		resolvedMessages.push({ role: "system", content: system });
	}
	if (Array.isArray(messages)) {
		resolvedMessages.push(...messages);
	}
	if (prompt) {
		resolvedMessages.push({ role: "user", content: prompt });
	}

	const payload = {
		model,
		messages: resolvedMessages,
		stream: true,
	};
	if (typeof maxOutputTokens === "number") {
		payload.max_completion_tokens = maxOutputTokens;
	}
	if (typeof temperature === "number") {
		payload.temperature = temperature;
	}
	if (Array.isArray(responseModalities)) {
		const normalizedModalities = responseModalities
			.filter((value) => typeof value === "string")
			.map((value) => value.trim())
			.filter(Boolean);
		if (normalizedModalities.length > 0) {
			payload.modalities = normalizedModalities;
		}
	}

	const response = await fetchGatewayWithRateLimitRetry(() =>
		fetch(gatewayUrl, {
			method: "POST",
			headers: getGatewayHeaders(envVars, token, true),
			body: JSON.stringify(payload),
			signal,
		}),
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`AI Gateway Google error ${response.status}: ${describeGatewayCloudIdError(errorText).slice(0, 400)}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("AI Gateway Google response body is empty");
	}

	const decoder = new TextDecoder();
	let buffer = "";
	let fullText = "";
	let sseLineCount = 0;

	const processLine = async (line) => {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) {
			return;
		}

		sseLineCount += 1;
		const dataContent = trimmed.slice(5).trim();
		if (!dataContent || dataContent === "[DONE]") {
			return;
		}

		let parsed;
		try {
			parsed = JSON.parse(dataContent);
		} catch {
			debugLog("GOOGLE_SSE", `Line #${sseLineCount}: JSON parse failed for: ${dataContent.slice(0, 100)}`);
			return;
		}

		const textDelta = extractGatewayTextDelta(parsed);
		if (typeof textDelta === "string" && textDelta.length > 0) {
			fullText += textDelta;
			if (onTextDelta) {
				onTextDelta(textDelta);
			}
		}

		const images = extractGatewayImageData(parsed);
		for (const image of images) {
			if (onFile) {
				onFile({
					mediaType: image.mimeType,
					base64: image.base64Data,
				});
			}
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		let newlineIndex = buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex);
			buffer = buffer.slice(newlineIndex + 1);
			await processLine(line);
			newlineIndex = buffer.indexOf("\n");
		}
	}

	if (buffer.length > 0) {
		await processLine(buffer);
	}

	debugLog("GOOGLE_SSE", `Stream complete - ${sseLineCount} SSE lines, ${fullText.length} chars text`);
	return { text: fullText };
}

function getRealtimeConfig() {
	const apiKey = process.env.OPENAI_REALTIME_API_KEY || "";
	const defaultWsUrl = apiKey
		? "wss://api.openai.com/v1/realtime"
		: "wss://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/realtime";
	return {
		apiKey,
		model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
		wsUrl: process.env.OPENAI_REALTIME_WS_URL || defaultWsUrl,
		voice: process.env.OPENAI_REALTIME_VOICE || "alloy",
	};
}

module.exports = {
	getEnvVars,
	getAIGatewayConfigReport,
	hasGatewayUrlConfigured,
	isStagingAiGatewayUrl,
	isDummyGatewayCloudId,
	describeGatewayCloudIdKind,
	resolveGatewayCloudId,
	describeGatewayCloudIdError,
	getAuthToken,
	detectEndpointType,
	getGatewayHeaders,
	getModelId,
	resolveGatewayUrl,
	resolveBaseURL,
	extractGatewayImageData,
	extractGatewayTextDelta,
	streamBedrockGatewayManualSse,
	streamGoogleGatewayManualSse,
	getRealtimeConfig,
	fetchGatewayWithRateLimitRetry,
	parseRetryAfterMs,
};
