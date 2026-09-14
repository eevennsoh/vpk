"use client";

import { useId, useRef, useState, type ComponentProps, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
export type { JiraIssueAgentLinkFlash } from "@/components/blocks/jira-issue/agent-link-flash";
import type { JiraIssueAgentLinkFlash } from "@/components/blocks/jira-issue/agent-link-flash";
import {
	JiraIssueAgentActivityRows,
	type JiraIssueAgentActivity,
	type JiraIssueAgentActivityIndicatorRenderer,
	type JiraIssueAgentActivityLayout,
	type JiraIssueAgentActivityMode, type JiraIssueAgentAssignment,
	type JiraIssueAgentSessionDragBinding,
	type JiraIssueAgentSessionDragState,
} from "@/components/blocks/jira-issue/agent-activity";
import { JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE } from "@/components/blocks/jira-issue/agent-session-drag";
import { JiraIssueDetachedSessionTransferSlot } from "@/components/blocks/jira-issue/attach-chin";
import {
	linkAgentSessionChinCopy,
	resolveLinkAgentSessionChinCount,
} from "@/components/blocks/jira-issue/attach-chin-copy";
import {
	isJiraIssueAttachChinArmed,
	JIRA_ISSUE_MOTION_BACKDROP_NEARNESS,
	resolveJiraIssueAttachNearness,
} from "@/components/blocks/jira-issue/attach-proximity";
import { isJiraIssueSessionAttachPreview } from "@/components/blocks/jira-issue/agent-session-transfer-model";
import {
	JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS,
	JiraIssueAgentSessionTransfer,
	type JiraIssueAgentSessionTransferConfig,
} from "@/components/blocks/jira-issue/agent-session-transfer";
import {
	JiraIssueAgentDone,
	type JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue/completed-agent-runs";
import { resolveComfortableCompletedRunViewChat, toJiraIssueAgentActivityFromCompletedRun } from "@/components/blocks/jira-issue/completed-agent-runs-model";
import {
	getCompletedCount,
	getJiraIssueAgentSurfaceOffsets,
	getJiraIssueLayoutTransition,
	getJiraIssuePresenceMotion,
	JIRA_ISSUE_MOTION_STYLE,
} from "@/components/blocks/jira-issue/lib";
import { JiraIssueSeparator, JiraIssueSubtasks } from "@/components/blocks/jira-issue/subtasks";
import {
	JiraIssueGenerativeActionMenu,
	type JiraIssueGenerativeActionConfig,
} from "@/components/blocks/jira-issue/generative-action-menu";
import { JiraIssueMoreMenu, type JiraIssueMoreAction } from "@/components/blocks/jira-issue/more-menu";
import { JiraIssueUncapturedWork } from "@/components/blocks/jira-issue/uncaptured-work";
import { JiraIssueSummary } from "@/components/blocks/jira-issue/summary";
import type {
	JiraIssueChrome,
	JiraIssueIconScale,
	JiraIssuePriority,
	JiraIssuePullRequestPreview,
	JiraIssuePullRequestStatus,
	JiraIssueTag,
} from "@/components/blocks/jira-issue/types";
import type { SmartLinkItem } from "@/components/blocks/smart-link";
import { useIsMounted } from "@/components/hooks/use-is-mounted";
import type { AvatarProps, AvatarUnassignedKind } from "@/components/ui/avatar";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { resolveJiraIssueChrome } from "./chrome";

const AGENT_ACTIVITY_SHELL_STYLE: CSSProperties = {
	borderRadius: "10px",
	transformOrigin: "top center",
};
const AGENT_ACTIVITY_BACKDROP_STYLE: CSSProperties = {
	borderRadius: "10px",
	transformOrigin: "top center",
};
const AGENT_ACTIVITY_INNER_STYLE: CSSProperties = {
	borderRadius: token("radius.large"),
	textAlign: "left",
	transformOrigin: "top center",
};
const AGENT_ACTIVITY_SURFACE_STYLE: CSSProperties = {
	borderRadius: token("radius.large"),
	transformOrigin: "top center",
};

export type {
	JiraIssueChrome,
	JiraIssueIconScale,
	JiraIssuePriority,
	JiraIssuePullRequestPreview,
	JiraIssuePullRequestStatus,
	JiraIssueTag,
	JiraIssueVariant,
} from "@/components/blocks/jira-issue/types";
export type {
	JiraIssueAgentActivity,
	JiraIssueAgentActivityIndicatorRenderer,
	JiraIssueAgentActivityIndicatorState,
	JiraIssueAgentActivityLayout,
	JiraIssueAgentActivityMode,
	JiraIssueAgentActivityState, JiraIssueAgentAssignment,
	JiraIssueAgentSessionDragBinding,
	JiraIssueAgentSessionDragState,
} from "@/components/blocks/jira-issue/agent-activity";
export type { JiraIssueAgentSessionTransferConfig } from "@/components/blocks/jira-issue/agent-session-transfer";
export type {
	JiraIssueCompletedAgentRun,
	JiraIssueCompletedAgentRunState,
} from "@/components/blocks/jira-issue/completed-agent-runs";
export type {
	JiraIssueGenerativeActionConfig,
	JiraIssueGenerativeActionIssue,
	JiraIssueGenerativeActionKind,
	JiraIssueGenerativeActionRequest,
	JiraIssueGenerativeActionSelectedItem,
} from "@/components/blocks/jira-issue/generative-action-menu";
export type { JiraIssueMoreAction } from "@/components/blocks/jira-issue/more-menu";

export type JiraIssueGenerativeActionPresentation = "sparkle" | "more-actions";

export interface JiraIssueSubtask {
	summary: string;
	issueKey: string;
	status?: string;
	issueTypeLabel?: string;
	assigneeAvatarSrc?: string;
	assigneeAvatarLabel?: string;
	assigneeUnassignedKind?: AvatarUnassignedKind;
}

export interface JiraIssueParticipant {
	id: string;
	name: string;
	avatarSrc: string;
	avatarShape?: NonNullable<AvatarProps["shape"]>;
}

/**
 * Optional board ownership for a session drag. Shared Jira issue demos keep
 * their local transfer state when this is absent.
 */
export interface JiraIssueAgentSessionDragControl {
	/**
	 * 0..1 approach ramp for the travelling session. Drives only the grey
	 * backdrop's opacity continuously; the chin and shell switch at a threshold.
	 */
	attachNearness?: number;
	binding: JiraIssueAgentSessionDragBinding;
	/**
	 * Sessions in the current drag transfer. Needed on receiving cards (their
	 * `state` stays idle) and during fusion after pointer-up. Falls back to
	 * `state.transfer.members.length` on a live source drag.
	 */
	dragCount?: number;
	dropTarget?: "attach" | "unlink" | null;
	sourceActive: boolean;
	state: JiraIssueAgentSessionDragState;
}

export interface JiraIssueUncapturedWorkProps extends Omit<ComponentProps<"article">, "children"> {
	variant: "uncaptured-work";
	/** Work that has not yet been represented by a Jira issue. */
	summary: string;
	/** Hoverable source context: type icon, provider name, and destination label. */
	sourceLink: SmartLinkItem;
	participants: readonly JiraIssueParticipant[];
	captured?: boolean;
	/** Suggested Jira key the chin's Link button should point at, e.g. PAY-121. */
	suggestedWorkItemKey?: string;
	/** Several candidate Jira keys, rendered one linkable chin row each. Takes precedence over `suggestedWorkItemKey`. */
	suggestedWorkItemKeys?: readonly string[];
	/** Creates a Jira work item from the chin's trailing add control. Omit to expose an unavailable action. */
	onCreateWorkItem?: () => void;
	/** Links this uncaptured work to a suggested Jira work item. Receives the row's key when several are offered. Omit to expose an unavailable primary action. */
	onLinkWorkItem?: (workItemKey?: string) => void;
	/**
	 * Subtasks action behind the chin's trailing subtasks control. The button
	 * always renders; omit this to leave it a placeholder until the behaviour
	 * lands.
	 */
	onSubtasks?: () => void;
}

export interface JiraIssueDefaultProps extends Omit<ComponentProps<"button">, "children"> {
	variant?: "default";
	/** Issue summary shown as the primary card text. */
	summary: string;
	/** Jira issue key, e.g. RFP-101. */
	issueKey: string;
	pullRequestNumber?: number;
	pullRequestPreview?: JiraIssuePullRequestPreview;
	pullRequestStatus?: JiraIssuePullRequestStatus;
	pullRequestTitle?: string;
	tags?: readonly JiraIssueTag[];
	priority?: JiraIssuePriority;
	issueTypeLabel?: string;
	assigneeAvatarSrc?: string;
	assigneeAvatarLabel?: string;
	assigneeAvatarShape?: NonNullable<AvatarProps["shape"]>;
	assigneeUnassignedKind?: AvatarUnassignedKind;
	assigneePulse?: boolean;
	active?: boolean;
	/** Raised elevation is the default card chrome. Stroke is a 1px border with no shadow. */
	chrome?: JiraIssueChrome;
	/** Compact experimental internals. Implied by stroke chrome; pair with raised chrome to change only elevation. */
	compact?: boolean;
	/** Compact keeps 12px icons and 16px avatars. Comfortable uses 16px icons and 24px avatars. */
	iconScale?: JiraIssueIconScale;
	parentOwnsLayout?: boolean;
	/** Nested subtask cards inherit the parent chrome unless set. Compact cards default to stroke so Raised/Stroke only changes the parent. */
	subtaskChrome?: JiraIssueChrome;
	selected?: boolean;
	dragging?: boolean;
	showPriorityIndicator?: boolean;
	showAutomationIndicator?: boolean;
	parentEpicControl?: ReactNode;
	subtasks?: readonly JiraIssueSubtask[];
	subtasksCompleted?: number;
	subtasksLabel?: string;
	defaultSubtasksExpanded?: boolean;
	subtasksExpanded?: boolean;
	onSubtasksExpandedChange?: (expanded: boolean) => void;
	agentActivities?: readonly JiraIssueAgentActivity[];
	agentDoneRuns?: readonly JiraIssueCompletedAgentRun[];
	agentActivityMode?: JiraIssueAgentActivityMode;
	assignment?: JiraIssueAgentAssignment;
	/** Stable preview capability for Agent Session column targeting. Keep present while highlighted changes. */
	agentSessionTargetPreview?: Readonly<{ highlighted: boolean }>;
	/** Merged collapses active agents into one prioritized chin row; split gives each agent its own row. */
	agentActivityLayout?: JiraIssueAgentActivityLayout;
	/** One-shot brand sweep across the chin row a session was just linked into. */
	agentLinkFlash?: JiraIssueAgentLinkFlash;
	onAgentActivityOpenChange?: (open: boolean) => void;
	onAgentActivityViewChat?: (activity: JiraIssueAgentActivity) => void;
	/** Optional host-owned visual override for active agent-session states. */
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	onAgentDoneRunSubmit?: (run: JiraIssueCompletedAgentRun, prompt: string) => void;
	onAgentDoneRunReview?: (run: JiraIssueCompletedAgentRun) => void;
	onAgentDoneRunView?: (run: JiraIssueCompletedAgentRun) => void;
	/** Controls the built-in hover-revealed issue actions menu. */
	showMoreAction?: boolean;
	/** Called after an item is selected from the issue actions menu. */
	onMoreActionSelect?: (action: JiraIssueMoreAction) => void;
	generativeAction?: JiraIssueGenerativeActionConfig;
	/** Chooses whether the agent/skill action appears as a sparkle or within More actions. */
	generativeActionPresentation?: JiraIssueGenerativeActionPresentation;
	/** Opt-in: makes the chin rows draggable and adds the unlink/move drop zones below the card. */
	agentSessionTransfer?: JiraIssueAgentSessionTransferConfig;
	/** Board-owned drag state and target preview. Omit for the local transfer model. */
	agentSessionDragControl?: JiraIssueAgentSessionDragControl;
	/**
	 * Rendered after the drop well so a detached session can drag back onto
	 * the card.
	 */
	sessionTransferAfter?: (
		sessionDrag: JiraIssueAgentSessionDragBinding,
	) => ReactNode;
}

export type JiraIssueProps = JiraIssueDefaultProps | JiraIssueUncapturedWorkProps;

export function JiraIssue(props: Readonly<JiraIssueProps>) {
	if (props.variant === "uncaptured-work") {
		return <JiraIssueUncapturedWork {...props} />;
	}

	return <JiraIssueDefault {...props} />;
}

function JiraIssueDefault({
	"aria-pressed": ariaPressed,
	active = false,
	agentActivities,
	agentActivityMode,
	agentActivityLayout = "merged", assignment,
	agentSessionDragControl,
	agentSessionTargetPreview,
	agentDoneRuns = [],
	agentLinkFlash,
	agentSessionTransfer,
	assigneeAvatarLabel,
	assigneeAvatarShape = "circle",
	assigneeAvatarSrc,
	assigneePulse = false,
	assigneeUnassignedKind,
	chrome = "raised",
	compact = false, iconScale = "compact", parentOwnsLayout = false,
	className,
	defaultSubtasksExpanded = false,
	dragging = false,
	draggable = true,
	generativeAction,
	generativeActionPresentation = "sparkle",
	issueKey,
	issueTypeLabel = "Task",
	onSubtasksExpandedChange,
	onAgentActivityOpenChange,
	onAgentActivityViewChat,
	renderAgentActivityIndicator,
	onAgentDoneRunSubmit,
	onAgentDoneRunReview,
	onAgentDoneRunView,
	onMoreActionSelect,
	parentEpicControl,
	priority = "major",
	pullRequestNumber,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	selected = false,
	sessionTransferAfter,
	showAutomationIndicator = false,
	showMoreAction = true,
	showPriorityIndicator = true,
	style,
	subtaskChrome,
	subtasks,
	subtasksCompleted,
	subtasksExpanded,
	subtasksLabel = "Subtasks",
	summary,
	tags,
	type = "button",
	variant = "default",
	...props
}: Readonly<JiraIssueDefaultProps>) {
	const isMounted = useIsMounted();
	const shouldReduceMotion = useReducedMotion();
	const subtasksPanelId = useId();
	const agentActivityLayoutGroupId = useId();
	const [generativeActionAnchor, setGenerativeActionAnchor] = useState<HTMLElement | null>(null);
	const [internalSubtasksExpanded, setInternalSubtasksExpanded] = useState(defaultSubtasksExpanded);
	const [generativeActionPointerActive, setGenerativeActionPointerActive] = useState(false);
	const [generativeActionFocusActive, setGenerativeActionFocusActive] = useState(false);
	const [generativeActionRevealSuppressed, setGenerativeActionRevealSuppressed] = useState(false);
	const [agentActivityHoverOpen, setAgentActivityHoverOpen] = useState(false);
	const [moreActionMenuOpen, setMoreActionMenuOpen] = useState(false);
	const [internalAgentSessionDragState, setInternalAgentSessionDragState] = useState<JiraIssueAgentSessionDragState>(
		JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
	);
	const resolvedAgentSessionDragState = agentSessionDragControl?.state ?? internalAgentSessionDragState;
	const cardMeasureRef = useRef<HTMLElement | null>(null);
	// While the transfer drop zone is revealed it owns the gesture, so the
	// hover-revealed sparkle stands down rather than competing for the pointer.
	const agentSessionTransferRevealed = Boolean(agentSessionTransfer)
		&& resolvedAgentSessionDragState.dragging
		&& (agentSessionDragControl === undefined
			|| agentSessionDragControl.sourceActive
			|| agentSessionDragControl.dropTarget !== null);
	const generativeActionRevealActive = !agentActivityHoverOpen
		&& !agentSessionTransferRevealed
		&& !moreActionMenuOpen
		&& !generativeActionRevealSuppressed
		&& (generativeActionPointerActive || generativeActionFocusActive);
	const localAgentSessionDragBinding: JiraIssueAgentSessionDragBinding | undefined = agentSessionTransfer
		? {
			onDragStateChange: (state) => {
				// A finished gesture must not leave `source: "detached"` on the
				// transfer state or the next hover still treats the card as an
				// attach target. Keep `cancelled` for one commit so the well can
				// clear without linking.
				setInternalAgentSessionDragState(
					state.cancelled
						? { ...JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE, cancelled: true }
						: state.dragging
							? state
							: JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
				);
			},
			onFocusedActivitiesChange: (activities) => setInternalAgentSessionDragState((current) => ({
				...current,
				activities,
			})),
			onUnlink: agentSessionTransfer.onUnlink,
		}
		: undefined;
	const agentSessionDragBinding: JiraIssueAgentSessionDragBinding | undefined = agentSessionDragControl?.binding ?? localAgentSessionDragBinding;
	const hasSubtasks = Boolean(subtasks?.length);
	const resolvedSubtasksExpanded = subtasksExpanded ?? internalSubtasksExpanded;
	const completedSubtaskCount = getCompletedCount(subtasksCompleted, subtasks?.length ?? 0);
	const nonCompletedAgentActivities = (agentActivities ?? []).filter((activity) => activity.state !== "completed");
	const inferredAgentActivityMode: JiraIssueAgentActivityMode = nonCompletedAgentActivities.some((activity) => activity.state === "awaiting-input")
		? "awaiting-input"
		: nonCompletedAgentActivities.length > 0
			? "working"
			: agentDoneRuns.length > 0
				? "completed"
				: "none";
	const resolvedAgentActivityMode = agentActivityMode ?? inferredAgentActivityMode;
	// Comfortable (experimental v2) paints finished agents as normal session
	// rows. The compact merged "N Finished" chip is original-experimental only.
	const finishedAgentActivities = iconScale === "comfortable" && resolvedAgentActivityMode === "completed"
		? agentDoneRuns.map(toJiraIssueAgentActivityFromCompletedRun)
		: [];
	const activeAgentActivities = resolvedAgentActivityMode === "none"
		? []
		: resolvedAgentActivityMode === "completed"
			? finishedAgentActivities
			: nonCompletedAgentActivities;
	const hasCompletedAgentChin = resolvedAgentActivityMode === "completed" && agentDoneRuns.length > 0;
	const hasAgentDoneNotification = iconScale !== "comfortable" && hasCompletedAgentChin;
	const handleAgentActivityViewChat = resolveComfortableCompletedRunViewChat(
		onAgentActivityViewChat, onAgentDoneRunView, agentDoneRuns, iconScale,
	);
	const agentSessionTargetHighlighted = agentSessionTargetPreview?.highlighted ?? false;
	const inferredPullRequestNumber = agentDoneRuns.find((run) => run.pullRequestNumber)?.pullRequestNumber;
	const resolvedPullRequestNumber = pullRequestNumber ?? inferredPullRequestNumber;
	// A session travelling toward this card publishes a continuous 0..1 ramp.
	// Only the grey backdrop's opacity follows it; the chin below flips once, at
	// a threshold, so the card's height change stays one crisp transition.
	const attachNearness = resolveJiraIssueAttachNearness(
		agentSessionDragControl?.attachNearness,
		shouldReduceMotion,
	);
	const isAttachingSession = agentSessionDragControl
		? agentSessionDragControl.dropTarget === "attach"
			|| isJiraIssueAttachChinArmed(attachNearness)
		: isJiraIssueSessionAttachPreview(
			resolvedAgentSessionDragState.dragging,
			resolvedAgentSessionDragState.source,
		);
	const attachSessionCount = resolveLinkAgentSessionChinCount(
		agentSessionDragControl?.dragCount,
		resolvedAgentSessionDragState.dragging
			? resolvedAgentSessionDragState.transfer.members.length
			: undefined,
	);
	const attachChinCopy = isAttachingSession
		? linkAgentSessionChinCopy(attachSessionCount)
		: undefined;
	// Nearby/detached pills already occupy the last chin. Swap that slot for
	// attach copy instead of opening a second row under the shell.
	const replaceDetachedTransfer = Boolean(attachChinCopy && sessionTransferAfter);
	// Unlink keeps `working` with an empty chin so the grey backdrop stays
	// around the issue. The shell keys off mode, not a mounted row.
	const hasActiveAgentActivityShell = resolvedAgentActivityMode === "working"
		|| resolvedAgentActivityMode === "awaiting-input"
		|| hasCompletedAgentChin
		|| isAttachingSession
		|| agentSessionTargetHighlighted;
	const hasAgentActivityChin = activeAgentActivities.length > 0
		|| hasCompletedAgentChin
		|| isAttachingSession;
	const hasIssueRows = hasSubtasks;
	const hasAgentActivityPresentation = agentActivityMode !== undefined || Boolean(agentActivities?.length) || hasCompletedAgentChin;
	// Agent chrome also leaves for reasons that have nothing to do with this card:
	// a board filter such as View → Agents strips every row off the cards it is
	// not focusing, and the shell it hosts is the element-type switch described
	// below. Falling back to the plain tree there remounts a card that never left
	// the screen — keyboard focus is lost and every mount-animated descendant
	// replays its entrance, the assignee avatar's scale-and-fade most visibly.
	//
	// This is history, not derived state: nothing in the current props can say
	// whether this card has already mounted a shell, so the latch is set during
	// render rather than from an effect. There is no stale frame to adjust away —
	// the render that first sees agent chrome already resolves the shell through
	// the `hasAgentActivityPresentation` term below — and a shell with no active
	// agent activity is the resting state of a session-target preview, so the
	// card paints identically once the rows are gone.
	const [agentActivityShellMounted, setAgentActivityShellMounted] = useState(
		hasAgentActivityPresentation,
	);
	if (hasAgentActivityPresentation && !agentActivityShellMounted) {
		setAgentActivityShellMounted(true);
	}
	// The approach also mounts the shell. With `initial={false}` on the backdrop,
	// a shell that only appears once the pointer is already inside the rect has
	// nothing to fade from and snaps to full grey. Mounting early is visually
	// neutral: `hasActiveAgentActivityShell` is still false, so the surface layer
	// paints the same card chrome at the same inset. It keys off stable drag and
	// target-preview capabilities rather than the live ramp or hover because
	// swapping the shell in is a React
	// element-type change on the article's first child: a per-frame gate would
	// remount the whole card — dropping keyboard focus — every time a pointer
	// passed within the proximity range.
	const usesAgentActivityShell = hasAgentActivityPresentation
		|| agentActivityShellMounted
		|| Boolean(agentSessionTransfer)
		|| agentSessionDragControl !== undefined
		|| Boolean(agentSessionTargetPreview);
	const chromeStyles = resolveJiraIssueChrome(chrome);
	const usesStrokeChrome = chrome === "stroke";
	const usesCompactVisual = compact || usesStrokeChrome;
	const hasInteractiveContent = showMoreAction || hasSubtasks || Boolean(parentEpicControl) || hasAgentActivityPresentation || agentActivityShellMounted || Boolean(generativeAction) || Boolean(agentSessionTransfer) || usesCompactVisual || Boolean(agentSessionTargetPreview);
	const shouldRenderIssueClickButton = Boolean(props.onClick && !parentEpicControl);
	const issueRowsClassName = cn("pt-1", !(hasSubtasks && resolvedSubtasksExpanded) && "pb-1");
	const layoutTransition = getJiraIssueLayoutTransition(shouldReduceMotion);
	const presenceMotion = getJiraIssuePresenceMotion(shouldReduceMotion);
	const issueChromeClassName = cn(chromeStyles.restClassName, chromeStyles.hoverClassName);
	const agentSurfaceChromeClassName = cn(
		chromeStyles.restClassName,
		chromeStyles.agentSurfaceHoverClassName,
	);
	// The resting surface hairline only reads as gutter while the card sits on the
	// grey agent backdrop: `border-border-disabled` is a 6%-alpha dark tint, and
	// composited over the card's own white it lands within a hair of
	// `bg-bg-neutral`, so the card's edge appeared to start 1px inside
	// the chin rows. With no active shell the card is on the page background and
	// still needs its stroke outline. Selected and active keep their own treatment
	// because they do not sit on a white fill.
	const agentActivityRestBorderClassName = !hasActiveAgentActivityShell
		? agentSurfaceChromeClassName
		: usesStrokeChrome
			? cn("border-surface", chromeStyles.agentSurfaceHoverClassName)
			: agentSurfaceChromeClassName;
	const rootBaseStyle: CSSProperties = {
		borderRadius: token("radius.large"),
		boxShadow: chromeStyles.boxShadow,
		cursor: dragging ? "grabbing" : "default",
		opacity: dragging ? 0.5 : 1,
		textAlign: "left",
		transformOrigin: "top center",
		...style,
	};
	const buttonStyle: CSSProperties = {
		...rootBaseStyle,
		padding: token("space.150"),
	};
	const rootClassName = cn(
		"group/jira-issue relative w-full min-w-0 border outline-none focus-visible:border-ring",
		usesAgentActivityShell
			? "group/jira-issue-card border-transparent bg-transparent"
			: selected
				? "border-border-selected bg-bg-selected"
				: active
					? cn(
						chromeStyles.restClassName,
						usesStrokeChrome ? chromeStyles.hoverClassName : undefined,
						"bg-bg-selected",
					)
					: cn(issueChromeClassName, "bg-surface"),
		"transition-[opacity,background-color,border-color] duration-normal ease-out",
		"data-starting-style:opacity-0 data-starting-style:-translate-y-1",
		!usesAgentActivityShell && className,
	);
	const agentActivitySurfaceClassName = cn(
		"pointer-events-none absolute border",
		selected
			? "border-border-selected bg-bg-selected"
			: active
				? cn(
					chromeStyles.restClassName,
					usesStrokeChrome ? chromeStyles.agentSurfaceHoverClassName : undefined,
					"bg-bg-selected",
				)
				: cn(agentActivityRestBorderClassName, "bg-surface"),
	);
	// Last chin row is the travelling chip: keep the grey backdrop and close
	// the open chin so the well hugs the white card. A 4px bottom pad matches
	// the empty-chin gutter. Keys off `data-session-chip-out` in the same
	// commit as the row collapse — do not lift that flag into React or the
	// transfer hit test measures a stale well. Remaining docked rows keep the
	// open chin.
	const agentActivitySessionChipOutCloseClass =
		"has-[[data-session-chip-out]]:not-has-[[data-slot=jira-issue-agent-row-wrap]:not([data-session-chip-out])]:pb-1";
	const agentActivityShellClassName = cn(
		"relative w-full min-w-0 overflow-visible rounded-[10px] outline-none",
		"transition-[opacity,background-color,border-color] duration-normal ease-out",
		"data-starting-style:opacity-0 data-starting-style:-translate-y-1",
		// Motion's layout transform makes the shell its own stacking context, so a
		// z-index on the dragged chip cannot escape it. Lift the whole shell above
		// the drop wells — a later sibling — for the duration of the drag.
		resolvedAgentSessionDragState.dragging
			&& (agentSessionDragControl?.sourceActive ?? true)
			&& "z-20",
		agentActivitySessionChipOutCloseClass,
	);
	const agentActivityArticleClassName = cn(
		"group/jira-issue relative w-full min-w-0 overflow-visible outline-none",
		"data-starting-style:opacity-0 data-starting-style:-translate-y-1",
		className,
	);
	// The surface and separator are absolutely positioned inside the card's own 1px
	// border, so their offsets are measured from its padding box — an inset of 4
	// puts them 4px from the article edge, flush with the `px-1` gutter the chin
	// rows use. (This was 5, which pushed the card 1px narrower than those rows.)
	const agentActivitySurfaceInset = hasActiveAgentActivityShell ? 4 : 0;
	const agentActivityArticleStyle: CSSProperties = {
		borderRadius: "10px",
		cursor: rootBaseStyle.cursor,
		opacity: rootBaseStyle.opacity,
		textAlign: "left",
		transformOrigin: "top center",
		...style,
	};
	const agentActivityBackdropAnimation = {
		bottom: 0,
		left: 0,
		opacity: hasActiveAgentActivityShell ? 1 : attachNearness,
		right: 0,
		top: 0,
	};
	// Opacity is the one value here that chases a pointer, so it gets its own
	// per-value timing. The reduced-motion branch keeps the object plain numbers
	// because it is spread straight into `style`.
	const agentActivityBackdropTransition = shouldReduceMotion
		? layoutTransition
		: { ...layoutTransition, opacity: JIRA_ISSUE_MOTION_BACKDROP_NEARNESS };
	const agentActivitySurfacePosition = agentActivitySurfaceInset - 1;
	// No chin row under the card means the well's bottom band has to come out of
	// the card, exactly like its left, right, and top bands. Adding a spacer row
	// instead would grow the shell by 4px the moment a hovered agent session
	// highlighted the card and shove every card below it down.
	const insetsAgentActivitySurfaceBottom = hasActiveAgentActivityShell && !hasAgentActivityChin;
	const agentActivitySurfaceAnimation = getJiraIssueAgentSurfaceOffsets(
		agentActivitySurfacePosition,
		insetsAgentActivitySurfaceBottom,
	);
	const agentActivitySurfaceStyle: CSSProperties = {
		...AGENT_ACTIVITY_SURFACE_STYLE,
		boxShadow: chromeStyles.boxShadow,
	};

	function handleSubtasksToggle() {
		const nextExpanded = !resolvedSubtasksExpanded;
		if (subtasksExpanded === undefined) {
			setInternalSubtasksExpanded(nextExpanded);
		}
		onSubtasksExpandedChange?.(nextExpanded);
	}

	function handleAgentActivityOpenChange(open: boolean) {
		setAgentActivityHoverOpen(open);
		onAgentActivityOpenChange?.(open);
	}

	function handleGenerativeActionPointerOver(event: PointerEvent<HTMLElement>) {
		if (
			event.target instanceof Element
			&& event.target.closest("[data-slot='jira-issue-agent-row'], [data-slot='jira-issue-session-transfer']")
		) {
			setGenerativeActionRevealSuppressed(true);
			setGenerativeActionPointerActive(false);
			return;
		}

		if (event.currentTarget.contains(event.target as Node)) {
			setGenerativeActionRevealSuppressed(false);
			setGenerativeActionPointerActive(true);
		}
	}

	function handleGenerativeActionPointerOut(event: PointerEvent<HTMLElement>) {
		if (!event.currentTarget.contains(event.target as Node)) {
			return;
		}

		const nextTarget = event.relatedTarget as Node | null;
		if (event.currentTarget.contains(nextTarget)) {
			return;
		}

		setGenerativeActionPointerActive(false);
	}

	function handleGenerativeActionFocusCapture(event: FocusEvent<HTMLElement>) {
		if (
			event.target instanceof Element
			&& event.currentTarget.contains(event.target)
		) {
			setGenerativeActionRevealSuppressed(false);
			setGenerativeActionFocusActive(event.target.matches(":focus-visible"));
		}
	}

	function handleGenerativeActionBlurCapture(event: FocusEvent<HTMLElement>) {
		if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
			return;
		}

		const nextTarget = event.relatedTarget as Node | null;
		if (event.currentTarget.contains(nextTarget)) {
			return;
		}

		setGenerativeActionFocusActive(false);
	}

	const summaryContent = (
		<JiraIssueSummary
			assigneeAvatarLabel={assigneeAvatarLabel}
			assigneeAvatarShape={assigneeAvatarShape}
			assigneeAvatarSrc={assigneeAvatarSrc}
			assigneePulse={assigneePulse}
			assigneeUnassignedKind={assigneeUnassignedKind}
			iconScale={iconScale}
			issueKey={issueKey}
			issueTypeLabel={issueTypeLabel}
			isMounted={isMounted}
			parentEpicControl={parentEpicControl}
			priority={priority}
			pullRequestNumber={resolvedPullRequestNumber}
			pullRequestPreview={pullRequestPreview}
			pullRequestStatus={pullRequestStatus}
			pullRequestTitle={pullRequestTitle}
			showAutomationIndicator={showAutomationIndicator}
			showPriorityIndicator={showPriorityIndicator}
			summary={summary}
			tags={tags}
			usesStrokeChrome={usesCompactVisual}
		/>
	);
	const moreActionMenu = showMoreAction ? (
		<div className="absolute right-3 top-3 z-20 size-6">
			<JiraIssueMoreMenu
				generativeAction={generativeActionPresentation === "more-actions" ? generativeAction : undefined}
				generativeActionIssue={{ issueKey, summary }}
				issueKey={issueKey}
				onActionSelect={onMoreActionSelect}
				onOpenChange={setMoreActionMenuOpen}
			/>
		</div>
	) : null;
	const richIssueContent = (
		<div className="relative z-10 flex flex-col">
			{shouldRenderIssueClickButton ? (
				usesCompactVisual ? (
					<div className="relative w-full px-3 pt-3 pb-2 text-left outline-none transition-colors duration-normal ease-out has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
						<button
							aria-pressed={ariaPressed ?? selected}
							className="sr-only"
							disabled={props.disabled}
							onClick={props.onClick}
							type={type}
						>
							{issueKey}: {summary}
						</button>
						<div
							onClick={props.disabled ? undefined : props.onClick as ComponentProps<"div">["onClick"]}
						>
							{summaryContent}
						</div>
					</div>
				) : (
					<button
						type={type}
						aria-pressed={ariaPressed ?? selected}
						className="w-full p-3 text-left outline-none transition-colors duration-normal ease-out focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						disabled={props.disabled}
						onClick={props.onClick}
					>
						{summaryContent}
					</button>
				)
			) : (
				<div className={usesCompactVisual ? "px-3 pt-3 pb-2" : "p-3"}>{summaryContent}</div>
			)}
			{moreActionMenu}
			<AnimatePresence initial={false} mode="popLayout">
				{hasIssueRows && subtasks ? (
					<motion.div
						key="issue-rows"
						animate={presenceMotion.animate}
						exit={presenceMotion.exit}
						initial={presenceMotion.initial}
						layout={shouldReduceMotion || parentOwnsLayout ? false : "position"}
						style={shouldReduceMotion ? undefined : JIRA_ISSUE_MOTION_STYLE}
						transition={layoutTransition}
					>
						<JiraIssueSeparator
							inset={usesAgentActivityShell ? agentActivitySurfaceInset : 0}
							usesStrokeChrome={usesCompactVisual}
						/>
						<div className={issueRowsClassName}>
							<JiraIssueSubtasks
								chrome={chrome}
								compact={usesCompactVisual}
								completedCount={completedSubtaskCount}
								controlId={subtasksPanelId}
								expanded={resolvedSubtasksExpanded}
								hasInsetSurface={hasActiveAgentActivityShell && !insetsAgentActivitySurfaceBottom}
								iconScale={iconScale}
								label={subtasksLabel}
								onToggle={handleSubtasksToggle}
								shouldReduceMotion={shouldReduceMotion}
								subtaskChrome={subtaskChrome}
								subtasks={subtasks}
							/>
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
	const generativeActionMenu = generativeAction && (generativeActionPresentation === "sparkle" || !showMoreAction) ? (
		<JiraIssueGenerativeActionMenu
			action={generativeAction}
			anchor={generativeActionAnchor}
			issue={{ issueKey, summary }}
			onOpenChange={(nextOpen) => setGenerativeActionRevealSuppressed(!nextOpen)}
			onTriggerBlur={() => setGenerativeActionFocusActive(false)}
			onTriggerFocus={() => setGenerativeActionFocusActive(true)}
			onTriggerPointerEnter={() => setGenerativeActionPointerActive(true)}
			onTriggerPointerLeave={() => setGenerativeActionPointerActive(false)}
			revealActive={generativeActionRevealActive}
		/>
	) : null;
	const agentActivityShell = (
		<motion.div
			ref={(node) => {
				cardMeasureRef.current = node;
			}}
			className={agentActivityShellClassName}
			data-slot="jira-issue-agent-shell"
			initial={false}
			layout={!(shouldReduceMotion || agentActivityHoverOpen || parentOwnsLayout)}
			layoutRoot={!parentOwnsLayout}
			style={AGENT_ACTIVITY_SHELL_STYLE}
			transition={layoutTransition}
		>
			<motion.div
				aria-hidden="true"
				animate={shouldReduceMotion ? undefined : agentActivityBackdropAnimation}
				className={cn(
					"pointer-events-none absolute transition-colors duration-xxshort ease-out-practical motion-reduce:transition-none",
					agentSessionTargetHighlighted ? "bg-bg-neutral-hovered" : "bg-bg-neutral",
				)}
				data-slot="jira-issue-agent-backdrop"
				initial={false}
				style={shouldReduceMotion ? { ...AGENT_ACTIVITY_BACKDROP_STYLE, ...agentActivityBackdropAnimation } : AGENT_ACTIVITY_BACKDROP_STYLE}
				transition={agentActivityBackdropTransition}
			/>
			<LayoutGroup id={agentActivityLayoutGroupId}>
				<motion.div
					className={rootClassName}
					data-slot="jira-issue-card"
					layout={shouldReduceMotion || agentActivityHoverOpen || parentOwnsLayout ? false : "position"}
					style={AGENT_ACTIVITY_INNER_STYLE}
					transition={layoutTransition}
				>
					<motion.div
						aria-hidden="true"
						animate={shouldReduceMotion ? undefined : agentActivitySurfaceAnimation}
						className={agentActivitySurfaceClassName}
						data-slot="jira-issue-surface"
						initial={false}
						style={shouldReduceMotion
							? { ...agentActivitySurfaceStyle, ...agentActivitySurfaceAnimation }
							: agentActivitySurfaceStyle}
						transition={layoutTransition}
					/>
					{richIssueContent}
				</motion.div>
				{/* Running sessions already occupy the chin; attach copy takes the last
				    row instead of stacking. Split layouts keep the other rows so the
				    card height — and drop-zone geometry — stays put. */}
				<JiraIssueAgentActivityRows
					activities={activeAgentActivities} assignment={assignment}
					attachPreviewCopy={replaceDetachedTransfer ? undefined : attachChinCopy}
					iconScale={iconScale}
					inheritChinSurface
					linkFlash={agentLinkFlash}
					instantSessionTransfer={agentSessionDragControl !== undefined}
					layout={agentActivityLayout}
					onOpenChange={handleAgentActivityOpenChange}
					onViewChat={handleAgentActivityViewChat}
					renderAgentActivityIndicator={renderAgentActivityIndicator}
					sessionDrag={agentSessionDragBinding}
					shouldReduceMotion={shouldReduceMotion}
					usesStrokeChrome={usesCompactVisual}
				/>
				<AnimatePresence initial={false} mode="popLayout">
					{hasAgentDoneNotification ? (
						<motion.div
							key="agent-review"
							animate={presenceMotion.animate}
							exit={presenceMotion.exit}
							initial={presenceMotion.initial}
							layout={shouldReduceMotion || parentOwnsLayout ? false : "position"}
							style={shouldReduceMotion ? undefined : JIRA_ISSUE_MOTION_STYLE}
							transition={layoutTransition}
						>
							<JiraIssueAgentDone
								layout={agentActivityLayout}
								onOpenChange={handleAgentActivityOpenChange}
								onReview={onAgentDoneRunReview}
								onSubmit={onAgentDoneRunSubmit}
								onView={onAgentDoneRunView}
								renderAgentActivityIndicator={renderAgentActivityIndicator}
								runs={agentDoneRuns}
								usesStrokeChrome={usesCompactVisual}
							/>
						</motion.div>
					) : null}
				</AnimatePresence>
			</LayoutGroup>
		</motion.div>
	);
	// The transfer host is unconditional. `agentSessionTransfer` is a capability
	// that comes and goes with the board's own state — a filter that hides the
	// last unlinkable row takes it away — and making it choose between a wrapped
	// and an unwrapped shell is another element-type change on the article's
	// first child, with the same remount cost as the shell gate above. The
	// wrapper is a plain full-width block with no chrome, so keeping it costs
	// nothing when there is no transfer to host.
	const agentActivityShellWithTransfer = (
		<div
			className={cn(
				"relative w-full min-w-0 overflow-visible",
				agentSessionTransfer ? JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS : null,
			)}
		>
			{agentActivityShell}
			{agentSessionTransfer ? (
				<JiraIssueAgentSessionTransfer
					cancelled={resolvedAgentSessionDragState.cancelled}
					cardMeasureRef={cardMeasureRef}
					commitDrops={agentSessionDragControl === undefined}
					config={agentSessionTransfer}
					controlledArmed={agentSessionDragControl ? agentSessionDragControl.dropTarget === "unlink" : undefined}
					dragging={resolvedAgentSessionDragState.dragging}
					pointer={resolvedAgentSessionDragState.pointer}
					session={resolvedAgentSessionDragState.activities[0]}
					sessionLabel={resolvedAgentSessionDragState.activities[0]?.name}
					source={resolvedAgentSessionDragState.source}
				/>
			) : null}
			{/* Detached/proximity pills sit under the shell. Attach copy covers
			    that occupied slot so the chin does not grow a second row, but
			    the drag source stays mounted through pointer release. */}
			{agentSessionTransfer && agentSessionDragBinding && sessionTransferAfter
				? (
					<JiraIssueDetachedSessionTransferSlot
						attachCopy={replaceDetachedTransfer ? attachChinCopy : undefined}
					>
						{sessionTransferAfter(agentSessionDragBinding)}
					</JiraIssueDetachedSessionTransferSlot>
				)
				: null}
		</div>
	);

	if (hasInteractiveContent) {
		if (usesAgentActivityShell) {
			return (
				<article
					ref={setGenerativeActionAnchor}
					draggable={draggable}
					className={agentActivityArticleClassName}
					data-active={active || undefined}
					data-dragging={dragging || undefined}
					data-session-dragging={resolvedAgentSessionDragState.dragging || undefined}
					data-selected={selected || undefined}
					data-variant={variant}
					data-agent-activity-mode={resolvedAgentActivityMode}
					onBlurCapture={handleGenerativeActionBlurCapture}
					onDragEnd={props.onDragEnd as ComponentProps<"article">["onDragEnd"]}
					onDragStart={props.onDragStart as ComponentProps<"article">["onDragStart"]}
					onFocusCapture={handleGenerativeActionFocusCapture}
					onPointerOut={handleGenerativeActionPointerOut}
					onPointerOver={handleGenerativeActionPointerOver}
					style={agentActivityArticleStyle}
				>
					{agentActivityShellWithTransfer}
					{generativeActionMenu}
				</article>
			);
		}

		return (
			<article
				ref={setGenerativeActionAnchor}
				draggable={draggable}
				className={rootClassName}
				data-active={active || undefined}
				data-dragging={dragging || undefined}
				data-selected={selected || undefined}
				data-variant={variant}
				onBlurCapture={handleGenerativeActionBlurCapture}
				onDragEnd={props.onDragEnd as ComponentProps<"article">["onDragEnd"]}
				onDragStart={props.onDragStart as ComponentProps<"article">["onDragStart"]}
				onFocusCapture={handleGenerativeActionFocusCapture}
				onPointerOut={handleGenerativeActionPointerOut}
				onPointerOver={handleGenerativeActionPointerOver}
				style={rootBaseStyle}
			>
				{richIssueContent}
				{generativeActionMenu}
			</article>
		);
	}

	return (
		<button
			type={type}
			draggable={draggable}
			aria-pressed={ariaPressed ?? selected}
			className={rootClassName}
			data-active={active || undefined}
			data-dragging={dragging || undefined}
			data-selected={selected || undefined}
			data-variant={variant}
			style={buttonStyle}
			{...props}
		>
			{summaryContent}
		</button>
	);
}
