"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import {
	AGENT_BRAND_TINT_FALLBACK,
	resolveAgentBrandTintColor,
} from "@/components/blocks/agent-session/agent-brand-tint";
import { toSessionTransferMember } from "@/components/blocks/agent-session/agent-session-transfer-member";
import { createSessionCohort } from "@/components/blocks/agent-session/session-cohort";
import type {
	JiraIssueAgentSessionDragControl,
	JiraIssueAgentSessionDragState,
} from "@/components/blocks/jira-issue";
import {
	JIRA_ISSUE_LINK_FLASH_DURATION_MS,
} from "@/components/blocks/jira-issue/agent-link-flash";
import {
	toJiraIssueAttachTracePointer,
	type JiraIssueAttachTrace,
} from "@/components/blocks/jira-issue/attach-proximity";
import {
	JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
	type JiraIssueAgentSessionDragBinding,
	type JiraIssueAgentSessionTransferMember,
} from "@/components/blocks/jira-issue/agent-session-drag";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import type { SessionDropReceipt } from "@/components/blocks/jira-dropzone";
import {
	JIRA_LINKING_FULL_DROP_PROFILE,
	resolveJiraLinkingGlowSettleMs,
	resolveJiraLinkingReleaseSettleMs,
	type JiraLinkingRelease,
	type JiraLinkingVariant,
} from "@/components/blocks/jira-linking";

import type { JiraListInsertion } from "@/components/blocks/jira-list/jira-list-types";
import type { JiraKanbanCardData, JiraKanbanColumnData, JiraKanbanProps } from "../index";
import {
	createBoardAgentSessionDragTransaction,
	parseBoardCardGapZones,
	parseBoardEmptyColumnGapZone,
	parseListRowDropZone,
	resolveBoardAgentSessionDropAction,
	toBoardAgentSessionCardProximity,
	toChinFreeBoardCardBounds,
	toListSessionDropIntent,
	updateBoardAgentSessionDragTransaction,
	type BoardAgentSessionDragOrigin,
	type BoardAgentSessionDragTransaction,
	type BoardAgentSessionDropBounds,
	type BoardAgentSessionDropZone,
	type BoardCardInsertion,
} from "./lib/board-agent-session-drag";
import { BOARD_CARD_INSERTION_BAND_PX } from "./lib/board-card-insertion";
import { toSessionDropReceipt } from "./lib/session-drop-receipt";
import {
	executeSessionTransferPlan,
	planSessionTransfer,
	resolveDragEnablement,
	type SessionTransferLookups,
	type SessionTransferPorts,
} from "./lib/session-transfer-plan";
import {
	toBoardAgentSessionLinkFlash,
	toAssignedAgentTransferMember,
	toSessionFusionAssignmentRelease,
	toSessionFusionDrop,
	type BoardAgentSessionLinkFlash,
	type PendingSessionLinkFlash,
} from "./lib/session-fusion-overlay-state";

const SESSION_UNLINK_DROP_HALO_PX = 24;

/**
 * Grace on top of the flights' own budget before the board acknowledges a link
 * without waiting for them.
 *
 * The flights mount through a portal and measure their landing on the next
 * frame, so their wall-clock is always a little longer than their animation.
 * This has to cover that gap and nothing more: it is a backstop for a
 * decoration that never reported back, not a second schedule competing with it.
 */
const SESSION_FUSION_SETTLE_GRACE_MS = 250;

/**
 * Grace on top of the sweep's own duration before the flash is retired.
 *
 * The flash is armed a commit before the row paints it, so retiring it on the
 * bare duration can clip the tail. This only has to cover that offset — the
 * flash is retired so a finished sweep cannot replay when a row remounts, not
 * to end a sweep the user is still watching.
 */
const SESSION_LINK_FLASH_RETIRE_GRACE_MS = 150;

interface ListScrollportClip {
	clip: DOMRect;
	headerBottom: number;
}

/**
 * The card's agent shell rect, so the fusion field knows what shape it is
 * becoming. The shell is the whole card surface — the grey backdrop, the card
 * body and any chin rows — which is what the session is actually being absorbed
 * into. Targeting the 24px chin instead made the goo morph into a strip floating
 * at the card's lip rather than into the card itself.
 *
 * Falls back to the drop-zone bounds when the shell cannot be measured, which is
 * the same rect a beat before the shell mounts.
 */
