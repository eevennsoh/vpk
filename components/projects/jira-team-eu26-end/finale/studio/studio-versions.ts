/*
 * The wall's saved versions: one source of truth, `data/finale-studio.json`,
 * and every version ever saved beside it in `data/finale-studio-history/`, one
 * file each, named by when it was saved (so they sort, and commit, cleanly).
 */

export interface StudioVersion {
	/** The file's name without `.json`: when it was saved, made safe for a file name. */
	readonly id: string;
	readonly savedAt: string;
}

/** A version's id for the moment it was saved: `2026-10-06T14-32-10-512Z`. */
export function versionId(savedAt: Date): string {
	return savedAt.toISOString().replace(/[:.]/gu, "-");
}

/** Whether `id` names a version (and nothing else on disk). */
export function isVersionId(id: string): boolean {
	return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u.test(id);
}

/** The versions among a history folder's file names, newest first. */
export function versionsIn(fileNames: readonly string[]): readonly StudioVersion[] {
	return fileNames
		.filter((name) => name.endsWith(".json") && isVersionId(name.slice(0, -".json".length)))
		.map((name) => {
			const id = name.slice(0, -".json".length);
			const [date, time] = id.split("T");
			const [hours, minutes, seconds, millis] = time.replace(/Z$/u, "").split("-");
			return { id, savedAt: `${date}T${hours}:${minutes}:${seconds}.${millis}Z` };
		})
		.sort((a, b) => b.id.localeCompare(a.id));
}
