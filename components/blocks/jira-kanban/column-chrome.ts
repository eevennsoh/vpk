import type { AgentSessionColumnFrame } from "@/components/blocks/agent-session-column/agent-session-column-frame";
import type { JiraIssueChrome } from "@/components/blocks/jira-issue/types";
import { token } from "@/lib/tokens";

/** Expanded status-column backdrop. The well recipe also names the implied issue card chrome. Not collapse. Not drag highlight. */
export type KanbanColumnChrome = "default" | "simple";

export const DEFAULT_KANBAN_COLUMN_CHROME: KanbanColumnChrome = "default";

/** The 2px transparent drop-shell border completes the 24px painted-surface gutter. */
export const KANBAN_WORK_ITEM_BOTTOM_PADDING = `calc(${token("space.300")} - 2px)`;

export const DEFAULT_KANBAN_DROP_ARMED_CLASS_NAME = "border-ring";
export const DEFAULT_KANBAN_DROP_IDLE_CLASS_NAME = "border-transparent";
export const DEFAULT_KANBAN_DROP_SHELL_CLASS_NAME = "border-2 border-transparent transition-colors";

export const SIMPLE_KANBAN_DROP_ARMED_CLASS_NAME = "outline-ring";
export const SIMPLE_KANBAN_DROP_IDLE_CLASS_NAME = "outline-transparent";

/**
 * Simple keeps the 2px transparent border for outer width, then paints the
 * drop ring as a 2px outline offset into the `gap-2` gutter so cards and the
 * caption never sit against it.
 *
 * Inner gap is 4px on every side so rest gutters stay close to `gap-2`.
 * Combined with the 2px border and 2px outline offset, the armed ring still
 * sits 8px off the cards. Do not grow `outline-offset` — the column gutter
 * is only 8px.
 */
export const SIMPLE_KANBAN_DROP_SHELL_CLASS_NAME = [
	"border-2 border-transparent",
	"outline-2 outline-offset-2 outline-transparent",
	"transition-[outline-color] duration-normal ease-out-practical",
	"motion-reduce:transition-none",
].join(" ");

/**
 * Extra scrollport padding so the 4px outward drop outline (2px stroke + 2px
 * offset) plus rounded corners clear an `overflow-y: hidden` clip. Larger than
 * the ring itself. Do not compensate with negative margin — that slides the
 * ring under the board header.
 */
export const SIMPLE_KANBAN_DROP_RING_CLIP_GUTTER = token("space.100");

/**
 * Always-on padding inside the expanded simple column. 4px on every side keeps
 * rest column gutters only slightly wider than `gap-2`, while the armed ring
 * still clears the cards (4px pad + 2px border + 2px offset).
 */
export const SIMPLE_KANBAN_DROP_CONTENT_INSET = token("space.050");

/**
 * Collapsed status-column paint and caption spacing. Framing lives on
 * `KanbanColumnChromeStyles.headerFrame`, not here — one board decision.
 */
export interface KanbanCollapsedChromeStyles {
	/** Default: `bg-surface-sunken`. Simple: `border border-border-disabled`. */
	readonly pillClassName: string;
	/**
	 * Caption only: space below the count row. `undefined` when enclosed —
	 * the gap is inside the pill, not a board-surface spacer.
	 */
	readonly captionPaddingBottom: string | undefined;
	/**
	 * Enclosed only: space above the count, matching the expanded well header.
	 * A collapsed Untracked rail sits beside expanded status columns, so this
	 * inset keeps both numbers on one row. `undefined` for caption.
	 */
	readonly countPaddingTop: string | undefined;
	readonly pillRadius: string;
	readonly pillPaddingBlock: string;
}

