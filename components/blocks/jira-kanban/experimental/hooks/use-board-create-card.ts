import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export function useBoardCreateCard(onActiveChange?: (active: boolean) => void) {
	const [column, setColumn] = useState<string | null>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const triggerRef = useRef<HTMLElement | null>(null);
	const close = useCallback(() => {
		setColumn(null);
		onActiveChange?.(false);
		requestAnimationFrame(() => triggerRef.current?.focus());
	}, [onActiveChange]);
	const start = useCallback((title: string, trigger: HTMLElement) => {
		triggerRef.current = trigger;
		setColumn(title);
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
			scrollport.scrollTop = scrollport.scrollHeight;
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
	}, [column]);

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

	return { column, close, formRef, start };
}
