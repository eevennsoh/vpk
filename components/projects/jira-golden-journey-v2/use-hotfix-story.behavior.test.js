const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const PR = "https://github.com/acme/storefront/pull/1847";
const MOTION_REACT_PATH = require.resolve("motion/react");

// The probe prints what the controller exposes and offers every action as a button.
function probeSource() {
	return `import { useJiraAgentsStory } from "@/components/projects/jira-golden-journey-v2/use-hotfix-story";
	import { createJiraAgentsBoardColumns, getJiraAgentsStoryColumn } from "@/components/projects/jira-golden-journey-v2/data/hotfix-story";
	const CHAPTERS = ["intake", "plan", "build", "review", "fix", "approve", "release"];
	export default function StoryProbe({ active = true }) {
		const story = useJiraAgentsStory(active);
		const approved = story.pullRequestApprovalStates["${PR}"] ?? "none";
		return <div>
			<p data-probe="state">{[story.chapter, "rev" + story.chapterRevision, story.descriptionSkillPhase, String(story.descriptionImproved), story.orchestrationStep, story.buildStep, story.reviewStep, story.fixStep, approved, "board:" + getJiraAgentsStoryColumn(story.boardColumns), "sections:" + story.sections.length].join("|")}</p>
			<p data-probe="launch">{story.launchId}</p>
			{CHAPTERS.map((chapter) => <button key={chapter} type="button" onClick={() => story.selectChapter(chapter)}>{"Open " + chapter}</button>)}
			<button type="button" onClick={story.resetCurrentChapter}>Reset chapter</button>
			<button type="button" onClick={story.invokeDescriptionSkill}>Invoke skill</button>
			<button type="button" onClick={story.applyDescriptionSuggestion}>Apply suggestion</button>
			<button type="button" onClick={story.dismissDescriptionSuggestion}>Dismiss suggestion</button>
			<button type="button" onClick={story.startOrchestration}>Start orchestration</button>
			<button type="button" onClick={() => story.approvePullRequest("${PR}")}>Approve PR</button>
			<button type="button" onClick={() => story.fixPullRequestCheck("${PR}", "claude-code")}>Fix with Claude</button>
			<button type="button" onClick={() => story.fixPullRequestCheck("https://example.com/other")}>Fix other PR</button>
			<button type="button" onClick={() => story.updateBoardColumns(createJiraAgentsBoardColumns("release", story.boardColumns))}>Drag story to Done</button>
			<button type="button" onClick={() => story.updateBoardColumns(createJiraAgentsBoardColumns("plan", story.boardColumns))}>Drag story to In progress</button>
			<button type="button" onClick={() => story.updateBoardColumns(story.boardColumns.map((column) => ({ ...column })))}>Drag another card</button>
		</div>;
	}`;
}

const timersEnabled = new WeakSet();

async function renderStory(context, { reducedMotion = false } = {}) {
	if (!timersEnabled.has(context)) {
		timersEnabled.add(context);
		context.mock.timers.enable({ apis: ["setTimeout"] });
	}
	const view = await renderComponent({
		mocks: {
			// The real Motion API, with only the reduced-motion preference fixed for the test.
			"motion/react": `export * from ${JSON.stringify(MOTION_REACT_PATH)};
				export function useReducedMotion() { return ${reducedMotion}; }`,
		},
		source: probeSource(),
	});
	const read = () => view.container.querySelector("[data-probe=state]").textContent;
	const launch = () => Number(view.container.querySelector("[data-probe=launch]").textContent);
	const press = (name) => view.click(view.getByRole("button", { name }));
	return { launch, press, read, view };
}

const field = (story, index) => story.read().split("|")[index];
const CHAPTER = 0;
const REVISION = 1;
const DESCRIPTION = 2;
const IMPROVED = 3;
const ORCHESTRATION = 4;
const BUILD = 5;
const REVIEW = 6;
const FIX = 7;
const APPROVED = 8;
const BOARD = 9;

async function advance(context, ms) {
	let elapsed = 0;
	do {
		const slice = Math.min(100, ms - elapsed);
		await React.act(async () => {
			context.mock.timers.tick(slice);
		});
		elapsed += slice;
	} while (elapsed < ms);
}

