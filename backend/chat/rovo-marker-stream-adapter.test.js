const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoMarkerStreamAdapter,
	findJsonObjectEndIndex,
	sanitizeThinkingActivity,
	sanitizeThinkingLabel,
	sanitizeThinkingSource,
} = require("./rovo-marker-stream-adapter");
const {
	AGENT_RESULT_STREAM_PREFIX,
} = require("../lib/studio-agent-result");

function createWriter() {
	const parts = [];
	return {
		parts,
		writer: {
			write(part) {
				parts.push(part);
			},
		},
	};
}

function createAdapter(options = {}) {
	const { parts, writer } = createWriter();
	const textDeltas = [];
	const events = [];
	let hasEmittedPlanWidget = false;
	const adapter = createRovoMarkerStreamAdapter({
		emitTextDelta: (delta) => textDeltas.push(delta),
		getHasEmittedPlanWidget: () => hasEmittedPlanWidget,
		logger: {
			errors: [],
			infos: [],
			error(...args) {
				this.errors.push(args);
			},
			info(...args) {
				this.infos.push(args);
			},
		},
		onGenuiWidgetEmitted: () => events.push({ type: "genui" }),
		onPlanWidgetData: (payload) => {
			hasEmittedPlanWidget = true;
			events.push({ type: "plan-data", payload });
		},
		onPlanWidgetLoading: (loading) => events.push({ type: "plan-loading", loading }),
		onQuestionCardEmitted: (widgetId) => events.push({ type: "question-card", widgetId }),
		widgetId: "widget-1",
		writer,
		...options,
	});
	return {
		adapter,
		events,
		parts,
		textDeltas,
	};
}

test("findJsonObjectEndIndex handles nested strings and escaped quotes", () => {
	const value = 'prefix {"outer":{"text":"brace } and \\"quote\\""}} suffix';
	const start = value.indexOf("{");
	const end = findJsonObjectEndIndex(value, start);

	assert.equal(value.slice(start, end + 1), '{"outer":{"text":"brace } and \\"quote\\""}}');
});

test("sanitizes thinking fields with existing defaults", () => {
	assert.equal(sanitizeThinkingLabel("Working..."), "Working");
	assert.equal(sanitizeThinkingLabel("Working…"), "Working");
	assert.equal(sanitizeThinkingLabel(1), "");
	assert.equal(sanitizeThinkingActivity("data"), "data");
	assert.equal(sanitizeThinkingActivity("unknown"), undefined);
	assert.equal(sanitizeThinkingSource("backend"), "backend");
	assert.equal(sanitizeThinkingSource("client"), undefined);
});

test("parses split loading markers without leaking partial marker text", () => {
	const { adapter, events, parts, textDeltas } = createAdapter();

	adapter.push("Intro WIDGET_");
	assert.deepEqual(textDeltas, []);
	assert.deepEqual(parts, []);

	adapter.push("LOADING:plan\n");

	assert.deepEqual(textDeltas, ["Intro "]);
	assert.deepEqual(events, [{ type: "plan-loading", loading: true }]);
	assert.deepEqual(parts, [{
		type: "data-widget-loading",
		id: "widget-1",
		data: {
			type: "plan",
			loading: true,
		},
	}]);
});

test("question-card widget data preserves creation mode and leaves loading open", () => {
	const { adapter, events, parts } = createAdapter({ creationMode: "agent" });

	adapter.push(`WIDGET_DATA:${JSON.stringify({
		type: "question-card",
		title: "Answer",
		questions: [{ id: "q-1", label: "Who?", options: [] }],
	})}`);
	adapter.flush();

	assert.deepEqual(events, [{ type: "question-card", widgetId: "widget-1" }]);
	assert.equal(parts.length, 1);
	assert.equal(parts[0].type, "data-widget-data");
	assert.equal(parts[0].data.type, "question-card");
	assert.equal(parts[0].data.payload.creationMode, "agent");
	assert.equal(parts[0].data.payload.title, "Answer");
});

test("plan widget data marks plan state and suppresses later GenUI marker", () => {
	const { adapter, events, parts } = createAdapter();

	adapter.push(`WIDGET_LOADING:plan\nWIDGET_DATA:${JSON.stringify({
		type: "plan",
		title: "Plan",
		tasks: [{ label: "Extract" }],
	})}`);
	adapter.push(`WIDGET_DATA:${JSON.stringify({
		type: "genui-preview",
		spec: { elements: {} },
	})}`);
	adapter.flush();

	assert.deepEqual(events.map((event) => event.type), [
		"plan-loading",
		"plan-data",
		"plan-loading",
	]);
	assert.equal(parts.length, 3);
	assert.equal(parts[0].type, "data-widget-loading");
	assert.equal(parts[1].type, "data-widget-data");
	assert.equal(parts[1].data.type, "plan");
	assert.equal(parts[2].type, "data-widget-loading");
	assert.equal(parts[2].data.loading, false);
	assert.ok(!parts.some((part) => part.data?.type === "genui-preview"));
});

test("thinking-status and agent-execution markers normalize defaults", () => {
	const { adapter, parts } = createAdapter();

	adapter.push(`THINKING_STATUS:${JSON.stringify({
		label: "Working...",
		content: "  Checking tools  ",
		activity: "data",
		source: "backend",
	})}`);
	adapter.push(`AGENT_EXECUTION:${JSON.stringify({
		agentId: "",
		agentName: "",
		taskId: "",
		taskLabel: "",
		status: "",
		content: "Running",
	})}`);
	adapter.flush();

	assert.deepEqual(parts[0], {
		type: "data-thinking-status",
		data: {
			label: "Working",
			content: "Checking tools",
			activity: "data",
			source: "backend",
		},
	});
	assert.deepEqual(parts[1], {
		type: "data-agent-execution",
		id: "agent-execution-unknown",
		data: {
			agentId: "unknown",
			agentName: "Agent",
			taskId: "unknown",
			taskLabel: "Task",
			status: "working",
			content: "Running",
		},
	});
});

