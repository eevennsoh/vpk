export function formatElapsedTime(totalSeconds: number): string {
	const normalizedSeconds = Number.isFinite(totalSeconds)
		? Math.max(0, Math.floor(totalSeconds))
		: 0;
	const minutes = Math.floor(normalizedSeconds / 60);
	const seconds = normalizedSeconds % 60;
	const parts: string[] = [];

	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0) {
		parts.push(`${minutes > 0 ? seconds.toString().padStart(2, "0") : seconds}s`);
	}

	return parts.join(" ");
}

const RELATIVE_AGO_SUFFIX = / ago$/u;
const NUMERIC_RELATIVE_TIME = /^(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mo|years?|y)(?:\s+ago)?$/iu;
/** Normalize authored compact hour units without changing words or other units. */
const COMPACT_HOUR_UNIT = /(?<![A-Za-z])(\d+)hr(?![A-Za-z])/gu;
const LONG_RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "always", style: "long" });
const RELATIVE_TIME_UNITS: Partial<Record<string, Intl.RelativeTimeFormatUnit>> = {
	s: "second",
	m: "minute",
	h: "hour",
	d: "day",
	w: "week",
	mo: "month",
	y: "year",
};

/**
 * Display form for authored or formatted relative stamps, e.g. `"19 days ago"` → `"19d"`.
 * Named periods (`Just now`, `Yesterday`, `Last week`) pass through.
 */
export function toCompactRelativeTimeLabel(label: string): string {
	const relative = NUMERIC_RELATIVE_TIME.exec(label.trim());
	if (relative) {
		const [, count, rawUnit] = relative;
		const unit = rawUnit.toLowerCase();
		return `${count}${unit.startsWith("mo") ? "mo" : unit[0]}`;
	}
	return label.replace(RELATIVE_AGO_SUFFIX, "").replace(COMPACT_HOUR_UNIT, "$1h");
}

export function describeRelativeTimeLabel(label: string, timestampMs?: number): string | undefined {
	const text = label.trim();
	const relative = NUMERIC_RELATIVE_TIME.exec(text);
	if (relative) {
		const [, count, rawUnit] = relative;
		const quantity = Number(count);
		const unit = rawUnit.toLowerCase();
		const longUnit = RELATIVE_TIME_UNITS[unit.startsWith("mo") ? "mo" : unit[0]];
		return longUnit && Number.isFinite(quantity) ? LONG_RELATIVE_TIME.format(-quantity, longUnit) : undefined;
	}
	if (/^(?:just now|now)$/iu.test(text)) return Number.isFinite(timestampMs) ? undefined : "Less than a minute ago";
	if (/^(?:today|yesterday|last (?:week|month|year))$/iu.test(text)) return text[0].toUpperCase() + text.slice(1).toLowerCase();
	return undefined;
}

/** Compact relative stamp: `"Just now"`, `"32m ago"`, `"1h ago"`, `"Yesterday"`, `"3d ago"`. */
export function formatRelativeTime(totalSecondsAgo: number, { showSeconds = false } = {}): string {
	const normalizedSeconds = Number.isFinite(totalSecondsAgo)
		? Math.max(0, Math.floor(totalSecondsAgo))
		: 0;
	const minutes = Math.floor(normalizedSeconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return showSeconds ? `${normalizedSeconds}s ago` : "Just now";
	if (hours < 1) return `${minutes}m ago`;
	if (days < 1) return `${hours}h ago`;
	if (days === 1) return "Yesterday";
	return `${days}d ago`;
}

export function getElapsedSeconds(runCreatedAt: string | null, runCompletedAt: string | null, nowMs: number): number {
	if (!runCreatedAt) return 0;
	const startTime = Date.parse(runCreatedAt);
	if (!Number.isFinite(startTime)) return 0;
	const completedTime = runCompletedAt ? Date.parse(runCompletedAt) : Number.NaN;
	const endTime = Number.isFinite(completedTime) ? completedTime : nowMs;
	return Math.max(0, Math.floor((endTime - startTime) / 1000));
}

export function resolveInitialNowMs({
	initialNowMs,
	runCreatedAt,
	runCompletedAt,
}: Readonly<{
	initialNowMs?: number;
	runCreatedAt: string | null;
	runCompletedAt: string | null;
}>): number {
	if (typeof initialNowMs === "number" && Number.isFinite(initialNowMs)) {
		return initialNowMs;
	}

	const completedTime = runCompletedAt ? Date.parse(runCompletedAt) : Number.NaN;
	if (Number.isFinite(completedTime)) {
		return completedTime;
	}

	const createdTime = runCreatedAt ? Date.parse(runCreatedAt) : Number.NaN;
	if (Number.isFinite(createdTime)) {
		return createdTime;
	}

	return 0;
}
