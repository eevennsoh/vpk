import type { FloatingRovoButtonPlacement } from "@/components/blocks/rovo-button";

/**
 * The showcase parks every variant on one evenly spaced row along the bottom
 * edge, numbered right-to-left: slot 0 hugs the right edge and each later slot
 * steps one gap further left.
 *
 * The gap is not cosmetic. A floating button is right-anchored, so when it
 * morphs into a card the card grows *leftward* and can land on top of whichever
 * button sits in the next slots. Slots 0 and 2 are the two card-opening
 * variants, so the step is sized to keep a full card clear of the *other* card's
 * button: two steps (352px) exceeds `ROVO_BUTTON_DEMO_CARD_WIDTH_PX`, leaving
 * 57px of daylight. A card still covers the plain button one slot along, which
 * is unavoidable — the embedded catalog preview is a fixed 846px wide and five
 * buttons plus a 295px card do not both fit.
 */
const DEMO_BUTTON_BOTTOM = "32px";
const DEMO_BUTTON_FIRST_RIGHT_PX = 24;

/** Distance between two neighbouring slots, in px. */
export const ROVO_BUTTON_DEMO_RIGHT_STEP_PX = 176;

/** Width the surface morphs to when a variant opens a card (see `surface.tsx`). */
export const ROVO_BUTTON_DEMO_CARD_WIDTH_PX = 295;

/** Distance from the container's right edge to the left edge of `slot`, in px. */
export function getRovoButtonDemoRightPx(slot: number): number {
	return DEMO_BUTTON_FIRST_RIGHT_PX + slot * ROVO_BUTTON_DEMO_RIGHT_STEP_PX;
}

function getRovoButtonDemoPlacement(slot: number): FloatingRovoButtonPlacement {
	return {
		right: `${getRovoButtonDemoRightPx(slot)}px`,
		bottom: DEMO_BUTTON_BOTTOM,
	};
}

export const ONBOARDING_BUTTON_PLACEMENT = getRovoButtonDemoPlacement(0);
export const CHAT_BUTTON_PLACEMENT = getRovoButtonDemoPlacement(1);
export const INSIGHTS_BUTTON_PLACEMENT = getRovoButtonDemoPlacement(2);
export const SUGGESTION_BUTTON_PLACEMENT = getRovoButtonDemoPlacement(3);
export const TOOLBAR_BUTTON_PLACEMENT = getRovoButtonDemoPlacement(4);

/** Slots whose variant morphs the surface into a leftward-growing card. */
export const ROVO_BUTTON_DEMO_CARD_SLOTS = [0, 2] as const;
