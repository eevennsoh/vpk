const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const AGENTS_VIEW_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const RFP_REPORT_CANVAS_SOURCE = fs.readFileSync(
	path.join(__dirname, "components/rfp-report-canvas.tsx"),
	"utf8",
);
const BOARD_TOOLBAR_SOURCE = fs.readFileSync(
	path.join(__dirname, "components/board-toolbar.tsx"),
	"utf8",
);
const JIRA_HEADER_SOURCE = fs.readFileSync(
	path.join(__dirname, "components/jira-header.tsx"),
	"utf8",
);
const COLUMN_AGENT_ASSIGNMENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "components/column-agent-assignment.tsx"),
	"utf8",
);
const RFP_AGENT_CHAT_DETAILS_SOURCE = fs.readFileSync(
	path.join(__dirname, "components/rfp-agent-chat-details.tsx"),
	"utf8",
);

test("AgentsView reads chat surface pin state from useRovoChat", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const\s+\{\s*[^}]*\bchatSurface\b[^}]*\bisFloatingPinned\b[^}]*\bpinFloating\b[^}]*\bunpinFloating\b[^}]*\}\s*=\s*useRovoChat\(\)/u,
	);
});

test("AgentsView promotes the modal to inline when pinned floating chat switches to sidebar", () => {
	const promoteEffectPattern =
		/useEffect\(\(\)\s*=>\s*\{\s*if\s*\(\s*!isModalOpen\s*\|\|\s*chatSurface\s*!==\s*"sidebar"\s*\|\|\s*!isFloatingPinned\s*\)\s*return;\s*promoteModalToInline\(\);\s*\},\s*\[\s*isModalOpen,\s*chatSurface,\s*isFloatingPinned,\s*promoteModalToInline\s*\]\);/u;
	assert.match(AGENTS_VIEW_SOURCE, promoteEffectPattern);
});

test("AgentsView opens generated reports in Rovo Canvas and embeds the active chat there", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/window\.addEventListener\("rovo:open-canvas-artifact", handleOpenRfpCanvas\);/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/event\.preventDefault\(\);[\s\S]*if \(isModalOpen\) \{[\s\S]*closeModal\(\);[\s\S]*\}[\s\S]*closeChat\(\);/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/rfpDemo\.actions\.setCanvasView\("report"\);[\s\S]*rfpDemo\.actions\.setCanvasOpen\(true\);/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/<RfpReportCanvas[\s\S]*onAttachReport=\{handleAttachReport\}[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*chatGreeting=\{chatGreeting\}/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/<RfpReportCanvas[\s\S]*customAgentTabs=\{customAgentTabs\}/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/import ChatPanel, \{ type ChatPanelCustomAgentTabs, type ChatPanelGreetingProps \} from "@\/components\/projects\/sidebar-chat\/page";/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/function RfpReportCanvasChatRail/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/const editContextBar: ChatContextBarDescriptor = \{[\s\S]*iconName: "artifact"[\s\S]*label: RFP_REPORT_ARTIFACT_TITLE[\s\S]*variant: "edit"[\s\S]*\};/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/const artefactMetadata = useMemo\(\(\) => resolveRfpReportVersionMetadata\(state\), \[state\]\);/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/artefactLabel=\{RFP_REPORT_ARTIFACT_TITLE\}[\s\S]*artefactMetadata=\{artefactMetadata\}/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/onVersionSelect=\{actions\.selectReportVersion\}/u,
	);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /artefactLabel="Rovo Canvas report"/u);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/<ChatPanel[\s\S]*hideHeader[\s\S]*enableSmartWidgets[\s\S]*abortOnUnmount=\{false\}[\s\S]*chatContextBar=\{editContextBar\}[\s\S]*greeting=\{chatGreeting\}[\s\S]*customAgentTabs=\{customAgentTabs\}[\s\S]*onArtifactResult=\{onArtifactResult\}/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/rightRail=\{[\s\S]*<RfpReportCanvasChatRail[\s\S]*chatContextBar=\{chatContextBar\}[\s\S]*chatGreeting=\{chatGreeting\}[\s\S]*customAgentTabs=\{customAgentTabs\}[\s\S]*onClose=\{\(\) => actions\.setCanvasOpen\(false\)\}/u,
	);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /RfpAgentProposalBanner/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /feedbackBanner=/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /This RFP workflow looks repeatable/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /headerVariant="minimal"/u);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/useRfpHtmlReportPreview\(state\)/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/RFP_REPORT_PREVIEW_ENDPOINT = "\/api\/agents\/rfp-demo\/vpk-html-report"/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/formatActiveJiraWorkItemContext\(RFP_101_WORK_ITEM\)/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/id: "report",[\s\S]*label: "Report",[\s\S]*toolbar: "preview",[\s\S]*copyText: reportPreview\.html \?\? "Report preview is loading\.",[\s\S]*<RfpRenderedHtmlReport/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/<iframe[\s\S]*srcDoc=\{html\}/u,
	);
	assert.doesNotMatch(
		RFP_REPORT_CANVAS_SOURCE,
		/font-family: Inter/u,
	);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /id: "plan"/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /id: "html"/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /RovoChatProvider/u);
});

