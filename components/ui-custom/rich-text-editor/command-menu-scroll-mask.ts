"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type RefCallback, type RefObject } from "react";

import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";

/**
 * Scroll-mask plumbing for command-menu lists that hand-roll their row markup.
 * Spread `listProps` onto the list scroller and `menuProps` onto the menu root.
 */
export function useCommandMenuScrollMask(): {
	listProps: {
		onScroll: () => void;
		ref: RefCallback<HTMLDivElement>;
		style: CSSProperties;
	};
	listRef: RefObject<HTMLDivElement | null>;
	menuProps: { "data-list-scrolled": "true" | undefined };
	remeasure: () => void;
} {
	const listRef = useRef<HTMLDivElement | null>(null);
	const [hasScrolledList, setHasScrolledList] = useState(false);

	const remeasure = useCallback(() => {
		const listElement = listRef.current;
		setHasScrolledList(Boolean(listElement && listElement.scrollTop > 0));
	}, []);
	const attachList = useCallback((element: HTMLDivElement | null) => {
		listRef.current = element;
		if (element) setHasScrolledList(element.scrollTop > 0);
	}, []);

	const listProps = useMemo(() => ({
		onScroll: remeasure,
		ref: attachList,
		style: buildScrollMaskStyle({
			fadeBottom: false,
			fadeTop: hasScrolledList,
			fadeSize: "var(--rich-text-command-menu-scroll-mask-fade-size)",
			scrollbarWidth: "var(--rich-text-command-menu-scrollbar-width)",
		}),
	}), [attachList, hasScrolledList, remeasure]);
	const menuProps = useMemo(
		() => ({ "data-list-scrolled": hasScrolledList ? ("true" as const) : undefined }),
		[hasScrolledList],
	);

	return { listProps, listRef, menuProps, remeasure };
}
