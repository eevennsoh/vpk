import {
	getRovoAgentProfile,
	ROVO_AGENT_ID,
	type RovoAgentProfile,
} from "@/app/data/directory/agents";
import { repairGeneratedAgentCatalog } from "@/app/data/directory/repair-agent-result";
import {
	DEFAULT_STARTER_ICON,
	getStarterIcon,
	type StarterIconKey,
} from "@/components/blocks/conversation-starters";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import { resolveConversationStarterVisualIdentity, type RovoSuggestion } from "@/lib/rovo-suggestions";
import { isPlainRecord } from "@/lib/utils";
import { applyTemplateDefaultsToResult } from "./agent-creation-context";
import type { PersistedSessionAgentRecord } from "./session-agent-storage";
import type { StudioSessionAgentEntry } from "./types";

const SESSION_AGENT_DEFAULT_ID = "session-agent";
const SESSION_AGENT_DEFAULT_NAME = "Untitled agent";
const SESSION_AGENT_LEGACY_DEFAULT_NAME = "New agent";
const SESSION_AGENT_DEFAULT_BYLINE = "Custom agent by You";
const SESSION_AGENT_DEFAULT_AVATAR_SRC = "/avatar-agent-new/orange/culture.svg";
const SESSION_AGENT_MAX_CONVERSATION_STARTERS = 3;

export type AgentResultPayload = RovoDataParts["agent-result"] & Record<string, unknown>;

function getNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function getPayloadString(
	payload: Record<string, unknown>,
	keys: ReadonlyArray<string>
): string | null {
	for (const key of keys) {
		const value = getNonEmptyString(payload[key]);
		if (value) {
			return value;
		}
	}

	return null;
}

function getAgentResultStarterLabel(value: unknown): string | null {
	const directLabel = getNonEmptyString(value);
	if (directLabel) {
		return directLabel;
	}

	if (!isPlainRecord(value)) {
		return null;
	}

	return getPayloadString(value, ["label", "prompt", "text", "title"]);
}

function getAgentResultStarterLabels(payload: AgentResultPayload): string[] {
	const rawStarters = payload.conversationStarters ?? payload.starters ?? payload.suggestions;
	if (!Array.isArray(rawStarters)) {
		return [];
	}

	const seenLabels = new Set<string>();
	const labels: string[] = [];
	for (const rawStarter of rawStarters) {
		const label = getAgentResultStarterLabel(rawStarter);
		if (!label) {
			continue;
		}

		const normalizedLabel = label.toLowerCase();
		if (seenLabels.has(normalizedLabel)) {
			continue;
		}

		seenLabels.add(normalizedLabel);
		labels.push(label);
		if (labels.length >= SESSION_AGENT_MAX_CONVERSATION_STARTERS) {
			break;
		}
	}

	return labels;
}

function getPayloadStringArray(
	payload: Record<string, unknown>,
	keys: ReadonlyArray<string>
): readonly string[] {
	for (const key of keys) {
		const value = payload[key];
		if (!Array.isArray(value)) {
			continue;
		}

		return value
			.map(getNonEmptyString)
			.filter((item): item is string => item !== null);
	}

	return [];
}

function getAgentResultStarterIconKeys(payload: AgentResultPayload): string[] {
	return [...getPayloadStringArray(payload, ["conversationStarterIcons", "starterIcons", "suggestionIcons"])];
}

export function normalizeSessionAgentResult(
	result: RovoDataParts["agent-result"]
): RovoDataParts["agent-result"] {
	const conversationStarters = getAgentResultStarterLabels(result as AgentResultPayload);
	const conversationStarterIcons = getAgentResultStarterIconKeys(result as AgentResultPayload);
	const name = getNonEmptyString(result.name) === SESSION_AGENT_LEGACY_DEFAULT_NAME
		? ""
		: result.name;
	const shouldNormalizeName = name !== result.name;
	if (
		!shouldNormalizeName &&
		!Array.isArray(result.conversationStarters) &&
		conversationStarters.length === 0
	) {
		return result;
	}

	return {
		...result,
		name,
		...(Array.isArray(result.conversationStarters) || conversationStarters.length > 0
			? { conversationStarters }
			: {}),
		...(conversationStarterIcons.length > 0 ? { conversationStarterIcons } : {}),
	};
}

