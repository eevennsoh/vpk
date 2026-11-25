import assert from "node:assert/strict";
import test from "node:test";

import { agentSessionDemoScenario } from "./agent-session-demo-chat.ts";

test("a session ready for review opens with a review message and no active thinking trace", () => {
	const scenario = agentSessionDemoScenario({
		agent: { name: "Cursor" },
		id: "cloud-suspension-tuning-review",
		state: "ready-for-review",
		title: "Tune off-road suspension presets",
	}, [], false);

	assert.ok("recordedSession" in scenario);
	const { recordedSession } = scenario;
	assert.equal(recordedSession.thinkingMessageId, null);
	assert.deepEqual(recordedSession.messages.filter((message) => message.role === "assistant").flatMap((message) => message.parts), [
		{ type: "text", text: "The work is ready for your review.", state: "done" },
	]);
});
