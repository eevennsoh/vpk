// @ts-check
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { getNonEmptyString } = require("./shared-utils");

const {
	getEnvVars,
	getAuthToken,
	getGatewayHeaders,
	resolveGatewayUrl,
} = require("./ai-gateway-helpers");

const GOOGLE_TRANSCRIPTION_TIMEOUT_MS = 15_000;
const LOCAL_WHISPER_TRANSCRIPTION_TIMEOUT_MS = 60_000;
const OPENAI_COMPATIBLE_TRANSCRIPTION_TIMEOUT_MS = 60_000;
const LOCAL_WHISPER_PROVIDER = "local-whisper";
const OPENAI_COMPATIBLE_PROVIDER = "openai-compatible";
const DEFAULT_LOCAL_WHISPER_BIN = "whisper";
const DEFAULT_OPENAI_COMPATIBLE_STT_BASE_URL = "http://localhost:8801/v1";

const STT_PRESET_ENV_MAP = Object.freeze({
	"whisper-tiny": Object.freeze({
		providerEnv: "STT_PRESET_WHISPER_TINY_PROVIDER",
		modelEnv: "STT_PRESET_WHISPER_TINY_MODEL",
	}),
	"whisper-large-v3": Object.freeze({
		providerEnv: "STT_PRESET_WHISPER_LARGE_V3_PROVIDER",
		modelEnv: "STT_PRESET_WHISPER_LARGE_V3_MODEL",
	}),
	google: Object.freeze({
		providerEnv: "STT_PRESET_GOOGLE_PROVIDER",
	}),
	"qwen3-0.6b": Object.freeze({
		providerEnv: "STT_PRESET_QWEN3_0_6B_PROVIDER",
		modelEnv: "STT_PRESET_QWEN3_0_6B_MODEL",
	}),
	"qwen3-asr": Object.freeze({
		providerEnv: "STT_PRESET_QWEN3_ASR_PROVIDER",
		modelEnv: "STT_PRESET_QWEN3_ASR_MODEL",
	}),
});

const STRICT_TRANSCRIPTION_PROMPT = [
	"Transcribe this audio verbatim.",
	"Return only the spoken text, nothing else.",
	"Do not answer the user, do not paraphrase, and do not replace a request with background knowledge.",
	'If the speaker says "Create me a page about Apple", return exactly "Create me a page about Apple".',
	"If the audio is empty or contains no speech, return an empty string.",
].join(" ");

function createHttpError(status, message) {
	const error = /** @type {Error & { statusCode?: number }} */ (new Error(message));
	error.statusCode = status;
	return error;
}

function createAbortError(message = "Speech transcription aborted") {
	const error = /** @type {Error & { code?: string }} */ (new Error(message));
	error.name = "AbortError";
	error.code = "ABORT_ERR";
	return error;
}

function getSpeechTranscriptionEnvVars() {
	return {
		STT_PRESET: process.env.STT_PRESET,
		LOCAL_WHISPER_BIN: process.env.LOCAL_WHISPER_BIN,
		LOCAL_WHISPER_MODEL: process.env.LOCAL_WHISPER_MODEL,
		OPENAI_COMPATIBLE_STT_BASE_URL: process.env.OPENAI_COMPATIBLE_STT_BASE_URL,
		OPENAI_COMPATIBLE_STT_API_KEY: process.env.OPENAI_COMPATIBLE_STT_API_KEY,
		OPENAI_COMPATIBLE_STT_MODEL: process.env.OPENAI_COMPATIBLE_STT_MODEL,
		...Object.fromEntries(
			Object.values(/** @type {Record<string, { providerEnv: string, modelEnv?: string }>} */ (STT_PRESET_ENV_MAP)).flatMap(({ providerEnv, modelEnv }) => {
				return [
					[providerEnv, process.env[providerEnv]],
					...(typeof modelEnv === "string"
						? [[modelEnv, process.env[modelEnv]]]
						: []),
				];
			}),
		),
	};
}

function resolvePresetKey(rawPreset) {
	const normalizedPreset = getNonEmptyString(rawPreset)?.toLowerCase();
	if (!normalizedPreset) {
		return null;
	}

	return normalizedPreset in STT_PRESET_ENV_MAP ? normalizedPreset : null;
}

