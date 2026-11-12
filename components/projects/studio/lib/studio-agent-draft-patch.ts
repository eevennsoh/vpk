"use client";

import { isKnowledgeMode, isMemoryMode, isReasoningMode } from "@/app/data/directory/agent-modes";
import { resolveCatalogNames } from "@/app/data/directory/resolve-ids";
import { AGENT_AVATAR_OPTION_SRCS } from "@/components/blocks/agent/data/agent-avatar-options";
import { getDerivedSubagentNames } from "@/components/blocks/subagent/lib/subagent-prompts";
import {
	createAgentAutomationRule,
	createAgentTriggerValue,
	type AgentAutomationRule,
	type AgentTriggerProviderId,
	type AgentTriggerValue,
} from "@/components/blocks/trigger/data/trigger-catalog";
import { mergeTriggerPhrasesIntoDraft } from "@/components/projects/studio/lib/demo-agent-builder";
import type { RovoAgentSubagentPrompt, RovoDataParts } from "@/lib/rovo-ui-messages";

export type StudioAgentDraftPatch = Partial<RovoDataParts["agent-result"]>;

const ALLOWED_TEXT_FIELDS = [
	"name",
	"description",
	"summary",
	"instructions",
	"contextDescription",
	"trigger",
	"guardrail",
	"byline",
] as const;

const REFERENCE_PATCH_FIELDS = [
	{ field: "skills", category: "skill" },
	{ field: "apps", category: "app" },
	{ field: "knowledge", category: "knowledge" },
	{ field: "subagents", category: "subagent" },
] as const;

const AGENT_AVATAR_OPTION_SRC_SET: ReadonlySet<string> = new Set(AGENT_AVATAR_OPTION_SRCS);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTextArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const items = value
		.map((item) => normalizeText(item))
		.filter((item): item is string => Boolean(item));
	return items.length > 0 ? items : undefined;
}

function normalizeAvatarFallback(value: unknown): RovoDataParts["agent-result"]["avatarFallback"] | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const avatarFallback: NonNullable<RovoDataParts["agent-result"]["avatarFallback"]> = {};
	for (const field of ["initials", "backgroundColor", "iconName", "label"] as const) {
		const normalized = normalizeText(value[field]);
		if (normalized) {
			avatarFallback[field] = normalized;
		}
	}
	return Object.keys(avatarFallback).length > 0 ? avatarFallback : undefined;
}

function normalizeAvatarSrc(value: unknown): string | undefined {
	const src = normalizeText(value);
	return src && AGENT_AVATAR_OPTION_SRC_SET.has(src) ? src : undefined;
}

function normalizeSubagentPrompts(value: unknown): RovoAgentSubagentPrompt[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const prompts: RovoAgentSubagentPrompt[] = [];
	value.forEach((raw, index) => {
		if (!isRecord(raw)) {
			return;
		}
		const triggerName = normalizeText(raw.triggerName);
		if (!triggerName) {
			return;
		}
		const rawConfig = isRecord(raw.config) ? raw.config : {};
		const config: Record<string, unknown> = {
			instructions: normalizeText(rawConfig.instructions) ?? "",
			contextDescription: normalizeText(rawConfig.contextDescription) ?? "",
			triggers: normalizeTextArray(rawConfig.triggers) ?? [],
			skills: resolveCatalogNames(normalizeTextArray(rawConfig.skills) ?? [], "skill"),
			tools: normalizeTextArray(rawConfig.tools) ?? [],
			knowledge: resolveCatalogNames(normalizeTextArray(rawConfig.knowledge) ?? [], "knowledge"),
			conversationStarters: [],
			action: "draft",
		};
		if (isMemoryMode(rawConfig.memoryMode)) {
			config.memoryMode = rawConfig.memoryMode;
		}
		if (isReasoningMode(rawConfig.reasoningMode)) {
			config.reasoningMode = rawConfig.reasoningMode;
		}
		prompts.push({
			id: normalizeText(raw.id) ?? `subagent-prompt-${index + 1}`,
			triggerName,
			condition: normalizeText(raw.condition) ?? "",
			config,
		} as unknown as RovoAgentSubagentPrompt);
	});
	return prompts.length > 0 ? prompts : undefined;
}