test("RFP report canvas centers a large spinner while the HTML preview is loading", () => {
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/function resolveRfpReportCanvasStatus\(status: RfpHtmlReportStatus\): RovoCanvasStatus \{[\s\S]*if \(status === "error"\) \{[\s\S]*return "error";[\s\S]*return "ready";[\s\S]*\}/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/import \{ Spinner \} from "@\/components\/ui\/spinner";/u,
	);
	assert.match(RFP_REPORT_CANVAS_SOURCE, /aria-label="Report preview loading"/u);
	assert.match(RFP_REPORT_CANVAS_SOURCE, /aria-busy="true"/u);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/className="grid size-full place-items-center bg-surface"[\s\S]*<Spinner[\s\S]*className="size-12 text-icon-subtle"[\s\S]*label="Report preview loading"/u,
	);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /return "executing";/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /Rendering vpk-html report/u);
	assert.doesNotMatch(RFP_REPORT_CANVAS_SOURCE, /Could not render the vpk-html report/u);
});

test("AgentsView attaches generated reports through the RFP-101 modal and Sonner notifications", () => {
	assert.match(AGENTS_VIEW_SOURCE, /import \{ toast \} from "sonner";/u);
	assert.match(AGENTS_VIEW_SOURCE, /import \{ SONNER_TOAST_AUTO_DISMISS_MS, SonnerToast, Toaster \} from "@\/components\/ui\/sonner";/u);
	assert.match(AGENTS_VIEW_SOURCE, /GENERATED_RFP_REPORT_ATTACHMENT_ID/u);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const handleAttachReport = \(reportPreviewHtml\?: string\) => \{[\s\S]*rfpDemo\.actions\.attachReport\(reportPreviewHtml\);[\s\S]*closeChat\(\);[\s\S]*setAttachmentHighlight\(\{[\s\S]*id: GENERATED_RFP_REPORT_ATTACHMENT_ID,[\s\S]*workItemPresentation\.openModal\(RFP_101_WORK_ITEM\);[\s\S]*\};/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/<JiraWorkItemModal[\s\S]*highlightedAttachmentId=\{attachmentHighlight\?\.id\}[\s\S]*highlightedAttachmentKey=\{attachmentHighlight\?\.key\}/u,
	);
	assert.match(AGENTS_VIEW_SOURCE, /<Toaster id=\{AGENTS_RFP_DEMO_TOASTER_ID\} position="bottom-left" expand=\{true\} \/>/u);
	assert.match(AGENTS_VIEW_SOURCE, /toast\.custom\([\s\S]*<SonnerToast[\s\S]*dismissible=\{true\}/u);
	assert.match(AGENTS_VIEW_SOURCE, /previewHtml: attachment\.previewHtml \?\? \(workItem\.code === "RFP-101" \? state\.report\.previewHtml : undefined\)/u);
	assert.match(AGENTS_VIEW_SOURCE, /attachmentComment = workItemState\?\.attachmentComment/u);
	assert.match(AGENTS_VIEW_SOURCE, /eventName: "rovo:open-canvas-artifact" as const/u);
	assert.match(AGENTS_VIEW_SOURCE, /comments: generatedComments\.length \? \[\.\.\.generatedComments, \.\.\.baseComments\] : workItem\.comments/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /pointer-events-none fixed right-4 bottom-4/u);
	assert.match(RFP_REPORT_CANVAS_SOURCE, /primaryActionLabel="Add PDF to RFP-101"/u);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/onPrimaryAction=\{\(\) => \(onAttachReport \?\? actions\.attachReport\)\(reportPreview\.html \?\? undefined\)\}/u,
	);
});

test("AgentsView renders selected work item inline after promotion", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/import \{ AgentsWorkItemInlinePage \} from "\.\/components\/agents-work-item-inline-page";/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/if\s*\(\s*presentationState\.mode\s*===\s*"inline"\s*&&\s*selectedWorkItem\s*\)\s*\{[\s\S]*<AgentsWorkItemInlinePage[\s\S]*workItem=\{selectedWorkItem\}[\s\S]*highlightedAttachmentId=\{attachmentHighlight\?\.id\}[\s\S]*onBackToBoard=\{workItemPresentation\.backToBoard\}/u,
	);
});