function readPresetConfig(sttEnvVars, presetKey) {
	if (!presetKey) {
		return null;
	}

	const presetEnv = STT_PRESET_ENV_MAP[presetKey];
	if (!presetEnv) {
		return null;
	}

	return {
		presetKey,
		provider: getNonEmptyString(sttEnvVars[presetEnv.providerEnv]),
		model:
			typeof presetEnv.modelEnv === "string"
				? getNonEmptyString(sttEnvVars[presetEnv.modelEnv])
				: null,
	};
}

function resolveGoogleTranscriptionModel(rawModel) {
	if (typeof rawModel !== "string" || !rawModel.trim()) {
		throw createHttpError(
			500,
			"Server configuration error: GOOGLE_STT_MODEL must be set in .env.local",
		);
	}

	return rawModel.trim();
}

function resolveLocalWhisperModel(rawModel) {
	if (typeof rawModel !== "string" || !rawModel.trim()) {
		throw createHttpError(
			500,
			"Server configuration error: LOCAL_WHISPER_MODEL must be set in .env.local",
		);
	}

	return rawModel.trim();
}

function resolveOpenAiCompatibleTranscriptionModel(rawModel) {
	if (typeof rawModel !== "string" || !rawModel.trim()) {
		throw createHttpError(
			500,
			"Server configuration error: OPENAI_COMPATIBLE_STT_MODEL must be set in .env.local",
		);
	}

	return rawModel.trim();
}

function hasConfiguredOpenAiCompatibleBaseUrl(sttEnvVars) {
	return Boolean(getNonEmptyString(sttEnvVars.OPENAI_COMPATIBLE_STT_BASE_URL));
}

function getTranscriptionErrorDetails(error) {
	if (!(error instanceof Error)) {
		return "";
	}

	const cause = /** @type {{ message?: unknown, code?: unknown } | undefined} */ (error.cause);
	const parts = [
		error.message,
		typeof cause?.message === "string" ? cause.message : "",
		typeof cause?.code === "string" ? cause.code : "",
	];

	return parts.filter((part) => typeof part === "string" && part.trim()).join(" ");
}

function shouldFallbackOpenAiCompatibleToGoogle({
	error,
	envVars,
	rawBaseUrl,
}) {
	if (error instanceof Error && error.name === "AbortError") {
		return false;
	}

	if (getNonEmptyString(rawBaseUrl)) {
		return false;
	}

	if (!getNonEmptyString(envVars.GOOGLE_STT_MODEL)) {
		return false;
	}

	const statusCode =
		typeof error?.statusCode === "number" ? error.statusCode : null;
	if (statusCode !== null) {
		return statusCode >= 500;
	}

	return /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|UND_ERR/i.test(
		getTranscriptionErrorDetails(error),
	);
}

function resolveConfiguredTranscriptionProvider(rawProvider, envVars, sttEnvVars) {
	const explicitProvider = getNonEmptyString(rawProvider);
	if (explicitProvider) {
		return explicitProvider;
	}

	const presetConfig = readPresetConfig(
		sttEnvVars,
		resolvePresetKey(sttEnvVars.STT_PRESET),
	);
	if (presetConfig?.provider) {
		return presetConfig.provider;
	}

	if (getNonEmptyString(envVars.GOOGLE_STT_MODEL)) {
		return "google";
	}

	throw createHttpError(
		500,
		"Server configuration error: STT_PRESET (or explicit transcription provider) must be set in .env.local",
	);
}

function resolveConfiguredTranscriptionModel({
	envVars,
	sttEnvVars,
	provider,
	rawModel,
}) {
	const explicitModel = getNonEmptyString(rawModel);
	if (explicitModel) {
		return explicitModel;
	}

	const presetConfig = readPresetConfig(
		sttEnvVars,
		resolvePresetKey(sttEnvVars.STT_PRESET),
	);
	// provider is always a string here, so a missing preset never matches.
	if (presetConfig !== null && presetConfig.provider === provider && presetConfig.model) {
		return presetConfig.model;
	}

	if (provider === "google") {
		return resolveGoogleTranscriptionModel(envVars.GOOGLE_STT_MODEL);
	}

	if (provider === LOCAL_WHISPER_PROVIDER) {
		return resolveLocalWhisperModel(sttEnvVars.LOCAL_WHISPER_MODEL);
	}

	if (provider === OPENAI_COMPATIBLE_PROVIDER) {
		return resolveOpenAiCompatibleTranscriptionModel(
			sttEnvVars.OPENAI_COMPATIBLE_STT_MODEL,
		);
	}

	throw createHttpError(
		400,
		`Unsupported transcription provider: ${provider}`,
	);
}

