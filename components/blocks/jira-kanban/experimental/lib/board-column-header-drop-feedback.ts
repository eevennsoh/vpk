import type { CSSProperties } from "react";

type CssLength = CSSProperties["paddingTop"];

function cssLength(value: NonNullable<CssLength>): string {
	return typeof value === "number" ? `${value}px` : value;
}

/**
 * Places a column header's drop feedback pill.
 *
 * The pill shares the create action's horizontal inset. An enclosed header
 * pads more above its title row than below it (the card list supplies the
 * rest of that balanced gap), so the pill keeps the inset from the header's
 * top edge and extends the same distance below the row: it stays centred on
 * the title, at the ghost-button height, rather than shrinking with the box.
 * Headers without an inset keep the full header box.
 */
export function resolveBoardColumnHeaderDropFeedbackInset(
	inset: CssLength,
	paddingTop: CssLength,
	paddingBottom: CssLength,
): Pick<CSSProperties, "inset" | "insetInline" | "top" | "bottom"> {
	if (inset == null || paddingTop == null || paddingBottom == null) return { inset: inset ?? 0 };
	return {
		insetInline: inset,
		top: inset,
		bottom: `calc(${cssLength(inset)} + ${cssLength(paddingBottom)} - ${cssLength(paddingTop)})`,
	};
}
