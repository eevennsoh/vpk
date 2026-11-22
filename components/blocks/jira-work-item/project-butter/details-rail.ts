import type { Easing } from "motion/react";
import { motionDuration, motionEase } from "@/lib/motion";
import type { ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";

export type FillCursorPosition = { field: ProjectButterDetailFieldId | "acceptanceCriteria" } & (
	| { phase: "lift" }
	| { phase: "travel" | "land"; travel: { duration: number; ease: Easing } }
);

export const DETAILS_RAIL_GLIDE = { layout: { duration: motionDuration.normal, ease: motionEase.linear } } as const;
export const FILL_LIFT = { duration: motionDuration.slow, ease: motionEase.outPractical } as const;
export const FILL_LANDING = { duration: motionDuration.medium, ease: motionEase.outPractical } as const;
export const DETAIL_VALUE_HANDOFF = { duration: motionDuration.slow, ease: motionEase.linear } as const;
export const DETAIL_VALUE_ENTRY_OFFSET = 4;

export function fillCursorY(row: HTMLElement, cursor: HTMLElement, phase: FillCursorPosition["phase"]) {
	const top = row.offsetTop;
	if (phase === "lift") return top;
	const bottom = top + row.offsetHeight;
	return phase === "land" ? Math.max(top, bottom - cursor.offsetHeight) : bottom;
}

export function fillCursorTravel(row: HTMLElement, cursor: HTMLElement, phase: "travel" | "land") {
	const from = new DOMMatrixReadOnly(getComputedStyle(cursor).transform).m42;
	const distance = Math.abs(fillCursorY(row, cursor, phase) - from);
	// One 48px field per fast beat. Decelerate over just the last cursor height.
	const speed = 48 / motionDuration.fast;
	const braking = phase === "land" ? Math.min(cursor.offsetHeight, distance) : 0;
	const cruise = distance - braking;
	const duration = Math.max(motionDuration.xxshort, (cruise + 2 * braking) / speed);
	if (!braking) return { duration, ease: motionEase.linear };
	const ease = (progress: number) => {
		const travel = progress * (cruise + 2 * braking);
		if (travel <= cruise) return travel / distance;
		const remaining = (1 - progress) * (cruise + 2 * braking) / (2 * braking);
		return 1 - braking * remaining ** 2 / distance;
	};
	return { duration, ease };
}

export const SUGGESTION_REVEAL_DURATION = 1.3;
export const SUGGESTION_REVEAL_SPREAD = 5;
