"use client";

import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type Dispatch,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactElement,
	type RefObject,
	type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
	AnimatePresence,
	motion,
	useMotionValue,
	useSpring,
	type MotionValue,
	type Transition,
} from "motion/react";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import {
	type AgentAssignmentAgent,
	type AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment";
import type { AgentListHost, AgentListInvoker } from "@/components/blocks/agent-list";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { AgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { agentIdentityLabel } from "@/components/blocks/agent-session/agent-session-identity-label";
import { AgentSessionDragPill } from "@/components/blocks/agent-session/agent-session-drag-chip";
import {
	groupJiraIssueAgentActivityRows,
	summarizeJiraIssueAgentActivities,
	type JiraIssueAgentActivityLayout,
} from "@/components/blocks/jira-issue/agent-activity-model";
import {
	useJiraIssueAgentStartupPhase,
} from "@/components/blocks/jira-issue/agent-activity-startup";
import {
	sessionDragChipViewportStyle,
	sessionTransferTintSeed,
	type JiraIssueAgentSessionDragBinding,
} from "@/components/blocks/jira-issue/agent-session-drag";
import type { JiraIssueAgentLinkFlash } from "@/components/blocks/jira-issue/agent-link-flash";
import { JiraIssueAttachChinSlot } from "@/components/blocks/jira-issue/attach-chin";
import type { JiraIssueIconScale } from "@/components/blocks/jira-issue/types";
import { useSessionDragChipPointer } from "@/components/blocks/jira-issue/use-session-drag-chip-pointer";
import type { QuestionCardQuestion } from "@/components/blocks/question-card/types";
import {
	usePointerDrag,
	type PointerDragPosition,
} from "@/components/ui-custom/hooks/use-pointer-drag";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { cn } from "@/lib/utils";

import {
	JiraIssueAgentAssignmentHandle,
	JiraIssueAgentRowContent,
	JiraIssueAgentRowSurface,
	JiraIssueAgentStatusAffordance,
	JiraIssueAgentStatusIcon,
	type JiraIssueAgentAssignment,
} from "./agent-activity-row-presentation";

export type { JiraIssueAgentAssignment } from "./agent-activity-row-presentation";

export type JiraIssueAgentActivityMode = "none" | "working" | "awaiting-input" | "completed";
export type JiraIssueAgentActivityState = "working" | "awaiting-input" | "completed";
export type JiraIssueAgentActivityAvatarLayout = "animated" | "horizontal-group";
/**
 * The chin-row glyph states a host may override. `working` and `awaiting-input`
 * come from a live activity row; `finished` is the per-run outcome the split
 * review chin paints for a completed run that did not fail. A failed run is
 * deliberately absent — it keeps the block's own error status so a failure can
 * never be softened by a host renderer.
 */
export type JiraIssueAgentActivityIndicatorState =
	| Exclude<JiraIssueAgentActivityState, "completed">
	| "finished";
export type JiraIssueAgentActivityIndicatorRenderer = (
	state: JiraIssueAgentActivityIndicatorState,
) => ReactElement;
export type { JiraIssueAgentActivityLayout } from "@/components/blocks/jira-issue/agent-activity-model";
export type { JiraIssueAgentLinkFlash } from "@/components/blocks/jira-issue/agent-link-flash";
export type {
	JiraIssueAgentSessionDragBinding,
	JiraIssueAgentSessionDragState,
} from "@/components/blocks/jira-issue/agent-session-drag";

export interface JiraIssueAgentActivity {
	id: string;
	name: string;
	avatarSrc?: string;
	agentBrandName?: ThirdPartyLogoName;
	agentVpkLogo?: "rovo";
	label: string;
	labels?: readonly string[];
	message?: string;
	/** Stable start time supplied by a real running session. */
	startedAtMs?: number;
	/** Optional seeded runtime for demos; active timers continue from this value. */
	initialElapsedSeconds?: number;
	/**
	 * Human who invoked the session. Carried so a chin row dragged off the card
	 * keeps the face beside the agent mark instead of degrading mid-flight.
	 */
	invokedBy?: AgentListInvoker;
	/** Where the session runs. Drives the assignment flyout host glyph and more-menu. */
	host?: AgentListHost;
	/**
	 * Stable elapsed stamp for assignment flyout rows. Omit only for a session
	 * that just started; demo placeholders must set this so the clock is not 0s.
	 */
	timeLabel?: string;
	/**
	 * Owner sees the session more-menu; viewer sees the information hint.
	 * Omit to keep the owner menu.
	 */
	role?: AgentSessionRole;
	cycleIntervalJitterMs?: number;
	cycleIntervalMs?: number;
	startupSequence?: "jira-work-item-start";
	question?: QuestionCardQuestion;
	state: JiraIssueAgentActivityState;
}

const JIRA_ISSUE_SESSION_DRAG_ORIGIN: PointerDragPosition = { x: 0, y: 0 };
/** Same 2px threshold as `usePointerDrag` — publish/arm only after a real move. */
const JIRA_ISSUE_SESSION_DRAG_PUBLISH_THRESHOLD_PX = 2;
/** Travel before the chin row hands over to the opaque at-mention chip. */
const JIRA_ISSUE_SESSION_DRAG_CHIP_DISTANCE_PX = 12;
/** Light friction so the dragged tag trails a few frames behind the pointer. */
const JIRA_ISSUE_SESSION_DRAG_SPRING = { damping: 26, mass: 0.6, stiffness: 420, restDelta: 0.01 } as const;

const JIRA_ISSUE_MOTION_ENTER: Transition = { duration: 0.15, ease: [0.4, 1, 0.6, 1] }; // duration-normal + ease-out-practical
const JIRA_ISSUE_MOTION_EXIT: Transition = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] }; // duration-fast + ease-in
const JIRA_ISSUE_MOTION_LAYOUT: Transition = { duration: 0.2, ease: [0.4, 0, 0, 1] }; // duration-medium + ease-in-out
const JIRA_ISSUE_MOTION_REDUCED: Transition = { duration: 0 };
const JIRA_ISSUE_MOTION_STYLE: CSSProperties = { willChange: "transform, opacity" };

