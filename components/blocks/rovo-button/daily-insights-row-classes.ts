/**
 * Row class assignments, named so the truncation contract can be asserted
 * without a browser. Same idiom as Pulse's own `PROJECT_LABEL`
 * (components/blocks/jira-kanban/experimental/pulse/experimental-pulse.tsx:79).
 *
 * The contract: in a flex row with truncating text, exactly one segment absorbs
 * the overflow and every other segment holds its size. Here the chapter label
 * is that segment. The separator, the time label, and the chevron are fixed, and
 * every wrapper between the row and the chapter label has to be able to shrink —
 * a flex item's default `min-width: auto` refuses to go below its content, so a
 * missing `min-w-0` anywhere in that chain pushes the time label out of the row
 * and knocks the chevron out of its column instead of ellipsizing the chapter.
 *
 * This matters more since the meta line became an uppercase tracked eyebrow:
 * `uppercase` plus `tracking-[0.12em]` is materially wider than sentence case,
 * so chapter names that used to fit now truncate. Truncating is the intended
 * outcome; losing the time or the chevron is not.
 */
export const DAILY_INSIGHTS_ROW_CLASSES = {
	/** Wrappers between the row and the chapter label. All must shrink. */
	body: "flex min-w-0 items-center gap-2 px-4 py-3 text-left",
	textColumn: "flex min-w-0 flex-1 flex-col gap-0.5",
	metaLine: "flex min-w-0 items-center gap-1 text-xs leading-4 font-semibold tracking-[0.12em] uppercase text-text-subtle",
	/** The one segment allowed to absorb overflow. */
	chapterLabel: "min-w-0 truncate",
	/** Fixed metadata: these hold their width so the chapter owns the ellipsis. */
	metaSeparator: "shrink-0",
	timeLabel: "shrink-0",
	chevron: "flex shrink-0 items-center text-text-subtlest transition-colors duration-normal ease-out group-hover:text-text motion-reduce:transition-none",
	title: "line-clamp-2 text-base leading-6 text-pretty text-text",
} as const;

/** Wrapper keys that sit between the row and the chapter label. */
export const DAILY_INSIGHTS_ROW_SHRINKABLE_WRAPPERS = ["body", "textColumn", "metaLine"] as const;

/** Segment keys that must hold their width when the chapter label is long. */
export const DAILY_INSIGHTS_ROW_FIXED_SEGMENTS = ["metaSeparator", "timeLabel", "chevron"] as const;
