import type {
	FloatingRovoButtonInsightRow,
	FloatingRovoButtonInsightsStage,
} from "@/components/blocks/rovo-button";

/** The row content only — `onSelect` is attached by the hook that owns the state. */
export type RovoButtonDemoInsightRow = Omit<FloatingRovoButtonInsightRow, "onSelect">;

/**
 * Oldest → newest, so the reader moves forward through the day.
 *
 * Modelled on real board copy: full declarative sentences, with the chapter and
 * clock label carrying the "since your last visit" framing.
 */
export const ROVO_BUTTON_DEMO_INSIGHT_ROWS: readonly RovoButtonDemoInsightRow[] = [
	{
		id: "rovo-button-insight-nightly-run",
		chapterLabel: "Night shift",
		timeLabel: "02:15",
		title: "The nightly run went green after the retry fix",
	},
	{
		id: "rovo-button-insight-adapter-decision",
		chapterLabel: "Design sync",
		timeLabel: "09:40",
		title: "We agreed to delete the adapter, not wrap it",
	},
	{
		id: "rovo-button-insight-payments-rollout",
		chapterLabel: "Release review",
		timeLabel: "15:20",
		title: "Payments v2 rollout is gated on one kill switch",
	},
];

/**
 * Total unviewed insights, including the ones that did not fit into
 * `ROVO_BUTTON_DEMO_INSIGHT_ROWS`. Deliberately larger than the row count so the
 * showcase exercises the card's overflow branch — with a remainder the primary
 * action reads "Open all 7 insights", without one it reads "Open insights".
 */
export const ROVO_BUTTON_DEMO_INSIGHT_TOTAL_COUNT = 7;

export interface RovoButtonDemoInsightsState {
	stage: FloatingRovoButtonInsightsStage;
	/** Rows the reader deep-linked into; each one advances the watermark by one. */
	readRowIds: readonly string[];
	/** Set once the primary action opened the destination and read everything. */
	isWatermarkAdvanced: boolean;
}

export type RovoButtonDemoInsightsAction =
	| { type: "stage-change"; stage: FloatingRovoButtonInsightsStage }
	| { type: "dismiss" }
	| { type: "open-all" }
	| { type: "select-row"; rowId: string };

export const ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE: RovoButtonDemoInsightsState = {
	stage: "pill",
	readRowIds: [],
	isWatermarkAdvanced: false,
};

/**
 * Dismissing collapses the affordance but reads nothing — only `open-all` and
 * `select-row` move the watermark. Keeping that split in one pure function is
 * the whole point of the reducer.
 *
 * **The showcase deliberately diverges from the product here.** In the product
 * (see the board's config), dismissing takes the stage to `"hidden"` and the
 * button reverts to a plain chat launcher, because a nudge you waved away
 * should stop asking. On this page the button exists to *demonstrate* the
 * insights affordance, so `dismiss` and `select-row` fall back to `"pill"`
 * instead: the card closes, the pill stays, and the next click reopens it.
 * Otherwise the demo dead-ends on the first dismissal and only a reload brings
 * it back.
 *
 * `open-all` still lands on `"hidden"` — it advances the watermark to zero, and
 * a pill advertising nothing would be a lie rather than a demo.
 */
export function reduceRovoButtonDemoInsights(
	state: RovoButtonDemoInsightsState,
	action: RovoButtonDemoInsightsAction,
): RovoButtonDemoInsightsState {
	if (action.type === "stage-change") {
		return state.stage === action.stage ? state : { ...state, stage: action.stage };
	}

	if (action.type === "dismiss") {
		return { ...state, stage: "pill" };
	}

	if (action.type === "open-all") {
		return {
			stage: "hidden",
			readRowIds: ROVO_BUTTON_DEMO_INSIGHT_ROWS.map((row) => row.id),
			isWatermarkAdvanced: true,
		};
	}

	if (state.readRowIds.includes(action.rowId)) {
		return { ...state, stage: "pill" };
	}

	return { ...state, stage: "pill", readRowIds: [...state.readRowIds, action.rowId] };
}

/** The headline number. Never derived from the visible rows. */
export function selectRovoButtonDemoInsightsCount(state: RovoButtonDemoInsightsState): number {
	if (state.isWatermarkAdvanced) {
		return 0;
	}

	return ROVO_BUTTON_DEMO_INSIGHT_TOTAL_COUNT - state.readRowIds.length;
}

export function selectRovoButtonDemoInsightsRows(
	state: RovoButtonDemoInsightsState,
): readonly RovoButtonDemoInsightRow[] {
	return ROVO_BUTTON_DEMO_INSIGHT_ROWS.filter((row) => !state.readRowIds.includes(row.id));
}

export function selectRovoButtonDemoInsightsOverflowCount(state: RovoButtonDemoInsightsState): number {
	const remainder =
		selectRovoButtonDemoInsightsCount(state) - selectRovoButtonDemoInsightsRows(state).length;

	return Math.max(0, remainder);
}
