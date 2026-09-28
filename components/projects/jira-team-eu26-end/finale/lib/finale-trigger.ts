import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

export const FINALE_DONE_COLUMN_TITLE = "Done";

/**
 * The closing finale starts only once every keynote announcement sits in Done.
 * Extra cards created during the demo neither block nor trigger it.
 */
export function isJiraTeamEu26FinaleReady(
	columns: readonly JiraKanbanColumnData[],
	requiredCodes: readonly string[],
): boolean {
	if (requiredCodes.length === 0) return false;
	const done = columns.find((column) => column.title === FINALE_DONE_COLUMN_TITLE);
	if (!done) return false;
	const doneCodes = new Set(done.cards.map((card) => card.code));
	return requiredCodes.every((code) => doneCodes.has(code));
}

export interface FinaleSeekRequest {
	readonly autostart: boolean;
	readonly seek: number;
	/** Open frozen on the seek frame; Space plays from there. */
	readonly hold: boolean;
}

/**
 * Rehearsal entry: `?finale` arms the finale for the next click,
 * `?finale=2.3` also seeks the music clock, and `&hold` opens frozen on that
 * frame. Invalid values fall back to 0.
 */
export function parseFinaleSearch(search: string): FinaleSeekRequest {
	const params = new URLSearchParams(search);
	if (!params.has("finale")) return { autostart: false, seek: 0, hold: false };
	const seek = Number.parseFloat(params.get("finale") ?? "");
	return { autostart: true, seek: Number.isFinite(seek) && seek > 0 ? seek : 0, hold: params.has("hold") };
}