function getJiraIssueLayoutTransition(shouldReduceMotion: boolean | null): Transition {
	return shouldReduceMotion ? JIRA_ISSUE_MOTION_REDUCED : JIRA_ISSUE_MOTION_LAYOUT;
}

function getJiraIssuePresenceMotion(shouldReduceMotion: boolean | null) {
	if (shouldReduceMotion) {
		return {
			animate: undefined,
			exit: undefined,
			initial: false,
		} as const;
	}

	return {
		animate: { opacity: 1, y: 0, transition: JIRA_ISSUE_MOTION_ENTER },
		exit: { opacity: 0, y: -4, transition: JIRA_ISSUE_MOTION_EXIT },
		initial: { opacity: 0, y: -4 },
	} as const;
}

function getJiraIssueAgentWorkingLabels(activity: JiraIssueAgentActivity | undefined): readonly string[] {
	if (!activity) {
		return [];
	}

	const trimmedLabel = activity.label.trim();
	const labels = trimmedLabel ? [trimmedLabel] : [];

	for (const workingLabel of activity.labels ?? []) {
		if (workingLabel !== trimmedLabel) {
			labels.push(workingLabel);
		}
	}

	return labels;
}

function toAssignedAgentStatusKind(
	state: JiraIssueAgentActivityState,
): AgentAssignmentStatusKind {
	switch (state) {
		case "working":
			return "working";
		case "awaiting-input":
			return "needs-input";
		case "completed":
			return "finished";
		default: {
			const exhaustiveState: never = state;
			return exhaustiveState;
		}
	}
}

export function toAgentAssignmentAgent(activity: JiraIssueAgentActivity): AgentAssignmentAgent {
	return {
		id: activity.id,
		name: activity.name,
		byline: "",
		...(activity.avatarSrc ? { avatarSrc: activity.avatarSrc } : {}),
		...(activity.agentBrandName ? { brandName: activity.agentBrandName } : {}),
		...(activity.agentVpkLogo ? { vpkLogo: activity.agentVpkLogo } : {}),
		status: activity.label,
		statusKind: toAssignedAgentStatusKind(activity.state),
		statusSequence: activity.state === "working" ? getJiraIssueAgentWorkingLabels(activity) : undefined,
		...(activity.cycleIntervalMs !== undefined ? { statusCycleIntervalMs: activity.cycleIntervalMs } : {}),
		...(activity.cycleIntervalJitterMs !== undefined ? { statusCycleJitterMs: activity.cycleIntervalJitterMs } : {}),
		statusLabel: activity.label,
		...(activity.invokedBy ? { invokedBy: activity.invokedBy } : {}),
		...(activity.host !== undefined ? { host: activity.host } : {}),
		...(activity.role !== undefined ? { role: activity.role } : {}),
		...(activity.timeLabel ? { timeLabel: activity.timeLabel } : {}),
	};
}

