const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveTimedTransition } = require("../../hooks/use-timed-transition.ts");
const {
	JIRA_AGENTS_STORY_INITIAL_STATE: INITIAL,
	JIRA_AGENTS_STORY_TIMERS: TIMERS,
	createJiraAgentsStoryStage,
	jiraAgentsStoryReducer: reduce,
	selectJiraAgentsStoryReducedMotion,
	selectJiraAgentsStorySteps,
	selectJiraAgentsStoryTimerKey,
} = require("./hotfix-story-machine.ts");

const CHAPTERS = ["intake", "plan", "build", "review", "fix", "approve", "release"];
const at = (stage, overrides = {}) => ({ ...INITIAL, stage, ...overrides });
const intake = (descriptionSkillPhase) => at({ chapter: "intake", descriptionSkillPhase });
const fix = (fixStep, fixAgentId = null) => at({ chapter: "fix", fixStep, fixAgentId });
const FIX_EVENT = { agentId: "claude-code", isStoryPullRequest: true, reducedMotion: false, type: "fix-pull-request-check" };

test("every chapter enters at its first step", () => {
	assert.deepEqual(CHAPTERS.map((chapter) => selectJiraAgentsStoryTimerKey(createJiraAgentsStoryStage(chapter))), [
		"intake:idle", "plan:agents-working", "build:ready", "review:queued", "fix:failed", null, null,
	]);
});

test("select-chapter resets the stage, bumps launch, and bumps the revision only on reselect", () => {
	const build = reduce(INITIAL, { type: "select-chapter", chapter: "build" });
	assert.deepEqual(build, { ...INITIAL, stage: { chapter: "build", buildStep: "ready" }, launchId: 1 });
	const advanced = reduce(build, { type: "timer-elapsed", next: "build:implementing" });
	const reselected = reduce(advanced, { type: "select-chapter", chapter: "build" });
	assert.deepEqual(reselected, { ...INITIAL, stage: { chapter: "build", buildStep: "ready" }, chapterRevision: 1, launchId: 3 });
});

test("the description skill: idle | dismissed → running → awaiting → applied | dismissed", () => {
	assert.equal(reduce(intake("idle"), { type: "invoke-description-skill" }).stage.descriptionSkillPhase, "running");
	assert.equal(reduce(intake("dismissed"), { type: "invoke-description-skill" }).stage.descriptionSkillPhase, "running");
	assert.equal(reduce(intake("running"), { type: "timer-elapsed", next: "intake:awaiting-confirmation" }).stage.descriptionSkillPhase, "awaiting-confirmation");
	assert.equal(reduce(intake("awaiting-confirmation"), { type: "apply-description-suggestion" }).stage.descriptionSkillPhase, "applied");
	assert.equal(reduce(intake("awaiting-confirmation"), { type: "dismiss-description-suggestion" }).stage.descriptionSkillPhase, "dismissed");
});

test("start-orchestration takes an improved intake to plan", () => {
	assert.deepEqual(reduce(intake("applied"), { type: "start-orchestration" }), { ...INITIAL, stage: { chapter: "plan", orchestrationStep: "agents-working" }, launchId: 1 });
});

test("a fix on the story PR repairs, or under reduced motion lands green at once", () => {
	assert.deepEqual(reduce(fix("failed"), FIX_EVENT).stage, { chapter: "fix", fixStep: "repairing", fixAgentId: "claude-code" });
	assert.deepEqual(reduce(fix("failed"), { ...FIX_EVENT, reducedMotion: true }).stage, { chapter: "fix", fixStep: "complete", fixAgentId: "claude-code" });
	assert.equal(reduce(fix("repairing", "codex"), { type: "timer-elapsed", next: "fix:complete" }).stage.fixAgentId, "codex", "the agent survives the repair");
});

test("a board move into another chapter enters it without a revision bump; within the chapter it only stores columns", () => {
	const columns = [{ cards: [], count: 0, id: "done", title: "Done" }];
	assert.deepEqual(reduce(INITIAL, { type: "board-changed", chapter: "release", columns }), { ...INITIAL, stage: { chapter: "release" }, launchId: 1, boardColumns: columns });
	assert.deepEqual(reduce(INITIAL, { type: "board-changed", chapter: "intake", columns }), { ...INITIAL, boardColumns: columns });
	assert.deepEqual(reduce(INITIAL, { type: "board-changed", chapter: null, columns }), { ...INITIAL, boardColumns: columns });
});

