import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import type { JiraListInsertion } from "@/components/blocks/jira-list/jira-list-types";

import type { JiraKanbanCardData } from "@/components/blocks/jira-kanban/index";
import type {
	BoardAgentSessionDragOrigin,
	BoardAgentSessionDropAction,
	BoardCardInsertion,
} from "./board-agent-session-drag";

export type SessionTransferStep =
	| {
		readonly kind: "link";
		readonly session: AgentSessionItem;
		readonly card: JiraKanbanCardData;
		readonly columnTitle: string;
	}
	| {
		readonly kind: "move";
		readonly session: JiraIssueAgentSessionRef;
		readonly sourceCard: JiraKanbanCardData;
		readonly sourceColumnTitle: string;
		readonly targetCard: JiraKanbanCardData;
		readonly targetColumnTitle: string;
	}
	| {
		readonly kind: "unlink";
		readonly session: JiraIssueAgentSessionRef;
		readonly card: JiraKanbanCardData;
		readonly columnTitle: string;
	}
	| {
		readonly kind: "create-board";
		readonly session: AgentSessionItem;
		readonly columnTitle: string;
	}
	| {
		readonly kind: "create-board-gap";
		/**
		 * The whole cohort, in drag order, in ONE step.
		 *
		 * Deliberately unlike `create-list`, which fans a cohort out into one step
		 * per session and advances `insertAtIndex` for each. A board gap is
		 * described by both an index and a neighbour card code, and a consumer that
		 * re-resolves the neighbour after every insert would resolve the same slot
		 * every time and land the cohort reversed. Handing the slot over once, with
		 * every session attached to it, leaves exactly one owner of the ordering.
		 */
		readonly sessions: readonly [AgentSessionItem, ...AgentSessionItem[]];
		readonly insertion: BoardCardInsertion;
	}
	| {
		readonly kind: "create-list";
		readonly session: AgentSessionItem;
		readonly insertion: JiraListInsertion;
	};

export type SessionTransferRefusal =
	| "no-target"
	| "unresolved-member"
	| "unknown-card"
	| "ineligible-origin"
	| "plural-source-not-supported";

export interface SessionTransferSummary {
	readonly count: number;
	readonly targetLabel: string;
	readonly verb: SessionTransferStep["kind"];
}

export type SessionTransferPlan =
	| {
		readonly kind: "refuse";
		readonly cohortSize: number;
		readonly reason: SessionTransferRefusal;
	}
	| {
		readonly kind: "commit";
		readonly steps: readonly [SessionTransferStep, ...SessionTransferStep[]];
		readonly summary: SessionTransferSummary;
	};

export interface SessionTransferLookups {
	readonly findCard: (
		cardCode: string,
	) => { readonly card: JiraKanbanCardData; readonly columnTitle: string } | undefined;
	readonly resolveAttached: (
		sourceCardCode: string,
		sessionId: string,
	) => JiraIssueAgentSessionRef | undefined;
	readonly resolveTransferable: (
		origin: BoardAgentSessionDragOrigin,
		sessionId: string,
	) => AgentSessionItem | undefined;
}

