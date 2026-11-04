import { migrateAgentAvatarSrc } from "../../../../../lib/agent-avatars.ts";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import type {
	StudioAgentPublishStatus,
	StudioAgentVersionRecord,
	StudioSessionAgentEntry,
} from "./types";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const STUDIO_SESSION_AGENTS_STORAGE_KEY = "vpk:studio:session-agents:v1";
const LEGACY_PUBLISHED_AGENTS_STORAGE_KEY = "vpk:studio:published-agents:v1";
const RFP_DRAFTING_AGENT_PROFILE_ID = "rfp-drafting-agent";
const STALE_RFP_DEMO_SUBAGENT_NAME = "code reviewer";

export interface PersistedSessionAgentRecord {
	readonly profileId: string;
	readonly resultKey: string;
	readonly sourceResult: RovoDataParts["agent-result"];
	readonly draftResult: RovoDataParts["agent-result"];
	readonly publishReadyResult: RovoDataParts["agent-result"];
	readonly publishedResult: RovoDataParts["agent-result"] | null;
	readonly publishStatus: StudioAgentPublishStatus;
	readonly lastTouchedAt: number;
	readonly publishedVersion: number;
	readonly lastPublishedAt: number | null;
	readonly lastPublishedBy: string | null;
	readonly versionHistory: readonly StudioAgentVersionRecord[];
}

interface RawPersistedSessionAgentRecord extends Omit<
	PersistedSessionAgentRecord,
	"lastPublishedAt" | "lastPublishedBy" | "publishedVersion" | "versionHistory"
> {
	readonly publishedVersion?: number;
	readonly lastPublishedAt?: number | null;
	readonly lastPublishedBy?: string | null;
	readonly versionHistory?: readonly StudioAgentVersionRecord[];
}

interface LegacyPublishedAgentRecord {
	readonly profileId: string;
	readonly profileName?: string;
	readonly resultKey: string;
	readonly result: RovoDataParts["agent-result"];
	readonly lastTouchedAt?: number;
}