test("AgentsView keeps column agent assignment state local to the board", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/import \{ BOARD_AGENTS \} from "\.\/data\/board-agents";/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const\s+\[columnAgentAssignments,\s*setColumnAgentAssignments\]\s*=\s*useState<Record<string,\s*string\[\]>>\(\{\}\);/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const assignedAgentIdsByColumn = useMemo/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/assignedAgentIdsByColumn=\{assignedAgentIdsByColumn\}/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/onToggleColumnAgent=\{handleToggleColumnAgent\}/u,
	);
});

test("AgentsView filters bulk move actions to cards that change columns", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const getMovableSelectedCardCodes = \(targetColumnTitle: string\) => Array\.from\(selectedCardCodes\)\.filter\(\(cardCode\) => \{[\s\S]*return sourceColumn \? sourceColumn\.title !== targetColumnTitle : false;/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const movableCodes = getMovableSelectedCardCodes\(targetColumnTitle\);[\s\S]*if \(movableCodes\.length > 0\) \{[\s\S]*rfpDemo\.actions\.moveCards\(movableCodes, targetColumnTitle\);/u,
	);
	assert.doesNotMatch(
		AGENTS_VIEW_SOURCE,
		/rfpDemo\.actions\.moveCards\(Array\.from\(selectedCardCodes\), targetColumnTitle\);/u,
	);
});

test("AgentsView replaces the inline selection bar with the shared Jira Toolbar", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/selectionToolbar=\{\{[\s\S]*agents: assignableBoardAgents,[\s\S]*onAgentAssignmentChange: handleSelectedCardsAgentAssignmentChange,[\s\S]*onClearSelection: clearSelection,[\s\S]*onStatusChange: handleSelectedCardsStatusChange,[\s\S]*selectedAgentIds: selectedCardAgentIds/u,
	);
	assert.match(AGENTS_VIEW_SOURCE, /rfpDemo\.actions\.setCardsAgentAssignment\(\[\.\.\.selectedCardCodes\], agentId, assigned\)/u);
	assert.match(AGENTS_VIEW_SOURCE, /boardAgents\.filter\(\(agent\) => agent\.id !== RFP_DRAFTING_AGENT_ID\)/u);
	assert.match(AGENTS_VIEW_SOURCE, /if \(agentId === RFP_DRAFTING_AGENT_ID\) \{\s*return;\s*\}/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /function KanbanSelectionActionBar/u);
});

test("Column agent assignment icons use selected icon color while the trigger is open", () => {
	assert.match(
		COLUMN_AGENT_ASSIGNMENT_SOURCE,
		/className="ml-0\.5 text-icon-subtle group-aria-expanded\/button:text-icon-selected"/u,
	);
	assert.match(
		COLUMN_AGENT_ASSIGNMENT_SOURCE,
		/className="text-icon-subtle group-aria-expanded\/button:text-icon-selected"/u,
	);
});

test("AgentsView delegates RFP Drafting agent creation and keeps generic column creation local", () => {
	assert.match(
		AGENTS_VIEW_SOURCE,
		/onCreateRfpDraftingAgent: \(\) => void;/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/customAgentTabs\?: ChatPanelCustomAgentTabs;/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/if \(columnTitle === "Drafting"\) \{\s*onCreateRfpDraftingAgent\(\);\s*return;\s*\}/u,
	);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /RfpAgentDetailsSheet/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /isAgentDetailsOpen/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /onAgentDetailsOpenChange/u);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/\bopenChat\("floating"\);/u,
	);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/sendPrompt\([\s\S]*Create an agent for the \$\{columnTitle\} column[\s\S]*creationMode:\s*"agent"[\s\S]*contextDescription/u,
	);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /RFP_AGENT_CREATION_PROMPT/u);
});