function canonicalizeJiraIssueAgentId(agentId: string): string {
	const separatorIndex = agentId.lastIndexOf(":");
	return separatorIndex === -1 ? agentId : agentId.slice(separatorIndex + 1);
}

function toSelectorAgent(activity: JiraIssueAgentActivity): AgentSelectorAgent {
	return {
		id: canonicalizeJiraIssueAgentId(activity.id),
		name: activity.name,
		byline: "",
		...(activity.avatarSrc ? { avatarSrc: activity.avatarSrc } : {}),
		...(activity.agentBrandName ? { brandName: activity.agentBrandName } : {}),
		...(activity.agentVpkLogo ? { vpkLogo: activity.agentVpkLogo } : {}),
	};
}

function getJiraIssueAgentCatalog(
	activities: readonly JiraIssueAgentActivity[],
): readonly AgentSelectorAgent[] {
	const extras = activities
		.filter((activity) => {
			const agentId = canonicalizeJiraIssueAgentId(activity.id);
			return !ROVO_AGENT_SELECTOR_AGENTS.some((agent) => (
				agent.id === activity.id || agent.id === agentId
			));
		})
		.map(toSelectorAgent);
	const seen = new Set<string>();
	const uniqueExtras = extras.filter((agent) => {
		if (seen.has(agent.id)) {
			return false;
		}
		seen.add(agent.id);
		return true;
	});
	return uniqueExtras.length > 0
		? [...ROVO_AGENT_SELECTOR_AGENTS, ...uniqueExtras]
		: ROVO_AGENT_SELECTOR_AGENTS;
}

function mergeJiraIssueAgentCatalog(
	activities: readonly JiraIssueAgentActivity[],
	providedAgents?: readonly AgentSelectorAgent[],
): readonly AgentSelectorAgent[] {
	const directory = getJiraIssueAgentCatalog(activities);
	if (!providedAgents?.length) {
		return directory;
	}

	const seen = new Set(directory.map((agent) => agent.id));
	const extras = providedAgents.filter((agent) => {
		if (seen.has(agent.id)) {
			return false;
		}
		seen.add(agent.id);
		return true;
	});
	return extras.length > 0 ? [...directory, ...extras] : directory;
}

function resolveJiraIssueAgentRowPresentation(
	activities: readonly JiraIssueAgentActivity[],
	linkFlash: JiraIssueAgentLinkFlash | undefined,
) {
	const summary = summarizeJiraIssueAgentActivities(activities);
	const isCompletedRow = activities.length > 0
		&& activities.every((activity) => activity.state === "completed");
	const isFailedRow = isCompletedRow
		&& activities.some((activity) => activity.label === "Failed");
	const isSingleAgent = summary.activityCount === 1;
	const isViewerRow = activities.length > 0 && activities.every((activity) => activity.role === "viewer");
	const rowLinkFlash = linkFlash
		&& activities.some((activity) => linkFlash.activityIds.includes(activity.id))
		? linkFlash
		: null;
	const isAwaitingInput = !isCompletedRow && summary.priorityState === "awaiting-input";
	const featuredActivity = summary.featuredActivityIndex !== null
		? activities[summary.featuredActivityIndex]
		: undefined;
	const rowLabel = isViewerRow
		? isSingleAgent
			? agentIdentityLabel(activities[0], activities[0].invokedBy)
			: "Agent sessions"
		: isCompletedRow
		? featuredActivity?.label ?? "Finished"
		: summary.label;
	const activityKey = activities.map((activity) => activity.id).join("\n");
	const startupSequenceKey = isSingleAgent && featuredActivity?.startupSequence === "jira-work-item-start"
		? activityKey
		: null;
	const rowAriaLabel = isViewerRow ? rowLabel : isSingleAgent
			? `${activities[0]?.name ?? "Agent"}: ${rowLabel}`
			: `${summary.activityCount} agents: ${rowLabel}`;

	return {
		featuredActivity,
		isAwaitingInput,
		isCompletedRow,
		isFailedRow,
		isViewerRow,
		rowAriaLabel,
		rowLabel,
		rowLinkFlash,
		startupSequenceKey,
	};
}

