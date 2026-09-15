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
/** Bare `5h` only — leaves `5hr` and `5mo` alone so minutes stay `m`. */
const BARE_HOUR_UNIT = /(?<![A-Za-z])(\d+)h(?![A-Za-z])/gu;

/**
 * Display form for authored or formatted relative stamps: drop a trailing
 * `" ago"` and spell hours as `hr` so `5hr` cannot be read as months next to `5m`.
 * Named periods (`Just now`, `Yesterday`, `Last week`) pass through.
 */
export function toCompactRelativeTimeLabel(label: string): string {
	return label.replace(RELATIVE_AGO_SUFFIX, "").replace(BARE_HOUR_UNIT, "$1hr");
}

/** Compact relative stamp: `"Just now"`, `"32m ago"`, `"1hr ago"`, `"Yesterday"`, `"3d ago"`. */
export function formatRelativeTime(totalSecondsAgo: number): string {
	const normalizedSeconds = Number.isFinite(totalSecondsAgo)
		? Math.max(0, Math.floor(totalSecondsAgo))
		: 0;
	const minutes = Math.floor(normalizedSeconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (minutes < 1) return "Just now";
	if (hours < 1) return `${minutes}m ago`;
	if (days < 1) return `${hours}hr ago`;
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
