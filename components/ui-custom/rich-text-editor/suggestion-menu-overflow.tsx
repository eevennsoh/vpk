import type { ReactNode } from "react";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import type { RichTextSuggestionMenuItem } from "./suggestion-menu-types";

/** Synthetic overflow rows that cap a flat / search / sparkle section. */
export type SuggestionOverflowFooterKind = "browse-all" | "view-more" | "view-less";

const OVERFLOW_FOOTER_LABELS = {
	"browse-all": "Browse all",
	"view-more": "View more",
	"view-less": "View less",
} as const;

function getOverflowFooterIcon(kind: SuggestionOverflowFooterKind): ReactNode {
	switch (kind) {
		case "browse-all":
			return <ShowMoreHorizontalIcon label="" size="small" />;
		case "view-more":
			return <ChevronDownIcon label="" size="small" />;
		case "view-less":
			return <ChevronUpIcon label="" size="small" />;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/**
 * Shared "Browse all" / "View more" / "View less" row. Always uses the
 * transparent IconTile so overflow glyphs never pick up the grey fallback tile.
 */
export function getSuggestionOverflowFooterItem(
	id: string,
	kind: SuggestionOverflowFooterKind,
	options?: Readonly<{ isSticky?: boolean }>,
): RichTextSuggestionMenuItem {
	return {
		id,
		label: OVERFLOW_FOOTER_LABELS[kind],
		icon: getOverflowFooterIcon(kind),
		iconTileVariant: "transparent",
		isSticky: options?.isSticky,
	};
}

export function isOverflowFooterLabel(label: string): boolean {
	return (
		label === OVERFLOW_FOOTER_LABELS["browse-all"]
		|| label === OVERFLOW_FOOTER_LABELS["view-more"]
		|| label === OVERFLOW_FOOTER_LABELS["view-less"]
	);
}
