export function formatDetailedTimestamp(timestampMs: number): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
		timeZone: "Asia/Kuala_Lumpur",
		timeZoneName: "short",
	}).format(new Date(timestampMs));
}
