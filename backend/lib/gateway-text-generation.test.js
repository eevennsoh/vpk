const assert = require("node:assert/strict");
const test = require("node:test");

const {
	GENUI_META_PREFIX,
	buildRovoTextGenerationMessage,
	createGatewayTextGenerationService,
	parseGenuiMetaAndBody,
	stripSpecBlocks,
} = require("./gateway-text-generation");

function createHarness(overrides = {}) {
	const calls = [];
	const aiGatewayProvider = {
		generateText: async (options) => {
			calls.push(["aiGateway.generateText", options]);
			return overrides.aiGatewayText ?? "ai gateway text";
		},
		streamText: async (options) => {
			calls.push(["aiGateway.streamText", options]);
			if (typeof options.onTextDelta === "function") {
				options.onTextDelta("ai ");
				options.onTextDelta("delta");
			}
			return overrides.aiGatewayStreamText ?? "ai gateway stream";
		},
	};
	const service = createGatewayTextGenerationService({
		aiGatewayProvider,
		analyzeGeneratedText: (text) => {
			calls.push(["analyzeGeneratedText", text]);
			return overrides.analysis ?? { analyzed: true };
		},
		assessToolFirstGenuiQuality: (input) => {
			calls.push(["assessToolFirstGenuiQuality", input]);
			return overrides.qualityAssessment ?? {
				quality: "high",
				synthesizedChildCount: 1,
				missingChildKeyCount: 0,
				usedSynthesizedSpec: false,
				hasRecoveredPlaceholderSection: false,
				reasons: ["ok"],
			};
		},
		compressConversation: (messages, options) => {
			calls.push(["compressConversation", messages, options]);
			return overrides.compressionResult ?? {
				messages: [
					{ role: "system", content: " Summary " },
					{ role: "assistant", content: " Kept " },
				],
				compressed: true,
				length: 2,
			};
		},
		createRovoUnavailableError: () => {
			const error = new Error("Rovo unavailable");
			error.code = "ROVO_UNAVAILABLE";
			return error;
		},
		debugLog: (section, message) => {
			calls.push(["debugLog", section, message]);
		},
		generateTextViaRovo: async (options) => {
			calls.push(["generateTextViaRovo", options]);
			return overrides.rovoText ?? "rovo text";
		},
		getGenuiSystemPrompt: (options) => {
			calls.push(["getGenuiSystemPrompt", options]);
			return "genui system prompt";
		},
		normalizeAIGatewayError: (error) => {
			calls.push(["normalizeAIGatewayError", error.message]);
			error.backendSelected = "ai-gateway";
			return error;
		},
		pickBestSpec: (analysis) => {
			calls.push(["pickBestSpec", analysis]);
			return overrides.bestSpec ?? { root: "root", elements: {} };
		},
		resolvePreferredBackend: async ({ backendPreference }) => {
			calls.push(["resolvePreferredBackend", backendPreference]);
			return { backend: overrides.backend ?? backendPreference };
		},
		streamViaRovo: async (options) => {
			calls.push(["streamViaRovo", options]);
			options.onTextDelta(" rovo");
			options.onTextDelta(" text ");
		},
		waitForTurnTimeoutMs: 123,
	});

	return {
		calls,
		service,
	};
}

test("buildRovoTextGenerationMessage preserves system and prompt wrapping", () => {
	assert.equal(
		buildRovoTextGenerationMessage({
			system: "System",
			prompt: "Prompt",
		}),
		"[System Instructions]\nSystem\n[End System Instructions]\n\nPrompt",
	);
	assert.equal(buildRovoTextGenerationMessage({ prompt: "Prompt only" }), "Prompt only");
});

test("generateTextViaGateway routes Rovo selections through Rovo Serve", async () => {
	const { calls, service } = createHarness({ backend: "rovo" });
	const signal = AbortSignal.timeout(1000);

	const text = await service.generateTextViaGateway({
		system: "System",
		prompt: "Prompt",
		signal,
	});

	assert.equal(text, "rovo text");
	const rovoCall = calls.find((call) => call[0] === "generateTextViaRovo")[1];
	assert.deepEqual(rovoCall, {
		system: "System",
		prompt: "Prompt",
		conflictPolicy: "wait-for-turn",
		timeoutMs: 123,
		signal,
	});
	assert.equal(calls.some((call) => call[0] === "aiGateway.generateText"), false);
});

