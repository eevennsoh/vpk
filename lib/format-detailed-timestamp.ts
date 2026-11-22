export function formatDetailedTimestamp(timestampMs: number, compact = false): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: compact ? undefined : "long",
		year: "numeric",
		month: compact ? "short" : "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: compact ? undefined : "2-digit",
		hourCycle: "h23",
		timeZone: "Asia/Kuala_Lumpur",
		timeZoneName: "short",
	}).format(new Date(timestampMs));
}