test("timers: each sequence chains to its resting step, and only Review and Fix collapse under reduced motion", () => {
	const restingSteps = ["intake:running", "plan:agents-working", "build:ready", "review:queued", "fix:repairing"]
		.map((key) => resolveTimedTransition(key, TIMERS, true));
	assert.deepEqual(restingSteps.map((plan) => plan.next), ["intake:awaiting-confirmation", "plan:complete", "build:complete", "review:failed", "fix:complete"]);
	assert.deepEqual(CHAPTERS.map((chapter) => selectJiraAgentsStoryReducedMotion(createJiraAgentsStoryStage(chapter), true)), [false, false, false, true, true, false, false]);
	assert.equal(selectJiraAgentsStoryReducedMotion(createJiraAgentsStoryStage("review"), false), false);
});

test("steps outside their chapter read as at rest", () => {
	assert.deepEqual(selectJiraAgentsStorySteps(createJiraAgentsStoryStage("approve")), {
		buildStep: "complete",
		descriptionSkillPhase: "applied",
		fixAgentId: null,
		fixStep: "failed",
		orchestrationStep: "idle",
		pullRequestApproved: true,
		reviewStep: "queued",
	});
	assert.equal(selectJiraAgentsStorySteps(createJiraAgentsStoryStage("intake")).descriptionSkillPhase, "idle");
	assert.equal(selectJiraAgentsStorySteps(createJiraAgentsStoryStage("intake")).pullRequestApproved, false);
});

test("cannot happen: actions outside their chapter or step return the same state", () => {
	const nonIntake = CHAPTERS.filter((chapter) => chapter !== "intake").map((chapter) => at(createJiraAgentsStoryStage(chapter)));
	for (const state of nonIntake) {
		for (const type of ["invoke-description-skill", "apply-description-suggestion", "dismiss-description-suggestion", "start-orchestration"]) {
			assert.equal(reduce(state, { type }), state, `${type} in ${state.stage.chapter}`);
		}
	}
	for (const phase of ["running", "awaiting-confirmation", "applied"]) {
		const state = intake(phase);
		assert.equal(reduce(state, { type: "invoke-description-skill" }), state, `invoke while ${phase}`);
	}
	for (const phase of ["idle", "running", "applied", "dismissed"]) {
		const state = intake(phase);
		assert.equal(reduce(state, { type: "apply-description-suggestion" }), state, `apply while ${phase}`);
		assert.equal(reduce(state, { type: "dismiss-description-suggestion" }), state, `dismiss while ${phase}`);
	}
	for (const phase of ["idle", "running", "awaiting-confirmation", "dismissed"]) {
		const state = intake(phase);
		assert.equal(reduce(state, { type: "start-orchestration" }), state, `start while ${phase}`);
	}
	for (const state of [fix("repairing"), fix("complete"), at(createJiraAgentsStoryStage("review"))]) {
		assert.equal(reduce(state, FIX_EVENT), state, `fix in ${state.stage.chapter}:${state.stage.fixStep ?? ""}`);
	}
	const failed = fix("failed");
	assert.equal(reduce(failed, { ...FIX_EVENT, isStoryPullRequest: false }), failed, "a fix on another PR");
	for (const chapter of CHAPTERS) {
		const state = at(createJiraAgentsStoryStage(chapter));
		assert.equal(reduce(state, { type: "approve-pull-request" }), state, `approve in ${chapter}: Approve lands already approved`);
	}
	const build = at(createJiraAgentsStoryStage("build"));
	assert.equal(reduce(build, { type: "timer-elapsed", next: "review:running" }), build, "a timer from another chapter");
	assert.equal(reduce(build, { type: "timer-elapsed", next: "build:ready" }), build, "a timer for the step already shown");
	assert.equal(selectJiraAgentsStoryTimerKey({ chapter: "approve" }), null, "approve and release have no timers");
});
