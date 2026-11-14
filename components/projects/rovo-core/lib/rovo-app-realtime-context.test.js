const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	ROVO_APP_REALTIME_RESULT_SUMMARY_MAX_CHARS,
	buildRovoAppRealtimeArtifactContextSummary,
	buildRovoAppRealtimeResultSummary,
	buildRovoAppRealtimeThreadSummary,
	resolveRovoAppRealtimeSessionIdentity,
	resolveRovoAppRealtimeStatusMessage,
} = loadRovoCoreModule("lib/rovo-app-realtime-context.ts");

function textPart(text) {
	return {
		type: "text",
		text,
		state: "done",
	};
}

function artifactResultPart(action, title) {
	return {
		type: "data-artifact-result",
		data: {
			action,
			artifactId: `${title.toLowerCase().replace(/\s+/gu, "-")}-artifact`,
			kind: "html",
			title,
		},
	};
}

function message(role, parts) {
	return { role, parts };
}

test("thread summary keeps artifact context and role labels", () => {
	assert.equal(
		buildRovoAppRealtimeThreadSummary([
			message("system", [textPart("Ignore system setup")]),
			message("user", [textPart("Build a digest agent")]),
			message("assistant", [textPart("Done"), artifactResultPart("create", "Agent brief")]),
			message("assistant", [artifactResultPart("update", "Agent brief")]),
		]),
		[
			"user: Build a digest agent",
			"assistant: Done Created artifact \"Agent brief\".",
			"assistant: Updated artifact \"Agent brief\".",
		].join("\n"),
	);
});

test("result summary names the product, preserves artifact wording and truncates long output", () => {
	for (const productName of ["Rovo", "Studio"]) {
		assert.equal(
			buildRovoAppRealtimeResultSummary(message("assistant", [
				textPart("Review the generated profile."),
				artifactResultPart("create", "Agent profile"),
			]), productName),
			`${productName} created artifact "Agent profile". Review the generated profile.`,
		);
		assert.equal(
			buildRovoAppRealtimeResultSummary(message("assistant", [artifactResultPart("update", "Agent profile")]), productName),
			`${productName} updated artifact "Agent profile". `,
		);
		assert.equal(
			buildRovoAppRealtimeResultSummary(message("assistant", []), productName),
			`${productName} completed the task.`,
		);
	}

	assert.equal(
		buildRovoAppRealtimeResultSummary(message("assistant", [textPart("x".repeat(700))]), "Rovo").length,
		ROVO_APP_REALTIME_RESULT_SUMMARY_MAX_CHARS,
	);
});

test("artifact context summary includes document identity and annotations", () => {
	assert.equal(
		buildRovoAppRealtimeArtifactContextSummary({
			annotationContext: "Annotation: needs review",
			document: {
				id: "doc-1",
				kind: "html",
				title: "Agent profile",
			},
		}),
		[
			"Artifact open: Agent profile",
			"Document ID: doc-1",
			"Kind: html",
			"Annotation: needs review",
		].join("\n"),
	);
	assert.equal(buildRovoAppRealtimeArtifactContextSummary({ annotationContext: null, document: null }), null);
});

test("realtime status and session identity preserve shell fallback behavior", () => {
	assert.equal(resolveRovoAppRealtimeStatusMessage({ statusMessage: " Connecting ", voiceState: "connecting" }), "Connecting");
	assert.equal(resolveRovoAppRealtimeStatusMessage({ connectionState: "reconnecting", voiceState: "connecting" }), "Reconnecting voice...");
	assert.equal(resolveRovoAppRealtimeStatusMessage({ connectionStatus: "disconnected", voiceState: "idle" }), "Voice disconnected");
	assert.equal(resolveRovoAppRealtimeStatusMessage({ connectionStatus: "connected", voiceState: "connected" }), null);

	assert.equal(resolveRovoAppRealtimeSessionIdentity({ sessionId: "session-1", voiceState: "connected" }, "thread-1", "runtime-1"), "session-1");
	assert.equal(resolveRovoAppRealtimeSessionIdentity({ connectionState: "connected", voiceState: "connected" }, "thread-1", "runtime-1"), "connected");
	assert.equal(resolveRovoAppRealtimeSessionIdentity({ voiceState: "listening" }, null, "runtime-1"), "runtime-1:listening");
	assert.equal(resolveRovoAppRealtimeSessionIdentity({ voiceState: "idle" }, "thread-1", "runtime-1"), null);
});
