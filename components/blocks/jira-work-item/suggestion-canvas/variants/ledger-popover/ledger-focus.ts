import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";

/**
 * Stable `data-focus-key` values for controls that mount and unmount as decisions change.
 * The panel requests one of these after a decision so keyboard focus never falls to the page.
 */
export const focusKey = {
	accept: (id: SuggestionFieldId) => `accept:${id}`,
	dismiss: (id: SuggestionFieldId) => `dismiss:${id}`,
	undo: (id: SuggestionFieldId) => `undo:${id}`,
	checkAgain: "check-again",
	refresh: "refresh",
} as const;

/** Marks a control focused by a handoff rather than by the user, so its tooltip stays shut. */
const QUIET_FOCUS = "quietFocus";

/**
 * Moves focus to a control on the user's behalf. The control stays flagged until it loses focus or the pointer moves
 * on it (a pointer left resting where Undo was is not a hover), so a handoff never pops a tooltip over the next row.
 */
export function focusQuietly(target: HTMLElement) {
	target.dataset[QUIET_FOCUS] = "";
	const clear = () => {
		delete target.dataset[QUIET_FOCUS];
		target.removeEventListener("blur", clear);
		target.removeEventListener("pointermove", clear);
	};
	target.addEventListener("blur", clear);
	target.addEventListener("pointermove", clear);
	target.focus();
}

export function isQuietlyFocused(target: Element | null): boolean {
	return target instanceof HTMLElement && QUIET_FOCUS in target.dataset;
}
