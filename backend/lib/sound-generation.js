const {
	getEnvVars,
	getAuthToken,
	detectEndpointType,
	getGatewayHeaders,
	resolveGatewayUrl,
} = require("./ai-gateway-helpers");
const { getNonEmptyString } = require("./shared-utils");
const { redactLogText } = require("./log-redaction");

const MAX_INPUT_LENGTH = 4096;

function createHttpError(status, message) {
	const error = new Error(message);
	error.statusCode = status;
	return error;
}

function buildSpeechEndpointUrl(gatewayUrl, endpointType) {
	if (typeof gatewayUrl !== "string" || !gatewayUrl.trim()) {
		return null;
	}

	try {
		const parsedUrl = new URL(gatewayUrl);
		const pathname = parsedUrl.pathname;

		if (endpointType === "google") {
			if (pathname.endsWith("/v1/google/v1/text:synthesize")) {
				return parsedUrl.toString();
			}

			if (/\/v1\/google\/publishers\/google\/v1\/chat\/completions$/.test(pathname)) {
				parsedUrl.pathname = pathname.replace(
					/\/v1\/google\/publishers\/google\/v1\/chat\/completions$/,
					"/v1/google/v1/text:synthesize"
				);
				return parsedUrl.toString();
			}

			if (/\/v1\/google\/v1\/chat\/completions$/.test(pathname)) {
				parsedUrl.pathname = pathname.replace(
					/\/v1\/google\/v1\/chat\/completions$/,
					"/v1/google/v1/text:synthesize"
				);
				return parsedUrl.toString();
			}

			if (pathname.endsWith("/chat/completions")) {
				parsedUrl.pathname = pathname.replace(/\/chat\/completions$/, "/text:synthesize");
				return parsedUrl.toString();
			}

			return null;
		}

		if (pathname.endsWith("/audio/speech")) {
			return parsedUrl.toString();
		}

		if (pathname.endsWith("/chat/completions")) {
			parsedUrl.pathname = pathname.replace(/\/chat\/completions$/, "/audio/speech");
			return parsedUrl.toString();
		}

		if (pathname.endsWith("/responses")) {
			parsedUrl.pathname = pathname.replace(/\/responses$/, "/audio/speech");
			return parsedUrl.toString();
		}

		if (pathname.endsWith("/v1/openai/v1")) {
			parsedUrl.pathname = `${pathname}/audio/speech`;
			return parsedUrl.toString();
		}

		return null;
	} catch {
		return null;
	}
}

function normalizeSpeed(rawSpeed) {
	if (typeof rawSpeed !== "number" || !Number.isFinite(rawSpeed)) {
		return 1;
	}

	return rawSpeed;
}

function parseGatewayErrorMessage(rawText) {
	const trimmedText = rawText.trim();
	if (!trimmedText) {
		return "Failed to generate audio";
	}

	try {
		const parsed = JSON.parse(trimmedText);
		return (
			getNonEmptyString(parsed?.error?.message) ||
			getNonEmptyString(parsed?.message) ||
			getNonEmptyString(parsed?.error) ||
			getNonEmptyString(parsed?.details) ||
			trimmedText
		);
	} catch {
		return trimmedText;
	}
}

