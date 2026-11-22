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

test("flushVisibleText drops a held tail once it reaches a marker prefix's first underscore", () => {
	for (const [streamed, expected] of [
		["Here is the answer WIDGET_DA", "Here is the answer "],
		["The answer ends in WIDGET_", "The answer ends in "],
		["Done.\nTHINKING_ST", "Done.\n"],
		["Done.\nAGENT_", "Done.\n"],
		["WIDGET_", ""],
		// Shorter than the first underscore: ordinary text, shown. Before: "Plan " and "The answer ends in ".
		["Plan A", "Plan A"],
		["The answer ends in WIDGET", "The answer ends in WIDGET"],
		["Done.\nWIDG", "Done.\nWIDG"],
		["Done.\nAGENT", "Done.\nAGENT"],
		["Done.\nTHINKING", "Done.\nTHINKING"],
		["W", "W"],
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

test("flushVisibleText keeps processing after a marker prefix with an invalid payload", () => {
	// push() shows the invalid prefix and stops with the rest held; flushVisibleText processes on.
	for (const [streamed, expected] of [
		['WIDGET_DATA:xTHINKING_STATUS:{"label":"Done"}', "WIDGET_DATA:x"],
		// Two invalid prefixes need a pass each before the marker after them is reached.
		['WIDGET_DATA:xWIDGET_DATA:yTHINKING_STATUS:{"label":"Done"}', "WIDGET_DATA:xWIDGET_DATA:y"],
	]) {
		const { adapter, parts, textDeltas } = createAdapter();
		adapter.push(streamed);
		adapter.flushVisibleText();
		adapter.flush();

		assert.equal(textDeltas.join(""), expected, streamed);
		assert.deepEqual(parts, [{
			type: "data-thinking-status",
			data: { label: "Done", content: undefined, activity: undefined, source: undefined },
		}], streamed);
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

	// Short of the first underscore it is ordinary text in agent mode too.
	const short = createAdapter({ creationMode: "agent" });
	short.adapter.push("Building your agent AGENT");
	short.adapter.flushVisibleText();
	assert.equal(short.textDeltas.join(""), "Building your agent AGENT");
});

test("flushVisibleText shows the start of a custom agent-result prefix without an underscore", () => {
	// Such a prefix is started only once it is all there. Before: a single matching letter ("R") was
	// held as a started marker and dropped.
	for (const streamed of ["Ready? R", "Ready? RESUL"]) {
		const { adapter, textDeltas } = createAdapter({ agentResultPrefix: "RESULT:", creationMode: "agent" });
		adapter.push(streamed);
		adapter.flushVisibleText();
		assert.equal(textDeltas.join(""), streamed);
	}
});

test("flush still treats a held unfinished marker as final text at the normal end of a stream", () => {
	const { adapter, textDeltas } = createAdapter();

	adapter.push('Intro WIDGET_DATA:{"type":"plan"');
	adapter.flush();

	assert.equal(textDeltas.join(""), 'Intro WIDGET_DATA:{"type":"plan"');
});

function loadingTypes(parts) {
	return parts.filter((part) => part.type === "data-widget-loading").map((part) => part.data.type);
}

test("a loading marker's type split across chunks is read whole", () => {
	// Producers end the marker's line after the type. Before: chunks "WIDGET_LOADING:pl", "an" read
	// type "pl" and showed "an" as text.
	for (const [chunks, expectedType, expectedText] of [
		[["WIDGET_LOADING:pl", "an\nDone"], "plan", "Done"],
		[["WIDGET_LOADING:q", "uestion-card\n"], "question-card", ""],
		[["Intro WIDGET_LOADING:image-pr", "eview", " is ready"], "image-preview", "Intro is ready"],
		// The start of a known type is not read early.
		[["WIDGET_LOADING:genui", "-preview\n"], "genui-preview", ""],
	]) {
		const { adapter, events, parts, textDeltas } = createAdapter();
		for (const chunk of chunks) {
			adapter.push(chunk);
		}
		assert.deepEqual(loadingTypes(parts), [expectedType], JSON.stringify(chunks));
		adapter.flush();

		assert.deepEqual(loadingTypes(parts), [expectedType], JSON.stringify(chunks));
		assert.equal(textDeltas.join(""), expectedText, JSON.stringify(chunks));
		assert.deepEqual(events.map((event) => event.type), expectedType === "plan" ? ["plan-loading"] : [], JSON.stringify(chunks));
	}
});

test("a whole loading marker with nothing after it is read at once when its type is a whole known type", () => {
	for (const type of ["plan", "question-card", "genui-preview"]) {
		const { adapter, parts, textDeltas } = createAdapter();
		adapter.push(`WIDGET_LOADING:${type}`);

		assert.deepEqual(loadingTypes(parts), [type], type);
		adapter.flush();
		assert.deepEqual(loadingTypes(parts), [type], type);
		assert.equal(textDeltas.join(""), "", type);
	}

	// Any other type could still go on, so it waits for the character after it.
	const other = createAdapter();
	other.adapter.push("WIDGET_LOADING:image-preview");
	assert.deepEqual(loadingTypes(other.parts), []);
	other.adapter.push("\n");
	assert.deepEqual(loadingTypes(other.parts), ["image-preview"]);
});

test("a loading marker at the end of a stream is read with the type it has", () => {
	for (const [streamed, expectedType] of [
		["Intro WIDGET_LOADING:pl", "pl"],
		["WIDGET_LOADING:image-preview", "image-preview"],
	]) {
		const { adapter, parts, textDeltas } = createAdapter();
		adapter.push(streamed);
		assert.deepEqual(loadingTypes(parts), [], streamed);
		adapter.flush();

		assert.deepEqual(loadingTypes(parts), [expectedType], streamed);
		assert.equal(textDeltas.join(""), streamed.startsWith("Intro") ? "Intro " : "", streamed);
	}
});

test("a failure flush drops a loading marker whose type may still go on", () => {
	for (const chunks of [["Intro WIDGET_LOADING:pl"], ["Intro WIDGET_LOADING:", "image-prev"]]) {
		const { adapter, events, parts, textDeltas } = createAdapter();
		for (const chunk of chunks) {
			adapter.push(chunk);
		}
		adapter.flushVisibleText();
		adapter.flush();

		assert.deepEqual(parts, [], JSON.stringify(chunks));
		assert.deepEqual(events, [], JSON.stringify(chunks));
		assert.equal(textDeltas.join(""), "Intro ", JSON.stringify(chunks));
	}
});
