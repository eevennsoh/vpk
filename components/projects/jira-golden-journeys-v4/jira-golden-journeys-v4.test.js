const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-golden-journeys-v4/page.tsx");
const LIST_HOOK_SOURCE = readProjectFile(
	"components/projects/jira-golden-journeys-v4/hooks/use-jira-golden-journeys-v4-list.ts",
);
const JIRA_HEADER_SOURCE = readProjectFile("components/projects/jira/components/jira-header.tsx");
const JIRA_TABS_SOURCE = readProjectFile("components/projects/jira/data/tabs.ts");
const USE_JIRA_TABS_SOURCE = readProjectFile("components/projects/jira/hooks/use-jira-tabs.ts");
const EXPERIMENTAL_HEADER_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
);
const EXPERIMENTAL_PAGE_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/page.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-page-types.ts"),
	readProjectFile("components/blocks/jira-kanban/experimental/hooks/use-page-content-model.ts"),
].join("\n");
const EXPERIMENTAL_BOARD_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-jira-kanban.tsx",
);
const EXPERIMENTAL_CARD_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/experimental-jira-kanban-card.tsx",
);
const CREATE_WORK_ITEM_DROP_ZONE_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/components/create-work-item-drop-zone.tsx",
);
const SESSION_DROP_RECEIPT_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/lib/session-drop-receipt.ts",
);
const SESSION_FUSION_OVERLAY_STATE_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/lib/session-fusion-overlay-state.ts",
);
const JIRA_LINKING_DROP_SOURCE = readProjectFile("components/blocks/jira-linking/drop.ts");
const JIRA_LINKING_FLIGHT_SOURCE = readProjectFile(
	"components/blocks/jira-linking/jira-linking-flight.tsx",
);
const JIRA_DROPZONE_SOURCE = readProjectFile("components/blocks/jira-dropzone/jira-dropzone.tsx");
const CREATE_WORK_ITEM_EXCLUSIVE_PROXIMITY_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/lib/create-work-item-exclusive-proximity.ts",
);
const CREATE_WORK_ITEM_EXCLUSIVE_PROXIMITY_CONTEXT_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/components/create-work-item-exclusive-proximity-context.tsx",
);
const INDICATORS_SOURCE = readProjectFile(
	"components/projects/jira-golden-journeys-v4/data/agent-activity-indicators.tsx",
);
const COMPLETED_RUNS_SOURCE = readProjectFile(
	"components/blocks/jira-issue/completed-agent-runs.tsx",
);
const AGENT_ACTIVITY_SOURCE = [
	readProjectFile("components/blocks/jira-issue/agent-activity.tsx"),
	readProjectFile("components/blocks/jira-issue/agent-activity-row-presentation.tsx"),
].join("\n");
const TRANSFER_SOURCE = readProjectFile(
	"components/blocks/jira-issue/agent-session-transfer.tsx",
);

test("the route renders the Payments board directly inside Jira app chrome", () => {
	assert.match(PAGE_SOURCE, /import AppLayout from "@\/components\/projects\/page"/u);
	assert.match(PAGE_SOURCE, /<AppLayout[\s\S]*defaultSidebarOpen=\{true\}[\s\S]*product="jira"/u);
	assert.match(PAGE_SOURCE, /<ExperimentalJiraKanbanPage/u);
	assert.match(PAGE_SOURCE, /createJiraGoldenJourneysV4PayBoardColumns/u);
	assert.match(PAGE_SOURCE, /JIRA_GOLDEN_JOURNEYS_V4_PAY_BOARD_AGENTS/u);
	assert.match(PAGE_SOURCE, /JIRA_GOLDEN_JOURNEYS_V4_PAY_HEADER_ASSIGNEES/u);
	assert.match(PAGE_SOURCE, /overflow-hidden bg-surface \[&>div\]:min-h-0/u);
});

test("the route no longer renders gallery or presentation phases", () => {
	assert.doesNotMatch(PAGE_SOURCE, /Gallery|GalleryItem/u);
	assert.doesNotMatch(PAGE_SOURCE, /StoryControls|PresentationChapter/u);
	assert.doesNotMatch(PAGE_SOURCE, /TrackLearnStage|BuildStage|TerminalStory/u);
	assert.doesNotMatch(PAGE_SOURCE, /onCardClick=|onInsightsWorkItemClick=/u);
});