export interface SessionTransferPorts {
	/**
	 * Creates work items at a specific gap in a board column's card stack, with
	 * the dragged sessions already linked to them. The board twin of
	 * `onListCreate`, but cohort-at-a-time: the port owns resolving the gap once
	 * and placing every session after it in drag order.
	 */
	readonly onBoardGapCreate?: (
		sessions: readonly [AgentSessionItem, ...AgentSessionItem[]],
		insertion: BoardCardInsertion,
	) => void;
	readonly onCreate?: (session: AgentSessionItem, columnTitle: string) => void;
	readonly onLink?: (
		session: AgentSessionItem,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
	readonly onListCreate?: (session: AgentSessionItem, insertion: JiraListInsertion) => void;
	readonly onMove?: (
		session: JiraIssueAgentSessionRef,
		sourceCard: JiraKanbanCardData,
		targetCard: JiraKanbanCardData,
		sourceColumnTitle: string,
		targetColumnTitle: string,
	) => void;
	readonly onUnlink?: (
		session: JiraIssueAgentSessionRef,
		card: JiraKanbanCardData,
		columnTitle: string,
	) => void;
}

export interface BoardAgentSessionDragEnablement {
	readonly attached: boolean;
	readonly transferable: boolean;
}

export function resolveDragEnablement(
	ports: SessionTransferPorts,
): BoardAgentSessionDragEnablement {
	return {
		attached: Boolean(ports.onMove && ports.onUnlink),
		transferable: Boolean(
			ports.onLink || ports.onCreate || ports.onListCreate || ports.onBoardGapCreate,
		),
	};
}

function refuse(
	cohortSize: number,
	reason: SessionTransferRefusal,
): SessionTransferPlan {
	return { kind: "refuse", cohortSize, reason };
}

function commit(
	steps: readonly [SessionTransferStep, ...SessionTransferStep[]],
	summary: SessionTransferSummary,
): SessionTransferPlan {
	return { kind: "commit", steps, summary };
}

function resolveTransferableMembers(
	sessionIds: readonly [string, ...string[]],
	origin: BoardAgentSessionDragOrigin,
	lookups: SessionTransferLookups,
): readonly [AgentSessionItem, ...AgentSessionItem[]] | null {
	const resolved: AgentSessionItem[] = [];
	for (const sessionId of sessionIds) {
		const session = lookups.resolveTransferable(origin, sessionId);
		if (session === undefined) {
			return null;
		}
		resolved.push(session);
	}
	const [first, ...rest] = resolved;
	return first === undefined ? null : [first, ...rest];
}

function resolveAttachedMembers(
	sessionIds: readonly [string, ...string[]],
	sourceCardCode: string,
	lookups: SessionTransferLookups,
): readonly [JiraIssueAgentSessionRef, ...JiraIssueAgentSessionRef[]] | null {
	const resolved: JiraIssueAgentSessionRef[] = [];
	for (const sessionId of sessionIds) {
		const session = lookups.resolveAttached(sourceCardCode, sessionId);
		if (session === undefined) {
			return null;
		}
		resolved.push(session);
	}
	const [first, ...rest] = resolved;
	return first === undefined ? null : [first, ...rest];
}

export function expandListCreateSteps(
	sessions: readonly [AgentSessionItem, ...AgentSessionItem[]],
	insertion: JiraListInsertion,
): readonly [SessionTransferStep, ...SessionTransferStep[]] {
	const [first, ...rest] = sessions;
	return [
		{
			kind: "create-list",
			session: first,
			insertion,
		},
		...rest.map((session, index) => ({
			kind: "create-list" as const,
			session,
			insertion: {
				...insertion,
				insertAtIndex: insertion.insertAtIndex + index + 1,
			},
		})),
	];
}

/**
 * The board twin of `expandListCreateSteps` — except it does not expand.
 *
 * A list insertion is a bare index into one flat ordering, so N sessions can be
 * N independent steps at N consecutive indices. A board insertion also names a
 * neighbour card, which the host needs in order to survive an assignee filter
 * thinning the column it measured. Those two facts cannot both advance: whoever
 * re-resolves the neighbour after each insert lands every member back at the
 * same slot, in reverse. So the cohort stays whole and the host places it in
 * one pass.
 */
export function toBoardGapCreateStep(
	sessions: readonly [AgentSessionItem, ...AgentSessionItem[]],
	insertion: BoardCardInsertion,
): readonly [SessionTransferStep, ...SessionTransferStep[]] {
	return [{ kind: "create-board-gap", sessions, insertion }];
}

export function planSessionTransfer(
	action: BoardAgentSessionDropAction,
	origin: BoardAgentSessionDragOrigin,
	lookups: SessionTransferLookups,
): SessionTransferPlan {
	switch (action.kind) {
		case "none":
			return refuse(0, "no-target");
		case "attach": {
			const sessions = resolveTransferableMembers(action.sessionIds, origin, lookups);
			if (sessions === null) {
				return refuse(action.sessionIds.length, "unresolved-member");
			}
			const target = lookups.findCard(action.targetCardCode);
			if (target === undefined) {
				return refuse(action.sessionIds.length, "unknown-card");
			}
			const [first, ...rest] = sessions;
			return commit(
				[
					{ kind: "link", session: first, card: target.card, columnTitle: target.columnTitle },
					...rest.map((session) => ({
						kind: "link" as const,
						session,
						card: target.card,
						columnTitle: target.columnTitle,
					})),
				],
				{ count: sessions.length, targetLabel: target.card.code, verb: "link" },
			);
		}
		case "create": {
			if (origin.kind !== "untracked") {
				return refuse(action.sessionIds.length, "ineligible-origin");
			}
			const sessions = resolveTransferableMembers(action.sessionIds, origin, lookups);
			if (sessions === null) {
				return refuse(action.sessionIds.length, "unresolved-member");
			}
			const [first, ...rest] = sessions;
			return commit(
				[
					{ kind: "create-board", session: first, columnTitle: action.columnTitle },
					...rest.map((session) => ({
						kind: "create-board" as const,
						session,
						columnTitle: action.columnTitle,
					})),
				],
				{ count: sessions.length, targetLabel: action.columnTitle, verb: "create-board" },
			);
		}
		case "create-board-gap": {
			if (origin.kind !== "untracked") {
				return refuse(action.sessionIds.length, "ineligible-origin");
			}
			const sessions = resolveTransferableMembers(action.sessionIds, origin, lookups);
			if (sessions === null) {
				return refuse(action.sessionIds.length, "unresolved-member");
			}
			return commit(
				toBoardGapCreateStep(sessions, action.insertion),
				{
					count: sessions.length,
					targetLabel: `${action.insertion.columnTitle} #${action.insertion.insertAtIndex}`,
					verb: "create-board-gap",
				},
			);
		}
		case "create-list": {
			if (origin.kind !== "untracked") {
				return refuse(action.sessionIds.length, "ineligible-origin");
			}
			const sessions = resolveTransferableMembers(action.sessionIds, origin, lookups);
			if (sessions === null) {
				return refuse(action.sessionIds.length, "unresolved-member");
			}
			return commit(
				expandListCreateSteps(sessions, action.insertion),
				{
					count: sessions.length,
					targetLabel: action.insertion.relativeToIssueKey,
					verb: "create-list",
				},
			);
		}
		case "detach": {
			if (origin.kind !== "attached") {
				return refuse(action.sessionIds.length, "ineligible-origin");
			}
			if (action.sessionIds.length > 1) {
				return refuse(action.sessionIds.length, "plural-source-not-supported");
			}
			const sessions = resolveAttachedMembers(action.sessionIds, action.sourceCardCode, lookups);
			if (sessions === null) {
				return refuse(action.sessionIds.length, "unresolved-member");
			}
			const source = lookups.findCard(action.sourceCardCode);
			if (source === undefined) {
				return refuse(action.sessionIds.length, "unknown-card");
			}
			return commit(
				[{
					kind: "unlink",
					session: sessions[0],
					card: source.card,
					columnTitle: source.columnTitle,
				}],
				{ count: 1, targetLabel: source.card.code, verb: "unlink" },
			);
		}
		case "move": {
			if (origin.kind !== "attached") {
				return refuse(action.sessionIds.length, "ineligible-origin");
			}
			if (action.sessionIds.length > 1) {
				return refuse(action.sessionIds.length, "plural-source-not-supported");
			}
			const sessions = resolveAttachedMembers(action.sessionIds, action.sourceCardCode, lookups);
			if (sessions === null) {
				return refuse(action.sessionIds.length, "unresolved-member");
			}
			const source = lookups.findCard(action.sourceCardCode);
			const target = lookups.findCard(action.targetCardCode);
			if (source === undefined || target === undefined) {
				return refuse(action.sessionIds.length, "unknown-card");
			}
			return commit(
				[{
					kind: "move",
					session: sessions[0],
					sourceCard: source.card,
					sourceColumnTitle: source.columnTitle,
					targetCard: target.card,
					targetColumnTitle: target.columnTitle,
				}],
				{ count: 1, targetLabel: target.card.code, verb: "move" },
			);
		}
		default: {
			const exhaustive: never = action;
			return exhaustive;
		}
	}
}

export function executeSessionTransferPlan(
	plan: SessionTransferPlan,
	ports: SessionTransferPorts,
): void {
	if (plan.kind === "refuse") {
		return;
	}

	for (const step of plan.steps) {
		switch (step.kind) {
			case "link":
				ports.onLink?.(step.session, step.card, step.columnTitle);
				break;
			case "move":
				ports.onMove?.(
					step.session,
					step.sourceCard,
					step.targetCard,
					step.sourceColumnTitle,
					step.targetColumnTitle,
				);
				break;
			case "unlink":
				ports.onUnlink?.(step.session, step.card, step.columnTitle);
				break;
			case "create-board":
				ports.onCreate?.(step.session, step.columnTitle);
				break;
			case "create-board-gap":
				ports.onBoardGapCreate?.(step.sessions, step.insertion);
				break;
			case "create-list":
				ports.onListCreate?.(step.session, step.insertion);
				break;
			default: {
				const exhaustive: never = step;
				return exhaustive;
			}
		}
	}
}