function resolveIssueDockRect(
	node: HTMLElement,
	bounds: BoardAgentSessionDropBounds,
): BoardAgentSessionDropBounds {
	const shell = node
		.closest<HTMLElement>("[data-issue-key]")
		?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-shell"]');
	if (!shell) {
		return bounds;
	}

	const rect = shell.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return bounds;
	}

	return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
}

function toDropBounds(node: Element): BoardAgentSessionDropBounds | null {
	const rect = node.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return null;
	}
	return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
}

/**
 * The row chips fly into: the open attach chin, otherwise the last activity
 * row. Null when neither is in the tree yet, so the overlay can fall back to
 * the bottom of the shell instead of the card centre.
 */
function resolveIssueLandRect(node: HTMLElement): BoardAgentSessionDropBounds | null {
	const issue = node.closest<HTMLElement>("[data-issue-key]");
	if (!issue) {
		return null;
	}

	const chin = issue.querySelector('[data-slot="jira-issue-attach-chin-slot"]')
		?? issue.querySelector('[data-slot="jira-issue-attach-chin"]');
	if (chin) {
		return toDropBounds(chin);
	}

	const rows = issue.querySelectorAll('[data-slot="jira-issue-agent-row"]');
	const lastRow = rows[rows.length - 1];
	return lastRow ? toDropBounds(lastRow) : null;
}

/**
 * The card's own visible surface, without the activity rows stacked under it.
 *
 * Glow linking collapses its chip into the card body, so it aims here rather
 * than at the shell — which grows downward as rows attach and would pull the
 * landing point below the card the viewer is dropping on.
 */
function resolveIssueSurfaceRect(node: HTMLElement): BoardAgentSessionDropBounds | null {
	const surface = node
		.closest<HTMLElement>("[data-issue-key]")
		?.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
	return surface ? toDropBounds(surface) : null;
}

function clipBoundsToScrollport(
	node: HTMLElement,
	rect: DOMRect,
	clipCache: Map<HTMLElement, ListScrollportClip>,
): BoardAgentSessionDropBounds | null {
	const scrollport = node.closest<HTMLElement>("[data-testid='jira-list-table-scroll']");
	if (!scrollport) {
		return {
			bottom: rect.bottom,
			left: rect.left,
			right: rect.right,
			top: rect.top,
		};
	}

	let scrollportClip = clipCache.get(scrollport);
	if (scrollportClip === undefined) {
		const clip = scrollport.getBoundingClientRect();
		const header = scrollport.querySelector("thead");
		scrollportClip = {
			clip,
			headerBottom: header?.getBoundingClientRect().bottom ?? clip.top,
		};
		clipCache.set(scrollport, scrollportClip);
	}
	const { clip, headerBottom } = scrollportClip;
	const top = Math.max(rect.top, headerBottom, clip.top);
	const bottom = Math.min(rect.bottom, clip.bottom);
	const left = Math.max(rect.left, clip.left);
	const right = Math.min(rect.right, clip.right);
	if (bottom <= top || right <= left) {
		return null;
	}

	return { bottom, left, right, top };
}

/**
 * The insertion bands that belong to one card node, clipped to the column's
 * card list.
 *
 * Two adjustments the raw rect cannot supply:
 *
 * - The attach chin is subtracted first. A gap band outranks attach proximity,
 *   so standing in one closes the chin; measuring the band off the live bottom
 *   edge would then move the band out from under the pointer and strobe the
 *   chin open and shut. See `toChinFreeBoardCardBounds`.
 * - The clip is not optional. The card list is a real scrollport, and its
 *   `has-[[data-session-dragging]]:overflow-visible` escape only fires for a
 *   drag that started inside this column — an Untracked-rail drag, the only
 *   origin a gap can serve, leaves every card list scrolling. Without the clip
 *   a card scrolled out of sight would still arm an insertion line nobody can
 *   see, and the first visible card's band would reach up into the header.
 */
