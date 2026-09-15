"use client";

import { useCallback, useLayoutEffect, useState, type RefCallback } from "react";

/** Reserve the deck's scroll ending only when the session rows themselves overflow. */
export function useAgentSessionColumnEndSpace(
	enabled: boolean,
	items: readonly { id: string }[],
): { ref: RefCallback<HTMLDivElement>; showEndSpace: boolean } {
	const [port, setPort] = useState<HTMLDivElement | null>(null);
	const [showEndSpace, setShowEndSpace] = useState(false);
	const ref = useCallback<RefCallback<HTMLDivElement>>((node) => setPort(node), []);

	useLayoutEffect(() => {
		const rows = port?.querySelector(":scope > ul");
		if (!enabled || !port || !rows) {
			setShowEndSpace(false);
			return undefined;
		}

		const measure = () => {
			setShowEndSpace(rows.scrollHeight - port.clientHeight > 1);
		};
		measure();
		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(port);
		resizeObserver.observe(rows);
		return () => resizeObserver.disconnect();
	}, [enabled, items, port]);

	return { ref, showEndSpace };
}
