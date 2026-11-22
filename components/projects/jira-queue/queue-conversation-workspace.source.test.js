const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const WORKSPACE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-queue/components/queue-conversation-workspace.tsx"),
	"utf8",
);
const STAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-queue/components/queue-stage.tsx"),
	"utf8",
);
const CHAT_MESSAGES_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/shared/components/chat-messages.tsx"),
	"utf8",
);

test("awaiting Queue sessions replace the composer with the shared question experience", () => {
	assert.match(WORKSPACE_SOURCE, /import \{ QuestionCard \} from "@\/components\/blocks\/question-card\/components\/question-card"/u);
	assert.match(WORKSPACE_SOURCE, /import \{ QuestionCardShortcutsFooter \} from "@\/components\/projects\/shared\/components\/question-card-shortcuts-footer"/u);
	assert.match(WORKSPACE_SOURCE, /session\.status === "awaiting-input" \? session\.question : undefined/u);
	assert.match(WORKSPACE_SOURCE, /<ChatMessages[\s\S]*showAwaitingIndicator=\{Boolean\(awaitingQuestion\)\}/u);
	assert.match(CHAT_MESSAGES_SOURCE, /<MessageScroller[\s\S]*<AwaitingScrollSync awaiting=\{showAwaitingIndicator\}/u);
	assert.match(CHAT_MESSAGES_SOURCE, /if \(!awaiting\) return;[\s\S]*requestAnimationFrame\(\(\) => scrollToEnd\(\{ behavior: "instant" \}\)\)/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /StatusInformationIcon|components\/ui-custom\/shimmer/u);
	assert.match(CHAT_MESSAGES_SOURCE, /import \{[\s\S]*ChainOfThought,[\s\S]*ChainOfThoughtHeader,[\s\S]*\} from "@\/components\/ui\/chain-of-thought"/u);
	assert.match(CHAT_MESSAGES_SOURCE, /<ChainOfThought>[\s\S]*<ChainOfThoughtHeader showChevron=\{false\} state="thinking">[\s\S]*\{awaitingIndicatorLabel\}/u);
	assert.match(WORKSPACE_SOURCE, /onSubmit=\{\(answers\) => void handleAnswerQuestion\(answers\)\}/u);
	assert.match(WORKSPACE_SOURCE, /<QuestionCard[\s\S]*<QuestionCardShortcutsFooter \/>/u);
	assert.match(WORKSPACE_SOURCE, /await onAnswerQuestion\(answers\)/u);
});

test("completed Queue sessions render the appropriate context above the composer", () => {
	assert.match(WORKSPACE_SOURCE, /session\.fileChanges\?\.isDismissed \? undefined : session\.fileChanges/u);
	assert.match(WORKSPACE_SOURCE, /session\.status === "pr-open"/u);
	assert.match(WORKSPACE_SOURCE, /<ContextBarTagGroup[\s\S]*overflowAriaLabel="Show more session actions"/u);
	assert.match(WORKSPACE_SOURCE, /<ContextBarPill[\s\S]*aria-label="Dismiss file changes"[\s\S]*onClick=\{onDismissFileChanges\}/u);
	assert.match(
		WORKSPACE_SOURCE,
		/Changes:[\s\S]*inline-flex items-center gap-0\.5[\s\S]*font-mono font-normal text-text-success[\s\S]*font-mono font-normal text-text-danger/u,
	);
	assert.match(WORKSPACE_SOURCE, /Move to:[\s\S]*<ButtonGroup aria-label="Move Jira issue" variant="split">/u);
	assert.match(WORKSPACE_SOURCE, /"To do",[\s\S]*"In progress",[\s\S]*"In review",[\s\S]*"Done"/u);
	assert.match(WORKSPACE_SOURCE, /<ContextBarPill[\s\S]*interactive=\{false\}[\s\S]*Move to:/u);
	assert.match(WORKSPACE_SOURCE, /aria-label=\{`Move Jira issue to \$\{session\.jiraColumn\}`\}[\s\S]*onClick=\{\(\) => onJiraColumnChange\(session\.jiraColumn\)\}[\s\S]*size="compact"/u);
	assert.match(WORKSPACE_SOURCE, /<DropdownMenuTrigger[\s\S]*aria-label="Choose Jira column"[\s\S]*size="icon-compact"/u);
	assert.match(WORKSPACE_SOURCE, /<Lozenge className="pointer-events-none" variant=\{QUEUE_JIRA_COLUMN_VARIANTS\[column\]\}>/u);
	assert.match(WORKSPACE_SOURCE, /id: "jira-column",[\s\S]*onSelect: \(\) => onJiraColumnChange\(session\.jiraColumn\)/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /import \{ Tag \} from "@\/components\/ui\/tag"/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /selected=\{column === session\.jiraColumn\}/u);
	assert.match(WORKSPACE_SOURCE, /onSelect=\{\(\) => onJiraColumnChange\(column\)\}/u);
	assert.match(WORKSPACE_SOURCE, /<QueueSessionContextBar[\s\S]*<RovoAppComposer[\s\S]*<Footer \/>/u);
});

