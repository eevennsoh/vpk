"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import { findLatestMediaLoadingState } from "@/app/contexts/rovo-chat-media-state";

export const MEDIA_GENERATION_TIMEOUT_MS = 120_000;

/**
 * Tracks media generation (image, audio, video) from the data-widget-loading
 * parts on the latest assistant message, independently of the SSE stream. If
 * the stream drops before the backend sends loading:false, the flag keeps a
 * failed turn from finalizing, so the next prompt does not go out early, until
 * the timeout releases it. `onSettled` runs whenever generation ends by itself.
 */
export function useRovoChatMediaGeneration(
	messages: ReadonlyArray<RovoUIMessage>,
	onSettled: () => void,
) {
	const [isMediaGenerating, setIsMediaGenerating] = useState(false);
	const isMediaGeneratingRef = useRef(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearMediaGenerating = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		if (isMediaGeneratingRef.current) {
			isMediaGeneratingRef.current = false;
			setIsMediaGenerating(false);
		}
	}, []);

	useEffect(() => clearMediaGenerating, [clearMediaGenerating]);

	const scheduleTimeout = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			timeoutRef.current = null;
			if (isMediaGeneratingRef.current) {
				isMediaGeneratingRef.current = false;
				setIsMediaGenerating(false);
				onSettled();
			}
		}, MEDIA_GENERATION_TIMEOUT_MS);
	}, [onSettled]);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Media generation is driven by streamed backend data parts and timeout cleanup, not render-only derivation.
	// oxlint-disable react-doctor/no-derived-state -- The timeout fallback needs local media state after the latest loading part stops changing.
	useEffect(() => {
		const latestMediaLoading = findLatestMediaLoadingState(messages);
		if (latestMediaLoading === true && !isMediaGeneratingRef.current) {
			isMediaGeneratingRef.current = true;
			setIsMediaGenerating(true);
			scheduleTimeout();
		} else if (latestMediaLoading === false && isMediaGeneratingRef.current) {
			clearMediaGenerating();
			onSettled();
		}
	}, [messages, onSettled, clearMediaGenerating, scheduleTimeout]);
	// oxlint-enable react-doctor/no-derived-state
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	return { isMediaGenerating, isMediaGeneratingRef, clearMediaGenerating };
}