function isStorageAvailable(): boolean {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isAgentResult(value: unknown): value is RovoDataParts["agent-result"] {
	if (!isPlainRecord(value)) {
		return false;
	}
	return (
		typeof value.agentId === "string" &&
		typeof value.name === "string" &&
		typeof value.summary === "string" &&
		typeof value.action === "string"
	);
}

function isPublishStatus(value: unknown): value is StudioAgentPublishStatus {
	return value === "testing" || value === "published";
}

function isVersionKind(value: unknown): value is StudioAgentVersionRecord["kind"] {
	return value === "publish" || value === "update" || value === "rollback";
}

function isChangeSummary(value: unknown): value is StudioAgentVersionRecord["changeSummary"] {
	if (!isPlainRecord(value) || typeof value.count !== "number" || !Number.isFinite(value.count)) {
		return false;
	}
	return Array.isArray(value.sections);
}

function isStudioAgentVersionRecord(value: unknown): value is StudioAgentVersionRecord {
	if (!isPlainRecord(value)) {
		return false;
	}
	return (
		typeof value.id === "string" &&
		typeof value.label === "string" &&
		(
			value.version === undefined ||
			(typeof value.version === "number" && Number.isFinite(value.version))
		) &&
		isVersionKind(value.kind) &&
		typeof value.createdAt === "number" &&
		Number.isFinite(value.createdAt) &&
		typeof value.createdBy === "string" &&
		isAgentResult(value.snapshot) &&
		isChangeSummary(value.changeSummary)
	);
}

function isPersistedSessionAgentRecord(value: unknown): value is RawPersistedSessionAgentRecord {
	if (!isPlainRecord(value)) {
		return false;
	}
	const hasValidPublishedVersion =
		value.publishedVersion === undefined ||
		(typeof value.publishedVersion === "number" && Number.isFinite(value.publishedVersion));
	const hasValidLastPublishedAt =
		value.lastPublishedAt === undefined ||
		value.lastPublishedAt === null ||
		(typeof value.lastPublishedAt === "number" && Number.isFinite(value.lastPublishedAt));
	const hasValidLastPublishedBy =
		value.lastPublishedBy === undefined ||
		value.lastPublishedBy === null ||
		typeof value.lastPublishedBy === "string";
	const hasValidVersionHistory =
		value.versionHistory === undefined ||
		(Array.isArray(value.versionHistory) && value.versionHistory.every(isStudioAgentVersionRecord));

	return (
		typeof value.profileId === "string" &&
		typeof value.resultKey === "string" &&
		isAgentResult(value.sourceResult) &&
		isAgentResult(value.draftResult) &&
		isAgentResult(value.publishReadyResult) &&
		(value.publishedResult === null || isAgentResult(value.publishedResult)) &&
		isPublishStatus(value.publishStatus) &&
		typeof value.lastTouchedAt === "number" &&
		Number.isFinite(value.lastTouchedAt) &&
		hasValidPublishedVersion &&
		hasValidLastPublishedAt &&
		hasValidLastPublishedBy &&
		hasValidVersionHistory
	);
}

function isLegacyPublishedAgentRecord(value: unknown): value is LegacyPublishedAgentRecord {
	if (!isPlainRecord(value)) {
		return false;
	}
	return (
		typeof value.profileId === "string" &&
		typeof value.resultKey === "string" &&
		isAgentResult(value.result)
	);
}

function parseStoredArray<T>(raw: string | null, guard: (value: unknown) => value is T): T[] {
	if (!raw) {
		return [];
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(guard);
	} catch {
		return [];
	}
}

function createLegacyVersionHistory(
	result: RovoDataParts["agent-result"] | null,
	lastTouchedAt: number,
	lastPublishedBy: string | null,
): readonly StudioAgentVersionRecord[] {
	if (!result) {
		return [];
	}

	return [{
		id: `legacy-publish-${lastTouchedAt}`,
		label: "Agent published",
		version: 1,
		kind: "publish",
		createdAt: lastTouchedAt,
		createdBy: lastPublishedBy ?? "Venn Soh",
		snapshot: result,
		changeSummary: { count: 0, sections: [] },
	}];
}

function normalizeVersionHistory(
	versionHistory: readonly StudioAgentVersionRecord[],
	publishedVersion: number,
): readonly StudioAgentVersionRecord[] {
	const ascendingVersion = [...versionHistory].reverse();
	let derivedVersion = 0;
	const normalizedAscending = ascendingVersion.map((versionRecord) => {
		if (typeof versionRecord.version === "number" && Number.isFinite(versionRecord.version)) {
			derivedVersion = Math.max(derivedVersion, Math.floor(versionRecord.version));
			return {
				...versionRecord,
				version: Math.max(1, Math.floor(versionRecord.version)),
			};
		}

		if (versionRecord.kind === "publish" || versionRecord.kind === "update") {
			derivedVersion += 1;
		}

		return {
			...versionRecord,
			version: Math.max(1, derivedVersion || publishedVersion || 1),
		};
	});

	return normalizedAscending.reverse();
}

function isStaleRfpDemoSubagentName(value: unknown): boolean {
	return typeof value === "string" && value.trim().toLowerCase() === STALE_RFP_DEMO_SUBAGENT_NAME;
}

function isStaleRfpDemoSubagentPrompt(value: unknown): boolean {
	if (!isPlainRecord(value)) {
		return false;
	}

	return (
		isStaleRfpDemoSubagentName(value.triggerName) ||
		isStaleRfpDemoSubagentName(value.name) ||
		(isPlainRecord(value.config) && isStaleRfpDemoSubagentName(value.config.name))
	);
}

function sanitizeRfpDemoAgentResult(
	result: RovoDataParts["agent-result"],
): RovoDataParts["agent-result"] {
	const nextSubagents = Array.isArray(result.subagents)
		? result.subagents.filter((name) => !isStaleRfpDemoSubagentName(name))
		: result.subagents;
	const nextSubagentPrompts = Array.isArray(result.subagentPrompts)
		? result.subagentPrompts.filter((prompt) => !isStaleRfpDemoSubagentPrompt(prompt))
		: result.subagentPrompts;

	if (nextSubagents === result.subagents && nextSubagentPrompts === result.subagentPrompts) {
		return result;
	}

	return {
		...result,
		subagents: nextSubagents,
		subagentPrompts: nextSubagentPrompts,
	};
}

function sanitizeRfpDemoSessionAgentRecord(
	record: PersistedSessionAgentRecord,
): PersistedSessionAgentRecord {
	if (record.profileId !== RFP_DRAFTING_AGENT_PROFILE_ID) {
		return record;
	}

	return {
		...record,
		sourceResult: sanitizeRfpDemoAgentResult(record.sourceResult),
		draftResult: sanitizeRfpDemoAgentResult(record.draftResult),
		publishReadyResult: sanitizeRfpDemoAgentResult(record.publishReadyResult),
		publishedResult: record.publishedResult
			? sanitizeRfpDemoAgentResult(record.publishedResult)
			: null,
		versionHistory: record.versionHistory.map((version) => ({
			...version,
			snapshot: sanitizeRfpDemoAgentResult(version.snapshot),
		})),
	};
}

function migrateRecordAvatars(record: PersistedSessionAgentRecord): PersistedSessionAgentRecord {
	const migrateResult = (result: RovoDataParts["agent-result"]): RovoDataParts["agent-result"] => {
		const avatarSrc = migrateAgentAvatarSrc(result.avatarSrc);
		return avatarSrc === result.avatarSrc ? result : { ...result, avatarSrc };
	};
	return {
		...record,
		sourceResult: migrateResult(record.sourceResult),
		draftResult: migrateResult(record.draftResult),
		publishReadyResult: migrateResult(record.publishReadyResult),
		publishedResult: record.publishedResult ? migrateResult(record.publishedResult) : null,
		versionHistory: record.versionHistory.map((version) => ({ ...version, snapshot: migrateResult(version.snapshot) })),
	};
}

function normalizePersistedRecord(record: RawPersistedSessionAgentRecord): PersistedSessionAgentRecord {
	const publishedVersion =
		typeof record.publishedVersion === "number" && Number.isFinite(record.publishedVersion)
			? Math.max(0, Math.floor(record.publishedVersion))
			: record.publishedResult
				? 1
				: 0;
	const lastPublishedAt =
		typeof record.lastPublishedAt === "number" && Number.isFinite(record.lastPublishedAt)
			? record.lastPublishedAt
			: record.publishedResult
				? record.lastTouchedAt
				: null;
	const lastPublishedBy =
		typeof record.lastPublishedBy === "string" && record.lastPublishedBy.trim()
			? record.lastPublishedBy
			: record.publishedResult
				? "Venn Soh"
				: null;
	const versionHistory = record.versionHistory && record.versionHistory.length > 0
		? record.versionHistory
		: createLegacyVersionHistory(record.publishedResult, lastPublishedAt ?? record.lastTouchedAt, lastPublishedBy);
	const normalizedVersionHistory = normalizeVersionHistory(versionHistory, publishedVersion);

	return migrateRecordAvatars(sanitizeRfpDemoSessionAgentRecord({
		...record,
		publishedVersion,
		lastPublishedAt,
		lastPublishedBy,
		versionHistory: normalizedVersionHistory,
	}));
}

function migrateLegacyRecord(record: LegacyPublishedAgentRecord): PersistedSessionAgentRecord {
	const lastTouchedAt =
		typeof record.lastTouchedAt === "number" && Number.isFinite(record.lastTouchedAt)
			? record.lastTouchedAt
			: Date.now();

	return migrateRecordAvatars(sanitizeRfpDemoSessionAgentRecord({
		profileId: record.profileId,
		resultKey: record.resultKey,
		sourceResult: record.result,
		draftResult: record.result,
		publishReadyResult: record.result,
		publishedResult: record.result,
		publishStatus: "published",
		lastTouchedAt,
		publishedVersion: 1,
		lastPublishedAt: lastTouchedAt,
		lastPublishedBy: "Venn Soh",
		versionHistory: createLegacyVersionHistory(record.result, lastTouchedAt, "Venn Soh"),
	}));
}

// Collapse records that share a profileId, keeping the freshest (highest
// lastTouchedAt) for each. Two records with the same profileId would hydrate
// into two session-agent entries with the same identity, which then render
// under the same React key in the sidebar recent-agents list and the "My
// agents" table. React's keyed reconciler can't tell same-key siblings apart,
// so when the list shrinks (e.g. deleting one of the duplicates) it leaves a
// stale DOM node behind — the deleted agent appears to linger on screen.
// Deduping at the storage read boundary keeps that corruption out of state and
// rewrites clean records on the next persist.
export function dedupeSessionAgentRecordsByProfileId(
	records: readonly PersistedSessionAgentRecord[],
): PersistedSessionAgentRecord[] {
	const byProfileId = new Map<string, PersistedSessionAgentRecord>();
	for (const record of records) {
		const existing = byProfileId.get(record.profileId);
		if (!existing || record.lastTouchedAt > existing.lastTouchedAt) {
			byProfileId.set(record.profileId, record);
		}
	}
	return Array.from(byProfileId.values());
}

export function readSessionAgentRecords(): PersistedSessionAgentRecord[] {
	if (!isStorageAvailable()) {
		return [];
	}

	try {
		const storage = window.localStorage;
		const currentRaw = storage.getItem(STUDIO_SESSION_AGENTS_STORAGE_KEY);
		if (currentRaw !== null) {
			return dedupeSessionAgentRecordsByProfileId(
				parseStoredArray(currentRaw, isPersistedSessionAgentRecord).map(normalizePersistedRecord),
			);
		}

		const legacyRaw = storage.getItem(LEGACY_PUBLISHED_AGENTS_STORAGE_KEY);
		if (legacyRaw === null) {
			return [];
		}

		const legacyRecords = parseStoredArray(legacyRaw, isLegacyPublishedAgentRecord);
		const migrated = dedupeSessionAgentRecordsByProfileId(
			legacyRecords.map(migrateLegacyRecord),
		);

		// Persist the migrated payload, then delete the legacy key only if the
		// write succeeded. If setItem throws (quota, serialization), keep the
		// legacy key so a future read can retry the migration.
		try {
			storage.setItem(STUDIO_SESSION_AGENTS_STORAGE_KEY, JSON.stringify(migrated));
			storage.removeItem(LEGACY_PUBLISHED_AGENTS_STORAGE_KEY);
		} catch {
			// Persistence failed; keep legacy key for next attempt.
		}

		return migrated;
	} catch {
		return [];
	}
}

export function writeSessionAgentRecords(
	records: readonly PersistedSessionAgentRecord[],
): boolean {
	if (!isStorageAvailable()) {
		return true;
	}
	try {
		window.localStorage.setItem(
			STUDIO_SESSION_AGENTS_STORAGE_KEY,
			JSON.stringify(records),
		);
		return true;
	} catch {
		// Ignore quota / serialization failures; persistence is best-effort.
		return false;
	}
}

export function toPersistedRecord(entry: StudioSessionAgentEntry): PersistedSessionAgentRecord {
	return {
		profileId: entry.profile.id,
		resultKey: entry.resultKey,
		sourceResult: entry.sourceResult,
		draftResult: entry.draftResult,
		publishReadyResult: entry.publishReadyResult,
		publishedResult: entry.publishedResult,
		publishStatus: entry.publishStatus,
		lastTouchedAt: entry.lastTouchedAt,
		publishedVersion: entry.publishedVersion,
		lastPublishedAt: entry.lastPublishedAt,
		lastPublishedBy: entry.lastPublishedBy,
		versionHistory: entry.versionHistory,
	};
}
