"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { Gallery, type GalleryItem } from "@/components/blocks/gallery";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { PULSE_PRESENTATION_MEMBER_ID } from "@/components/blocks/jira-kanban/experimental/lib/pulse-roster-filter";
import {
	EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
	markTimelineViewed,
} from "@/components/blocks/jira-kanban/experimental/lib/timeline-activity";
import ExperimentalJiraKanbanPage, {
	type ExperimentalJiraKanbanPageHandle,
} from "@/components/blocks/jira-kanban/experimental/page";
import { PULSE_TIMELINE } from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-timeline";
import type {
	PulseLooseWork,
	PulseWorkItem,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { ExperimentalV3JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item";
import { JGP_CHAT_AGENT_PROFILES } from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { useTerminalDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-terminal-demo";

import { toBoardInsightsNudgeConfig } from "./board-insights-nudge-config";
import { JIRA_GOLDEN_JOURNEY_V3_GALLERY_ITEMS } from "./data/gallery-items";
import {
	createJiraGoldenJourneyV3Pay101BuildState,
	createJiraGoldenJourneyV3PayBoardColumns,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_SESSION_ID,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_UNCAPTURED_SESSION_ID,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_WORK_ITEM,
	JIRA_GOLDEN_JOURNEY_V3_PAY_BOARD_AGENTS,
	JIRA_GOLDEN_JOURNEY_V3_PAY_COMPOSER_AGENTS,
	JIRA_GOLDEN_JOURNEY_V3_PAY_HEADER_ASSIGNEES,
	JIRA_GOLDEN_JOURNEY_V3_PAY_STATUS_PHASES,
	type JiraGoldenJourneyV3PresentationChapter,
} from "./data/presentation-story";
import {
	JIRA_GOLDEN_JOURNEY_V3_RESUME_PROMPT,
	JIRA_GOLDEN_JOURNEY_V3_TERMINAL_STEP_COUNT,
	JIRA_GOLDEN_JOURNEY_V3_TERMINAL_STORY,
} from "./data/terminal-story";
import {
	JiraGoldenJourneyV3CompactStoryControls,
	JiraGoldenJourneyV3StoryControls,
} from "./story-controls";
import { JiraGoldenJourneyV3TerminalStory } from "./terminal-story";

const PAY_101_ISSUE_KEY = "PAY-101";
/** Opening Insights selects Venn, the same face the header treats as selected. */
const INSIGHTS_DEFAULT_ASSIGNEE_IDS: readonly string[] = [PULSE_PRESENTATION_MEMBER_ID];

function JiraGoldenJourneyV3TrackLearnStage({
	boardColumns,
	boardRef,
	chapter,
	onBoardColumnsChange,
	onCardAgentActivityViewChat,
	onChapterChange,
	onModeChange,
	onResumeLooseWork,
	onTimelineLastViewedAtChange,
	timelineLastViewedAt,
}: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	boardRef: React.Ref<ExperimentalJiraKanbanPageHandle>;
	chapter: "learn" | "track";
	onBoardColumnsChange: (columns: readonly JiraKanbanColumnData[]) => void;
	onCardAgentActivityViewChat: (
		activity: JiraIssueAgentActivity,
		card: JiraKanbanCardData,
	) => void;
	onChapterChange: (chapter: JiraGoldenJourneyV3PresentationChapter) => void;
	onModeChange: (mode: "board" | "pulse") => void;
	onResumeLooseWork: (item: PulseLooseWork) => void;
	onTimelineLastViewedAtChange: (lastViewedAt: string) => void;
	timelineLastViewedAt: string | null;
}>): React.ReactElement {
	const openBuild = useCallback((workItem: PulseWorkItem | JiraKanbanCardData) => {
		if (("key" in workItem ? workItem.key : workItem.code) === PAY_101_ISSUE_KEY) {
			onChapterChange("build");
		}
	}, [onChapterChange]);

	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 flex-col overflow-hidden pt-4 [&>div]:h-full [&>div]:min-h-0">
			<ExperimentalJiraKanbanPage
				agents={JIRA_GOLDEN_JOURNEY_V3_PAY_BOARD_AGENTS}
				ariaLabel="Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."
				boardColumns={boardColumns}
				headerAssignees={JIRA_GOLDEN_JOURNEY_V3_PAY_HEADER_ASSIGNEES}
				insightsDefaultAssigneeIds={INSIGHTS_DEFAULT_ASSIGNEE_IDS}
				isInsightsWorkItemInteractive={(workItem) => workItem.key === PAY_101_ISSUE_KEY}
				isLooseWorkResumable={(item) => item.id === JIRA_GOLDEN_JOURNEY_V3_PAY_101_UNCAPTURED_SESSION_ID}
				mode={chapter === "learn" ? "pulse" : "board"}
				onBoardColumnsChange={onBoardColumnsChange}
				onCardAgentActivityViewChat={onCardAgentActivityViewChat}
				onCardClick={openBuild}
				onInsightsWorkItemClick={openBuild}
				onModeChange={onModeChange}
				onResumeLooseWork={onResumeLooseWork}
				onTimelineLastViewedAtChange={onTimelineLastViewedAtChange}
				ref={boardRef}
				timelineLastViewedAt={timelineLastViewedAt}
			/>
		</div>
	);
}

function JiraGoldenJourneyV3BuildStage({
	revision,
}: Readonly<{ revision: number }>): React.ReactElement {
	const initialState = useMemo(() => createJiraGoldenJourneyV3Pay101BuildState(), []);

	return (
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 items-start justify-center overflow-hidden px-8 pt-4 pb-4">
			<ExperimentalV3JiraWorkItem
				activitySessionThread={{
					parentSessionId: JIRA_GOLDEN_JOURNEY_V3_PAY_101_SESSION_ID,
					childSessionIds: [],
					visibleSessionIds: [JIRA_GOLDEN_JOURNEY_V3_PAY_101_SESSION_ID],
					autoScroll: false,
					defaultRepliesExpanded: false,
				}}
				composerAgents={JIRA_GOLDEN_JOURNEY_V3_PAY_COMPOSER_AGENTS}
				composerDelivery="broadcast-active-agents"
				initialPreset={initialState.preset}
				initialState={initialState}
				initialStateRevision={revision}
				preserveActiveSessionOnHydration
				inlineSurface="card-fill"
				presentation="inline"
				stageKey={`build:${revision}`}
				statusPhases={JIRA_GOLDEN_JOURNEY_V3_PAY_STATUS_PHASES}
				workItem={JIRA_GOLDEN_JOURNEY_V3_PAY_101_WORK_ITEM}
			/>
		</div>
	);
}

export default function JiraGoldenJourneyV3Page(): React.ReactElement {
	return (
		<RovoChatProvider agentProfiles={JGP_CHAT_AGENT_PROFILES}>
			<JiraGoldenJourneyV3App />
		</RovoChatProvider>
	);
}

function JiraGoldenJourneyV3App(): React.ReactElement {
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useJgpAgentChatDemo();
	const [selectedId, setSelectedId] = useState(JIRA_GOLDEN_JOURNEY_V3_GALLERY_ITEMS[0]?.id ?? "");
	const [chapter, setChapter] = useState<JiraGoldenJourneyV3PresentationChapter>("track");
	const [stageRevision, setStageRevision] = useState(0);
	const [terminalTheme, setTerminalTheme] = useState<"dark" | "light">("dark");
	const [boardColumns, setBoardColumns] = useState(createJiraGoldenJourneyV3PayBoardColumns);
	const [resumePromptCopied, setResumePromptCopied] = useState(false);
	const [resumeAnnouncement, setResumeAnnouncement] = useState("");
	// Board Insights state lives up here rather than in the Track/Learn stage:
	// the nudge that opens it rides on the floating Rovo button, which is
	// portalled to `document.body` from this level, and the stage remounts on
	// every `stageRevision` bump.
	const boardRef = useRef<ExperimentalJiraKanbanPageHandle | null>(null);
	const [timelineLastViewedAt, setTimelineLastViewedAt] = useState<string | null>(
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
	);
	const [insightsDismissed, setInsightsDismissed] = useState(false);
	const isTerminalChapter = chapter === "terminal";
	const isWorkItemStage = chapter === "build";
	const terminalController = useTerminalDemo(
		selectedId === "work-item" && isTerminalChapter,
		{ story: JIRA_GOLDEN_JOURNEY_V3_TERMINAL_STORY },
	);
	const terminalStep = Math.min(
		terminalController.state.beatIndex + 2,
		JIRA_GOLDEN_JOURNEY_V3_TERMINAL_STEP_COUNT,
	);
	const handleChapterChange = useCallback((nextChapter: JiraGoldenJourneyV3PresentationChapter) => {
		if (chapter === nextChapter || (nextChapter === "learn" && chapter !== "learn")) {
			setStageRevision((current) => current + 1);
		}
		// Jumping straight to Learn from the chapter scroller is still a read of
		// the article, so it advances the watermark the same way the board's own
		// toggle does. The board cannot do it for us here: it owns neither half
		// of the pair once the watermark is controlled from this level.
		if (nextChapter === "learn") {
			setTimelineLastViewedAt(markTimelineViewed(PULSE_TIMELINE));
		}
		setChapter(nextChapter);
	}, [chapter]);
	const handleBoardModeChange = useCallback((mode: "board" | "pulse") => {
		setChapter(mode === "pulse" ? "learn" : "track");
	}, []);
	// Not `setChapter("learn")`: opening also advances the unread watermark and
	// applies the roster default, and the board owns those steps. Going through
	// the handle means the toolbar badge cannot stay at 3 over an article being
	// read.
	const handleOpenInsights = useCallback((snapshotId: string | null) => {
		boardRef.current?.openTimeline(snapshotId);
	}, []);
	const handleDismissInsights = useCallback(() => {
		setInsightsDismissed(true);
	}, []);
	// The nudge only makes sense over the board it describes, and its actions run
	// through the mounted board's own open handler, so it is offered on the Track
	// chapter alone.
	//
	// Do not widen this to "wherever the launcher is visible". The launcher also
	// shows on the Terminal chapter, where the board is unmounted and `boardRef`
	// is therefore null — a card offered there would render, promise three
	// insights, and do nothing when clicked. Learn is excluded for the opposite
	// reason: the article is already open.
	const insights = useMemo(() => {
		if (selectedId !== "work-item" || chapter !== "track" || insightsDismissed) {
			return null;
		}
		// `spaceName` is left to the builder's default — the board's own name.
		// Naming a scope here instead ("PAY · Payments SDK v2 migration") puts a
		// place the reader was never in on the card, and ellipsises.
		return toBoardInsightsNudgeConfig(PULSE_TIMELINE.snapshots, timelineLastViewedAt, {
			onDismiss: handleDismissInsights,
			onOpenSnapshot: handleOpenInsights,
		});
	}, [
		chapter,
		handleDismissInsights,
		handleOpenInsights,
		insightsDismissed,
		selectedId,
		timelineLastViewedAt,
	]);
	const resetStory = useCallback(() => {
		setChapter("track");
		setStageRevision((current) => current + 1);
		setBoardColumns(createJiraGoldenJourneyV3PayBoardColumns());
		setResumePromptCopied(false);
		setResumeAnnouncement("");
		setTimelineLastViewedAt(EXPERIMENTAL_BOARD_LAST_VIEWED_AT);
		setInsightsDismissed(false);
	}, []);
	const handleSelectedChange = useCallback((nextSelectedId: string) => {
		resetStory();
		setSelectedId(nextSelectedId);
	}, [resetStory]);
	const handleTerminalThemeCycle = useCallback(() => {
		setTerminalTheme((current) => current === "dark" ? "light" : "dark");
	}, []);
	const handleResumeLooseWork = useCallback(async (item: PulseLooseWork) => {
		if (
			item.kind !== "agent-session"
			|| item.id !== JIRA_GOLDEN_JOURNEY_V3_PAY_101_UNCAPTURED_SESSION_ID
		) return;
		try {
			await navigator.clipboard.writeText(JIRA_GOLDEN_JOURNEY_V3_RESUME_PROMPT);
			setResumePromptCopied(true);
			setResumeAnnouncement("Resume prompt copied. Open Terminal to paste it and restore the local Claude session.");
		} catch {
			setResumePromptCopied(false);
			setResumeAnnouncement("The resume prompt could not be copied. Check clipboard permissions and try again.");
		}
	}, []);
	const handleViewChat = useCallback((activity: JiraIssueAgentActivity, card: JiraKanbanCardData) => {
		openAgentChat({
			agentId: activity.id,
			agentName: activity.name,
			issueKey: card.code,
			issueSummary: card.title,
			intro: activity.message,
			question: activity.question,
		});
	}, [openAgentChat]);
	const renderSelectedItem = useCallback((item: GalleryItem): React.ReactNode => {
		if (item.id !== "work-item") return null;
		if (chapter === "terminal") {
			return (
				<JiraGoldenJourneyV3TerminalStory
					controller={terminalController}
					promptCopied={resumePromptCopied}
					resetKey={stageRevision}
					theme={terminalTheme}
				/>
			);
		}
		if (chapter === "build") {
			return <JiraGoldenJourneyV3BuildStage revision={stageRevision} />;
		}
		return (
			<JiraGoldenJourneyV3TrackLearnStage
				boardColumns={boardColumns}
				boardRef={boardRef}
				chapter={chapter}
				key={`track-learn:${stageRevision}`}
				onBoardColumnsChange={(columns) => setBoardColumns([...columns])}
				onCardAgentActivityViewChat={handleViewChat}
				onChapterChange={handleChapterChange}
				onModeChange={handleBoardModeChange}
				onResumeLooseWork={(looseWork) => void handleResumeLooseWork(looseWork)}
				onTimelineLastViewedAtChange={setTimelineLastViewedAt}
				timelineLastViewedAt={timelineLastViewedAt}
			/>
		);
	}, [
		boardColumns,
		chapter,
		handleBoardModeChange,
		handleChapterChange,
		handleResumeLooseWork,
		handleViewChat,
		resumePromptCopied,
		stageRevision,
		terminalController,
		terminalTheme,
		timelineLastViewedAt,
	]);
	const subtreeThemeProps = isTerminalChapter
		? {
				"data-subtree-theme": "",
				"data-color-mode": terminalTheme,
				"data-theme": `${terminalTheme}:${terminalTheme} spacing:spacing typography:typography shape:shape`,
			}
		: {};

	return (
		<>
			<div
				className="relative h-dvh w-full overflow-hidden bg-surface"
				data-flow-chapter={chapter}
				data-resume-prompt-copied={resumePromptCopied ? "true" : "false"}
				{...subtreeThemeProps}
			>
				<p aria-live="polite" className="sr-only" role="status">{resumeAnnouncement}</p>
				<Gallery
					items={JIRA_GOLDEN_JOURNEY_V3_GALLERY_ITEMS}
					onReset={resetStory}
					title="Jira Golden Journey v3"
					selectedId={selectedId}
					onSelectedChange={handleSelectedChange}
					renderSelectedItem={renderSelectedItem}
					showTopBarBorder={isTerminalChapter}
					theme={isTerminalChapter ? terminalTheme : undefined}
					onThemeCycle={isTerminalChapter ? handleTerminalThemeCycle : undefined}
					topBarCenter={(
						<JiraGoldenJourneyV3StoryControls
							chapter={chapter}
							onChapterChange={handleChapterChange}
							terminalStep={terminalStep}
						/>
					)}
					topBarCenterCompact={(
						<JiraGoldenJourneyV3CompactStoryControls
							chapter={chapter}
							onChapterChange={handleChapterChange}
						/>
					)}
				/>
			</div>
			<JgpRovoOverlay
				chat={isWorkItemStage ? "hidden" : "auto"}
				chatContextBar={chatContextBar}
				externalThinkingMessageId={externalThinkingMessageId}
				insights={insights}
				launcher={isWorkItemStage ? "hidden" : "auto"}
			/>
		</>
	);
}