function resolveJiraIssueSessionDragPresentation(
	sessionDrag: JiraIssueAgentSessionDragBinding | undefined,
	drag: ReturnType<typeof usePointerDrag>,
	iconScale: JiraIssueIconScale,
) {
	const isDragging = Boolean(sessionDrag) && drag.dragging;
	const isDraggedOut = isDragging
		&& Math.hypot(drag.position.x, drag.position.y) >= JIRA_ISSUE_SESSION_DRAG_CHIP_DISTANCE_PX;
	const showUnlinkControl = iconScale !== "comfortable"
		&& Boolean(sessionDrag?.onUnlink)
		&& !isDraggedOut;

	return { isDraggedOut, isDragging, showUnlinkControl };
}

function createJiraIssueSessionDragBind({
	activities,
	chipPointer,
	drag,
	onSessionDragChange,
	pointerOriginRef,
	sessionDrag,
	setDragOffset,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	chipPointer: ReturnType<typeof useSessionDragChipPointer>;
	drag: ReturnType<typeof usePointerDrag>;
	onSessionDragChange?: (
		dragging: boolean,
		pointer: PointerDragPosition | null,
		cancelled: boolean,
	) => void;
	pointerOriginRef: RefObject<PointerDragPosition | null>;
	sessionDrag?: JiraIssueAgentSessionDragBinding;
	setDragOffset: Dispatch<SetStateAction<PointerDragPosition>>;
}>) {
	if (!sessionDrag) {
		return undefined;
	}

	function publishSessionDrag(
		dragging: boolean,
		event?: ReactPointerEvent<HTMLElement>,
		cancelled = false,
	) {
		onSessionDragChange?.(
			dragging,
			event ? { x: event.clientX, y: event.clientY } : null,
			cancelled,
		);
	}

	const { onKeyDown: _ignoredPointerDragKeyDown, ...dragBindWithoutKeyboard } = drag.bind;
	void _ignoredPointerDragKeyDown;

	return {
		...dragBindWithoutKeyboard,
		onClick: (event: ReactMouseEvent<HTMLElement> & { preventBaseUIHandler?: () => void }) => {
			if (!drag.bind.onClick()) {
				event.preventDefault();
				event.stopPropagation();
				event.preventBaseUIHandler?.();
			}
		},
		onFocus: () => sessionDrag.onFocusedActivitiesChange(activities),
		// The card `<article>` is `draggable`, so a plain pointerdown would hand
		// the gesture to native HTML5 drag. Cancelling the compatibility
		// mousedown suppresses `dragstart`; focus has to be restored by hand.
		onMouseDown: (event: ReactMouseEvent<HTMLElement>) => {
			event.preventDefault();
			event.currentTarget.focus();
		},
		onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
			drag.bind.onPointerCancel(event);
			pointerOriginRef.current = null;
			setDragOffset(JIRA_ISSUE_SESSION_DRAG_ORIGIN);
			publishSessionDrag(false, undefined, true);
		},
		onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
			drag.bind.onPointerDown(event);
			pointerOriginRef.current = { x: event.clientX, y: event.clientY };
			chipPointer.snapToPointer({ x: event.clientX, y: event.clientY });
		},
		onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
			drag.bind.onPointerMove(event);
			chipPointer.followPointer({ x: event.clientX, y: event.clientY });
			const origin = pointerOriginRef.current;
			const moved = Boolean(
				origin
				&& (
					Math.abs(event.clientX - origin.x) > JIRA_ISSUE_SESSION_DRAG_PUBLISH_THRESHOLD_PX
					|| Math.abs(event.clientY - origin.y) > JIRA_ISSUE_SESSION_DRAG_PUBLISH_THRESHOLD_PX
				),
			);
			if (moved) {
				publishSessionDrag(true, event);
			}
		},
		onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
			drag.bind.onPointerUp(event);
			pointerOriginRef.current = null;
			setDragOffset(JIRA_ISSUE_SESSION_DRAG_ORIGIN);
			publishSessionDrag(false, event);
		},
	};
}