/**
 * Well recipe for an expanded BoardColumn.
 *
 * `default`: sunken fill plus the standard well's inner padding. Header lives
 * inside the painted object (`headerFrame: "enclosed"`). The transparent
 * 1px border matches Untracked's visible well stroke so both headers inset
 * the same amount and the counts share a row.
 * `simple`: no fill; inset slots stay unset. Header sits on the board
 * (`headerFrame: "caption"`).
 *
 * Header owns `paddingTop` and `paddingInline`. Default also sets
 * `paddingBottom` (4px). Boards supply a fallback `paddingBottom`.
 * `undefined` slots mean "do not set".
 */
export interface KanbanColumnChromeStyles {
	readonly columnClassName: string;
	readonly cardChrome: JiraIssueChrome;
	readonly headerFrame: AgentSessionColumnFrame;
	readonly header: {
		readonly paddingTop: string | undefined;
		readonly paddingInline: string | undefined;
		readonly paddingBottom?: string;
	};
	readonly cardList: {
		readonly paddingTop: string | undefined;
		readonly paddingBottom: string | undefined;
		readonly paddingInline: string | undefined;
		/** Default well: 4px stack. Omitted on simple so boards keep their own gap. */
		readonly gap?: string;
	};
	readonly footer: {
		readonly paddingInline: string | undefined;
	};
	/**
	 * Rest classes on the column drop shell, including the idle drop-ring
	 * color. Armed/idle tokens are toggled separately so Tailwind does not
	 * keep both colors in the class list.
	 */
	readonly dropShellClassName: string;
	readonly dropArmedClassName: string;
	readonly dropIdleClassName: string;
	/**
	 * Simple: extra scrollport padding so the outward drop outline clears the
	 * clip. Empty on default — that ring is an in-box border.
	 */
	readonly dropRingClipGutter: string;
	/**
	 * Simple: always-on padding on the expanded column. Empty on default.
	 */
	readonly dropContentPadding: {
		readonly paddingTop: string;
		readonly paddingInline: string;
		readonly paddingBottom: string;
	} | undefined;
	readonly collapsed: KanbanCollapsedChromeStyles;
}

const DEFAULT_KANBAN_COLLAPSED_CHROME_STYLES: KanbanCollapsedChromeStyles = Object.freeze({
	pillClassName: "bg-surface-sunken border border-solid border-transparent",
	captionPaddingBottom: undefined,
	countPaddingTop: token("space.100"),
	pillRadius: token("radius.large"),
	pillPaddingBlock: token("space.150"),
});

const SIMPLE_KANBAN_COLLAPSED_CHROME_STYLES: KanbanCollapsedChromeStyles = Object.freeze({
	pillClassName: "border border-border-disabled",
	captionPaddingBottom: token("space.100"),
	countPaddingTop: undefined,
	pillRadius: token("radius.large"),
	pillPaddingBlock: token("space.150"),
});

const DEFAULT_KANBAN_COLUMN_CHROME_STYLES: KanbanColumnChromeStyles = Object.freeze({
	columnClassName: "bg-surface-sunken border border-solid border-transparent",
	cardChrome: "raised",
	headerFrame: "enclosed",
	header: Object.freeze({
		paddingTop: token("space.100"),
		paddingInline: token("space.150"),
		paddingBottom: token("space.050"),
	}),
	cardList: Object.freeze({
		paddingTop: token("space.050"),
		paddingBottom: token("space.100"),
		paddingInline: token("space.050"),
		gap: token("space.050"),
	}),
	footer: Object.freeze({
		paddingInline: token("space.050"),
	}),
	dropShellClassName: DEFAULT_KANBAN_DROP_SHELL_CLASS_NAME,
	dropArmedClassName: DEFAULT_KANBAN_DROP_ARMED_CLASS_NAME,
	dropIdleClassName: DEFAULT_KANBAN_DROP_IDLE_CLASS_NAME,
	dropRingClipGutter: "",
	dropContentPadding: undefined,
	collapsed: DEFAULT_KANBAN_COLLAPSED_CHROME_STYLES,
});

