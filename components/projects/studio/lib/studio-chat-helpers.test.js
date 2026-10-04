const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("../../../../scripts/lib/esbuild-cjs-loader.js");
const compiled = esbuild.buildSync({ entryPoints: ["components/projects/studio/lib/studio-chat-helpers.ts"], bundle: true, platform: "node", format: "cjs", write: false });
const { adoptStudioGenerationTranscript } = loadCjsModuleFromText(compiled.outputFiles[0].text);

test("Studio adoption awaits complete session activation with the persisted generation snapshot", async () => {
	const messages = [{ id: "result", role: "assistant", parts: [{ type: "text", text: "Created" }] }];
	let snapshot;
	let complete;
	const adoption = adoptStudioGenerationTranscript({
		chat: { activeThreadId: "generation", messages },
		registry: { activateSession(value) { snapshot = value; return new Promise((resolve) => { complete = resolve; }); } },
	});
	assert.deepEqual(snapshot, { threadId: "generation", messages, markPersisted: true });
	complete(true);
	assert.equal(await adoption, true);
});

test("Studio adoption ignores absent generation transcripts and missing activation capability", async () => {
	let calls = 0;
	const registry = { async activateSession() { calls += 1; return true; } };
	assert.equal(await adoptStudioGenerationTranscript({ chat: null, registry }), false);
	assert.equal(await adoptStudioGenerationTranscript({ chat: { activeThreadId: "generation", messages: [] }, registry }), false);
	assert.equal(await adoptStudioGenerationTranscript({ chat: { activeThreadId: "generation", messages: [{}] }, registry: {} }), false);
	assert.equal(calls, 0);
});
