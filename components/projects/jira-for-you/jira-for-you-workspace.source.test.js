const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const ITEM_SOURCE = readFileSync(join(__dirname, "jira-for-you-item.tsx"), "utf8");
const SECTION_SOURCE = readFileSync(join(__dirname, "jira-for-you-section.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "jira-for-you-types.ts"), "utf8");
const WORKSPACE_SOURCE = readFileSync(join(__dirname, "jira-for-you-workspace.tsx"), "utf8");
const WORKSPACE_TYPES_SOURCE = readFileSync(join(__dirname, "jira-for-you-workspace-types.ts"), "utf8");
const WORKSPACE_DATA_SOURCE = readFileSync(join(__dirname, "jira-for-you-workspace-data.ts"), "utf8");
const CONVERSATION_SOURCE = readFileSync(join(__dirname, "jira-for-you-conversation.tsx"), "utf8");
const JIRA_WORK_ITEM_WORKSPACE_SOURCE = readFileSync(
	join(__dirname, "jira-for-you-work-item-workspace.tsx"),
	"utf8",
);
const WORK_ITEM_VIEW_SOURCE = readFileSync(join(__dirname, "jira-for-you-work-item-view.tsx"), "utf8");
const WORK_ITEM_DIALOG_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/blocks/jira-work-item/experimental/components/experimental-work-item-dialog.tsx",
	),
	"utf8",
);
const WORK_ITEM_LAYOUT_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/blocks/jira-work-item/experimental/components/experimental-work-item-layout.tsx",
	),
	"utf8",
);
const JIRA_WORK_ITEM_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/blocks/jira-work-item/experimental/experimental-jira-work-item.tsx",
	),
	"utf8",
);
const PANEL_LAYOUT_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/blocks/jira-work-item/experimental/context-panel-layout.tsx",
	),
	"utf8",
);
const CONTEXT_TITLE_BAR_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/blocks/jira-work-item/experimental/components/context-title-bar.tsx",
	),
	"utf8",
);
const CONTEXT_TITLE_ACTIONS_SOURCE = readFileSync(
	join(
		process.cwd(),
		"components/blocks/jira-work-item/experimental/components/context-title-actions.tsx",
	),
	"utf8",
);
const HEADER_SOURCE = readFileSync(join(__dirname, "jira-for-you-header.tsx"), "utf8");
const DETAIL_PANEL_SOURCE = readFileSync(join(__dirname, "jira-for-you-detail-panel.tsx"), "utf8");
const SESSION_FLYOUT_SOURCE = readFileSync(
	join(process.cwd(), "components/blocks/product-sidebar/variants/jira-session-flyout.tsx"),
	"utf8",
);
const COMPOSER_CARD_SOURCE = readFileSync(
	join(process.cwd(), "components/projects/shared/components/composer-card-body.tsx"),
	"utf8",
);
const SIDEBAR_COMPOSER_SOURCE = readFileSync(
	join(process.cwd(), "components/projects/sidebar-chat/components/chat-composer.tsx"),
	"utf8",
);
const DEMO_SOURCE = readFileSync(
	join(process.cwd(), "components/website/demos/projects/jira-for-you-demo.tsx"),
	"utf8",
);
const PREVIEW_PAGE_SOURCE = readFileSync(
	join(process.cwd(), "app/preview/projects/jira-for-you/page.tsx"),
	"utf8",
);
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const DETAIL_DOC_SOURCE = readFileSync(
	join(process.cwd(), "app/data/details/projects.ts"),
	"utf8",
);
const COMPONENT_MANIFEST_SOURCE = readFileSync(
	join(process.cwd(), "app/data/component-manifest.ts"),
	"utf8",
);
const SIDEBAR_NAV_SOURCE = readFileSync(
	join(process.cwd(), "app/data/website-sidebar-nav.ts"),
	"utf8",
);

test("Jira For You preserves standalone list callbacks while exposing selected-row state", () => {
	assert.match(TYPES_SOURCE, /id\?: string;/u);
	assert.match(INDEX_SOURCE, /selectedItemId\?: string;/u);
	assert.match(INDEX_SOURCE, /onViewButtonRef\?: \(item: JiraForYouItem, node: HTMLButtonElement \| null\) => void;/u);
	assert.match(SECTION_SOURCE, /isSelected=\{item\.id === selectedItemId\}/u);
	assert.match(ITEM_SOURCE, /aria-current=\{isSelected \? "true" : undefined\}/u);
	assert.match(ITEM_SOURCE, /isSelected && "bg-bg-selected hover:bg-bg-selected-hovered"/u);
	assert.match(ITEM_SOURCE, /onView=\{\(event\) => \(onView \?\? onItemClick\)\?\.\(item, event\)\}/u);
	assert.match(ITEM_SOURCE, /viewButtonRef=\{\(node\) => onViewButtonRef\?\.\(item, node\)\}/u);
});