test("the board disables Insights while keeping card agent chat in the Jira shell", () => {
	assert.match(PAGE_SOURCE, /insightsEnabled=\{false\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /PULSE_|InsightsNudge|boardRef|timelineLastViewedAt/u);
	assert.match(PAGE_SOURCE, /onCardAgentActivityViewChat=\{handleViewChat\}/u);
	assert.match(PAGE_SOURCE, /question: activity\.question,/u);
	assert.match(
		PAGE_SOURCE,
		/agentId: activity\.id\.includes\(":"\)\s*\? activity\.id\.slice\(activity\.id\.lastIndexOf\(":"\) \+ 1\)\s*: activity\.id,/u,
	);
	assert.match(PAGE_SOURCE, /onCardAgentDoneRunView=\{handleViewCompletedRun\}/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onCardAgentDoneRunView\?: JiraKanbanProps\["onCardAgentDoneRunView"\];/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<ExperimentalJiraKanban[\s\S]*onCardAgentDoneRunView=\{onCardAgentDoneRunView\}/u,
	);
	assert.match(PAGE_SOURCE, /openAgentChat\(\{[\s\S]*agentId: activity\.id\.includes\(":"\)[\s\S]*issueKey: card\.code/u);
	assert.match(PAGE_SOURCE, /const handleViewCompletedRun = useCallback\([\s\S]*agentId: run\.agentName\.toLowerCase\(\)\.replace\(\/\\s\+\/g, "-"\),[\s\S]*issueKey: run\.issueKey/u);
	assert.match(PAGE_SOURCE, /<JgpRovoOverlay[\s\S]*externalThinkingMessageId=\{externalThinkingMessageId\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /<JgpRovoOverlay[\s\S]*insights=/u);
});

test("the route imports the Pulse session guard used by its resume callback", () => {
	assert.match(
		PAGE_SOURCE,
		/import \{ isPulseAgentSession, type PulseLooseWork \} from "@\/components\/blocks\/jira-kanban\/experimental\/pulse\/types";/u,
	);
	assert.match(PAGE_SOURCE, /if \(!isPulseAgentSession\(item\)\) return;/u);
});

test("chin-row layout uses Team EU's merged grouping", () => {
	// Team EU groups every active agent into one merged chin. The route owns
	// the choice; the shared board stays agnostic, matching Panel and
	// untracked proximity.
	assert.match(PAGE_SOURCE, /<ExperimentalJiraKanbanPage[\s\S]*agentActivityLayout="merged"/u);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/agentActivityLayout="split"/u,
		"Team EU must not hardcode split; that stacked every agent as its own chin row",
	);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/useDesignVariation|design-variation/u,
		"the shared block must take an agentActivityLayout prop, not read a global variation store",
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /agentActivityLayout\?: JiraIssueAgentActivityLayout;/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<ExperimentalJiraKanban[\s\S]*agentActivityLayout=\{agentActivityLayout\}/u,
	);
	// Every merged chin opens AgentAssignment, including the one-session case,
	// so the interaction does not change when a second session attaches.
	// Attach copy occupying the last chin also suppresses flyout and drag so
	// the slot stays a drop target instead of a session handle.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const isSingleAgentRow = rowGroup\.activities\.length === 1;/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const rowSessionDrag = replaceLastRowWithAttach \? undefined : isSingleAgentRow \? sessionDrag : undefined;/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /sessionDrag=\{rowSessionDrag\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const assignedRowHandle = \(\s*<JiraIssueAgentAssignmentHandle/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /openMode="hover"/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /rowSessionFlyout|JiraSessionFlyoutTrigger/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /ROVO_AGENT_SELECTOR_AGENTS/u);
	assert.match(PAGE_SOURCE, /onCardAssignedAgentIdsChange=\{onAssignedAgentIdsChange\}/u);
});

test("chin-row agent activity indicators use the Team EU renderer", () => {
	// Team EU is the baseline, so working rows keep the block's own spinner.
	// Awaiting-input departs from it: a question circle reads as "blocked on
	// you", which the pixel loader's solo dot did not. The filled glyph lives in
	// icon-lab (>= 7.8.0), not @atlaskit/icon, and carries the information color.
	assert.match(
		INDICATORS_SOURCE,
		/import QuestionCircleFilledIcon from "@atlaskit\/icon-lab\/core\/question-circle-filled";/u,
	);
	assert.doesNotThrow(
		() => require.resolve("@atlaskit/icon-lab/core/question-circle-filled"),
		"icon-lab must export question-circle-filled (7.8.0+); a stale 7.5.0 install breaks the Team EU chin",
	);
	assert.match(INDICATORS_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(
		INDICATORS_SOURCE,
		/renderJiraGoldenJourneysV4AgentActivityIndicator[\s\S]*state === "awaiting-input" \? \(\s*<QuestionCircleFilledIcon color=\{token\("color\.icon\.information"\)\} label="" size="small" \/>\s*\) : \(\s*<Spinner label="" pulse size="default" variant="experimental" \/>\s*\)/u,
	);
	// A finished run gets the filled success status in the ADS success green,
	// pairing with the filled error status a failed run already shows. The
	// block's own fallback dot only said the row had ended.
	assert.match(INDICATORS_SOURCE, /import StatusSuccessIcon from "@atlaskit\/icon\/core\/status-success";/u);
	assert.match(
		INDICATORS_SOURCE,
		/renderJiraGoldenJourneysV4AgentActivityIndicator[\s\S]*if \(state === "finished"\) \{\s*return <StatusSuccessIcon color=\{token\("color\.icon\.success"\)\} label="" size="small" \/>;\s*\}/u,
	);
	assert.doesNotMatch(INDICATORS_SOURCE, /PixelLoader|2000-years-later|DesignVariationId/u);
	assert.doesNotMatch(PAGE_SOURCE, /PixelLoader|useDesignVariation|design-variation/u);
	assert.match(
		PAGE_SOURCE,
		/import \{ renderJiraGoldenJourneysV4AgentActivityIndicator \} from "\.\/data\/agent-activity-indicators";/u,
	);
	assert.match(
		PAGE_SOURCE,
		/<ExperimentalJiraKanbanPage[\s\S]*renderAgentActivityIndicator=\{renderJiraGoldenJourneysV4AgentActivityIndicator\}/u,
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /renderAgentActivityIndicator\?: ExperimentalJiraKanbanProps\["renderAgentActivityIndicator"\];/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<ExperimentalJiraKanban[\s\S]*renderAgentActivityIndicator=\{renderAgentActivityIndicator\}/u);
	assert.match(EXPERIMENTAL_BOARD_SOURCE, /<ExperimentalJiraKanbanCard[\s\S]*renderAgentActivityIndicator=\{renderAgentActivityIndicator\}/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<JiraIssue[\s\S]*renderAgentActivityIndicator=\{renderAgentActivityIndicator\}/u);
	// Team EU's Done-column chin is the merged "N Finished" row, not a split
	// per-run row. That path must call the same finished renderer in the
	// trailing status slot so PAY-101's check sits on the far right, matching
	// working/awaiting-input.
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/const finishedIndicator = !hasFailedRun && renderAgentActivityIndicator\s*\n\s*\? renderAgentActivityIndicator\("finished"\)\s*\n\s*: null;/u,
	);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/hasFailedRun \? \([\s\S]*<StatusErrorIcon[\s\S]*: finishedIndicator \? \(\s*<span[\s\S]*\{finishedIndicator\}/u,
	);
});

test("Team EU keeps only attached agent sessions on status columns", () => {
	// Team EU is "what ships today": Pulse proximity rows leave the status
	// columns so only chin rows attached to a work item remain. Untracked work
	// still lives in its dedicated column/panel. The route owns the default;
	// the shared block stays agnostic, matching Panel.
	assert.match(PAGE_SOURCE, /<ExperimentalJiraKanbanPage[\s\S]*defaultShowUntracked=\{false\}/u);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/useDesignVariation|design-variation/u,
		"the shared block must take a defaultShowUntracked prop, not read a global variation store",
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /defaultShowUntracked\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /defaultShowUntracked = true,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const \[showUntracked, setShowUntracked\] = useState\(defaultShowUntracked\)/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/if \(defaultShowUntracked !== appliedShowUntrackedDefault\) \{\s*setAppliedShowUntrackedDefault\(defaultShowUntracked\);\s*setShowUntracked\(defaultShowUntracked\);\s*\}/u,
	);
});

test("the board reveals compact magnetic create targets that expand and arm during an agent-session drag", () => {
	assert.match(
		PAGE_SOURCE,
		/const createWorkItemDropZoneLabel = "Create new work item";/u,
	);
	assert.doesNotMatch(PAGE_SOURCE, /createWorkItemDropZoneLabel = designVariation/u);
	assert.match(
		PAGE_SOURCE,
		/<ExperimentalJiraKanbanPage[\s\S]*createWorkItemDropZoneLabel=\{createWorkItemDropZoneLabel\}/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/createWorkItemDropZoneLabel\?: ExperimentalJiraKanbanProps\["createWorkItemDropZoneLabel"\];/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<ExperimentalJiraKanban[\s\S]*createWorkItemDropZoneLabel=\{onBoardAgentSessionCreate\s*\? createWorkItemDropZoneLabel\s*: undefined\}/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_BOARD_SOURCE,
		/useDesignVariation|design-variation/u,
		"the shared board must receive route-owned copy through a prop",
	);
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/sessionDragTransaction=\{boardSessionDrag\.transaction\}/u,
	);
	assert.match(
		CREATE_WORK_ITEM_DROP_ZONE_SOURCE,
		/dropZoneLabel \? \([\s\S]*<JiraDropzone[\s\S]*drag=\{drag\}[\s\S]*label=\{dropZoneLabel\}[\s\S]*title=\{title\}/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/const expanded = receiving \|\| proximity !== "outside";/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/expanded \? "h-16 text-sm leading-5" : "h-6 text-xs leading-4"/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/selected\s*\n\t\t\t\t\t\? "border-border-selected bg-bg-selected text-text-selected"\n\t\t\t\t\t: "border-border bg-surface text-text-subtlest"/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/marching \? JIRA_DROPZONE_ANTS_CLASS : null/u,
	);
	assert.doesNotMatch(
		JIRA_DROPZONE_SOURCE,
		/bg-\[var\(--ds-|transparent|bg-transparent/u,
		"create wells must use an opaque semantic surface fill, not a raw token or transparent hole",
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/transition-\[background-color,border-color\] duration-normal ease-out-practical motion-reduce:transition-none/u,
	);
	assert.doesNotMatch(
		JIRA_DROPZONE_SOURCE,
		/transition-property:[^"]*height|transition-\[[^\]]*height/u,
		"create wells must not transition the layout height; only colour is transitional",
	);
	assert.match(
		readProjectFile("components/blocks/jira-kanban/experimental/components/board-column.tsx"),
		/<BoardColumnCreateAction[\s\S]*dropZoneLabel=\{createWorkItemDropZoneLabel\}[\s\S]*sessionDragTransaction=\{sessionDragTransaction\}[\s\S]*title=\{title\}/u,
	);
	assert.match(
		CREATE_WORK_ITEM_EXCLUSIVE_PROXIMITY_SOURCE,
		/export const CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX = 120;/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/import \{ useMagneticProximity \} from "@\/components\/ui-custom\/hooks\/use-magnetic-proximity";/u,
	);
	assert.match(
		CREATE_WORK_ITEM_DROP_ZONE_SOURCE,
		/import \{ useExclusiveCreateWellProximity \} from "\.\/create-work-item-exclusive-proximity-context";/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/const magnet = useMagneticProximity\(proximityRef \?\? targetRef, \{\s*hoverArea: JIRA_DROPZONE_HOVER_AREA_PX,\s*\}\);/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/useMotionValueEvent\(magnet\.proximity, "change", setRawProximity\);/u,
	);
	assert.match(
		CREATE_WORK_ITEM_DROP_ZONE_SOURCE,
		/const isExclusiveWinner = useExclusiveCreateWellProximity\(title, proximityRef\);/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/const proximity = exclusiveWinner \? rawProximity : "outside";/u,
	);
	assert.match(
		CREATE_WORK_ITEM_EXCLUSIVE_PROXIMITY_SOURCE,
		/export function resolveExclusiveProximityWinner\(/u,
	);
	assert.match(
		CREATE_WORK_ITEM_EXCLUSIVE_PROXIMITY_CONTEXT_SOURCE,
		/resolveExclusiveProximityWinner\(/u,
	);
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/<ExclusiveCreateWellProximityProvider>[\s\S]*\{boardColumns\.map\(/u,
	);
	assert.match(
		CREATE_WORK_ITEM_DROP_ZONE_SOURCE,
		/import \{ resolveBoardCreateDropzoneDrag \} from "\.\.\/lib\/board-agent-session-drag";/u,
	);
	assert.match(
		CREATE_WORK_ITEM_DROP_ZONE_SOURCE,
		/const drag: JiraDropzoneDragState = resolveBoardCreateDropzoneDrag\(\s*sessionDragTransaction,\s*title,\s*\);/u,
	);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/<motion\.div[\s\S]*x: pinMagnet \? 0 : magnet\.x,[\s\S]*ref=\{targetRef\}[\s\S]*<motion\.span[\s\S]*x: pinMagnet \? 0 : magnet\.labelX,/u,
	);
	assert.match(JIRA_DROPZONE_SOURCE, /data-board-agent-session-drop-zone="create"/u);
	assert.match(
		JIRA_DROPZONE_SOURCE,
		/data-board-agent-session-column-title=\{title\}/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/useBoardAgentSessionDrag\(\{[\s\S]*onCreate: onBoardAgentSessionCreate \? handleBoardAgentSessionCreate : undefined,/u,
	);
});

test("the board enables board-wide Jira issue agent-session transfer", () => {
	assert.match(PAGE_SOURCE, /import \{ linkJiraKanbanAgentSession, moveJiraKanbanAgentSession, unlinkJiraKanbanAgentSession \} from "@\/components\/blocks\/jira-kanban\/state"/u);
	assert.match(PAGE_SOURCE, /setBoardColumns\(\(columns\) => unlinkJiraKanbanAgentSession\(columns, card\.code, session\.id\)\)/u);
	assert.match(PAGE_SOURCE, /setBoardColumns\(\(columns\) => linkJiraKanbanAgentSession\(columns, card\.code, activity\)\)/u);
	assert.match(
		PAGE_SOURCE,
		/setBoardColumns\(\(columns\) => moveJiraKanbanAgentSession\(\s*columns,\s*sourceCard\.code,\s*targetCard\.code,\s*session\.id,?\s*\)\)/u,
	);
	assert.match(PAGE_SOURCE, /onCardAgentSessionLink=\{handleAgentSessionLink\}/u);
	assert.match(PAGE_SOURCE, /onCardAgentSessionMove=\{handleAgentSessionMove\}/u);
	assert.match(PAGE_SOURCE, /onCardAgentSessionUnlink=\{handleAgentSessionUnlink\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onCardAgentSessionMove\?: ExperimentalJiraKanbanProps\["onCardAgentSessionMove"\];/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/const handleCardAgentSessionMove: ExperimentalJiraKanbanProps\["onCardAgentSessionMove"\][\s\S]*onCardAgentSessionMove\?\.\(\s*session,\s*sourceCard,\s*targetCard,\s*sourceColumnTitle,\s*targetColumnTitle,?\s*\);/u,
	);
	const moveHandlerStart = EXPERIMENTAL_PAGE_SOURCE.indexOf("const handleCardAgentSessionMove:");
	const unlinkHandlerStart = EXPERIMENTAL_PAGE_SOURCE.indexOf("const handleCardAgentSessionUnlink:");
	assert.ok(moveHandlerStart > 0 && unlinkHandlerStart > moveHandlerStart);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE.slice(moveHandlerStart, unlinkHandlerStart),
		/setCapturedLooseWorkIds/u,
		"moving an already-linked session must not change its captured status",
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onCardAgentSessionUnlink\?: ExperimentalJiraKanbanProps\["onCardAgentSessionUnlink"\];/u);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/const canTransferAgentSession = canUnlinkAgentSession \|\| canLinkAgentSession \|\| isBoardDropTarget;/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/sessionTransferAfter=\{detachedAgentSessions\.length > 0/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/sessionDrag=\{canLinkAgentSession[\s\S]*\? detachedSessionDrag \?\? localSessionDrag[\s\S]*: undefined\}/u,
	);
});

test("Team EU returns unlinked sessions to Untracked without parking them on status columns", () => {
	// Both Untracked attach and chin drag stay wired. Team EU hides the dashed
	// unlink well, and still turns proximity off: unlinked copies go into
	// detachedByCard, which the Untracked list reads.
	assert.doesNotMatch(PAGE_SOURCE, /allowAgentSessionUnlink/u);
	assert.match(PAGE_SOURCE, /onCardAgentSessionUnlink=\{handleAgentSessionUnlink\}/u);
	assert.match(PAGE_SOURCE, /showAgentSessionUnlinkWell=\{false\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /const showUntrackedProximity/u);
	assert.match(PAGE_SOURCE, /const handleAgentSessionUnlink = useCallback/u);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/useDesignVariation|design-variation/u,
		"the shared block must take unlink as an optional handler, not read a global variation store",
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/showAgentSessionUnlinkWell\?: ExperimentalJiraKanbanProps\["showAgentSessionUnlinkWell"\];/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/showAgentSessionUnlinkWell=\{showAgentSessionUnlinkWell\}/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/const canUnlinkAgentSession = Boolean\(onSessionUnlink && firstActiveAgentSession\);/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/onUnlink: canUnlinkAgentSession[\s\S]*\? \(session\) => \{[\s\S]*onSessionUnlink\?\.\(resolvedSession, card, columnTitle\);[\s\S]*showUnlinkWell,/u,
	);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /showUnlinkWell = true,/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const showUnlinkControl = iconScale !== "comfortable"\s*\n\s*&& Boolean\(sessionDrag\?\.onUnlink\)\s*\n\s*&& !isDraggedOut;/u,
	);
	assert.match(
		TRANSFER_SOURCE,
		/const showUnlinkWell = !isLinking\s*&& Boolean\(config\.onUnlink\)\s*&& config\.showUnlinkWell !== false;/u,
	);
	assert.match(TRANSFER_SOURCE, /config\.unlinkLabel \?\? "Drag here to unlink"/u);
});

test("unlinked agent sessions remain detached beneath their source Jira card", () => {
	assert.match(PAGE_SOURCE, /const \[detachedAgentSessionsByCard, setDetachedAgentSessionsByCard\] = useState/u);
	assert.match(PAGE_SOURCE, /toJiraGoldenJourneysV4DetachedAgentSession\(activity, card\)/u);
	assert.match(PAGE_SOURCE, /setDetachedAgentSessionsByCard\(\(current\) =>/u);
	assert.match(PAGE_SOURCE, /detachedAgentSessionsByCard=\{detachedAgentSessionsByCard\}/u);
	assert.match(
		PAGE_SOURCE,
		/const activity = detachedActivitiesByIdRef\.current\[session\.id\]\s*\?\? toJiraIssueDemoAttachedActivity\(session\);/u,
		"re-attaching a complete detached fixture must normalize it to an active chin row",
	);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<AgentSession[\s\S]*variant="medium-detached"/u);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/<AgentSession[\s\S]*style=\{\{ marginTop: token\("space\.025"\) \}\}/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/className="has-\[\[data-session-dragging\]\]:relative has-\[\[data-session-dragging\]\]:z-30"/u,
		"the detached-session Motion stacking context must rise above the Jira issue shell while dragging",
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/resolveRelatedJiraIssueAgentActivityMode\(\s*\n\s*card\.agentActivityMode,\s*\n\s*detachedAgentSessions\.length > 0,/u,
	);
});

test("attaching a session removes every detached copy before linking it", () => {
	assert.match(
		PAGE_SOURCE,
		/Object\.entries\(current\)[\s\S]*sessions\.filter\(\(candidate\) => candidate\.id !== session\.id\)/u,
	);
	assert.match(
		PAGE_SOURCE,
		/if \(nextSessions\.length > 0\) \{[\s\S]*next\[cardCode\] = nextSessions;[\s\S]*\}/u,
	);
});

test("Jira session flyouts are suspended for both session and whole-card drags", () => {
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/import \{ JiraSessionFlyoutSuspensionProvider \} from "@\/components\/blocks\/product-sidebar\/variants\/jira-session-flyout";/u,
	);
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/const sessionFlyoutsSuspended = boardSessionDrag\.transaction !== null \|\| draggedCardCode !== null;/u,
	);
	assert.match(EXPERIMENTAL_BOARD_SOURCE, /sessionFlyoutsSuspended=\{sessionFlyoutsSuspended\}/u);
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/<JiraSessionFlyoutSuspensionProvider suspended>\s*<section[\s\S]*<ExperimentalJiraKanbanCard/u,
	);
	assert.match(EXPERIMENTAL_BOARD_SOURCE, /<\/JiraSessionFlyoutSuspensionProvider>/u);
});

test("the board puts agent and skill assignment in each card's More actions menu", () => {
	assert.match(PAGE_SOURCE, /<ExperimentalJiraKanbanPage[\s\S]*cardGenerativeActionPresentation="more-actions"/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /cardGenerativeActionPresentation\?: JiraIssueGenerativeActionPresentation;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<ExperimentalJiraKanban[\s\S]*cardGenerativeActionPresentation=\{cardGenerativeActionPresentation\}/u);
	assert.match(EXPERIMENTAL_BOARD_SOURCE, /cardGenerativeActionPresentation = "sparkle",/u);
	assert.match(EXPERIMENTAL_BOARD_SOURCE, /<ExperimentalJiraKanbanCard[\s\S]*generativeActionPresentation=\{cardGenerativeActionPresentation\}/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<JiraIssue[\s\S]*generativeActionPresentation=\{generativeActionPresentation\}/u);
});

test("the Jira tab bar splits or collapses work items per Simple views", () => {
	assert.match(JIRA_HEADER_SOURCE, /export function JiraViewTabs/u);
	assert.match(JIRA_HEADER_SOURCE, /className=\{isFirst \? "ml-4 flex-none" : "flex-none"\}/u);
	assert.match(JIRA_HEADER_SOURCE, /<IconComponent[\s\S]*label=""/u);
	assert.match(JIRA_HEADER_SOURCE, /const tabs = useJiraTabs\(supportedWorkItemViews\)/u);
	assert.match(JIRA_HEADER_SOURCE, /const activeTab = resolveJiraTab\(tabs, selectedTabLabel, workItemView\)/u);
	assert.match(JIRA_HEADER_SOURCE, /<JiraViewTabs\s+selectedTabLabel=\{selectedTabLabel\}/u);
	// Team EU without Simple views restores Board and List as sibling
	// destinations; Simple views (default on) keeps the single Work items tab
	// and lets the board header switch views.
	assert.match(JIRA_TABS_SOURCE, /import WorkItemIcon from "@atlaskit\/icon\/core\/work-item"/u);
	assert.match(JIRA_TABS_SOURCE, /const TEAM_EU_TABS: readonly TabDefinition\[\] = \[[\s\S]*\{ label: "Board", icon: BoardIcon, hasContent: true, view: "board" \}[\s\S]*\{ label: "List", icon: TableIcon, hasContent: true, view: "list" \}/u);
	assert.match(JIRA_TABS_SOURCE, /const SIMPLE_VIEWS_TABS: readonly TabDefinition\[\] = \[[\s\S]*\{ label: "Work items", icon: WorkItemIcon, hasContent: true \}/u);
	assert.match(JIRA_TABS_SOURCE, /export function getJiraTabs\(/u);
	assert.match(JIRA_TABS_SOURCE, /simpleViews = false/u);
	assert.match(
		JIRA_TABS_SOURCE,
		/return simpleViews \? SIMPLE_VIEWS_TABS : TEAM_EU_TABS;/u,
	);
	assert.match(USE_JIRA_TABS_SOURCE, /designVariants\["simple-views"\]/u);
	assert.match(
		USE_JIRA_TABS_SOURCE,
		/getJiraTabs\(designVariants\["simple-views"\]\)/u,
	);
	assert.doesNotMatch(JIRA_TABS_SOURCE, /2000-years-later|DesignVariationId/u);
	assert.doesNotMatch(USE_JIRA_TABS_SOURCE, /useDesignVariation|design-variation/u);
	assert.match(PAGE_SOURCE, /import \{ JiraViewTabs \} from "@\/components\/projects\/jira\/components\/jira-header"/u);
	assert.match(
		PAGE_SOURCE,
		/viewTabs=\{\(\s*<JiraViewTabs\s+selectedTabLabel=\{selectedTabLabel\}\s+onTabChange=\{handleTabChange\}\s+workItemView=\{workItemView\}\s*\/>\s*\)\}/u,
	);
	assert.match(PAGE_SOURCE, /const showBoardContent = activeTab\?\.hasContent === true;/u);
	assert.match(PAGE_SOURCE, /showBoardContent=\{showBoardContent\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showBoardContent\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showBoardControls=\{showBoardContent\}/u);
});

test("the Work items header switches between Board and List views with their icons", () => {
	assert.match(PAGE_SOURCE, /const \[workItemView, setWorkItemView\] = useState<JiraWorkItemView>\(DEFAULT_JIRA_WORK_ITEM_VIEW\)/u);
	assert.match(PAGE_SOURCE, /const activeView = activeTab\?\.view \?\? workItemView;/u);
	assert.match(PAGE_SOURCE, /activeView=\{activeView\}/u);
	assert.match(PAGE_SOURCE, /const tabOwnsView = activeTab\?\.view !== undefined;/u);
	assert.match(PAGE_SOURCE, /onViewChange=\{tabOwnsView \? undefined : setWorkItemView\}/u);
	assert.match(
		PAGE_SOURCE,
		/renderListContent=\{\(\s*columns,\s*\{\s*agentSessionDropIntent,\s*onTrailingContentUnderlapChange,\s*scrollEndInset,\s*trailingOverlayRef,\s*\},\s*\) =>/u,
	);
	assert.match(PAGE_SOURCE, /useJiraGoldenJourneysV4List/u);
	assert.match(PAGE_SOURCE, /<JiraList\s+\{\.\.\.listProps\}/u);
	assert.match(PAGE_SOURCE, /agentSessionDropIntent=\{agentSessionDropIntent\}/u);
	assert.match(
		PAGE_SOURCE,
		/onTrailingContentUnderlapChange=\{onTrailingContentUnderlapChange\}/u,
	);
	assert.match(PAGE_SOURCE, /const JIRA_LIST_PANEL_END_GAP_PX = 24;/u);
	assert.match(
		PAGE_SOURCE,
		/const listScrollEndInset = scrollEndInset > 0\s*\?\s*scrollEndInset \+ JIRA_LIST_PANEL_END_GAP_PX\s*:\s*0;/u,
	);
	assert.match(PAGE_SOURCE, /scrollEndInset=\{listScrollEndInset\}/u);
	assert.match(PAGE_SOURCE, /trailingOverlayRef=\{trailingOverlayRef\}/u);
	assert.match(PAGE_SOURCE, /onListAgentSessionCreate=\{handleListAgentSessionCreate\}/u);
	assert.match(PAGE_SOURCE, /createFromAgentSession/u);
	assert.match(PAGE_SOURCE, /consumeDetachedAgentSession/u);
	assert.match(LIST_HOOK_SOURCE, /createFromAgentSession/u);
	assert.match(LIST_HOOK_SOURCE, /createListWorkItemFromSession/u);
	const createFromSessionStart = LIST_HOOK_SOURCE.indexOf("const createFromAgentSession = useCallback");
	const createFromSessionEnd = LIST_HOOK_SOURCE.indexOf("}, [setBoardColumns]);", createFromSessionStart);
	assert.ok(createFromSessionStart > 0 && createFromSessionEnd > createFromSessionStart);
	assert.match(LIST_HOOK_SOURCE, /boardColumnsRef\.current = result\.columns/u);
	assert.match(LIST_HOOK_SOURCE, /listOrderRef\.current = result\.listOrder/u);
	assert.doesNotMatch(
		LIST_HOOK_SOURCE.slice(createFromSessionStart, createFromSessionEnd),
		/setDraftWorkItem|draftWorkItem/u,
	);
	assert.match(
		PAGE_SOURCE,
		/"min-h-0 flex-1 overflow-hidden pb-4 ps-6 md:pb-5"[\s\S]*scrollEndInset > 0 \? "pe-0" : "pe-4 md:pe-5"[\s\S]*<JiraList\s+\{\.\.\.listProps\}/u,
	);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/overflow-auto p-4 md:p-5"[\s\S]*<JiraList\s+\{\.\.\.listProps\}/u,
	);
	// Drag handles only portal when onMoveRow is set. A display-only JiraList
	// (rows + counts, no capability callbacks) is what hid rearrange on hover.
	assert.match(LIST_HOOK_SOURCE, /onMoveRow: handleMoveRow/u);
	assert.match(LIST_HOOK_SOURCE, /onSelectRow: handleSelectRow/u);
	assert.match(LIST_HOOK_SOURCE, /onCreate: handleCreateWorkItem/u);
	assert.match(LIST_HOOK_SOURCE, /onStatusChange: handleStatusChange/u);
	assert.match(LIST_HOOK_SOURCE, /onAssignedAgentIdsChange: handleAssignedAgentIdsChange/u);
	assert.match(
		LIST_HOOK_SOURCE,
		/onAssignedAgentIdsChange: \(issueKey: string, agentIds: readonly string\[\]\) => void;/u,
	);
	assert.match(
		LIST_HOOK_SOURCE,
		/const JIRA_GOLDEN_JOURNEYS_V4_AGENT_CATALOG = mergeJiraKanbanAgentCatalog\(\s*JIRA_GOLDEN_JOURNEYS_V4_PAY_BOARD_AGENTS,\s*\);/u,
	);
	assert.match(LIST_HOOK_SOURCE, /issueType: draftWorkItem.issueType/u);
	assert.match(LIST_HOOK_SOURCE, /dueDate: draftWorkItem.dueDate/u);
	assert.match(LIST_HOOK_SOURCE, /currentOrder.length === 0 \? allKeys : currentOrder/u);
	assert.match(LIST_HOOK_SOURCE, /agentCatalog: JIRA_GOLDEN_JOURNEYS_V4_AGENT_CATALOG/u);
	assert.match(LIST_HOOK_SOURCE, /createListRows\(columns, JIRA_GOLDEN_JOURNEYS_V4_AGENT_CATALOG\)/u);
	assert.match(LIST_HOOK_SOURCE, /statusOptions: JIRA_GOLDEN_JOURNEYS_V4_LIST_STATUS_OPTIONS/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /activeView\?: ExperimentalJiraKanbanView;/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/renderListContent\?: \(\s*columns: readonly JiraKanbanColumnData\[\],\s*context: ExperimentalJiraKanbanListRenderContext,\s*\) => ReactNode;/u,
	);
	assert.match(PAGE_SOURCE, /pb-4 ps-6 md:pb-5/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /inFlowAgentSessionColumn/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /agentSessionDropIntent: boardSessionDrag\.listDropIntent/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onCreate: onBoardAgentSessionCreate \? handleBoardAgentSessionCreate : undefined/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onListCreate: onListAgentSessionCreate \? handleListAgentSessionCreate : undefined/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /activeView === "list" && renderListContent/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<BoardFilterPopover[\s\S]*surfaceLabel=\{activeView\}/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /import \{ Tabs, TabsList, TabsTrigger \} from "@\/components\/ui\/tabs"/u);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /ToggleGroup/u);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/<TabsList aria-label="Work items view">[\s\S]*<TabsTrigger value="board">[\s\S]*<BoardIcon[\s\S]*Board[\s\S]*<TabsTrigger value="list">[\s\S]*<TableIcon[\s\S]*List/u,
	);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /<TabsList[^>]*className=|<TabsTrigger[^>]*className=/u);
	assert.match(PAGE_SOURCE, /moreControlsPlacement="end"/u);
	assert.match(PAGE_SOURCE, /showMoreControls=\{!designVariants\["simple-views"\]\}/u);
	assert.match(PAGE_SOURCE, /simpleViews=\{designVariants\["simple-views"\]\}/u);
	assert.match(
		PAGE_SOURCE,
		/showCustomizeControl=\{!designVariants\["simple-views"\]\}/u,
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /moreControlsPlacement\?: "inline" \| "end";/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showMoreControls\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /simpleViews\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showCustomizeControl\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /moreControlsPlacement=\{moreControlsPlacement\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showMoreControls=\{showMoreControls\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /simpleViews=\{simpleViews\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /showCustomizeControl=\{showCustomizeControl\}/u);
	assert.doesNotMatch(
		EXPERIMENTAL_PAGE_SOURCE,
		/useDesignVariation|design-variation/u,
		"the shared block must take moreControlsPlacement, not read a global variation store",
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/moreControlsPlacement === "inline" \? moreControls : null/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/moreControlsPlacement === "end" \? moreControls : null/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /aria-label="Customize"/u);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/showCustomizeControl \? \(\s*<Button aria-disabled aria-label="Customize" size="icon" variant="outline">/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /className="text-xs text-text-subtlest">Spaces</u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /<Heading as="h1" className="min-w-0 truncate" size="medium">\{title\}<\/Heading>/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /aria-label="Share"/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /aria-label="Expand"/u);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/className=\{cn\("flex items-center gap-2", compact \? undefined : "ml-auto"\)\}/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/showMoreControls \? \(\s*<Button aria-disabled aria-label=\{`More \$\{surfaceLabel\} controls`\}/u,
	);
	const inlineMoreIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf(
		'{moreControlsPlacement === "inline" ? moreControls : null}',
	);
	const viewSwitcherIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf('aria-label="Work items view"');
	const endMoreIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf(
		'{moreControlsPlacement === "end" ? moreControls : null}',
	);
	const customizeIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf("{customizeControl}");
	assert.ok(inlineMoreIndex > 0 && inlineMoreIndex < viewSwitcherIndex);
	assert.ok(viewSwitcherIndex > 0 && viewSwitcherIndex < customizeIndex);
	assert.ok(customizeIndex > 0 && customizeIndex < endMoreIndex);
	const endSlotIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf("{endSlot ? endSlot : null}");
	assert.ok(endSlotIndex > 0 && viewSwitcherIndex < endSlotIndex && endSlotIndex < customizeIndex);
	const filterControlIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf("{filterControl}");
	const viewMenuIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf("<BoardViewMenu");
	const modeToggleIndex = EXPERIMENTAL_HEADER_SOURCE.indexOf("{modeToggle}");
	assert.ok(filterControlIndex > 0 && filterControlIndex < viewMenuIndex);
	assert.ok(viewMenuIndex > 0 && viewMenuIndex < modeToggleIndex);
	assert.ok(modeToggleIndex > 0 && modeToggleIndex < inlineMoreIndex);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/\{filterControl\}[\s\S]*?<BoardViewMenu[\s\S]*?\{modeToggle\}[\s\S]*?moreControlsPlacement === "inline"/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_HEADER_SOURCE,
		/<div className="flex items-center gap-1">\s*<BoardViewMenu/u,
	);
});

test("the board keeps matching 24px gaps above and below the filter controls", () => {
	// The control row's opening tag is multi-line (it carries `controlsInsetEnd`
	// as a style), so match the className string rather than the whole tag —
	// `mt-6` after the tabs must match the header's `pb-6` below the row.
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/\{viewTabs \? <div className="mt-2">\{viewTabs\}<\/div> : null\}[\s\S]*className="mt-6 flex flex-wrap items-center gap-2 px-6"/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/className=\{cn\("shrink-0 pt-3", showBoardControls \? "pb-6" : "pb-0"\)\}/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/paddingInlineEnd: `calc\(\$\{controlsInsetEnd\}px \+ \$\{token\("space\.300"\)\}\)`/u,
	);
});

test("create-well and card-link drops stagger, and linking uses automatic arc direction", () => {
	assert.match(SESSION_DROP_RECEIPT_SOURCE, /drop: "stagger"/u);
	assert.match(SESSION_FUSION_OVERLAY_STATE_SOURCE, /playback: "stagger"/u);
	assert.match(JIRA_LINKING_DROP_SOURCE, /direction: "automatic"/u);
	assert.doesNotMatch(
		JIRA_LINKING_DROP_SOURCE,
		/arcStrength: -0\.42/u,
		"negative strength was the old clockwise lock; automatic direction needs a positive well-matching strength",
	);
	assert.match(
		JIRA_LINKING_FLIGHT_SOURCE,
		/arc\(resolveJiraLinkingArcOptions\(profile\)\)/u,
	);
	assert.doesNotMatch(
		JIRA_LINKING_FLIGHT_SOURCE,
		/direction: "cw"|direction: "ccw"/u,
	);
});