test("the detail panel open/collapsed state is owned by the stage so it persists across session switches", () => {
	// The workspace remounts on `key={activeSession.id}`, so any panel state it
	// owned locally would reset on every session switch. The state must live in
	// the persistent QueueStage and be passed down as controlled props.
	assert.doesNotMatch(WORKSPACE_SOURCE, /useState\([^)]*\).*isDetailPanelOpen/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /setIsDetailPanelOpen/u);
	assert.match(WORKSPACE_SOURCE, /isDetailPanelOpen: boolean;/u);
	assert.match(WORKSPACE_SOURCE, /onDetailPanelOpenChange: \(open: boolean\) => void;/u);
	assert.match(WORKSPACE_SOURCE, /onDetailPanelToggle=\{\(\) => onDetailPanelOpenChange\(!isDetailPanelOpen\)\}/u);
	assert.match(WORKSPACE_SOURCE, /onClose=\{\(\) => onDetailPanelOpenChange\(false\)\}/u);

	assert.match(STAGE_SOURCE, /const \[isDetailPanelOpen, setIsDetailPanelOpen\] = useState\(false\)/u);
	assert.match(STAGE_SOURCE, /<QueueConversationWorkspace[\s\S]*isDetailPanelOpen=\{isDetailPanelOpen\}/u);
	assert.match(STAGE_SOURCE, /<QueueConversationWorkspace[\s\S]*onDetailPanelOpenChange=\{setIsDetailPanelOpen\}/u);
});

test("the detail panel resize width is owned by the stage so a dragged width persists across session switches", () => {
	// Same remount concern as the open/collapsed state above: the workspace
	// remounts on `key={activeSession.id}`, so a locally-owned useSidebarResize
	// would reset the dragged width on every session switch. The resize state must
	// live in the persistent QueueStage and be handed down as a prop. It still
	// resets on refresh (fresh state) and on double-click (the hook's handler).
	assert.doesNotMatch(WORKSPACE_SOURCE, /useSidebarResize\(/u);
	assert.match(WORKSPACE_SOURCE, /import type \{ useSidebarResize \} from "@\/components\/projects\/rovo-core\/hooks\/use-sidebar-resize"/u);
	assert.match(WORKSPACE_SOURCE, /detailPanelResize: ReturnType<typeof useSidebarResize>;/u);

	assert.match(STAGE_SOURCE, /import \{ useSidebarResize \} from "@\/components\/projects\/rovo-core\/hooks\/use-sidebar-resize"/u);
	assert.match(
		STAGE_SOURCE,
		/const detailPanelResize = useSidebarResize\(\{[\s\S]*defaultWidth: DETAIL_PANEL_DEFAULT_WIDTH_PX[\s\S]*direction: "rtl"[\s\S]*\}\)/u,
	);
	assert.match(STAGE_SOURCE, /<QueueConversationWorkspace[\s\S]*detailPanelResize=\{detailPanelResize\}/u);
});

test("the Queue scroll viewport fills the available space while its content stays constrained", () => {
	assert.match(CHAT_MESSAGES_SOURCE, /contentClassName\?: string;/u);
	assert.match(CHAT_MESSAGES_SOURCE, /className=\{cn\("flex w-full shrink-0 flex-col gap-6 p-3", contentClassName\)\}/u);
	assert.match(WORKSPACE_SOURCE, /layout\s*style=\{\{ paddingRight: isDetailPanelOpen \? detailPanelResize\.sidebarWidth : 0,/u);
	assert.match(WORKSPACE_SOURCE, /shouldReduceMotion \|\| detailPanelResize\.isResizing/u);
	assert.match(WORKSPACE_SOURCE, /className="flex min-h-0 w-full flex-1 flex-col"/u);
	assert.match(WORKSPACE_SOURCE, /contentClassName="mx-auto max-w-\[800px\] px-6"/u);
	assert.match(WORKSPACE_SOURCE, /className="mx-auto w-full max-w-\[800px\] px-3"/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /DOMMatrixReadOnly|ResizeObserver|chatBodyShift/u);
});

test("the standalone Queue stage sizes to its immediate preview container", () => {
	assert.match(STAGE_SOURCE, /className="relative h-full min-h-0 w-full overflow-hidden isolate"/u);
	assert.doesNotMatch(STAGE_SOURCE, /100cqw|w-screen|left-1\/2|-translate-x-1\/2/u);
});