function JiraIssueAgentDragWrapper({
	chipPointer,
	children,
	dragChip,
	dragX,
	dragY,
	isDraggedOut,
	isDragging,
	sessionDragEnabled,
}: Readonly<{
	chipPointer: ReturnType<typeof useSessionDragChipPointer>;
	children: ReactElement;
	dragChip: ReactElement;
	dragX: MotionValue<number>;
	dragY: MotionValue<number>;
	isDraggedOut: boolean;
	isDragging: boolean;
	sessionDragEnabled: boolean;
}>): ReactElement {
	if (!sessionDragEnabled) {
		return children;
	}

	return (
		<div
			className={cn(
				"min-w-0",
				isDragging && "relative w-full",
				isDragging && (isDraggedOut ? "h-0" : "h-8"),
			)}
			data-session-chip-out={isDraggedOut || undefined}
			data-slot="jira-issue-agent-row-wrap"
		>
			{/* The spring lives on the wrapper, not the row: `AgentAssignment`
			    clones the trigger and forwards no ref, so the row cannot carry
			    motion values of its own. While dragging it also has to outrank
			    the drop wells, which are later siblings and would otherwise
			    paint over the travelling chip. Once the chip is out the wrapper
			    hugs it so a full-width box is not left behind a small pill. */}
			<motion.div
				className={cn(
					"min-w-0",
					isDragging && "absolute inset-x-0 top-0",
					isDraggedOut && "pointer-events-none opacity-0",
				)}
				style={{ x: dragX, y: dragY }}
			>
				{children}
			</motion.div>
			{isDraggedOut && typeof document !== "undefined" ? createPortal(
				<motion.div
					aria-hidden
					className="pointer-events-none left-0 top-0 z-[300] w-fit"
					data-session-drag-overlay=""
					data-session-dragging=""
					style={{
						x: chipPointer.x,
						y: chipPointer.y,
						...sessionDragChipViewportStyle(true),
					}}
				>
					{dragChip}
				</motion.div>,
				document.body,
			) : null}
		</div>
	);
}

