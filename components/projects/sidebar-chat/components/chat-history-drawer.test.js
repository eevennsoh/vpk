const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

test("compact chat history drawer wires thread actions to the shared rovo provider", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");

	assert.match(source, /threads\.map/u);
	assert.match(source, /selectThread/u);
	assert.match(source, /onSelectThread=\{handleSelectThread\}/u);
	assert.match(source, /onDeleteThread=\{deleteThread\}/u);
	assert.match(source, /onCancelThreadRun=\{cancelThreadRun\}/u);
	assert.match(source, /closeHistory/u);
	assert.match(source, /resetChat\(\)/u);
	assert.match(source, /void refreshThreads\(\)/u);
	assert.match(source, /<Empty width="narrow" className="gap-4 px-3 py-0">/u);
	assert.match(source, /<EmptyDescription>[\s\S]*Start a new chat to see it here\./u);
	assert.match(source, /<Button variant="outline" size="default" onClick=\{handleNewChat\}>[\s\S]*New chat/u);
	assert.doesNotMatch(source, /rounded-lg border border-border/u);
});

test("active compact chat surfaces own one contained history drawer", () => {
	const chatPanelSource = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const appLayoutSource = readProjectFile("components/projects/page.tsx");
	const floatingSource = readProjectFile("components/projects/rovo-floating-chat/components/rovo-floating-chat.tsx");

	assert.doesNotMatch(appLayoutSource, /ChatHistoryDrawer/u);
	assert.match(chatPanelSource, /const isHeaderHistoryEnabled = !hideHeader && headerVariant === "default";/u);
	assert.match(chatPanelSource, /const shouldRenderHeaderHistory = isHeaderHistoryEnabled && chatSurface !== "floating";/u);
	assert.match(chatPanelSource, /<ChatHistoryDrawer active=\{shouldRenderHeaderHistory\} \/>/u);
	assert.match(chatPanelSource, /chatHistory \? \([\s\S]*<ControlledChatHistoryDrawer[\s\S]*selectThread=\{chatHistory\.selectThread\}[\s\S]*threads=\{chatHistory\.threads\}/u);
	assert.match(chatPanelSource, /variant=\{headerVariant\}/u);
	assert.match(floatingSource, /showChatHistory \? <ChatHistoryDrawer \/> : null/u);
	assert.match(chatPanelSource, /onHistoryToggle=\{toggleHistory\}/u);
	assert.match(chatPanelSource, /onNewChat=\{handleNewChat\}/u);
	assert.doesNotMatch(chatPanelSource, /currentThreadHasRichState/u);
	assert.doesNotMatch(chatPanelSource, /This thread includes fullscreen-only state\./u);
});

test("compact chat hamburger buttons open the shared history drawer", () => {
	const sidebarHeader = readProjectFile("components/projects/sidebar-chat/components/chat-header.tsx");
	const floatingHeader = readProjectFile("components/projects/rovo-floating-chat/components/floating-chat-header.tsx");
	const historyButton = readProjectFile("components/projects/sidebar-chat/components/chat-history-button.tsx");

	assert.match(sidebarHeader, /<RovoAgentBackButton onBack=\{onBackToRovo\} \/>/u);
	assert.match(floatingHeader, /<RovoAgentBackButton \/>/u);
	for (const source of [sidebarHeader, floatingHeader]) {
		assert.match(source, /<ChatHistoryButton isHistoryOpen=\{isHistoryOpen\} onToggle=\{onHistoryToggle\} \/>/u);
	}

	assert.match(historyButton, /aria-label="Chat history"/u);
	assert.match(historyButton, /aria-expanded=\{isHistoryOpen\}/u);
	assert.match(historyButton, /aria-controls="rovo-chat-history-drawer"/u);
	assert.match(historyButton, /onClick=\{onToggle \?\? noop\}/u);
});

test("compact chat header lets long agent names truncate before its actions", () => {
	const sidebarHeader = readProjectFile("components/projects/sidebar-chat/components/chat-header.tsx");
	const appBrand = readProjectFile("components/projects/rovo-core/components/rovo-app-brand.tsx");

	assert.match(sidebarHeader, /className="flex min-w-0 flex-1 items-center gap-1"/u);
	assert.match(sidebarHeader, /className="flex shrink-0 items-center gap-1"/u);
	assert.match(appBrand, /className="h-8 min-w-0 shrink gap-1\.5 px-2 text-sm font-medium text-text"/u);
	assert.match(appBrand, /className="min-w-0 truncate font-semibold"/u);
});

test("minimal compact chat header suppresses history and action controls", () => {
	const chatPanelSource = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const sidebarHeader = readProjectFile("components/projects/sidebar-chat/components/chat-header.tsx");
	const rovoCanvasRail = readProjectFile("components/blocks/rovo-canvas/components/rovo-canvas-right-rail.tsx");

	assert.match(chatPanelSource, /headerVariant\?: "default" \| "minimal";/u);
	assert.match(chatPanelSource, /headerVariant = "default"/u);
	assert.match(sidebarHeader, /const showControls = variant === "default";/u);
	assert.match(sidebarHeader, /\{showControls \? \([\s\S]*<ChatHistoryButton/u);
	assert.match(sidebarHeader, /\{showControls \? \([\s\S]*aria-label="New chat"[\s\S]*aria-label="More"[\s\S]*aria-label="Close"/u);
	assert.match(rovoCanvasRail, /headerVariant="minimal"/u);
});

test("custom agent compact chat renders view tabs below the header", () => {
	const chatPanelSource = readProjectFile("components/projects/sidebar-chat/page.tsx");

	assert.match(chatPanelSource, /import \{ Tabs, TabsContent, TabsList, TabsTrigger \} from "@\/components\/ui\/tabs";/u);
	assert.match(chatPanelSource, /export interface ChatPanelCustomAgentTabs \{[\s\S]*activity\?: ReactNode;[\s\S]*trigger\?: ReactNode;[\s\S]*\}/u);
	assert.match(chatPanelSource, /isCustomAgentSelected,/u);
	assert.match(chatPanelSource, /customAgentTabs\?: ChatPanelCustomAgentTabs;/u);
	assert.match(chatPanelSource, /function isCustomAgentTabsProfile\(agent: \{ byline\?: string \}\): boolean \{[\s\S]*\\bcustom agent\\b/u);
	assert.match(
		chatPanelSource,
		/const shouldRenderCustomAgentTabs = !suppressCustomAgentTabs && \([\s\S]*Boolean\(customAgentTabs\) \|\|[\s\S]*\(isCustomAgentSelected && isCustomAgentTabsProfile\(selectedAgent\)\)[\s\S]*\);/u,
	);
	assert.match(chatPanelSource, /const isAgentTestEmptyState = showAgentTestControls && !hasMessages;/u);
	// The Test greeting bottom-aligns when the agent has starters (to line up with
	// the Ask Rovo greeting) and only centers when there are none.
	assert.match(chatPanelSource, /const hasTestGreetingSuggestions = \(resolvedGreeting\?\.suggestions\?\.length \?\? 0\) > 0;/u);
	assert.match(chatPanelSource, /const shouldBottomAlignAgentTestEmptyState = isAgentTestEmptyState && hasTestGreetingSuggestions;/u);
	assert.match(chatPanelSource, /const shouldCenterAgentTestEmptyState = isAgentTestEmptyState && !hasTestGreetingSuggestions;/u);
	assert.match(chatPanelSource, /const shouldUseNaturalEmptyGreeting = shouldHugEmptyGreeting \|\| isAgentTestEmptyState;/u);
	// The Test-mode chat now always lets the conversation grow to full height so
	// the composer pins to the bottom, aligning with the sidebar composer.
	assert.match(chatPanelSource, /<Conversation\s+className="min-h-0 min-w-0 flex-1"/u);
	assert.match(chatPanelSource, /<Tabs[\s\S]*aria-label="Custom agent views"[\s\S]*className=\{cn\([\s\S]*"min-h-0 min-w-0 flex-1"[\s\S]*isAgentTestEmptyState && "flex flex-col"/u);
	assert.match(chatPanelSource, /<DropdownMenuTrigger[\s\S]*aria-label="Switch version"[\s\S]*variant="ghost"[\s\S]*<Badge variant=\{selectedAgentVersion\.variant \?\? "success"\}>[\s\S]*<ChevronDownIcon label="" size="small" spacing="none" \/>/u);
	assert.match(chatPanelSource, /<DropdownMenuItem[\s\S]*onSelect=\{\(\) => \{[\s\S]*onAgentVersionChange\?\.\(version\.id\);[\s\S]*\}\}[\s\S]*elemAfter=\{version\.id === selectedAgentVersion\.id \? <CheckMarkIcon label="Selected" \/> : undefined\}/u);
	assert.match(chatPanelSource, /<TabsList[\s\S]*<TabsTrigger value="chat">Chat<\/TabsTrigger>[\s\S]*<TabsTrigger value="trigger">Trigger<\/TabsTrigger>[\s\S]*<TabsTrigger value="activity">Activity<\/TabsTrigger>/u);
	assert.match(chatPanelSource, /<Button aria-label="New chat" size="icon" variant="ghost" onClick=\{resetChat\}>[\s\S]*<EditIcon label="" \/>/u);
	assert.match(chatPanelSource, /<TabsContent[\s\S]*value="chat"[\s\S]*className="min-h-0 flex flex-1 flex-col data-\[hidden\]:hidden"[\s\S]*isAgentTestEmptyState \? \([\s\S]*<div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-3">[\s\S]*\{chatConversationBody\}[\s\S]*\{chatComposerBody\}[\s\S]*\) : \([\s\S]*chatConversationBody/u);
	assert.match(chatPanelSource, /<TabsContent value="trigger"[\s\S]*customAgentTabs\?\.trigger[\s\S]*<TabsContent value="activity"[\s\S]*customAgentTabs\?\.activity[\s\S]*<\/Tabs>[\s\S]*\{isAgentTestEmptyState \? null : chatComposerBody\}/u);
	assert.match(chatPanelSource, /const chatPanelBody = \([\s\S]*\{chatConversationBody\}[\s\S]*\{chatComposerBody\}[\s\S]*\);/u);
});

test("rovo app sidebar renders the shared chat history panel inline", () => {
	const sidebarSource = readProjectFile("components/projects/rovo/components/rovo-app-sidebar.tsx");
	const historySource = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");
	const rovoAppShellSource = readProjectFile("components/projects/rovo/components/rovo-app-shell.tsx");
	const surfaceShellSource = readProjectFile("components/projects/rovo/components/rovo-app-surface-shell.tsx");

	assert.match(sidebarSource, /ControlledChatHistoryPanel/u);
	assert.match(sidebarSource, /cancelThreadRun=\{onCancelThreadRun\}/u);
	assert.match(sidebarSource, /deleteThread=\{onDeleteThread\}/u);
	assert.match(sidebarSource, /selectThread=\{onSelectThread\}/u);
	assert.match(historySource, /label="Tasks"[\s\S]*actions=\{<HoverAddAction label="New task" \/>/u);
	assert.match(historySource, /label="Agents"[\s\S]*actions=\{<HoverAddAction label="New agent" \/>/u);
	assert.match(historySource, /label="Chats"[\s\S]*<ChatHistorySortAction[\s\S]*<HoverAddAction label="New chat" onClick=\{handleNewChat\} \/>/u);
	assert.doesNotMatch(sidebarSource, /showNavigation=\{false\}/u);
	assert.doesNotMatch(sidebarSource, /RovoAppSidebarNavItem/u);
	assert.doesNotMatch(sidebarSource, /RovoAppSidebarChatsThreadList/u);
	assert.doesNotMatch(sidebarSource, /ControlledChatHistoryDrawer/u);
	assert.doesNotMatch(sidebarSource, /CONTROL_PLANE_SIDEBAR_SURFACES/u);
	assert.doesNotMatch(sidebarSource, /onRefreshThreads/u);
	assert.doesNotMatch(sidebarSource, /isHistoryOpen/u);
	assert.doesNotMatch(rovoAppShellSource, /onRefreshThreads=\{chat\.refreshThreads\}/u);
	assert.doesNotMatch(surfaceShellSource, /onRefreshThreads=\{refreshThreads\}/u);
});

test("chat history exposes the Queue sorting menu beside the new-chat action", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");

	assert.match(source, /export type ChatHistorySortMode = "priority" \| "last-updated" \| "manual";/u);
	assert.match(source, /aria-label="Sort chats"/u);
	assert.match(source, /<SortOptionsIcon label="" size="small" \/>/u);
	assert.match(source, /<DropdownMenuLabel>Sort by<\/DropdownMenuLabel>/u);
	assert.match(source, /value="priority">Priority/u);
	assert.match(source, /value="last-updated">Last updated/u);
	assert.match(source, /value="manual">Manual order/u);
	assert.match(source, /\{sortMode && onSortModeChange \? \([\s\S]*<ChatHistorySortAction/u);
	assert.match(source, /<ChatHistorySortAction[\s\S]*<HoverAddAction label="New chat"/u);
});

test("chat history drawer uses a contained left sheet with a local blanket", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");
	const sheetSource = readProjectFile("components/ui/sheet.tsx");

	assert.match(source, /const \[shouldRenderSheet, setShouldRenderSheet\] = useState\(isHistoryOpen\);/u);
	assert.match(source, /setShouldRenderSheet\(true\);/u);
	assert.match(source, /setShouldRenderSheet\(false\);/u);
	assert.match(source, /if \(!active \|\| \(!isHistoryOpen && !shouldRenderSheet\)\) \{/u);
	assert.match(source, /<Sheet[\s\S]*open=\{isHistoryOpen\}[\s\S]*onOpenChange=\{handleOpenChange\}[\s\S]*onOpenChangeComplete=\{handleOpenChangeComplete\}/u);
	assert.match(source, /side="left"/u);
	assert.match(source, /contained/u);
	assert.match(source, /data-chat-history-drawer-layer/u);
	assert.match(source, /portalContainer=\{portalContainer\}/u);
	assert.match(source, /overlayClassName="z-20"/u);
	assert.match(source, /className="z-30[^"]*w-80[^"]*max-w-\[calc\(100%_-_40px\)\][^"]*bg-surface-overlay/u);
	assert.match(sheetSource, /portalContainer/u);
	assert.match(sheetSource, /contained \? "absolute z-20" : "fixed z-\[200\]"/u);
	assert.match(source, /<SheetClose/u);
	assert.match(source, /buttonVariants\(\{ variant: "ghost", size: "icon", shape: "circle" \}\)/u);
	assert.match(source, /<Icon aria-hidden label="" render=\{<CrossIcon label="" \/>\} \/>/u);
	assert.match(source, /"absolute top-3 left-3 z-10"/u);
	assert.match(source, /p-3 pt-14/u);
	assert.doesNotMatch(source, /<SheetClose[^>]*render=\{/u);
	assert.doesNotMatch(source, /<CrossIcon label="" size="small" \/>/u);
	assert.doesNotMatch(source, /absolute inset-y-0 left-0/u);
	assert.doesNotMatch(source, /calc\(100vw-40px\)/u);
});

test("chat history delete-all confirmation escapes the contained sheet layer", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");
	const headingStart = source.indexOf("function ChatHistorySectionHeading");
	const dialogStart = source.indexOf("function ChatHistoryDeleteAllDialog");
	const headingSource = source.slice(headingStart, dialogStart);

	assert.notEqual(headingStart, -1);
	assert.notEqual(dialogStart, -1);
	assert.doesNotMatch(headingSource, /<AlertDialog/u);
	assert.match(source, /onRequestDeleteAll=\{\(\) => panelState\.setIsDeleteAllConfirmOpen\(true\)\}/u);
	assert.match(source, /<\/Sheet>\s*<ChatHistoryDeleteAllDialog[\s\S]*open=\{panelState\.isDeleteAllConfirmOpen\}/u);
	assert.match(source, /onConfirm=\{panelState\.handleDeleteAllConfirm\}/u);
});

test("chat history drawer can collapse the chats section from the heading", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");

	assert.match(source, /const CHATS_REGION_ID = "rovo-chat-history-chats-list";/u);
	assert.match(source, /const \[isChatsOpen, setIsChatsOpen\] = useState\(true\);/u);
	assert.match(source, /setIsChatsOpen\(\(open\) => !open\);/u);
	assert.match(source, /aria-expanded=\{chatsOpen\}/u);
	assert.match(source, /aria-controls=\{controlsId\}/u);
	assert.match(source, /<ChevronDownIcon[\s\S]*chatsOpen \? "rotate-0" : "-rotate-90"/u);
	assert.match(source, /chatsOpen=\{isChatsOpen\}/u);
	assert.match(source, /controlsId=\{CHATS_REGION_ID\}/u);
	assert.match(source, /id=\{CHATS_REGION_ID\}/u);
	assert.match(source, /<section[\s\S]*id=\{CHATS_REGION_ID\}[\s\S]*aria-label="Chats"/u);
	assert.match(source, /threadsLoaded && threads\.length === 0 && "flex items-center justify-center"/u);
	assert.match(source, /!isChatsOpen && "hidden"/u);
});

test("chat history row actions are scoped to the hovered row", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");

	assert.match(source, /group\/chat-history-thread relative rounded-lg/u);
	assert.match(source, /group-hover\/chat-history-thread:opacity-100/u);
	assert.match(source, /threadActions \? \([\s\S]*group-hover\/chat-history-thread:pointer-events-auto/u);
	assert.match(source, /threadActions && "group-hover\/chat-history-thread:grid-cols/u);
	assert.match(source, /getThreadActions\?: \(thread: RovoAppThread\) => ReactNode;/u);
	assert.doesNotMatch(source, /group-hover:opacity-100/u);
});

test("chat history supports an opt-in pinned thread group", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");
	const pinnedSectionIndex = source.indexOf('aria-label="Pinned"');
	const chatsHeadingIndex = source.indexOf("<ChatHistorySectionHeading", pinnedSectionIndex);
	const chatsRegionIndex = source.indexOf('aria-label="Chats"', chatsHeadingIndex);
	const chatsRegionEndIndex = source.indexOf("</section>", chatsRegionIndex);
	const chatsRegionSource = source.slice(chatsRegionIndex, chatsRegionEndIndex);

	assert.match(source, /pinnedThreadIds\?: ReadonlySet<string>;/u);
	assert.match(source, /threads\.filter\(\(thread\) => pinnedThreadIds\.has\(thread\.id\)\)/u);
	assert.match(source, /threads\.filter\(\(thread\) => !pinnedThreadIds\.has\(thread\.id\)\)/u);
	assert.notEqual(pinnedSectionIndex, -1);
	assert.ok(pinnedSectionIndex < chatsHeadingIndex);
	assert.ok(chatsHeadingIndex < chatsRegionIndex);
	assert.match(source, />\s*Pinned\s*<\/div>/u);
	assert.match(source, /pinnedThreads\.map\(renderThread\)/u);
	assert.match(source, /unpinnedThreads\.map\(renderThread\)/u);
	assert.doesNotMatch(chatsRegionSource, /\{pinnedThreads\.map\(renderThread\)/u);
	assert.match(chatsRegionSource, /unpinnedThreads\.map\(renderThread\)/u);
});

test("chat history drawer matches the Figma conversation-list content structure", () => {
	const source = readProjectFile("components/projects/sidebar-chat/components/chat-history-drawer.tsx");
	const sidebarNavItemSource = readProjectFile("components/ui-custom/sidebar-nav-item.tsx");

	assert.match(source, /New chat/u);
	assert.match(source, /SidebarNavItemCount/u);
	assert.match(source, /⌘⇧O/u);
	assert.match(sidebarNavItemSource, /group-data-\[selected=true\]\/sidebar-nav-item:opacity-0/u);
	assert.match(sidebarNavItemSource, /group-hover\/sidebar-nav-item:!opacity-100/u);
	assert.match(sidebarNavItemSource, /data-slot="sidebar-nav-item-actions"[\s\S]*"absolute top-1\/2 right-1 z-10 flex -translate-y-1\/2 items-center gap-1"/u);
	assert.match(sidebarNavItemSource, /"group-hover\/sidebar-nav-item:static group-hover\/sidebar-nav-item:translate-y-0"/u);
	assert.match(sidebarNavItemSource, /"group-has-\[\[data-slot=button\]:focus\]\/sidebar-nav-item:static group-has-\[\[data-slot=button\]:focus\]\/sidebar-nav-item:translate-y-0"/u);
	assert.doesNotMatch(sidebarNavItemSource, /group-focus-within\/sidebar-nav-item:static/u);
	assert.doesNotMatch(sidebarNavItemSource, /group-focus-within\/sidebar-nav-item:pointer-events-auto/u);
	assert.match(sidebarNavItemSource, /"group-has-\[\[data-popup-open\]\]\/sidebar-nav-item:static group-has-\[\[data-popup-open\]\]\/sidebar-nav-item:translate-y-0"/u);
	assert.doesNotMatch(sidebarNavItemSource, /data-slot="sidebar-nav-item-actions" className="flex shrink-0 items-center gap-1"/u);
	assert.doesNotMatch(source, /group-data-\[selected=true\]\/sidebar-nav-item:opacity-100/u);
	assert.match(source, /label="Tasks"/u);
	assert.match(source, /label="Agents"/u);
	assert.match(source, /label="Chats"/u);
	assert.match(source, /FolderClosedIcon/u);
	assert.match(source, /AddIcon/u);
	assert.match(source, /rounded-lg p-1\.5/u);
	assert.match(source, /text-xs leading-4/u);
});

test("sidebar, floating, and fullscreen chat message logs use 16px horizontal padding", () => {
	const compactSource = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const fullscreenWrapperSource = readProjectFile("components/projects/rovo/components/rovo-app-messages.tsx");
	const fullscreenSource = readProjectFile("components/projects/rovo-core/components/rovo-app-messages.tsx");

	assert.match(compactSource, /<ConversationContent[\s\S]*className="[^"]*px-4/u);
	assert.match(fullscreenWrapperSource, /RovoAppMessages as RovoCoreAppMessages/u);
	assert.match(fullscreenSource, /extraHorizontalPaddingWhenCompact && compact \? "px-9" : "px-4"/u);
});

test("compact chat send lifecycle refreshes thread metadata", () => {
	const source = readProjectFile("app/contexts/context-rovo-chat.tsx");

	assert.match(source, /const wasStreamingRef = useRef\(false\);/u);
	assert.match(
		source,
		/wasStreamingRef\.current = isStreaming;[\s\S]*wasStreaming === isStreaming[\s\S]*void refreshThreads\(\);/u,
	);
	assert.match(
		source,
		/await ensureCompactThread\(promptItem\.text \|\| promptItem\.files\[0\]\?\.filename \|\| "New chat"\);[\s\S]*void refreshThreads\(\);[\s\S]*finally \{[\s\S]*void refreshThreads\(\);/u,
	);
});

test("compact chat provider can delete all persisted history", () => {
	const source = readProjectFile("app/contexts/context-rovo-chat.tsx");

	assert.match(source, /deleteAllRovoAppThreads/u);
	assert.match(source, /deleteAllThreads: \(\) => Promise<void>;/u);
	assert.match(source, /const deleteAllThreads = useCallback\(async \(\) => \{[\s\S]*setThreads\(\[\]\);[\s\S]*setThreadsLoaded\(true\);[\s\S]*await deleteAllRovoAppThreads\(\);[\s\S]*await refreshThreads\(\);/u);
	assert.match(source, /deleteAllThreads,[\s\S]*cancelThreadRun,/u);
});

test("compact chat fetches Rovo follow-up suggestions after a completed idle turn", () => {
	const source = readProjectFile("app/contexts/context-rovo-chat.tsx");
	const suggestionsSource = readProjectFile("components/projects/rovo-core/lib/rovo-app-suggestions.ts");

	assert.match(source, /fetchRovoAppSuggestedQuestions/u);
	assert.match(source, /buildNextSuggestedQuestionsRequest/u);
	assert.match(source, /appendSuggestedQuestionsToAssistantMessage/u);
	assert.match(suggestionsSource, /export function buildSuggestedQuestionsRequest/u);
	assert.match(suggestionsSource, /export function buildNextSuggestedQuestionsRequest/u);
	assert.match(suggestionsSource, /return buildSuggestedQuestionsRequest\(messages, message\.id\);/u);
	assert.match(source, /requestedSuggestionMessageIdsRef/u);
	assert.match(suggestionsSource, /part\.type === "data-turn-complete"/u);
	assert.match(suggestionsSource, /"data-suggested-questions"/u);
	assert.match(source, /activePrompt !== null[\s\S]*queuedPrompts\.length > 0/u);
});

test("sidebar and floating compact chat show follow-up suggestions only on the latest idle assistant turn", () => {
	const panelSource = readProjectFile("components/projects/sidebar-chat/page.tsx");
	const bubbleSource = readProjectFile("components/projects/sidebar-chat/components/message-bubble.tsx");

	assert.match(panelSource, /const hasPendingChatWork = isRequestInFlight \|\| queuedPrompts\.length > 0;/u);
	assert.match(
		panelSource,
		/showFollowUpSuggestions=\{message\.id === lastAssistantMessageId && !hasPendingChatWork\}/u,
	);
	assert.match(bubbleSource, /showFollowUpSuggestions = true/u);
	assert.match(
		bubbleSource,
		/showFollowUpSuggestions \? \(\s*<ThreadMessage\.Suggestions onSuggestionClick=\{onSuggestionClick\} \/>/u,
	);
});