test("generateTextViaGateway routes AI Gateway selections and normalizes errors", async () => {
	const { calls, service } = createHarness({ backend: "ai-gateway" });

	const text = await service.generateTextViaGateway({
		system: "System",
		prompt: "Prompt",
		messages: [{ role: "user", content: "History" }],
		maxOutputTokens: 42,
		temperature: 0.2,
		provider: "openai",
		gatewayUrl: "https://gateway.example",
	});

	assert.equal(text, "ai gateway text");
	assert.deepEqual(calls.find((call) => call[0] === "aiGateway.generateText")[1], {
		system: "System",
		prompt: "Prompt",
		messages: [{ role: "user", content: "History" }],
		maxOutputTokens: 42,
		temperature: 0.2,
		provider: "openai",
		gatewayUrl: "https://gateway.example",
		signal: undefined,
	});

	const failingProvider = {
		generateText: async () => {
			throw new Error("gateway failed");
		},
		streamText: async () => "",
	};
	const failingService = createGatewayTextGenerationService({
		...createRequiredDeps({ backend: "ai-gateway" }),
		aiGatewayProvider: failingProvider,
	});

	await assert.rejects(
		failingService.generateTextViaGateway({ prompt: "Prompt" }),
		(error) => {
			assert.equal(error.message, "gateway failed");
			assert.equal(error.backendSelected, "ai-gateway");
			return true;
		},
	);
});

test("generateTextViaGateway rejects unknown backend selections with Rovo unavailable", async () => {
	const { service } = createHarness({ backend: "none" });

	await assert.rejects(
		service.generateTextViaGateway({ prompt: "Prompt" }),
		(error) => {
			assert.equal(error.code, "ROVO_UNAVAILABLE");
			return true;
		},
	);
});

test("streamTextViaGateway buffers Rovo deltas and forwards every delta", async () => {
	const { calls, service } = createHarness({ backend: "rovo" });
	const deltas = [];

	const text = await service.streamTextViaGateway({
		system: "System",
		prompt: "Prompt",
		onTextDelta: (delta) => deltas.push(delta),
	});

	assert.equal(text, "rovo text");
	assert.deepEqual(deltas, [" rovo", " text "]);
	const rovoCall = calls.find((call) => call[0] === "streamViaRovo")[1];
	assert.equal(rovoCall.message, "[System Instructions]\nSystem\n[End System Instructions]\n\nPrompt");
	assert.equal(rovoCall.conflictPolicy, "wait-for-turn");
	assert.equal(rovoCall.timeoutMs, 123);
});

test("streamTextViaGateway routes AI Gateway streams through the provider", async () => {
	const { calls, service } = createHarness({ backend: "ai-gateway" });
	const deltas = [];

	const text = await service.streamTextViaGateway({
		prompt: "Prompt",
		onTextDelta: (delta) => deltas.push(delta),
	});

	assert.equal(text, "ai gateway stream");
	assert.deepEqual(deltas, ["ai ", "delta"]);
	assert.equal(calls.some((call) => call[0] === "streamViaRovo"), false);
});

test("mapUiMessagesToConversation returns latest user message and prior conversation", () => {
	const { service } = createHarness();

	assert.deepEqual(service.mapUiMessagesToConversation([
		{ role: "system", parts: [{ type: "text", text: "Ignore" }] },
		{ role: "user", parts: [{ type: "text", text: "First request" }] },
		{ role: "assistant", parts: [{ type: "text", text: "Answer" }] },
		{ role: "user", parts: [{ type: "text", text: "Next request" }] },
	]), {
		message: "Next request",
		conversationHistory: [
			{ type: "user", content: "First request" },
			{ type: "assistant", content: "Answer" },
		],
	});
	assert.deepEqual(service.mapUiMessagesToConversation("bad"), {
		message: "",
		conversationHistory: [],
	});
});

test("compressUiConversationHistory normalizes roles before and after compression", () => {
	const { calls, service } = createHarness();

	const result = service.compressUiConversationHistory([
		{ type: "user", content: " Request " },
		{ type: "assistant", content: "" },
		{ type: "tool", content: " Tool output " },
		null,
	], {
		thresholdChars: 10,
	});

	assert.deepEqual(calls.find((call) => call[0] === "compressConversation").slice(1), [
		[
			{ role: "user", content: "Request" },
			{ role: "assistant", content: "Tool output" },
		],
		{ thresholdChars: 10 },
	]);
	assert.deepEqual(result, {
		compressed: true,
		conversationHistory: [
			{ type: "assistant", content: "Summary" },
			{ type: "assistant", content: "Kept" },
		],
		length: 2,
		originalLength: 2,
	});
});

