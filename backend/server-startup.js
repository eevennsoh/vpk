"use strict";

const {
	describeGatewayCloudIdKind,
	resolveGatewayCloudId,
} = require("./lib/ai-gateway-helpers");

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`logBackendServerReady requires ${name}`);
	}
}

async function logBackendServerReady({
	buildLlmRoutingStatus,
	debugMode = false,
	describeChatBackend,
	env = process.env,
	getEnvVars,
	getRealtimeConfig,
	getRovoPool,
	hasGatewayUrlConfigured,
	interactiveChatForcePortRecoveryMaxAttempts,
	interactiveChatForcePortRecoveryTimeoutMs,
	logger = console,
	port,
	refreshRovoAvailability,
} = {}) {
	requireFunction("buildLlmRoutingStatus", buildLlmRoutingStatus);
	requireFunction("describeChatBackend", describeChatBackend);
	requireFunction("getEnvVars", getEnvVars);
	requireFunction("getRealtimeConfig", getRealtimeConfig);
	requireFunction("getRovoPool", getRovoPool);
	requireFunction("hasGatewayUrlConfigured", hasGatewayUrlConfigured);
	requireFunction("logger.log", logger?.log);
	requireFunction("logger.error", logger?.error);
	requireFunction("refreshRovoAvailability", refreshRovoAvailability);

	logger.log(`[STARTUP] ✓ Server listening on 0.0.0.0:${port}`);
	logger.log(`\n${"=".repeat(60)}`);
	logger.log("Server ready for connections");
	logger.log("Environment check:");
	logger.log(`  PORT: ${port}`);
	logger.log(`  AI_GATEWAY_URL: ${env.AI_GATEWAY_URL ? "SET" : "MISSING"}`);
	logger.log(`  Debug Mode: ${debugMode}`);

	logger.log("\n🔐 Using ASAP Authentication");
	logger.log(`  ASAP_ISSUER: ${env.ASAP_ISSUER ? "SET" : "MISSING"}`);
	logger.log(`  ASAP_KID: ${env.ASAP_KID ? "SET" : "MISSING"}`);
	logger.log(`  ASAP_PRIVATE_KEY: ${env.ASAP_PRIVATE_KEY ? "SET" : "MISSING"}`);

	const rovoReady = await refreshRovoAvailability();

	const envVars = getEnvVars();
	const aiGatewayConfigured = hasGatewayUrlConfigured(envVars);
	const llmRouting = buildLlmRoutingStatus({
		rovoAvailable: rovoReady,
		aiGatewayConfigured,
	});
	const chatBackendLabel = describeChatBackend(llmRouting);
	logger.log(`\n🤖 Chat Backend: ${chatBackendLabel}`);
	logger.log(
		`  AI_GATEWAY_CLOUD_ID: ${envVars.AI_GATEWAY_CLOUD_ID ? "SET" : "MISSING"} ` +
			`(${describeGatewayCloudIdKind(envVars.AI_GATEWAY_CLOUD_ID)}, ` +
			`resolved ${describeGatewayCloudIdKind(resolveGatewayCloudId(envVars))})`,
	);
	const rovoPool = getRovoPool();
	if (rovoReady && rovoPool) {
		const poolStatus = rovoPool.getStatus();
		logger.log(`  ROVO_POOL: ${poolStatus.total} ports (${poolStatus.ports.map((p) => p.port).join(", ")})`);
	} else if (rovoReady) {
		logger.log(`  ROVO_PORT: ${env.ROVO_PORT}`);
	}
	logger.log(
		`  INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_MAX_ATTEMPTS: ${interactiveChatForcePortRecoveryMaxAttempts}`
	);
	logger.log(
		`  INTERACTIVE_CHAT_FORCE_PORT_RECOVERY_TIMEOUT_MS: ${interactiveChatForcePortRecoveryTimeoutMs}`
	);
	logger.log(
		`  AI_GATEWAY_ASSISTED_FEATURES: ${
			llmRouting.aiGatewayAssistedFeatures.configured
				? "CONFIGURED"
				: "NOT CONFIGURED"
		} (${llmRouting.aiGatewayAssistedFeatures.useCases.join(", ")})`
	);

	const realtimeConfig = getRealtimeConfig();
	const realtimeDirectKey = Boolean(realtimeConfig.apiKey);
	const realtimeViaGateway = !realtimeDirectKey && Boolean(env.ASAP_PRIVATE_KEY);
	const realtimeConfigured = realtimeDirectKey || realtimeViaGateway;
	logger.log(`\n🎙️ OpenAI Realtime: ${realtimeConfigured ? "CONFIGURED" : "NOT CONFIGURED"}${realtimeViaGateway ? " (via AI Gateway)" : ""}`);
	if (realtimeConfigured) {
		logger.log(`  OPENAI_REALTIME_MODEL: ${realtimeConfig.model}`);
		logger.log(`  OPENAI_REALTIME_WS_URL: ${realtimeConfig.wsUrl}`);
		logger.log(`  OPENAI_REALTIME_VOICE: ${realtimeConfig.voice}`);
	}

	logger.log(`${"=".repeat(60)}\n`);

	if (debugMode) {
		logger.log("[DEBUG MODE ENABLED]");
		logger.log("  All debug logs will be printed");
		logger.log("  To disable: DEBUG=false\n");
	}

	return {
		aiGatewayConfigured,
		llmRouting,
		realtimeConfigured,
		rovoReady,
	};
}

module.exports = {
	logBackendServerReady,
};