async function synthesizeSound({
	input,
	voice,
	languageCode,
	speed,
	model,
	provider,
	responseFormat,
	signal,
} = {}) {
	const normalizedInput = getNonEmptyString(input);
	if (!normalizedInput) {
		throw createHttpError(400, "Input text is required");
	}

	if (normalizedInput.length > MAX_INPUT_LENGTH) {
		throw createHttpError(
			400,
			`Input text must be ${MAX_INPUT_LENGTH} characters or fewer`
		);
	}

	const normalizedVoice = getNonEmptyString(voice);
	const normalizedFormat = (getNonEmptyString(responseFormat) || "mp3").toLowerCase();
	const normalizedLanguageCode = getNonEmptyString(languageCode) || "en-US";
	const normalizedRequestedModel = getNonEmptyString(model);
	const normalizedRequestedProvider = getNonEmptyString(provider);

	const envVars = getEnvVars();
	const configuredModel = getNonEmptyString(envVars.GOOGLE_TTS_MODEL) || "tts-latest";

	if (normalizedRequestedModel && normalizedRequestedModel !== configuredModel) {
		throw createHttpError(
			400,
			`Sound generation only supports model: ${configuredModel} in this endpoint.`
		);
	}

	if (normalizedRequestedProvider && normalizedRequestedProvider !== "google") {
		throw createHttpError(
			400,
			"Sound generation only supports provider: google in this endpoint."
		);
	}

	const normalizedSpeed = normalizeSpeed(speed);
	if (normalizedSpeed < 0.25 || normalizedSpeed > 4) {
		throw createHttpError(400, "Speed must be between 0.25 and 4.0");
	}

	const audioEncodingByFormat = {
		mp3: "MP3",
		wav: "LINEAR16",
		pcm: "LINEAR16",
		ogg: "OGG_OPUS",
	};
	const contentTypeByEncoding = {
		MP3: "audio/mpeg",
		LINEAR16: "audio/wav",
		OGG_OPUS: "audio/ogg",
	};
	const resolvedAudioEncoding = audioEncodingByFormat[normalizedFormat] || "MP3";

	const rawGatewayUrl = envVars.AI_GATEWAY_URL_GOOGLE || envVars.AI_GATEWAY_URL;
	if (!rawGatewayUrl) {
		throw createHttpError(500, "Server configuration error");
	}

	const gatewayUrl = resolveGatewayUrl(rawGatewayUrl) || rawGatewayUrl;
	const endpointType = detectEndpointType(gatewayUrl);
	if (endpointType !== "google") {
		throw createHttpError(
			400,
			`Sound generation is configured to use Google TTS (${configuredModel}). Set AI_GATEWAY_URL_GOOGLE to a Google endpoint.`
		);
	}

	const speechEndpointUrl = buildSpeechEndpointUrl(gatewayUrl, endpointType);
	if (!speechEndpointUrl) {
		throw createHttpError(
			500,
			"Unable to derive speech endpoint URL from AI_GATEWAY_URL. Expected a path ending in /chat/completions or /responses."
		);
	}

	const token = await getAuthToken();
	const speechPayload = {
		input: {
			text: normalizedInput,
		},
		voice: {
			languageCode: normalizedLanguageCode,
			...(normalizedVoice ? { name: normalizedVoice } : {}),
		},
		audioConfig: {
			audioEncoding: resolvedAudioEncoding,
			speakingRate: normalizedSpeed,
		},
	};

	const gatewayResponse = await fetch(speechEndpointUrl, {
		method: "POST",
		headers: getGatewayHeaders(envVars, token),
		body: JSON.stringify(speechPayload),
		signal,
	});

	if (!gatewayResponse.ok) {
		const errorText = await gatewayResponse.text();
		throw createHttpError(
			gatewayResponse.status,
			redactLogText(parseGatewayErrorMessage(errorText))
		);
	}

	const responseContentType = gatewayResponse.headers.get("content-type") || "";
	let audioBytes;

	if (responseContentType.includes("application/json")) {
		const result = await gatewayResponse.json();
		const audioContent =
			getNonEmptyString(result?.audioContent) ||
			getNonEmptyString(result?.audio?.data) ||
			getNonEmptyString(result?.outputAudio?.audioContent);

		if (!audioContent) {
			throw createHttpError(
				502,
				"Google TTS response did not include audioContent"
			);
		}

		audioBytes = Buffer.from(audioContent, "base64");
	} else {
		audioBytes = Buffer.from(await gatewayResponse.arrayBuffer());
	}

	const contentType =
		contentTypeByEncoding[resolvedAudioEncoding] ||
		gatewayResponse.headers.get("content-type") ||
		"audio/mpeg";
	const extension = normalizedFormat.replace(/[^a-z0-9]/gi, "") || "mp3";

	return {
		audioBytes,
		contentType,
		extension,
		model: configuredModel,
		provider: "google",
		languageCode: normalizedLanguageCode,
		voice: normalizedVoice || null,
		speed: normalizedSpeed,
		responseFormat: normalizedFormat,
		speechEndpointUrl,
	};
}
module.exports = {
	buildSpeechEndpointUrl,
	synthesizeSound,
};
