// The experimental work item's session clock and its Activity pickers: a launched session only
// advances while the surface is open, the seeded running demo stays frozen, and the skill and agent
// pickers offer the work-item options under the space's pinned defaults.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const React = require("react");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SESSIONS = `
import { JiraWorkItemProvider, useJiraWorkItemActions, useJiraWorkItemState } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { RFP_101_WORK_ITEM } from "@/components/projects/jira/data/rfp-work-items";

function Clock() {
	const state = useJiraWorkItemState();
	const actions = useJiraWorkItemActions();
	return (
		<>
			<button type="button" onClick={() => actions.launchSession({ id: "readiness-checker", name: "Readiness Checker" }, "Check readiness")}>Launch</button>
			<pre>{JSON.stringify(state.sessions.map((session) => ({ elapsed: session.stepElapsedMs, id: session.id, progress: session.progress, status: session.status, step: session.scriptCursor })))}</pre>
		</>
	);
}

export default function Probe({ active, preset }) {
	return <JiraWorkItemProvider active={active} initialPreset={preset} workItem={RFP_101_WORK_ITEM}><Clock /></JiraWorkItemProvider>;
}
`;

function sessions(view) {
	return JSON.parse(view.container.querySelector("pre").textContent);
}

async function advance(context, ms) {
	for (let elapsed = 0; elapsed < ms; elapsed += 100) {
		await React.act(async () => {
			context.mock.timers.tick(100);
		});
	}
}

test("a launched session advances only while the work item surface is open", async (context) => {
	context.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
	const view = await renderComponent({ props: { active: false, preset: "empty" }, source: SESSIONS });
	await view.click(view.getByRole("button", { name: "Launch" }));
	const [launched] = sessions(view);
	assert.equal(launched.status, "running");

	await advance(context, 2_000);
	assert.deepEqual(sessions(view)[0], launched, "a closed surface keeps the session pristine");

	await view.rerender({ active: true, preset: "empty" });
	await advance(context, 2_000);
	const [opened] = sessions(view);
	assert.equal(opened.elapsed !== launched.elapsed || opened.step !== launched.step || opened.progress !== launched.progress, true, "an open surface ticks the session");
	await view.unmount();
});

test("the seeded running demo stays frozen even while open", async (context) => {
	context.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
	const view = await renderComponent({ props: { active: true, preset: "running" }, source: SESSIONS });
	const before = sessions(view);
	assert.equal(before.some((session) => session.status === "running"), true);
	await advance(context, 2_000);
	assert.deepEqual(sessions(view), before);
	await view.unmount();
});

const OPTIONS = `
import { DEFAULT_PINNED_SPACE_AGENT_IDS, DEFAULT_PINNED_WORK_ITEM_SKILL_IDS, WORK_ITEM_PINNED_ITEMS_LABEL, WORK_ITEM_SKILLS } from "@/components/blocks/jira-work-item/lib/work-item-picker-options";
export default function Probe() {
	return <pre>{JSON.stringify({ agents: DEFAULT_PINNED_SPACE_AGENT_IDS, label: WORK_ITEM_PINNED_ITEMS_LABEL, pinnedSkills: DEFAULT_PINNED_WORK_ITEM_SKILL_IDS, skills: WORK_ITEM_SKILLS.map((skill) => ({ collectionId: skill.collectionId, name: skill.name, source: skill.source })) })}</pre>;
}
`;

test("the work-item picker options pin space defaults over varied work-item skills", async () => {
	const view = await renderComponent({ source: OPTIONS });
	const options = JSON.parse(view.container.querySelector("pre").textContent);
	assert.equal(options.label, "Pinned by space");
	assert.deepEqual(options.pinnedSkills, ["summarize-comments", "improve-description"]);
	assert.deepEqual(options.agents, ["rfp-drafting-agent", "readiness-checker"]);
	const names = options.skills.map((skill) => skill.name);
	for (const name of ["Summarize work item", "Summarize comments", "Improve description", "Suggest child work items", "Link similar work items"]) {
		assert.equal(names.includes(name), true, name);
	}
	assert.equal(new Set(options.skills.map((skill) => skill.collectionId)).size >= 4, true, "skills span at least four Skill Directory collections");
	assert.equal(options.skills.some((skill) => skill.source === "platform"), true);
	await view.unmount();
});

const PILLS = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { JiraWorkItemProvider } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { ActivityComposerAgentContextPill } from "@/components/blocks/jira-work-item/experimental/components/activity-composer-agent-context-pill";
import { ActivityComposerSkillContextPill } from "@/components/blocks/jira-work-item/experimental/components/activity-composer-skill-context-pill";
import { RFP_101_WORK_ITEM } from "@/components/projects/jira/data/rfp-work-items";
export default function Probe() {
	return (
		<ThemeWrapper>
			<JiraWorkItemProvider initialPreset="empty" workItem={RFP_101_WORK_ITEM}>
				<ActivityComposerAgentContextPill />
				<ActivityComposerSkillContextPill />
			</JiraWorkItemProvider>
		</ThemeWrapper>
	);
}
`;

for (const [trigger, expected] of [["Use skills", ["Summarize comments", "Improve description"]], ["Assign agents", []]]) {
	test(`the Activity ${trigger} picker lists its options under "Pinned by space"`, async () => {
		const view = await renderComponent({ source: PILLS });
		await view.click(view.getByRole("button", { name: trigger }));
		const text = document.body.textContent;
		assert.equal(text.includes("Pinned by space"), true);
		for (const name of expected) {
			assert.equal(text.includes(name), true, name);
		}
		await view.unmount();
	});
}
