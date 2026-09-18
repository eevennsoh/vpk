import type { AgentSessionItem } from "./agent-session-types";

export type SessionCohortKey = string & { readonly __brand: "SessionCohortKey" };

export type CohortMember = Readonly<{ id: string }>;

export interface SessionCohortMarks {
	readonly markedIds: ReadonlySet<string>;
}

export interface SessionCohort<TMember extends CohortMember = CohortMember> {
	readonly key: SessionCohortKey;
	readonly members: readonly [TMember, ...TMember[]];
}

function toSessionCohortKey(ids: readonly string[]): SessionCohortKey {
	return [...ids].sort().join("|") as SessionCohortKey;
}

export function createSessionCohort<TMember extends CohortMember>(
	members: readonly TMember[],
): SessionCohort<TMember> | null {
	const [first, ...rest] = members;
	if (first === undefined) {
		return null;
	}

	return {
		key: toSessionCohortKey(members.map((member) => member.id)),
		members: [first, ...rest],
	};
}

export function singletonSessionCohort<TMember extends CohortMember>(
	member: TMember,
): SessionCohort<TMember> {
	return {
		key: toSessionCohortKey([member.id]),
		members: [member],
	};
}

export function sessionCohortIds(
	cohort: SessionCohort,
): readonly [string, ...string[]] {
	const [first, ...rest] = cohort.members;
	return [first.id, ...rest.map((member) => member.id)];
}

export function selectDragCohort(
	originId: string,
	marks: SessionCohortMarks,
	visibleItems: readonly AgentSessionItem[],
): SessionCohort<AgentSessionItem> {
	const origin = visibleItems.find((item) => item.id === originId);
	if (origin === undefined) {
		throw new Error(`selectDragCohort: origin ${originId} is not visible`);
	}

	if (!marks.markedIds.has(originId)) {
		return singletonSessionCohort(origin);
	}

	return createSessionCohort(
		// The preview's lead avatars and captured geometry must describe the
		// same grabbed session. Other marked members retain their visible order.
		[origin, ...visibleItems.filter((item) => item.id !== originId && marks.markedIds.has(item.id))],
	) ?? singletonSessionCohort(origin);
}

export function isTransferSourceFaded(
	sessionId: string,
	draggingIds: ReadonlySet<string> | undefined,
	isPublisher: boolean,
): boolean {
	return Boolean(draggingIds?.has(sessionId)) && !isPublisher;
}
