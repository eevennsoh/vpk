import {
	firstUnviewedSnapshot,
	selectInsightsNudgeRows,
} from "@/components/blocks/jira-kanban/experimental/lib/board-insights-nudge";
import type { PulseSnapshot } from "@/components/blocks/jira-kanban/experimental/pulse/types";
import type {
	FloatingRovoButtonInsightRow,
	FloatingRovoButtonInsightsConfig,
} from "@/components/blocks/rovo-button";

/**
 * The board's unread Pulse snapshots, shaped for the floating Rovo button.
 *
 * The selection rules live in `board-insights-nudge`; this is only the
 * translation between a `PulseSnapshot` and the button's row contract, plus the
 * two behaviours the route cannot express in a prop:
 *
 * - **`count` is the total, not `rows.length`.** Rows cap at three, and a card
 *   that says "3 new insights" while five are unread is a lie the reader can
 *   check. `overflowCount` carries the remainder.
 * - **The primary action resumes, it does not restart.** It deep-links to the
 *   *oldest* unread snapshot, because the reader has already read everything
 *   before it and the point of the nudge is to move them forward.
 *
 * Dismissal is deliberately absent from the derivation: it collapses the
 * affordance and nothing else. Only opening the article advances the watermark,
 * so a dismissed nudge comes back with the same count on the next visit — see
 * the module comment on `board-insights-nudge` for why that asymmetry is the
 * design.
 */

/** Stable across renders, so the button's own stage does not reset under it. */
export const JIRA_GOLDEN_JOURNEY_V3_INSIGHTS_NUDGE_ID = "jira-golden-journey-v3-board-insights";

/**
 * The board this nudge speaks for — the same name the board header renders as
 * its `h1`, so the card's "Since your last visit to …" line names the place the
 * reader recognises.
 *
 * It is deliberately *not* `PULSE_TIMELINE.projectLabel`. That is the epic line
 * ("PAY · Payments SDK v2 migration") — a scope inside the board, not the board
 * — and at 31 characters it ellipsised inside the card's 295px surface, which
 * read as a layout bug rather than a long name.
 *
 * The header hardcodes its own copy of the string, so a contract test asserts
 * the two still agree; it lives here rather than being exported from the header
 * because a component file that exports constants stops being
 * Fast-Refresh-safe.
 */
export const EXPERIMENTAL_BOARD_SPACE_NAME = "Jira Design";

export interface BoardInsightsNudgeHandlers {
	/**
	 * Open Insights at `snapshotId`, or at the top of the article when `null`.
	 * The owner routes this through the board's own open handler so the unread
	 * watermark advances in the same gesture.
	 */
	onOpenSnapshot: (snapshotId: string | null) => void;
	/** Collapse the affordance. Must not mark anything read. */
	onDismiss: () => void;
}

export interface BoardInsightsNudgeOptions extends BoardInsightsNudgeHandlers {
	/**
	 * Shown on the card as where the insights came from. Defaults to the board's
	 * own name; callers should not substitute a scope, filter, or issue key.
	 */
	spaceName?: string;
}

function toInsightRow(
	snapshot: PulseSnapshot,
	onOpenSnapshot: BoardInsightsNudgeHandlers["onOpenSnapshot"],
): FloatingRovoButtonInsightRow {
	return {
		id: snapshot.id,
		chapterLabel: snapshot.chapterLabel,
		timeLabel: snapshot.timeLabel,
		title: snapshot.title,
		onSelect: () => onOpenSnapshot(snapshot.id),
	};
}

/**
 * `null` when there is nothing unread, so the button falls back to being a
 * plain chat launcher rather than rendering an empty affordance.
 *
 * `onSecondaryAction` is intentionally never set: the button already falls back
 * to opening chat, and naming it here would only restate that.
 */
export function toBoardInsightsNudgeConfig(
	snapshots: readonly PulseSnapshot[],
	lastViewedAt: string | null | undefined,
	{ onDismiss, onOpenSnapshot, spaceName = EXPERIMENTAL_BOARD_SPACE_NAME }: Readonly<BoardInsightsNudgeOptions>,
): FloatingRovoButtonInsightsConfig | null {
	const { overflowCount, rows, totalCount } = selectInsightsNudgeRows(snapshots, lastViewedAt);
	if (totalCount === 0) {
		return null;
	}

	const resumeSnapshotId = firstUnviewedSnapshot(snapshots, lastViewedAt)?.id ?? null;
	return {
		id: JIRA_GOLDEN_JOURNEY_V3_INSIGHTS_NUDGE_ID,
		count: totalCount,
		overflowCount,
		rows: rows.map((snapshot) => toInsightRow(snapshot, onOpenSnapshot)),
		spaceName,
		onDismiss,
		onPrimaryAction: () => onOpenSnapshot(resumeSnapshotId),
	};
}