test("AgentsView maps backend RFP agent output onto cards, assignees, comments, and attachments", () => {
	assert.match(AGENTS_VIEW_SOURCE, /RFP_DRAFTING_AGENT_NAME/u);
	assert.match(AGENTS_VIEW_SOURCE, /workItemState\.assignee === RFP_DRAFTING_AGENT_NAME/u);
	assert.match(AGENTS_VIEW_SOURCE, /workItemState\?\.agentStatus === "completed" && workItemState\.status === "Review" && !workItemState\.assignee/u);
	assert.match(AGENTS_VIEW_SOURCE, /RFP_DEMO_HUMAN_ASSIGNEES\[workItemState\.assignee\]/u);
	assert.match(AGENTS_VIEW_SOURCE, /role: workItemState\.agentStatus === "completed"[\s\S]*"Completed draft"/u);
	assert.match(AGENTS_VIEW_SOURCE, /generatedAttachments = getGeneratedRfpAttachments\(state, workItem\.code\)/u);
	assert.match(AGENTS_VIEW_SOURCE, /agentComment = workItemState\?\.agentComment/u);
	assert.match(AGENTS_VIEW_SOURCE, /generatedComments = \[[\s\S]*attachmentComment,[\s\S]*agentComment,[\s\S]*\]\.filter/u);
	assert.match(AGENTS_VIEW_SOURCE, /comments: generatedComments\.length \? \[\.\.\.generatedComments, \.\.\.baseComments\] : workItem\.comments/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /Weekdays at 9:00 AM/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /No schedule/u);
});

test("RFP agent chat tab details expose trigger editor and merged activity timeline without a sheet", () => {
	assert.match(RFP_AGENT_CHAT_DETAILS_SOURCE, /export function RfpAgentTriggerDetails/u);
	assert.match(RFP_AGENT_CHAT_DETAILS_SOURCE, /export function RfpAgentActivityDetails/u);
	assert.match(RFP_AGENT_CHAT_DETAILS_SOURCE, /<ProgressTracker[\s\S]*aria-label="RFP Drafter activity timeline"[\s\S]*steps=\{timelineSteps\}/u);
	assert.match(RFP_AGENT_CHAT_DETAILS_SOURCE, /function getActivityTimelineSteps\(state: AgentsRfpDemoState\): ProgressTrackerStep\[\]/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /<DetailsSection title="Triggers">/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /<DetailsSection title="Agent Instructions">/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /<DetailsSection title="Tasks">/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /<DetailsSection title="Run log">/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /<DetailsSection title="Activity">/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /RfpAgentDetailsSheet/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /SheetContent/u);
	assert.doesNotMatch(RFP_AGENT_CHAT_DETAILS_SOURCE, /<DetailsSection title="Conversation Starters">/u);
});

test("AgentsView includes assigned agents in the board toolbar avatar cluster", () => {
	assert.match(AGENTS_VIEW_SOURCE, /const toolbarAvatars = useMemo\(\(\) => \{/u);
	assert.match(AGENTS_VIEW_SOURCE, /for \(const agentIds of Object\.values\(assignedAgentIdsByColumn\)\)/u);
	assert.match(AGENTS_VIEW_SOURCE, /for \(const workItem of Object\.values\(rfpDemo\.state\.workItems\)\)/u);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const assignedAgentAvatars = boardAgents[\s\S]*\.filter\(\(agent\) => assignedAgentIds\.has\(agent\.id\) && Boolean\(agent\.avatarSrc\)\)[\s\S]*src: agent\.avatarSrc as string,[\s\S]*name: agent\.name,[\s\S]*shape: "hexagon" as const,/u,
	);
	assert.match(AGENTS_VIEW_SOURCE, /return \[[\s\S]*\.\.\.assignedAgentAvatars,[\s\S]*\.\.\.AVATARS,[\s\S]*\];/u);
	assert.match(AGENTS_VIEW_SOURCE, /<BoardToolbar avatars=\{toolbarAvatars\} onReset=\{handleResetDemo\} \/>/u);
});

test("Agents column assignment removes the avatar-group overlap ring", () => {
	assert.match(
		COLUMN_AGENT_ASSIGNMENT_SOURCE,
		/<AvatarGroup className="-space-x-1\.5 \*:data-\[slot=avatar\]:ring-0!"/u,
	);
	assert.match(COLUMN_AGENT_ASSIGNMENT_SOURCE, /label=\{agent\.name\} shape="hexagon" size="sm"/u);
	assert.doesNotMatch(COLUMN_AGENT_ASSIGNMENT_SOURCE, /showHexagonBorder/u);
});

test("RFP report canvas marks refined copy from the selected version, not terminal report stage", () => {
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/state\.report\.currentVersionId[\s\S]*state\.report\.versions\[state\.report\.versions\.length - 1\]\?\.id/u,
	);
	assert.match(
		RFP_REPORT_CANVAS_SOURCE,
		/selectedVersionId === "refined-current-report"/u,
	);
	assert.doesNotMatch(
		RFP_REPORT_CANVAS_SOURCE,
		/state\.report\.stage !== "generated"/u,
	);
});

