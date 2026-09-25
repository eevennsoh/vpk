const assert = require("node:assert/strict");
const test = require("node:test");

const {
	logBackendServerReady,
} = require("./server-startup");

function createLogger() {
	const logs = [];
	const errors = [];
	return {
		errors,
		logger: {
			error: (...args) => errors.push(args),
			log: (...args) => logs.push(args),
		},
		logs,
	};
}

function createBaseDependencies(overrides = {}) {
	const { logger, logs, errors } = createLogger();
	const calls = [];
	return {
		buildLlmRoutingStatus: (input) => {
			calls.push(["buildLlmRoutingStatus", input]);
			return {
				chatSdk: { backend: input.rovoAvailable ? "rovo" : "ai-gateway" },
				aiGatewayAssistedFeatures: {
					configured: input.aiGatewayConfigured,
					useCases: ["suggestions", "metadata"],
				},
			};
		},
		calls,
		describeChatBackend: (llmRouting) => {
			calls.push(["describeChatBackend", llmRouting.chatSdk.backend]);
			return llmRouting.chatSdk.backend;
		},
		errors,
		getEnvVars: () => {
			calls.push(["getEnvVars"]);
			return { AI_GATEWAY_URL: "https://gateway.example" };
		},
		getRealtimeConfig: () => ({
			apiKey: "",
			model: "gpt-realtime",
			voice: "verse",
			wsUrl: "wss://realtime.example",
		}),
		getRovoPool: () => ({
			getStatus: () => ({
				total: 2,
				ports: [{ port: 4100 }, { port: 4101 }],
			}),
		}),
		hasGatewayUrlConfigured: (envVars) => Boolean(envVars.AI_GATEWAY_URL),
		interactiveChatForcePortRecoveryMaxAttempts: 2,
		interactiveChatForcePortRecoveryTimeoutMs: 3000,
		logger,
		logs,
		port: 8080,
		refreshRovoAvailability: async () => {
			calls.push(["refreshRovoAvailability"]);
			return true;
		},
		...overrides,
	};
}

function flattenedLogText(logs) {
	return logs.map((entry) => entry.join(" ")).join("\n");
}

test("logBackendServerReady refreshes Rovo and reports routing", async () => {
	const dependencies = createBaseDependencies({
		debugMode: true,
		env: {
			AI_GATEWAY_URL: "https://gateway.example",
			ASAP_ISSUER: "issuer",
			ASAP_KID: "kid",
			ASAP_PRIVATE_KEY: "private-key",
		},
	});

	const result = await logBackendServerReady(dependencies);
	const text = flattenedLogText(dependencies.logs);

	assert.deepEqual(dependencies.calls.map(([name]) => name), [
		"refreshRovoAvailability",
		"getEnvVars",
		"buildLlmRoutingStatus",
		"describeChatBackend",
	]);
	assert.equal(result.rovoReady, true);
	assert.equal(result.aiGatewayConfigured, true);
	assert.equal(result.realtimeConfigured, true);
	assert.match(text, /Server ready for connections/u);
	assert.match(text, /Chat Backend: rovo/u);
	assert.match(text, /ROVO_POOL: 2 ports \(4100, 4101\)/u);
	assert.match(text, /AI_GATEWAY_ASSISTED_FEATURES: CONFIGURED/u);
	assert.match(text, /OpenAI Realtime: CONFIGURED \(via AI Gateway\)/u);
	assert.match(text, /\[DEBUG MODE ENABLED\]/u);
});

test("logBackendServerReady reports unavailable chat and Realtime", async () => {
	const dependencies = createBaseDependencies({
		env: {},
		getEnvVars: () => ({}),
		getRovoPool: () => null,
		refreshRovoAvailability: async () => false,
	});

	const result = await logBackendServerReady(dependencies);
	const text = flattenedLogText(dependencies.logs);

	assert.equal(result.rovoReady, false);
	assert.equal(result.aiGatewayConfigured, false);
	assert.equal(result.realtimeConfigured, false);
	assert.match(text, /Chat Backend: ai-gateway/u);
	assert.match(text, /AI_GATEWAY_ASSISTED_FEATURES: NOT CONFIGURED/u);
	assert.match(text, /OpenAI Realtime: NOT CONFIGURED/u);
});

test("logBackendServerReady validates required dependencies", async () => {
	await assert.rejects(
		() => logBackendServerReady(createBaseDependencies({ refreshRovoAvailability: null })),
		/refreshRovoAvailability/u,
	);
});
