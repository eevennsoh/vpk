const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildExitPlanWidgetPayloadFromToolInput,
	createExitPlanWidgetEmitter,
	normalizeExitPlanToolInput,
} = require("./exit-plan-widget");

function createHarness(overrides = {}) {
	const parts = [];
	const records = [];
	const events = [];
	let planWidgetLoading = false;
	const logger = {
		infos: [],
		warnings: [],
		info(...args) {
			this.infos.push(args);
		},
		warn(...args) {
			this.warnings.push(args);
		},
	};
	const emitter = createExitPlanWidgetEmitter({
		getIsPlanWidgetLoading: () => planWidgetLoading,
		logger,
		onPlanWidgetData: (payload) => events.push({ type: "data", payload }),
		onPlanWidgetLoading: (loading) => {
			planWidgetLoading = loading;
			events.push({ type: "loading", loading });
		},
		recordPlanWidgetEmission: (threadId, metadata) => {
			records.push({ threadId, metadata });
		},
		threadId: "thread-1",
		widgetId: "widget-1",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
		...overrides,
	});

	return {
		emitter,
		events,
		logger,
		parts,
		records,
		setPlanWidgetLoading(value) {
			planWidgetLoading = value;
		},
	};
}

test("normalizes JSON string tool input", () => {
	assert.deepEqual(
		normalizeExitPlanToolInput('{"plan":"Ship it"}'),
		{ plan: "Ship it" },
	);
	assert.equal(normalizeExitPlanToolInput("Ship it"), "Ship it");
});

test("builds a plan widget payload from a markdown string", () => {
	const result = buildExitPlanWidgetPayloadFromToolInput({
		toolCallId: "call-1",
		toolInput: "  ## Plan\n\n- Build it  ",
	});

	assert.deepEqual(result.payload, {
		title: "Plan",
		description: undefined,
		shortDescription: undefined,
		markdown: "## Plan\n\n- Build it",
		tasks: [],
		agents: [],
		deferredToolCallId: "call-1",
	});
});

test("builds a plan widget payload from object input with metadata", () => {
	const tasks = [{ label: "Extract helper" }];
	const agents = [{ name: "Backend" }];
	const result = buildExitPlanWidgetPayloadFromToolInput({
		toolCallId: "call-2",
		toolInput: {
			name: "Implementation Plan",
			summary: "Refactor the handler.",
			short_description: "Extract handler logic.",
			plan: "## Plan",
			tasks,
			agents,
		},
	});

	assert.deepEqual(result.payload, {
		title: "Implementation Plan",
		description: "Refactor the handler.",
		shortDescription: "Extract handler logic.",
		markdown: "## Plan",
		tasks,
		agents,
		deferredToolCallId: "call-2",
	});
});

test("uses steps as task fallback", () => {
	const steps = [{ label: "Write tests" }];
	const result = buildExitPlanWidgetPayloadFromToolInput({
		toolCallId: "call-3",
		toolInput: {
			planTitle: "Fallback Plan",
			plan: "## Plan",
			steps,
		},
	});

	assert.equal(result.payload.title, "Fallback Plan");
	assert.equal(result.payload.tasks, steps);
});

test("returns null payload when markdown is missing", () => {
	const result = buildExitPlanWidgetPayloadFromToolInput({
		toolCallId: "call-4",
		toolInput: { title: "No plan" },
	});

	assert.deepEqual(result.payload, null);
	assert.deepEqual(result.normalizedToolInput, { title: "No plan" });
});

test("emits plan widget data, records metadata, and closes active loading", () => {
	const harness = createHarness();
	harness.setPlanWidgetLoading(true);

	assert.equal(harness.emitter.emitFromToolInput({
		toolCallId: "call-5",
		toolInput: {
			title: "Plan",
			description: "Do the work.",
			plan: "## Plan",
			tasks: [{ label: "Patch" }],
		},
		source: "deferred_tool_request",
	}), true);

	assert.deepEqual(harness.parts.map((part) => part.type), [
		"data-widget-data",
		"data-widget-loading",
	]);
	assert.equal(harness.parts[0].id, "widget-1");
	assert.equal(harness.parts[0].data.type, "plan");
	assert.equal(harness.parts[0].data.payload.deferredToolCallId, "call-5");
	assert.equal(harness.parts[1].data.loading, false);
	assert.deepEqual(harness.records, [{
		threadId: "thread-1",
		metadata: {
			deferredToolCallId: "call-5",
			planCardId: "widget-1",
		},
	}]);
	assert.deepEqual(harness.events.map((event) => event.type), [
		"data",
		"loading",
	]);
	assert.equal(harness.logger.infos.length, 1);
});

test("missing markdown logs a warning and skips writes", () => {
	const harness = createHarness();

	assert.equal(harness.emitter.emitFromToolInput({
		toolCallId: "call-6",
		toolInput: { title: "No plan" },
		source: "deferred_tool_request",
	}), false);

	assert.deepEqual(harness.parts, []);
	assert.deepEqual(harness.records, []);
	assert.equal(harness.logger.warnings.length, 1);
});
