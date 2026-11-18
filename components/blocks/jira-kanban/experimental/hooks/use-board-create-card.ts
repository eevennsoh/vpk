import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export function useBoardCreateCard(onActiveChange?: (active: boolean) => void) {
	const [target, setTarget] = useState<{ column: string; beforeCardCode?: string } | null>(null);
	const column = target?.column ?? null;
	const formRef = useRef<HTMLFormElement>(null);
	const triggerRef = useRef<HTMLElement | null>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const close = useCallback(() => {
		setTarget(null);
		onActiveChange?.(false);
		requestAnimationFrame(() => (triggerRef.current?.isConnected ? triggerRef.current : returnFocusRef.current)?.focus());
	}, [onActiveChange]);
	const start = useCallback((title: string, trigger: HTMLElement, beforeCardCode?: string, returnFocus?: HTMLElement | null) => {
		triggerRef.current = trigger;
		returnFocusRef.current = returnFocus ?? null;
		setTarget({ column: title, beforeCardCode });
		onActiveChange?.(true);
	}, [onActiveChange]);

	useLayoutEffect(() => {
		const card = formRef.current;
		const scrollport = card?.closest<HTMLElement>('[data-jira-kanban-card-list]');
		const gallery = card?.closest<HTMLElement>('[data-gallery-root]') ?? document.querySelector<HTMLElement>('[data-gallery-root]:has([data-gallery-strip])');
		const previousPadding = scrollport?.style.paddingBottom;
		const reveal = () => {
			if (!scrollport) return;
			const strip = gallery?.querySelector<HTMLElement>('[data-gallery-strip]');
			const overlap = strip ? Math.max(0, scrollport.getBoundingClientRect().bottom - strip.getBoundingClientRect().top) : 0;
			scrollport.style.paddingBottom = overlap ? `${overlap + 8}px` : previousPadding ?? "";
			if (target?.beforeCardCode) {
				const cardBounds = card?.getBoundingClientRect();
				const scrollBounds = scrollport.getBoundingClientRect();
				const visibleBottom = strip ? Math.min(scrollBounds.bottom, strip.getBoundingClientRect().top) : scrollBounds.bottom;
				if (cardBounds && cardBounds.bottom > visibleBottom) scrollport.scrollTop += cardBounds.bottom - visibleBottom + 8;
				else if (cardBounds && cardBounds.top < scrollBounds.top) scrollport.scrollTop -= scrollBounds.top - cardBounds.top + 8;
			} else {
				scrollport.scrollTop = scrollport.scrollHeight;
			}
		};
		const resize = new ResizeObserver(reveal);
		if (card) resize.observe(card);
		const mutations = new MutationObserver(reveal);
		if (gallery) mutations.observe(gallery, { childList: true });
		reveal();
		return () => {
			resize.disconnect();
			mutations.disconnect();
			if (scrollport) scrollport.style.paddingBottom = previousPadding ?? "";
		};
	}, [column, target?.beforeCardCode]);

	useEffect(() => () => onActiveChange?.(false), [onActiveChange]);
	useEffect(() => {
		if (column === null) return;
		const onOutsidePress = (event: PointerEvent) => {
			if (event.target instanceof Element && event.target.closest('[data-jira-inline-create], [data-slot="dropdown-menu-content"], [data-slot="popover-content"]')) return;
			event.preventDefault();
			event.stopPropagation();
			const suppressClick = (click: MouseEvent) => {
				click.preventDefault();
				click.stopImmediatePropagation();
				document.removeEventListener("click", suppressClick, true);
			};
			document.addEventListener("click", suppressClick, true);
			window.setTimeout(() => document.removeEventListener("click", suppressClick, true), 5000);
			close();
		};
		document.addEventListener("pointerdown", onOutsidePress, true);
		return () => document.removeEventListener("pointerdown", onOutsidePress, true);
	}, [column, close]);

	return { column, beforeCardCode: target?.beforeCardCode, close, formRef, start };
}