export function getStudioSessionAgentResultDisplayName(
	result: RovoDataParts["agent-result"],
): string {
	return getNonEmptyString(result.name) ?? SESSION_AGENT_DEFAULT_NAME;
}

export function getStudioSessionAgentDisplayName(
	entry: Pick<StudioSessionAgentEntry, "draftResult">,
): string {
	return getStudioSessionAgentResultDisplayName(normalizeSessionAgentResult(entry.draftResult));
}

function normalizeGeneratedAgentId(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/gu, "-")
		.replace(/-+/gu, "-")
		.replace(/^-|-$/gu, "");

	return normalized || SESSION_AGENT_DEFAULT_ID;
}

function getSuffixedSessionAgentId(
	baseId: string,
	reservedIds: ReadonlySet<string>
): string {
	if (!reservedIds.has(baseId)) {
		return baseId;
	}

	let suffix = 2;
	while (reservedIds.has(`${baseId}-${suffix}`)) {
		suffix += 1;
	}

	return `${baseId}-${suffix}`;
}

function getSuffixedSessionAgentName(
	baseName: string,
	reservedNames: ReadonlySet<string>
): string {
	if (!reservedNames.has(baseName.toLowerCase())) {
		return baseName;
	}

	let suffix = 2;
	while (reservedNames.has(`${baseName} ${suffix}`.toLowerCase())) {
		suffix += 1;
	}

	return `${baseName} ${suffix}`;
}

function createSessionAgentStarter(
	agentId: string,
	label: string,
	index: number,
	context: { agentName: string; byline: string; description?: string | null },
	iconKey?: string,
): RovoSuggestion {
	return {
		id: `${agentId}-starter-${index + 1}`,
		icon: getStarterIcon((iconKey as StarterIconKey | undefined) ?? DEFAULT_STARTER_ICON),
		label,
		prompt: label,
		type: "skill",
		visualIdentity: resolveConversationStarterVisualIdentity({
			agentId,
			agentName: context.agentName,
			byline: context.byline,
			description: context.description ?? undefined,
			label,
		}),
	};
}

function createSessionAgentContextDescription(input: {
	description?: string;
	instructions?: string;
	payload: AgentResultPayload;
	profile: Pick<RovoAgentProfile, "byline" | "name" | "starters">;
}): string {
	const tools = getPayloadStringArray(input.payload, ["tools", "skills"]);
	const trigger = getPayloadString(input.payload, ["trigger"]);
	const guardrail = getPayloadString(input.payload, ["guardrail", "constraints"]);
	const starterLabels = input.profile.starters.map((starter) => starter.prompt ?? starter.label);

	return [
		"[Selected session-created agent]",
		`Agent: ${input.profile.name}`,
		`Byline: ${input.profile.byline}`,
		input.description ? `Description: ${input.description}` : null,
		input.instructions ? `Instructions: ${input.instructions}` : null,
		trigger ? `Trigger: ${trigger}` : null,
		tools.length > 0 ? `Tools: ${tools.join(", ")}` : null,
		guardrail ? `Guardrail: ${guardrail}` : null,
		starterLabels.length > 0 ? "Conversation starters:" : null,
		...starterLabels.map((starter) => `- ${starter}`),
		"Answer as this selected session-created agent while using the existing Rovo chat capabilities and available context.",
		"[End selected session-created agent]",
	]
		.filter((line): line is string => Boolean(line))
		.join("\n");
}

function getCreatedAgentResultKey(payload: AgentResultPayload): string {
	return JSON.stringify({
		agentId: getPayloadString(payload, ["agentId", "id"]),
		name: getPayloadString(payload, ["name", "agentName", "title"]),
		byline: getPayloadString(payload, ["byline", "sourceLabel", "generatedBy", "source"]),
		description: getPayloadString(payload, ["description", "summary", "shortDescription"]),
		instructions: getPayloadString(payload, ["instructions", "contextDescription", "context", "systemPrompt", "prompt"]),
		starters: getAgentResultStarterLabels(payload),
		starterIcons: getAgentResultStarterIconKeys(payload),
		avatarSrc: getPayloadString(payload, ["avatarSrc", "avatarUrl", "iconSrc"]),
	});
}