test("RFP reset action lives in the board toolbar next to grouping", () => {
	assert.match(
		BOARD_TOOLBAR_SOURCE,
		/<AlertDialog open=\{isResetDialogOpen\} onOpenChange=\{handleResetDialogOpenChange\}>[\s\S]*<AlertDialogTrigger render=\{<Button className="gap-2" variant="outline" \/>\}>[\s\S]*Reset demo[\s\S]*<\/AlertDialogTrigger>/u,
	);
	assert.match(BOARD_TOOLBAR_SOURCE, /<AlertDialogTitle>Reset demo\?<\/AlertDialogTitle>/u);
	assert.match(BOARD_TOOLBAR_SOURCE, /permanently deletes all Rovo chat history/u);
	assert.doesNotMatch(BOARD_TOOLBAR_SOURCE, /Resetting demo\.\.\./u);
	assert.match(BOARD_TOOLBAR_SOURCE, /<AlertDialogAction[\s\S]*isLoading=\{isResetting\}[\s\S]*onClick=\{\(\) => void handleConfirmReset\(\)\}[\s\S]*variant="warning"/u);
	assert.match(BOARD_TOOLBAR_SOURCE, /shape\?: "circle" \| "hexagon";/u);
	assert.match(BOARD_TOOLBAR_SOURCE, /<Avatar shape=\{avatar\.shape \?\? "circle"\} size="sm">/u);
	assert.match(
		AGENTS_VIEW_SOURCE,
		/const handleResetDemo = async \(\) => \{[\s\S]*await rfpDemo\.actions\.reset\(\);[\s\S]*await deleteAllThreads\(\);[\s\S]*workItemPresentation\.backToBoard\(\);[\s\S]*closeChat\(\);/u,
	);
	assert.match(AGENTS_VIEW_SOURCE, /deleteAllThreads,[\s\S]*\} = useRovoChat\(\);/u);
	assert.match(BOARD_TOOLBAR_SOURCE, /Reset demo[\s\S]*Group: RFP stage/u);
	assert.match(AGENTS_VIEW_SOURCE, /<BoardToolbar avatars=\{toolbarAvatars\} onReset=\{handleResetDemo\} \/>/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /RfpDemoControls/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /Ask Rovo for RFP help/u);
	assert.doesNotMatch(AGENTS_VIEW_SOURCE, /Answer qualification questions/u);
});

test("the RFP More control is display-only until a menu capability exists", () => {
	assert.match(
		BOARD_TOOLBAR_SOURCE,
		/<Button aria-disabled aria-label="More board controls" size="icon" variant="outline">/u,
	);
	assert.doesNotMatch(
		BOARD_TOOLBAR_SOURCE,
		/<Button aria-label="More board controls" size="icon" variant="outline">/u,
	);
	assert.match(
		BOARD_TOOLBAR_SOURCE,
		/<Button variant="outline">\s*<Icon render=\{<FilterIcon label="" \/>\} \/>\s*Filter/u,
	);
	assert.match(
		BOARD_TOOLBAR_SOURCE,
		/<Button aria-disabled aria-label="Customize" size="icon" variant="outline">/u,
	);
	assert.doesNotMatch(
		BOARD_TOOLBAR_SOURCE,
		/<Button aria-label="Customize" size="icon" variant="ghost">/u,
	);
	const customizeIndex = BOARD_TOOLBAR_SOURCE.indexOf('aria-label="Customize"');
	const moreIndex = BOARD_TOOLBAR_SOURCE.indexOf('aria-label="More board controls"');
	assert.ok(customizeIndex > 0 && customizeIndex < moreIndex);
});

test("JiraHeader reuses the golden-journey experimental board header", () => {
	assert.match(
		JIRA_HEADER_SOURCE,
		/import \{ ExperimentalJiraKanbanBoardHeader \} from "@\/components\/blocks\/jira-kanban\/experimental\/experimental-board-header";/u,
	);
	assert.match(JIRA_HEADER_SOURCE, /<ExperimentalJiraKanbanBoardHeader/u);
	assert.match(JIRA_HEADER_SOURCE, /showBoardControls=\{false\}/u);
	assert.match(JIRA_HEADER_SOURCE, /title="Enterprise RFP Response"/u);
});
