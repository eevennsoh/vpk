import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { JIRA_TEAM_EU26_END_KEYNOTE_STORIES } from "@/components/projects/jira-team-eu26-end/data/keynote-board";
import { JIRA_TEAM_EU26_END_PRESENTERS } from "@/components/projects/jira-team-eu26-end/data/keynote-presenters";

export type FinaleChapterId = "Context" | "Collaboration" | "Confidence";

export type FinalePresenterId = keyof typeof JIRA_TEAM_EU26_END_PRESENTERS;

export interface FinaleStory {
	readonly code: string;
	readonly index: number;
	readonly chapter: FinaleChapterId;
	/** Cover heading, one entry per rendered line. */
	readonly lines: readonly string[];
	readonly title: string;
	readonly apps: readonly TwgToolSource[];
	readonly presenter: FinalePresenterId;
}

export const FINALE_STORIES: readonly FinaleStory[] = JIRA_TEAM_EU26_END_KEYNOTE_STORIES.map((story, index) => ({
	code: story.code,
	index,
	chapter: story.section,
	lines: story.heading.split("\n"),
	title: story.title,
	apps: story.apps,
	presenter: story.assignee.id,
}));

export interface FinaleRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Clear space around the bento, in viewport px, whatever the screen's shape. */
export const FINALE_BENTO_MARGIN = 40;
/** Figma gutter at the 1920 stage; it scales with the type. */
const GUTTER = 40;
/** Short middle tiles as a share of a tall tile's height (Figma: 360 of 480). */
const SHORT_SHARE = 360 / 480;

export type FinaleSlotId = "a" | "b" | "c" | "d" | "e" | "f";

export interface FinaleSlot {
	readonly id: FinaleSlotId;
	/** Viewport px. */
	readonly rect: FinaleRect;
	/** The two middle tiles framing the title use the compact type size. */
	readonly short: boolean;
}

export const FINALE_SLOT_COUNT = 6;

export interface FinaleBentoLayout {
	/** In landing order: the first slot receives the hero, the first of `FINALE_FEATURES`. */
	readonly slots: readonly FinaleSlot[];
	readonly title: FinaleRect;
}

/**
 * Figma "Bento" (Founder Keynote, node 10774:6028), fitted to the actual
 * screen rather than letterboxed: three columns with tall tiles left and
 * right and two short tiles framing the title in the middle, 40px clear of
 * every edge.
 */
export function finaleBentoLayout(viewport: { readonly width: number; readonly height: number }, scale: number): FinaleBentoLayout {
	const margin = FINALE_BENTO_MARGIN;
	const gutter = GUTTER * scale;
	const columnWidth = (viewport.width - margin * 2 - gutter * 2) / 3;
	const tallHeight = (viewport.height - margin * 2 - gutter) / 2;
	const shortHeight = tallHeight * SHORT_SHARE;
	const columnX = (column: number) => margin + column * (columnWidth + gutter);
	const tall = (id: FinaleSlotId, column: number, row: number): FinaleSlot => ({
		id,
		rect: { x: columnX(column), y: margin + row * (tallHeight + gutter), width: columnWidth, height: tallHeight },
		short: false,
	});
	const short = (id: FinaleSlotId, y: number): FinaleSlot => ({ id, rect: { x: columnX(1), y, width: columnWidth, height: shortHeight }, short: true });
	return {
		slots: [
			tall("a", 0, 0),
			tall("e", 2, 0),
			short("c", margin),
			tall("b", 0, 1),
			tall("f", 2, 1),
			short("d", viewport.height - margin - shortHeight),
		],
		title: {
			x: columnX(1),
			y: margin + shortHeight + gutter,
			width: columnWidth,
			height: viewport.height - margin * 2 - shortHeight * 2 - gutter * 2,
		},
	};
}

/**
 * The bento's six features, each with its own face in the Figma bento, in
 * landing order (slots a, e, c, b, f, d): Agent Sessions top left, where the
 * camera dives, then Artifacts top right, Rovo Work Mode over the title, AI
 * Capital Management bottom left, Agent Effectiveness bottom right and
 * Record for Agent under the title. Each lands as the Done card of its
 * story, wherever MCB dragged it.
 */
export const FINALE_FEATURE_CODES = ["TEU-10", "TEU-4", "TEU-3", "TEU-12", "TEU-11", "TEU-106"] as const;

export type FinaleFeatureCode = (typeof FINALE_FEATURE_CODES)[number];

/** Whether a story is one of the bento's six, with a face of its own. */
export function isFinaleFeatureCode(code: string): code is FinaleFeatureCode {
	return FINALE_FEATURE_CODES.some((each) => each === code);
}

export const FINALE_FEATURES: readonly FinaleStory[] = FINALE_FEATURE_CODES.map((code) => {
	const story = FINALE_STORIES.find((each) => each.code === code);
	if (!story) throw new Error(`Finale feature ${code} is not a keynote story`);
	return story;
});
