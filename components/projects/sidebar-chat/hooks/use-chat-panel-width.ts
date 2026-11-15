import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SendPromptOptions } from "@/app/contexts";
import { getSmartWidthClass } from "../lib/chat-panel-layout";

export interface ChatPanelWidth {
	containerWidthPx: number | null;
	panelRef: RefObject<HTMLDivElement | null>;
	resolvedSendPromptOptions: SendPromptOptions | undefined;
	viewportWidthPx: number | null;
}

/**
 * Measures the panel and the viewport, and stamps those widths onto smart
 * generation requests so generated UI fits the surface it lands in.
 */
export function useChatPanelWidth(sendPromptOptions: SendPromptOptions | undefined): ChatPanelWidth {
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [containerWidthPx, setContainerWidthPx] = useState<number | null>(null);
	const [viewportWidthPx, setViewportWidthPx] = useState<number | null>(null);

	useEffect(() => {
		const updateViewportWidth = () => {
			if (typeof window === "undefined") return;
			const width = Math.max(1, Math.round(window.innerWidth));
			setViewportWidthPx((prev) => (prev === width ? prev : width));
		};

		updateViewportWidth();
		window.addEventListener("resize", updateViewportWidth);
		return () => window.removeEventListener("resize", updateViewportWidth);
	}, []);

	useEffect(() => {
		const panelElement = panelRef.current;
		if (!panelElement) return;

		const updateContainerWidth = (widthValue: number) => {
			const width = Math.max(1, Math.round(widthValue));
			setContainerWidthPx((prev) => (prev === width ? prev : width));
		};

		updateContainerWidth(panelElement.getBoundingClientRect().width);

		if (typeof ResizeObserver !== "function") return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			updateContainerWidth(entry.contentRect.width);
		});

		observer.observe(panelElement);
		return () => observer.disconnect();
	}, []);

	const resolvedSendPromptOptions = useMemo(() => {
		if (!sendPromptOptions?.smartGeneration) return sendPromptOptions;

		const widthSource = containerWidthPx ?? viewportWidthPx;
		const widthClass = widthSource ? getSmartWidthClass(widthSource) : undefined;

		return {
			...sendPromptOptions,
			smartGeneration: {
				...sendPromptOptions.smartGeneration,
				containerWidthPx: containerWidthPx ?? undefined,
				viewportWidthPx: viewportWidthPx ?? undefined,
				widthClass,
			},
		};
	}, [containerWidthPx, sendPromptOptions, viewportWidthPx]);

	return { containerWidthPx, panelRef, resolvedSendPromptOptions, viewportWidthPx };
}