function JiraIssueAgentActivityRow({
	activities,
	assignment,
	avatarLayout,
	flushContent = false,
	iconScale = "compact",
	linkFlash,
	onOpenChange,
	onSessionDragChange,
	onViewChat,
	renderAgentActivityIndicator,
	sessionDrag,
	inheritChinSurface = false,
	showAssignmentFlyout = true,
	shouldReduceMotion,
	workingSpinnerVariant,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	assignment?: JiraIssueAgentAssignment;
	avatarLayout: JiraIssueAgentActivityAvatarLayout;
	flushContent?: boolean;
	iconScale?: JiraIssueIconScale;
	/** Rest shows the parent well; hover still paints only this row. */
	inheritChinSurface?: boolean;
	/** Set on the row a session has just been linked into; other rows ignore it. */
	linkFlash?: JiraIssueAgentLinkFlash;
	onOpenChange?: (open: boolean) => void;
	onSessionDragChange?: (
		dragging: boolean,
		pointer: PointerDragPosition | null,
		cancelled: boolean,
	) => void;
	onViewChat?: (activity: JiraIssueAgentActivity) => void;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	sessionDrag?: JiraIssueAgentSessionDragBinding;
	/** Hover assignment menu for every session lifecycle state. */
	showAssignmentFlyout?: boolean;
	shouldReduceMotion: boolean | null;
	workingSpinnerVariant?: "default" | "experimental";
}>) {
	// Any row that gained one of the linked sessions sweeps, including a merged
	// "N Working" row. Dropping onto a card that is already busy changes that
	// row — its count just went up — so skipping it would leave the one place
	// the link actually landed as the only place that never acknowledged it.
	const {
		featuredActivity,
		isAwaitingInput,
		isCompletedRow,
		isFailedRow,
		isViewerRow,
		rowAriaLabel,
		rowLabel,
		rowLinkFlash,
		startupSequenceKey,
	} = resolveJiraIssueAgentRowPresentation(activities, linkFlash);
	const startupPhase = useJiraIssueAgentStartupPhase(
		startupSequenceKey,
		shouldReduceMotion,
		featuredActivity?.startedAtMs,
	);
	const catalogAgents = useMemo(
		() => mergeJiraIssueAgentCatalog(activities, assignment?.agents),
		[activities, assignment?.agents],
	);
	const assignedAgents = assignment?.assignedAgents ?? activities.map(toAgentAssignmentAgent);

	const [dragOffset, setDragOffset] = useState<PointerDragPosition>(JIRA_ISSUE_SESSION_DRAG_ORIGIN);
	const drag = usePointerDrag(dragOffset, setDragOffset, sessionDrag?.bounds);
	// The pointer offset feeds motion values, and the springs are what the tag
	// actually renders — so it trails the cursor instead of pinning to it.
	// Reduced motion reads the raw values, giving an exact 1:1 follow.
	const dragOffsetX = useMotionValue(0);
	const dragOffsetY = useMotionValue(0);
	const springX = useSpring(dragOffsetX, JIRA_ISSUE_SESSION_DRAG_SPRING);
	const springY = useSpring(dragOffsetY, JIRA_ISSUE_SESSION_DRAG_SPRING);
	const dragX = shouldReduceMotion ? dragOffsetX : springX;
	const dragY = shouldReduceMotion ? dragOffsetY : springY;
	const chipPointer = useSessionDragChipPointer(shouldReduceMotion);
	const {
		isDraggedOut,
		isDragging,
		showUnlinkControl,
	} = resolveJiraIssueSessionDragPresentation(sessionDrag, drag, iconScale);
	const pointerOriginRef = useRef<PointerDragPosition | null>(null);

	useEffect(() => {
		dragOffsetX.set(drag.position.x);
		dragOffsetY.set(drag.position.y);
	}, [dragOffsetX, dragOffsetY, drag.position.x, drag.position.y]);

	// `onKeyDown` is deliberately dropped from the spread: the shared pointer-drag
	// hook nudges position with arrow keys, but only the pointer handlers publish
	// transfer state, so keyboard movement would displace a focused row with no
	// way to arm, drop, or reset it. Keyboard users unlink from the chin link-broken;
	// the well is a drop target only.
	const sessionDragBind = createJiraIssueSessionDragBind({
		activities,
		chipPointer,
		drag,
		onSessionDragChange,
		pointerOriginRef,
		sessionDrag,
		setDragOffset,
	});
	const dragChip = (
		<div
			className="pointer-events-none -translate-x-1/2 -translate-y-1/2"
			data-session-chip-centered=""
		>
			{/* `isFusionSource` marks the pill itself, not this centring wrapper:
			    the fusion overlay measures that node every frame to place the goo
			    pill, so the measured box has to be the drawn chip. The chip portal
			    unmounts with the drop, so the overlay caches the last measured rect
			    for the fuse rather than fading this copy out. */}
			<AgentSessionDragPill
				agent={{
					avatarSrc: featuredActivity?.avatarSrc,
					brandName: featuredActivity?.agentBrandName,
					vpkLogo: featuredActivity?.agentVpkLogo,
					name: featuredActivity?.name ?? "Agent",
				}}
				attributedBy={featuredActivity?.invokedBy}
				elevated
				isFusionSource
			/>
		</div>
	);

	const statusIcon = (
		<JiraIssueAgentStatusAffordance
			interactive={showAssignmentFlyout}
			statusIcon={isViewerRow ? undefined : (
				<JiraIssueAgentStatusIcon
					iconScale={iconScale}
					isAwaitingInput={isAwaitingInput}
					isCompletedRow={isCompletedRow}
					isFailedRow={isFailedRow}
					renderAgentActivityIndicator={renderAgentActivityIndicator}
					startupPhase={startupPhase}
					workingSpinnerVariant={workingSpinnerVariant}
				/>
			)}
		/>
	);
	const rowHandle = (
		<button
			type="button"
			aria-label={rowAriaLabel}
			{...(sessionDragBind ?? {})}
			{...(sessionDragBind
				? {
					"aria-roledescription": "Draggable agent session",
					"data-session-dragging": drag.dragging || undefined,
					draggable: false,
				}
				: {})}
			className={cn(
				"flex min-w-0 items-center gap-2 text-left outline-none transition-[background-color,box-shadow] duration-fast ease-out focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
				cn("h-full min-w-0 flex-1", showUnlinkControl ? "justify-start" : "justify-between"),
				sessionDragBind && "touch-none select-none",
			)}
		>
			<JiraIssueAgentRowContent
				activities={activities}
				avatarLayout={avatarLayout}
				featuredActivity={isViewerRow && activities.length > 1 ? undefined : featuredActivity}
				isAwaitingInput={!isViewerRow && isAwaitingInput}
				isWorking={!isViewerRow && !isCompletedRow && !isAwaitingInput}
				rowLabel={rowLabel}
				showUnlinkControl={showUnlinkControl}
				startupPhase={isViewerRow ? "working" : startupPhase}
				statusIcon={statusIcon}
				isViewerRow={isViewerRow}
			/>
		</button>
	);
	const assignedRowHandle = (
		<JiraIssueAgentAssignmentHandle
			activities={activities}
			agents={catalogAgents}
			assignedAgents={assignedAgents}
			assignment={assignment}
			onOpenChange={onOpenChange}
			onViewChat={onViewChat}
			rowHandle={rowHandle}
			showAssignmentFlyout={showAssignmentFlyout}
		/>
	);

	return (
		<JiraIssueAgentDragWrapper
			chipPointer={chipPointer}
			dragChip={dragChip}
			dragX={dragX}
			dragY={dragY}
			isDraggedOut={isDraggedOut}
			isDragging={isDragging}
			sessionDragEnabled={Boolean(sessionDrag)}
		>
			<JiraIssueAgentRowSurface
				activities={activities}
				assignedRowHandle={assignedRowHandle}
				featuredActivity={featuredActivity}
				flushContent={flushContent}
				iconScale={iconScale}
				inheritChinSurface={inheritChinSurface}
				isDraggedOut={isDraggedOut}
				rowLinkFlash={rowLinkFlash}
				sessionDrag={sessionDrag}
				showUnlinkControl={showUnlinkControl}
				startupPhase={startupPhase}
				startupSequenceKey={startupSequenceKey}
				statusIcon={statusIcon}
			/>
		</JiraIssueAgentDragWrapper>
	);
}

