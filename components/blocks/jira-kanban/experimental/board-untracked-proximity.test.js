/**
 * Source contracts for View → Agent → Untracked board proximity.
 *
 * The menu lifts Untracked onto the experimental page; Pulse sessions sit
 * under matching Jira cards with the same flyout attach path as the column,
 * exit through AnimatePresence, a column click spotlights the related issue,
 * and a column hover lights that issue's session rows without spotlighting.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const EXPERIMENTAL_DIR = __dirname;
const PAGE_SOURCE = [
	readFileSync(join(EXPERIMENTAL_DIR, "page.tsx"), "utf8"),
	readFileSync(join(EXPERIMENTAL_DIR, "experimental-page-types.ts"), "utf8"),
	readFileSync(join(EXPERIMENTAL_DIR, "hooks", "use-page-content-model.ts"), "utf8"),
	readFileSync(join(EXPERIMENTAL_DIR, "hooks", "use-agent-session-review.ts"), "utf8"),
].join("\n");
const BOARD_SOURCE = [
	readFileSync(join(EXPERIMENTAL_DIR, "experimental-jira-kanban.tsx"), "utf8"),
	readFileSync(join(EXPERIMENTAL_DIR, "components", "created-card-arrival-motion.tsx"), "utf8"),
	readFileSync(join(EXPERIMENTAL_DIR, "components", "board-column-card-list.tsx"), "utf8"),
].join("\n");
const IN_FLOW_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "components", "in-flow-agent-session-column.tsx"),
	"utf8",
);
const CARD_SOURCE = readFileSync(join(EXPERIMENTAL_DIR, "experimental-jira-kanban-card.tsx"), "utf8");
const JIRA_ISSUE_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "..", "..", "jira-issue", "index.tsx"),
	"utf8",
);
const DRAG_HOOK_SOURCE = readFileSync(join(EXPERIMENTAL_DIR, "use-board-agent-session-drag.ts"), "utf8");
const GLOW_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "..", "..", "jira-linking", "jira-linking-glow.tsx"),
	"utf8",
);
const HELPER_SOURCE = readFileSync(join(EXPERIMENTAL_DIR, "lib", "board-untracked-sessions.ts"), "utf8");
const SESSION_INDEX_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "..", "..", "agent-session", "index.tsx"),
	"utf8",
);
const MEDIUM_CARD_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "..", "..", "agent-session", "agent-session-medium-card.tsx"),
	"utf8",
);
const LARGE_CARD_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "..", "..", "agent-session", "agent-session-card.tsx"),
	"utf8",
);

function withoutComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/[^\n]*/gu, "");
}

test("the experimental page groups Pulse sessions onto the board when Untracked is on", () => {
	assert.match(PAGE_SOURCE, /import \{\s*collectBoardIssueKeys,\s*groupBoardUntrackedSessions,\s*selectBoardUntrackedSessions,\s*\} from "\.\/lib\/board-untracked-sessions"/u);
	assert.match(PAGE_SOURCE, /defaultShowUntracked\?: boolean;/u);
	assert.match(PAGE_SOURCE, /defaultShowUntracked = true,/u);
	assert.match(PAGE_SOURCE, /const \[showUntracked, setShowUntracked\] = useState\(defaultShowUntracked\)/u);
	assert.match(
		PAGE_SOURCE,
		/if \(defaultShowUntracked !== appliedShowUntrackedDefault\) \{\s*setAppliedShowUntrackedDefault\(defaultShowUntracked\);\s*setShowUntracked\(defaultShowUntracked\);\s*\}/u,
	);
	assert.match(
		PAGE_SOURCE,
		/displayedShowUntracked\s*\?\s*groupBoardUntrackedSessions\(\{\s*archivedItemIds: archivedLooseWorkIds,\s*boardIssueKeys,\s*capturedItemIds: capturedLooseWorkIds,\s*detachedByCard: detachedAgentSessionsByCard,\s*sessions: agentSessionItems,\s*\}\)\s*:\s*EMPTY_PROXIMITY_SESSIONS/u,
	);
	assert.match(PAGE_SOURCE, /detachedAgentSessionsByCard=\{proximityAgentSessionsByCard\}/u);
	assert.match(HELPER_SOURCE, /session\.sessionDetails\?\.issueKey/u);
	assert.match(HELPER_SOURCE, /capturedItemIds\.has\(session\.id\)/u);
});