test("the story opens on intake with every other step at rest", async (context) => {
	const story = await renderStory(context);
	assert.equal(story.read(), "intake|rev0|idle|false|idle|complete|queued|failed|none|board:To do|sections:" + field(story, 10).split(":")[1]);
	assert.equal(story.launch(), 0);
	await advance(context, 60_000);
	assert.equal(story.launch(), 0, "nothing runs on its own in intake");
});

test("the description skill runs for 4 s, then waits for apply or dismiss", async (context) => {
	const story = await renderStory(context);
	await story.press("Invoke skill");
	assert.equal(field(story, DESCRIPTION), "running");
	assert.equal(story.launch(), 1);
	await story.press("Invoke skill");
	assert.equal(story.launch(), 1, "a second invoke while running is ignored");
	await story.press("Apply suggestion");
	assert.equal(field(story, DESCRIPTION), "running", "apply before the suggestion exists is ignored");
	await advance(context, 3_900);
	assert.equal(field(story, DESCRIPTION), "running");
	await advance(context, 100);
	assert.equal(field(story, DESCRIPTION), "awaiting-confirmation");
	assert.equal(story.launch(), 2);
	await story.press("Dismiss suggestion");
	assert.equal(field(story, DESCRIPTION), "dismissed");
	await story.press("Start orchestration");
	assert.equal(field(story, CHAPTER), "intake", "orchestration needs the improved description");
	await story.press("Invoke skill");
	await advance(context, 4_000);
	await story.press("Apply suggestion");
	assert.equal(field(story, DESCRIPTION), "applied");
	assert.equal(field(story, IMPROVED), "true");
	assert.equal(story.launch(), 6);
	await story.press("Invoke skill");
	assert.equal(story.launch(), 6, "an applied description cannot run again");
});

test("starting orchestration moves to plan and reveals each step on its delay, then rests", async (context) => {
	const story = await renderStory(context);
	await story.press("Invoke skill");
	await advance(context, 4_000);
	await story.press("Apply suggestion");
	await story.press("Start orchestration");
	assert.equal(field(story, CHAPTER), "plan");
	assert.equal(field(story, REVISION), "rev0");
	assert.equal(field(story, ORCHESTRATION), "agents-working");
	assert.equal(field(story, DESCRIPTION), "applied");
	assert.equal(field(story, BOARD), "board:In progress");
	const steps = [[1_500, "comment"], [1_200, "reaction-1"], [1_000, "reaction-2"], [3_500, "lead"], [1_800, "consult"], [1_500, "complete"]];
	for (const [ms, step] of steps) {
		await advance(context, ms - 100);
		assert.notEqual(field(story, ORCHESTRATION), step);
		await advance(context, 100);
		assert.equal(field(story, ORCHESTRATION), step);
	}
	const launched = story.launch();
	await advance(context, 60_000);
	assert.equal(field(story, CHAPTER), "plan", "plan does not move to build on its own");
	assert.equal(story.launch(), launched);
});

test("orchestration and build keep their timing under reduced motion", async (context) => {
	const story = await renderStory(context, { reducedMotion: true });
	await story.press("Open plan");
	assert.equal(field(story, ORCHESTRATION), "agents-working");
	await advance(context, 1_500);
	assert.equal(field(story, ORCHESTRATION), "comment");
	await story.press("Open build");
	assert.equal(field(story, BUILD), "ready");
	await advance(context, 2_500);
	assert.equal(field(story, BUILD), "implementing");
});

test("selecting a chapter resets every step; reselecting bumps the revision", async (context) => {
	const story = await renderStory(context);
	await story.press("Open build");
	assert.equal(story.read().split("|").slice(0, 10).join("|"), "build|rev0|applied|true|idle|ready|queued|failed|none|board:In progress");
	assert.equal(story.launch(), 1);
	await advance(context, 2_500);
	assert.equal(field(story, BUILD), "implementing");
	await story.press("Reset chapter");
	assert.equal(field(story, REVISION), "rev1");
	assert.equal(field(story, BUILD), "ready");
	await story.press("Open build");
	assert.equal(field(story, REVISION), "rev2");
	await advance(context, 2_200);
	assert.equal(field(story, BUILD), "ready", "re-selecting build while ready keeps the running hold");
	await advance(context, 300);
	assert.equal(field(story, BUILD), "implementing");
	await advance(context, 2_200 + 2_400);
	assert.equal(field(story, BUILD), "complete");
	await story.press("Open approve");
	assert.equal(story.read().split("|").slice(0, 10).join("|"), "approve|rev2|applied|true|idle|complete|queued|failed|approved|board:In review");
	await story.press("Open intake");
	assert.equal(story.read().split("|").slice(0, 10).join("|"), "intake|rev2|idle|false|idle|complete|queued|failed|none|board:To do");
});