export function JiraIssueAgentActivityRows({
	activities,
	assignment,
	attachPreviewCopy,
	avatarLayout = "animated",
	flushContent = false,
	iconScale = "compact",
	instantSessionTransfer = false,
	linkFlash,
	layout = "merged",
	onOpenChange,
	onViewChat,
	renderAgentActivityIndicator,
	sessionDrag,
	inheritChinSurface = false,
	showAssignmentFlyout = true,
	shouldReduceMotion,
	workingSpinnerVariant,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	/** Full assignment menu (Assign agent footer) when the host supplies edit capability. */
	assignment?: JiraIssueAgentAssignment;
	/** Occupies the last chin row while a session is approaching, or opens a chin when none exist. */
	attachPreviewCopy?: string;
	/** Multiple-agent identity treatment. */
	avatarLayout?: JiraIssueAgentActivityAvatarLayout;
	/** Remove the horizontal gutters when a parent cell owns its left alignment. */
	flushContent?: boolean;
	iconScale?: JiraIssueIconScale;
	/** Rest shows the parent well; hover still paints only this row. */
	inheritChinSurface?: boolean;
	/** Board-controlled moves remount the presence boundary so one row cannot linger in two cards. */
	instantSessionTransfer?: boolean;
	/** One-shot brand sweep across the row a session was just linked into. */
	linkFlash?: JiraIssueAgentLinkFlash;
	/** `split` gives every active agent its own chin row instead of one merged row. */
	layout?: JiraIssueAgentActivityLayout;
	onOpenChange?: (open: boolean) => void;
	onViewChat?: (activity: JiraIssueAgentActivity) => void;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	/** Opt-in: makes every chin row a draggable session handle. */
	sessionDrag?: JiraIssueAgentSessionDragBinding;
	/** Hover assignment menu for every session lifecycle state. */
	showAssignmentFlyout?: boolean;
	shouldReduceMotion: boolean | null;
	usesStrokeChrome: boolean;
	/** Selects only the Working spinner; iconScale still owns row spacing. */
	workingSpinnerVariant?: "default" | "experimental";
}>) {
	const [sessionDragging, setSessionDragging] = useState(false);
	const [assignmentHoverOpen, setAssignmentHoverOpen] = useState(false);
	const layoutTransition = getJiraIssueLayoutTransition(shouldReduceMotion);
	const presenceMotion = getJiraIssuePresenceMotion(shouldReduceMotion);
	const hasActivities = activities.length > 0;
	const hasAttachPreview = Boolean(attachPreviewCopy);
	const rowGroups = groupJiraIssueAgentActivityRows(activities, layout);
	const rowPresenceKey = instantSessionTransfer
		? rowGroups.map((rowGroup) => rowGroup.key).join("|")
		: "animated";
	// A pointer drag re-renders the row on every move. Hovering the assignment
	// flyout also remounts trigger attrs. Freezing `layout` keeps Motion from
	// re-measuring the LayoutGroup and fighting the reserved h-8 chin.
	const rowLayout = shouldReduceMotion || sessionDragging || assignmentHoverOpen
		? false
		: "position";

	return (
		<motion.div
			className={cn(
				"flex w-full min-w-0 flex-col",
				// The travelling chip paints outside the row box, so the clip has to
				// lift for the duration of a transfer drag.
				sessionDragging ? "overflow-visible" : "overflow-hidden has-[:focus-visible]:overflow-visible",
				// Once the only content is a chip that has left the card, the gutter
				// is the last thing holding the grey backdrop open — close it too so
				// the card hugs what remains instead of trailing an empty band. The
				// dragged row flags itself with `data-session-chip-out`, so this
				// resolves in the same commit rather than through a state round-trip.
				(hasActivities || hasAttachPreview) && cn(
					flushContent ? "px-0" : "px-1",
					"py-1 has-[[data-session-chip-out]]:py-0",
				),
			)}
			layout={rowLayout}
			data-session-attach-growth={!hasActivities && hasAttachPreview ? "" : undefined}
			transition={layoutTransition}
		>
			<AnimatePresence key={rowPresenceKey} initial={false} mode="popLayout">
				{rowGroups.map((rowGroup, index) => {
					// A grouped chin is many agents, not one session. Drag uses
					// the single-row gate: transferring `activities[0]`
					// would silently move one agent while the row still says "N".
					const replaceLastRowWithAttach = hasAttachPreview && index === rowGroups.length - 1;
					const isSingleAgentRow = rowGroup.activities.length === 1;
					const rowSessionDrag = replaceLastRowWithAttach ? undefined : isSingleAgentRow ? sessionDrag : undefined;
					const row = replaceLastRowWithAttach && attachPreviewCopy ? (
						<JiraIssueAttachChinSlot copy={attachPreviewCopy} />
					) : (
						<JiraIssueAgentActivityRow
							activities={rowGroup.activities}
							assignment={assignment}
							avatarLayout={avatarLayout}
							flushContent={flushContent}
							iconScale={iconScale}
							workingSpinnerVariant={workingSpinnerVariant}
							inheritChinSurface={inheritChinSurface}
							linkFlash={linkFlash}
							onOpenChange={(open) => {
								setAssignmentHoverOpen(open);
								onOpenChange?.(open);
							}}
							onSessionDragChange={(dragging, pointer, cancelled) => {
								setSessionDragging(dragging);
								const activity = rowGroup.activities[0];
								if (dragging && pointer && activity) {
									rowSessionDrag?.onDragStateChange({
										activities: rowGroup.activities,
										cancelled: false,
										dragging: true,
										pointer,
										source: "chin",
										transfer: {
											key: activity.id,
											members: [{
												avatarSrc: activity.avatarSrc,
												id: activity.id,
												invoker: activity.invokedBy,
												name: activity.name,
												tintSeed: sessionTransferTintSeed(
													activity.agentBrandName,
													activity.agentVpkLogo,
													activity.name,
												),
											}],
										},
									});
									return;
								}
								rowSessionDrag?.onDragStateChange({
									activities: rowGroup.activities,
									cancelled,
									dragging: false,
									pointer,
									source: "chin",
								});
							}}
							onViewChat={onViewChat}
							renderAgentActivityIndicator={renderAgentActivityIndicator}
							sessionDrag={rowSessionDrag}
							showAssignmentFlyout={showAssignmentFlyout}
							shouldReduceMotion={shouldReduceMotion}
						/>
					);

					return (
						<motion.div
							key={rowGroup.key}
							animate={presenceMotion.animate}
							className="min-w-0"
							data-slot={replaceLastRowWithAttach ? "jira-issue-attach-chin" : undefined}
							exit={presenceMotion.exit}
							initial={presenceMotion.initial}
							layout={rowLayout}
							style={shouldReduceMotion ? undefined : JIRA_ISSUE_MOTION_STYLE}
							transition={layoutTransition}
						>
							{row}
						</motion.div>
					);
				})}
			</AnimatePresence>
			{rowGroups.length === 0 && attachPreviewCopy ? (
				<div data-slot="jira-issue-attach-chin">
					<JiraIssueAttachChinSlot copy={attachPreviewCopy} />
				</div>
			) : null}
		</motion.div>
	);
}
