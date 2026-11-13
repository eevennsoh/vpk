"use client";

import { useEffect, useReducer } from "react";

import {
	createReasoningPhaseState,
	reasoningPhaseReducer,
	selectReasoningPhase,
	type ReasoningPhase,
} from "./reasoning-phase-machine";

export type { ReasoningPhase } from "./reasoning-phase-machine";

const THINKING_GRADIENT_COLORS = ["#1868db", "#bf63f3", "#fca700"] as const;
const MS_IN_S = 1000;
const DEFAULT_AUTO_IDLE_DELAY_MS = 3000;
const DEFAULT_MIN_PRELOAD_MS = 0;

interface UseReasoningPhaseOptions {
	isStreaming: boolean;
	hasMessageText: boolean;
	responseKey: string;
	autoIdle?: boolean;
	autoIdleDelayMs?: number;
	minPreloadMs?: number;
	persistedStartTime?: string;
	persistedEndTime?: string;
}

interface UseReasoningPhaseResult {
	phase: ReasoningPhase;
	duration: number | undefined;
}

function getTimestampMs(value: string | undefined): number | null {
	if (typeof value !== "string") {
		return null;
	}

	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function getPersistedReasoningDuration(
	startTime: string | undefined,
	endTime: string | undefined
): number | undefined {
	const startMs = getTimestampMs(startTime);
	const endMs = getTimestampMs(endTime);
	if (startMs === null || endMs === null || endMs < startMs) {
		return undefined;
	}

	return Math.ceil((endMs - startMs) / MS_IN_S);
}

/**
 * Tracks the reasoning lifecycle through four phases:
 * preload → thinking → completed → idle.
 *
 * The lifecycle lives in `reasoning-phase-machine.ts`. Input changes, the auto-idle delay
 * and the minimum preload hold each arrive as one event.
 */
export function useReasoningPhase({
	isStreaming,
	hasMessageText,
	responseKey,
	autoIdle = false,
	autoIdleDelayMs = DEFAULT_AUTO_IDLE_DELAY_MS,
	minPreloadMs = DEFAULT_MIN_PRELOAD_MS,
	persistedStartTime,
	persistedEndTime,
}: Readonly<UseReasoningPhaseOptions>): UseReasoningPhaseResult {
	const persistedStartMs = getTimestampMs(persistedStartTime);
	const persistedDuration = getPersistedReasoningDuration(
		persistedStartTime,
		persistedEndTime
	);
	const [state, dispatch] = useReducer(
		reasoningPhaseReducer,
		{ isStreaming, minPreloadMs, persistedDuration, persistedStartMs, responseKey },
		createReasoningPhaseState,
	);

	useEffect(() => {
		dispatch({
			type: "sync",
			input: { isStreaming, minPreloadMs, persistedDuration, persistedStartMs, responseKey },
			now: Date.now(),
		});
	}, [isStreaming, minPreloadMs, persistedDuration, persistedStartMs, responseKey]);

	const isCompleted = state.lifecycle.kind === "completed";
	useEffect(() => {
		if (!isCompleted || !autoIdle) return undefined;
		const timer = setTimeout(() => dispatch({ type: "auto-idle" }), autoIdleDelayMs);
		return () => clearTimeout(timer);
	}, [autoIdle, autoIdleDelayMs, isCompleted]);

	const preloadHoldMs = state.preload.locked ? state.preload.holdMs : null;
	const preloadGeneration = state.preload.generation;
	useEffect(() => {
		if (preloadHoldMs === null) return undefined;
		const timer = setTimeout(
			() => dispatch({ type: "preload-elapsed", generation: preloadGeneration }),
			preloadHoldMs,
		);
		return () => clearTimeout(timer);
	}, [preloadGeneration, preloadHoldMs]);

	return {
		phase: selectReasoningPhase(state, { hasMessageText, isStreaming }),
		duration: state.duration,
	};
}

export interface ReasoningPhaseProps {
	isStreaming: boolean;
	streamingWave: boolean;
	streamingWaveGradientColor: readonly string[] | undefined;
	animatedDots: boolean;
	duration: number | undefined;
	defaultOpen: boolean | undefined;
	triggerStreaming: boolean | undefined;
}

export function getReasoningPropsForPhase(
	phase: ReasoningPhase,
	duration: number | undefined,
	hasDetails: boolean
): ReasoningPhaseProps {
	switch (phase) {
		case "preload":
			return {
				isStreaming: true,
				streamingWave: true,
				streamingWaveGradientColor: THINKING_GRADIENT_COLORS,
				animatedDots: false,
				duration: undefined,
				defaultOpen: hasDetails ? true : undefined,
				triggerStreaming: undefined,
			};
		case "thinking":
			// Thinking variant contract: calm trigger icon + animated dots.
			// Keep shimmer disabled here (preload-only).
			return {
				isStreaming: true,
				streamingWave: false,
				streamingWaveGradientColor: undefined,
				animatedDots: true,
				duration: undefined,
				defaultOpen: hasDetails ? true : undefined,
				triggerStreaming: true,
			};
		case "completed":
			return {
				isStreaming: false,
				streamingWave: false,
				streamingWaveGradientColor: undefined,
				animatedDots: false,
				duration,
				defaultOpen: false,
				triggerStreaming: undefined,
			};
		case "idle":
			return {
				isStreaming: false,
				streamingWave: false,
				streamingWaveGradientColor: undefined,
				animatedDots: false,
				duration: undefined,
				defaultOpen: undefined,
				triggerStreaming: undefined,
			};
	}
}
