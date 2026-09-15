"use client";

import { useCallback, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

import {
	AGENT_SESSION_ITEMS,
	AgentSession,
	toJiraIssueAgentActivityFromSession,
	type AgentSessionItem,
	type AgentSessionSelectionGesture,
	type AgentSessionTriageRow,
} from "@/components/blocks/agent-session";
import { selectDragCohort } from "@/components/blocks/agent-session/session-cohort";
import {
	NO_SELECTION_MARKS,
	reduceSelectionMarks,
	resolveVisibleLeadId,
} from "@/components/blocks/agent-session-column/untracked-selection";
import {
	JiraIssue,
	type JiraIssueAgentLinkFlash,
	type JiraIssueAgentSessionDragControl,
} from "@/components/blocks/jira-issue";
import {
	AGENT_BRAND_TINT_FALLBACK,
	resolveAgentBrandTint,
	resolveAgentBrandTintColor,
	resolveAgentBrandTintVariable,
} from "@/components/blocks/agent-session/agent-brand-tint";
import {
	JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
	sessionTransferTintSeed,
	type JiraIssueAgentSessionDragState,
	type JiraIssueAgentSessionTransferMember,
} from "@/components/blocks/jira-issue/agent-session-drag";
import type { PointerDragPosition } from "@/components/ui-custom/hooks/use-pointer-drag";
import { Button } from "@/components/ui/button";
import {
	JiraLinking,
	resolveJiraLinkingNearness,
	type JiraLinkingDropMember,
	type JiraLinkingIdentity,
	type JiraLinkingRelease,
	type JiraLinkingTarget,
	type JiraLinkingVariant,
} from "@/components/blocks/jira-linking";

/**
 * The travelling drag pill `AgentSessionMediumDrag` portals to the body.
 *
 * The same selector `jira-golden-journeys-v4` measures. Only one drag can be in
 * flight at a time, so a document-wide selector is correct here even with
 * several stages on the page — the chip exists only while a gesture is running.
 */
const CHIP_SELECTOR = "[data-session-drag-overlay] [data-session-fusion-chip]";

/**
 * The card's own agent shell — the grey backdrop the session is absorbed into.
 * v4 targets this exact node, so the demo measures it the same way instead of
 * approximating with the wrapper's rect.
 */
const SHELL_SELECTOR = '[data-slot="jira-issue-agent-shell"]';
const SURFACE_SELECTOR = '[data-slot="jira-issue-surface"]';
const CHIN_SLOT_SELECTOR = '[data-slot="jira-issue-attach-chin-slot"]';
const CHIN_SELECTOR = '[data-slot="jira-issue-attach-chin"]';
const ROW_SELECTOR = '[data-slot="jira-issue-agent-row"]';

/** Matches `AGENT_ACTIVITY_SHELL_STYLE.borderRadius` on the real card. */
const SHELL_RADIUS_PX = 10;
/** Matches `radius.large` on the issue's main card surface. */
const SURFACE_RADIUS_PX = 8;
/** Matches `rounded-md` on the activity row and attach-chin slot. */
const ROW_RADIUS_PX = 6;
const CHIN_HEIGHT_PX = 24;

interface Rect {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

interface Approach {
	cardId: JiraLinkingCardId | null;
	inside: boolean;
	nearness: number;
	/** The whole shell — what the field grows into during the approach. */
	target: JiraLinkingTarget | null;
}

const IDLE_APPROACH: Approach = {
	cardId: null,
	inside: false,
	nearness: 0,
	target: null,
};

function distanceToRect(point: PointerDragPosition, rect: Rect): number {
	const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
	const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
	return Math.hypot(dx, dy);
}

function toRect(node: Element | null | undefined): Rect | null {
	if (!node) {
		return null;
	}
	const { bottom, height, left, right, top, width } = node.getBoundingClientRect();
	if (width <= 0 || height <= 0) {
		return null;
	}
	return { bottom, left, right, top };
}

function toTarget(shell: Rect, radius = SHELL_RADIUS_PX): JiraLinkingTarget {
	return {
		anchor: { x: (shell.left + shell.right) / 2, y: (shell.top + shell.bottom) / 2 },
		height: shell.bottom - shell.top,
		radius,
		width: shell.right - shell.left,
	}
}

function lastMatchingRect(root: Element | null, selector: string): Rect | null {
	if (!root) {
		return null;
	}
	const nodes = root.querySelectorAll(selector);
	return toRect(nodes[nodes.length - 1]);
}

/**
 * The agent session area at the bottom of the card — attach chin while it is
 * open, otherwise the last activity row, otherwise a chin-height strip of the
 * shell. Flights land here rather than in the card's centre.
 */
function toLandTarget(root: Element | null, shell: Rect): JiraLinkingTarget {
	const land = toRect(root?.querySelector(CHIN_SLOT_SELECTOR))
		?? toRect(root?.querySelector(CHIN_SELECTOR))
		?? lastMatchingRect(root, ROW_SELECTOR)
		?? {
			bottom: shell.bottom,
			left: shell.left,
			right: shell.right,
			top: shell.bottom - Math.min(CHIN_HEIGHT_PX, shell.bottom - shell.top),
		};
	return {
		anchor: { x: (land.left + land.right) / 2, y: (land.top + land.bottom) / 2 },
		height: land.bottom - land.top,
		radius: ROW_RADIUS_PX,
		width: land.right - land.left,
	};
}

function toIdentities(
	sessions: readonly AgentSessionItem[],
): readonly JiraLinkingIdentity[] {
	return sessions.map((session) => {
		const tintSeed = sessionTransferTintSeed(
			session.agent.brandName,
			session.agent.vpkLogo,
			session.agent.name,
		);
		const tintVariable = resolveAgentBrandTintVariable(tintSeed);
		return {
			id: session.id,
			imageSrc: session.agent.avatarSrc,
			tint: tintVariable ? undefined : resolveAgentBrandTint(tintSeed),
			tintSeed,
			tintVariable,
		};
	});
}

function toDropMembers(
	sessions: readonly AgentSessionItem[],
): readonly [JiraLinkingDropMember, ...JiraLinkingDropMember[]] | null {
	const members = sessions.map((session): JiraLinkingDropMember => ({
		avatarSrc: session.agent.avatarSrc,
		brandName: session.agent.brandName,
		id: session.id,
		invoker: session.invokedBy,
		name: session.agent.name,
		vpkLogo: session.agent.vpkLogo,
	}));
	const [first, ...rest] = members;
	return first ? [first, ...rest] : null;
}

function resolveDraggedSessions(
	items: readonly AgentSessionItem[],
	members: readonly JiraIssueAgentSessionTransferMember[],
): readonly AgentSessionItem[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	return members.flatMap((member) => {
		const item = byId.get(member.id);
		return item ? [item] : [];
	});
}

function mergeLinkedSessions(
	current: readonly AgentSessionItem[],
	incoming: readonly AgentSessionItem[],
): readonly AgentSessionItem[] {
	const seen = new Set(current.map((session) => session.id));
	return [
		...current,
		...incoming.filter((session) => {
			if (seen.has(session.id)) {
				return false;
			}
			seen.add(session.id);
			return true;
		}),
	];
}

type JiraLinkingCardId = "active" | "empty";

interface PendingDrop {
	cardId: JiraLinkingCardId;
	sessions: readonly AgentSessionItem[];
}

interface ReleaseState {
	cardId: JiraLinkingCardId;
	release: JiraLinkingRelease;
}

type SessionsByCard = Readonly<Record<JiraLinkingCardId, readonly AgentSessionItem[]>>;
type FlashesByCard = Readonly<Record<JiraLinkingCardId, JiraIssueAgentLinkFlash | null>>;

const EXISTING_RUNNING_SESSION: AgentSessionItem = {
	...AGENT_SESSION_ITEMS[1],
	id: "jira-linking-existing-running-session",
};

const JIRA_LINKING_CARD_FIXTURES = [
	{
		caption: "Agent session already running",
		id: "active",
		issueKey: "PAY-117",
		summary: "Review checkout telemetry before the wallet launch",
		tags: [{ color: "blue", text: "active session" }],
	},
	{
		caption: "No agent session yet",
		id: "empty",
		issueKey: "PAY-118",
		summary: "Carry card-artwork metadata into the next wallet epic",
		tags: [{ color: "purple", text: "wallet" }],
	},
] as const satisfies readonly {
	caption: string;
	id: JiraLinkingCardId;
	issueKey: string;
	summary: string;
	tags: readonly [{ color: "blue" | "purple"; text: string }];
}[];

function createInitialSessionsByCard(): SessionsByCard {
	return {
		active: [EXISTING_RUNNING_SESSION],
		empty: [],
	};
}

function createEmptyFlashesByCard(): FlashesByCard {
	return { active: null, empty: null };
}

function toWorkingActivities(sessions: readonly AgentSessionItem[]) {
	return sessions.map((session) => ({
		...toJiraIssueAgentActivityFromSession(session),
		state: "working" as const,
	}));
}

function ExampleStage({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
	return (
		<section
			aria-label={label}
			className="relative flex min-h-[400px] w-full flex-1 items-center justify-center self-stretch rounded-lg bg-bg-neutral-subtle p-0 sm:p-6"
		>
			{children}
		</section>
	);
}

function useDemoSessionMarks(items: readonly AgentSessionItem[]) {
	const [marks, dispatch] = useReducer(reduceSelectionMarks, NO_SELECTION_MARKS);
	const orderedIds = useMemo(() => items.map((item) => item.id), [items]);
	const leadId = resolveVisibleLeadId(orderedIds, marks.leadId);

	const rows = useMemo(() => {
		const next = new Map<string, AgentSessionTriageRow>();
		for (const item of items) {
			next.set(item.id, {
				approve: null,
				drag: {
					cohort: () => selectDragCohort(item.id, marks, items),
				},
				mark: {
					isLead: item.id === leadId,
					isMarked: marks.markedIds.has(item.id),
					onActivate: (gesture: AgentSessionSelectionGesture) => {
						dispatch({
							gesture,
							id: item.id,
							orderedIds,
							type: "activate",
						});
					},
				},
			});
		}
		return next;
	}, [items, leadId, marks, orderedIds]);

	const clear = useCallback(() => {
		dispatch({ type: "clear" });
	}, []);

	return { clear, rows };
}

interface JiraLinkingStageProps {
	label: string;
	sessions: readonly AgentSessionItem[];
	variant: JiraLinkingVariant;
}

/**
 * Real untracked-work sessions dragged onto a real experimental Jira issue.
 *
 * Same wiring as `jira-golden-journeys-v4`: `AgentSessionMediumDrag` leaves the
 * cards in place and travels an at-mention chip (a cohort pill when several
 * are marked), and the card supplies its grey shell, attach chin and chin
 * row. Drag one session, or Command-click to mark several and drag them
 * together — the same one-or-many gesture as the create well.
 */
function JiraLinkingStage({ label, sessions, variant }: Readonly<JiraLinkingStageProps>) {
	const shouldReduceMotion = useReducedMotion();
	const [approach, setApproach] = useState<Approach>(IDLE_APPROACH);
	const [linkFlashes, setLinkFlashes] = useState<FlashesByCard>(createEmptyFlashesByCard);
	const [sessionsByCard, setSessionsByCard] = useState<SessionsByCard>(createInitialSessionsByCard);
	const [identities, setIdentities] = useState<readonly JiraLinkingIdentity[] | null>(null);
	const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(() => new Set());
	const [releaseState, setReleaseState] = useState<ReleaseState | null>(null);
	const activeIssueRef = useRef<HTMLDivElement>(null);
	const emptyIssueRef = useRef<HTMLDivElement>(null);
	const approachRef = useRef<Approach>(IDLE_APPROACH);
	const pointerRef = useRef<PointerDragPosition | null>(null);
	const draggedSessionsRef = useRef<readonly AgentSessionItem[]>([]);
	const pendingDropRef = useRef<PendingDrop | null>(null);
	const flashTokenRef = useRef(0);
	const releaseIdRef = useRef(0);
	const availableSessions = useMemo(
		() => sessions.filter((session) => (
			!Object.values(sessionsByCard).some((linked) => (
				linked.some((candidate) => candidate.id === session.id)
			))
		)),
		[sessions, sessionsByCard],
	);
	const marks = useDemoSessionMarks(availableSessions);
	const { clear: clearMarks, rows: rowTriage } = marks;
	const activitiesByCard = useMemo(() => ({
		active: toWorkingActivities(sessionsByCard.active),
		empty: toWorkingActivities(sessionsByCard.empty),
	}), [sessionsByCard]);

	const commitLink = useCallback(() => {
		const pending = pendingDropRef.current;
		pendingDropRef.current = null;
		if (!pending) {
			setReleaseState(null);
			return;
		}
		const dropped = pending.sessions;
		const lead = dropped[0];
		setSessionsByCard((current) => ({
			...current,
			[pending.cardId]: mergeLinkedSessions(current[pending.cardId], dropped),
		}));
		if (lead && variant === "fuse") {
			flashTokenRef.current += 1;
			const leadTintSeed = sessionTransferTintSeed(
				lead.agent.brandName,
				lead.agent.vpkLogo,
				lead.agent.name,
			);
			setLinkFlashes((current) => ({
				...current,
				[pending.cardId]: {
					activityIds: dropped.map((session) => session.id),
					tint: resolveAgentBrandTintColor(leadTintSeed)
						?? AGENT_BRAND_TINT_FALLBACK,
					token: flashTokenRef.current,
				},
			}));
		}
		setDraggingIds(new Set());
		setIdentities(null);
		setReleaseState(null);
		clearMarks();
	}, [clearMarks, variant]);

	/**
	 * Re-measured on every pointer move, exactly as the board's `collectDropZones`
	 * does: the shell grows when its attach chin opens, so a rect snapshotted at
	 * drag start would leave the goo aiming at stale geometry.
	 */
	const handleDragStateChange = useCallback((state: JiraIssueAgentSessionDragState) => {
		if (state.dragging) {
			pointerRef.current = state.pointer;
			const dragged = resolveDraggedSessions(availableSessions, state.transfer.members);
			draggedSessionsRef.current = dragged;
			setIdentities((current) => current ?? toIdentities(dragged));
			setDraggingIds((current) => (
				current.size === 0
					? new Set(dragged.map((session) => session.id))
					: current
			));
			const candidates = ([
				["active", activeIssueRef.current],
				["empty", emptyIssueRef.current],
			] as const).flatMap(([cardId, root]) => {
				const shell = toRect(root?.querySelector(SHELL_SELECTOR));
				return shell ? [{ cardId, distance: distanceToRect(state.pointer, shell), shell }] : [];
			});
			const nearest = candidates.reduce<(typeof candidates)[number] | null>(
				(current, candidate) => !current || candidate.distance < current.distance ? candidate : current,
				null,
			);
			const next = nearest ? {
				cardId: nearest.cardId,
				inside: nearest.distance === 0,
				nearness: resolveJiraLinkingNearness(nearest.distance),
				target: toTarget(nearest.shell),
			} : IDLE_APPROACH;
			approachRef.current = next;
			setApproach(next);
			return;
		}

		const settled = approachRef.current;
		const dragged = draggedSessionsRef.current;
		const dropMembers = toDropMembers(dragged);
		if (!state.cancelled && settled.cardId && settled.inside && settled.target && dropMembers) {
			pendingDropRef.current = { cardId: settled.cardId, sessions: dragged };
			if (shouldReduceMotion) {
				commitLink();
			} else {
				const from = pointerRef.current ?? {
					x: settled.target.anchor.x,
					y: settled.target.anchor.y,
				};
				const issueRoot = settled.cardId === "active" ? activeIssueRef.current : emptyIssueRef.current;
				const shell = toRect(issueRoot?.querySelector(SHELL_SELECTOR));
				const surface = toRect(issueRoot?.querySelector(SURFACE_SELECTOR));
				releaseIdRef.current += 1;
				setReleaseState({
					cardId: settled.cardId,
					release: {
						drop: {
							from,
							members: dropMembers,
							playback: "stagger",
						},
						fromTarget: settled.target,
						id: releaseIdRef.current,
						target: variant === "glow" && surface
							? toTarget(surface, SURFACE_RADIUS_PX)
							: toLandTarget(issueRoot, shell ?? {
								bottom: settled.target.anchor.y + settled.target.height / 2,
								left: settled.target.anchor.x - settled.target.width / 2,
								right: settled.target.anchor.x + settled.target.width / 2,
								top: settled.target.anchor.y - settled.target.height / 2,
							}),
					},
				});
			}
		} else {
			pendingDropRef.current = null;
			setDraggingIds(new Set());
			setIdentities(null);
		}
		draggedSessionsRef.current = [];
		pointerRef.current = null;
		approachRef.current = IDLE_APPROACH;
		setApproach(IDLE_APPROACH);
	}, [availableSessions, commitLink, shouldReduceMotion, variant]);

	/**
	 * Put the stage back to its pre-drag state so the link can be tried again.
	 *
	 * `flashTokenRef` deliberately keeps counting: the token has to be monotonic
	 * or re-linking the same session reuses the previous one and the sweep never
	 * re-keys, so it silently does not replay.
	 */
	function handleReset() {
		approachRef.current = IDLE_APPROACH;
		pointerRef.current = null;
		draggedSessionsRef.current = [];
		pendingDropRef.current = null;
		setApproach(IDLE_APPROACH);
		setDraggingIds(new Set());
		setIdentities(null);
		setLinkFlashes(createEmptyFlashesByCard());
		setSessionsByCard(createInitialSessionsByCard());
		setReleaseState(null);
		clearMarks();
	}

	/**
	 * The same control the board hands each card: a continuous `attachNearness`
	 * for the backdrop ramp, and `dropTarget` only once the pointer is actually
	 * inside the rect. The binding is inert because the drag is published by the
	 * session cards, not by the issue.
	 */
	const receiving = releaseState !== null;
	const addedCount = sessionsByCard.active.length + sessionsByCard.empty.length - 1;
	const hasAdded = addedCount > 0;
	const dragCount = identities?.length ?? draggingIds.size;
	function agentSessionDragControl(cardId: JiraLinkingCardId): JiraIssueAgentSessionDragControl {
		const isApproaching = approach.cardId === cardId;
		const isReceiving = releaseState?.cardId === cardId;
		return {
			attachNearness: isReceiving ? 1 : isApproaching ? approach.nearness : 0,
			binding: {
				onDragStateChange: () => {},
				onFocusedActivitiesChange: () => {},
			},
			dragCount,
			dropTarget: isReceiving || isApproaching && approach.inside ? "attach" : null,
			sourceActive: false,
			state: JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
		};
	}

	return (
		<ExampleStage label={label}>
			<div className="relative grid w-full max-w-[920px] grid-cols-1 items-start gap-5 pb-12 md:grid-cols-[280px_minmax(0,1fr)]">
				{availableSessions.length > 0 ? (
					<AgentSession
						className="w-full max-w-[280px] gap-1 p-1"
						draggingIds={draggingIds}
						items={availableSessions}
						rowTriage={rowTriage}
						sessionDrag={{
							onDragStateChange: handleDragStateChange,
							onFocusedActivitiesChange: () => {},
						}}
					/>
				) : (
					<div className="w-full max-w-[280px]" />
				)}

				<div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
					{JIRA_LINKING_CARD_FIXTURES.map((card) => {
						const linkedSessions = sessionsByCard[card.id];
						const linkedActivities = activitiesByCard[card.id];
						return (
							<div key={card.id} className="min-w-0" data-jira-linking-card-state={card.id}>
								<p className="mb-2 text-xs font-medium text-text-subtle">{card.caption}</p>
								<div ref={card.id === "active" ? activeIssueRef : emptyIssueRef}>
									<JiraIssue
										agentActivities={linkedActivities.length > 0 ? linkedActivities : undefined}
										agentActivityLayout="merged"
										agentLinkFlash={linkFlashes[card.id] ?? undefined}
										agentActivityMode={linkedSessions.length > 0 ? "working" : undefined}
										agentSessionDragControl={agentSessionDragControl(card.id)}
										chrome="stroke"
										issueKey={card.issueKey}
										summary={card.summary}
										tags={[...card.tags]}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<JiraLinking
				identities={identities}
				nearness={receiving ? 0 : approach.nearness}
				onFuseSettled={commitLink}
				release={releaseState?.release ?? null}
				sourceSelector={CHIP_SELECTOR}
				target={approach.target}
				variant={variant}
			/>

			<div className="absolute bottom-6 flex items-center gap-3">
				<p className="text-xs text-text-subtle">
					{hasAdded
						? `${addedCount} ${addedCount === 1 ? "session" : "sessions"} linked — reset to compare again`
						: "Drag into either card to compare adding to a running session or starting the first session"}
				</p>
				{hasAdded ? (
					<Button onClick={handleReset} size="compact" variant="outline">
						Reset
					</Button>
				) : null}
			</div>
		</ExampleStage>
	);
}

const FUSE_SESSIONS = AGENT_SESSION_ITEMS;
/**
 * Distinct ids from the lead stage on purpose. The docs page mounts every
 * example at once, and two stages sharing one session id put two drag sources
 * behind the same identity.
 */
const GLOW_SESSIONS = AGENT_SESSION_ITEMS.map((item) => ({
	...item,
	id: `${item.id}-glow`,
}));

export function JiraLinkingFuseExample() {
	return <JiraLinkingStage label="Fuse" sessions={FUSE_SESSIONS} variant="fuse" />;
}

export function JiraLinkingGlowExample() {
	return <JiraLinkingStage label="Glow" sessions={GLOW_SESSIONS} variant="glow" />;
}

export default function JiraLinkingDemo() {
	return <JiraLinkingFuseExample />;
}
