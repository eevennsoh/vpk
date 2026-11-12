const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROUTE_SOURCES = [
	{
		name: "Studio",
		shell: "components/projects/studio/components/rovo-app-shell.tsx",
		realtimeHook: "components/projects/rovo-core/hooks/use-realtime-voice.ts",
	},
	{
		name: "Rovo",
		shell: "components/projects/rovo/components/rovo-app-shell.tsx",
		realtimeHook: "components/projects/rovo-core/hooks/use-realtime-voice.ts",
	},
].map((route) => ({
	...route,
	shellSource: fs.readFileSync(path.join(process.cwd(), route.shell), "utf8"),
	realtimeHookSource: fs.readFileSync(path.join(process.cwd(), route.realtimeHook), "utf8"),
}));

function sourceBetween(source, startNeedle, endNeedle) {
	const start = source.indexOf(startNeedle);
	const end = source.indexOf(endNeedle, start);

	assert.notEqual(start, -1, `Missing source marker: ${startNeedle}`);
	assert.notEqual(end, -1, `Missing source marker: ${endNeedle}`);
	return source.slice(start, end);
}

test("realtime assistant text and audio transcript deltas are exposed as live panel text", () => {
	for (const route of ROUTE_SOURCES) {
		const textDeltaSource = sourceBetween(
			route.realtimeHookSource,
			'case "text_delta":',
			'case "audio_transcript_delta":',
		);
		const audioTranscriptDeltaSource = sourceBetween(
			route.realtimeHookSource,
			'case "audio_transcript_delta":',
			'case "audio_transcript_done":',
		);

		assert.match(textDeltaSource, /source: "text"/u, `${route.name} text deltas should be source-tagged`);
		assert.match(textDeltaSource, /text: result\.state\.transcript/u, `${route.name} text deltas should include accumulated text`);
		assert.match(audioTranscriptDeltaSource, /source: "audio_transcript"/u, `${route.name} audio transcript deltas should be source-tagged`);
		assert.match(audioTranscriptDeltaSource, /text: result\.state\.transcript/u, `${route.name} audio transcript deltas should include accumulated text`);
	}
});

test("assistant panel streaming activates Clicky before speaking text", () => {
	for (const route of ROUTE_SOURCES) {
		const streamHelperSource = sourceBetween(
			route.shellSource,
			"const streamClickyAssistantText = useCallback",
			"const [screenAssistantRegion",
		);
		const activateIndex = streamHelperSource.indexOf("activateClicky();");
		const speakIndex = streamHelperSource.indexOf("clickyStartSpeaking(text);");

		assert.match(streamHelperSource, /if \(!isClickyActive\) \{/u, `${route.name} should recover when Clicky is not active`);
		assert.notEqual(activateIndex, -1, `${route.name} should activate Clicky for streamed assistant text`);
		assert.notEqual(speakIndex, -1, `${route.name} should send streamed text into Clicky`);
		assert.ok(activateIndex < speakIndex, `${route.name} should activate before speaking`);
	}
});

test("Studio exposes a gated no-mic assistant text stream hook through the real delta handler", () => {
	const studio = ROUTE_SOURCES.find((route) => route.name === "Studio");
	assert.ok(studio);

	assert.match(studio.shellSource, /__VPK_E2E_SCREEN_ASSISTANT__/u);
	assert.match(studio.shellSource, /streamAssistantText: async \(chunks\) => \{/u);
	assert.match(studio.shellSource, /await handleRealtimeAssistantTextDelta\(\{[\s\S]*displayOnly: true,[\s\S]*source: "text",[\s\S]*text,/u);
});