export function buildSessionAgentProfileFromResult(params: {
	agentResult: RovoDataParts["agent-result"];
	profileId: string;
	profileName: string;
}): RovoAgentProfile {
	const payload = params.agentResult as AgentResultPayload;
	const description =
		getPayloadString(payload, ["description", "summary", "shortDescription"]) ??
		undefined;
	const byline =
		getPayloadString(payload, ["byline", "sourceLabel", "generatedBy", "source"]) ??
		SESSION_AGENT_DEFAULT_BYLINE;
	const avatarSrc =
		getPayloadString(payload, ["avatarSrc", "avatarUrl", "iconSrc"]) ??
		SESSION_AGENT_DEFAULT_AVATAR_SRC;
	const instructions =
		getPayloadString(payload, ["instructions", "contextDescription", "context", "systemPrompt", "prompt"]) ??
		undefined;
	const starterIcons = getAgentResultStarterIconKeys(payload);
	const starters = getAgentResultStarterLabels(payload).map((starter, index) =>
		createSessionAgentStarter(params.profileId, starter, index, {
			agentName: params.profileName,
			byline,
			description,
		}, starterIcons[index])
	);

	return {
		id: params.profileId,
		name: params.profileName,
		byline,
		avatarSrc,
		description,
		starters,
		contextDescription: createSessionAgentContextDescription({
			description,
			instructions,
			payload,
			profile: {
				byline,
				name: params.profileName,
				starters,
			},
		}),
	};
}

/**
 * Repairs an LLM-generated agent-result against the real catalog before it
 * becomes a session entry: fuzzy-repairs each tools/skills/knowledge/subagents
 * id, repairs `@[category:id]` tokens in the instructions, and unions
 * body-referenced ids into the matching array.
 */
export function applyGeneratedCatalogRepair(
	result: RovoDataParts["agent-result"],
): RovoDataParts["agent-result"] {
	const enriched = applyTemplateDefaultsToResult(result);
	return { ...enriched, ...repairGeneratedAgentCatalog(enriched) };
}

export function createSessionAgentEntryFromResult(params: {
	agentResult: RovoDataParts["agent-result"];
	lastTouchedAt: number;
	sessionAgentEntries: readonly StudioSessionAgentEntry[];
	sourceKey?: string;
	staticAgentProfiles: readonly RovoAgentProfile[];
}): StudioSessionAgentEntry | null {
	const repairedResult = applyGeneratedCatalogRepair(params.agentResult);
	if (repairedResult.action !== "create") {
		return null;
	}

	const normalizedResult = normalizeSessionAgentResult(repairedResult);
	// Stamp an avatar once at creation time when none was supplied. Persisting it
	// keeps the avatar stable across later draft edits instead of re-rolling.
	const hasExplicitAvatar = Boolean(
		getPayloadString(normalizedResult as AgentResultPayload, ["avatarSrc", "avatarUrl", "iconSrc"])
	);
	const avatarSeed = getPayloadString(normalizedResult as AgentResultPayload, ["agentId", "id", "name"]);
	const agentResult: RovoDataParts["agent-result"] = hasExplicitAvatar
		? normalizedResult
		: { ...normalizedResult, avatarSrc: getDeterministicAgentAvatarSrc(avatarSeed) };
	const payload = agentResult as AgentResultPayload;
	const payloadResultKey = getCreatedAgentResultKey(payload);
	const resultKey = params.sourceKey
		? `${params.sourceKey}:${payloadResultKey}`
		: payloadResultKey;
	const existingEntry = params.sessionAgentEntries.find(
		(entry) => entry.resultKey === resultKey
	);
	if (existingEntry) {
		return existingEntry;
	}

	const explicitName = getPayloadString(payload, ["name", "agentName", "title"]);
	const baseName = explicitName ?? SESSION_AGENT_DEFAULT_NAME;
	const explicitId = getPayloadString(payload, ["agentId", "id"]);
	const baseId = normalizeGeneratedAgentId(
		explicitId ?? baseName
	);
	const staticReservedProfiles = explicitId
		? params.staticAgentProfiles.filter((profile) => profile.id !== baseId)
		: params.staticAgentProfiles;
	const reservedProfiles = [
		...staticReservedProfiles,
		getRovoAgentProfile(ROVO_AGENT_ID),
		...params.sessionAgentEntries.map((entry) => entry.profile),
	];
	const reservedIds = new Set(reservedProfiles.map((profile) => profile.id));
	const reservedNames = new Set(
		reservedProfiles.map((profile) => profile.name.toLowerCase())
	);
	const id = getSuffixedSessionAgentId(baseId, reservedIds);
	const name = explicitName
		? getSuffixedSessionAgentName(baseName, reservedNames)
		: SESSION_AGENT_DEFAULT_NAME;
	const profile = buildSessionAgentProfileFromResult({
		agentResult,
		profileId: id,
		profileName: name,
	});

	return {
		profile,
		resultKey,
		sourceResult: agentResult,
		draftResult: agentResult,
		lastTouchedAt: params.lastTouchedAt,
		publishReadyResult: agentResult,
		publishedResult: null,
		publishStatus: "testing",
		publishedVersion: 0,
		lastPublishedAt: null,
		lastPublishedBy: null,
		versionHistory: [],
	};
}