function resolveLocalWhisperBin(rawBin) {
	return getNonEmptyString(rawBin) || DEFAULT_LOCAL_WHISPER_BIN;
}

function mimeTypeToFileExtension(rawMimeType) {
	const normalizedMimeType = (rawMimeType || "audio/webm")
		.trim()
		.toLowerCase()
		.split(";")[0]
		.trim();

	switch (normalizedMimeType) {
		case "audio/wav":
		case "audio/x-wav":
			return "wav";
		case "audio/mp4":
		case "audio/m4a":
			return "m4a";
		case "audio/mpeg":
			return "mp3";
		case "audio/aiff":
		case "audio/x-aiff":
			return "aiff";
		default:
			return "webm";
	}
}

function buildLocalWhisperArgs({ inputPath, outputDir, model, language }) {
	const args = [
		inputPath,
		"--model",
		model,
		"--output_format",
		"json",
		"--output_dir",
		outputDir,
		"--task",
		"transcribe",
		"--verbose",
		"False",
		"--condition_on_previous_text",
		"False",
		"--temperature",
		"0",
		"--fp16",
		"False",
	];

	if (getNonEmptyString(language)) {
		args.push("--language", language.trim());
	}

	return args;
}

function buildOpenAiCompatibleTranscriptionUrl(baseUrl) {
	const normalizedBaseUrl =
		getNonEmptyString(baseUrl) || DEFAULT_OPENAI_COMPATIBLE_STT_BASE_URL;
	if (!normalizedBaseUrl) {
		return null;
	}

	try {
		const parsedUrl = new URL(normalizedBaseUrl);
		if (parsedUrl.pathname.endsWith("/audio/transcriptions")) {
			return parsedUrl.toString();
		}
		if (parsedUrl.pathname.endsWith("/v1")) {
			parsedUrl.pathname = `${parsedUrl.pathname}/audio/transcriptions`;
			return parsedUrl.toString();
		}

		parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/u, "")}/v1/audio/transcriptions`;
		return parsedUrl.toString();
	} catch {
		return null;
	}
}

function appendLogChunk(currentValue, chunk, maxLength = 4096) {
	const nextValue = `${currentValue}${chunk.toString("utf8")}`;
	return nextValue.length > maxLength ? nextValue.slice(-maxLength) : nextValue;
}

/**
 * Build the Gemini native generateContent endpoint URL from the gateway URL.
 */
function buildGenerateContentUrl(gatewayUrl, model) {
	if (typeof gatewayUrl !== "string" || !gatewayUrl.trim()) {
		return null;
	}

	try {
		const parsedUrl = new URL(gatewayUrl);
		const pathname = parsedUrl.pathname;

		const publisherPattern = /\/v1\/google\/publishers\/google\/v1\/chat\/completions$/;
		if (publisherPattern.test(pathname)) {
			parsedUrl.pathname = pathname.replace(
				publisherPattern,
				`/v1/google/v1/publishers/google/models/${model}:generateContent`,
			);
			return parsedUrl.toString();
		}

		const simplePattern = /\/v1\/google\/v1\/chat\/completions$/;
		if (simplePattern.test(pathname)) {
			parsedUrl.pathname = pathname.replace(
				simplePattern,
				`/v1/google/v1/publishers/google/models/${model}:generateContent`,
			);
			return parsedUrl.toString();
		}

		if (pathname.endsWith("/chat/completions")) {
			parsedUrl.pathname = pathname.replace(
				/\/chat\/completions$/,
				`/publishers/google/models/${model}:generateContent`,
			);
			return parsedUrl.toString();
		}

		return null;
	} catch {
		return null;
	}
}

function combineAbortSignals(signal, timeoutMs) {
	const controller = new AbortController();
	/** @type {ReturnType<typeof setTimeout> | null} */
	let timeoutHandle = null;

	const abortWithReason = (reason) => {
		if (!controller.signal.aborted) {
			controller.abort(reason);
		}
	};

	if (typeof timeoutMs === "number" && timeoutMs > 0) {
		timeoutHandle = setTimeout(() => {
			abortWithReason(createAbortError("Speech transcription timed out"));
		}, timeoutMs);
	}

	if (signal) {
		if (signal.aborted) {
			abortWithReason(signal.reason || createAbortError());
		} else {
			signal.addEventListener(
				"abort",
				() => {
					abortWithReason(signal.reason || createAbortError());
				},
				{ once: true },
			);
		}
	}

	return {
		signal: controller.signal,
		cleanup() {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		},
	};
}

async function runLocalWhisper({ args, signal, whisperBin }) {
	await new Promise(/** @param {(value?: unknown) => void} resolve */ (resolve, reject) => {
		let stderr = "";
		let settled = false;
		const child = spawn(whisperBin, args, {
			stdio: ["ignore", "ignore", "pipe"],
		});

		const cleanup = () => {
			if (signal) {
				signal.removeEventListener("abort", handleAbort);
			}
		};

		const rejectOnce = (error) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(error);
		};

		const resolveOnce = () => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve();
		};

		const handleAbort = () => {
			child.kill("SIGTERM");
		};

		if (signal) {
			if (signal.aborted) {
				child.kill("SIGTERM");
				rejectOnce(
					signal.reason instanceof Error
						? signal.reason
						: createAbortError(),
				);
				return;
			}

			signal.addEventListener("abort", handleAbort, { once: true });
		}

		child.stderr.on("data", (chunk) => {
			stderr = appendLogChunk(stderr, chunk);
		});

		child.on("error", (/** @type {NodeJS.ErrnoException} */ error) => {
			if (error?.code === "ENOENT") {
				rejectOnce(
					createHttpError(
						500,
						`Local Whisper CLI "${whisperBin}" was not found on PATH`,
					),
				);
				return;
			}

			rejectOnce(error);
		});

		child.on("close", (code) => {
			if (signal?.aborted) {
				rejectOnce(
					signal.reason instanceof Error
						? signal.reason
						: createAbortError(),
				);
				return;
			}

			if (code !== 0) {
				const stderrMessage = getNonEmptyString(stderr?.replace(/\s+/gu, " "));
				rejectOnce(
					createHttpError(
						500,
						stderrMessage
							? `Local Whisper transcription failed: ${stderrMessage}`
							: "Local Whisper transcription failed",
					),
				);
				return;
			}

			resolveOnce();
		});
	});
}

async function transcribeViaLocalWhisper({
	audio,
	mimeType,
	model,
	language,
	signal,
	whisperBin,
}) {
	const normalizedMimeType = (mimeType || "audio/webm").trim();
	const normalizedLanguage = getNonEmptyString(language);
	const tempDir = await fs.mkdtemp(
		path.join(os.tmpdir(), "speech-transcription-"),
	);
	const inputPath = path.join(
		tempDir,
		`input.${mimeTypeToFileExtension(normalizedMimeType)}`,
	);
	const outputPath = path.join(tempDir, "input.json");

	const { signal: requestSignal, cleanup } = combineAbortSignals(
		signal,
		LOCAL_WHISPER_TRANSCRIPTION_TIMEOUT_MS,
	);

	try {
		await fs.writeFile(inputPath, Buffer.from(audio, "base64"));

		console.info("[SPEECH-TRANSCRIPTION] Running local Whisper", {
			language: normalizedLanguage,
			mimeType: normalizedMimeType,
			model,
			whisperBin,
		});

		await runLocalWhisper({
			args: buildLocalWhisperArgs({
				inputPath,
				outputDir: tempDir,
				model,
				language: normalizedLanguage,
			}),
			signal: requestSignal,
			whisperBin,
		});

		const result = JSON.parse(await fs.readFile(outputPath, "utf8"));
		return getNonEmptyString(result?.text) || "";
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw error;
		}

		if (requestSignal.aborted) {
			throw requestSignal.reason instanceof Error
				? requestSignal.reason
				: createAbortError();
		}

		throw error;
	} finally {
		cleanup();
		await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
	}
}

async function transcribeViaOpenAiCompatible({
	audio,
	mimeType,
	model,
	language,
	signal,
	baseUrl,
	apiKey,
}) {
	const normalizedMimeType = (mimeType || "audio/webm").trim();
		const transcriptionUrl = buildOpenAiCompatibleTranscriptionUrl(baseUrl);
		if (!transcriptionUrl) {
			throw createHttpError(
				500,
				"Server configuration error: no OpenAI-compatible STT base URL is available",
			);
		}

	const fileName = `input.${mimeTypeToFileExtension(normalizedMimeType)}`;
	const audioBuffer = Buffer.from(audio, "base64");
	const { signal: requestSignal, cleanup } = combineAbortSignals(
		signal,
		OPENAI_COMPATIBLE_TRANSCRIPTION_TIMEOUT_MS,
	);

	try {
		const formData = new FormData();
		formData.append(
			"file",
			new Blob([audioBuffer], { type: normalizedMimeType }),
			fileName,
		);
		formData.append("model", model);
		if (getNonEmptyString(language)) {
			formData.append("language", language.trim());
		}

		const headers = {};
		if (getNonEmptyString(apiKey)) {
			headers.Authorization = `Bearer ${apiKey.trim()}`;
		}

		console.info("[SPEECH-TRANSCRIPTION] Sending to OpenAI-compatible STT endpoint", {
			language: getNonEmptyString(language),
			model,
			transcriptionUrl,
		});

		const response = await fetch(transcriptionUrl, {
			method: "POST",
			headers,
			body: formData,
			signal: requestSignal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw createHttpError(
				response.status,
				getNonEmptyString(errorText) ||
					`OpenAI-compatible transcription failed: ${response.status}`,
			);
		}

		const result = /** @type {{ text?: unknown } | null} */ (await response.json());
		return getNonEmptyString(result?.text) || "";
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw error;
		}

		if (requestSignal.aborted) {
			throw requestSignal.reason instanceof Error
				? requestSignal.reason
				: createAbortError();
		}

		throw error;
	} finally {
		cleanup();
	}
}

async function transcribeViaGoogleGenerateContent({ audio, mimeType, model, signal }) {
	const normalizedMimeType = (mimeType || "audio/webm").trim();
	const envVars = getEnvVars();

	const rawGatewayUrl = envVars.AI_GATEWAY_URL_GOOGLE || envVars.AI_GATEWAY_URL;
	if (!rawGatewayUrl) {
		throw createHttpError(500, "Server configuration error: no AI gateway URL configured");
	}

	const gatewayUrl = resolveGatewayUrl(rawGatewayUrl) || rawGatewayUrl;
	const generateContentUrl = buildGenerateContentUrl(gatewayUrl, model);
	if (!generateContentUrl) {
		throw createHttpError(
			500,
			"Unable to derive generateContent endpoint from AI_GATEWAY_URL",
		);
	}

	const token = await getAuthToken();

	const payload = {
		contents: [
			{
				role: "user",
				parts: [
					{
						inlineData: {
							mimeType: normalizedMimeType,
							data: audio,
						},
					},
					{
						text: STRICT_TRANSCRIPTION_PROMPT,
					},
				],
			},
		],
		generationConfig: {
			temperature: 0,
			topP: 0,
			topK: 1,
		},
	};

	console.info(`[SPEECH-TRANSCRIPTION] Sending to ${model} via:`, generateContentUrl);

	const { signal: requestSignal, cleanup } = combineAbortSignals(
		signal,
		GOOGLE_TRANSCRIPTION_TIMEOUT_MS,
	);

	try {
		const response = await fetch(generateContentUrl, {
			method: "POST",
			headers: getGatewayHeaders(envVars, token),
			body: JSON.stringify(payload),
			signal: requestSignal,
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("[SPEECH-TRANSCRIPTION] Gateway error:", response.status, errorText);
			throw createHttpError(
				response.status,
				`Transcription failed: ${response.status}`,
			);
		}

		const result = /** @type {{ candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> } | null} */ (await response.json());
		return (
			result?.candidates?.[0]?.content?.parts
				?.filter((part) => typeof part.text === "string")
				?.map((part) => part.text)
				?.join("")
				?.trim() ?? ""
		);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw error;
		}

		if (requestSignal.aborted) {
			throw requestSignal.reason instanceof Error
				? requestSignal.reason
				: createAbortError();
		}

		throw error;
	} finally {
		cleanup();
	}
}

/**
 * Transcribe audio using the requested speech-to-text provider.
 *
 * @param {object} [options]
 * @param {string} [options.audio] - Base64-encoded audio data (required)
 * @param {string} [options.language] - Optional BCP-47 / Whisper language code
 * @param {string} [options.mimeType] - MIME type of the audio (default: "audio/webm")
 * @param {string} [options.model] - Optional provider-specific model identifier
 * @param {string} [options.provider] - Optional provider override
 * @param {AbortSignal} [options.signal] - Optional abort signal
 * @returns {Promise<string>} The transcribed text
 */
async function transcribeAudio({
	audio,
	language,
	mimeType,
	model: rawModel,
	provider: rawProvider,
	signal,
} = {}) {
	if (!audio || typeof audio !== "string") {
		throw createHttpError(400, "Base64 audio data is required");
	}

	const envVars = getEnvVars();
	const sttEnvVars = getSpeechTranscriptionEnvVars();
	const provider = resolveConfiguredTranscriptionProvider(
		rawProvider,
		envVars,
		sttEnvVars,
	);
	const model = resolveConfiguredTranscriptionModel({
		envVars,
		sttEnvVars,
		provider,
		rawModel,
	});

	if (provider === LOCAL_WHISPER_PROVIDER) {
		return transcribeViaLocalWhisper({
			audio,
			mimeType,
			model,
			language,
			signal,
			whisperBin: resolveLocalWhisperBin(sttEnvVars.LOCAL_WHISPER_BIN),
		});
	}

	if (provider === OPENAI_COMPATIBLE_PROVIDER) {
		try {
			return await transcribeViaOpenAiCompatible({
				audio,
				mimeType,
				model,
				language,
				signal,
				baseUrl: sttEnvVars.OPENAI_COMPATIBLE_STT_BASE_URL,
				apiKey: sttEnvVars.OPENAI_COMPATIBLE_STT_API_KEY,
			});
		} catch (error) {
			if (
				!shouldFallbackOpenAiCompatibleToGoogle({
					error,
					envVars,
					rawBaseUrl: sttEnvVars.OPENAI_COMPATIBLE_STT_BASE_URL,
				})
			) {
				throw error;
			}

			const googleModel = resolveGoogleTranscriptionModel(envVars.GOOGLE_STT_MODEL);
			console.warn(
				"[SPEECH-TRANSCRIPTION] OpenAI-compatible STT failed; falling back to Google STT",
				{
					error:
						error instanceof Error ? error.message : String(error ?? "Unknown error"),
					fallbackModel: googleModel,
					transcriptionUrl: buildOpenAiCompatibleTranscriptionUrl(
						sttEnvVars.OPENAI_COMPATIBLE_STT_BASE_URL,
					),
				},
			);

			return transcribeViaGoogleGenerateContent({
				audio,
				mimeType,
				model: googleModel,
				signal,
			});
		}
	}

	if (provider === "google") {
		return transcribeViaGoogleGenerateContent({
			audio,
			mimeType,
			model,
			signal,
		});
	}

	throw createHttpError(
		400,
		`Unsupported transcription provider: ${provider}`,
	);
}

module.exports = {
	transcribeAudio,
	__test__: {
		buildGenerateContentUrl,
		buildLocalWhisperArgs,
		buildOpenAiCompatibleTranscriptionUrl,
		getTranscriptionErrorDetails,
		mimeTypeToFileExtension,
		readPresetConfig,
		resolveConfiguredTranscriptionModel,
		resolveConfiguredTranscriptionProvider,
		resolveGoogleTranscriptionModel,
		hasConfiguredOpenAiCompatibleBaseUrl,
		resolveLocalWhisperModel,
		resolveOpenAiCompatibleTranscriptionModel,
		resolvePresetKey,
		shouldFallbackOpenAiCompatibleToGoogle,
		STT_PRESET_ENV_MAP,
		STRICT_TRANSCRIPTION_PROMPT,
		LOCAL_WHISPER_PROVIDER,
		OPENAI_COMPATIBLE_PROVIDER,
	},
};