test("agent-result marker uses tolerant chunked parsing and normalization", () => {
	const { adapter, parts } = createAdapter({ creationMode: "agent" });
	const payload = {
		name: "Ops Triage",
		description: "Triages operational incidents.",
		instructions: "Classify impact and propose next actions.",
		conversationStarters: ["Triage this incident."],
	};
	const marker = `${AGENT_RESULT_STREAM_PREFIX} ${JSON.stringify(payload)}`;

	adapter.push(marker.slice(0, 18));
	adapter.push(marker.slice(18));
	adapter.flush();

	assert.equal(parts.length, 1);
	assert.equal(parts[0].type, "data-agent-result");
	assert.equal(parts[0].data.agentId, "studio-agent-ops-triage");
	assert.equal(parts[0].data.name, "Ops Triage");
});

test("flushVisibleText emits a held plain tail and leaves the adapter empty", () => {
	const { adapter, parts, textDeltas } = createAdapter();

	adapter.push("Here are the Jira issues I found so far");
	adapter.flushVisibleText();
	adapter.flush();

	assert.equal(textDeltas.join(""), "Here are the Jira issues I found so far");
	assert.deepEqual(parts, []);
});

test("flushVisibleText emits the text before a marker whose payload never finished, and drops the marker", () => {
	for (const chunks of [
		['Intro WIDGET_DATA:{"type":"plan"'],
		["Intro WIDGET_DATA:", '{"type":"plan","title":"Pl'],
		["Intro WIDGET_DATA:"],
		["Intro WIDGET_DATA:   "],
		["Intro WIDGET_LOADING:"],
		['Intro THINKING_STATUS:{"label":"Work'],
		['Intro AGENT_EXECUTION:{"taskId":"t-1","content":"{"'],
	]) {
		const { adapter, parts, textDeltas } = createAdapter();
		for (const chunk of chunks) {
			adapter.push(chunk);
		}
		adapter.flushVisibleText();
		adapter.flush();

		assert.equal(textDeltas.join(""), "Intro ", JSON.stringify(chunks));
		assert.deepEqual(parts, [], JSON.stringify(chunks));
	}
});

test("flushVisibleText drops a held tail that could still grow into a marker prefix", () => {
	for (const [streamed, expected] of [
		["Here is the answer WIDGET_DA", "Here is the answer "],
		["Done.\nTHINKING_ST", "Done.\n"],
		["Done.\nAGENT_", "Done.\n"],
		["WIDGET_", ""],
		// Not the start of any marker prefix: shown.
		["Done.\nWIDGETS", "Done.\nWIDGETS"],
		["Values: WIDGET_D_", "Values: WIDGET_D_"],
	]) {
		const { adapter, textDeltas } = createAdapter();
		adapter.push(streamed);
		adapter.flushVisibleText();
		adapter.flush();

		assert.equal(textDeltas.join(""), expected, JSON.stringify(streamed));
	}
});

test("flushVisibleText processes a complete marker and emits the plain text after it", () => {
	const { adapter, parts, textDeltas } = createAdapter();

	adapter.push(`Intro\nTHINKING_STATUS:${JSON.stringify({ label: "Working" })}\nMore`);
	adapter.flushVisibleText();
	adapter.flush();

	assert.equal(textDeltas.join(""), "Intro\nMore");
	assert.deepEqual(parts, [{
		type: "data-thinking-status",
		data: { label: "Working", content: undefined, activity: undefined, source: undefined },
	}]);
});

test("flushVisibleText shows a marker prefix with an invalid payload as text, as push does", () => {
	const { adapter, textDeltas } = createAdapter();

	adapter.push("Intro WIDGET_DATA:not json at all");
	adapter.flushVisibleText();
	adapter.flush();

	assert.equal(textDeltas.join(""), "Intro WIDGET_DATA:not json at all");
});

test("flushVisibleText in agent mode drops a partial agent-result prefix and an unfinished payload", () => {
	for (const streamed of [
		"Building your agent AGENT_RES",
		`Building your agent ${AGENT_RESULT_STREAM_PREFIX}`,
		`Building your agent ${AGENT_RESULT_STREAM_PREFIX} {"name":"Ops`,
	]) {
		const { adapter, parts, textDeltas } = createAdapter({ creationMode: "agent" });
		adapter.push(streamed);
		adapter.flushVisibleText();
		adapter.flush();

		assert.equal(textDeltas.join(""), "Building your agent ", JSON.stringify(streamed));
		assert.deepEqual(parts, [], JSON.stringify(streamed));
	}

	// Outside agent mode the agent-result prefix is ordinary text.
	const { adapter, textDeltas } = createAdapter();
	adapter.push("Building your agent AGENT_RES");
	adapter.flushVisibleText();
	assert.equal(textDeltas.join(""), "Building your agent AGENT_RES");
});

test("flush still treats a held unfinished marker as final text at the normal end of a stream", () => {
	const { adapter, textDeltas } = createAdapter();

	adapter.push('Intro WIDGET_DATA:{"type":"plan"');
	adapter.flush();

	assert.equal(textDeltas.join(""), 'Intro WIDGET_DATA:{"type":"plan"');
});
