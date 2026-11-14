export { cn } from "cn";

export { clamp } from "./math";

/** "agent-chat" → "Agent Chat". Splits on every hyphen, so empty segments keep their spaces. */
export function slugToTitleCase(slug: string): string {
	return slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function collapseWhitespace(value: string | null | undefined): string {
	return (value ?? "").replace(/\s+/gu, " ").trim();
}

export function createId(prefix = "id"): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function compareByNameNatural(
	left: { name: string },
	right: { name: string },
): number {
	return left.name.localeCompare(right.name, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export function sortByUpdatedAtDesc<T extends { updatedAt: string }>(
	items: ReadonlyArray<T>,
): T[] {
	return items
		.map((item) => ({
			item,
			updatedAtMs: Date.parse(item.updatedAt),
		}))
		.sort((left, right) => right.updatedAtMs - left.updatedAtMs)
		.map(({ item }) => item);
}

export function sleep(ms: number): Promise<void> {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : null;
}

export function trimTitleText(text: string): string {
	return text.trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "").trim();
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
