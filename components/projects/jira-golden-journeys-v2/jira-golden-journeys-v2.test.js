const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

let storyModulePromise;
function loadStoryModule() {
	if (!storyModulePromise) {
		storyModulePromise = esbuild
			.build({
				entryPoints: [path.join(__dirname, "data/hotfix-story.ts")],
				bundle: true,
				format: "cjs",
				loader: { ".css": "empty" },
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"jira-golden-journeys-v2-hotfix-story-harness.cjs",
			));
	}
	return storyModulePromise;
}

let orchestrationModulePromise;
function loadOrchestrationModule() {
	if (!orchestrationModulePromise) {
		orchestrationModulePromise = esbuild
			.build({
				entryPoints: [path.join(__dirname, "data/orchestration-state.ts")],
				bundle: true,
				format: "cjs",
				loader: { ".css": "empty" },
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"jira-golden-journeys-v2-orchestration-state-harness.cjs",
			));
	}
	return orchestrationModulePromise;
}


test("Jira Golden Journeys v2 composes the seven-stage software delivery story without changing the gallery", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const controlsSource = readProjectFile("components/projects/jira-golden-journeys-v2/story-controls.tsx");
	const controllerSource = readProjectFile("components/projects/jira-golden-journeys-v2/use-hotfix-story.ts");
	const itemsSource = readProjectFile("components/projects/jira-golden-journeys-v2/data/gallery-items.ts");
	const gallerySource = readProjectFile("components/blocks/gallery/components/gallery.tsx");

	assert.match(pageSource, /<JiraAgentsStoryControls controller=\{storyController\} \/>/u);
	assert.match(pageSource, /<ExperimentalV2JiraWorkItem[\s\S]*automationRules=\{JIRA_AGENTS_AUTOMATION_RULES\}[\s\S]*composerAgents=\{JIRA_AGENTS_STORY_COMPOSER_AGENTS\}[\s\S]*composerDelivery="broadcast-active-agents"[\s\S]*composerToolsAfterAdd=\{<JiraAgentsComposerPrivacyToggle \/>\}[\s\S]*initialState=\{controller\.initialState\}[\s\S]*statusPhases=\{JIRA_AGENTS_STATUS_PHASES\}[\s\S]*workItem=\{controller\.workItem\}/u);
	assert.match(pageSource, /onAgentPromptSubmit=\{handleAgentPromptSubmit\}/u);
	assert.match(pageSource, /initialStateRevision=\{controller\.launchId\}/u);
	assert.match(pageSource, /stageKey=\{`\$\{chapter\}:\$\{chapterRevision\}`\}/u);
	assert.doesNotMatch(pageSource, /key=\{controller\.launchId\}/u);
	assert.match(
		pageSource,
		/useEffect\(\(\) => \{[\s\S]*closeChat\(\);[\s\S]*resetChat\(\);[\s\S]*\}, \[chapter, chapterRevision, closeChat, resetChat\]\);/u,
	);
	assert.doesNotMatch(pageSource, /\[chapter, chatSurface,/u);
	assert.match(pageSource, /selectAgent\(agentId\.startsWith\("skill:"\) \? ROVO_AGENT_ID : agentId, \{ preserveCurrentThread: true \}\);[\s\S]*openChat\("floating"\);/u);
	assert.match(pageSource, /onSessionReply=\{handleSessionReply\}/u);
	assert.match(pageSource, /inlineSurface="card-fill"/u);
	assert.match(controlsSource, /JIRA_AGENTS_STORY_CHAPTERS\.map/u);
	assert.match(controlsSource, /aria-label="Open a software delivery story chapter"/u);
	assert.match(controllerSource, /setLaunchId\(\(current\) => current \+ 1\);/u);
	assert.match(controllerSource, /getJiraAgentsStoryChapterForStatus\(storyColumn\)/u);
	const approvePullRequestSource = controllerSource.match(
		/const approvePullRequest = useCallback\([\s\S]*?\}, \[chapter, pullRequestApprovalStates\]\);/u,
	)?.[0] ?? "";
	assert.ok(approvePullRequestSource.length > 0);
	assert.match(
		approvePullRequestSource,
		/setPullRequestApprovalStates\(\(current\) => \(\{ \.\.\.current, \[identity\]: "approved" \}\)\)/u,
	);
	assert.match(approvePullRequestSource, /setLaunchId\(\(current\) => current \+ 1\)/u);
	assert.doesNotMatch(approvePullRequestSource, /setChapterRevision/u);
	assert.match(
		controllerSource,
		/if \(nextChapter === chapter\) \{[\s\S]*setChapterRevision\(\(current\) => current \+ 1\);[\s\S]*\}/u,
	);
	assert.equal((itemsSource.match(/\bid:\s*"/gu) ?? []).length, 1);
	assert.match(itemsSource, /id: "work-item"/u);
	assert.doesNotMatch(itemsSource, /Kanban & List|id: "kanban-list"/u);
	assert.doesNotMatch(itemsSource, /Jira For You|id: "for-you"/u);
	assert.doesNotMatch(pageSource, /KanbanListStage|item\.id === "kanban-list"/u);
	assert.doesNotMatch(pageSource, /ForYouStage|item\.id === "for-you"/u);
	assert.doesNotMatch(pageSource, /WorkItemControls|useWorkItemStageController/u);
	// Single-card jira-golden-journeys-v2 feed relies on shared Gallery collapsing the bottom picker.
	assert.match(gallerySource, /const showCarouselPicker = items\.length >= 2;/u);
	assert.match(gallerySource, /isOpen && showCarouselPicker \?/u);
});

test("submitting the complete @mentioned agent team starts the staged orchestration reveal", async () => {
	const story = await loadStoryModule();
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const controllerSource = readProjectFile("components/projects/jira-golden-journeys-v2/use-hotfix-story.ts");
	const completeTeam = story.JIRA_AGENTS_STORY_COMPOSER_AGENTS.map((agent) => agent.id);

	assert.equal(story.shouldStartJiraAgentsPlan("intake", completeTeam), false);
	assert.equal(story.shouldStartJiraAgentsPlan("intake", completeTeam, true), true);
	assert.equal(story.shouldStartJiraAgentsPlan("intake", completeTeam.slice(0, 1)), false);
	assert.equal(story.shouldStartJiraAgentsPlan("plan", completeTeam, true), false);
	assert.match(pageSource, /shouldStartJiraAgentsPlan\(chapter, agentIds, descriptionImproved\)[\s\S]*startOrchestration\(\)/u);
	assert.doesNotMatch(pageSource, /shouldStartJiraAgentsPlan\(chapter, agentIds, descriptionImproved\)[\s\S]*selectChapter\("plan"\)/u);
	assert.match(
		controllerSource,
		/if \(!active \|\| orchestrationStep === "idle" \|\| orchestrationStep === "complete"\) \{\s*return undefined;\s*\}/u,
	);
	assert.doesNotMatch(
		controllerSource,
		/if \(orchestrationStep === "complete"\) \{\s*selectChapter\("build"\);/u,
	);
	assert.match(controllerSource, /return \(\) => window\.clearTimeout\(timeoutId\);/u);
});

test("the orchestration reveal acknowledges the prompt, then removes reactions after the A2A reply", async () => {
	const orchestration = await loadOrchestrationModule();
	const steps = [
		"agents-working",
		"comment",
		"reaction-1",
		"reaction-2",
		"lead",
		"consult",
		"complete",
	];
	const states = steps.map((step) => orchestration.createJiraAgentsOrchestrationState(step));
	const complete = states.at(-1);
	const completePlanner = complete.sessions.find((session) => session.agentId === "code-planner");
	const completeClaude = complete.sessions.find((session) => session.agentId === "claude-code");

	assert.deepEqual(states.map((state) => state.sessions.length), steps.map(() => 3));
	assert.deepEqual(states.map((state) => state.sessions.filter(
		(session) => session.status !== "completed",
	).length), [2, 2, 2, 2, 2, 1, 1]);
	assert.deepEqual(states.map((state) => {
		const comment = state.comments.find((candidate) => candidate.id === "story-channel-orchestration");
		return comment?.reactions?.[0]?.actorIds.length ?? (comment ? 0 : -1);
	}), [-1, 0, 1, 2, 0, 0, 0]);
	assert.deepEqual(states.map((state) => state.staticEvents.some(
		(event) => event.id === "story-lead-delegated",
	)), [false, false, false, false, true, true, true]);
	// Terminal Plan complete keeps the consult-ready plan snapshot (not Build).
	assert.equal(completePlanner.status, "completed");
	assert.equal(completeClaude.status, "running");
	assert.match(completeClaude.previewText, /confirming the plan handoff before implementation begins in Build/u);
	assert.equal(
		complete.staticEvents.some((event) => event.id === "story-changed-files"),
		false,
	);
	// Once Code Planner's consultation reply is visible, Consult is checked.
	const consult = states[steps.indexOf("consult")];
	const lead = states[steps.indexOf("lead")];
	const leadClaude = lead.sessions.find((session) => session.agentId === "claude-code");
	const consultClaude = consult.sessions.find((session) => session.agentId === "claude-code");
	assert.equal(leadClaude.progressChecklist.filter((item) => item.completed).length, 0);
	assert.equal(consultClaude.progressChecklist.filter((item) => item.completed).length, 1);
	assert.equal(completeClaude.progressChecklist.filter((item) => item.completed).length, 1);
	assert.equal(
		completeClaude.progressChecklist[0]?.label,
		"Consult Code Planner on the secure API and validation contract",
	);
	assert.equal(completeClaude.progressChecklist[0]?.completed, true);
	assert.equal(completeClaude.outputs, undefined);
	assert.equal(completeClaude.imageAttachment, undefined);
});

test("Plan chapter selection starts the staged orchestration and reveals Activity", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const controllerSource = readProjectFile("components/projects/jira-golden-journeys-v2/use-hotfix-story.ts");

	assert.match(
		controllerSource,
		/setOrchestrationStep\(nextChapter === "plan" \? "agents-working" : "idle"\)/u,
	);
	assert.match(
		controllerSource,
		/setBuildStep\(nextChapter === "build" \? "ready" : "complete"\)/u,
	);
	assert.match(
		controllerSource,
		/const BUILD_SEQUENCE = \{[\s\S]*ready: \{ next: "implementing", delayMs: 2_500 \}[\s\S]*implementing: \{ next: "verifying", delayMs: 2_200 \}[\s\S]*verifying: \{ next: "complete", delayMs: 2_400 \}/u,
	);
	assert.match(
		controllerSource,
		/if \(!active \|\| chapter !== "build" \|\| buildStep === "complete"\) return undefined;/u,
	);
	assert.match(
		controllerSource,
		/"agents-working": \{ next: "comment"/u,
	);
	assert.match(
		controllerSource,
		/"reaction-2": \{ next: "lead", delayMs: 3_500 \}/u,
	);
	assert.match(
		controllerSource,
		/lead: \{ next: "consult"/u,
	);
	assert.match(
		pageSource,
		/revealActivityKey=\{\s*controller\.orchestrationStep !== "idle"\s*\?\s*`\$\{controller\.orchestrationStep\}:\$\{controller\.launchId\}`\s*:\s*controller\.chapter === "build" && controller\.buildStep !== "complete"\s*\?\s*`\$\{controller\.buildStep\}:\$\{controller\.launchId\}`\s*:\s*null\s*\}/u,
	);
	assert.match(pageSource, /composerDelivery="broadcast-active-agents"/u);
});

test("Build chapter selection stages ready→implement→verify and reveals Claude Activity", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const controllerSource = readProjectFile("components/projects/jira-golden-journeys-v2/use-hotfix-story.ts");
	const metadataRailContextSource = readProjectFile(
		"components/blocks/jira-work-item/experimental-v2/context-metadata-rail.tsx",
	);

	// Selecting Build starts from Plan-end hold, then stages implement → verify.
	assert.match(
		controllerSource,
		/setBuildStep\(nextChapter === "build" \? "ready" : "complete"\)/u,
	);
	assert.match(
		controllerSource,
		/ready: \{ next: "implementing", delayMs: 2_500 \}/u,
	);
	assert.match(
		controllerSource,
		/if \(!active \|\| chapter !== "build" \|\| buildStep === "complete"\) return undefined;/u,
	);
	// Activity opens for each build step via revealActivityKey (mirrors Plan
	// orchestration) — unless a PR is selected, which suppresses the panel switch.
	assert.match(
		pageSource,
		/controller\.chapter === "build" && controller\.buildStep !== "complete"\s*\?\s*`\$\{controller\.buildStep\}:\$\{controller\.launchId\}`/u,
	);
	assert.match(
		metadataRailContextSource,
		/if \(revealActivityKey != null && revealActivityKey !== "" && !suppressActivityPanelReveal\) \{/u,
	);
	// Build orients on Claude at ready, then reveals the PR-creation snapshot once
	// Open #1847 exists (implementing / verifying).
	assert.match(
		pageSource,
		/revealActivityEntryId=\{\s*controller\.chapter === "build" && controller\.buildStep !== "complete"\s*\?\s*controller\.buildStep === "ready"[\s\S]*?`activity-\$\{JIRA_AGENTS_LEAD_SESSION_ID\}`[\s\S]*?:\s*"story-pr-review"\s*:\s*null\s*\}/u,
	);
	// Build forces the Claude Code lead-thread View (parent + nested Code Planner).
	assert.match(
		pageSource,
		/if \(controller\.chapter === "build"\) \{\s*return \[JIRA_AGENTS_LEAD_SESSION_ID, \.\.\.JIRA_AGENTS_CHILD_SESSION_IDS\];\s*\}/u,
	);
	// Build collapses the Code Planner reply by default; Plan keeps it expanded.
	assert.match(
		pageSource,
		/\.\.\.\(chapter === "build" \? \{ defaultRepliesExpanded: false \} : \{\}\)/u,
	);
	// Plan reveal remains the primary key while orchestration is active.
	assert.match(
		pageSource,
		/controller\.orchestrationStep !== "idle"\s*\?\s*`\$\{controller\.orchestrationStep\}:\$\{controller\.launchId\}`/u,
	);
});

test("Review, Fix, and Approve chapters auto-open PR #1847; Approve lands ready-to-merge", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const controllerSource = readProjectFile("components/projects/jira-golden-journeys-v2/use-hotfix-story.ts");
	const compositionSource = readProjectFile(
		"components/blocks/jira-work-item/experimental-v2/experimental-v2-jira-work-item.tsx",
	);
	const activityComposerSource = readProjectFile(
		"components/blocks/jira-work-item/experimental-v2/components/activity-composer.tsx",
	);
	const checksSource = readProjectFile(
		"components/projects/jira-golden-journeys-v2/data/story-pull-request-checks.ts",
	);

	assert.match(
		pageSource,
		/autoOpenPullRequestIdentity=\{\s*controller\.chapter === "review"\s*\|\| controller\.chapter === "fix"\s*\|\| controller\.chapter === "approve"\s*\?\s*JIRA_AGENTS_PULL_REQUEST_IDENTITY\s*:\s*null\s*\}/u,
	);
	// Approve chapter controller lands ready-to-merge (approvals already satisfied).
	assert.match(
		controllerSource,
		/setPullRequestApprovalStates\(nextChapter === "approve"\s*\?\s*\{\s*\[JIRA_AGENTS_PULL_REQUEST_IDENTITY\]: "approved"\s*\}\s*:\s*\{\}\)/u,
	);
	assert.match(
		pageSource,
		/onPullRequestFix=\{\s*controller\.chapter === "fix" && controller\.fixStep === "failed"\s*\?\s*controller\.fixPullRequestCheck\s*:\s*undefined\s*\}/u,
	);
	assert.match(
		compositionSource,
		/autoOpenPullRequestIdentity[\s\S]*autoOpenedForStageRef[\s\S]*handlePullRequestSelect\(entry\)/u,
	);
	// Fix / Fix all opens PullRequestFix with the demo agent prompt prefilled;
	// story repair runs on that card's submit.
	assert.match(
		compositionSource,
		/handlePullRequestFixOpen[\s\S]*buildPullRequestFixComposerPrompt[\s\S]*setFixComposer\(\{\s*checkName: resolvePullRequestFixCheckName\(checks\),\s*defaultValue,\s*\}\)/u,
	);
	assert.match(
		compositionSource,
		/pullRequestFix=\{activePullRequestFix\}/u,
	);
	assert.match(
		compositionSource,
		/onPullRequestFix=\{handlePullRequestFixOpen\}/u,
	);
	assert.doesNotMatch(
		compositionSource,
		/stageChecks\(|onFailingChecksSubmit/u,
	);
	assert.match(
		activityComposerSource,
		/PullRequestFix/u,
	);
	assert.match(
		activityComposerSource,
		/checkName=\{pullRequestFix\.checkName\}/u,
	);
	assert.match(
		activityComposerSource,
		/defaultValue=\{pullRequestFix\.defaultValue\}/u,
	);
	assert.match(
		activityComposerSource,
		/key=\{`pull-request-fix-\$\{pullRequestFix\.checkName\}`\}/u,
	);
	assert.match(
		controllerSource,
		/queued: \{ next: "running", delayMs: 1_200 \}[\s\S]*running: \{ next: "unit-passed", delayMs: 1_500 \}[\s\S]*"unit-passed": \{ next: "settling", delayMs: 1_300 \}[\s\S]*settling: \{ next: "failed", delayMs: 1_600 \}/u,
	);
	assert.match(
		controllerSource,
		/if \(shouldReduceMotion\) \{\s*setReviewStep\("failed"\);/u,
	);
	assert.match(
		controllerSource,
		/repairing: \{ next: "complete", delayMs: 8_000 \}/u,
	);
	assert.match(
		controllerSource,
		/fixPullRequestCheck = useCallback\(\(\s*identity: string,\s*agentId: PullRequestFixAgentId = DEFAULT_PULL_REQUEST_FIX_AGENT_ID,\s*\) => \{[\s\S]*chapter !== "fix"[\s\S]*fixStep !== "failed"[\s\S]*setFixAgentId\(agentId\)[\s\S]*setFixStep\(shouldReduceMotion \? "complete" : "repairing"\)/u,
	);
	assert.match(checksSource, /export const UNIT_PASSED_PR_CHECKS = \[/u);
	assert.match(checksSource, /export const SETTLING_PR_CHECKS = \[/u);
	assert.match(
		checksSource,
		/UNIT_PASSED_PR_CHECKS = \[[\s\S]*status: "running"[\s\S]*status: "passed"[\s\S]*status: "running"/u,
	);
	assert.match(
		checksSource,
		/SETTLING_PR_CHECKS = \[[\s\S]*status: "running"[\s\S]*status: "passed"[\s\S]*status: "passed"/u,
	);
});

test("the lead activity shows the custom planner and Claude as mention tags", async () => {
	const story = await loadStoryModule();
	const plan = story.createJiraAgentsStoryState("plan");
	const leadActivity = plan.staticEvents.find(
		(event) => event.id === "story-lead-delegated",
	);
	const claudeSession = plan.sessions.find((session) => session.agentId === "claude-code");

	assert.equal(leadActivity.showActor, false);
	assert.equal(leadActivity.showTimestamp, false);
	assert.deepEqual(
		leadActivity.segments.map((segment) => segment.type),
		["agent-mention", "agent-mention", "text"],
	);
	assert.deepEqual(
		leadActivity.segments
			.filter((segment) => segment.type === "agent-mention")
			.map((segment) => segment.text),
		["Claude", "Code Planner"],
	);
	assert.equal(leadActivity.segments.at(-1).text, " Started working");
	assert.equal(leadActivity.segments[0].brandName, "claude");
	assert.equal(claudeSession.agentBrandName, "claude");
	assert.equal(
		story.createJiraAgentsStoryState("plan").comments.find(
			(comment) => comment.id === "story-channel-orchestration",
		).content,
		"@Claude take the lead on implementing guest checkout. Consult @Code Planner on the secure API and validation contract first, then implement and verify the work.",
	);
});

test("Jira Golden Journeys v2 seeds checkout automation rows without changing the shared empty default", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const automationSource = readProjectFile("components/blocks/jira-work-item/experimental-v2/components/automation-tab.tsx");
	const compositionSource = readProjectFile("components/blocks/jira-work-item/experimental-v2/experimental-v2-jira-work-item.tsx");

	assert.match(pageSource, /title: "Reduce storefront checkout abandonment"/u);
	assert.match(pageSource, /title: "Validate guest checkout order totals"/u);
	assert.match(pageSource, /title: "Prevent duplicate payment on retry"/u);
	assert.match(pageSource, /title: "Run guest checkout regression suite"/u);
	assert.match(pageSource, /title: "Run guest checkout regression suite",[\s\S]*lastRunAt: "2m ago"/u);
	assert.deepEqual(
		[...pageSource.matchAll(/iconVariant: "(purple|blue|green)"/gu)].map((match) => match[1]),
		["purple", "purple", "blue", "green"],
	);
	assert.match(compositionSource, /automationRules\?: readonly WorkItemAutomationRule\[\];/u);
	assert.match(
		compositionSource,
		/<MetadataRail[\s\S]*activity=\{\([\s\S]*<ActivityPanel[\s\S]*activitySessionThread=\{activitySessionThread\}[\s\S]*onOpenPullRequest=\{handlePullRequestSelect\}[\s\S]*railChromeEnabled=\{selectedPullRequestEntry === null\}[\s\S]*automationRules=\{automationRules\}[\s\S]*borderless[\s\S]*selectedPullRequestEntry=\{selectedPullRequestEntry\}[\s\S]*\/>/u,
	);
	assert.match(automationSource, /rules = \[\]/u);
});

test("the shared Jira Design workspace accepts route-owned board, list, and detail data", () => {
	const stageSource = readProjectFile("components/projects/jira-golden-journeys-v1/components/for-you-stage.tsx");
	const dataSource = readProjectFile("components/projects/jira-golden-journeys-v1/data/jira-design-work-items.ts");

	assert.match(stageSource, /boardColumns\?: readonly JiraKanbanColumnData\[\];/u);
	assert.match(stageSource, /sections\?: readonly JiraForYouSection\[\];/u);
	assert.match(stageSource, /workItemsByKey\.get\(row\.issueKey\)/u);
	assert.match(stageSource, /workItemsByKey\.get\(card\.code\)/u);
	assert.match(stageSource, /sections=\{sections\}/u);
	assert.match(dataSource, /workItemsByKey: ReadonlyMap<string, JiraForYouItem> = JIRA_DESIGN_WORK_ITEMS_BY_KEY/u);
	assert.match(dataSource, /const item = workItemsByKey\.get\(card\.code\);/u);
});

test("the software delivery chapters preserve the scripted status and agent-working progression", async () => {
	const story = await loadStoryModule();
	const chapters = story.JIRA_AGENTS_STORY_CHAPTERS.map((chapter) => chapter.value);

	assert.deepEqual(chapters, [
		"intake",
		"plan",
		"build",
		"review",
		"fix",
		"approve",
		"release",
	]);
	assert.deepEqual(
		story.JIRA_AGENTS_STORY_COMPOSER_AGENTS.map((agent) => agent.name),
		["Claude", "Code Planner"],
	);
	assert.deepEqual(
		chapters.map((chapter) => story.getJiraAgentsStoryStatus(chapter)),
		["To do", "In progress", "In progress", "In review", "In progress", "In review", "Done"],
	);
	assert.deepEqual(
		chapters.map((chapter) => story.createJiraAgentsStoryState(chapter).sessions.filter(
			(session) => session.status !== "completed",
		).length),
		[0, 2, 1, 1, 1, 1, 0],
	);
	assert.deepEqual(
		chapters.map((chapter) => {
			const comment = story.createJiraAgentsStoryState(chapter).comments.find(
				(candidate) => candidate.id === "story-channel-orchestration",
			);
			return comment?.reactions?.[0]?.actorIds.length ?? 0;
		}),
		[0, 0, 0, 0, 0, 0, 0],
	);
});

test("Intake starts useful but unplanned and Improve description waits for confirmation", async () => {
	const story = await loadStoryModule();
	const intake = story.createJiraAgentsStoryState("intake");
	const runningIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "running" });
	const waitingIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "awaiting-confirmation" });
	const improvedIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "applied" });
	const dismissedIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "dismissed" });
	const rawDescription = story.JIRA_AGENTS_STORY_WORK_ITEM_BASE.description;
	const description = improvedIntake.contextResources.description;
	const suggestedDescription = waitingIntake.sessions[0].messages.find(
		(message) => message.role === "agent" && message.content.includes("Suggested description"),
	)?.content ?? "";

	assert.match(rawDescription, /^Checkout-funnel research/u);
	assert.match(rawDescription, /#### User outcome/u);
	assert.match(rawDescription, /#### What we know/u);
	assert.match(rawDescription, /#### Initial acceptance criteria/u);
	assert.doesNotMatch(rawDescription, /#### Scope|#### Guest checkout flow|```mermaid/u);
	assert.match(description, /^Checkout-funnel research/u);
	assert.match(description, /#### User outcome/u);
	assert.match(description, /#### Scope/u);
	assert.match(description, /#### Guest checkout flow/u);
	assert.match(description, /```mermaid[\s\S]*flowchart TD[\s\S]*Continue as guest\?[\s\S]*```/u);
	assert.match(description, /```\n\n#### Acceptance criteria/u);
	assert.match(description, /#### Acceptance criteria/u);
	assert.doesNotMatch(description, /\*\*Continue as guest\*\*/u);
	assert.match(description, /Declined payments and recoverable validation errors do not clear safe customer input/u);
	assert.doesNotMatch(description, /## Engineering guardrails|## Out of scope/u);
	assert.equal(intake.sessions.length, 0);
	assert.equal(runningIntake.contextResources.description, rawDescription);
	assert.equal(waitingIntake.contextResources.description, rawDescription);
	assert.equal(dismissedIntake.contextResources.description, rawDescription);
	assert.match(suggestedDescription, /\*\*Suggested description\*\*/u);
	assert.match(suggestedDescription, /```mermaid[\s\S]*flowchart TD[\s\S]*```\n\n#### Acceptance criteria/u);
	assert.match(suggestedDescription, /#### Acceptance criteria/u);
	assert.doesNotMatch(suggestedDescription, /#### Proposed guest flow|Mermaid Error/u);
	assert.deepEqual(
		[runningIntake, waitingIntake, improvedIntake, dismissedIntake].map((state) => ({
			activeSessionId: state.activeSessionId,
			status: state.sessions[0]?.status,
			waitingOn: state.sessions[0]?.waitingOn?.kind ?? null,
		})),
		[
			{ activeSessionId: story.JIRA_AGENTS_DESCRIPTION_SKILL_SESSION_ID, status: "running", waitingOn: null },
			{ activeSessionId: story.JIRA_AGENTS_DESCRIPTION_SKILL_SESSION_ID, status: "waiting", waitingOn: "user" },
			{ activeSessionId: story.JIRA_AGENTS_DESCRIPTION_SKILL_SESSION_ID, status: "completed", waitingOn: null },
			{ activeSessionId: story.JIRA_AGENTS_DESCRIPTION_SKILL_SESSION_ID, status: "completed", waitingOn: null },
		],
	);
	assert.deepEqual(
		improvedIntake.sessions.map(({ agentId, status, title }) => ({ agentId, status, title })),
		[{ agentId: "skill:improve-description", status: "completed", title: "Improve description" }],
	);
	assert.equal(intake.metadata.status, "To do");
	assert.equal(intake.metadata.atlassianProject, "storefront-platform");
	assert.equal(intake.metadata.parent, "SHOP-4800");
	assert.deepEqual(story.createJiraAgentsStoryWorkItem("intake").parent, {
		code: "SHOP-4800",
		title: "Reduce storefront checkout abandonment",
	});
	assert.deepEqual(intake.comments[0].threadReplies, [{
		id: "story-channel-intake-maya-reply",
		authorName: "Maya Chen",
		authorAvatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		content: "Agreed. If the email already belongs to an account, let the shopper finish as a guest and offer sign-in or account linking only after the order is confirmed. That keeps this release focused and avoids pulling account recovery into checkout.",
		createdAtMs: Date.UTC(2026, 7, 5, 1, 56),
	}]);
	assert.deepEqual(intake.contextResources.subtasks, []);
	assert.deepEqual(intake.contextResources.linkedItems, []);
});

test("applying Improve description adds the linked work items, subtasks, and matching description references", async () => {
	const story = await loadStoryModule();
	const intake = story.createJiraAgentsStoryState("intake");
	const waitingIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "awaiting-confirmation" });
	const improvedIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "applied" });
	const dismissedIntake = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "dismissed" });
	const description = improvedIntake.contextResources.description;
	const suggestedDescription = waitingIntake.sessions[0].messages.find(
		(message) => message.role === "agent" && message.content.includes("Suggested description"),
	)?.content ?? "";

	// The work item stays unbroken out until the suggestion is confirmed.
	assert.deepEqual(intake.contextResources.subtasks, []);
	assert.deepEqual(intake.contextResources.linkedItems, []);
	assert.deepEqual(waitingIntake.contextResources.subtasks, []);
	assert.deepEqual(waitingIntake.contextResources.linkedItems, []);
	assert.deepEqual(dismissedIntake.contextResources.subtasks, []);
	assert.deepEqual(dismissedIntake.contextResources.linkedItems, []);

	// Confirming it lands the delivery breakdown in the metadata rail.
	assert.deepEqual(
		improvedIntake.contextResources.subtasks.map((subtask) => subtask.key),
		["SHOP-4824", "SHOP-4822", "SHOP-4823"],
	);
	assert.deepEqual(
		improvedIntake.contextResources.linkedItems.map((linkedItem) => linkedItem.key),
		["SHOP-4760"],
	);

	// Every issue the description links must exist in the rail, and every rail
	// row must be reachable from the description — otherwise the narrative and
	// the details panel drift apart.
	const railItems = [
		...improvedIntake.contextResources.subtasks,
		...improvedIntake.contextResources.linkedItems,
	];
	const linkedKeys = [...description.matchAll(/^- \[(SHOP-\d+) (.+?)\]\(#shop-\d+\) — /gmu)];
	assert.deepEqual(linkedKeys.map((match) => match[1]).sort(), railItems.map((item) => item.key).sort());
	for (const [, key, summary] of linkedKeys) {
		const railItem = railItems.find((item) => item.key === key);
		assert.ok(railItem, `${key} is linked from the description but missing from the rail`);
		assert.equal(summary, railItem.summary);
		assert.match(
			description,
			new RegExp(`^- \\[${key} ${summary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\]\\(#${key.toLowerCase()}\\) — `, "mu"),
		);
	}
	// Text-link references use in-page hash hrefs — never a full browse URL.
	assert.doesNotMatch(description, /\]\(https:\/\//u);
	assert.doesNotMatch(description, /storefront-platform\.atlassian\.net/u);

	assert.match(description, /#### Delivery breakdown/u);
	assert.match(description, /#### Related work/u);
	// The chat's suggested output previews the same reference lines before confirm.
	assert.match(suggestedDescription, /#### Delivery breakdown/u);
	assert.match(
		suggestedDescription,
		/^- \[SHOP-4822 Build guest checkout and order-creation API\]\(#shop-4822\) — /mu,
	);
	assert.doesNotMatch(suggestedDescription, /\]\(https:\/\//u);
	// The un-improved description must not promise work the rail cannot show.
	assert.doesNotMatch(story.JIRA_AGENTS_STORY_WORK_ITEM_BASE.description, /#### Delivery breakdown|SHOP-4822/u);
});

test("Improve description confirmation keeps the answered card in the visible transcript", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	// The selected option must render as the shared clarification answer card
	// above Rovo's reply, so the confirmation user message stays visible.
	assert.doesNotMatch(pageSource, /visibility: "hidden"/u);
	assert.match(pageSource, /Done — I added the approved description to SHOP-4821/u);
	assert.match(pageSource, /Understood — I kept the current work item description unchanged/u);
});

test("Jira Golden Journeys v2 side chat mounts a privacy visibility toggle next to Add", () => {
	const pageSource = readProjectFile("components/projects/jira-golden-journeys-v2/page.tsx");
	const toggleSource = readProjectFile("components/projects/jira-golden-journeys-v2/composer-privacy-toggle.tsx");
	const composerSource = readProjectFile("components/projects/sidebar-chat/components/chat-composer.tsx");

	assert.match(pageSource, /composerToolsAfterAdd=\{<JiraAgentsComposerPrivacyToggle \/>\}/u);
	assert.match(toggleSource, /EyeOpenIcon/u);
	assert.match(toggleSource, /EyeOpenStrikethroughIcon/u);
	assert.match(toggleSource, /Private to you/u);
	assert.match(toggleSource, /Visible to space/u);
	assert.match(
		toggleSource,
		/isPrivate \? \(\s*<EyeOpenIcon label="" \/>\s*\) : \(\s*<EyeOpenStrikethroughIcon label="" \/>\s*\)/u,
	);
	assert.match(
		toggleSource,
		/content: isPrivate \? "Private to you" : "Visible to space"/u,
	);
	// Both privacy states are valid — no toggle pressed/selected chrome.
	assert.doesNotMatch(toggleSource, /aria-pressed/u);
	// Shared composer stays a slot — privacy chrome lives only in jira-golden-journeys-v2.
	assert.doesNotMatch(composerSource, /Private to you|Visible to space|EyeOpenStrikethroughIcon/u);
});

test("Jira Golden Journeys v2 addresses authored story activity as Venn", async () => {
	const story = await loadStoryModule();
	const plan = story.createJiraAgentsStoryState("plan");
	const orchestrationComment = plan.comments.find(
		(comment) => comment.id === "story-channel-orchestration",
	);

	assert.equal(orchestrationComment.authorName, "Venn");
	assert.equal(
		plan.sessions.find((session) => session.agentId === "claude-code").messages[0].authorName,
		"Venn",
	);
});

test("child work-item statuses follow the delivery chapters", async () => {
	const story = await loadStoryModule();
	const chapters = story.JIRA_AGENTS_STORY_CHAPTERS.map((chapter) => chapter.value);

	assert.deepEqual(
		chapters.map((chapter) => story.createJiraAgentsStoryState(chapter).contextResources.subtasks.map((item) => item.status)),
		[
			[],
			["done", "todo", "todo"],
			["done", "done", "done"],
			["done", "done", "done"],
			["done", "done", "done"],
			["done", "done", "done"],
			["done", "done", "done"],
		],
	);
	assert.deepEqual(
		story.createJiraAgentsStoryState("build", { buildStep: "ready" })
			.contextResources.subtasks.map((item) => item.status),
		["done", "todo", "todo"],
	);
	assert.deepEqual(
		story.createJiraAgentsStoryState("build", { buildStep: "implementing" })
			.contextResources.subtasks.map((item) => item.status),
		["done", "inprogress", "inprogress"],
	);
});
