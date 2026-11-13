const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const CLARIFICATION_PLAN_ACTIONS_SOURCE = readSource("use-rovo-app-clarification-plan-actions.ts");

test("Rovo app core delegates clarification and plan review wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-clarification-plan-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppClarificationPlanActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /cancelClarificationQuestionSet/u);
	assert.match(CORE_HOOK_SOURCE, /submitClarification/u);
	assert.match(CORE_HOOK_SOURCE, /acceptPlanReview/u);
	assert.match(CORE_HOOK_SOURCE, /submitPlanApproval/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /submitRovoAppClarificationContinuation/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /sendRovoAppPlanReviewResult/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /acceptRovoAppPlanReview/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /submitRovoAppPlanApproval/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /restartRovoAppPlanningSession/u);

	assert.match(
		CLARIFICATION_PLAN_ACTIONS_SOURCE,
		/export function useRovoAppClarificationPlanActions/u,
	);
	assert.match(CLARIFICATION_PLAN_ACTIONS_SOURCE, /submitRovoAppClarificationContinuation/u);
	assert.match(CLARIFICATION_PLAN_ACTIONS_SOURCE, /sendRovoAppPlanReviewResult/u);
	assert.match(CLARIFICATION_PLAN_ACTIONS_SOURCE, /acceptRovoAppPlanReview/u);
	assert.match(CLARIFICATION_PLAN_ACTIONS_SOURCE, /submitRovoAppPlanApproval/u);
	assert.match(CLARIFICATION_PLAN_ACTIONS_SOURCE, /restartRovoAppPlanningSession/u);
});
