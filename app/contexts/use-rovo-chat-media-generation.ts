"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import { findLatestMediaLoadingState } from "@/app/contexts/rovo-chat-media-state";

export const MEDIA_GENERATION_TIMEOUT_MS = 120_000;

/**
 * How long a cut-short turn (its stream closed without turn-complete) still
 * waits for a media widget that is loading before the turn finalizes with the
 * cut-short notice. The widget's loading:false would have come on the closed
 * stream, so it cannot arrive now; the wait only gives the transcript a moment
 * to settle. Provisional: the owner may change this value.
 */
export const CUT_SHORT_MEDIA_WAIT_MS = 5_000;

/**
 * Tracks media generation (image, audio, video) from the data-widget-loading
 * parts on the current turn's latest assistant message (see
 * findLatestMediaLoadingState), independently of the SSE stream. If
 * the stream drops before the backend sends loading:false, the flag keeps a
 * failed turn from finalizing, so the next prompt does not go out early, until
 * the timeout releases it. `onSettled` runs whenever generation ends by itself.
 * `shortenMediaWait` brings that release forward (never later), for a turn
 * already known to be cut short.
 */
export function useRovoChatMediaGeneration(
	messages: ReadonlyArray<RovoUIMessage>,
	activePromptId: string | null,
	onSettled: () => void,
) {
	const [isMediaGenerating, setIsMediaGenerating] = useState(false);
	const isMediaGeneratingRef = useRef(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const timeoutDeadlineRef = useRef<number | null>(null);

	const clearMediaGenerating = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		timeoutDeadlineRef.current = null;
		if (isMediaGeneratingRef.current) {
			isMediaGeneratingRef.current = false;
			setIsMediaGenerating(false);
		}
	}, []);

	useEffect(() => clearMediaGenerating, [clearMediaGenerating]);

	const scheduleTimeout = useCallback((delayMs: number) => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
		}
		timeoutDeadlineRef.current = Date.now() + delayMs;
		timeoutRef.current = setTimeout(() => {
			timeoutRef.current = null;
			timeoutDeadlineRef.current = null;
			if (isMediaGeneratingRef.current) {
				isMediaGeneratingRef.current = false;
				setIsMediaGenerating(false);
				onSettled();
			}
		}, delayMs);
	}, [onSettled]);

	const shortenMediaWait = useCallback((delayMs: number) => {
		const deadline = timeoutDeadlineRef.current;
		if (!isMediaGeneratingRef.current || deadline === null || deadline <= Date.now() + delayMs) {
			return;
		}
		scheduleTimeout(delayMs);
	}, [scheduleTimeout]);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Media generation is driven by streamed backend data parts and timeout cleanup, not render-only derivation.
	// oxlint-disable react-doctor/no-derived-state -- The timeout fallback needs local media state after the latest loading part stops changing.
	useEffect(() => {
		const latestMediaLoading = findLatestMediaLoadingState(messages, activePromptId);
		if (latestMediaLoading === true && !isMediaGeneratingRef.current) {
			isMediaGeneratingRef.current = true;
			setIsMediaGenerating(true);
			scheduleTimeout(MEDIA_GENERATION_TIMEOUT_MS);
		} else if (latestMediaLoading === false && isMediaGeneratingRef.current) {
			clearMediaGenerating();
			onSettled();
		}
	}, [messages, activePromptId, onSettled, clearMediaGenerating, scheduleTimeout]);
	// oxlint-enable react-doctor/no-derived-state
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	return { isMediaGenerating, isMediaGeneratingRef, clearMediaGenerating, shortenMediaWait };
}
