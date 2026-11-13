const assert = require("node:assert/strict");
const test = require("node:test");

const {
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
	},
} = require("./speech-transcription");

test("buildGenerateContentUrl rewrites Google chat completions to generateContent", () => {
	const result = buildGenerateContentUrl(
		"https://example.test/v1/google/v1/chat/completions",
		"gemini-3-flash-preview",
	);

	assert.equal(
		result,
		"https://example.test/v1/google/v1/publishers/google/models/gemini-3-flash-preview:generateContent",
	);
});

test("STRICT_TRANSCRIPTION_PROMPT forbids answer-like rewrites", () => {
	assert.match(STRICT_TRANSCRIPTION_PROMPT, /verbatim/i);
	assert.match(STRICT_TRANSCRIPTION_PROMPT, /do not answer/i);
	assert.match(STRICT_TRANSCRIPTION_PROMPT, /Create me a page about Apple/);
});

test("resolveGoogleTranscriptionModel uses GOOGLE_STT_MODEL exactly as configured", () => {
	assert.equal(
		resolveGoogleTranscriptionModel("gemini-3-flash-preview"),
		"gemini-3-flash-preview",
	);
	assert.equal(
		resolveGoogleTranscriptionModel("gemini-2.5-flash"),
		"gemini-2.5-flash",
	);
});

test("resolveGoogleTranscriptionModel throws when GOOGLE_STT_MODEL is missing", () => {
	assert.throws(
		() => resolveGoogleTranscriptionModel(""),
		/error: GOOGLE_STT_MODEL must be set/i,
	);
});

test("resolveLocalWhisperModel uses LOCAL_WHISPER_MODEL exactly as configured", () => {
	assert.equal(resolveLocalWhisperModel("tiny"), "tiny");
	assert.equal(resolveLocalWhisperModel("large-v3"), "large-v3");
});

test("resolveLocalWhisperModel throws when LOCAL_WHISPER_MODEL is missing", () => {
	assert.throws(
		() => resolveLocalWhisperModel(""),
		/error: LOCAL_WHISPER_MODEL must be set/i,
	);
});

test("resolveOpenAiCompatibleTranscriptionModel uses OPENAI_COMPATIBLE_STT_MODEL exactly as configured", () => {
	assert.equal(resolveOpenAiCompatibleTranscriptionModel("qwen3-asr"), "qwen3-asr");
});

test("resolvePresetKey normalizes supported env preset names", () => {
	assert.equal(resolvePresetKey("whisper-tiny"), "whisper-tiny");
	assert.equal(resolvePresetKey("QWEN3-ASR"), "qwen3-asr");
	assert.equal(resolvePresetKey("unknown"), null);
});

test("readPresetConfig resolves provider and model from env-mapped preset keys", () => {
	const env = {
		STT_PRESET_WHISPER_TINY_PROVIDER: "local-whisper",
		STT_PRESET_WHISPER_TINY_MODEL: "tiny",
	};

	assert.deepEqual(readPresetConfig(env, "whisper-tiny"), {
		presetKey: "whisper-tiny",
		provider: "local-whisper",
		model: "tiny",
	});
	assert.equal(readPresetConfig(env, null), null);
});

test("resolveConfiguredTranscriptionProvider prefers explicit request provider, then env preset", () => {
	assert.equal(
		resolveConfiguredTranscriptionProvider(
			"google",
			{ GOOGLE_STT_MODEL: "" },
			{ STT_PRESET: "whisper-tiny" },
		),
		"google",
	);

	assert.equal(
		resolveConfiguredTranscriptionProvider(
			null,
			{ GOOGLE_STT_MODEL: "" },
			{
				STT_PRESET: "whisper-tiny",
				STT_PRESET_WHISPER_TINY_PROVIDER: "local-whisper",
			},
		),
		"local-whisper",
	);
});

test("resolveConfiguredTranscriptionProvider honours openai-compatible preset even without explicit base URL", () => {
	assert.equal(
		resolveConfiguredTranscriptionProvider(
			null,
			{ GOOGLE_STT_MODEL: "gemini-3-flash-preview" },
			{
				STT_PRESET: "qwen3-asr",
				STT_PRESET_QWEN3_ASR_PROVIDER: "openai-compatible",
				OPENAI_COMPATIBLE_STT_BASE_URL: "",
			},
		),
		"openai-compatible",
	);
});

test("resolveConfiguredTranscriptionModel uses the active env preset mapping", () => {
	assert.equal(
		resolveConfiguredTranscriptionModel({
			envVars: { GOOGLE_STT_MODEL: "gemini-3-flash-preview" },
			sttEnvVars: {
				STT_PRESET: "whisper-large-v3",
				STT_PRESET_WHISPER_LARGE_V3_PROVIDER: "local-whisper",
				STT_PRESET_WHISPER_LARGE_V3_MODEL: "large-v3",
			},
			provider: "local-whisper",
			rawModel: null,
		}),
		"large-v3",
	);
});

test("resolveConfiguredTranscriptionModel uses GOOGLE_STT_MODEL for the google preset", () => {
	assert.equal(
		resolveConfiguredTranscriptionModel({
			envVars: { GOOGLE_STT_MODEL: "gemini-3-flash-preview" },
			sttEnvVars: {
				STT_PRESET: "google",
				STT_PRESET_GOOGLE_PROVIDER: "google",
			},
			provider: "google",
			rawModel: null,
		}),
		"gemini-3-flash-preview",
	);
});

