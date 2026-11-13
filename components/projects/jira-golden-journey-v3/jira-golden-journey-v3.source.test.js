const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-golden-journey-v3/page.tsx");
const CONTROLS_SOURCE = readProjectFile("components/projects/jira-golden-journey-v3/story-controls.tsx");
const EXPERIMENTAL_PAGE_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/page.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-page-types.ts"),
].join("\n");

test("the route starts and resets at Track in the four-chapter presentation", () => {
	assert.match(
		PAGE_SOURCE,
		/useState<JiraGoldenJourneyV3PresentationChapter>\("track"\)/u,
	);
	assert.match(PAGE_SOURCE, /const resetStory = useCallback\(\(\) => \{\s*setChapter\("track"\)/u);
	assert.match(CONTROLS_SOURCE, /JIRA_GOLDEN_JOURNEY_V3_PRESENTATION_CHAPTERS/u);
	assert.doesNotMatch(CONTROLS_SOURCE, /Review|Fix|Approve|Release/u);
});

test("Track and Learn share one controlled board and Insights surface", () => {
	assert.match(PAGE_SOURCE, /function JiraGoldenJourneyV3TrackLearnStage/u);
	assert.match(PAGE_SOURCE, /mode=\{chapter === "learn" \? "pulse" : "board"\}/u);
	assert.match(PAGE_SOURCE, /insightsDefaultAssigneeIds=\{INSIGHTS_DEFAULT_ASSIGNEE_IDS\}/u);
	assert.match(PAGE_SOURCE, /const INSIGHTS_DEFAULT_ASSIGNEE_IDS: readonly string\[\] = \[PULSE_PRESENTATION_MEMBER_ID\]/u);
	assert.match(PAGE_SOURCE, /const handleBoardModeChange = useCallback/u);
	assert.match(PAGE_SOURCE, /onModeChange=\{handleBoardModeChange\}/u);
	assert.match(PAGE_SOURCE, /key=\{`track-learn:\$\{stageRevision\}`\}/u);
	assert.match(PAGE_SOURCE, /nextChapter === "learn" && chapter !== "learn"/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onModeChange/u);
	// No card is force-opened by the stage: the board owns selection.
	assert.doesNotMatch(PAGE_SOURCE, /activeCardCode=/u);
	assert.match(PAGE_SOURCE, /headerAssignees=\{JIRA_GOLDEN_JOURNEY_V3_PAY_HEADER_ASSIGNEES\}/u);
	assert.match(PAGE_SOURCE, /Track the Payments SDK v2 migration/u);
	assert.match(
		PAGE_SOURCE,
		/import ExperimentalJiraKanbanPage(?:, \{[\s\S]*?\})? from "@\/components\/blocks\/jira-kanban\/experimental\/page"/u,
	);
});

test("PAY-101 connects the board and Insights rail to Build", () => {
	assert.match(PAGE_SOURCE, /const PAY_101_ISSUE_KEY = "PAY-101"/u);
	assert.match(PAGE_SOURCE, /isInsightsWorkItemInteractive=\{\(workItem\) => workItem\.key === PAY_101_ISSUE_KEY\}/u);
	assert.match(PAGE_SOURCE, /onInsightsWorkItemClick=\{openBuild\}/u);
	assert.match(PAGE_SOURCE, /onCardClick=\{openBuild\}/u);
	assert.match(PAGE_SOURCE, /onChapterChange\("build"\)/u);
});

test("Build renders the PAY-101 Jira item with its captured session and no auto-scroll", () => {
	assert.match(PAGE_SOURCE, /createJiraGoldenJourneyV3Pay101BuildState/u);
	assert.match(PAGE_SOURCE, /workItem=\{JIRA_GOLDEN_JOURNEY_V3_PAY_101_WORK_ITEM\}/u);
	assert.match(
		PAGE_SOURCE,
		/parentSessionId: JIRA_GOLDEN_JOURNEY_V3_PAY_101_SESSION_ID[\s\S]*autoScroll: false/u,
	);
	assert.match(PAGE_SOURCE, /<ExperimentalV3JiraWorkItem[\s\S]*presentation="inline"/u);
	assert.match(PAGE_SOURCE, /statusPhases=\{JIRA_GOLDEN_JOURNEY_V3_PAY_STATUS_PHASES\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /\["Review", "In progress", "In review", "To do", "Done"\]/u);
	assert.doesNotMatch(PAGE_SOURCE, /ExperimentalV2JiraWorkItem/u);
});

test("the uncaptured PAY-101 session copies the shared resume prompt without skipping Build", () => {
	assert.match(PAGE_SOURCE, /JIRA_GOLDEN_JOURNEY_V3_PAY_101_UNCAPTURED_SESSION_ID/u);
	assert.match(PAGE_SOURCE, /isLooseWorkResumable=\{\(item\) => item\.id === JIRA_GOLDEN_JOURNEY_V3_PAY_101_UNCAPTURED_SESSION_ID\}/u);
	assert.match(PAGE_SOURCE, /navigator\.clipboard\.writeText\(JIRA_GOLDEN_JOURNEY_V3_RESUME_PROMPT\)/u);
	assert.match(PAGE_SOURCE, /setResumePromptCopied\(true\)/u);
	assert.match(PAGE_SOURCE, /Resume prompt copied\. Open Terminal to paste it/u);
	const resumeHandler = PAGE_SOURCE.match(
		/const handleResumeLooseWork = useCallback\([\s\S]*?\n\t\}, \[\]\);/u,
	)?.[0] ?? "";
	assert.doesNotMatch(resumeHandler, /setChapter\("terminal"\)|handleChapterChange\("terminal"\)/u);
	assert.match(PAGE_SOURCE, /aria-live="polite"[\s\S]*resumeAnnouncement/u);
});

test("Terminal receives the copied-prompt state and route-owned resume story", () => {
	assert.match(PAGE_SOURCE, /story: JIRA_GOLDEN_JOURNEY_V3_TERMINAL_STORY/u);
	assert.match(PAGE_SOURCE, /promptCopied=\{resumePromptCopied\}/u);
	assert.match(PAGE_SOURCE, /data-resume-prompt-copied=\{resumePromptCopied \? "true" : "false"\}/u);
});

test("the responsive header exposes desktop and compact four-chapter controls", () => {
	assert.match(PAGE_SOURCE, /<JiraGoldenJourneyV3StoryControls[\s\S]*terminalStep=\{terminalStep\}/u);
	assert.match(PAGE_SOURCE, /<JiraGoldenJourneyV3CompactStoryControls[\s\S]*chapter=\{chapter\}/u);
	assert.match(CONTROLS_SOURCE, /aria-label="Open a software delivery story chapter"/u);
	assert.match(CONTROLS_SOURCE, /aria-label="Jump to chapter"/u);
	assert.match(CONTROLS_SOURCE, /aria-label="Previous chapter"/u);
	assert.match(CONTROLS_SOURCE, /aria-label="Next chapter"/u);
});

test("only Build suppresses the floating Rovo surface", () => {
	assert.match(PAGE_SOURCE, /const isWorkItemStage = chapter === "build"/u);
	assert.match(PAGE_SOURCE, /chat=\{isWorkItemStage \? "hidden" : "auto"\}/u);
	assert.match(PAGE_SOURCE, /launcher=\{isWorkItemStage \? "hidden" : "auto"\}/u);
	assert.match(PAGE_SOURCE, /useJgpAgentChatDemo\(\)/u);
	assert.match(PAGE_SOURCE, /onCardAgentActivityViewChat=\{handleViewChat\}/u);
	assert.match(PAGE_SOURCE, /openAgentChat\(\{[\s\S]*agentId: activity\.id,[\s\S]*issueKey: card\.code/u);
	assert.match(PAGE_SOURCE, /chatContextBar=\{chatContextBar\}/u);
	assert.match(PAGE_SOURCE, /externalThinkingMessageId=\{externalThinkingMessageId\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onCardAgentActivityViewChat=\{onCardAgentActivityViewChat\}/u);
});

test("the floating launcher carries the board's insights nudge and opens Insights the board's way", () => {
	const overlaySource = readProjectFile(
		"components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay.tsx",
	);
	const rovoOverlay = PAGE_SOURCE.match(/<JgpRovoOverlay[\s\S]*?\/>/u)?.[0] ?? "";

	// The button is portalled to document.body from the route, so the config has
	// to travel through the overlay rather than out of the board.
	assert.match(rovoOverlay, /insights=\{insights\}/u);
	assert.match(overlaySource, /insights\?: FloatingRovoButtonInsightsConfig \| null;/u);
	assert.match(overlaySource, /<FloatingRovoButton[\s\S]*insights=\{insights\}/u);

	// Track only. The launcher also shows on Terminal, where the board is
	// unmounted and the ref is null, and Learn already has the article open.
	assert.match(
		PAGE_SOURCE,
		/if \(selectedId !== "work-item" \|\| chapter !== "track" \|\| insightsDismissed\) \{\s*return null;/u,
	);

	// The config is derived by the shared builder, never assembled inline, so the
	// "count is the total, not rows.length" rule has exactly one owner.
	assert.match(PAGE_SOURCE, /import \{ toBoardInsightsNudgeConfig \} from "\.\/board-insights-nudge-config"/u);
	assert.match(
		PAGE_SOURCE,
		/toBoardInsightsNudgeConfig\(PULSE_TIMELINE\.snapshots, timelineLastViewedAt, \{/u,
	);
	// The card's subline is "Since your last visit to <spaceName>", so it must
	// name the board. Passing the epic line put a scope the reader was never in
	// on the card, and ellipsised at 295px.
	const nudgeCall = PAGE_SOURCE.match(
		/toBoardInsightsNudgeConfig\(PULSE_TIMELINE\.snapshots, timelineLastViewedAt, \{[\s\S]*?\n\t\t\}\);/u,
	)?.[0] ?? "";
	assert.ok(nudgeCall.length > 0);
	assert.doesNotMatch(nudgeCall, /spaceName/u, "the builder's board-name default owns this");
	assert.doesNotMatch(nudgeCall, /projectLabel/u);

	// Opening goes through the board's own handler. A bare mode flip would leave
	// the toolbar badge counting insights the reader is currently looking at.
	assert.match(PAGE_SOURCE, /boardRef\.current\?\.openTimeline\(snapshotId\)/u);
	assert.doesNotMatch(
		PAGE_SOURCE.match(/const handleOpenInsights = useCallback\([\s\S]*?\n\t\}, \[\]\);/u)?.[0] ?? "",
		/setChapter|setTimelineLastViewedAt/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/openTimeline: \(snapshotId: string \| null = null\) => handleOpenTimeline\(snapshotId\)/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const handleOpenTimeline = useCallback\([\s\S]*?markTimelineAsViewed\(\);[\s\S]*?updateMode\("pulse"\);/u,
	);

	// Dismissal collapses the affordance and nothing else — the watermark, and
	// therefore the toolbar badge, is untouched.
	assert.match(
		PAGE_SOURCE,
		/const handleDismissInsights = useCallback\(\(\) => \{\s*setInsightsDismissed\(true\);\s*\}, \[\]\);/u,
	);
	assert.doesNotMatch(
		PAGE_SOURCE.match(/const handleDismissInsights = useCallback\([\s\S]*?\n\t\}, \[\]\);/u)?.[0] ?? "",
		/setTimelineLastViewedAt|markTimelineViewed/u,
	);
});

test("the experimental board accepts controlled mode and watermark without losing its local fallback", () => {
	// Same shape as boardColumns/onBoardColumnsChange, so there is one controlled
	// idiom on this component rather than three.
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const mode = controlledMode \?\? localMode;/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const updateMode = useCallback\([\s\S]*?if \(controlledMode === undefined\) \{\s*setLocalMode\(nextMode\);\s*\}\s*onModeChange\?\.\(nextMode\);/u,
	);
	// `??` cannot be used for the watermark: `null` means "nothing viewed yet",
	// which is a real value rather than an absent prop.
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const timelineLastViewedAt = controlledTimelineLastViewedAt !== undefined\s*\? controlledTimelineLastViewedAt\s*: localTimelineLastViewedAt;/u,
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /initialSnapshotId=\{pulseFocusSnapshotId\}/u);
});

test("the chapter scroller reserves the shared focus-ring gutter", () => {
	const focusRingSource = readProjectFile("components/ui/focus-ring.ts");
	assert.match(focusRingSource, /export const FOCUS_RING_CLIP_GUTTER = "-m-1 p-1"/u);
	assert.match(
		CONTROLS_SOURCE,
		/"scrollbar-none max-w-\[calc\(100vw-12rem\)\] overflow-x-auto",\s*FOCUS_RING_CLIP_GUTTER/u,
	);
});
