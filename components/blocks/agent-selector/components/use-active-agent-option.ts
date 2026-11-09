"use client";

import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";

export function useActiveAgentOption(overflowRef: RefCallback<HTMLDivElement>, focusable = false) {
	const listRef = useRef<HTMLDivElement | null>(null);
	const [activeOptionId, setActiveOptionId] = useState<string | undefined>();
	const ref = useCallback((node: HTMLDivElement | null) => {
		listRef.current = node;
		if (node && focusable) node.tabIndex = 0;
		overflowRef(node);
	}, [focusable, overflowRef]);
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const sync = () => {
			const id = list.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.id || undefined;
			setActiveOptionId(id);
			if (focusable && id) list.setAttribute("aria-activedescendant", id);
			else list.removeAttribute("aria-activedescendant");
		};
		const observer = new MutationObserver(sync);
		observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "id"] });
		sync();
		return () => observer.disconnect();
	}, [focusable]);
	return { activeOptionId, ref };
}