export function createSessionAgentEntriesFromRecords(
	records: readonly PersistedSessionAgentRecord[],
): StudioSessionAgentEntry[] {
	if (records.length === 0) {
		return [];
	}

	return records.map((record) => {
		const sourceResult = normalizeSessionAgentResult(record.sourceResult);
		const draftResult = normalizeSessionAgentResult(record.draftResult);
		const publishReadyResult = normalizeSessionAgentResult(record.publishReadyResult);
		const publishedResult = record.publishedResult
			? normalizeSessionAgentResult(record.publishedResult)
			: null;
		const profile = buildSessionAgentProfileFromResult({
			agentResult: draftResult,
			profileId: record.profileId,
			profileName: getStudioSessionAgentResultDisplayName(draftResult),
		});

		return {
			profile,
			resultKey: record.resultKey,
			sourceResult,
			draftResult,
			lastTouchedAt: record.lastTouchedAt,
			publishReadyResult,
			publishedResult,
			publishStatus: record.publishStatus,
			publishedVersion: record.publishedVersion,
			lastPublishedAt: record.lastPublishedAt,
			lastPublishedBy: record.lastPublishedBy,
			versionHistory: record.versionHistory.map((version) => ({
				...version,
				snapshot: normalizeSessionAgentResult(version.snapshot),
			})),
		};
	});
}

export function normalizeSessionAgentEntry(entry: StudioSessionAgentEntry): StudioSessionAgentEntry {
	const sourceResult = normalizeSessionAgentResult(entry.sourceResult);
	const draftResult = normalizeSessionAgentResult(entry.draftResult);
	const publishReadyResult = normalizeSessionAgentResult(entry.publishReadyResult);
	const publishedResult = entry.publishedResult
		? normalizeSessionAgentResult(entry.publishedResult)
		: null;
	const profileName = getStudioSessionAgentResultDisplayName(draftResult);

	if (
		sourceResult === entry.sourceResult &&
		draftResult === entry.draftResult &&
		publishReadyResult === entry.publishReadyResult &&
		publishedResult === entry.publishedResult &&
		entry.profile.name === profileName &&
		entry.versionHistory.every((version) => version.snapshot === normalizeSessionAgentResult(version.snapshot))
	) {
		return entry;
	}

	return {
		...entry,
		profile: buildSessionAgentProfileFromResult({
			agentResult: draftResult,
			profileId: entry.profile.id,
			profileName,
		}),
		sourceResult,
		draftResult,
		publishReadyResult,
		publishedResult,
		versionHistory: entry.versionHistory.map((version) => ({
			...version,
			snapshot: normalizeSessionAgentResult(version.snapshot),
		})),
	};
}