test("the Untracked column follows card session link and unlink state", () => {
	assert.match(
		PAGE_SOURCE,
		/const untrackedAgentSessionItems = useMemo\([\s\S]*selectBoardUntrackedSessions\(\{[\s\S]*archivedItemIds: archivedLooseWorkIds,[\s\S]*capturedItemIds: capturedLooseWorkIds,[\s\S]*detachedByCard: detachedAgentSessionsByCard,[\s\S]*sessions: agentSessionItems,/u,
	);
	assert.match(PAGE_SOURCE, /items: untrackedAgentSessionItems/u);
	assert.match(
		PAGE_SOURCE,
		/const handleCardAgentSessionLink:[\s\S]*setCapturedLooseWorkIds\([\s\S]*new Set\(current\)\.add\(session\.id\)/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const handleCardAgentSessionUnlink:[\s\S]*setCapturedLooseWorkIds\([\s\S]*next\.delete\(session\.id\)/u,
	);
	assert.match(PAGE_SOURCE, /onCardAgentSessionLink\?\.\(session, card, columnTitle\)/u);
	assert.match(PAGE_SOURCE, /onCardAgentSessionUnlink\?\.\(session, card, columnTitle\)/u);
});

test("the experimental page can prepend newly synced agent sessions with arrival marks", () => {
	assert.match(PAGE_SOURCE, /additionalAgentSessions\?: readonly PulseAgentSession\[\];/u);
	assert.match(PAGE_SOURCE, /newAgentSessionIds\?: ReadonlySet<string>;/u);
	assert.match(
		PAGE_SOURCE,
		/onAgentSessionsReviewed\?: \(sessionIds\?: readonly string\[\]\) => void;/u,
	);
	assert.match(PAGE_SOURCE, /function useAgentSessionLooseWork\(/u);
	assert.match(PAGE_SOURCE, /function useAgentSessionReview\(/u);
	assert.match(PAGE_SOURCE, /function isExperimentalJiraListContent\(/u);
	assert.doesNotMatch(PAGE_SOURCE, /additionalAgentSessions = EMPTY_ADDITIONAL_AGENT_SESSIONS/u);
	assert.match(
		PAGE_SOURCE,
		/const agentSessionLooseWork = useAgentSessionLooseWork\(additionalAgentSessions, pulseTimeline\.looseWork\)/u,
	);
	assert.match(
		PAGE_SOURCE,
		/filterPulseLooseWorkByMember\(agentSessionLooseWork, agentSessionMemberId\)/u,
	);
	assert.match(PAGE_SOURCE, /looseWork: agentSessionLooseWork/u);
	assert.match(PAGE_SOURCE, /newItemIds: newAgentSessionIds/u);
	assert.match(PAGE_SOURCE, /onItemHover: handleUntrackedItemHover/u);
	assert.match(PAGE_SOURCE, /collapsed: displayedAgentSessionColumnCollapsed,/u);
	assert.match(PAGE_SOURCE, /onCollapsedChange: handleAgentSessionColumnCollapsedChange/u);
	assert.doesNotMatch(PAGE_SOURCE, /defaultCollapsed: agentSessionColumnCollapsed/u);
});

test("proximity AgentSession forwards the Pulse flyout attach handlers", () => {
	assert.match(CARD_SOURCE, /capturedItemIds=\{capturedItemIds\}/u);
	assert.match(CARD_SOURCE, /onCreateWorkItem=\{onCreateWorkItem\}/u);
	assert.match(CARD_SOURCE, /onLinkWorkItem=\{onSessionLink \|\| onLinkWorkItem/u);
	assert.match(CARD_SOURCE, /onSubtasks=\{onSubtasks\}/u);
	assert.match(CARD_SOURCE, /variant="medium-detached"/u);
	assert.match(PAGE_SOURCE, /proximityAgentSession=\{\{/u);
	assert.match(PAGE_SOURCE, /actionableSessionIds: proximityActionableSessionIds/u);
	assert.match(BOARD_SOURCE, /bindBoardProximitySessionActions\(/u);
	assert.match(BOARD_SOURCE, /capturedItemIds=\{proximityActions\.capturedItemIds\}/u);
	assert.match(BOARD_SOURCE, /onCreateWorkItem=\{proximityActions\.onCreateWorkItem\}/u);
	assert.match(BOARD_SOURCE, /onLinkWorkItem=\{proximityActions\.onLinkWorkItem\}/u);
	assert.match(BOARD_SOURCE, /onSubtasks=\{proximityActions\.onSubtasks\}/u);
	assert.doesNotMatch(BOARD_SOURCE, /onCreateWorkItem=\{agentSessionColumn\?\.onCreateWorkItem\}/u);
});

test("one board transaction coordinates every session source and suppresses competing previews", () => {
	assert.match(BOARD_SOURCE, /useBoardAgentSessionDrag/u);
	assert.match(DRAG_HOOK_SOURCE, /createBoardAgentSessionDragTransaction/u);
	assert.match(DRAG_HOOK_SOURCE, /resolveBoardAgentSessionDropAction/u);
	assert.match(BOARD_SOURCE, /JiraSessionFlyoutSuspensionProvider/u);
	assert.match(BOARD_SOURCE, /const sessionFlyoutsSuspended = boardSessionDrag\.transaction !== null \|\| draggedCardCode !== null;/u);
	assert.match(BOARD_SOURCE, /sessionFlyoutsSuspended=\{sessionFlyoutsSuspended\}/u);
	assert.match(IN_FLOW_SOURCE, /suspended=\{sessionFlyoutsSuspended \|\| reposition\.dragging \|\| isMenuOpen \|\| !isEmbedded\}/u);
	assert.doesNotMatch(IN_FLOW_SOURCE, /isHovered && !isPersistentExpanded/u);
	assert.match(BOARD_SOURCE, /sessionDrag: boardSessionDrag\.enablement\.transferable[\s\S]*\? boardSessionDrag\.untrackedBinding[\s\S]*: agentSessionColumn\.sessionDrag/u);
	assert.match(PAGE_SOURCE, /boardAgentSessionDrag=\{boardSessionDrag\}/u);
	assert.match(PAGE_SOURCE, /sessionDrag: boardSessionDrag\.untrackedBinding/u);
	assert.match(
		PAGE_SOURCE,
		/import \{ JiraSessionFlyoutSuspensionProvider \} from "@\/components\/blocks\/product-sidebar\/variants\/jira-session-flyout"/u,
	);
	assert.match(
		PAGE_SOURCE,
		/<JiraSessionFlyoutSuspensionProvider\s+suspended=\{boardSessionDrag\.transaction !== null\}\s*>/u,
	);
	assert.match(
		PAGE_SOURCE,
		/sessionDragging=\{boardSessionDrag\.transaction !== null\}/u,
	);
	assert.match(BOARD_SOURCE, /untrackedSessions: props\.agentSessionColumn\?\.items \?\? props\.untrackedSessions/u);
	assert.match(BOARD_SOURCE, /data-board-agent-session-drop-zone="issue"/u);
	assert.match(IN_FLOW_SOURCE, /data-board-agent-session-drop-zone="untracked"/u);
	assert.match(PAGE_SOURCE, /ref=\{boardSessionDrag\.boardRootRef\}/u);
	assert.match(BOARD_SOURCE, /captureBoardSessionDragRoot=\{false\}/u);
	assert.match(
		PAGE_SOURCE,
		/untrackedDropArmed=\{boardSessionDrag\.transaction\?\.target\?\.kind === "untracked"\}/u,
	);
	assert.match(CARD_SOURCE, /agentSessionDragControl=\{agentSessionDragControl\}/u);
	assert.match(CARD_SOURCE, /sessionDrag=\{canLinkAgentSession[\s\S]*\? detachedSessionDrag \?\? localSessionDrag[\s\S]*: undefined\}/u);
	assert.match(BOARD_SOURCE, /data-board-agent-session-target/u);
});

test("board-wide drag stays opt-in for zero and partial callback consumers", () => {
	assert.match(DRAG_HOOK_SOURCE, /const enablement = resolveDragEnablement\(ports\);/u);
	assert.doesNotMatch(
		DRAG_HOOK_SOURCE,
		/agentActivityLayout === "split"/u,
		"merged Team EU chins must be able to drag onto Untracked and issues",
	);
	assert.match(DRAG_HOOK_SOURCE, /\n\s*enablement,\s*\n/u);
	assert.match(DRAG_HOOK_SOURCE, /const control: JiraIssueAgentSessionDragControl \| undefined = enablement\.attached/u);
	assert.match(DRAG_HOOK_SOURCE, /detachedBinding: enablement\.transferable[\s\S]*\? createBinding\(\{ kind: "detached"/u);
	assert.match(DRAG_HOOK_SOURCE, /untrackedBinding: enablement\.transferable \? createBinding\(\{ kind: "untracked" \}\) : undefined/u);
	assert.match(CARD_SOURCE, /detachedSessionDrag \?\? localSessionDrag/u);
});

test("release re-hit-tests the current pointer against current board geometry", () => {
	assert.match(
		DRAG_HOOK_SOURCE,
		/const finalTransaction = state\.pointer[\s\S]*\? updateBoardAgentSessionDragTransaction\([\s\S]*current,[\s\S]*state\.pointer,[\s\S]*collectDropZones\(boardRootRef\.current\),?[\s\S]*\)[\s\S]*: current;/u,
	);
	assert.match(DRAG_HOOK_SOURCE, /commitDrop\(finalTransaction\)/u);
});

test("the link sweep survives an overlay that never reports its flights landed", () => {
	// The chip flights are decoration: a portal behind a lazy chunk, gated on
	// reduced motion. Holding the acknowledgement for a committed link on their
	// callback is what makes the sweep look intermittent, so the drop arms its
	// own deadline off the effect's published budget and flushes either way.
	// Both linking variants publish one, so neither can hardcode a duration.
	assert.match(
		DRAG_HOOK_SOURCE,
		/settleDeadlineRef\.current = setTimeout\(\s*flushPendingAttach,\s*\(linkingVariant === "glow"\s*\? resolveJiraLinkingGlowSettleMs\(shouldReduceMotion, input\.release\)\s*: resolveJiraLinkingReleaseSettleMs\(input\.release, JIRA_LINKING_FULL_DROP_PROFILE\)\)\s*\+ SESSION_FUSION_SETTLE_GRACE_MS,/u,
	);
	// One arming path, so a drop and a menu assignment cannot drift into two
	// different clocks for the same acknowledgement.
	assert.equal(
		DRAG_HOOK_SOURCE.match(/settleDeadlineRef\.current = setTimeout\(/gu)?.length,
		1,
	);
	// Whoever gets there first wins; the deadline must not leave a timer armed
	// after the overlay settles, or outlive the board.
	assert.match(
		DRAG_HOOK_SOURCE,
		/const flushPendingAttach = useCallback\(\(\) => \{\s*if \(settleDeadlineRef\.current !== null\) \{\s*clearTimeout\(settleDeadlineRef\.current\);/u,
	);
	assert.match(
		DRAG_HOOK_SOURCE,
		/useEffect\(\(\) => \(\) => \{\s*if \(settleDeadlineRef\.current !== null\) \{\s*clearTimeout\(settleDeadlineRef\.current\);/u,
	);
	// A sweep retires on its own duration, so reaching for the next session does
	// not cut it short. Clearing on gesture start is the regression this guards:
	// both drag sources publish on every qualifying pointer move, so any drag
	// begun inside the sweep's ~900ms life used to truncate it within a frame.
	assert.match(
		DRAG_HOOK_SOURCE,
		/flashRetireRef\.current = setTimeout\(\s*\(\) => \{[\s\S]*setLinkFlash\(\(current\) => \(current === flash \? null : current\)\);\s*\},\s*JIRA_ISSUE_LINK_FLASH_DURATION_MS \+ SESSION_LINK_FLASH_RETIRE_GRACE_MS,/u,
	);
	assert.match(
		DRAG_HOOK_SOURCE,
		/import \{\s*JIRA_ISSUE_LINK_FLASH_DURATION_MS,\s*\} from "@\/components\/blocks\/jira-issue\/agent-link-flash";/u,
	);
	// Every flash goes through the arming helper, so none can be shown without a
	// retirement clock, and the dragging branch never writes the flash at all.
	assert.doesNotMatch(DRAG_HOOK_SOURCE, /setDragState\(state\);\s*(\/\/[^\n]*\n\s*)*setLinkFlash\(/u);
	assert.match(DRAG_HOOK_SOURCE, /\} else \{\s*armLinkFlash\(flash\);\s*\}/u);
	assert.match(DRAG_HOOK_SOURCE, /armLinkFlash\(pending\.flash\);/u);
});

test("list-row hit testing reads shared scrollport geometry once per drag evaluation", () => {
	assert.match(
		DRAG_HOOK_SOURCE,
		/const listScrollportClipCache = new Map<HTMLElement, ListScrollportClip>\(\);/u,
	);
	assert.match(
		DRAG_HOOK_SOURCE,
		/clipBoundsToScrollport\(node, rect, listScrollportClipCache\)/u,
	);
	assert.match(
		DRAG_HOOK_SOURCE,
		/let scrollportClip = clipCache\.get\(scrollport\);[\s\S]*if \(scrollportClip === undefined\) \{[\s\S]*clipCache\.set\(scrollport, scrollportClip\);/u,
	);
});

test("card-link drops commit the transfer before decorative flights start", () => {
	const source = withoutComments(DRAG_HOOK_SOURCE);
	assert.match(
		source,
		/commitDrop\(finalTransaction\);\s*if \(release && finalTransaction\.proximity && !shouldReduceMotion\)/u,
	);
	assert.doesNotMatch(source, /pendingAttachRef\.current = \{ flash, transaction:/u);
	assert.doesNotMatch(source, /commitDrop\(pending\.transaction\)/u);
});

test("unchecking Untracked exits board-adjacent sessions through the issue presence recipe", () => {
	assert.match(CARD_SOURCE, /import \{ AnimatePresence, motion, useReducedMotion \} from "motion\/react"/u);
	assert.match(
		CARD_SOURCE,
		/import \{\s*getJiraIssuePresenceMotion,\s*JIRA_ISSUE_MOTION_STYLE,\s*\} from "@\/components\/blocks\/jira-issue\/lib"/u,
	);
	assert.match(CARD_SOURCE, /const proximityMotion = getJiraIssuePresenceMotion\(shouldReduceMotion\)/u);
	assert.match(CARD_SOURCE, /sessionTransferAfter=\{detachedAgentSessions\.length > 0/u);
	assert.match(
		withoutComments(CARD_SOURCE),
		/<AnimatePresence>\s*<motion\.div[\s\S]*exit=\{proximityMotion\.exit\}/u,
	);
	assert.doesNotMatch(BOARD_SOURCE, /data-agent-session-column[\s\S]*showUntracked/u);
});

test("column session hover previews its suggested Jira issue at the grey hover rung without scrolling or spotlighting", () => {
	const boardWithoutComments = withoutComments(BOARD_SOURCE);
	const hoverHandlerStart = boardWithoutComments.indexOf("const handleColumnSessionHover");
	const hoverHandlerBody = boardWithoutComments.slice(
		hoverHandlerStart,
		boardWithoutComments.indexOf("};", hoverHandlerStart),
	);

	assert.notStrictEqual(hoverHandlerStart, -1);
	assert.match(BOARD_SOURCE, /onItemHover: handleColumnSessionHover,/u);
	assert.match(hoverHandlerBody, /if \(suggestSessionBoardLinkOnHover\) \{\s*setHoveredColumnSessionId\(item\?\.id \?\? null\);\s*\}/u);
	assert.match(hoverHandlerBody, /agentSessionColumn\?\.onItemHover\?\.\(item\)/u);
	assert.match(BOARD_SOURCE, /const \{ highlightedSessionId, hoveredIssueKey \} = resolveSessionBoardLinkHoverPreview\(/u);
	assert.match(BOARD_SOURCE, /enabled: suggestSessionBoardLinkOnHover,/u);
	assert.match(PAGE_SOURCE, /const untrackedHoveredWorkItemKey = untrackedHoveredSession/u);
	assert.match(
		PAGE_SOURCE,
		/proximityHighlightedWorkItemKey=\{suggestSessionBoardLinkOnHover\s*\? untrackedHoveredWorkItemKey\s*: null\}/u,
	);
	assert.match(BOARD_SOURCE, /proximityHighlightedWorkItemKey\?: string \| null;/u);
	assert.match(BOARD_SOURCE, /suggestSessionBoardLinkOnHover\?: boolean;/u);
	assert.match(HELPER_SOURCE, /if \(!input\.enabled\) \{\s*return \{\s*highlightedSessionId: null,\s*hoveredIssueKey: null,/u);
	assert.match(CARD_SOURCE, /agentSessionTargetPreview=\{\{ highlighted: agentSessionTargetHighlighted \}\}/u);
	assert.match(JIRA_ISSUE_SOURCE, /agentSessionTargetHighlighted \? "bg-bg-neutral-hovered" : "bg-bg-neutral"/u);
	// Hover previews the relationship with color only. Only a click owns focus,
	// scroll, and the `opacity-40` veil, so the hover handler stays out of all three.
	assert.doesNotMatch(hoverHandlerBody, /setFocusedIssueKey/u);
	assert.doesNotMatch(hoverHandlerBody, /scrollBoardIssueIntoView/u);
	assert.match(BOARD_SOURCE, /highlightedSessionId=\{highlightedSessionId\}/u);
	assert.match(CARD_SOURCE, /highlightedItemId=\{highlightedSessionId\}/u);
});

test("a hovered column session lights its board twin at the row hover rung", () => {
	// The column and the board render the same session ids, so the twin is found
	// by id rather than by re-deriving the work-item relationship.
	assert.match(SESSION_INDEX_SOURCE, /isHighlighted=\{item\.id === highlightedItemId\}/u);
	// Same rung the row reaches on its own hover, so a remote pointer reads the
	// way a local one would. Notably not the blue the click spotlight owns.
	assert.match(MEDIUM_CARD_SOURCE, /isHighlighted\s*\?\s*"bg-surface-hovered"/u);
	assert.doesNotMatch(MEDIUM_CARD_SOURCE, /bg-bg-accent-blue-subtlest/u);
	assert.match(
		MEDIUM_CARD_SOURCE,
		/:\s*"bg-surface hover:bg-surface-hovered"/u,
	);
	// List-item hover recipe: 50ms, practical easing, background-color only.
	assert.match(
		MEDIUM_CARD_SOURCE,
		/transition-\[background-color,border-color\] duration-xxshort ease-out-practical motion-reduce:transition-none/u,
	);
});

test("a hovered detached board session lights its column twin", () => {
	// Hover is transient relationship preview in either direction. The board
	// owns the shared id and feeds it to the column, while the medium row
	// reports pointer entry/exit through the same session callback as the
	// column's large row.
	assert.match(BOARD_SOURCE, /highlightedItemId: highlightedSessionId,/u);
	assert.match(CARD_SOURCE, /onItemHover=\{onItemHover\}/u);
	assert.match(MEDIUM_CARD_SOURCE, /onPointerEnter=\{\(\) => \{\s*[\s\S]*?onItemHover\?\.\(item\);\s*\}\}/u);
	assert.match(MEDIUM_CARD_SOURCE, /onPointerLeave=\{\(\) => \{\s*[\s\S]*?onItemHover\?\.\(null\);\s*\}\}/u);
	assert.match(SESSION_INDEX_SOURCE, /isHighlighted=\{item\.id === highlightedItemId\}/u);
	assert.match(
		LARGE_CARD_SOURCE,
		/!showSelectedFill && \(isHighlighted \|\| isHoverStateActive\) && "bg-surface-hovered"/u,
	);
});

test("suggested-link hover preview is a host capability that defaults on", () => {
	assert.match(PAGE_SOURCE, /suggestSessionBoardLinkOnHover\?: boolean;/u);
	assert.match(PAGE_SOURCE, /suggestSessionBoardLinkOnHover = true,/u);
	assert.match(BOARD_SOURCE, /suggestSessionBoardLinkOnHover\?: boolean;/u);
	assert.match(BOARD_SOURCE, /suggestSessionBoardLinkOnHover = true,/u);
	assert.match(
		PAGE_SOURCE,
		/proximityHighlightedSessionId=\{suggestSessionBoardLinkOnHover\s*\? untrackedHoveredSessionId\s*: null\}/u,
	);
	assert.match(
		PAGE_SOURCE,
		/highlightedItemId: suggestSessionBoardLinkOnHover\s*\? untrackedHoveredSessionId\s*: undefined,/u,
	);
	assert.match(BOARD_SOURCE, /enabled: suggestSessionBoardLinkOnHover,/u);
	assert.match(HELPER_SOURCE, /if \(!input\.enabled\) \{\s*return \{\s*highlightedSessionId: null,\s*hoveredIssueKey: null,/u);
});

test("column card click scrolls the related issue and applies the blue-subtlest spotlight", () => {
	assert.match(BOARD_SOURCE, /onView: handleSessionView,/u);
	assert.match(BOARD_SOURCE, /onSelectedItemIdChange: handleSessionSelectionChange,/u);
	assert.match(
		withoutComments(BOARD_SOURCE),
		/const handleSessionSelectionChange = \(itemId: string \| null\) => \{\s*if \(itemId === null\) \{\s*setFocusedIssueKey\(null\);/u,
	);
	assert.match(BOARD_SOURCE, /data-issue-key=\{cardCode\}/u);
	assert.match(
		BOARD_SOURCE,
		/spotlightIssueKey === card\.code && "bg-bg-accent-blue-subtlest \[&_\[data-slot=jira-issue-agent-backdrop\]\]:bg-bg-accent-blue-subtlest"/u,
	);
	assert.match(
		BOARD_SOURCE,
		/agentSessionTargetHighlighted=\{hoveredIssueKey === card\.code && spotlightIssueKey !== card\.code\}/u,
	);
	assert.match(
		BOARD_SOURCE,
		/spotlightIssueKey !== null && spotlightIssueKey !== card\.code && "opacity-40"/u,
	);
	assert.match(
		BOARD_SOURCE,
		/const spotlightIssueKey = resolveVisibleFocusedIssueKey\(focusedIssueKey, boardColumns\)/u,
	);
	assert.match(
		BOARD_SOURCE,
		/transition-\[background-color,opacity\] duration-normal ease-out-practical/u,
	);
	assert.match(BOARD_SOURCE, /motion-reduce:transition-none/u);
	assert.match(
		BOARD_SOURCE,
		/scrollBoardIssueIntoView\(boardScrollportRef\.current, nextKey\)/u,
	);
	assert.match(BOARD_SOURCE, /agentSessionColumn\?\.onView\?\.\(item\)/u);
	assert.match(BOARD_SOURCE, /agentSessionColumn\?\.onSelectedItemIdChange\?\.\(itemId\)/u);
	assert.match(SESSION_INDEX_SOURCE, /if \(nextId !== null\) \{\s*\n\s*onView\?\.\(item\);\s*\n\s*\}/u);
	assert.match(HELPER_SOURCE, /boardScrollport\.scrollBy\(\{\s*behavior: "instant",\s*left:/u);
	assert.match(HELPER_SOURCE, /columnScrollport\.scrollBy\(\{\s*behavior: "instant",\s*top:/u);
	assert.doesNotMatch(HELPER_SOURCE, /scrollIntoView/u);
	assert.doesNotMatch(HELPER_SOURCE, /"smooth"/u);
});

test("Untracked stays frozen beside the independently scrolling Jira status pane", () => {
	const statusScrollportStart = BOARD_SOURCE.indexOf("<section");
	const statusScrollportEnd = BOARD_SOURCE.indexOf("</section>", statusScrollportStart);
	const statusScrollportSource = BOARD_SOURCE.slice(statusScrollportStart, statusScrollportEnd);

	assert.match(BOARD_SOURCE, /const boardScrollportRef = useRef<HTMLElement \| null>\(null\)/u);
	assert.match(
		BOARD_SOURCE,
		/<InFlowAgentSessionColumn[\s\S]*\) : null\}\s*<JiraSessionFlyoutSuspensionProvider suspended>\s*<section[\s\S]*ref=\{boardScrollportRef\}[\s\S]*data-jira-kanban-scrollport=""[\s\S]*overflowX: "auto"/u,
	);
	assert.doesNotMatch(statusScrollportSource, /<(?:InFlow)?AgentSessionColumn/u);
	assert.match(BOARD_SOURCE, /data-jira-kanban-card-list=""/u);
});

test("column presentation pins Untracked beside the list as well as the board", () => {
	assert.match(
		PAGE_SOURCE,
		/const showInFlowAgentSessionColumn = agentSessionPresentation === "column"\s*&& agentSessionColumnConfig !== undefined;/u,
	);
	assert.match(
		PAGE_SOURCE,
		/\{showInFlowAgentSessionColumn && agentSessionColumnConfig \? \(\s*<InFlowAgentSessionColumn/u,
	);
	assert.doesNotMatch(PAGE_SOURCE, /inFlowAgentSessionColumn/u);
	assert.match(PAGE_SOURCE, /columnFrame=\{columnChromeStyles\.headerFrame\}/u);
	assert.match(
		PAGE_SOURCE,
		/<InFlowAgentSessionColumn[\s\S]*<RetainedView active=\{isListContent\} retain=\{retainWorkItemViews\}>[\s\S]*<RetainedView active=\{!isListContent\}/u,
		"one Untracked column instance must wrap both Board and List so hide/archive state survives the switch",
	);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/agentSessionColumn=\{agentSessionPresentation === "panel"/u,
		"the page-owned column must not also mount inside ExperimentalJiraKanban",
	);
});

test("a menu assignment measures the card after the link its own commit caused", () => {
	// A drop hit-tests a board the pointer was already over. An assignment can
	// move the card it targets — a host that advances the work item on start
	// re-columns it in the same commit — so measuring before that commit hands
	// Glow a stale anchor whose hit test finds whichever card slid in behind.
	// The wrong card then glows.
	assert.match(
		DRAG_HOOK_SOURCE,
		/assignmentFrameRef\.current = requestAnimationFrame\(\(\) => \{\s*assignmentFrameRef\.current = null;\s*const proximity = toBoardAgentSessionCardProximity\(/u,
	);
	// The deferred frame must not outlive the board, or it arms against a tree
	// that is already gone.
	assert.match(
		DRAG_HOOK_SOURCE,
		/clearTimeout\(flashRetireRef\.current\);\s*\}\s*if \(assignmentFrameRef\.current !== null\) \{\s*cancelAnimationFrame\(assignmentFrameRef\.current\);\s*\}\s*\}, \[\]\);/u,
	);
	// Click-assign skips the travelling chip a drop builds: Glow's halo is the
	// whole acknowledgement, and faking a drop origin would replay the collapse.
	assert.match(DRAG_HOOK_SOURCE, /toSessionFusionAssignmentRelease\(/u);
	assert.equal(
		DRAG_HOOK_SOURCE.match(/toSessionFusionDrop\(/gu)?.length,
		1,
		"only the pointer-up path may arm a travelling-chip drop",
	);
});

test("the assign menu only acknowledges on glow, and never asks for a sweep", () => {
	// Fuse keys its sweep to the activity id the host minted, and that id is the
	// host's own convention — v4 builds `${card.code}:${selection.id}` out of a
	// mention id this board never sees. Arming a sweep the board cannot target
	// would silently never play, so fuse boards keep today's assign menu.
	assert.match(
		DRAG_HOOK_SOURCE,
		/if \(!member \|\| shouldReduceMotion \|\| linkingVariant !== "glow"\) \{\s*return;\s*\}/u,
	);
	// Glow's own halo and pulse are the acknowledgement, so the assignment must
	// not hand the rows a flash at all.
	assert.match(
		DRAG_HOOK_SOURCE,
		/armFusionRelease\(\{[\s\S]{0,220}?flash: null,/u,
	);
	assert.doesNotMatch(
		DRAG_HOOK_SOURCE,
		/targetCardCode: cardCode,/u,
		"a menu assignment must not build a chin-row flash it cannot key correctly",
	);
	// Without a travelling chip, the card must not open its attach chin or
	// count as a drop target the way a session flight does.
	assert.match(
		DRAG_HOOK_SOURCE,
		/const isFusionDropFlight = Boolean\(\s*fusionDrop\?\.release\.drop && fusionDrop\.proximity\.cardCode === card\.code,\s*\);/u,
	);
	assert.doesNotMatch(
		GLOW_SOURCE,
		/if \(shouldReduceMotion \|\| !drop \|\| !landing \|\| !backdrop\)/,
		"a click-to-assign release omits drop and must still play the halo",
	);
	assert.match(GLOW_SOURCE, /if \(!drop \|\| !flight\) \{\s*playGlow\(\);/u);
});
