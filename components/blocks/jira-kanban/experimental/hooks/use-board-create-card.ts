import { useCallback, useEffect, useRef, useState } from "react";

export function useBoardCreateCard(onActiveChange?: (active: boolean) => void) {
	const [column, setColumn] = useState<string | null>(null);
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

	useEffect(() => () => onActiveChange?.(false), [onActiveChange]);
	useEffect(() => {
		if (column === null) return;
		const onOutsidePress = (event: PointerEvent) => {
			if (event.target instanceof Element && event.target.closest('[data-board-create-card], [data-slot="dropdown-menu-content"], [data-slot="popover-content"]')) return;
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

	return { column, close, start };
}