function collectCardGapZones(
	node: HTMLElement,
	cardCode: string,
	bounds: BoardAgentSessionDropBounds,
): BoardAgentSessionDropZone[] {
	const cardList = node.closest<HTMLElement>("[data-jira-kanban-card-list]");
	if (!cardList) return [];

	// Only a newly added preview grows the card. Occupied activity/detached
	// slots replace existing rows, so subtracting those would move a stable seam.
	// Measure the whole growth container, including its vertical padding.
	const growth = node.querySelector("[data-session-attach-growth]");
	const clip = cardList.getBoundingClientRect();
	return parseBoardCardGapZones(
		node.dataset.boardColumnTitle,
		cardCode,
		node.dataset.boardCardIndex,
		node.dataset.boardCardCount,
		toChinFreeBoardCardBounds(bounds, growth?.getBoundingClientRect().height ?? 0),
		BOARD_CARD_INSERTION_BAND_PX,
	).flatMap((zone) => {
		const top = Math.max(zone.bounds.top, clip.top);
		const bottom = Math.min(zone.bounds.bottom, clip.bottom);
		return bottom > top ? [{ ...zone, bounds: { ...zone.bounds, bottom, top }, clip }] : [];
	});
}

/**
 * Card-gap seams are a capability, not a decoration. A board whose host cannot
 * mint a work item at an index must not arm an insertion line over a drop that
 * would quietly do nothing, and the card under the band must keep the ordinary
 * attach affordance it has today.
 */
function gateCardGapZones(
	zones: BoardAgentSessionDropZone[],
	enabled: boolean,
): BoardAgentSessionDropZone[] {
	return enabled ? zones : zones.filter((zone) => zone.kind !== "card-gap");
}

function collectDropZones(root: HTMLElement | null): BoardAgentSessionDropZone[] {
	if (!root) return [];
	// Every pointer update gets a fresh scan, but all list rows in that scan
	// share one scrollport and sticky header clip.
	const listScrollportClipCache = new Map<HTMLElement, ListScrollportClip>();

	return Array.from(
		root.querySelectorAll<HTMLElement>("[data-board-agent-session-drop-zone]"),
	).flatMap((node): BoardAgentSessionDropZone[] => {
		const kind = node.dataset.boardAgentSessionDropZone;
		const rect = node.getBoundingClientRect();
		if (kind === "create") {
			const columnTitle = node.dataset.boardAgentSessionColumnTitle;
			return columnTitle ? [{
				bounds: {
					bottom: rect.bottom,
					left: rect.left,
					right: rect.right,
					top: rect.top,
				},
				columnTitle,
				kind: "create",
			}] : [];
		}
		if (kind === "untracked") {
			return [{
				bounds: {
					bottom: rect.bottom,
					left: rect.left,
					right: rect.right,
					top: rect.top,
				},
				kind: "untracked",
			}];
		}
		// Only an empty column's card list carries this kind directly: with no
		// card wrappers to hang seams on, the list itself is the one gap.
		if (kind === "card-gap") {
			return [...parseBoardEmptyColumnGapZone(node.dataset.boardColumnTitle, {
				bottom: rect.bottom,
				left: rect.left,
				right: rect.right,
				top: rect.top,
			})];
		}
		const issueKey = node.closest<HTMLElement>("[data-issue-key]")?.dataset.issueKey;
		if (kind === "list-row") {
			const bounds = clipBoundsToScrollport(node, rect, listScrollportClipCache);
			if (!bounds) return [];
			const zone = parseListRowDropZone(issueKey, node.dataset.listRowIndex, bounds);
			return zone ? [zone] : [];
		}
		if (!issueKey || (kind !== "issue" && kind !== "unlink")) return [];
		if (kind === "unlink") {
			return [{
				bounds: {
					bottom: rect.bottom + SESSION_UNLINK_DROP_HALO_PX,
					left: rect.left - SESSION_UNLINK_DROP_HALO_PX,
					right: rect.right + SESSION_UNLINK_DROP_HALO_PX,
					top: rect.top - SESSION_UNLINK_DROP_HALO_PX,
				},
				cardCode: issueKey,
				kind,
			}];
		}
		const bounds = {
			bottom: rect.bottom,
			left: rect.left,
			right: rect.right,
			top: rect.top,
		};
		// The card's own zone is unchanged; the seams are additional zones on the
		// same node, so attached and detached drags see exactly the board they
		// saw before. The resolver drops them for any origin but Untracked.
		return [
			{
				bounds,
				cardCode: issueKey,
				dockRect: resolveIssueDockRect(node, bounds),
				kind,
				landRect: resolveIssueLandRect(node),
				surfaceRect: resolveIssueSurfaceRect(node),
			},
			...collectCardGapZones(node, issueKey, bounds),
		];
	});
}

