import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import {
	JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES,
	JIRA_TEAM_EU26_END_KEYNOTE_STORIES,
} from "@/components/projects/jira-team-eu26-end/data/keynote-board";
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
	code: JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES[index],
	index,
	chapter: story.section,
	lines: story.heading.split("\n"),
	title: story.title,
	apps: story.apps,
	presenter: story.assignee.id as FinalePresenterId,
}));

export interface FinaleRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Clear space around the bento, in viewport px, whatever the screen's shape. */
export const FINALE_BENTO_MARGIN = 60;
/** Figma gutter at the 1920 stage; it scales with the type. */
const GUTTER = 16;
/** Short middle tiles as a share of a tall tile's height (Figma: 305 of 468). */
const SHORT_SHARE = 305 / 468;

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
	/** In landing order: the first slot receives the first card MCB dragged into Done. */
	readonly slots: readonly FinaleSlot[];
	readonly title: FinaleRect;
}

/**
 * Figma "Bento - with title", fitted to the actual screen rather than
 * letterboxed: three columns with tall tiles left and right and two short
 * tiles framing the title in the middle, 60px clear of every edge.
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

/** The bento always closes on Jira's own story… */
export const FINALE_PINNED_FEATURE = "TEU-10"; // Jira Agent Sessions
/** …which takes Rovo Artifacts' place: that story is never a tile. */
export const FINALE_RETIRED_FEATURE = "TEU-4"; // Rovo Artifacts

/**
 * Bento features follow MCB's drag order: the first cards he moved into Done
 * fill the slots in landing order, with Jira Agent Sessions standing in for
 * Rovo Artifacts wherever that was dragged — and guaranteed a slot if it
 * would otherwise miss the cut. Keynote stories that were never dragged
 * (rehearsal) top the list up in board order.
 */
export function selectFinaleFeatures(dragOrder: readonly string[]): readonly FinaleStory[] {
	const known = new Map(FINALE_STORIES.map((story) => [story.code, story]));
	const ordered = [...dragOrder, ...FINALE_STORIES.map((story) => story.code)]
		.map((code) => (code === FINALE_RETIRED_FEATURE ? FINALE_PINNED_FEATURE : code));
	const picked: FinaleStory[] = [];
	for (const code of ordered) {
		const story = known.get(code);
		if (!story || picked.includes(story)) continue;
		picked.push(story);
		if (picked.length === FINALE_SLOT_COUNT) break;
	}
	const pinned = known.get(FINALE_PINNED_FEATURE);
	if (pinned && !picked.includes(pinned)) picked[picked.length - 1] = pinned;
	return picked;
}
