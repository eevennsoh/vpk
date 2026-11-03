"use client";

import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";

export function useActiveAgentOption(overflowRef: RefCallback<HTMLDivElement>) {
	const listRef = useRef<HTMLDivElement | null>(null);
	const [activeOptionId, setActiveOptionId] = useState<string | undefined>();
	const ref = useCallback((node: HTMLDivElement | null) => {
		listRef.current = node;
		overflowRef(node);
	}, [overflowRef]);
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const sync = () => setActiveOptionId(list.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.id || undefined);
		const observer = new MutationObserver(sync);
		observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "id"] });
		sync();
		return () => observer.disconnect();
	}, []);
	return { activeOptionId, ref };
}
