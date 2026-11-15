import type { ComponentManifestEntry } from "@/app/data/component-manifest";

export interface HomeCatalogListEntry extends ComponentManifestEntry {
	updatedAt: string | null;
}

/** Newest `updatedAt` first; entries without a date go last; ties fall back to name. */
export function compareHomeCatalogEntriesByLastUpdated(
	left: HomeCatalogListEntry,
	right: HomeCatalogListEntry,
): number {
	const timeDelta =
		Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? "");
	if (Number.isFinite(timeDelta) && timeDelta !== 0) {
		return timeDelta;
	}

	if (right.updatedAt && !left.updatedAt) {
		return 1;
	}

	if (left.updatedAt && !right.updatedAt) {
		return -1;
	}

	return left.name.localeCompare(right.name);
}

export function compareHomeCatalogEntriesByName(
	left: HomeCatalogListEntry,
	right: HomeCatalogListEntry,
): number {
	return left.name.localeCompare(right.name);
}

/** The dated entries when supplied, otherwise every manifest component with no date. */
export function resolveHomeCatalogEntries(
	components: ReadonlyArray<ComponentManifestEntry>,
	componentEntries?: ReadonlyArray<HomeCatalogListEntry>,
): ReadonlyArray<HomeCatalogListEntry> {
	return (
		componentEntries ??
		components.map((component) => ({ ...component, updatedAt: null }))
	);
}

/** The most recently updated entries, in "Last updated" order. */
export function selectLatestHomeCatalogEntries(
	entries: ReadonlyArray<HomeCatalogListEntry>,
	limit: number,
): HomeCatalogListEntry[] {
	return [...entries]
		.sort(compareHomeCatalogEntriesByLastUpdated)
		.slice(0, limit);
}
