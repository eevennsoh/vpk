"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";

import { describeRelativeTimeLabel, formatElapsedTime, formatRelativeTime, toCompactRelativeTimeLabel } from "@/lib/elapsed-time";

const ELAPSED_TIME_TICK_MS = 1000;

export interface ElapsedTimeProps extends Omit<ComponentProps<"time">, "children" | "dateTime" | "prefix"> {
	elapsedSeconds?: number;
	prefix?: ReactNode;
	startedAtMs?: number;
}

export interface RelativeTimeProps extends Omit<ComponentProps<"time">, "children" | "dateTime"> {
	fallback?: string;
	format?: "compact" | "long";
	secondsAgo?: number;
	timestampMs?: number;
}

/** Shared elapsed-time display for static durations and live count-up timers. */
export function ElapsedTime({
	elapsedSeconds = 0,
	prefix,
	startedAtMs,
	...props
}: Readonly<ElapsedTimeProps>) {
	const [nowMs, setNowMs] = useState(() => Date.now());
	const hasLiveStart = typeof startedAtMs === "number" && Number.isFinite(startedAtMs);

	useEffect(() => {
		if (!hasLiveStart) return;

		setNowMs(Date.now());
		const intervalId = window.setInterval(() => setNowMs(Date.now()), ELAPSED_TIME_TICK_MS);
		return () => window.clearInterval(intervalId);
	}, [hasLiveStart, startedAtMs]);

	const resolvedElapsedSeconds = hasLiveStart
		? Math.max(0, Math.floor((nowMs - startedAtMs) / ELAPSED_TIME_TICK_MS))
		: elapsedSeconds;
	const label = formatElapsedTime(resolvedElapsedSeconds);

	if (!label) return null;

	return (
		<>
			{prefix}
			<time dateTime={`PT${Math.max(0, Math.floor(resolvedElapsedSeconds))}S`} {...props}>
				{label}
			</time>
		</>
	);
}

/** Relative timestamp that continues aging after mount. */
export function RelativeTime({
	fallback,
	format,
	secondsAgo,
	timestampMs,
	...props
}: Readonly<RelativeTimeProps>) {
	const hasTimestamp = typeof timestampMs === "number" && Number.isFinite(timestampMs);
	const hasSecondsAgo = typeof secondsAgo === "number" && Number.isFinite(secondsAgo);
	const [mountedAtMs] = useState(() => Date.now());
	const [nowMs, setNowMs] = useState(mountedAtMs);

	useEffect(() => {
		if (!hasTimestamp && !hasSecondsAgo) return;

		setNowMs(Date.now());
		const intervalId = window.setInterval(() => setNowMs(Date.now()), ELAPSED_TIME_TICK_MS);
		return () => window.clearInterval(intervalId);
	}, [hasSecondsAgo, hasTimestamp, secondsAgo, timestampMs]);

	if (!hasTimestamp && !hasSecondsAgo) {
		return fallback ? <time {...props}>{fallback}</time> : null;
	}

	const resolvedTimestampMs = hasTimestamp && timestampMs !== undefined
		? timestampMs
		: mountedAtMs - Math.max(0, secondsAgo ?? 0) * ELAPSED_TIME_TICK_MS;
	const resolvedSecondsAgo = Math.max(
		0,
		Math.floor((nowMs - resolvedTimestampMs) / ELAPSED_TIME_TICK_MS),
	);
	const label = formatRelativeTime(resolvedSecondsAgo, { showSeconds: format === "long" });
	const visibleLabel = format === "long"
		? describeRelativeTimeLabel(label) ?? label
		: format === "compact" ? toCompactRelativeTimeLabel(label) : label;

	return (
		<time dateTime={new Date(resolvedTimestampMs).toISOString()} {...props}>
			{visibleLabel}
		</time>
	);
}
