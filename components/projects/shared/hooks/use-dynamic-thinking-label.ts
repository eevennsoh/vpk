"use client";

import { useEffect, useState } from "react";
import { getDefaultThinkingLabel } from "@/components/ui-custom/lib/reasoning-labels";

export const THINKING_FALLBACK_LABEL = getDefaultThinkingLabel();
export const THINKING_FALLBACK_TIMEOUT_MS = 5_000;

interface UseDynamicThinkingLabelOptions {
	baseLabel: string;
	isStreaming: boolean;
	updateSignal: string;
	fallbackLabel?: string;
	staleAfterMs?: number;
}

export function useDynamicThinkingLabel({
	baseLabel,
	isStreaming,
	updateSignal,
	fallbackLabel = THINKING_FALLBACK_LABEL,
	staleAfterMs = THINKING_FALLBACK_TIMEOUT_MS,
}: Readonly<UseDynamicThinkingLabelOptions>): {
	label: string;
	isFallbackActive: boolean;
} {
	const [isFallbackActive, setIsFallbackActive] = useState(false);

	useEffect(() => {
		const clearFallbackTimer = setTimeout(() => {
			setIsFallbackActive(false);
		}, 0);
		if (!isStreaming) {
			return () => {
				clearTimeout(clearFallbackTimer);
			};
		}

		const activateFallbackTimer = setTimeout(() => {
			setIsFallbackActive(true);
		}, staleAfterMs);
		return () => {
			clearTimeout(clearFallbackTimer);
			clearTimeout(activateFallbackTimer);
		};
	}, [isStreaming, staleAfterMs, updateSignal]);

	return {
		label: isFallbackActive ? fallbackLabel : baseLabel,
		isFallbackActive: isStreaming && isFallbackActive,
	};
}
