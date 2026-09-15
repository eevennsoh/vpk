const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

// Source contracts for the agent-session transfer surface: the Unlink/Link
// demo phases, the drop well, the pull-out, and the split review chin.
// Split out of jira-issue.test.js to keep both files under the 1000-line budget.
const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const ATTACH_CHIN_SOURCE = readFileSync(join(__dirname, "attach-chin.tsx"), "utf8");
const AGENT_ACTIVITY_SOURCE = [
	readFileSync(join(__dirname, "agent-activity.tsx"), "utf8"),
	readFileSync(join(__dirname, "agent-activity-row-presentation.tsx"), "utf8"),
].join("\n");
const COMPLETED_RUNS_SOURCE = readFileSync(join(__dirname, "completed-agent-runs.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
// The drag state/binding types and the idle constant live outside the component
// file so a value export cannot defeat Fast Refresh (only-export-components).
const DRAG_SOURCE = readFileSync(join(__dirname, "agent-session-drag.ts"), "utf8");
const TRANSFER_SOURCE = readFileSync(join(__dirname, "agent-session-transfer.tsx"), "utf8");
const MAGNETIC_PROXIMITY_SOURCE = readFileSync(
	join(__dirname, "../../ui-custom/hooks/use-magnetic-proximity.ts"),
	"utf8",
);
const BASE_DEMO_STATES_START = PAGE_SOURCE.indexOf("const JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES = [");
const TRANSFER_DEMO_STATES_START = PAGE_SOURCE.indexOf(
	"const JIRA_ISSUE_AGENT_SESSION_TRANSFER_DEMO_STATES = [",
);
const BASE_DEMO_STATES_BLOCK = PAGE_SOURCE.slice(BASE_DEMO_STATES_START, TRANSFER_DEMO_STATES_START);
const TRANSFER_REGION_BLOCK = TRANSFER_SOURCE.slice(
	TRANSFER_SOURCE.indexOf("export function JiraIssueAgentSessionTransfer("),
);

test("Jira issue agent session transfer adds demo phases gated to the experimental variant", () => {
	assert.ok(BASE_DEMO_STATES_START >= 0, "the base demo-state list must exist");
	assert.ok(
		TRANSFER_DEMO_STATES_START > BASE_DEMO_STATES_START,
		"the transfer demo-state list must be declared after the base list so it can be concatenated onto it",
	);
	// The two phases are real demo states, not ad-hoc strings.
	assert.match(
		PAGE_SOURCE,
		/type JiraIssueAgentActivityDemoState =[\s\S]*\| "agent-session-unlink"\s*\n\s*\| "agent-session-running-unlink"\s*\n\s*\| "agent-session-link";/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const JIRA_ISSUE_AGENT_SESSION_TRANSFER_DEMO_STATES = \[\s*\n\s*\{ value: "agent-session-unlink", label: "Unlink" \},\s*\n\s*\{ value: "agent-session-running-unlink", label: "1 running \+ 2 unlink" \},\s*\n\s*\{ value: "agent-session-link", label: "Link" \},\s*\n\] as const satisfies readonly \{ value: JiraIssueAgentActivityDemoState; label: string \}\[\];/u,
	);
	assert.match(
		PAGE_SOURCE,
		/function isSessionTransferDemoState\(state: JiraIssueAgentActivityDemoState\): boolean \{\s*\n\s*return state === "agent-session-unlink"\s*\n\s*\|\| state === "agent-session-running-unlink"\s*\n\s*\|\| state === "agent-session-link";/u,
	);
	// Move is gone: no demo phase, no work-item fixtures, no move commit path.
	assert.doesNotMatch(PAGE_SOURCE, /agent-session-move|JIRA_ISSUE_MOVE_WORK_ITEMS|onMove/u);
	// Gating: the extra tabs only exist when the demo is told to show them, and
	// only the experimental (stroke) variant asks for that.
	assert.match(PAGE_SOURCE, /showSessionTransferStates\?: boolean;/u);
	assert.match(PAGE_SOURCE, /showSessionTransferStates = false,/u);
	assert.match(
		PAGE_SOURCE,
		/const demoStates = showSessionTransferStates\s*\n\s*\? \[\.\.\.JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES, \.\.\.JIRA_ISSUE_AGENT_SESSION_TRANSFER_DEMO_STATES\]\s*\n\s*: JIRA_ISSUE_AGENT_ACTIVITY_DEMO_STATES;/u,
	);
	assert.match(
		PAGE_SOURCE,
		/<JiraIssueAgentActivityStatesDemo[\s\S]*showSessionTransferStates=\{iconScale !== "comfortable"\}[\s\S]*\/>/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const isTransferPhase = showSessionTransferStates && isSessionTransferDemoState\(agentActivityState\);/u,
	);
	// Every attached running chin on the experimental demo mounts the well —
	// 1 agent, 1-n, needs input, Link, and 1 running + 2 unlink — not only the
	// Unlink / Link tab labels.
	assert.match(PAGE_SOURCE, /const hasChinToUnlink = Boolean\(agentActivities\?\.length\);/u);
	assert.match(
		PAGE_SOURCE,
		/const agentSessionTransfer: JiraIssueAgentSessionTransferConfig \| undefined = useMemo\(\(\) => \{\s*\n\s*if \(!showSessionTransferStates \|\| \(!hasChinToUnlink && !showDetachedSessions\)\) \{\s*\n\s*return undefined;\s*\n\s*\}\s*\n\s*return \{\s*\n\s*onLink: handleSessionLink,\s*\n\s*onUnlink: hasChinToUnlink \? handleSessionUnlink : undefined,\s*\n\s*\};/u,
	);
});

test("Jira issue unlink detaches under the work item; Link remounts the chin", () => {
	assert.match(
		PAGE_SOURCE,
		/const handleSessionUnlink = useCallback\(\(session\?: \{ id: string \}\) => \{\s*\n\s*if \(!session\?\.id\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*setUnlinkedSessionIds\(\(current\) => \(\s*\n\s*current\.includes\(session\.id\) \? current : \[\.\.\.current, session\.id\]\s*\n\s*\)\);\s*\n\s*setLinkedDetachedIds\(\(current\) => nextJiraIssueDemoLinkedIds\(current, session\.id, false\)\);\s*\n\s*\}, \[\]\);/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const handleSessionLink = useCallback\(\(session\?: \{ id: string \}\) => \{\s*\n\s*if \(!session\?\.id\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*setUnlinkedSessionIds\(\(current\) => current\.filter\(\(id\) => id !== session\.id\)\);\s*\n\s*if \(DETACHABLE_DEMO_SESSION_IDS\.has\(session\.id\)\) \{\s*\n\s*setLinkedDetachedIds\(\(current\) => nextJiraIssueDemoLinkedIds\(current, session\.id, true\)\);\s*\n\s*\}\s*\n\s*\}, \[\]\);/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const remainingFixtureActivities = fixtureActivities\?\.filter\(\(activity\) => !unlinkedSessionIds\.includes\(activity\.id\)\);/u,
	);
	assert.match(PAGE_SOURCE, /const linkedDetachedActivities = linkedDetachedSessions\.map\(toJiraIssueDemoAttachedActivity\);/u);
	assert.match(PAGE_SOURCE, /function toUnlinkedAgentSession\(activity: JiraIssueAgentActivity\): AgentSessionItem/u);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/handleSessionUnlink[\s\S]{0,80}setAgentActivityState\("agent-session-unlink"\)/u,
	);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/handleSessionLink[\s\S]{0,80}setAgentActivityState\("agent-session-link"\)/u,
	);
	assert.match(PAGE_SOURCE, /const isUnlinkPhase = isTransferPhase && agentActivityState === "agent-session-unlink";/u);
	assert.match(PAGE_SOURCE, /const isRunningUnlinkPhase = isTransferPhase && agentActivityState === "agent-session-running-unlink";/u);
	// Backdrop stays via `working` mode; the chin stays empty because Unlink
	// no longer returns an activity row. With no chin the surface insets its own
	// bottom edge, so the grey shell peeks under the closed stroke card without
	// the card growing.
	assert.match(
		PAGE_SOURCE,
		/if \(state === "agent-session-unlink"\) \{\s*\n\s*return "working";/u,
	);
	assert.match(
		PAGE_SOURCE,
		/Unlink keeps the grey agent-activity backdrop around the issue without/u,
	);
	assert.match(
		SOURCE,
		/const hasActiveAgentActivityShell = resolvedAgentActivityMode === "working"[\s\S]*\|\| resolvedAgentActivityMode === "awaiting-input"[\s\S]*\|\| hasCompletedAgentChin;/u,
	);
	assert.match(
		SOURCE,
		/const insetsAgentActivitySurfaceBottom = hasActiveAgentActivityShell && !hasAgentActivityChin;/u,
	);
	assert.doesNotMatch(PAGE_SOURCE, /case "agent-session-unlink":\s*\n\s*return JIRA_ISSUE_AGENT_ACTIVITIES/u);
	assert.match(PAGE_SOURCE, /sessionTransferAfter=\{showDetachedSessions/u);
	assert.match(PAGE_SOURCE, /sessionDrag=\{sessionDrag\}/u);
	assert.match(PAGE_SOURCE, /variant="medium-detached"/u);
	assert.doesNotMatch(PAGE_SOURCE, /variant="medium-attached"/u);
	assert.doesNotMatch(PAGE_SOURCE, /JiraIssueDetachedAgentSession/u);
	// Link is the 1-agent chin, not a sibling attached session card.
	assert.match(
		PAGE_SOURCE,
		/case "single-agent-working":\s*\n\s*case "agent-session-link":\s*\n\s*case "agent-session-running-unlink":\s*\n\s*return JIRA_ISSUE_AGENT_ACTIVITIES\.slice\(0, 1\);/u,
	);
});

test("Jira issue experimental demo composes one running chin with two detached unlink cards", () => {
	// Same chin as "1 agent"; two distinct v4 detached sessions, not a second chin.
	assert.match(
		PAGE_SOURCE,
		/case "single-agent-working":\s*\n\s*case "agent-session-link":\s*\n\s*case "agent-session-running-unlink":\s*\n\s*return JIRA_ISSUE_AGENT_ACTIVITIES\.slice\(0, 1\);/u,
	);
	assert.match(PAGE_SOURCE, /import \{ AGENT_SESSION_ITEMS, AgentSession, type AgentSessionItem \} from "@\/components\/blocks\/agent-session";/u);
	assert.match(
		PAGE_SOURCE,
		/const fixtureDetachedSessions = isRunningUnlinkPhase\s*\n\s*\? AGENT_SESSION_ITEMS\.slice\(0, 2\)\s*\n\s*: isUnlinkPhase\s*\n\s*\? AGENT_SESSION_ITEMS\.slice\(0, 1\)\s*\n\s*: \[\];/u,
	);
	assert.match(PAGE_SOURCE, /const detachedSessions = \[\.\.\.unlinkedSessions, \.\.\.remainingFixtureDetached\];/u);
	assert.match(PAGE_SOURCE, /splitJiraIssueDemoSessionsById\(/u);
	assert.match(PAGE_SOURCE, /toJiraIssueDemoAttachedActivity/u);
	assert.doesNotMatch(PAGE_SOURCE, /JIRA_ISSUE_TRANSFER_SESSION|JIRA_ISSUE_SECOND_TRANSFER_SESSION/u);
	// `#medium-detached` shows the person avatar from `invokedBy` on these items.
	const sessionDataSource = readFileSync(
		join(__dirname, "../agent-session/data.ts"),
		"utf8",
	);
	assert.match(
		sessionDataSource,
		/export const AGENT_SESSION_ITEMS[\s\S]*invokedBy: \{[\s\S]*avatarSrc: "\/avatar-user\//u,
	);
	assert.match(PAGE_SOURCE, /const isRunningUnlinkPhase = isTransferPhase && agentActivityState === "agent-session-running-unlink";/u);
	assert.match(PAGE_SOURCE, /sessionTransferAfter=\{showDetachedSessions/u);
	assert.match(PAGE_SOURCE, /items=\{detachedSessions\}/u);
	assert.match(PAGE_SOURCE, /<AgentSession[\s\S]*issueKey="PD-40"/u);
	assert.doesNotMatch(PAGE_SOURCE, /gap: token\("space\.025"\)/u);
	assert.match(PAGE_SOURCE, /variant="medium-detached"/u);
	assert.doesNotMatch(
		PAGE_SOURCE,
		/agentActivityState === "agent-session-running-unlink"[\s\S]{0,80}variant="medium-attached"/u,
	);
});

test("Jira issue raised agent activity demo still exposes exactly the original six tabs", () => {
	const baseStateCount = (BASE_DEMO_STATES_BLOCK.match(/\{ value: "/gu) ?? []).length;
	assert.equal(baseStateCount, 6, "the raised demo must keep exactly its original six tabs");
	for (const value of ["default", "single-agent-working", "multiple-agents-working", "awaiting-user-input", "agent-completed-work", "agent-dismissed-work"]) {
		assert.match(BASE_DEMO_STATES_BLOCK, new RegExp(`\\{ value: "${value}", label: "[^"]+" \\},`, "u"));
	}
	// The transfer phases must never leak into the shared base list, which is
	// what the raised (non-experimental) demo renders verbatim.
	for (const value of ["agent-session-unlink", "agent-session-running-unlink", "agent-session-link"]) {
		assert.doesNotMatch(BASE_DEMO_STATES_BLOCK, new RegExp(`"${value}"`, "u"));
	}
	assert.match(PAGE_SOURCE, /agentActivityLayout="merged"/u);
	assert.match(PAGE_SOURCE, /onChromeChange=\{setChrome\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /chrome=\{isExperimentalAgentActivityVariant \? "stroke" : "raised"\}/u);
});

test("Jira issue session transfer drop zone stays mounted and collapses height at rest", () => {
	// Unlink stays mounted when offered. Attach has no well, so that path
	// returns null instead of painting a dashed attach zone.
	assert.match(TRANSFER_REGION_BLOCK, /if \(!showUnlinkWell\) \{\s*\n\s*return null;/u);
	assert.doesNotMatch(TRANSFER_REGION_BLOCK, /\{dragging \? </u);
	assert.equal(
		(TRANSFER_REGION_BLOCK.match(/<TransferDropZone/gu) ?? []).length,
		1,
		"the region renders exactly the one Unlink zone",
	);
	// Height collapses at rest so stacked cards do not reserve a well-sized gap.
	// Chin hover/focus or a drag opens `1fr`; opacity fades with that open.
	assert.match(TRANSFER_SOURCE, /grid grid-rows-\[0fr\] opacity-0/u);
	assert.match(TRANSFER_SOURCE, /transition-\[grid-template-rows,opacity\] duration-fast ease-out-practical/u);
	assert.match(TRANSFER_SOURCE, /group-has-\[\[data-session-chin\]:hover\]\/jira-issue-transfer:grid-rows-\[1fr\]/u);
	assert.match(TRANSFER_SOURCE, /group-has-\[\[data-slot=jira-issue-session-transfer\]:hover\]\/jira-issue-transfer:grid-rows-\[1fr\]/u);
	assert.match(TRANSFER_SOURCE, /group-has-\[\[data-session-chin\]:has\(:focus-visible\)\]\/jira-issue-transfer:grid-rows-\[1fr\]/u);
	assert.match(
		TRANSFER_REGION_BLOCK,
		/revealUnlinkWell \? "pointer-events-auto grid-rows-\[1fr\] opacity-100" : "pointer-events-none"/u,
	);
	assert.match(TRANSFER_REGION_BLOCK, /data-slot="jira-issue-session-transfer"/u);
	// `py-2` preserves the 8px breathing room above and below the well.
	// `px-px` keeps the dash strokes inside the clipper.
	assert.match(TRANSFER_REGION_BLOCK, /min-h-0 overflow-hidden/u);
	assert.match(TRANSFER_REGION_BLOCK, /className="flex flex-col px-px py-2"/u);
	assert.match(PAGE_SOURCE, /style=\{\{ marginTop: token\("space\.025"\) \}\}/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /TRANSFER_DRAG_SHIFT_CLASS|translate-y-2/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /group-focus-within/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /(?:^|[\s"'`])hidden(?:[\s"'`]|$)/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /display: *"?none/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /\binert\b/u);
	assert.match(
		TRANSFER_SOURCE,
		/export const JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS = "group\/jira-issue-transfer";/u,
	);
	assert.match(SOURCE, /JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS/u);
	assert.doesNotMatch(PAGE_SOURCE, /JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS/u);
});

test("Jira issue session transfer well opens on a linked chin row, not a detached session", () => {
	// Detached sessions reuse `data-slot=jira-issue-agent-row`. Hover must key
	// off the chin-only `data-session-chin` flag so an already-unlinked card
	// cannot open a drop target for a session that is already off the chin.
	assert.match(TRANSFER_REGION_BLOCK, /const revealUnlinkWell = dragging && !isLinking;/u);
	assert.match(
		TRANSFER_REGION_BLOCK,
		/revealUnlinkWell \? "pointer-events-auto grid-rows-\[1fr\] opacity-100" : "pointer-events-none"/u,
	);
	assert.doesNotMatch(TRANSFER_SOURCE, /group-hover\/jira-issue-transfer/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /group-has-\[\[data-slot=jira-issue-agent-row\]:hover\]/u);
	assert.match(TRANSFER_SOURCE, /group-has-\[\[data-session-chin\]:hover\]\/jira-issue-transfer:opacity-100/u);
	assert.match(
		TRANSFER_SOURCE,
		/group-has-\[\[data-slot=jira-issue-session-transfer\]:hover\]\/jira-issue-transfer:opacity-100/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-session-chin=""/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-slot="jira-issue-agent-row"/u);
	assert.match(
		TRANSFER_SOURCE,
		/const showUnlinkWell = !isLinking\s*\n\s*&& Boolean\(config\.onUnlink\)\s*\n\s*&& config\.showUnlinkWell !== false;/u,
	);
});

test("Jira issue session transfer drop zone is a labelled rounded dashed target, not a button", () => {
	assert.match(
		TRANSFER_SOURCE,
		/<div\s*\n\s*aria-label=\{description\}[\s\S]*role="img"/u,
	);
	assert.doesNotMatch(TRANSFER_SOURCE, /<button[\s\S]*Drag here to unlink/u);
	assert.doesNotMatch(TRANSFER_REGION_BLOCK, /onClick=\{\(\) => config\.onUnlink/u);
	assert.match(TRANSFER_SOURCE, /description: string;/u);
	// The unlink well is the only dashed zone. Attach uses the card chin.
	assert.match(TRANSFER_REGION_BLOCK, /description=\{`Unlink \$\{sessionLabel\} from this work item`\}/u);
	assert.match(TRANSFER_REGION_BLOCK, /config\.unlinkLabel \?\? "Drag here to unlink"/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /Drag here to attach/u);
	assert.match(TRANSFER_SOURCE, /sessionLabel = "agent session",/u);
	assert.match(
		TRANSFER_SOURCE,
		/const TRANSFER_ZONE_BASE_CLASS =\s*\n\s*"flex[^"]*rounded-lg border border-dashed border-border/u,
		"native dashes retain the rounded control corners without clipping",
	);
	assert.doesNotMatch(TRANSFER_SOURCE, /TRANSFER_ZONE_BASE_CLASS =\s*\n\s*"dash-4-2/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /TRANSFER_ZONE_BASE_CLASS =[\s\S]*outline-none/u);
	// A drop still commits through the same ref the well used when it was a
	// button, so the arming effect does not resubscribe on every parent render.
	assert.match(TRANSFER_SOURCE, /if \(!dragging\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*commitRef\.current = \{\s*\n\s*onLink: config\.onLink,\s*\n\s*onUnlink: config\.onUnlink,\s*\n\s*session,\s*\n\s*source,\s*\n\s*\};/u);
	assert.match(TRANSFER_SOURCE, /if \(!commit\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*if \(commit\.source !== "chin"\) \{\s*\n\s*commit\.onLink\?\.\(commit\.session\);\s*\n\s*\} else \{\s*\n\s*commit\.onUnlink\?\.\(commit\.session\);\s*\n\s*\}/u);
});

test("Jira issue keyboard unlink preserves the focused split-row session", () => {
	assert.match(DRAG_SOURCE, /onFocusedActivitiesChange: \(activities: readonly JiraIssueAgentActivity\[\]\) => void;/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/onFocus: \(\) => sessionDrag\.onFocusedActivitiesChange\(activities\),/u,
	);
	assert.match(
		SOURCE,
		/onFocusedActivitiesChange: \(activities\) => setInternalAgentSessionDragState\(\(current\) => \(\{[\s\S]*\.\.\.current,[\s\S]*activities,[\s\S]*\}\)\),/u,
	);
});

test("Jira issue session transfer motion honours reduced motion at every layer", () => {
	// CSS transitions on the region and the zones.
	assert.match(TRANSFER_SOURCE, /const TRANSFER_REVEAL_CLASS =[\s\S]*motion-reduce:transition-none/u);
	assert.match(TRANSFER_SOURCE, /const TRANSFER_ZONE_BASE_CLASS =[\s\S]*motion-reduce:transition-none"/u);
	// The magnet hook pins translation to 0 under reduced motion while retaining
	// pointer relation state for non-motion feedback such as selected colors.
	assert.match(MAGNETIC_PROXIMITY_SOURCE, /const shouldReduceMotion = useReducedMotion\(\);/u);
	assert.match(
		MAGNETIC_PROXIMITY_SOURCE,
		/const reset = \(\) => \{[\s\S]*magnetX\.set\(0\);\s*\n\s*magnetY\.set\(0\);\s*\n\s*\};[\s\S]*if \(shouldReduceMotion\) reset\(\);/u,
	);
	assert.match(
		MAGNETIC_PROXIMITY_SOURCE,
		/if \(nextProximity !== "outside" && !shouldReduceMotion\) \{/u,
	);
	assert.match(MAGNETIC_PROXIMITY_SOURCE, /shouldReduceMotion,\s*targetRef,?\s*\]\);/u);
	// A pointer drag must not fight Motion's layout projection.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const rowLayout = shouldReduceMotion \|\| sessionDragging \|\| assignmentHoverOpen\s*\n\s*\? false\s*\n\s*: "position";/u,
	);
});

test("Jira issue agent activity demo runs no background timers", () => {
	// The Move phase parked a confirmation timer that could advance a hidden
	// demo; the tab handler had to clear it on every switch. With Move gone the
	// demo is timer-free, so a plain state setter is enough — keep it that way.
	assert.doesNotMatch(PAGE_SOURCE, /setTimeout|setInterval/u);
	assert.match(
		PAGE_SOURCE,
		/onClick=\{\(\) => \{\s*\n\s*setUnlinkedSessionIds\(\[\]\);\s*\n\s*setLinkedDetachedIds\(\[\]\);\s*\n\s*setAgentActivityState\(state\.value\);\s*\n\s*\}\}/u,
	);
});

test("Jira issue agentSessionTransfer is opt-in so existing consumers are unaffected", () => {
	// Optional prop with no default: absent means the whole feature is inert.
	assert.match(SOURCE, /agentSessionTransfer\?: JiraIssueAgentSessionTransferConfig;/u);
	assert.match(SOURCE, /^\tagentSessionTransfer,$/mu);
	assert.doesNotMatch(SOURCE, /agentSessionTransfer = /u);
	// No config -> no drag binding handed to the chin rows.
	assert.match(
		SOURCE,
		/const localAgentSessionDragBinding: JiraIssueAgentSessionDragBinding \| undefined = agentSessionTransfer[\s\S]*onDragStateChange: \(state\) => \{[\s\S]*setInternalAgentSessionDragState\([\s\S]*JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE[\s\S]*onFocusedActivitiesChange:[\s\S]*: undefined;/u,
	);
	// No config -> no transfer group and no transfer region in the tree. The
	// host div itself stays: `agentSessionTransfer` is a board capability that
	// comes and goes, and gating the wrapper would change the article's first
	// child element type and remount the whole card.
	assert.match(
		SOURCE,
		/const agentActivityShellWithTransfer = \(\s*\n\t\t<div\s*\n\t\t\tclassName=\{cn\(\s*\n\t\t\t\t"relative w-full min-w-0 overflow-visible",\s*\n\t\t\t\tagentSessionTransfer \? JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS : null,\s*\n\t\t\t\)\}\s*\n\t\t>/u,
	);
	assert.match(
		SOURCE,
		/\{agentSessionTransfer \? \(\s*\n\t\t\t\t<JiraIssueAgentSessionTransfer/u,
	);
	assert.match(
		SOURCE,
		/\{agentSessionTransfer && agentSessionDragBinding && sessionTransferAfter/u,
	);
	assert.doesNotMatch(SOURCE, /from "@\/components\/visual\/gooey"/u);
	assert.doesNotMatch(SOURCE, /<Gooey/u);
	assert.doesNotMatch(SOURCE, /AGENT_SESSION_TRANSFER_GOO/u);
	// No config -> the sparkle reveal expression is unchanged in practice.
	assert.match(
		SOURCE,
		/const agentSessionTransferRevealed = Boolean\(agentSessionTransfer\)[\s\S]*resolvedAgentSessionDragState\.dragging/u,
	);
	// No binding -> the chin row keeps its plain click behaviour and skips the
	// drag wrapper entirely.
	assert.match(AGENT_ACTIVITY_SOURCE, /sessionDrag\?: JiraIssueAgentSessionDragBinding;/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/function JiraIssueAgentDragWrapper\([\s\S]*if \(!sessionDragEnabled\) \{\s*return children;/u,
	);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /from "@\/components\/visual\/gooey"/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<Gooey/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/function createJiraIssueSessionDragBind\([\s\S]*if \(!sessionDrag\) \{\s*return undefined;[\s\S]*onPointerUp:/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /\{\.\.\.\(sessionDragBind \?\? \{ onClick: handleOpenChat \}\)\}/u);
	// The demo only opts in for the experimental variant's transfer phases.
	assert.match(PAGE_SOURCE, /agentSessionTransfer=\{agentSessionTransfer\}/u);
});

test("Jira issue session dragging can be controlled by a board without changing local consumers", () => {
	// The control type lives with the other drag types; the card re-exports it
	// so every board consumer still imports it from `@/components/blocks/jira-issue`.
	assert.match(
		DRAG_SOURCE,
		/export interface JiraIssueAgentSessionDragControl \{[\s\S]*binding: JiraIssueAgentSessionDragBinding;[\s\S]*dropTarget\?: "attach" \| "unlink" \| null;[\s\S]*sourceActive: boolean;[\s\S]*state: JiraIssueAgentSessionDragState;[\s\S]*\}/u,
	);
	assert.match(
		SOURCE,
		/export type \{ JiraIssueAgentSessionDragControl \} from "@\/components\/blocks\/jira-issue\/agent-session-drag";/u,
	);
	assert.match(SOURCE, /agentSessionDragControl\?: JiraIssueAgentSessionDragControl;/u);
	assert.match(
		SOURCE,
		/const resolvedAgentSessionDragState = agentSessionDragControl\?\.state \?\? internalAgentSessionDragState;/u,
	);
	assert.match(
		SOURCE,
		/const agentSessionDragBinding: JiraIssueAgentSessionDragBinding \| undefined = agentSessionDragControl\?\.binding \?\? localAgentSessionDragBinding;/u,
	);
	assert.match(
		SOURCE,
		/const isAttachingSession = agentSessionDragControl[\s\S]*\? agentSessionDragControl\.dropTarget === "attach"[\s\S]*: isJiraIssueSessionAttachPreview/u,
	);
	assert.match(
		SOURCE,
		/controlledArmed=\{agentSessionDragControl \? agentSessionDragControl\.dropTarget === "unlink" : undefined\}/u,
	);
	assert.match(SOURCE, /commitDrops=\{agentSessionDragControl === undefined\}/u);
});

test("board-controlled transfer targets never double-commit through a Jira issue", () => {
	assert.match(TRANSFER_SOURCE, /controlledArmed\?: boolean;/u);
	assert.match(TRANSFER_SOURCE, /commitDrops\?: boolean;/u);
	assert.match(TRANSFER_SOURCE, /const resolvedArmed = controlledArmed \?\? armed;/u);
	assert.match(
		TRANSFER_SOURCE,
		/if \(controlledArmed !== undefined \|\| !commitDrops\) \{\s*return;\s*\}/u,
	);
	assert.match(TRANSFER_SOURCE, /armed=\{resolvedArmed\}/u);
});

test("board-controlled moves cannot leave the same presence row mounted in two cards", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /instantSessionTransfer\?: boolean;/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const rowPresenceKey = instantSessionTransfer[\s\S]*rowGroups\.map\(\(rowGroup\) => rowGroup\.key\)\.join\("\|"\)[\s\S]*: "animated";/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /<AnimatePresence key=\{rowPresenceKey\}/u);
	assert.match(SOURCE, /instantSessionTransfer=\{agentSessionDragControl !== undefined\}/u);
});

test("Jira issue splits the finished review chin into one row per completed run", () => {
	// Merged stays the default so every existing consumer keeps the aggregate
	// "N Finished" row; only an explicit split opt-in fans the runs out.
	assert.match(COMPLETED_RUNS_SOURCE, /layout = "merged",/u);
	assert.match(COMPLETED_RUNS_SOURCE, /layout\?: JiraIssueAgentActivityLayout;/u);
	assert.match(COMPLETED_RUNS_SOURCE, /if \(layout === "split"\) \{[\s\S]*props\.runs\.map\(\(run\) => \([\s\S]*<JiraIssueCompletedRunRow/u);
	assert.match(COMPLETED_RUNS_SOURCE, /if \(props\.runs\.length === 1\) \{[\s\S]*<JiraIssueCompletedRunRow[\s\S]*showFlyout=\{false\}/u);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/return \(\s*<JiraIssueAgentDoneMerged[\s\S]*onOpenChange=\{props\.onOpenChange\}[\s\S]*onView=\{props\.onView\}[\s\S]*runs=\{props\.runs\}[\s\S]*usesStrokeChrome=\{props\.usesStrokeChrome\}/u,
	);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /function JiraIssueAgentDoneMerged\([\s\S]*onReview/u);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /function JiraIssueAgentDoneMerged\([\s\S]*onSubmit/u);
	// Split rows reuse the working-row chrome so Review reads like 1-n agents.
	assert.match(COMPLETED_RUNS_SOURCE, /function JiraIssueCompletedRunRow\(/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<JiraIssueCompletedRunRow[\s\S]*key=\{run\.id\}/u);
	assert.match(COMPLETED_RUNS_SOURCE, /className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1[^"]*hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed[^"]*"/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<AgentAvatarVisual[\s\S]*avatarSrc=\{run\.agentAvatarSrc\}[\s\S]*label=\{run\.agentName\}[\s\S]*sizePx=\{24\}/u);
	assert.match(COMPLETED_RUNS_SOURCE, /className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"/u);
	// Per-run outcome icon replaces the aggregate's failure-only indicator.
	// Failed stays the filled error status — never a host renderer's call — and
	// an unhandled finished run falls back to the filled ADS success status.
	assert.match(COMPLETED_RUNS_SOURCE, /import StatusSuccessIcon from "@atlaskit\/icon\/core\/status-success";/u);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/hasFailed \? \([\s\S]*<StatusErrorIcon[\s\S]*\) : renderAgentActivityIndicator \? \(\s*renderAgentActivityIndicator\("finished"\)\s*\) : \([\s\S]*<StatusSuccessIcon color=\{token\("color\.icon\.success"\)\}/u,
	);
	// The finished glyph is the existing chin-row renderer seam, not a second
	// prop chain, so a host that already styles working rows styles this too.
	assert.match(COMPLETED_RUNS_SOURCE, /renderAgentActivityIndicator\?: JiraIssueAgentActivityIndicatorRenderer;/u);
	assert.match(
		COMPLETED_RUNS_SOURCE,
		/<JiraIssueCompletedRunRow[\s\S]*renderAgentActivityIndicator=\{props\.renderAgentActivityIndicator\}/u,
	);
	assert.match(
		SOURCE,
		/<JiraIssueAgentDone[\s\S]*renderAgentActivityIndicator=\{renderAgentActivityIndicator\}/u,
	);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /StrokeWeightExtraLargeIcon/u);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /CheckMarkIcon/u);
	assert.doesNotMatch(COMPLETED_RUNS_SOURCE, /NodeIcon/u);
	assert.match(COMPLETED_RUNS_SOURCE, /hasFailed \? "text-icon-danger" : "text-icon-subtle"/u);
	// Each row opens its own run's shared session flyout rather than the aggregate AgentList.
	assert.match(COMPLETED_RUNS_SOURCE, /<JiraSessionFlyoutTrigger[\s\S]*session=\{\{ \.\.\.session,/u);
	assert.match(COMPLETED_RUNS_SOURCE, /<JiraSessionFlyoutSurface handle=\{flyoutHandle\} \/>/u);
	assert.match(SOURCE, /<JiraIssueAgentDone[\s\S]*layout=\{agentActivityLayout\}/u);
});

test("Jira issue session transfer keeps a rounded dashed well around the drag phase", () => {
	// At rest the well is the compact 24px target; once the session is out of
	// the chin it grows to 48px. Native dashes retain the rounded corners.
	assert.match(TRANSFER_SOURCE, /const TRANSFER_ZONE_REST_CLASS = "h-6 text-xs leading-4 text-text-subtle";/u);
	assert.match(TRANSFER_SOURCE, /const TRANSFER_ZONE_DRAG_CLASS = "h-12 text-sm leading-5 text-text-subtle";/u);
	assert.match(TRANSFER_SOURCE, /rounded-lg border border-dashed border-border/u);
	assert.match(TRANSFER_SOURCE, /dragging \? TRANSFER_ZONE_DRAG_CLASS : TRANSFER_ZONE_REST_CLASS/u);
	// Pointer over the well paints dash, fill, and label selected together.
	assert.match(
		TRANSFER_SOURCE,
		/const TRANSFER_ZONE_ARMED_CLASS = "border-border-selected bg-bg-selected text-text-selected";/u,
	);
	assert.match(TRANSFER_SOURCE, /armed \? TRANSFER_ZONE_ARMED_CLASS : null/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /TRANSFER_ZONE_SHARE_|flex-\[1\.7/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /flex-grow/u);
	assert.match(TRANSFER_SOURCE, /transition-\[height,background-color,border-color,color\]/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /useMagneticProximity|TRANSFER_MAGNET_DISTANCE_PX/u);
	// The "Drag here to" separator is gone; the well's own label carries the
	// instruction. `grid-rows-[0fr]` now collapses the well itself at rest, not
	// a prompt row above it.
	assert.doesNotMatch(TRANSFER_SOURCE, /jira-issue-session-transfer-prompt|Drag here to"/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /TRANSFER_DRAG_SHIFT_CLASS|translate-y-2/u);
	// Size and colour changes are token-driven and reduced-motion safe.
	assert.doesNotMatch(TRANSFER_SOURCE, /duration-\[|duration-200|duration-150/u);
});

test("Jira issue mention chip centers on the pointer grab, not the handle origin", () => {
	assert.match(DRAG_SOURCE, /export function sessionDragChipViewportStyle/u);
	assert.match(DRAG_SOURCE, /export function measureSessionDragChipPointer/u);
	assert.match(DRAG_SOURCE, /position: "fixed"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /useSessionDragChipPointer/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /sessionDragChipViewportStyle\(true\)/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /-translate-x-1\/2 -translate-y-1\/2/u);
});

test("Jira issue dragged session reads as the at-mention chip it becomes", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /import \{ createPortal \} from "react-dom";/u);
	// The pointer offset drives motion values; the springs are what renders, so
	// the chip trails the cursor instead of pinning to it.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const JIRA_ISSUE_SESSION_DRAG_SPRING = \{ damping: 26, mass: 0\.6, stiffness: 420, restDelta: 0\.01 \} as const;/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /const springX = useSpring\(dragOffsetX, JIRA_ISSUE_SESSION_DRAG_SPRING\);/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const dragX = shouldReduceMotion \? dragOffsetX : springX;/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/createPortal\([\s\S]*data-session-drag-overlay=""[\s\S]*document\.body/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /chipPointer\.snapToPointer\(\s*\{ x: event\.clientX, y: event\.clientY \},?\s*\);/u);
	// A raw transform string would bypass the spring entirely.
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /transform: `translate\(\$\{drag\.position/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /isDraggedOut && "pointer-events-none opacity-0"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const JIRA_ISSUE_SESSION_DRAG_CHIP_DISTANCE_PX = 12;/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /const isDraggedOut = isDragging\s*\n\s*&& Math\.hypot\(drag\.position\.x, drag\.position\.y\) >= JIRA_ISSUE_SESSION_DRAG_CHIP_DISTANCE_PX;/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /<Gooey/u);
});

test("Jira issue at-mention chip hugs its own width once it leaves the chin", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /className="pointer-events-none left-0 top-0 z-\[300\] w-fit"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /isDragging && \(isDraggedOut \? "h-0" : "h-8"\),/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /JIRA_ISSUE_SESSION_DRAG_CHIP_MORPH|JIRA_ISSUE_SESSION_DRAG_MORPH|JIRA_ISSUE_SESSION_DRAG_DISSOLVE/u);
});

test("Jira issue dragged session does not paint a liquid silhouette", () => {
	assert.doesNotMatch(SOURCE, /AGENT_SESSION_TRANSFER_GOO/u);
	assert.doesNotMatch(SOURCE, /from "@\/components\/visual\/gooey"/u);
	// Out of the chin the row renders the shared drag pill, not a bespoke pill.
	assert.match(AGENT_ACTIVITY_SOURCE, /const isDragging = Boolean\(sessionDrag\) && drag\.dragging;/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /sessionDragChipViewportStyle\(true\)/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-session-chip-centered=""/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /<AgentSessionDragPill[\s\S]*name: featuredActivity\?\.name \?\? "Agent",[\s\S]*elevated/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-session-drag-overlay=""/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /bg-surface-raised/u);
});

test("Jira issue travelling drag pill uses an opaque surface fill", () => {
	const dragChipSource = readFileSync(
		join(__dirname, "../agent-session/agent-session-drag-chip.tsx"),
		"utf8",
	);
	// Resting copies use alpha `bg-bg-neutral`; the dragged chip must cover the well.
	// The fill is the semantic class per `.agents/rules/token-priority.md`; only
	// the shadow, which has no Tailwind mapping, stays inline.
	assert.match(dragChipSource, /elevated \? "bg-surface" : "bg-bg-neutral"/u);
	assert.doesNotMatch(dragChipSource, /backgroundColor:/u);
	assert.match(dragChipSource, /style=\{elevated \? DRAG_CHIP_ELEVATION : undefined\}/u);
});

test("Jira issue chin unlink unlinks without nesting a button in the drag handle", () => {
	assert.match(DRAG_SOURCE, /onUnlink\?: \(session\?: \{ id: string; name: string \}\) => void;/u);
	assert.match(SOURCE, /onUnlink: agentSessionTransfer\.onUnlink,/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const showUnlinkControl = iconScale !== "comfortable"\s*\n\s*&& Boolean\(sessionDrag\?\.onUnlink\)\s*\n\s*&& !isDraggedOut;/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-slot="jira-issue-agent-row"/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /<JiraIssueAgentSessionUnlinkButton/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/onUnlink=\{\(\) => sessionDrag\?\.onUnlink\?\.\(\{[\s\S]*id: featuredActivity\?\.id \?\? activities\[0\]\?\.id \?\? "",[\s\S]*name: featuredActivity\?\.name \?\? activities\[0\]\?\.name \?\? "Agent",/u,
	);
	// The unlink control is a sibling of the handle, not a child of it.
	assert.match(AGENT_ACTIVITY_SOURCE, /\{assignedRowHandle\}[\s\S]*<JiraIssueAgentSessionUnlinkButton/u);
	const rowHandleBlock = AGENT_ACTIVITY_SOURCE.slice(
		AGENT_ACTIVITY_SOURCE.indexOf("const rowHandle = ("),
		AGENT_ACTIVITY_SOURCE.indexOf("const assignedRowHandle"),
	);
	assert.doesNotMatch(rowHandleBlock, /JiraIssueAgentSessionUnlinkButton/u);
	assert.doesNotMatch(rowHandleBlock, /<button[\s\S]*<button/u);
	const unlinkButtonSource = readFileSync(join(__dirname, "agent-session-unlink-button.tsx"), "utf8");
	assert.match(unlinkButtonSource, /aria-label="Unlink"/u);
	assert.match(unlinkButtonSource, /<TooltipContent>Unlink<\/TooltipContent>/u);
	assert.match(unlinkButtonSource, /from "@atlaskit\/icon\/core\/link-broken"/u);
	assert.match(unlinkButtonSource, /size="icon-compact"/u);
	assert.match(unlinkButtonSource, /flex h-6 w-0 shrink-0 overflow-hidden/u);
	assert.match(unlinkButtonSource, /group-hover\/agent-chin-row:w-6/u);
	assert.match(unlinkButtonSource, /variant="ghost"/u);
	assert.match(unlinkButtonSource, /onPointerDown=\{stopSessionGesture\}/u);
	assert.match(unlinkButtonSource, /pointer-events-none opacity-0/u);
	assert.doesNotMatch(unlinkButtonSource, /(?:^|[\s"'`])size-4(?:[\s"'`]|$)/u);
	assert.match(unlinkButtonSource, /onClick=\{\(event\) => \{\s*\n\s*stopSessionGesture\(event\);\s*\n\s*onUnlink\(\);/u);
	assert.doesNotMatch(unlinkButtonSource, /(?:^|[\s"'`])hidden(?:[\s"'`]|$)/u);
	assert.doesNotMatch(unlinkButtonSource, /display: *"?none/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/<div className="flex shrink-0 items-center gap-0">[\s\S]*<JiraIssueAgentSessionUnlinkButton[\s\S]*data-slot="jira-issue-assignee-slot"[\s\S]*\{statusIcon\}/u,
	);
	// Detached link sits left of this same size-6 -mr-1 slot. The chin unlink
	// must reuse it so the two icons share a column.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/className="flex size-6 shrink-0 items-center justify-center -mr-1"[\s\S]*data-slot="jira-issue-assignee-slot"/u,
	);
});

test("Jira issue drag pill floats on overlay elevation, not a dead utility", () => {
	// `shadow-overlay` is not a utility in this theme — `--ds-shadow-overlay` is
	// only mapped onto `--shadow-2xl` — so the class silently rendered no shadow
	// and the chip read as flat against the card. Elevation belongs on the pill.
	const dragChipSource = readFileSync(
		join(__dirname, "../agent-session/agent-session-drag-chip.tsx"),
		"utf8",
	);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /[\s"']shadow-overlay[\s"']/u);
	assert.match(
		dragChipSource,
		/boxShadow: token\("elevation\.shadow\.overlay"\),/u,
	);
	// The shared pill forwards its caller-selected attribution order; Jira-owned
	// work keeps the human-first default while the untracked cohort opts out.
	assert.match(dragChipSource, /<AgentListIdentity[\s\S]*agent=\{agent\}[\s\S]*attributedBy=\{attributedBy\}[\s\S]*attributionOrder=\{attributionOrder\}[\s\S]*sizePx=\{32\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /attributedBy=\{featuredActivity\?\.invokedBy\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /elevated/u);
});

test("Jira issue card hugs its content the moment the chip leaves the chin", () => {
	// The slot only reserves the row height while the session is still bridging
	// out; once the chip is free it collapses AND eats the row list's gutter from
	// the inside, so the grey backdrop closes around the white card instead of
	// holding an empty band. The shell keeps that grey and adds the same 4px
	// bottom pad as the empty-chin gutter — do not fade the well or expand the
	// white surface to fill it.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/isDragging && \(isDraggedOut \? "h-0" : "h-8"\),/u,
	);
	// The row flags itself; the list closes its gutter off that flag with `:has()`.
	assert.match(AGENT_ACTIVITY_SOURCE, /data-session-chip-out=\{isDraggedOut \|\| undefined\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-slot="jira-issue-agent-row-wrap"/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/\(hasActivities \|\| hasAttachPreview\) && cn\([\s\S]*?flushContent \? "px-0" : "px-1",[\s\S]*?"py-1 has-\[\[data-session-chip-out\]\]:py-0"/u,
	);
	assert.match(
		SOURCE,
		/has-\[\[data-session-chip-out\]\]:not-has-\[\[data-slot=jira-issue-agent-row-wrap\]:not\(\[data-session-chip-out\]\)\]:pb-1/u,
	);
	assert.doesNotMatch(SOURCE, /\[&_\[data-slot=jira-issue-agent-backdrop\]\]:opacity-0/u);
	assert.doesNotMatch(SOURCE, /\[&_\[data-slot=jira-issue-surface\]\]:-inset-px/u);
});

test("Jira issue chip handover collapses in one commit, so the hit test measures the settled well", () => {
	// Publishing the flip up to the row list through a `useEffect` cost an extra
	// render (react-doctor no-pass-live-state-to-parent) and — worse — landed the
	// 32px collapse in a LATER commit than the one the transfer region's hit test
	// measures. Releasing without a further pointer move then committed against
	// the well's pre-collapse rect: unlinking outside the visible well, or
	// failing to unlink inside it. The row absorbs the gutter itself instead.
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /onSessionDraggedOutChange/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /sessionDraggedOut/u);
	// No state crosses the row/list boundary for the handover at all.
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /useEffect\([\s\S]{0,120}isDraggedOut/u);
	// The hit test still keys only off the gesture, which is only sound because
	// the target no longer moves in a commit the gesture does not drive.
	assert.match(TRANSFER_SOURCE, /\}, \[cancelled, cardMeasureRef, commitDrops, controlledArmed, dragging, isLinking, pointer\]\);/u);
});

// --- Review findings on PR #1445 -------------------------------------------

test("Jira issue pointer cancellation aborts the drag instead of committing the armed zone", () => {
	// `pointercancel` used to call the same handler as `pointerup`, so an
	// interrupted pointer published `dragging: false` and the transfer effect
	// read that as a drop — silently unlinking or moving a session the user
	// never released onto a zone.
	assert.match(DRAG_SOURCE, /cancelled: boolean;/u);
	assert.match(DRAG_SOURCE, /source: JiraIssueAgentSessionDragSource;/u);
	assert.match(DRAG_SOURCE, /source: "chin",/u);
	assert.match(DRAG_SOURCE, /export const JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /^export const /mu);
	assert.match(AGENT_ACTIVITY_SOURCE, /onPointerUp: \(event:[\s\S]*drag\.bind\.onPointerUp\(event\);[\s\S]*publishSessionDrag\(false, event\);/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /onPointerCancel: \(event:[\s\S]*drag\.bind\.onPointerCancel\(event\);[\s\S]*publishSessionDrag\(false, undefined, true\);/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /onPointerCancel:[\s\S]{0,80}drag\.bind\.onPointerUp/u);
	// The commit gate itself must exclude a cancelled gesture.
	assert.match(TRANSFER_SOURCE, /nextJiraIssueSessionTransferArmed\(\{\s*\n\s*dragging,\s*\n\s*overTarget: overWell \|\| overCard,\s*\n\s*pointerMoved,\s*\n\s*previousArmed: armedRef\.current,\s*\n\s*\}\)/u);
	assert.match(TRANSFER_SOURCE, /shouldCommitJiraIssueSessionTransferDrop\(\{\s*\n\s*armed: armedRef\.current,\s*\n\s*cancelled,\s*\n\s*dragging,\s*\n\s*\}\)/u);
	assert.match(TRANSFER_SOURCE, /\}, \[cancelled, cardMeasureRef, commitDrops, controlledArmed, dragging, isLinking, pointer\]\);/u);
});

test("Jira issue session rows do not install the shared hook's incomplete keyboard drag", () => {
	// The pointer-drag hook nudges position with arrow keys, but only the pointer
	// handlers publish transfer state, so keyboard movement would displace a
	// focused row with no way to arm, drop, or reset it. Keyboard users unlink
	// from the chin link-broken; the well is a drop target only.
	assert.match(AGENT_ACTIVITY_SOURCE, /const \{ onKeyDown: _ignoredPointerDragKeyDown, \.\.\.dragBindWithoutKeyboard \} = drag\.bind;/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /\.\.\.dragBindWithoutKeyboard,/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /\n\t\t\t\.\.\.drag\.bind,/u);
});

test("Jira issue transfer callback identifies which session was dragged", () => {
	// Split layout renders one row per agent against a single shared config, so a
	// bare `onUnlink()` left the host unable to tell which session to act on —
	// and free to update the wrong one.
	assert.match(TRANSFER_SOURCE, /export interface JiraIssueAgentSessionRef \{[\s\S]*id: string;[\s\S]*name: string;/u);
	assert.match(TRANSFER_SOURCE, /onUnlink\?: \(session\?: JiraIssueAgentSessionRef\) => void;/u);
	assert.match(TRANSFER_SOURCE, /showUnlinkWell\?: boolean;/u);
	assert.match(TRANSFER_SOURCE, /session\?: JiraIssueAgentSessionRef;/u);
	// The card feeds the dragged row's own activity through as that identity.
	assert.match(SOURCE, /session=\{resolvedAgentSessionDragState\.activities\[0\]\}/u);
	assert.match(SOURCE, /cancelled=\{resolvedAgentSessionDragState\.cancelled\}/u);
	assert.match(SOURCE, /source=\{resolvedAgentSessionDragState\.source\}/u);
	assert.match(SOURCE, /sessionTransferAfter\?:/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /source: "chin",/u);
});

test("Jira issue attach has no dashed well and grows the backdrop chin instead", () => {
	assert.match(
		TRANSFER_SOURCE,
		/const showUnlinkWell = !isLinking\s*\n\s*&& Boolean\(config\.onUnlink\)\s*\n\s*&& config\.showUnlinkWell !== false;/u,
	);
	assert.match(TRANSFER_SOURCE, /if \(!showUnlinkWell\) \{\s*\n\s*return null;/u);
	assert.doesNotMatch(TRANSFER_SOURCE, /Drag here to attach/u);
	assert.match(
		TRANSFER_SOURCE,
		/!isLinking\s*\n\s*&& dragging\s*\n\s*&& pointer\s*\n\s*&& wellRect/u,
	);
	assert.match(SOURCE, /const isAttachingSession = agentSessionDragControl[\s\S]*isJiraIssueSessionAttachPreview\(\s*\n\s*resolvedAgentSessionDragState\.dragging,\s*\n\s*resolvedAgentSessionDragState\.source,/u);
	assert.match(SOURCE, /\|\| isAttachingSession;/u);
	assert.match(SOURCE, /data-slot="jira-issue-agent-shell"/u);
	assert.match(SOURCE, /data-session-dragging=\{resolvedAgentSessionDragState\.dragging \|\| undefined\}/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /data-slot="jira-issue-attach-chin"/u);
	// Attach hit-tests the shell, not the article that also wraps detached pills.
	assert.match(
		SOURCE,
		/ref=\{\(node\) => \{\s*\n\s*cardMeasureRef\.current = node;\s*\n\s*\}\}/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/ref=\{\(node\) => \{\s*\n\s*setGenerativeActionAnchor\(node\);\s*\n\s*cardMeasureRef\.current = node;/u,
	);
});

test("attach chin replaces the last occupied session row instead of stacking or collapsing split rows", () => {
	// Occupied cards keep their chin height: the placeholder takes the last
	// row. Split layouts keep every earlier row so drop-zone geometry stays put.
	assert.match(
		SOURCE,
		/const attachChinCopy = isAttachingSession\s*\n\s*\? linkAgentSessionChinCopy\(attachSessionCount\)\s*\n\s*: undefined;/u,
	);
	assert.match(
		SOURCE,
		/const replaceDetachedTransfer = Boolean\(attachChinCopy && sessionTransferAfter\);/u,
	);
	assert.match(
		SOURCE,
		/attachPreviewCopy=\{replaceDetachedTransfer \? undefined : attachChinCopy\}/u,
	);
	assert.match(AGENT_ACTIVITY_SOURCE, /attachPreviewCopy\?: string;/u);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/const replaceLastRowWithAttach = hasAttachPreview && index === rowGroups.length - 1;/u,
	);
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/\{rowGroups.length === 0 && attachPreviewCopy \? \([\s\S]*data-slot="jira-issue-attach-chin"[\s\S]*<JiraIssueAttachChinSlot copy=\{attachPreviewCopy\} \/>/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/\{isAttachingSession \? \(\s*\n\s*<div className="px-1 py-1" data-slot="jira-issue-attach-chin">/u,
	);
	assert.match(
		ATTACH_CHIN_SOURCE,
		/export function JiraIssueDetachedAttachChinSlot\([\s\S]*h-\[33px\][\s\S]*data-slot="jira-issue-attach-chin"/u,
	);
	assert.match(
		ATTACH_CHIN_SOURCE,
		/export function JiraIssueAttachChinSlot\([\s\S]*className="pointer-events-none flex h-8 w-full/u,
	);
	// Nearby/detached pills already occupy the last chin. Attach copy covers
	// that slot, but `AgentSessionMediumDrag` stays mounted so pointer capture
	// and the window pointerup fallback survive the first armed move.
	assert.match(
		SOURCE,
		/<JiraIssueDetachedSessionTransferSlot\s*\n\s*attachCopy=\{replaceDetachedTransfer \? attachChinCopy : undefined\}\s*\n\s*>\s*\n\s*\{sessionTransferAfter\(agentSessionDragBinding\)\}/u,
	);
	assert.doesNotMatch(
		SOURCE,
		/replaceDetachedTransfer && attachChinCopy\s*\n\s*\? <JiraIssueDetachedAttachChinSlot copy=\{attachChinCopy\} \/>/u,
	);
	assert.match(ATTACH_CHIN_SOURCE, /<span className="text-sm font-normal text-text-subtlest">/u);
	assert.doesNotMatch(ATTACH_CHIN_SOURCE, /text-xs/u);
	assert.match(ATTACH_CHIN_SOURCE, /export function JiraIssueDetachedSessionTransferSlot/u);
	assert.match(ATTACH_CHIN_SOURCE, /inert=\{replace \|\| undefined\}/u);
	assert.match(ATTACH_CHIN_SOURCE, /invisible col-start-1 row-start-1/u);
	assert.match(
		ATTACH_CHIN_SOURCE,
		/attachCopy \? \(\s*\n\s*<div className="pointer-events-none col-start-1 row-start-1">\s*\n\s*<JiraIssueDetachedAttachChinSlot copy=\{attachCopy\} \/>/u,
	);
});