test("parseGenuiMetaAndBody and stripSpecBlocks preserve existing parsing rules", () => {
	assert.deepEqual(parseGenuiMetaAndBody(`${GENUI_META_PREFIX} {"kind":"card"}\nBody`), {
		meta: { kind: "card" },
		body: "Body",
	});
	assert.deepEqual(parseGenuiMetaAndBody(`${GENUI_META_PREFIX} nope\nBody`), {
		meta: null,
		body: `${GENUI_META_PREFIX} nope\nBody`,
	});
	assert.deepEqual(parseGenuiMetaAndBody("Plain body"), {
		meta: null,
		body: "Plain body",
	});
	assert.equal(stripSpecBlocks("Intro\n\n```spec\n{}\n```\n\n\nOutro"), "Intro\n\nOutro");
});

test("generateSmartGenuiResult forwards the caller's backend preference", async () => {
	const { calls, service } = createHarness({
		aiGatewayText: "Narrative",
		bestSpec: null,
	});

	await service.generateSmartGenuiResult({
		backendPreference: "ai-gateway",
		roleMessages: [{ role: "user", content: "a small bar chart" }],
	});

	assert.deepEqual(calls.find((call) => call[0] === "resolvePreferredBackend"), [
		"resolvePreferredBackend",
		"ai-gateway",
	]);
	assert.ok(calls.some((call) => call[0] === "aiGateway.generateText"));
});

test("generateSmartGenuiResult builds prompt, parses metadata, strips specs, and summarizes quality", async () => {
	const rawText = `${GENUI_META_PREFIX} {"mode":"smart"}\nNarrative\n\n\`\`\`spec\n{}\n\`\`\``;
	const { calls, service } = createHarness({
		backend: "ai-gateway",
		aiGatewayText: rawText,
		bestSpec: { root: "card", elements: { card: { type: "Card" } } },
	});

	const result = await service.generateSmartGenuiResult({
		layoutContext: "two columns",
		roleMessages: [
			{ role: "user", content: "Make a card" },
			{ role: "assistant", content: "Drafting" },
		],
	});

	assert.deepEqual(calls.find((call) => call[0] === "getGenuiSystemPrompt")[1], {
		strict: true,
		layoutContext: "two columns",
	});
	const gatewayCall = calls.find((call) => call[0] === "aiGateway.generateText")[1];
	assert.equal(gatewayCall.system, "genui system prompt");
	assert.match(gatewayCall.prompt, /\[User\]\nMake a card/u);
	assert.match(gatewayCall.prompt, /\[Assistant\]\nDrafting/u);
	assert.equal(gatewayCall.maxOutputTokens, 3500);
	assert.equal(gatewayCall.temperature, 0.3);
	assert.deepEqual(result, {
		rawText,
		meta: { mode: "smart" },
		spec: { root: "card", elements: { card: { type: "Card" } } },
		narrative: "Narrative",
		quality: "high",
		analysisSummary: {
			synthesizedChildCount: 1,
			missingChildKeyCount: 0,
			usedSynthesizedSpec: false,
			hasRecoveredPlaceholderSection: false,
			reasons: ["ok"],
		},
	});
});

function createRequiredDeps({ backend }) {
	return {
		analyzeGeneratedText: (text) => ({ text }),
		assessToolFirstGenuiQuality: () => ({
			quality: "high",
			synthesizedChildCount: 0,
			missingChildKeyCount: 0,
			usedSynthesizedSpec: false,
			hasRecoveredPlaceholderSection: false,
			reasons: [],
		}),
		compressConversation: () => ({ messages: [], compressed: false, length: 0 }),
		createRovoUnavailableError: () => {
			const error = new Error("Rovo unavailable");
			error.code = "ROVO_UNAVAILABLE";
			return error;
		},
		debugLog: () => {},
		generateTextViaRovo: async () => "",
		getGenuiSystemPrompt: () => "",
		normalizeAIGatewayError: (error) => {
			error.backendSelected = "ai-gateway";
			return error;
		},
		pickBestSpec: () => null,
		resolvePreferredBackend: async () => ({ backend }),
		streamViaRovo: async () => {},
	};
}
