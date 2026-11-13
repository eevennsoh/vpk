const assert = require("node:assert/strict");
const test = require("node:test");

const {
	TEMPLATE_BUILD_INITIAL_STATE,
	TEMPLATE_BUILD_STEP_DURATION_MS,
	TEMPLATE_BUILD_STEP_LABELS,
	TEMPLATE_BUILD_TIMERS,
	selectTemplateBuildActiveStep,
	selectTemplateBuildTimerKey,
	templateBuildReducer,
} = require("./template-build-machine.ts");

const OPTIONS = { appIds: ["jira"], connectApps: true };
const LAST = TEMPLATE_BUILD_STEP_LABELS.length - 1;
const building = (step) => ({ phase: "building", step, options: OPTIONS });
const BUILT = { phase: "built", profileId: "p1", onCancel: null };
const ERROR = { phase: "error" };

test("connect → building starts at the first step with the chosen options", () => {
	assert.deepEqual(templateBuildReducer(TEMPLATE_BUILD_INITIAL_STATE, { type: "start", options: OPTIONS }), building(0));
});

test("each elapsed step advances by one until the last", () => {
	for (let step = 0; step < LAST; step++) {
		assert.deepEqual(templateBuildReducer(building(step), { type: "step-elapsed" }), building(step + 1));
	}
});

test("the last step finishes as built with the returned profile and cancel, or as error when the host returns null", () => {
	const onCancel = () => {};
	assert.deepEqual(templateBuildReducer(building(LAST), { type: "build-finished", result: { profileId: "p1" } }), BUILT);
	assert.deepEqual(
		templateBuildReducer(building(LAST), { type: "build-finished", result: { onCancel, profileId: "p2" } }),
		{ phase: "built", profileId: "p2", onCancel },
	);
	assert.deepEqual(templateBuildReducer(building(LAST), { type: "build-finished", result: null }), ERROR);
});

test("start restarts from built, error or mid-build", () => {
	const restarted = { appIds: [], connectApps: false };
	for (const state of [BUILT, ERROR, building(3)]) {
		assert.deepEqual(templateBuildReducer(state, { type: "start", options: restarted }), { phase: "building", step: 0, options: restarted });
	}
});

test("cannot happen: a step or a build result outside its moment returns the same state", () => {
	for (const state of [TEMPLATE_BUILD_INITIAL_STATE, BUILT, ERROR, building(LAST)]) {
		assert.equal(templateBuildReducer(state, { type: "step-elapsed" }), state, `step-elapsed in ${state.phase}`);
	}
	for (const state of [TEMPLATE_BUILD_INITIAL_STATE, BUILT, ERROR, building(0), building(LAST - 1)]) {
		assert.equal(templateBuildReducer(state, { type: "build-finished", result: { profileId: "late" } }), state, `build-finished in ${state.phase}`);
	}
	// `built` always carries a profile: there is no built state to open without one.
	assert.equal(typeof BUILT.profileId, "string");
});

test("timers: every step holds 1.4 s and the last one hands over to the build", () => {
	assert.equal(selectTemplateBuildTimerKey(TEMPLATE_BUILD_INITIAL_STATE), null);
	assert.equal(selectTemplateBuildTimerKey(BUILT), null);
	assert.equal(selectTemplateBuildTimerKey(ERROR), null);
	assert.equal(selectTemplateBuildTimerKey(building(2)), "step-2");
	assert.deepEqual(TEMPLATE_BUILD_TIMERS["step-0"], { next: "step-1", delayMs: TEMPLATE_BUILD_STEP_DURATION_MS });
	assert.deepEqual(TEMPLATE_BUILD_TIMERS[`step-${LAST}`], { next: "finish", delayMs: TEMPLATE_BUILD_STEP_DURATION_MS });
	assert.equal(TEMPLATE_BUILD_TIMERS.finish, undefined, "finish is where the timers rest");
});

test("the tracker's active step follows the phase", () => {
	assert.equal(selectTemplateBuildActiveStep(TEMPLATE_BUILD_INITIAL_STATE), 0);
	assert.equal(selectTemplateBuildActiveStep(building(4)), 4);
	assert.equal(selectTemplateBuildActiveStep(BUILT), LAST);
	assert.equal(selectTemplateBuildActiveStep(ERROR), LAST);
});
