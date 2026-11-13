"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

import { subscribeToVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";

/**
 * Scroll-mask plumbing for command-menu lists that hand-roll their row markup.
 * Spread `listProps` onto the list scroller and `menuProps` onto the menu root.
 */
export function useCommandMenuScrollMask(): {
	listProps: {
		ref: RefObject<HTMLDivElement | null>;
		style: CSSProperties;
	};
	menuProps: { "data-list-scrolled": "true" | undefined };
	remeasure: () => void;
} {
	const listRef = useRef<HTMLDivElement | null>(null);
	const [hasScrolledList, setHasScrolledList] = useState(false);

	const remeasure = useCallback(() => {
		const listElement = listRef.current;
		setHasScrolledList(Boolean(listElement && listElement.scrollTop > 0));
	}, []);
	useEffect(() => {
		const listElement = listRef.current;
		if (!listElement) return;
		return subscribeToVerticalOverflow(listElement, remeasure);
	}, [remeasure]);

	const listProps = useMemo(() => ({
		ref: listRef,
		style: buildScrollMaskStyle({
			fadeBottom: false,
			fadeTop: hasScrolledList,
			fadeSize: "var(--rich-text-command-menu-scroll-mask-fade-size)",
			scrollbarWidth: "var(--rich-text-command-menu-scrollbar-width)",
		}),
	}), [hasScrolledList]);
	const menuProps = useMemo(
		() => ({ "data-list-scrolled": hasScrolledList ? ("true" as const) : undefined }),
		[hasScrolledList],
	);

	return { listProps, menuProps, remeasure };
}