test("the workspace owns open or close, focus restoration, and local user-message state", () => {
	assert.match(INDEX_SOURCE, /export \{[\s\S]*JiraForYouWorkspace,[\s\S]*type JiraForYouWorkspaceProps,[\s\S]*\} from "\.\/jira-for-you-workspace";/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /useWindowWidth/u);
	assert.match(WORKSPACE_SOURCE, /const \[workspaceNode, setWorkspaceNode\] = useState<HTMLDivElement \| null>\(null\);/u);
	assert.match(WORKSPACE_SOURCE, /const \[workspaceWidth, setWorkspaceWidth\] = useState\(0\);/u);
	assert.match(WORKSPACE_SOURCE, /const isNarrow = workspaceWidth > 0 && workspaceWidth < NARROW_LAYOUT_BREAKPOINT_PX;/u);
	assert.match(WORKSPACE_SOURCE, /const shouldReduceMotion = useReducedMotion\(\);/u);
	assert.match(WORKSPACE_SOURCE, /CONSTRAINED_OVERLAY_VARIANTS/u);
	assert.match(WORKSPACE_SOURCE, /inert=\{activeItemData && isNarrow \? true : undefined\}/u);
	assert.match(WORKSPACE_SOURCE, /data-layout=\{isNarrow \? "overlay" : "split"\}/u);
	assert.match(WORKSPACE_SOURCE, /aria-label=\{`Chat workspace for \$\{assignedItemData\.item\.issueKey\}`\}/u);
	assert.match(WORKSPACE_SOURCE, /const resizeObserver = new ResizeObserver/u);
	assert.match(WORKSPACE_SOURCE, /ref=\{setWorkspaceNode\}/u);
	assert.match(WORKSPACE_SOURCE, /const \[\{ isDetailPanelOpen, mode \}, dispatchView\] = useReducer\(/u);
	assert.match(WORKSPACE_SOURCE, /function reduceWorkspaceView\(/u);
	assert.match(WORKSPACE_SOURCE, /const viewButtonRefs = useRef\(new Map<string, HTMLButtonElement>\(\)\);/u);
	assert.match(
		WORKSPACE_SOURCE,
		/const focusWhenReady = \(\) => \{[\s\S]*focusRestoreControlRef\.current === "row"[\s\S]*rowButtonRefs\.current\.get\(itemId\)[\s\S]*viewButtonRefs\.current\.get\(itemId\);[\s\S]*button\.focus\(\);/u,
	);
	assert.match(WORKSPACE_SOURCE, /const shouldRestoreFocusRef = useRef\(false\);/u);
	assert.match(WORKSPACE_SOURCE, /shouldRestoreFocusRef\.current = event\.detail === 0;/u);
	assert.match(WORKSPACE_SOURCE, /if \(!shouldRestoreFocusRef\.current\) \{\s*event\.currentTarget\.blur\(\);\s*\}/u);
	assert.match(WORKSPACE_SOURCE, /const handleOpenItem = useCallback\(\(item: JiraForYouItem\) => \{[\s\S]*dispatchView\(\{\s*type: "open-assigned",\s*itemId: item\.id,\s*detailPanelOpen: !isNarrow,/u);
	assert.match(WORKSPACE_SOURCE, /pendingFocusRestoreItemIdRef\.current = shouldRestoreFocusRef\.current[\s\S]*\? focusRestoreItemIdRef\.current[\s\S]*: null;[\s\S]*dispatchView\(\{ type: "close" \}\);/u);
	assert.match(WORKSPACE_SOURCE, /createRovoAppUserMessage/u);
	assert.match(WORKSPACE_SOURCE, /createId\("jira-for-you-user"\)/u);
	assert.doesNotMatch(WORKSPACE_SOURCE, /onAgentPrompt=/u);
	assert.match(WORKSPACE_SOURCE, /<JiraForYouConversation[\s\S]*key=\{`\$\{assignedItemData\.item\.id\}:\$\{selectedAgentSession\.id\}`\}/u);
	assert.match(WORKSPACE_SOURCE, /const WIDE_FEED_MIN_WIDTH_PX = 420;/u);
	assert.match(WORKSPACE_SOURCE, /maxWidth: `calc\(100% - \$\{WIDE_FEED_MIN_WIDTH_PX\}px\)`/u);
	assert.match(WORKSPACE_SOURCE, /\? "relative shrink-0"/u);
	assert.match(WORKSPACE_SOURCE, /hasResizableChatSplit \? "h-full overflow-y-auto" : undefined/u);
	assert.match(WORKSPACE_SOURCE, /onItemClick=\{\(item, event\) => handleItemActivate\(item, "row", event\)\}/u);
	assert.match(WORKSPACE_SOURCE, /onView=\{\(item, event\) => handleItemActivate\(item, "view", event\)\}/u);
	assert.match(WORKSPACE_SOURCE, /detailPanelInsetPx=\{\s*isDetailPanelOpen && !isNarrow\s*\?\s*detailPanelResize\.sidebarWidth\s*:\s*0\s*\}/u);
});

test("the workspace can keep a custom feed mounted while activating its shared item workspace", () => {
	assert.match(WORKSPACE_SOURCE, /renderFeed\?: \(controls: JiraForYouWorkspaceFeedControls\) => ReactNode;/u);
	assert.match(WORKSPACE_SOURCE, /onItemActivate: \(item: JiraForYouItem\) => void;/u);
	assert.match(WORKSPACE_SOURCE, /renderFeed \? \([\s\S]*activeItemId: activeItemId \?\? undefined,[\s\S]*onItemActivate: handleOpenItem/u);
	assert.match(WORKSPACE_SOURCE, /className=\{cn\(\s*"min-h-0 min-w-0"/u);
	assert.match(WORKSPACE_SOURCE, /feedResizeLabel = "Resize For you list panel"/u);
	assert.match(WORKSPACE_SOURCE, /aria-label=\{feedResizeLabel\}/u);
});

test("an owning workspace can opt into an initially open item and details panel", () => {
	assert.match(WORKSPACE_SOURCE, /defaultDetailPanelOpen\?: boolean;/u);
	assert.match(WORKSPACE_SOURCE, /defaultOpenItemId\?: string;/u);
	assert.match(WORKSPACE_SOURCE, /function createInitialWorkspaceView\(/u);
	assert.match(WORKSPACE_SOURCE, /if \(!defaultOpenItemId\)[\s\S]*kind: "feed"/u);
	assert.match(WORKSPACE_SOURCE, /itemData\.kind === "unassigned"[\s\S]*kind: "unassigned-agent-session"/u);
	assert.match(WORKSPACE_SOURCE, /isDetailPanelOpen: defaultDetailPanelOpen,[\s\S]*kind: "assigned-chat"/u);
	assert.match(WORKSPACE_SOURCE, /createInitialWorkspaceView\([\s\S]*workspaceData,[\s\S]*defaultOpenItemId,[\s\S]*defaultDetailPanelOpen/u);
});

test("the assigned chat split exposes a draggable, keyboard-accessible list separator", () => {
	assert.match(WORKSPACE_SOURCE, /const FEED_PANEL_DEFAULT_WIDTH_PX = 520;/u);
	assert.match(WORKSPACE_SOURCE, /const feedPanelResize = useSidebarResize\(\{/u);
	assert.match(WORKSPACE_SOURCE, /defaultWidth: preserveChatWidthAcrossSidebar[\s\S]*FEED_PANEL_DEFAULT_WIDTH_PX - ROVO_APP_SEPARATOR_LINE_OFFSET_PX[\s\S]*: FEED_PANEL_DEFAULT_WIDTH_PX/u);
	assert.match(WORKSPACE_SOURCE, /const hasResizableChatSplit = mode\.kind === "assigned-chat" && !isNarrow;/u);
	assert.match(WORKSPACE_SOURCE, /const currentShellSidebarWidth = Math\.max\(0, viewportWidth - workspaceWidth\);/u);
	assert.match(WORKSPACE_SOURCE, /const feedPanelSidebarCompensation = preserveChatWidthAcrossSidebar[\s\S]*ROVO_APP_SEPARATOR_LINE_OFFSET_PX - currentShellSidebarWidth/u);
	assert.match(WORKSPACE_SOURCE, /const effectiveFeedPanelWidth = Math\.max\([\s\S]*feedPanelResize\.sidebarWidth \+ feedPanelSidebarCompensation/u);
	assert.match(WORKSPACE_SOURCE, /flex: `0 0 \$\{effectiveFeedPanelWidth\}px`/u);
	assert.match(WORKSPACE_SOURCE, /style=\{wideFeedPanelStyle\}/u);
	assert.match(WORKSPACE_SOURCE, /isNarrow[\s\S]*\? "absolute inset-0 z-10"[\s\S]*: "relative flex flex-1"/u);
	assert.match(
		WORKSPACE_SOURCE,
		/<SidebarResizeHandle[\s\S]*aria-label=\{feedResizeLabel\}[\s\S]*data-testid="jira-for-you-feed-resize-handle"[\s\S]*onKeyDown=\{feedPanelResize\.onResizeHandleKeyDown\}[\s\S]*onPointerDown=\{feedPanelResize\.onResizeHandlePointerDown\}[\s\S]*role="separator"[\s\S]*side="right"/u,
	);
});

test("the conversation workspace reuses fullscreen chat primitives and a back path", () => {
	assert.match(CONVERSATION_SOURCE, /import \{ ChatMessages \} from "@\/components\/projects\/shared\/components\/chat-messages";/u);
	assert.match(CONVERSATION_SOURCE, /import \{ RovoAppComposer \} from "@\/components\/projects\/rovo\/components\/rovo-app-composer";/u);
	assert.match(CONVERSATION_SOURCE, /import ArrowLeftIcon from "@atlaskit\/icon\/core\/arrow-left";/u);
	assert.match(CONVERSATION_SOURCE, /aria-label="Back to For you feed"/u);
	assert.match(CONVERSATION_SOURCE, /<Button[\s\S]*aria-label="Back to For you feed"[\s\S]*size="icon"[\s\S]*variant="ghost"/u);
	assert.ok(CONVERSATION_SOURCE.includes('<Icon aria-hidden render={<ArrowLeftIcon label="" />} />'));
	assert.match(CONVERSATION_SOURCE, /aria-label=\{isDetailPanelOpen \? "Close detail panel" : "Open detail panel"\}/u);
	assert.match(CONVERSATION_SOURCE, /aria-expanded=\{isDetailPanelOpen\}/u);
	assert.match(CONVERSATION_SOURCE, /const conversationColumnStyle =\s*detailPanelInsetPx > 0\s*\?\s*\{ maxWidth: `calc\(100% - \$\{detailPanelInsetPx\}px\)` \}\s*:\s*undefined/u);
	assert.match(CONVERSATION_SOURCE, /className="flex min-h-0 min-w-0 flex-1 flex-col"[\s\S]*data-testid="jira-for-you-conversation-pane"[\s\S]*style=\{conversationColumnStyle\}/u);
	assert.ok(CONVERSATION_SOURCE.includes('contentClassName="mx-auto flex min-w-0 w-full max-w-[800px] px-3 md:px-6"'));
	assert.ok(CONVERSATION_SOURCE.includes('className="mx-auto flex min-w-0 w-full max-w-[800px] flex-col px-3 pt-3 md:px-6"'));
	assert.match(CONVERSATION_SOURCE, /import \{ JiraForYouIssueTypeIcon \} from "\.\/jira-for-you-item";/u);
	assert.match(CONVERSATION_SOURCE, /mainView === "work-item" \? \([\s\S]*<JiraForYouIssueTypeIcon issueType=\{item\.issueType\} \/>[\s\S]*\{item\.title\}[\s\S]*\) : \([\s\S]*<AgentAvatarVisual/u);
	assert.match(CONVERSATION_SOURCE, /<p className="truncate text-sm font-semibold text-text">\s*\{selectedAgentSession\.profile\.name\}\s*<\/p>/u);
	assert.match(ITEM_SOURCE, /export function JiraForYouIssueTypeIcon\([\s\S]*ISSUE_TYPE_META\[issueType\][\s\S]*render=\{<Glyph label="" \/>\}/u);
	assert.doesNotMatch(CONVERSATION_SOURCE, /\{isNarrow \? null : <span>Back<\/span>\}/u);
	assert.match(CONVERSATION_SOURCE, /messageMode="ask"/u);
	assert.match(CONVERSATION_SOURCE, /showFeedbackActions=\{false\}/u);
	assert.match(CONVERSATION_SOURCE, /showFollowUpSuggestions=\{false\}/u);
	assert.match(CONVERSATION_SOURCE, /hideSourceAndModelControls/u);
	assert.match(CONVERSATION_SOURCE, /hideReasoningSelector/u);
	assert.doesNotMatch(CONVERSATION_SOURCE, /showSubmitWhenEmpty/u);
	assert.match(CONVERSATION_SOURCE, /const realtime = useRealtimeVoice\(/u);
	assert.match(CONVERSATION_SOURCE, /onToggleRealtimeVoice=\{handleToggleRealtimeVoice\}/u);
	assert.match(CONVERSATION_SOURCE, /realtimeVoiceActive=\{realtime\.voiceState !== "idle"\}/u);
	assert.match(CONVERSATION_SOURCE, /realtimeVoiceState=\{realtime\.voiceState\}/u);
	assert.match(COMPOSER_CARD_SOURCE, /<RovoComposerSendControls/u);
	assert.match(SIDEBAR_COMPOSER_SOURCE, /<ChatComposerSendControls/u);
	assert.doesNotMatch(CONVERSATION_SOURCE, /PromptInputSubmit|RovoComposerSendControls/u);
	assert.match(CONVERSATION_SOURCE, /data-testid="jira-for-you-composer-region"/u);
	assert.doesNotMatch(CONVERSATION_SOURCE, /shrink-0 border-t border-border bg-background\/90/u);
	assert.match(CONVERSATION_SOURCE, /<Footer \/>/u);
});

test("waiting Jira For You sessions show the shared awaiting indicator and question card", () => {
	assert.match(WORKSPACE_TYPES_SOURCE, /awaitingQuestions\?: readonly QuestionCardQuestion\[\];/u);
	assert.match(WORKSPACE_DATA_SOURCE, /id: "unapproved-claims-treatment"[\s\S]*label: "How should I handle the unapproved claims\?"/u);
	assert.match(WORKSPACE_DATA_SOURCE, /awaitingQuestions: agentSeed\?\.awaitingQuestions/u);
	assert.match(CONVERSATION_SOURCE, /showAwaitingIndicator=\{shouldShowAwaitingQuestion\}/u);
	assert.match(CONVERSATION_SOURCE, /<QuestionCard[\s\S]*isSubmitting=\{isQuestionSubmitting\}[\s\S]*questions=\{awaitingQuestions\}/u);
	assert.match(CONVERSATION_SOURCE, /<QuestionCardShortcutsFooter \/>/u);
	assert.match(CONVERSATION_SOURCE, /shouldShowAwaitingQuestion && awaitingQuestions \? \([\s\S]*<QuestionCard[\s\S]*\) : \([\s\S]*<RovoAppComposer/u);
});

test("assigned workspaces switch independently between chat, work item, and details", () => {
	assert.match(CONVERSATION_SOURCE, /import dynamic from "next\/dynamic";/u);
	assert.match(
		CONVERSATION_SOURCE,
		/const JiraForYouWorkItemView = dynamic\(\(\) =>\s*import\("\.\/jira-for-you-work-item-view"\)\.then\(\(module\) => module\.JiraForYouWorkItemView\),\s*\);/u,
	);
	assert.doesNotMatch(
		CONVERSATION_SOURCE,
		/import \{ JiraForYouWorkItemView \} from "\.\/jira-for-you-work-item-view";/u,
	);
	assert.match(WORKSPACE_SOURCE, /import dynamic from "next\/dynamic";/u);
	assert.match(
		WORKSPACE_SOURCE,
		/const JiraForYouWorkItemWorkspace = dynamic\(\(\) =>\s*import\("\.\/jira-for-you-work-item-workspace"\)\.then\(\s*\(module\) => module\.JiraForYouWorkItemWorkspace,\s*\),\s*\);/u,
	);
	assert.doesNotMatch(
		WORKSPACE_SOURCE,
		/import \{ JiraForYouWorkItemWorkspace \} from "\.\/jira-for-you-work-item-workspace";/u,
	);
	assert.match(CONVERSATION_SOURCE, /import \{ ToggleGroup, ToggleGroupItem \} from "@\/components\/ui\/toggle-group";/u);
	assert.match(CONVERSATION_SOURCE, /const \[mainView, setMainView\] = useState<JiraForYouMainView>\("chat"\);/u);
	assert.match(CONVERSATION_SOURCE, /<ToggleGroup[\s\S]*aria-label="Workspace view"[\s\S]*className="h-8 bg-surface"[\s\S]*value=\{\[mainView\]\}[\s\S]*variant="outline"/u);
	assert.match(CONVERSATION_SOURCE, /<ToggleGroupItem[\s\S]*aria-label="Chat view"[\s\S]*\[&:not\(\[data-pressed\]\)_\[data-slot=icon\]\]:text-text-subtle![\s\S]*\[&:not\(\[data-pressed\]\)_svg\]:text-text-subtle![\s\S]*<Icon aria-hidden render=\{<CommentIcon/u);
	assert.match(CONVERSATION_SOURCE, /<ToggleGroupItem[\s\S]*aria-label="Work item view"[\s\S]*\[&:not\(\[data-pressed\]\)_\[data-slot=icon\]\]:text-text-subtle![\s\S]*\[&:not\(\[data-pressed\]\)_svg\]:text-text-subtle![\s\S]*<Icon aria-hidden render=\{<WorkItemIcon/u);
	assert.doesNotMatch(CONVERSATION_SOURCE, /<Icon aria-hidden className="text-text-subtle" render=\{<(?:CommentIcon|WorkItemIcon)/u);
	assert.match(CONVERSATION_SOURCE, /aria-label=\{isDetailPanelOpen \? "Close detail panel" : "Open detail panel"\}[\s\S]*className="size-8 aria-expanded:\[&_\[data-slot=icon\]\]:text-icon-selected! aria-expanded:\[&_svg\]:text-icon-selected!"[\s\S]*size="icon"[\s\S]*variant="outline"[\s\S]*<Icon aria-hidden render=\{<PanelRightIcon/u);
	assert.match(CONVERSATION_SOURCE, /mainView === "chat"[\s\S]*<JiraForYouWorkItemView details=\{details\} item=\{item\} \/>/u);
	assert.match(WORK_ITEM_VIEW_SOURCE, /import \{ ExperimentalJiraWorkItem \}/u);
	assert.match(
		WORK_ITEM_VIEW_SOURCE,
		/className="flex min-h-0 w-full flex-1 overflow-hidden"/u,
	);
	assert.match(
		WORK_ITEM_VIEW_SOURCE,
		/<ExperimentalJiraWorkItem[\s\S]*defaultMetadataCollapsed[\s\S]*initialPreset="filled"[\s\S]*inlineSurface="fill"[\s\S]*key=\{item\.id\}[\s\S]*presentation="inline"[\s\S]*workItem=\{mapJiraForYouItemToWorkItem\(item\)\}/u,
	);
	assert.match(WORKSPACE_SOURCE, /<JiraForYouConversation[\s\S]*details=\{assignedItemData\.details\}/u);
	assert.match(WORK_ITEM_VIEW_SOURCE, /outputs=\{details\.outputs\.map\(\(output\) => output\.title\)\}/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /context=\{<ContextPanel outputs=\{props\.outputs\} \/>\}/u);
	assert.match(JIRA_WORK_ITEM_WORKSPACE_SOURCE, /className="flex min-h-0 flex-1 overflow-hidden"/u);
	assert.match(
		JIRA_WORK_ITEM_WORKSPACE_SOURCE,
		/<ExperimentalJiraWorkItem[\s\S]*defaultMetadataCollapsed[\s\S]*initialPreset="blank"[\s\S]*inlineSurface="fill"[\s\S]*presentation="inline"/u,
	);
	assert.match(JIRA_WORK_ITEM_SOURCE, /<PanelLayoutProvider defaultMetadataCollapsed=\{props\.defaultMetadataCollapsed \?\? false\}>/u);
	assert.match(PANEL_LAYOUT_SOURCE, /defaultMetadataCollapsed = false/u);
	assert.match(PANEL_LAYOUT_SOURCE, /useState\(defaultMetadataCollapsed\)/u);
	assert.match(CONTEXT_TITLE_BAR_SOURCE, /<ContextTitleActions collapsed=\{collapsed\} primaryAgentId=\{primaryAgentId\} \/>/u);
	assert.match(CONTEXT_TITLE_BAR_SOURCE, /collapsed=\{metadataCollapsed\}/u);
	assert.match(CONTEXT_TITLE_ACTIONS_SOURCE, /<ButtonGroup variant="split">[\s\S]*Open with \$\{primaryCodingAgent\.label\}/u);
	assert.match(CONTEXT_TITLE_ACTIONS_SOURCE, /\{collapsed \? \([\s\S]*<Button aria-label="Actions" size="icon" variant="outline">/u);
	assert.match(WORK_ITEM_DIALOG_SOURCE, /const fillsInlineContainer = presentation === "inline" && inlineSurface === "fill";/u);
	assert.match(WORK_ITEM_DIALOG_SOURCE, /borderRadius: fillsInlineContainer \? 0 : token\("radius\.xlarge"\)/u);
	assert.match(WORK_ITEM_DIALOG_SOURCE, /boxShadow: fillsInlineContainer \? "none" : token\("elevation\.shadow\.overlay"\)/u);
	assert.match(WORK_ITEM_DIALOG_SOURCE, /fillsInlineContainer \? "h-full min-h-0 max-w-none flex-1 shrink" : null/u);
	assert.match(JIRA_WORK_ITEM_SOURCE, /fillContainer=\{inlineSurface === "fill"\}/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /fillContainer = false/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /const contentColumnStyle = fillContainer \? undefined : constrainedColumnStyle;/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /const innerColumnStyle = fillContainer \? constrainedColumnStyle : undefined;/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /data-jira-work-item-scroll-region[\s\S]*style=\{innerColumnStyle\}/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /p-6 data-\[fill-container\]:pb-0[\s\S]*data-fill-container=\{fillContainer \? "" : undefined\}/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /className="[^"]*sticky bottom-0[^"]*bg-transparent[^"]*pb-4[^"]*@\[860px\]\/agentlayout:pb-6"[\s\S]*data-jira-work-item-composer-dock/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /ref: narrowScrollRef,[\s\S]*showBottomScrollMask: showNarrowBottomScrollMask,[\s\S]*ref=\{narrowScrollRef\}/u);
	assert.match(WORK_ITEM_LAYOUT_SOURCE, /showNarrowBottomScrollMask[\s\S]*data-jira-work-item-narrow-scroll-mask[\s\S]*NARROW_BOTTOM_SCROLL_MASK_BLUR_LAYERS[\s\S]*bg-linear-to-b from-transparent to-background/u);
	assert.doesNotMatch(WORK_ITEM_VIEW_SOURCE, /WorkItemModalProvider|<WorkItemModal\./u);
});

test("the header wraps tabs beneath the title when space gets tight without moving the search field into that row", () => {
	assert.match(HEADER_SOURCE, /className="@container flex min-w-0 flex-col gap-4 overflow-x-hidden"/u);
	assert.match(HEADER_SOURCE, /@max-\[28rem\]:flex-col[\s\S]*@max-\[28rem\]:gap-y-4/u);
	assert.match(HEADER_SOURCE, /<h2 className="shrink-0 text-text"/u);
	assert.match(HEADER_SOURCE, /className="min-w-0 max-w-full flex-none @max-\[28rem\]:w-full"/u);
	assert.match(HEADER_SOURCE, /<TabsList className="h-auto w-max max-w-full flex-nowrap justify-start overflow-x-auto @max-\[28rem\]:w-full">/u);
	assert.match(HEADER_SOURCE, /@max-\[28rem\]:min-w-12/u);
	assert.match(HEADER_SOURCE, /@max-\[28rem\]:flex-\[1_1_auto\]/u);
	assert.match(HEADER_SOURCE, /<span className="min-w-0 flex-1 truncate">\{tab\.label\}<\/span>/u);
	assert.match(HEADER_SOURCE, /<InputGroup className="min-w-0">/u);
});

test("the detail panel includes an Agents selector and agent-specific details content", () => {
	assert.match(DETAIL_PANEL_SOURCE, /import type \{ JiraSidebarSessionStatus \}/u);
	assert.match(DETAIL_PANEL_SOURCE, /AgentList/u);
	assert.match(DETAIL_PANEL_SOURCE, /AgentListItem/u);
	assert.match(DETAIL_PANEL_SOURCE, /aria-labelledby="jira-for-you-agents-heading"/u);
	assert.match(DETAIL_PANEL_SOURCE, /<JiraSessionSectionHeading id="jira-for-you-agents-heading">Agents<\/JiraSessionSectionHeading>/u);
	assert.match(DETAIL_PANEL_SOURCE, /items=\{sessionItems\}/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /onSubmitPrompt=/u);
	assert.match(DETAIL_PANEL_SOURCE, /onView=\{\(sessionItem\) => onAgentSelect\(sessionItem\.id\)\}/u);
	assert.match(DETAIL_PANEL_SOURCE, /selectedItemId=\{selectedAgentId\}/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /Shimmer|JiraSessionLifecycle|TileAvatar|<Tag/u);
	assert.match(DETAIL_PANEL_SOURCE, /<JiraSessionFlyoutBody[\s\S]*hideAgentRow[\s\S]*session=\{details\.session\}/u);
	assert.match(DETAIL_PANEL_SOURCE, /<DetailArtifacts details=\{details\} \/>/u);
	assert.match(SESSION_FLYOUT_SOURCE, /hideAgentRow = false/u);
	assert.match(SESSION_FLYOUT_SOURCE, /\{hideAgentRow \? null : \(\s*<FlyoutRow[\s\S]*label="Agent"/u);
	assert.match(DETAIL_PANEL_SOURCE, /<SmartLink align="center" alignOffset=\{0\} className="max-w-full" item=\{source\} side="left" \/>/u);
	assert.match(DETAIL_PANEL_SOURCE, /<AttachmentPreviewCard/u);
	assert.doesNotMatch(DETAIL_PANEL_SOURCE, /<Button[\s\S]*variant="outline"/u);
	assert.match(DETAIL_PANEL_SOURCE, /function getPanelVariants\(/u);
	assert.match(DETAIL_PANEL_SOURCE, /const panelVariants = getPanelVariants\(isNarrow, shouldReduceMotion\);/u);
	assert.match(DETAIL_PANEL_SOURCE, /data-testid="jira-for-you-detail-resize-handle"/u);
	assert.match(DETAIL_PANEL_SOURCE, /isNarrow \? "absolute inset-0" : "absolute inset-y-0 right-0"/u);
	const developmentIndex = DETAIL_PANEL_SOURCE.indexOf("<JiraSessionFlyoutBody");
	const agentIndex = DETAIL_PANEL_SOURCE.indexOf("<AgentSection");
	const artifactsIndex = DETAIL_PANEL_SOURCE.indexOf("<DetailArtifacts");
	assert.ok(developmentIndex >= 0 && agentIndex >= 0 && artifactsIndex >= 0);
	assert.ok(developmentIndex < agentIndex);
	assert.ok(agentIndex < artifactsIndex);
});

test("workspace data stays deterministic, supports multi-agent items, and exhaustively maps statuses", () => {
	assert.match(WORKSPACE_DATA_SOURCE, /const WORKSPACE_ITEM_SEEDS/u);
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/"crm-analytics-dashboard":[\s\S]*"readiness-checker":[\s\S]*"code-reviewer":[\s\S]*"feedback-analyzer":/u,
	);
	assert.doesNotMatch(WORKSPACE_DATA_SOURCE, /getFallbackAgents|return \[\{\s*id: rovo\.id/u);
	assert.match(WORKSPACE_DATA_SOURCE, /if \(!item\.agents\?\.length\) \{[\s\S]*kind: "unassigned"/u);
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/const profile = getRovoAgentProfile\(agent\.id\);[\s\S]*return profile;/u,
	);
	assert.doesNotMatch(WORKSPACE_DATA_SOURCE, /avatarSrc: agent\.avatarSrc/u);
	assert.doesNotMatch(WORKSPACE_DATA_SOURCE, /name: agent\.name/u);
	assert.match(WORKSPACE_DATA_SOURCE, /status: agentSeed\?\.status \?\? sidebarStatus/u);
	assert.match(WORKSPACE_DATA_SOURCE, /kind: "assigned"/u);
	assert.match(
		WORKSPACE_DATA_SOURCE,
		/switch \(status\) \{[\s\S]*case "Review":[\s\S]*case "To do":[\s\S]*case "In progress":[\s\S]*case "In review":[\s\S]*case "Done":[\s\S]*const exhaustiveStatus: never = status;/u,
	);
	assert.match(WORKSPACE_DATA_SOURCE, /export function createJiraForYouWorkspaceData/u);
	assert.match(WORKSPACE_DATA_SOURCE, /const items = sections\.flatMap\(\(section\) => section\.items\);/u);
	assert.match(WORKSPACE_TYPES_SOURCE, /JiraForYouWorkspaceItemDetails/u);
	assert.match(WORKSPACE_TYPES_SOURCE, /details: JiraForYouWorkspaceItemDetails;/u);
	assert.doesNotMatch(WORKSPACE_TYPES_SOURCE, /interface JiraForYouWorkspaceAgentSession \{[^}]*outputs:/u);
	assert.doesNotMatch(WORKSPACE_TYPES_SOURCE, /interface JiraForYouWorkspaceAgentSession \{[^}]*sources:/u);
	assert.doesNotMatch(WORKSPACE_TYPES_SOURCE, /interface JiraForYouWorkspaceAgentSession \{[^}]*session:/u);
	assert.match(WORKSPACE_DATA_SOURCE, /details: createWorkspaceItemDetails/u);
});

test("the project demo and docs present the workspace instead of the list-only surface", () => {
	assert.match(WORKSPACE_SOURCE, /chrome\?: "framed" \| "plain";/u);
	assert.match(WORKSPACE_SOURCE, /chrome === "framed" \? "rounded-lg border border-border" : "rounded-\[inherit\]"/u);
	assert.match(DEMO_SOURCE, /import \{ JiraForYouWorkspace \} from "@\/components\/projects\/jira-for-you";/u);
	assert.match(DEMO_SOURCE, /const isStandalonePreview = pathname\.startsWith\("\/preview\/"\);/u);
	assert.match(DEMO_SOURCE, /<div className="h-full min-h-0 overflow-hidden rounded-lg border border-border bg-surface">/u);
	assert.match(DEMO_SOURCE, /<JiraForYouWorkspace chrome="plain" className="h-full min-h-0" \/>/u);
	assert.match(DETAIL_DOC_SOURCE, /"jira-for-you": \{/u);
	assert.match(DETAIL_DOC_SOURCE, /importStatement: `import \{ JiraForYouWorkspace \} from "@\/components\/projects\/jira-for-you";`/u);
	assert.match(DETAIL_DOC_SOURCE, /previewHeight: "fixed"/u);
	assert.match(DETAIL_DOC_SOURCE, /previewContentWidth: "full"/u);
});

test("the conversation header border can be disabled by an owning workspace", () => {
	assert.match(CONVERSATION_SOURCE, /showHeaderBorder\?: boolean;/u);
	assert.match(CONVERSATION_SOURCE, /showHeaderBorder = true,/u);
	assert.match(CONVERSATION_SOURCE, /showHeaderBorder && "border-b border-border"/u);
	assert.match(WORKSPACE_SOURCE, /showConversationHeaderBorder\?: boolean;/u);
	assert.match(WORKSPACE_SOURCE, /showHeaderBorder=\{showConversationHeaderBorder\}/u);
	assert.match(PAGE_SOURCE, /showConversationHeaderBorder\?: boolean;/u);
	assert.match(PAGE_SOURCE, /showConversationHeaderBorder=\{showConversationHeaderBorder\}/u);
});

test("the Jira workspace conversation starts messages 16px below its header", () => {
	assert.match(CONVERSATION_SOURCE, /contentTopPadding="16px"/u);
	assert.doesNotMatch(CONVERSATION_SOURCE, /contentTopPadding="24px"/u);
});

test("Jira For You is cataloged and searched as a project", () => {
	const blockManifestSource = COMPONENT_MANIFEST_SOURCE.slice(
		COMPONENT_MANIFEST_SOURCE.indexOf("export const BLOCK_COMPONENTS"),
		COMPONENT_MANIFEST_SOURCE.indexOf("export const PROJECT_COMPONENTS"),
	);
	const projectManifestSource = COMPONENT_MANIFEST_SOURCE.slice(
		COMPONENT_MANIFEST_SOURCE.indexOf("export const PROJECT_COMPONENTS"),
		COMPONENT_MANIFEST_SOURCE.indexOf("export const ART_COMPONENTS"),
	);

	assert.doesNotMatch(blockManifestSource, /jira-for-you/u);
	assert.match(projectManifestSource, /projectComponent\("jira-for-you", "Jira For You"\)/u);
	assert.match(
		SIDEBAR_NAV_SOURCE,
		/title: "Projects",[\s\S]*items: PROJECT_COMPONENTS\.map[\s\S]*href: `\/components\/projects\/\$\{component\.slug\}`/u,
	);
});

test("the reusable Jira shell owns sidebar state, sidebar chat fallback, and the full-height workspace", () => {
	assert.match(PAGE_SOURCE, /import \{ useState, type ReactNode \} from "react";/u);
	assert.match(PAGE_SOURCE, /import AppLayout from "@\/components\/projects\/page";/u);
	assert.match(PAGE_SOURCE, /chatPanelFlush/u);
	assert.match(PAGE_SOURCE, /hideFloatingRovo/u);
	assert.match(PAGE_SOURCE, /hideRovoAction/u);
	assert.match(PAGE_SOURCE, /import \{ JiraSidebar \} from "@\/components\/blocks\/product-sidebar\/variants\/jira";/u);
	assert.match(PAGE_SOURCE, /defaultSelectedSidebarItem = "For you"/u);
	assert.match(PAGE_SOURCE, /defaultSidebarOpen = true/u);
	assert.match(PAGE_SOURCE, /<AppLayout[\s\S]*defaultSidebarOpen=\{defaultSidebarOpen\}/u);
	assert.match(PAGE_SOURCE, /const \[selectedSidebarItem, setSelectedSidebarItem\] = useState\(defaultSelectedSidebarItem\);/u);
	assert.match(PAGE_SOURCE, /shellHeight=\{shellHeight\}/u);
	assert.match(PAGE_SOURCE, /sidebarContent=\{\(\s*<JiraSidebar[\s\S]*onSelectItem=\{setSelectedSidebarItem\}[\s\S]*selectedItem=\{selectedSidebarItem\}/u);
	assert.match(PAGE_SOURCE, /topNavigationSearchAlignment="sidebar"/u);
	assert.match(PAGE_SOURCE, /<section aria-label="For you" className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background">/u);
	assert.match(PAGE_SOURCE, /children\?: ReactNode;/u);
	assert.match(PAGE_SOURCE, /\{children \?\? \(/u);
	assert.match(PAGE_SOURCE, /<JiraForYouWorkspace[\s\S]*chrome="plain"[\s\S]*className="h-full min-h-0 flex-1"[\s\S]*\/>/u);
	assert.match(PREVIEW_PAGE_SOURCE, /<JiraForYouShell \/>/u);
});
