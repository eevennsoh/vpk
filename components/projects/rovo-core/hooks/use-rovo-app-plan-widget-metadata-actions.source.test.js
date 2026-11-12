const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const PLAN_METADATA_ACTIONS_SOURCE = readSource("use-rovo-app-plan-widget-metadata-actions.ts");

test("Rovo app core delegates plan widget metadata state and persistence wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-plan-widget-metadata-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppPlanWidgetMetadataActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /pendingPlanMetadataMessageIds/u);
	assert.match(CORE_HOOK_SOURCE, /persistPlanWidgetMetadata/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /persistRovoAppPlanWidgetMetadataCore/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setPendingPlanMetadataMessageIds/u);

	assert.match(PLAN_METADATA_ACTIONS_SOURCE, /export function useRovoAppPlanWidgetMetadataActions/u);
	assert.match(PLAN_METADATA_ACTIONS_SOURCE, /persistRovoAppPlanWidgetMetadataCore/u);
	assert.match(PLAN_METADATA_ACTIONS_SOURCE, /useState<Set<string>>/u);
	assert.match(PLAN_METADATA_ACTIONS_SOURCE, /setPlanMetadataPendingState/u);
	assert.match(PLAN_METADATA_ACTIONS_SOURCE, /clearPendingPlanMetadataGeneration/u);
});