test("review CI stages queued → running → unit-passed → settling → failed", async (context) => {
	const story = await renderStory(context);
	await story.press("Open review");
	assert.equal(field(story, REVIEW), "queued");
	for (const [ms, step] of [[1_200, "running"], [1_500, "unit-passed"], [1_300, "settling"], [1_600, "failed"]]) {
		await advance(context, ms);
		assert.equal(field(story, REVIEW), step);
	}
	assert.equal(story.launch(), 5);
	await story.press("Open release");
	assert.equal(field(story, REVIEW), "queued");
});

test("review under reduced motion lands on failed at once", async (context) => {
	const story = await renderStory(context, { reducedMotion: true });
	await story.press("Open review");
	assert.equal(field(story, REVIEW), "failed");
	assert.equal(story.launch(), 2, "one launch for the chapter, one for the jump");
	await advance(context, 60_000);
	assert.equal(story.launch(), 2);
});

test("fix waits for a fix on the story PR, repairs for 8 s, then goes green", async (context) => {
	const story = await renderStory(context);
	await story.press("Fix with Claude");
	assert.equal(field(story, FIX), "failed", "fix outside the fix chapter is ignored");
	await story.press("Open fix");
	await story.press("Fix other PR");
	assert.equal(field(story, FIX), "failed", "a fix on another PR is ignored");
	await story.press("Fix with Claude");
	assert.equal(field(story, FIX), "repairing");
	await story.press("Fix with Claude");
	assert.equal(story.launch(), 2, "a second fix while repairing is ignored");
	await advance(context, 7_900);
	assert.equal(field(story, FIX), "repairing");
	await advance(context, 100);
	assert.equal(field(story, FIX), "complete");
});

test("fix under reduced motion goes straight to green", async (context) => {
	const story = await renderStory(context, { reducedMotion: true });
	await story.press("Open fix");
	await story.press("Fix with Claude");
	assert.equal(field(story, FIX), "complete");
	assert.equal(story.launch(), 2);
});

test("approve lands already approved, so approving again changes nothing", async (context) => {
	const story = await renderStory(context);
	await story.press("Approve PR");
	assert.equal(story.launch(), 0, "approve outside the approve chapter is ignored");
	await story.press("Open approve");
	assert.equal(field(story, APPROVED), "approved");
	await story.press("Approve PR");
	assert.equal(story.launch(), 1);
});

test("dragging the story card on the board follows it to that chapter", async (context) => {
	const story = await renderStory(context);
	await story.press("Drag another card");
	assert.equal(field(story, CHAPTER), "intake");
	assert.equal(story.launch(), 0, "a board change that keeps the chapter only moves cards");
	await story.press("Drag story to In progress");
	assert.equal(story.read().split("|").slice(0, 10).join("|"), "build|rev0|applied|true|idle|ready|queued|failed|none|board:In progress");
	assert.equal(story.launch(), 1);
	await story.press("Drag story to Done");
	assert.equal(field(story, CHAPTER), "release");
	assert.equal(field(story, BOARD), "board:Done");
	assert.equal(field(story, REVISION), "rev0", "a board move does not bump the revision");
});

test("timers pause while the story is inactive and resume from a fresh hold", async (context) => {
	const story = await renderStory(context);
	await story.press("Open review");
	await advance(context, 1_000);
	await story.view.rerender({ active: false });
	await advance(context, 60_000);
	assert.equal(field(story, REVIEW), "queued");
	await story.view.rerender({ active: true });
	await advance(context, 1_100);
	assert.equal(field(story, REVIEW), "queued");
	await advance(context, 100);
	assert.equal(field(story, REVIEW), "running");
});

test("unmounting mid-sequence leaves no timer behind", async (context) => {
	const story = await renderStory(context);
	await story.press("Open plan");
	await story.view.unmount();
	await advance(context, 60_000);
	assert.equal(story.view.container.textContent, "");
});