test("mimeTypeToFileExtension prefers a Whisper-compatible audio suffix", () => {
	assert.equal(mimeTypeToFileExtension("audio/wav"), "wav");
	assert.equal(mimeTypeToFileExtension("audio/webm;codecs=opus"), "webm");
	assert.equal(mimeTypeToFileExtension("audio/m4a"), "m4a");
});

test("buildLocalWhisperArgs pins deterministic transcription settings", () => {
	assert.deepEqual(
		buildLocalWhisperArgs({
			inputPath: "/tmp/input.wav",
			outputDir: "/tmp/whisper",
			model: "tiny",
			language: "en",
		}),
		[
			"/tmp/input.wav",
			"--model",
			"tiny",
			"--output_format",
			"json",
			"--output_dir",
			"/tmp/whisper",
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
			"--language",
			"en",
		],
	);
});

test("buildOpenAiCompatibleTranscriptionUrl appends the transcription endpoint to a base URL", () => {
	assert.equal(
		buildOpenAiCompatibleTranscriptionUrl("http://localhost:8001/v1"),
		"http://localhost:8001/v1/audio/transcriptions",
	);
	assert.equal(
		buildOpenAiCompatibleTranscriptionUrl("http://localhost:8001"),
		"http://localhost:8001/v1/audio/transcriptions",
	);
});

test("hasConfiguredOpenAiCompatibleBaseUrl requires an explicit base URL", () => {
	assert.equal(
		hasConfiguredOpenAiCompatibleBaseUrl({
			OPENAI_COMPATIBLE_STT_BASE_URL: "http://localhost:8001/v1",
		}),
		true,
	);
	assert.equal(
		hasConfiguredOpenAiCompatibleBaseUrl({
			OPENAI_COMPATIBLE_STT_BASE_URL: "",
		}),
		false,
	);
});

test("getTranscriptionErrorDetails includes fetch causes for diagnostics", () => {
	const error = new TypeError("fetch failed");
	error.cause = Object.assign(
		new Error("connect ECONNREFUSED 127.0.0.1:8801"),
		{ code: "ECONNREFUSED" },
	);

	assert.match(getTranscriptionErrorDetails(error), /ECONNREFUSED/);
});

test("shouldFallbackOpenAiCompatibleToGoogle falls back for the implicit local STT server", () => {
	const error = new TypeError("fetch failed");
	error.cause = Object.assign(
		new Error("connect ECONNREFUSED 127.0.0.1:8801"),
		{ code: "ECONNREFUSED" },
	);

	assert.equal(
		shouldFallbackOpenAiCompatibleToGoogle({
			error,
			envVars: { GOOGLE_STT_MODEL: "gemini-3-flash-preview" },
			rawBaseUrl: "",
		}),
		true,
	);
});

test("shouldFallbackOpenAiCompatibleToGoogle does not override an explicit STT endpoint", () => {
	const error = new TypeError("fetch failed");
	error.cause = Object.assign(
		new Error("connect ECONNREFUSED 127.0.0.1:8801"),
		{ code: "ECONNREFUSED" },
	);

	assert.equal(
		shouldFallbackOpenAiCompatibleToGoogle({
			error,
			envVars: { GOOGLE_STT_MODEL: "gemini-3-flash-preview" },
			rawBaseUrl: "http://localhost:9901/v1",
		}),
		false,
	);
});

test("shouldFallbackOpenAiCompatibleToGoogle does not mask client errors", () => {
	const error = new Error("Unsupported audio format");
	error.statusCode = 400;

	assert.equal(
		shouldFallbackOpenAiCompatibleToGoogle({
			error,
			envVars: { GOOGLE_STT_MODEL: "gemini-3-flash-preview" },
			rawBaseUrl: "",
		}),
		false,
	);
});

test("preset env map exposes the documented easy-switch presets", () => {
	assert.deepEqual(Object.keys(STT_PRESET_ENV_MAP).sort(), [
		"google",
		"qwen3-0.6b",
		"qwen3-asr",
		"whisper-large-v3",
		"whisper-tiny",
	]);
});

test("a client may choose a transcription provider or model only among those the server is configured for", () => {
	const { decideClientTranscriptionChoice } = require("./speech-transcription").__test__;
	const sttEnvVars = {
		STT_PRESET: "whisper-tiny",
		STT_PRESET_WHISPER_TINY_PROVIDER: "local-whisper",
		STT_PRESET_WHISPER_TINY_MODEL: "tiny",
		STT_PRESET_GOOGLE_PROVIDER: "google",
	};
	const envVars = { GOOGLE_STT_MODEL: "gemini-2.5-flash" };
	const decide = (rawProvider, rawModel, overrides = {}) =>
		decideClientTranscriptionChoice({ envVars: overrides.envVars ?? envVars, rawModel, rawProvider, sttEnvVars: overrides.sttEnvVars ?? sttEnvVars }).action;
	const cases = [
		["nothing chosen: the preset decides", undefined, undefined, "allow"],
		["a configured provider", "google", undefined, "allow"],
		["a configured provider and model", "local-whisper", "tiny", "allow"],
		["a configured model alone", undefined, "gemini-2.5-flash", "allow"],
		["an unconfigured provider", "openai-compatible", undefined, "reject"],
		["a model the server never chose", "local-whisper", "large-v3", "reject"],
		["a configured model under the wrong provider", "google", "tiny", "reject"],
		["an unknown model alone", undefined, "some-model", "reject"],
	];
	for (const [name, provider, model, expected] of cases) {
		assert.equal(decide(provider, model), expected, name);
	}
	// local-whisper cannot be chosen when nothing configures it.
	assert.equal(decide("local-whisper", undefined, { sttEnvVars: {}, envVars }), "reject");
});