function findBoardCard(
	columns: readonly JiraKanbanColumnData[],
	cardCode: string,
): { card: JiraKanbanCardData; columnTitle: string } | undefined {
	for (const column of columns) {
		const card = column.cards.find((candidate) => candidate.code === cardCode);
		if (card) return { card, columnTitle: column.title };
	}
	return undefined;
}

export function useBoardAgentSessionDrag({
	boardColumns,
	detachedSessionsByCard,
	linkingVariant = "fuse",
	onBoardGapCreate,
	onCreate,
	onCreateWellReceive,
	onListCreate,
	onLink,
	onMove,
	onUnlink,
	untrackedSessions,
}: Readonly<{
	boardColumns: readonly JiraKanbanColumnData[];
	detachedSessionsByCard?: Readonly<Record<string, readonly AgentSessionItem[]>>;
	/**
	 * Which linking decoration a card attach plays. Defaults to the metaball
	 * `fuse`, so boards that never opt in keep the effect they have. `glow`
	 * collapses one cohort chip into the card and acknowledges it with the
	 * card's own halo and backdrop pulse, which replaces the chin-row sweep.
	 */
	linkingVariant?: JiraLinkingVariant;
	/**
	 * Mint work items at a specific slot in a column's card stack, with the
	 * sessions already linked to them. Omit it and no card-gap zone is ever
	 * collected, so the board never draws an insertion line it cannot honour.
	 */
	onBoardGapCreate?: (
		sessions: readonly [AgentSessionItem, ...AgentSessionItem[]],
		insertion: BoardCardInsertion,
	) => void;
	onCreate?: (session: AgentSessionItem, columnTitle: string) => void;
	onCreateWellReceive?: (receipt: SessionDropReceipt) => void;
	onListCreate?: (
		session: AgentSessionItem,
		insertion: JiraListInsertion,
	) => void;
	onLink?: (session: AgentSessionItem, card: JiraKanbanCardData, columnTitle: string) => void;
	onMove?: (
		session: JiraIssueAgentSessionRef,
		sourceCard: JiraKanbanCardData,
		targetCard: JiraKanbanCardData,
		sourceColumnTitle: string,
		targetColumnTitle: string,
	) => void;
	onUnlink?: (session: JiraIssueAgentSessionRef, card: JiraKanbanCardData, columnTitle: string) => void;
	untrackedSessions?: readonly AgentSessionItem[];
}>) {
	const shouldReduceMotion = useReducedMotion();
	const boardRootRef = useRef<HTMLDivElement | null>(null);
	const transactionRef = useRef<BoardAgentSessionDragTransaction<JiraIssueAgentSessionTransferMember> | null>(null);
	const [transaction, setTransaction] = useState<BoardAgentSessionDragTransaction<JiraIssueAgentSessionTransferMember> | null>(null);
	const [dragState, setDragState] = useState<JiraIssueAgentSessionDragState>(
		JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
	);
	const [linkFlash, setLinkFlash] = useState<BoardAgentSessionLinkFlash | null>(null);
	const [fusionDrop, setFusionDrop] = useState<{
		members: readonly JiraIssueAgentSessionTransferMember[];
		proximity: NonNullable<BoardAgentSessionDragTransaction["proximity"]>;
		release: JiraLinkingRelease;
	} | null>(null);
	const linkFlashTokenRef = useRef(0);
	const pendingAttachRef = useRef<PendingSessionLinkFlash | null>(null);
	/** Deferred assignment measurement, so unmounting cannot arm against a dead board. */
	const assignmentFrameRef = useRef<number | null>(null);
	const settleDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const flashRetireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const ports: SessionTransferPorts = useMemo(() => ({
		onBoardGapCreate,
		onCreate,
		onLink,
		onListCreate,
		onMove,
		onUnlink,
	}), [onBoardGapCreate, onCreate, onLink, onListCreate, onMove, onUnlink]);
	const enablement = resolveDragEnablement(ports);
	const cardGapsEnabled = Boolean(onBoardGapCreate);

	const commitDrop = useCallback((
		current: BoardAgentSessionDragTransaction<JiraIssueAgentSessionTransferMember>,
	) => {
		const lookups: SessionTransferLookups = {
			findCard: (cardCode) => findBoardCard(boardColumns, cardCode),
			resolveAttached: (_sourceCardCode, sessionId) => (
				current.cohort.members.find((member) => member.id === sessionId)
			),
			resolveTransferable: (origin, sessionId) => {
				if (origin.kind === "untracked") {
					return untrackedSessions?.find((candidate) => candidate.id === sessionId);
				}
				if (origin.kind === "detached") {
					return detachedSessionsByCard?.[origin.sourceCardCode]?.find(
						(candidate) => candidate.id === sessionId,
					);
				}
				return undefined;
			},
		};
		const plan = planSessionTransfer(
			resolveBoardAgentSessionDropAction(current),
			current.origin,
			lookups,
		);
		executeSessionTransferPlan(plan, ports);
		const receipt = toSessionDropReceipt({
			plan,
			pointer: current.pointer,
		});
		if (receipt) {
			onCreateWellReceive?.(receipt);
		}
	}, [
		boardColumns,
		detachedSessionsByCard,
		onCreateWellReceive,
		ports,
		untrackedSessions,
	]);

	/**
	 * Show a sweep and give it a life of its own.
	 *
	 * The flash is retired on the sweep's own duration rather than on the next
	 * gesture. Clearing it when a drag starts is what made the acknowledgement
	 * look unreliable: the sweep runs for the better part of a second, and
	 * reaching for the next session inside that window truncated it — usually
	 * within a frame or two of it appearing. Retiring on its own clock keeps a
	 * finished sweep from replaying when a row remounts, which is the only thing
	 * the gesture-start clear was ever protecting against.
	 */
	const armLinkFlash = useCallback((flash: BoardAgentSessionLinkFlash | null) => {
		if (flashRetireRef.current !== null) {
			clearTimeout(flashRetireRef.current);
			flashRetireRef.current = null;
		}
		setLinkFlash(flash);
		if (!flash) {
			return;
		}
		flashRetireRef.current = setTimeout(
			() => {
				flashRetireRef.current = null;
				setLinkFlash((current) => (current === flash ? null : current));
			},
			JIRA_ISSUE_LINK_FLASH_DURATION_MS + SESSION_LINK_FLASH_RETIRE_GRACE_MS,
		);
	}, []);

	/**
	 * Hand the drop its acknowledgement and take the flights down.
	 *
	 * Called by the overlay when its chips land, by the settle deadline when
	 * they do not, and by the next gesture if it starts first. All three arrive
	 * at the same state, and consuming the pending record makes it idempotent,
	 * so whichever gets there first wins and the rest are no-ops.
	 */
	const flushPendingAttach = useCallback(() => {
		if (settleDeadlineRef.current !== null) {
			clearTimeout(settleDeadlineRef.current);
			settleDeadlineRef.current = null;
		}
		const pending = pendingAttachRef.current;
		pendingAttachRef.current = null;
		setFusionDrop(null);
		if (!pending) {
			return;
		}
		armLinkFlash(pending.flash);
	}, [armLinkFlash]);

	/**
	 * Put a committed link's acknowledgement on screen and arm its backstop.
	 *
	 * Shared by both paths that link an agent to a card — the drop, and the
	 * card's own assign menu — so a link acknowledges itself the same way
	 * however it was made, and only one clock ever owns the flush.
	 */
	const armFusionRelease = useCallback((input: Readonly<{
		flash: BoardAgentSessionLinkFlash | null;
		members: readonly JiraIssueAgentSessionTransferMember[];
		proximity: NonNullable<BoardAgentSessionDragTransaction["proximity"]>;
		release: JiraLinkingRelease;
	}>) => {
		pendingAttachRef.current = { flash: input.flash };
		// The sweep waits for the chips to land, but it does not depend on
		// them: the overlay is decoration, mounted through a portal behind a
		// lazy chunk, and a decoration that never calls back must not be able
		// to swallow the acknowledgement for a link that already committed.
		settleDeadlineRef.current = setTimeout(
			flushPendingAttach,
			(linkingVariant === "glow"
				? resolveJiraLinkingGlowSettleMs(shouldReduceMotion, input.release)
				: resolveJiraLinkingReleaseSettleMs(input.release, JIRA_LINKING_FULL_DROP_PROFILE))
				+ SESSION_FUSION_SETTLE_GRACE_MS,
		);
		setFusionDrop({
			members: input.members,
			proximity: input.proximity,
			release: input.release,
		});
	}, [flushPendingAttach, linkingVariant, shouldReduceMotion]);

	/**
	 * Acknowledge an agent the card's own assign menu just linked.
	 *
	 * The menu commits the link itself; this only draws Glow's halo and
	 * backdrop pulse against the card named by `cardCode`. It does not replay
	 * the travelling-chip collapse a session drop uses — there is no dragged
	 * card. Silent when the card is not on the board, when reduced motion is
	 * on, or when the submit put no agent row on the card — the link still
	 * stands in every one of those cases, because the decoration was never
	 * what committed it.
	 *
	 * Measured a frame late, on purpose. A drop hit-tests a board the pointer
	 * was already over, but an assignment's own link can move the card it
	 * targets: a host that advances the work item on start re-columns it in the
	 * very commit this acknowledges. Measuring first would hand Glow a stale
	 * anchor whose hit test finds whichever card slid in behind — so the wrong
	 * card would glow.
	 *
	 * Glow only. Fuse acknowledges a link with a chin-row sweep keyed to the
	 * activity id the host minted, and that id is the host's own convention —
	 * `jira-golden-journeys-v4` builds `${card.code}:${selection.id}` from a
	 * mention id this board never sees. A sweep the board cannot target would
	 * silently never play, so fuse boards keep the assign menu they have today.
	 */
	const armMemberLink = useCallback((
		cardCode: string,
		member: JiraIssueAgentSessionTransferMember | null,
	) => {
		if (!member || shouldReduceMotion || linkingVariant !== "glow") {
			return;
		}
		if (assignmentFrameRef.current !== null) {
			cancelAnimationFrame(assignmentFrameRef.current);
		}
		assignmentFrameRef.current = requestAnimationFrame(() => {
			assignmentFrameRef.current = null;
			const proximity = toBoardAgentSessionCardProximity(
				collectDropZones(boardRootRef.current),
				cardCode,
			);
			if (!proximity) {
				return;
			}
			// Whatever the previous link still owed is settled first. A card wears
			// one acknowledgement at a time, and consuming the pending record is
			// what keeps the two paths from arming two flushes against one drop.
			flushPendingAttach();
			linkFlashTokenRef.current += 1;
			const release = toSessionFusionAssignmentRelease({
				id: linkFlashTokenRef.current,
				proximity,
			});
			if (!release) {
				return;
			}
			armFusionRelease({
				// Glow's halo and backdrop pulse are the whole acknowledgement, and
				// they key off the card rather than the rows inside it.
				flash: null,
				members: [member],
				proximity,
				release,
			});
		});
	}, [armFusionRelease, flushPendingAttach, linkingVariant, shouldReduceMotion]);

	const armSessionLink = useCallback((cardCode: string, session: AgentSessionItem) => {
		armMemberLink(cardCode, toSessionTransferMember(session));
	}, [armMemberLink]);

	/**
	 * A card's generative-action handler with the link acknowledgement attached.
	 *
	 * The host runs first: it owns the link, and the effect is only a receipt for
	 * one it made. Returns `undefined` without a host handler, so no card can
	 * glow for a link nobody committed. Composed here rather than in the board so
	 * the wrapper and the arming it pairs with stay in one place.
	 */
	const withAssignedAgentLink = useCallback((
		onSubmit: JiraKanbanProps["onCardGenerativeActionSubmit"],
	): JiraKanbanProps["onCardGenerativeActionSubmit"] => onSubmit && ((request, card, columnTitle) => {
		void onSubmit(request, card, columnTitle);
		armMemberLink(card.code, toAssignedAgentTransferMember(request));
	}), [armMemberLink]);

	useEffect(() => () => {
		if (settleDeadlineRef.current !== null) {
			clearTimeout(settleDeadlineRef.current);
		}
		if (flashRetireRef.current !== null) {
			clearTimeout(flashRetireRef.current);
		}
		if (assignmentFrameRef.current !== null) {
			cancelAnimationFrame(assignmentFrameRef.current);
		}
	}, []);

	const onDragStateChange = useCallback((
		origin: BoardAgentSessionDragOrigin,
		state: JiraIssueAgentSessionDragState,
	) => {
		if (state.dragging && state.pointer) {
			const cohort = createSessionCohort(state.transfer.members);
			if (cohort === null) {
				return;
			}
			// A drag no longer clears the acknowledgement the previous drop left
			// behind. The sweep owns its own retirement clock, so reaching for the
			// next session does not cut it short.
			const pending = pendingAttachRef.current;
			if (pending) {
				flushPendingAttach();
			}
			const zones = gateCardGapZones(collectDropZones(boardRootRef.current), cardGapsEnabled);
			const current = transactionRef.current;
			const next = current && current.cohort.key === cohort.key
				? updateBoardAgentSessionDragTransaction(current, state.pointer, zones)
				: createBoardAgentSessionDragTransaction(cohort, origin, state.pointer, zones);
			transactionRef.current = next;
			setTransaction(next);
			setDragState(state);
			return;
		}

		const current = transactionRef.current;
		if (current && !state.cancelled) {
			const finalTransaction = state.pointer
				? updateBoardAgentSessionDragTransaction(
					current,
					state.pointer,
					gateCardGapZones(collectDropZones(boardRootRef.current), cardGapsEnabled),
				)
				: current;
			const action = resolveBoardAgentSessionDropAction(finalTransaction);
			const isCardLink = action.kind === "attach" || action.kind === "move";
			linkFlashTokenRef.current += 1;
			const flash = toBoardAgentSessionLinkFlash({
				members: finalTransaction.cohort.members,
				proximity: finalTransaction.proximity,
				targetCardCode: finalTransaction.target?.kind === "attach"
					? finalTransaction.target.cardCode
					: null,
				token: linkFlashTokenRef.current,
				variant: linkingVariant,
			});
			const release = isCardLink
				? toSessionFusionDrop({
					from: finalTransaction.pointer,
					id: linkFlashTokenRef.current,
					members: finalTransaction.cohort.members,
					proximity: finalTransaction.proximity,
					variant: linkingVariant,
				})
				: null;
			commitDrop(finalTransaction);
			if (release && finalTransaction.proximity && !shouldReduceMotion) {
				armFusionRelease({
					flash,
					members: finalTransaction.cohort.members,
					proximity: finalTransaction.proximity,
					release,
				});
			} else {
				armLinkFlash(flash);
			}
		}
		transactionRef.current = null;
		setTransaction(null);
		setDragState(
			state.cancelled
				? { ...JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE, cancelled: true }
				: JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
		);
	}, [armFusionRelease, armLinkFlash, cardGapsEnabled, commitDrop, flushPendingAttach, linkingVariant, shouldReduceMotion]);

	function createBinding(
		origin: BoardAgentSessionDragOrigin,
		bindingOnUnlink?: JiraIssueAgentSessionDragBinding["onUnlink"],
	): JiraIssueAgentSessionDragBinding {
		return {
			onDragStateChange: (state) => onDragStateChange(origin, state),
			onFocusedActivitiesChange: () => {},
			onUnlink: bindingOnUnlink,
		};
	}

	function getCardDragState(card: JiraKanbanCardData, columnTitle: string) {
		const origin = transaction?.origin;
		const sourceActive = Boolean(
			origin
			&& origin.kind !== "untracked"
			&& origin.sourceCardCode === card.code,
		);
		const target = transaction?.target;
		// Click-assign arms Glow without a travelling chip, so it must not open
		// the attach chin or count as a drop the way a session flight does.
		const isFusionDropFlight = Boolean(
			fusionDrop?.release.drop && fusionDrop.proximity.cardCode === card.code,
		);
		const dropTarget = isFusionDropFlight
			? "attach"
			: target
				&& (target.kind === "attach" || target.kind === "unlink")
				&& target.cardCode === card.code
				? target.kind
				: null;
		const proximity = transaction?.proximity;
		const attachNearness = isFusionDropFlight
			? 1
			: proximity?.cardCode === card.code ? proximity.nearness : 0;
		// Only the card the session is actually heading for traces a stroke, and
		// it traces the cohort lead's colour — the same member, resolved by the
		// same expression, that the drop flash will sweep across the chin row a
		// moment later. A drop flight has no live pointer left, so it stops
		// tracing and hands over to that flash.
		const traceMembers = transaction?.cohort.members;
		const traceRect = proximity?.surfaceRect ?? proximity?.bounds;
		const tracePointer = !isFusionDropFlight
			&& proximity?.cardCode === card.code
			&& transaction
			&& traceRect
			? toJiraIssueAttachTracePointer(transaction.pointer, traceRect)
			: null;
		const attachTrace: JiraIssueAttachTrace | null = tracePointer
			? {
				accent: resolveAgentBrandTintColor(traceMembers?.[0]?.tintSeed)
					?? AGENT_BRAND_TINT_FALLBACK,
				pointerX: tracePointer.pointerX,
				pointerY: tracePointer.pointerY,
			}
			: null;
		const attachedBinding = createBinding(
			{ kind: "attached", sourceCardCode: card.code },
			(session) => {
				if (session) onUnlink?.(session, card, columnTitle);
			},
		);
		const dragCount = dragState.dragging
			? dragState.transfer.members.length
			: fusionDrop?.release.drop
				? fusionDrop.members.length
				: 0;
		const control: JiraIssueAgentSessionDragControl | undefined = enablement.attached
			? {
				attachNearness,
				attachTrace,
				binding: attachedBinding,
				dragCount,
				dropTarget,
				sourceActive,
				state: sourceActive ? dragState : JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE,
			}
			: undefined;

		return {
			attachNearness,
			control,
			detachedBinding: enablement.transferable
				? createBinding({ kind: "detached", sourceCardCode: card.code })
				: undefined,
			dropTarget,
		};
	}

	const draggingIds = useMemo(() => {
		if (dragState.dragging) {
			return new Set(dragState.transfer.members.map((member) => member.id));
		}
		if (fusionDrop?.release.drop) {
			return new Set(fusionDrop.members.map((member) => member.id));
		}
		return new Set<string>();
	}, [dragState, fusionDrop]);

	return {
		/**
		 * Acknowledge an agent the card's own assign menu linked, with Glow's
		 * halo and pulse — not the travelling-chip collapse a drop draws.
		 * The menu owns the link; this only draws it.
		 */
		withAssignedAgentLink,
		armSessionLink,
		boardRootRef,
		/**
		 * The slot the board should draw its insertion line in, or null. Derived
		 * here rather than plumbed as its own prop, the same way `listDropIntent`
		 * is, so the target and the affordance can never disagree.
		 */
		cardInsertion: transaction?.target?.kind === "create-board-gap"
			? transaction.target.insertion
			: null,
		draggingIds,
		dragState,
		enablement,
		fusionDrop,
		linkFlash,
		/**
		 * Which decoration the overlay should draw. Returned rather than plumbed
		 * to the board as its own prop, the same way `listDropIntent` is, so the
		 * release this hook armed and the effect that plays it cannot disagree.
		 */
		linkingVariant,
		getCardDragState,
		listDropIntent: onLink || onListCreate
			? toListSessionDropIntent(transaction?.target ?? null)
			: undefined,
		onFusionSettled: flushPendingAttach,
		transaction,
		untrackedBinding: enablement.transferable ? createBinding({ kind: "untracked" }) : undefined,
	};
}

export type BoardAgentSessionDrag = ReturnType<typeof useBoardAgentSessionDrag>;
