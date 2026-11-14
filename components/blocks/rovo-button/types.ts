import type { ReactNode } from "react";

export type Product = "admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio";
export type FloatingRovoButtonOnboardingStatus = "idle" | "creating" | "created";

export interface FloatingRovoButtonSuggestion {
	id: string;
	label: string;
	icon?: ReactNode;
	ariaLabel?: string;
	onSelect: () => void;
	onDismiss?: () => void;
}

export interface FloatingRovoButtonPersistentBarItem {
	id: string;
	icon: ReactNode;
	ariaLabel: string;
	tooltipLabel?: string;
	onClick?: () => void;
	indicator?: boolean;
}

export type FloatingRovoButtonPersistentBarSide = "auto" | "top" | "bottom";

export interface FloatingRovoButtonPersistentBar {
	items: FloatingRovoButtonPersistentBarItem[];
	/**
	 * Which edge of the button the bar attaches to. `"auto"` (default) places it
	 * above the button when the button sits in the lower half of its space and
	 * below it otherwise, so the bar always opens toward open space.
	 */
	side?: FloatingRovoButtonPersistentBarSide;
	ariaLabel?: string;
}

export interface FloatingRovoButtonOnboardingConfig {
	id: string;
	title: string;
	agentName: string;
	byline: string;
	description: string;
	prompt: string;
	primaryActionLabel: string;
	secondaryActionLabel: string;
	avatarSrc?: string;
	avatarAlt?: string;
	coverSrc?: string;
	coverBackgroundColor?: string;
	closeLabel?: string;
	status?: FloatingRovoButtonOnboardingStatus;
	statusLabel?: string;
	primaryActionDisabled?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	openOnButtonClick?: boolean;
	onOpenChange?: (open: boolean) => void;
	onPrimaryAction?: () => void;
	onSecondaryAction?: () => void;
}

/**
 * How much of the daily-insights affordance is showing.
 *
 * The three stages are one continuous object, not three components: the 48px
 * button grows into a pill, and the pill grows into the card. `"hidden"` means
 * there is nothing new to announce and the button behaves like a plain chat
 * launcher.
 */
export type FloatingRovoButtonInsightsStage = "hidden" | "pill" | "card";

/**
 * One insight previewed inside the card.
 *
 * `title` is a full declarative sentence ("We agreed to delete the adapter, not
 * wrap it"), so the card clamps it to two lines rather than assuming it is
 * short. `chapterLabel` and `timeLabel` sit under it as a single byline —
 * these are moments in a week, and the temporal framing is the whole premise of
 * "since your last visit".
 */
export interface FloatingRovoButtonInsightRow {
	id: string;
	/** Short chapter name, e.g. `"Night shift"`. */
	chapterLabel: string;
	/** Clock label, e.g. `"15:20"`. */
	timeLabel: string;
	/** Full sentence; the card clamps it to two lines. */
	title: string;
	/** Deep-links to this specific insight. */
	onSelect?: () => void;
}

/**
 * The "N new insights since your last visit" affordance.
 *
 * Mutually exclusive with `onboarding` — both morph the same surface, so a
 * consumer must not configure both at once.
 *
 * Two rules the copy and behavior depend on:
 *
 * - **`count` is the total, `rows` is what fits.** `count` drives the pill copy
 *   and the card heading; `rows` is capped (three) and `overflowCount` carries
 *   the remainder. Never derive the headline number from `rows.length`.
 * - **Dismissing marks nothing read.** `onDismiss` collapses the affordance and
 *   lets the button revert to chat, but the unread count stays put. Only the
 *   primary action opens the destination and advances the watermark.
 */
export interface FloatingRovoButtonInsightsConfig {
	/** Changing this resets the uncontrolled stage back to `defaultStage`. */
	id: string;
	/** Every unviewed insight, including ones that did not fit in `rows`. */
	count: number;
	/** Oldest → newest, so the reader moves forward through the week. */
	rows: readonly FloatingRovoButtonInsightRow[];
	/** How many unviewed insights did not fit into `rows`. Defaults to `0`. */
	overflowCount?: number;
	/** Where the insights came from, e.g. `"Jira Design"`. */
	spaceName?: string;
	/** Defaults to `"Open insights"`. */
	primaryActionLabel?: string;
	/** Defaults to `"Ask Rovo"`. */
	secondaryActionLabel?: string;
	/** Defaults to `"Dismiss insights"`. */
	closeLabel?: string;
	/** Controlled stage. Omit to let the component own it. */
	stage?: FloatingRovoButtonInsightsStage;
	/** Uncontrolled starting stage. Defaults to `"pill"` when `count > 0`. */
	defaultStage?: FloatingRovoButtonInsightsStage;
	onStageChange?: (stage: FloatingRovoButtonInsightsStage) => void;
	/** Opens the destination at the oldest unread insight. */
	onPrimaryAction?: () => void;
	/** Falls back to opening chat when omitted. */
	onSecondaryAction?: () => void;
	/** Collapses the affordance without marking anything read. */
	onDismiss?: () => void;
}

export interface FloatingRovoButtonPlacement {
	right?: string;
	bottom?: string;
}

export type FloatingRovoButtonPositioning = "viewport" | "container";

export interface FloatingRovoButtonProps {
	product: Product;
	embedded?: boolean;
	forceVisible?: boolean;
	ariaLabel?: string;
	placement?: FloatingRovoButtonPlacement;
	positioning?: FloatingRovoButtonPositioning;
	onButtonClick?: () => void;
	suggestion?: FloatingRovoButtonSuggestion | null;
	onboarding?: FloatingRovoButtonOnboardingConfig | null;
	/** Mutually exclusive with `onboarding`; both morph the same surface. */
	insights?: FloatingRovoButtonInsightsConfig | null;
	persistentBar?: FloatingRovoButtonPersistentBar | null;
}