const SIMPLE_KANBAN_COLUMN_CHROME_STYLES: KanbanColumnChromeStyles = Object.freeze({
	columnClassName: "",
	cardChrome: "stroke",
	headerFrame: "caption",
	header: Object.freeze({
		paddingTop: undefined,
		paddingInline: undefined,
	}),
	cardList: Object.freeze({
		paddingTop: undefined,
		paddingBottom: undefined,
		paddingInline: undefined,
	}),
	footer: Object.freeze({
		paddingInline: undefined,
	}),
	dropShellClassName: SIMPLE_KANBAN_DROP_SHELL_CLASS_NAME,
	dropArmedClassName: SIMPLE_KANBAN_DROP_ARMED_CLASS_NAME,
	dropIdleClassName: SIMPLE_KANBAN_DROP_IDLE_CLASS_NAME,
	dropRingClipGutter: SIMPLE_KANBAN_DROP_RING_CLIP_GUTTER,
	dropContentPadding: Object.freeze({
		paddingTop: SIMPLE_KANBAN_DROP_CONTENT_INSET,
		paddingInline: SIMPLE_KANBAN_DROP_CONTENT_INSET,
		paddingBottom: SIMPLE_KANBAN_DROP_CONTENT_INSET,
	}),
	collapsed: SIMPLE_KANBAN_COLLAPSED_CHROME_STYLES,
});

const KANBAN_COLUMN_CHROME_STYLES: Readonly<Record<KanbanColumnChrome, KanbanColumnChromeStyles>> = Object.freeze({
	default: DEFAULT_KANBAN_COLUMN_CHROME_STYLES,
	simple: SIMPLE_KANBAN_COLUMN_CHROME_STYLES,
});

export function resolveKanbanColumnChrome(
	chrome?: KanbanColumnChrome,
): KanbanColumnChromeStyles {
	return KANBAN_COLUMN_CHROME_STYLES[chrome ?? DEFAULT_KANBAN_COLUMN_CHROME];
}

export function setKanbanColumnDropArmed(
	element: Pick<HTMLElement, "classList">,
	chrome: Pick<KanbanColumnChromeStyles, "dropArmedClassName" | "dropIdleClassName">,
	armed: boolean,
): void {
	element.classList.toggle(chrome.dropArmedClassName, armed);
	element.classList.toggle(chrome.dropIdleClassName, !armed);
}

function cssLength(value: string | number | undefined): string {
	if (value === 0 || value == null || value === "") {
		return "0px";
	}
	if (typeof value === "number") {
		return `${value}px`;
	}
	return value;
}

function withPaddingTopAdditions(
	paddingTop: string | number | undefined,
	additions: ReadonlyArray<string>,
): { readonly paddingTop: string | number | undefined } {
	const extras = additions.filter(Boolean);
	if (extras.length === 0) {
		return { paddingTop };
	}
	return {
		paddingTop: `calc(${cssLength(paddingTop)} + ${extras.join(" + ")})`,
	};
}

export function withKanbanDropRingClipGutter(
	paddingTop: string | number | undefined,
	chrome: Pick<KanbanColumnChromeStyles, "dropRingClipGutter">,
): { readonly paddingTop: string | number | undefined } {
	return withPaddingTopAdditions(paddingTop, [chrome.dropRingClipGutter]);
}

/**
 * Untracked sits beside status columns and has its own 2px border. Add the
 * clip gutter (to match the scrollport) plus the content inset (to match the
 * expanded BoardColumn padding) so captions stay on one row.
 */
export function withKanbanDropContentGutter(
	paddingTop: string | number | undefined,
	chrome: Pick<KanbanColumnChromeStyles, "dropContentPadding" | "dropRingClipGutter">,
): { readonly paddingTop: string | number | undefined } {
	return withPaddingTopAdditions(paddingTop, [
		chrome.dropRingClipGutter,
		chrome.dropContentPadding?.paddingTop ?? "",
	]);
}