function normalizeAutomationRules(value: unknown): AgentAutomationRule[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const rules: AgentAutomationRule[] = [];
	value.forEach((raw, ruleIndex) => {
		if (!isRecord(raw) || !Array.isArray(raw.triggers)) {
			return;
		}
		const triggers: AgentTriggerValue[] = [];
		raw.triggers.forEach((rawTrigger, triggerIndex) => {
			if (!isRecord(rawTrigger)) {
				return;
			}
			const providerId = normalizeText(rawTrigger.providerId);
			const eventId = normalizeText(rawTrigger.eventId);
			if (!providerId || !eventId) {
				return;
			}
			const trigger = createAgentTriggerValue(
				providerId as AgentTriggerProviderId,
				eventId,
				triggerIndex + 1,
			);
			if (trigger) {
				triggers.push(trigger);
			}
		});
		if (triggers.length === 0) {
			return;
		}
		rules.push(
			createAgentAutomationRule({
				enabled: raw.enabled === false ? false : true,
				id: normalizeText(raw.id) ?? `automation-${ruleIndex + 1}`,
				name: normalizeText(raw.name),
				description: normalizeText(raw.description),
				prompt: normalizeText(raw.prompt),
				triggers,
			}),
		);
	});
	return rules.length > 0 ? rules : undefined;
}

export function normalizeAgentDraftPatch(value: unknown): StudioAgentDraftPatch | null {
	if (!isRecord(value)) {
		return null;
	}

	const patch: StudioAgentDraftPatch = {};

	for (const field of ALLOWED_TEXT_FIELDS) {
		const normalized = normalizeText(value[field]);
		if (normalized) {
			patch[field] = normalized;
		}
	}

	const tools = normalizeTextArray(value.tools);
	if (tools) {
		patch.tools = tools;
	}

	const conversationStarters = normalizeTextArray(value.conversationStarters);
	if (conversationStarters) {
		patch.conversationStarters = conversationStarters;
	}

	const avatarFallback = normalizeAvatarFallback(value.avatarFallback);
	if (avatarFallback) {
		patch.avatarFallback = avatarFallback;
	}

	for (const { field, category } of REFERENCE_PATCH_FIELDS) {
		if (Array.isArray(value[field])) {
			patch[field] = resolveCatalogNames(normalizeTextArray(value[field]) ?? [], category);
		}
	}

	const avatarSrc = normalizeAvatarSrc(value.avatarSrc);
	if (avatarSrc) {
		patch.avatarSrc = avatarSrc;
	}

	const conversationStarterIcons = normalizeTextArray(value.conversationStarterIcons);
	if (conversationStarterIcons) {
		patch.conversationStarterIcons = conversationStarterIcons;
	}

	if (isMemoryMode(value.memoryMode)) {
		patch.memoryMode = value.memoryMode;
	}
	if (isReasoningMode(value.reasoningMode)) {
		patch.reasoningMode = value.reasoningMode;
	}
	if (isKnowledgeMode(value.knowledgeMode)) {
		patch.knowledgeMode = value.knowledgeMode;
	}

	const subagentPrompts = normalizeSubagentPrompts(value.subagentPrompts);
	if (subagentPrompts) {
		patch.subagentPrompts = subagentPrompts;
		patch.subagents = getDerivedSubagentNames(
			subagentPrompts as unknown as Parameters<typeof getDerivedSubagentNames>[0],
		);
	}

	const triggers = normalizeTextArray(value.triggers);
	if (triggers) {
		patch.triggers = triggers;
	}
	const automationRules = normalizeAutomationRules(value.automationRules);
	if (automationRules) {
		patch.automationRules = automationRules;
	}

	if (value.action === "create" || value.action === "update") {
		patch.action = value.action;
	}

	return Object.keys(patch).length > 0 ? patch : null;
}

export function prepareStudioAgentDraftPatch({
	currentDraft,
	rawPatch,
}: {
	currentDraft: RovoDataParts["agent-result"];
	rawPatch: unknown;
}): StudioAgentDraftPatch | null {
	const normalized = normalizeAgentDraftPatch(rawPatch);
	if (!normalized) {
		return null;
	}

	let patch =
		normalized.description && !normalized.summary
			? { ...normalized, summary: normalized.description }
			: normalized;

	if (patch.triggers && !patch.automationRules) {
		const mergedAutomations = mergeTriggerPhrasesIntoDraft(
			currentDraft,
			patch.triggers,
		);
		if (mergedAutomations) {
			patch = {
				...patch,
				automationRules: mergedAutomations.automationRules,
				triggers: mergedAutomations.triggers,
			};
		}
	}

	return patch;
}
