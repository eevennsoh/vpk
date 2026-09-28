import type { CSSProperties } from "react";
import type { Transition, Variants } from "motion/react";

/**
 * duration-slower + ease-out (bold entrance).
 *
 * Minting a work item is a low-frequency, prominent moment, so it earns the
 * large-transition duration: long enough for the eye to follow the card growing
 * into its slot, and long enough for the surrounding cards to read as pushed
 * apart rather than teleported.
 */
const CARD_ENTER: Transition = { duration: 0.4, ease: [0, 0.4, 0, 1] };
/**
 * duration-medium + ease-out — opacity lands well before the scale settles so
 * the card is readable for most of its growth instead of hanging translucent
 * over the cards behind it.
 */
const CARD_ENTER_OPACITY: Transition = { duration: 0.2, ease: [0, 0.4, 0, 1] };
/** duration-fast + ease-in */
const CARD_EXIT: Transition = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] };
/** duration-normal + ease-in — close the slot faster than its entrance. */
export const JIRA_CREATE_REMOVE_DURATION_S = 0.15;
const SLOT_EXIT: Transition = { duration: JIRA_CREATE_REMOVE_DURATION_S, ease: [0.6, 0, 0.8, 0.6] };
const REDUCED_ENTER: Transition = { duration: 0.15, ease: [0.4, 1, 0.6, 1] };
const REDUCED_INSTANT: Transition = { duration: 0 };

/**
 * Hidden scale for the whole card — the card grows into its slot from
 * noticeably smaller, never 0. Paired with the slot's `height: 0 -> auto`, this
 * reads as the card inflating into the gap it just made.
 */
export const JIRA_CREATE_HIDDEN_SCALE = 0.8;
/** duration-normal — gap between two arriving cards, not inner content. */
export const JIRA_CREATE_CARD_STAGGER_S = 0.15;

export const JIRA_CREATE_MOTION_STYLE: CSSProperties = {
	willChange: "transform, opacity",
};

export interface JiraCreateMotion {
	card: Variants;
}

export function getJiraCreateMotion(
	shouldReduceMotion: boolean | null,
	delayS = 0,
): JiraCreateMotion {
	if (shouldReduceMotion) {
		return {
			card: {
				hidden: { opacity: 0 },
				show: { opacity: 1, transition: REDUCED_ENTER },
				exit: { opacity: 0, transition: REDUCED_INSTANT },
			},
		};
	}

	return {
		card: {
			hidden: { opacity: 0, scale: JIRA_CREATE_HIDDEN_SCALE },
			show: {
				opacity: 1,
				scale: 1,
				transition: {
					...CARD_ENTER,
					delay: delayS,
					// A per-value override replaces the defaults for that value
					// outright, so the delay has to be repeated here.
					opacity: { ...CARD_ENTER_OPACITY, delay: delayS },
				},
			},
			exit: { opacity: 0, scale: JIRA_CREATE_HIDDEN_SCALE, transition: CARD_EXIT },
		},
	};
}

/**
 * The slot clips only while its own height animates (0 -> auto on insert, auto
 * -> 0 on removal). A moved card lands in a slot that is already full height
 * and only scales up to 1 inside it, so clipping there would just cut off the
 * surface's edge shadow: adjacent arrivals then read as one fused block until
 * the arrival ends and the shadows snap back.
 */
export function shouldClipJiraCreateSlot({ active, removing, reserveSlot }: Readonly<{
	active: boolean;
	removing: boolean;
	reserveSlot: boolean;
}>): boolean {
	return removing || (active && !reserveSlot);
}

export function getJiraCreateSlotTransition(
	shouldReduceMotion: boolean | null,
	delayS = 0,
): Transition {
	if (shouldReduceMotion) {
		return REDUCED_INSTANT;
	}

	return { ...CARD_ENTER, delay: delayS };
}

export function getJiraCreateRemovalTransition(shouldReduceMotion: boolean | null): Transition {
	return shouldReduceMotion ? REDUCED_INSTANT : SLOT_EXIT;
}

export function getJiraCreateLayoutTransition(
	shouldReduceMotion: boolean | null,
): Transition {
	if (shouldReduceMotion) {
		return REDUCED_INSTANT;
	}

	return CARD_ENTER;
}

/** Stagger between arriving cards only — never inside a card. */
export function getJiraCreateArrivalDelayS(
	cardCodes: readonly string[],
	cardCode: string,
): number {
	const index = cardCodes.indexOf(cardCode);
	return index > 0 ? index * JIRA_CREATE_CARD_STAGGER_S : 0;
}
