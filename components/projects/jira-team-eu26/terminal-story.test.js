const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadTerminalStoryHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export { foldBeats } from "./components/projects/jira-golden-journeys-v1/lib/terminal-demo-state";
					export {
					getJiraTeamEu26IssueUrl,
					JIRA_TEAM_EU26_RESUME_PROMPT,
					JIRA_TEAM_EU26_TERMINAL_BEATS,
					JIRA_TEAM_EU26_TERMINAL_STEP_COUNT,
					JIRA_TEAM_EU26_TERMINAL_STORY,
				} from "./components/projects/jira-team-eu26/data/terminal-story";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "jira-team-eu26-terminal-story-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

const TERMINAL_COMPONENT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-team-eu26/terminal-story.tsx"),
	"utf8",
);
const PAGE_COMPONENT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-team-eu26/page.tsx"),
	"utf8",
);

test("v5 terminal resumes the uncaptured PAY-101 Claude session in order", async () => {
	const harness = await loadTerminalStoryHarness();
	assert.deepEqual(
		harness.JIRA_TEAM_EU26_TERMINAL_BEATS.map((beat) => beat.id),
		["paste-resume-prompt", "restore-session", "show-generated-artifacts"],
	);
	assert.equal(harness.JIRA_TEAM_EU26_TERMINAL_BEATS[0].trigger, "click");
	assert.equal(harness.JIRA_TEAM_EU26_TERMINAL_STEP_COUNT, 4);
	assert.ok(
		harness.JIRA_TEAM_EU26_TERMINAL_BEATS
			.flatMap((beat) => beat.steps)
			.every((step) => !("pane" in step) || step.pane === "right"),
	);
	assert.ok(
		harness.JIRA_TEAM_EU26_TERMINAL_BEATS
			.flatMap((beat) => beat.steps)
			.every((step) => !["split", "show-dashboard", "board"].includes(step.kind)),
	);

	const allText = harness.JIRA_TEAM_EU26_TERMINAL_BEATS
		.flatMap((beat) => beat.steps)
		.flatMap((step) => {
			if (step.kind === "type" || step.kind === "paste") return [step.text];
			if (step.kind === "output") return step.lines.flatMap((line) => line.map((span) => span.text));
			return [];
		})
		.join("\n");

	const resumeBeat = harness.JIRA_TEAM_EU26_TERMINAL_BEATS[0];
	assert.equal(resumeBeat.steps[0].kind, "paste");
	assert.equal(resumeBeat.steps[0].text, harness.JIRA_TEAM_EU26_RESUME_PROMPT);
	assert.equal(resumeBeat.steps[1].kind, "submit");
	assert.match(
		harness.JIRA_TEAM_EU26_RESUME_PROMPT,
		/^cd \/Users\/venn\/dev\/payments\/\.worktrees\/pay-101-adapter && claude --resume [0-9a-f-]{36}$/u,
	);
	assert.match(allText, /restored local Claude session/u);
	assert.match(allText, /38 messages · Ee Venn Soh · last active Mon 17 Aug 07:48/u);
	assert.match(allText, /We agreed to delete the adapter, not wrap it/u);
	assert.match(allText, /Map v1 call sites/u);
	assert.doesNotMatch(allText, /Call-site inventory across four services/u);
	assert.match(allText, /#1839/u);
	assert.match(allText, /8c2f4e1/u);
	assert.match(allText, /Payments SDK v2 — migration scope/u);
	assert.match(allText, /Lane assignments, humans and agents/u);
	assert.doesNotMatch(allText, /Implement |pnpm|CI started|auto-merge|merged into main/u);
});

test("v5 terminal finishes with restored artifacts and no implementation workflow", async () => {
	const harness = await loadTerminalStoryHarness();
	const { JIRA_TEAM_EU26_TERMINAL_BEATS: beats } = harness;
	const final = harness.foldBeats(beats, beats.length - 1);

	assert.equal(final.finished, true);
	assert.deepEqual(final.items, []);
	assert.equal(final.split, false);
	assert.equal(final.dashboardVisible, false);
	assert.equal(harness.JIRA_TEAM_EU26_TERMINAL_STORY.layout, "claude-only");
	assert.match(
		final.right.transcript.flatMap((line) => line.map((span) => span.text)).join("\n"),
		/Map v1 call sites/u,
	);
	assert.equal(harness.JIRA_TEAM_EU26_TERMINAL_STORY.finishedHint, "PAY-101 context restored · session ready");
	assert.equal(
		harness.getJiraTeamEu26IssueUrl("PAY-101"),
		"https://jira-team-eu26.atlassian.net/browse/PAY-101",
	);
});

test("the retired v5 terminal fixture is no longer mounted by the board-only route", () => {
	assert.match(TERMINAL_COMPONENT_SOURCE, /controller: TerminalDemoController/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /resetKey\?: number \| string/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /promptCopied\?: boolean/u);
	assert.doesNotMatch(TERMINAL_COMPONENT_SOURCE, /onStepChange|onComplete/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /data-story-complete=\{controller\.state\.finished \? "true" : "false"\}/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /PAY-101 session restored\./u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /data-restored-session="PAY-101"/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /data-restored-artifacts=/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /data-prompt-copied=/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /theme\?: "dark" \| "light"/u);
	assert.match(TERMINAL_COMPONENT_SOURCE, /data-color-mode=\{theme\}/u);
	assert.match(
		TERMINAL_COMPONENT_SOURCE,
		/left-1\/2 h-full min-h-0 w-\[100cqw\] -translate-x-1\/2 bg-surface/u,
	);
	assert.doesNotMatch(PAGE_COMPONENT_SOURCE, /useTerminalDemo|JiraTeamEu26TerminalStory/u);
	assert.doesNotMatch(PAGE_COMPONENT_SOURCE, /terminalTheme|data-resume-prompt-copied/u);
});
