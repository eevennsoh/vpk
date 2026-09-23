import type { BoardAgentSessionDragOrigin, BoardAgentSessionDragPointer, BoardAgentSessionDropZone } from "./board-agent-session-drag";
import {
	toJiraIssueAttachTracePointer,
	// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
} from "../../../jira-issue/attach-proximity.ts";

export interface BoardAgentSessionTrace {
	cardCode: string;
	nearness: number;
	pointerX: number;
	pointerY: number;
}

const TRACE_REACH_PX = 180;
const TRACE_MAX_CARDS = 4;
// Keep the tight shared gradient visible from outside a card without widening
// it into a full ring. Distance still controls opacity; the arc faces the drag.
const TRACE_POINTER_OVERSHOOT_PX = 24;

/** Decorative neighbourhood only. The transaction retains one attach winner. */
export function resolveBoardAgentSessionTraces(
	origin: BoardAgentSessionDragOrigin,
	pointer: BoardAgentSessionDragPointer,
	zones: readonly BoardAgentSessionDropZone[],
	winnerCardCode: string | null,
): BoardAgentSessionTrace[] {
	const candidates: { distance: number; trace: BoardAgentSessionTrace }[] = [];
	for (const zone of zones) {
		if (zone.kind !== "issue" || (origin.kind === "attached" && zone.cardCode === origin.sourceCardCode)) continue;
		const rect = zone.surfaceRect ?? zone.bounds;
		const dx = Math.max(rect.left - pointer.x, pointer.x - rect.right, 0);
		const dy = Math.max(rect.top - pointer.y, pointer.y - rect.bottom, 0);
		const distance = Math.hypot(dx, dy);
		if (distance >= TRACE_REACH_PX) continue;
		const x = Math.max(rect.left - TRACE_POINTER_OVERSHOOT_PX, Math.min(pointer.x, rect.right + TRACE_POINTER_OVERSHOOT_PX));
		const y = Math.max(rect.top - TRACE_POINTER_OVERSHOOT_PX, Math.min(pointer.y, rect.bottom + TRACE_POINTER_OVERSHOOT_PX));
		const tracePointer = toJiraIssueAttachTracePointer({ x, y }, rect);
		if (!tracePointer) continue;
		candidates.push({ distance, trace: {
			cardCode: zone.cardCode,
			nearness: 0,
			...tracePointer,
		} });
	}
	candidates.sort((a, b) => a.distance - b.distance
		|| Number(b.trace.cardCode === winnerCardCode) - Number(a.trace.cardCode === winnerCardCode));
	const closestDistance = candidates[0]?.distance ?? 0;
	return candidates.slice(0, TRACE_MAX_CARDS).map(({ distance, trace }, index) => {
		// One unmistakable focal card. Secondary arcs fade quadratically from
		// 45% to zero as their painted borders get farther from the cursor.
		const progress = 1 - (distance - closestDistance) / (TRACE_REACH_PX - closestDistance);
		return { ...trace, nearness: index === 0 ? 1 : 0.45 * progress * progress };
	});
}
