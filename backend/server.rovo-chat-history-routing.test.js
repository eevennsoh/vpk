const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MANAGED_RUN_CHAT_DISPATCH_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-managed-run-chat-dispatch.js"),
	"utf8",
);
const MANAGED_RUN_ARTIFACT_ROUTE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-managed-run-artifact-route.js"),
	"utf8",
);
const MANAGED_RUN_PROXY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-managed-run-proxy.js"),
	"utf8",
);
const MANAGED_RUN_EXECUTOR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "backend/lib/rovo-app-managed-run-executor.js"),
	"utf8",
);

test("compact rovo chat starts managed runs on AI Gateway without a Rovo gate", () => {
	assert.match(MANAGED_RUN_PROXY_SOURCE, /createRun\(\{\s*backend:\s*"ai-gateway"/su);
	assert.doesNotMatch(MANAGED_RUN_PROXY_SOURCE, /createRovoUnavailableError|resolveRovoAppPortAvailability|enqueueRun/u);
});

test("RFP demo floating-chat turns stream before creating a managed run", () => {
	const demoBranchIndex = MANAGED_RUN_PROXY_SOURCE.indexOf("const agentsRfpDemoTurn = !existingRun");
	const streamIndex = MANAGED_RUN_PROXY_SOURCE.indexOf("streamAgentsRfpDemoChatTurn(res, agentsRfpDemoTurn", demoBranchIndex);
	const createRunIndex = MANAGED_RUN_PROXY_SOURCE.indexOf("rovoAppRunManager.createRun", demoBranchIndex);

	assert.notEqual(demoBranchIndex, -1);
	assert.notEqual(streamIndex, -1);
	assert.notEqual(createRunIndex, -1);
	assert.ok(streamIndex < createRunIndex);
});

test("managed rovo chat persists the resolved backend before streaming", () => {
	assert.match(
		MANAGED_RUN_EXECUTOR_SOURCE,
		/dispatchRovoAppManagedRunChat\(\{[\s\S]*autoPlanTriggered,[\s\S]*routingDecision,[\s\S]*threadId,[\s\S]*\}\)/u,
	);

	const chatPreferenceIndex = MANAGED_RUN_CHAT_DISPATCH_SOURCE.indexOf(
		"requestBody.backendPreference = await resolveRovoAppTurnBackendPreference",
	);
	const chatPersistIndex = MANAGED_RUN_CHAT_DISPATCH_SOURCE.indexOf(
		"await persistRovoAppRunBackend(threadId, requestBody.backendPreference, { run })",
		chatPreferenceIndex,
	);
	const dispatchIndex = MANAGED_RUN_CHAT_DISPATCH_SOURCE.indexOf(
		"const response = await dispatchChatSdkRequestInProcess",
		chatPreferenceIndex,
	);

	assert.notEqual(chatPreferenceIndex, -1);
	assert.notEqual(chatPersistIndex, -1);
	assert.notEqual(dispatchIndex, -1);
	assert.match(MANAGED_RUN_CHAT_DISPATCH_SOURCE, /isPlanModeActive:\s*requestIsPlanMode \|\| autoPlanTriggered/su);
	assert.ok(chatPersistIndex < dispatchIndex);
});

test("managed artifact turns persist delegated backend ownership before handling", () => {
	assert.match(
		MANAGED_RUN_EXECUTOR_SOURCE,
		/handleRovoAppManagedRunArtifactRoute\(\{[\s\S]*autoPlanTriggered,[\s\S]*requestMessages,[\s\S]*routingDecision,[\s\S]*workItemReportRequest,[\s\S]*\}\)/u,
	);

	const artifactPreferenceIndex = MANAGED_RUN_ARTIFACT_ROUTE_SOURCE.indexOf(
		"const artifactBackendPreference",
	);
	const artifactPersistIndex = MANAGED_RUN_ARTIFACT_ROUTE_SOURCE.indexOf(
		"await persistRovoAppRunBackend(threadId, artifactBackendPreference, { run })",
		artifactPreferenceIndex,
	);
	const artifactHandlerIndex = MANAGED_RUN_ARTIFACT_ROUTE_SOURCE.indexOf(
		"const handled = await handleRovoAppArtifactToolRequest",
		artifactPreferenceIndex,
	);

	assert.notEqual(artifactPreferenceIndex, -1);
	assert.notEqual(artifactPersistIndex, -1);
	assert.notEqual(artifactHandlerIndex, -1);
	assert.ok(artifactPersistIndex < artifactHandlerIndex);
});
