"use client";

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.
// oxlint-disable react-doctor/no-multi-comp -- The test panel colocates the chat surface, header, and automation greeting subviews so they share one local contract.

import { Fragment, useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { RovoChatProvider, useRovoChat, type StudioSessionAgentEntry } from "@/app/contexts/context-rovo-chat";
import {
	DEFAULT_STARTER_ICON,
	getStarterIcon,
	type StarterIconKey,
} from "@/components/blocks/conversation-starters";
import { AgentAutomationFlowCover } from "@/components/blocks/triggers/components/agent-automation-flow-cover";
import {
	getAgentAutomationRuleLabel,
	getAgentTriggerReadableLabel,
	getTriggerProvider,
	type AgentAutomationRule,
	type AgentTriggerValue,
} from "@/components/blocks/triggers/data/trigger-catalog";
import { AgentTriggersDialog } from "@/components/ui-custom/agent-triggers-dialog";
import ChatPanel, { type ChatPanelAgentVersionOption } from "@/components/projects/sidebar-chat/page";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { getMessageText, type RovoDataParts, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import { resolveConversationStarterVisualIdentity, type RovoSuggestion } from "@/lib/rovo-suggestions";
import AutomationIcon from "@atlaskit/icon/core/automation";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import RefreshIcon from "@atlaskit/icon/core/refresh";

const AGENT_TEST_MAX_CONVERSATION_STARTERS = 3;

export interface AgentTestPanelProps {
	entry: StudioSessionAgentEntry;
	className?: string;
}

type AgentResultPayload = RovoDataParts["agent-result"] & Record<string, unknown>;

interface AgentTestVersionOption extends ChatPanelAgentVersionOption {
	result: RovoDataParts["agent-result"];
}

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

function getConversationStarterLabel(value: unknown): string | null {
	const directLabel = getNonEmptyString(value);
	if (directLabel) {
		return directLabel;
	}

	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	return getPayloadString(value as Record<string, unknown>, ["label", "prompt", "text", "title"]);
}

function getConversationStarterLabels(payload: AgentResultPayload): string[] {
	const rawStarters = payload.conversationStarters ?? payload.starters ?? payload.suggestions;
	if (!Array.isArray(rawStarters)) {
		return [];
	}

	const seenLabels = new Set<string>();
	const labels: string[] = [];
	for (const rawStarter of rawStarters) {
		const label = getConversationStarterLabel(rawStarter);
		if (!label) {
			continue;
		}

		const normalizedLabel = label.toLowerCase();
		if (seenLabels.has(normalizedLabel)) {
			continue;
		}

		seenLabels.add(normalizedLabel);
		labels.push(label);
		if (labels.length >= AGENT_TEST_MAX_CONVERSATION_STARTERS) {
			break;
		}
	}

	return labels;
}

function createAgentTestStarter(
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

function createAgentTestContextDescription(input: {
	description?: string;
	instructions?: string;
	payload: AgentResultPayload;
	profile: Pick<RovoAgentProfile, "byline" | "name" | "starters">;
	versionLabel: string;
}): string {
	const tools = getPayloadStringArray(input.payload, ["tools", "skills"]);
	const trigger = getPayloadString(input.payload, ["trigger"]);
	const guardrail = getPayloadString(input.payload, ["guardrail", "constraints"]);
	const starterLabels = input.profile.starters.map((starter) => starter.prompt ?? starter.label);

	return [
		"[Selected agent test]",
		`Agent: ${input.profile.name}`,
		`Version: ${input.versionLabel}`,
		`Byline: ${input.profile.byline}`,
		input.description ? `Description: ${input.description}` : null,
		input.instructions ? `Instructions: ${input.instructions}` : null,
		trigger ? `Trigger: ${trigger}` : null,
		tools.length > 0 ? `Tools: ${tools.join(", ")}` : null,
		guardrail ? `Guardrail: ${guardrail}` : null,
		starterLabels.length > 0 ? "Conversation starters:" : null,
		...starterLabels.map((starter) => `- ${starter}`),
		"Answer as this selected session-created agent while using the existing Rovo chat capabilities and available context.",
		"[End selected agent test]",
	]
		.filter((line): line is string => Boolean(line))
		.join("\n");
}

function buildAgentTestProfile(
	entry: StudioSessionAgentEntry,
	result: RovoDataParts["agent-result"],
	versionLabel: string,
): RovoAgentProfile {
	const payload = result as AgentResultPayload;
	const id = `agent-test-${entry.profile.id}`;
	const name = getPayloadString(payload, ["name", "agentName", "title"]) ?? entry.profile.name ?? "Agent test";
	const byline = getPayloadString(payload, ["byline", "sourceLabel", "generatedBy", "source"]) ?? "Custom agent test";
	const avatarSrc = getPayloadString(payload, ["avatarSrc", "avatarUrl", "iconSrc"]) ?? entry.profile.avatarSrc;
	const description =
		getPayloadString(payload, ["description", "summary", "shortDescription"]) ??
		entry.profile.description;
	const instructions =
		getPayloadString(payload, ["instructions", "contextDescription", "context", "systemPrompt", "prompt"]) ??
		entry.profile.contextDescription;
	const starterIcons = getPayloadStringArray(payload, ["conversationStarterIcons", "starterIcons", "suggestionIcons"]);
	const starters = getConversationStarterLabels(payload).map((starter, index) =>
		createAgentTestStarter(id, starter, index, {
			agentName: name,
			byline,
			description,
		}, starterIcons[index])
	);

	return {
		id,
		name,
		byline,
		avatarSrc,
		description,
		starters,
		contextDescription: createAgentTestContextDescription({
			description,
			instructions,
			payload,
			profile: {
				byline,
				name,
				starters,
			},
			versionLabel,
		}),
	};
}

function getAgentTestVersionOptions(entry: StudioSessionAgentEntry): readonly AgentTestVersionOption[] {
	// Draft is always neutral gray; it is never the "current" published version.
	const options: AgentTestVersionOption[] = [{
		id: "latest",
		label: "Draft",
		variant: "neutral",
		result: entry.draftResult,
	}];

	// Each published/updated entry is a real version. Label it just "V{n}"
	// (no duplicate "Published V1" summary, no "- Agent published" suffix) and
	// flag the live published version as current so the dropdown can mark it.
	const publishedVersions = entry.versionHistory.filter((version) => version.kind === "publish" || version.kind === "update");
	for (const [versionIndex, version] of publishedVersions.entries()) {
		options.push({
			id: `history:${version.id}`,
			label: `V${version.version}`,
			variant: "success",
			sectionBreakBefore: versionIndex === 0,
			isCurrent: version.version === entry.publishedVersion,
			result: version.snapshot,
		});
	}

	return options;
}

function AgentTestVersionSelect({
	onSelectVersion,
	selectedVersionId,
	versionOptions,
}: Readonly<{
	onSelectVersion: (versionId: string) => void;
	selectedVersionId: string;
	versionOptions: readonly ChatPanelAgentVersionOption[];
}>): ReactElement {
	const selectedVersion =
		versionOptions.find((version) => version.id === selectedVersionId) ??
		versionOptions[0];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Switch test version"
						className="h-8 shrink-0 gap-1.5 px-2 text-sm font-medium text-text"
						type="button"
						variant="ghost"
					/>
				}
			>
				<Badge variant={selectedVersion?.variant ?? "neutral"}>
					{selectedVersion?.label ?? "Draft"}
				</Badge>
				<ChevronDownIcon label="" size="small" spacing="none" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={8}>
				<DropdownMenuGroup>
					{versionOptions.map((version) => (
						<Fragment key={version.id}>
							{version.sectionBreakBefore ? <DropdownMenuSeparator /> : null}
							<DropdownMenuItem
								onSelect={() => onSelectVersion(version.id)}
								className={cn((version.variant ?? "success") === "neutral" && "bg-popover sticky top-0 z-10")}
								elemAfter={version.id === selectedVersion?.id ? <CheckMarkIcon label="Selected" /> : undefined}
							>
								<span className="flex min-w-0 items-center gap-2">
									<Badge variant={version.variant ?? "success"}>{version.label}</Badge>
									{version.isCurrent ? (
										<span className="text-xs text-text-subtle">Current</span>
									) : null}
								</span>
							</DropdownMenuItem>
						</Fragment>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AgentTestHeader({
	onReset,
	onSelectVersion,
	selectedVersionId,
	versionOptions,
}: Readonly<{
	onReset: () => void;
	onSelectVersion: (versionId: string) => void;
	selectedVersionId: string;
	versionOptions: readonly ChatPanelAgentVersionOption[];
}>): ReactElement {
	return (
		<div className="flex shrink-0 items-center justify-between gap-3 py-3">
			<div className="flex min-w-0 items-center gap-2">
				<AgentTestVersionSelect
					onSelectVersion={onSelectVersion}
					selectedVersionId={selectedVersionId}
					versionOptions={versionOptions}
				/>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="default"
				className="shrink-0 gap-1.5"
				onClick={onReset}
			>
				<RefreshIcon label="" size="small" spacing="none" />
				Reset
			</Button>
		</div>
	);
}

function AgentTestAutomationFlow({
	rule,
}: Readonly<{
	rule: AgentAutomationRule;
}>): ReactElement {
	return (
		<AgentAutomationFlowCover
			aria-hidden={false}
			aria-label={getAutomationOptionMetadata(rule)}
			rootElement="span"
			size="compact"
			triggers={rule.triggers}
		/>
	);
}

function getAutomationOptionMetadata(rule: AgentAutomationRule): string {
	const triggerLabels = rule.triggers
		.map((trigger) => getAgentTriggerReadableLabel(trigger).trim())
		.filter(Boolean);

	if (triggerLabels.length === 0) {
		return "No event triggers to agent instructions";
	}

	return `${triggerLabels.join(" and ")} to agent instructions`;
}

interface AutomationTestResult {
	payload: Record<string, unknown>;
	callback: Record<string, unknown>;
}

function createAutomationTestResult(
	rule: AgentAutomationRule,
	ruleIndex: number,
	trigger: AgentTriggerValue,
): AutomationTestResult {
	const provider = getTriggerProvider(trigger.providerId);
	const automationName = getAgentAutomationRuleLabel(rule, ruleIndex);
	const eventLabel = getAgentTriggerReadableLabel(trigger);
	const receivedAt = "2026-06-12T00:00:00.000Z";
	const payload = {
		automationId: rule.id,
		automationName,
		eventTriggerId: trigger.id,
		receivedAt,
		source: provider?.label ?? trigger.providerId,
		event: {
			providerId: trigger.providerId,
			eventId: trigger.eventId,
			label: eventLabel,
			params: trigger.params ?? {},
		},
		data: getProviderSampleData(trigger),
	};
	const callback = {
		status: "ok",
		callbackId: `callback-${rule.id}-${trigger.id}`,
		processedAt: receivedAt,
		automationId: rule.id,
		eventTriggerId: trigger.id,
		result: {
			message: `Sample ${eventLabel} callback received for ${automationName}.`,
			nextAction: "Agent instructions would run with this event payload.",
		},
	};

	return {
		payload,
		callback,
	};
}

function getProviderSampleData(trigger: AgentTriggerValue): Record<string, unknown> {
	switch (trigger.providerId) {
		case "jira":
			return {
				issueKey: "PROJ-248",
				summary: "Refresh quarterly planning goals",
				project: trigger.params?.project ?? "any-project",
				actor: trigger.params?.actor ?? "anyone",
				changeType: trigger.eventId,
			};
		case "confluence":
			return {
				pageId: "983421",
				title: "Quarterly planning notes",
				space: trigger.params?.space ?? "any-space",
				actor: trigger.params?.actor ?? "anyone",
				changeType: trigger.eventId,
			};
		case "github-gitlab":
			return {
				repository: trigger.params?.repository ?? "select-repos",
				pullRequest: 128,
				branch: "feature/automation-rule-test",
				action: trigger.eventId,
			};
		case "slack":
		case "microsoft-teams":
			return {
				channel: trigger.params?.channel ?? "triage",
				messageTs: "1781200000.000100",
				text: "Can this automation draft a summary?",
				action: trigger.eventId,
			};
		case "sentry":
			return {
				issueId: "SENTRY-42",
				service: trigger.params?.service ?? "any-service",
				level: "error",
				action: trigger.eventId,
			};
		case "linear":
			return {
				issueId: "LIN-321",
				team: trigger.params?.team ?? "any-team",
				status: "In review",
				action: trigger.eventId,
			};
		case "webhook":
			return {
				method: "POST",
				path: "/automations/sample-callback",
				body: { ok: true, event: trigger.eventId },
			};
		case "pagerduty":
			return {
				incidentId: "P12345",
				service: trigger.params?.service ?? "any-service",
				urgency: "high",
				action: trigger.eventId,
			};
		case "scheduled":
		default:
			return {
				schedule: trigger.eventId,
				timezone: "Australia/Sydney",
				firedAt: "2026-06-12T09:00:00.000+10:00",
			};
	}
}

interface AutomationRunFrame {
	/** Delay (ms) to wait BEFORE applying this frame. */
	delayMs: number;
	parts: RovoUIMessage["parts"];
}

interface AutomationRunPlan {
	userMessage: RovoUIMessage;
	/** Stable id reused across every frame so the assistant message updates in place. */
	assistantId: string;
	frames: AutomationRunFrame[];
}

// Builds a staged playback for an inline automation test run. No backend is
// involved — `handleRunAutomation` writes each frame into the conversation via
// `applyLocalTurn`, reusing `assistantId` so the message updates in place. The
// run replays realistically: a "Thought for Xs" chain whose tool calls appear
// one at a time (receive the scheduled event → query Jira for lost/no-bid RFPs →
// post the summary to Slack), then the human-friendly reply streams in. The
// sample event payload + callback result are preserved as the first tool's
// `input` and the last tool's `output`, so they live inside the collapsed
// thought disclosure instead of as always-visible code blocks.
function buildAutomationRunPlan(
	rule: AgentAutomationRule,
	ruleIndex: number,
): AutomationRunPlan | null {
	const trigger = rule.triggers[0];
	if (!trigger) {
		return null;
	}

	const label = getAgentAutomationRuleLabel(rule, ruleIndex);
	const result = createAutomationTestResult(rule, ruleIndex, trigger);
	const userMessage: RovoUIMessage = {
		id: crypto.randomUUID(),
		role: "user",
		parts: [{ type: "text", text: `Test "${label}"`, state: "done" }],
	};

	// Real wall-clock timestamps spanning ~the playback duration. They must track
	// "now" (not a fixed past date): the live thinking lifecycle measures elapsed
	// from the real clock, so a past startedAt would settle to a nonsense
	// "Thought for N days". Built in a click handler, so no SSR hydration concern.
	const baseTime = Date.now();
	const startedAt = new Date(baseTime).toISOString();
	const midAt = new Date(baseTime + 2700).toISOString();
	const endAt = new Date(baseTime + 5300).toISOString();
	const runId = crypto.randomUUID();
	const receiveToolCallId = `automation-run-receive-${runId}`;
	const findToolCallId = `automation-run-find-${runId}`;
	const postToolCallId = `automation-run-post-${runId}`;
	// Step (tool) labels — shown as the rows inside the trace.
	const receiveLabel = "Reading the scheduled event";
	const findLabel = "Finding lost / no-bid RFPs";
	const postLabel = "Posting the summary to Slack";
	// Header (parent) labels — the agent's intent per phase. Deliberately worded
	// differently from the step labels above so the trace header never echoes the
	// tool step that is currently running.
	const receiveHeaderLabel = "Picking up the scheduled run";
	const findHeaderLabel = "Reviewing this week's RFP outcomes";
	const postHeaderLabel = "Sending the rollup to sales leadership";
	const jql = 'project = "Enterprise RFP Response" AND status CHANGED TO ("Lost", "No Bid") DURING (-7d, now())';

	const lostRfps = [
		{ key: "RFP-318", account: "Northwind Logistics", outcome: "Lost" },
		{ key: "RFP-302", account: "Cobalt Health", outcome: "No Bid" },
		{ key: "RFP-289", account: "Meridian Bank", outcome: "Lost" },
	];
	const slackSummary = `*Weekly RFP outcomes — week ending Fri 12 Jun*\n• ${lostRfps
		.map((item) => `${item.key} — ${item.account} (${item.outcome})`)
		.join("\n• ")}`;

	// The cumulative thinking chain, in display order. Frames reveal growing
	// prefixes of this so each tool call appears (and completes) in turn.
	const thinkingParts: RovoUIMessage["parts"] = [
		// Phase 1 — receive the scheduled event (carries the sample payload).
		{
			type: "data-thinking-status",
			data: {
				label: receiveHeaderLabel,
				content: `The "${label}" flow fired on schedule. Reading the event payload before running the agent instructions.`,
				toolCallId: receiveToolCallId,
				input: result.payload,
				activity: "data",
				source: "fallback",
				timestamp: startedAt,
			},
		},
		{
			type: "data-thinking-event",
			id: `${receiveToolCallId}-start`,
			data: {
				eventId: `${receiveToolCallId}-start`,
				phase: "start",
				toolName: "automation.receive_event",
				label: receiveLabel,
				toolCallId: receiveToolCallId,
				input: result.payload,
				timestamp: startedAt,
			},
		},
		{
			type: "data-thinking-event",
			id: `${receiveToolCallId}-result`,
			data: {
				eventId: `${receiveToolCallId}-result`,
				phase: "result",
				toolName: "automation.receive_event",
				label: receiveLabel,
				toolCallId: receiveToolCallId,
				output: { status: "received", automation: label },
				outputPreview: "Scheduled event received.",
				timestamp: startedAt,
			},
		},
		// Phase 2 — query Jira for RFP work items that moved to Lost / No Bid.
		{
			type: "data-thinking-status",
			data: {
				label: findHeaderLabel,
				content: "Searching the Enterprise RFP Response project for work items that moved to Lost or No Bid in the last 7 days.",
				toolCallId: findToolCallId,
				input: { jql, window: "Past 7 days" },
				activity: "data",
				source: "fallback",
				timestamp: startedAt,
			},
		},
		{
			type: "data-thinking-event",
			id: `${findToolCallId}-start`,
			data: {
				eventId: `${findToolCallId}-start`,
				phase: "start",
				toolName: "jira.search_work_items",
				label: findLabel,
				toolCallId: findToolCallId,
				input: { jql },
				timestamp: startedAt,
			},
		},
		{
			type: "data-thinking-event",
			id: `${findToolCallId}-result`,
			data: {
				eventId: `${findToolCallId}-result`,
				phase: "result",
				toolName: "jira.search_work_items",
				label: findLabel,
				toolCallId: findToolCallId,
				output: { matched: lostRfps.length, items: lostRfps },
				outputPreview: `${lostRfps.length} RFPs moved to Lost or No Bid this week.`,
				timestamp: midAt,
			},
		},
		// Phase 3 — post the weekly summary to Slack (carries the callback).
		{
			type: "data-thinking-status",
			data: {
				label: postHeaderLabel,
				content: "Composing the weekly summary and posting it to #sales-leadership.",
				toolCallId: postToolCallId,
				input: { channel: "#sales-leadership", summary: slackSummary },
				activity: "results",
				source: "fallback",
				timestamp: midAt,
			},
		},
		{
			type: "data-thinking-event",
			id: `${postToolCallId}-start`,
			data: {
				eventId: `${postToolCallId}-start`,
				phase: "start",
				toolName: "slack.send_message",
				label: postLabel,
				toolCallId: postToolCallId,
				input: { channel: "#sales-leadership", text: slackSummary },
				timestamp: midAt,
			},
		},
		{
			type: "data-thinking-event",
			id: `${postToolCallId}-result`,
			data: {
				eventId: `${postToolCallId}-result`,
				phase: "result",
				toolName: "slack.send_message",
				label: postLabel,
				toolCallId: postToolCallId,
				output: result.callback,
				outputPreview: "Summary posted to #sales-leadership.",
				timestamp: endAt,
			},
		},
	];

	const replyHeadline = `✅ Test run complete — the **${label}** flow works.`;
	const replyBody = [
		"Every Friday at 9 AM, this flow gives a summary of all RFP work items that moved to a **Lost** or **No Bid** status that week and posts that summary as a Slack message to **#sales-leadership**.",
		"",
		`In this run I found **${lostRfps.length}** RFPs that moved to Lost or No Bid in the past week (${lostRfps
			.map((item) => item.key)
			.join(", ")}) and posted the summary to #sales-leadership.`,
	].join("\n");
	const fullReply = `${replyHeadline}\n\n${replyBody}`;
	const streamingText = (text: string): RovoUIMessage["parts"][number] => ({ type: "text", text, state: "streaming" });

	const frames: AutomationRunFrame[] = [
		// Tool calls appear (and complete) one phase at a time.
		{ delayMs: 0, parts: thinkingParts.slice(0, 1) },
		{ delayMs: 600, parts: thinkingParts.slice(0, 2) },
		{ delayMs: 1100, parts: thinkingParts.slice(0, 5) },
		{ delayMs: 1100, parts: thinkingParts.slice(0, 8) },
		{ delayMs: 1000, parts: thinkingParts.slice(0, 9) },
		// Reply streams in: headline first, then the body, then settle to done.
		{ delayMs: 700, parts: [...thinkingParts, streamingText(replyHeadline)] },
		{ delayMs: 450, parts: [...thinkingParts, streamingText(fullReply)] },
		{ delayMs: 350, parts: [...thinkingParts, { type: "text", text: fullReply, state: "done" }] },
	];

	return { userMessage, assistantId: crypto.randomUUID(), frames };
}

// Automation rows rendered directly after the conversation starters in the chat
// greeting. Clicking a row runs its sample inline.
function AgentTestAutomationGreetingRows({
	automationRules,
	onEditAutomation,
	onRunAutomation,
}: Readonly<{
	automationRules: readonly AgentAutomationRule[];
	onEditAutomation: (rule: AgentAutomationRule, ruleIndex: number) => void;
	onRunAutomation: (rule: AgentAutomationRule, ruleIndex: number) => void;
}>): ReactElement | null {
	if (automationRules.length === 0) {
		return null;
	}

	return (
		<>
			{automationRules.map((rule, ruleIndex) => (
				<AgentTestAutomationGreetingRow
					key={rule.id}
					onEdit={() => onEditAutomation(rule, ruleIndex)}
					onRun={() => onRunAutomation(rule, ruleIndex)}
					rule={rule}
					ruleIndex={ruleIndex}
				/>
			))}
		</>
	);
}

function AgentTestAutomationGreetingRow({
	onEdit,
	onRun,
	rule,
	ruleIndex,
}: Readonly<{
	onEdit: () => void;
	onRun: () => void;
	rule: AgentAutomationRule;
	ruleIndex: number;
}>): ReactElement {
	const label = getAgentAutomationRuleLabel(rule, ruleIndex);
	const hasTrigger = rule.triggers.length > 0;

	// The row is no longer a single button: it now hosts the run button plus a
	// hover-revealed Edit button. A nested `<button>` inside a `<button>` is
	// invalid HTML, so the row wrapper is a `<div>` that owns the hover surface
	// and the `group/automation-row` reveal context.
	return (
		<div className="group/automation-row flex w-full items-center rounded-[12px] pl-1.5 pr-2 transition-colors hover:bg-bg-neutral-subtle-hovered">
			<button
				aria-label={`Test ${label}`}
				className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] py-2 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focused disabled:pointer-events-none disabled:opacity-(--opacity-disabled)"
				disabled={!hasTrigger}
				onClick={onRun}
				type="button"
			>
				<IconTile
					aria-hidden
					className="shrink-0 border border-border bg-surface"
					icon={<AutomationIcon color={token("color.icon.subtle")} label={label} />}
					label={label}
					size="medium"
				/>
				<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
					<span className="menu-row-title min-w-0 truncate text-left">{label}</span>
					<span className="shrink-0">
						<AgentTestAutomationFlow rule={rule} />
					</span>
				</span>
			</button>
			{/* Hover-revealed "Edit" affordance. A text button has an intrinsic
			    width, so we animate it open with the `grid-cols-[0fr]→[1fr]` +
			    `overflow-hidden` idiom (the transitionable way to collapse a
			    variable-width element). `ml-0→ml-2` adds the 8px gap from the flow
			    badge only once revealed, on row hover or keyboard focus. */}
			<div className="ml-0 grid shrink-0 grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,margin] duration-normal ease-out group-hover/automation-row:ml-2 group-hover/automation-row:grid-cols-[1fr] group-hover/automation-row:opacity-100 group-focus-within/automation-row:ml-2 group-focus-within/automation-row:grid-cols-[1fr] group-focus-within/automation-row:opacity-100">
				<div className="min-w-0 overflow-hidden">
					<Button
						aria-label={`Edit ${label}`}
						className="pointer-events-none group-hover/automation-row:pointer-events-auto group-focus-within/automation-row:pointer-events-auto"
						onClick={onEdit}
						size="compact"
						type="button"
						variant="outline"
					>
						Edit
					</Button>
				</div>
			</div>
		</div>
	);
}

function AgentTestChatPanel({
	automationRules,
	testAgentProfile,
}: Readonly<{
	automationRules: readonly AgentAutomationRule[];
	testAgentProfile: RovoAgentProfile;
}>): ReactElement {
	const { selectedAgentId, selectAgent, applyLocalTurn } = useRovoChat();

	// The greeting flows come from a read-only test fixture. We hold an editable
	// local copy so the in-situ Edit dialog can commit changes; the whole panel
	// remounts (keyed RovoChatProvider) whenever the fixture/version changes, so
	// seeding from props once is correct without a sync effect.
	const [rules, setRules] = useState<readonly AgentAutomationRule[]>(automationRules);
	const [editingRule, setEditingRule] = useState<AgentAutomationRule | null>(null);
	// Increments per run so a newer test run supersedes an in-flight frame loop.
	const runAbortRef = useRef<AbortController | null>(null);
	useEffect(() => () => runAbortRef.current?.abort(), []);
	// Id of the assistant message currently "thinking" — drives the live
	// morphing-Rovo trace (expanded) while frames play; null settles it collapsed.
	const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);

	useEffect(() => {
		if (selectedAgentId !== testAgentProfile.id) {
			selectAgent(testAgentProfile.id, { preserveCurrentThread: true });
		}
	}, [selectAgent, selectedAgentId, testAgentProfile.id]);

	async function handleRunAutomation(rule: AgentAutomationRule, ruleIndex: number): Promise<void> {
		const plan = buildAutomationRunPlan(rule, ruleIndex);
		if (!plan) {
			return;
		}
		runAbortRef.current?.abort();
		const controller = new AbortController();
		runAbortRef.current = controller;
		const { userMessage, assistantId, frames } = plan;
		await applyLocalTurn({
			history: "replace",
			promptText: getMessageText(userMessage),
			userMessage,
			assistantMessageId: assistantId,
			assistantParts: frames[0]?.parts ?? [],
			assistantPartStages: frames.map((frame) => ({ delayMs: frame.delayMs, getAssistantParts: () => frame.parts })),
			signal: controller.signal,
			onThinkingMessageChange: setThinkingMessageId,
		});
	}

	function handleEditAutomation(rule: AgentAutomationRule): void {
		setEditingRule(rule);
	}

	function handleTriggersSave(automationRule: AgentAutomationRule): void {
		setRules((current) =>
			current.map((rule) => (rule.id === automationRule.id ? automationRule : rule)),
		);
	}

	const shouldShowTestHeader = testAgentProfile.starters.length > 0 || automationRules.length > 0;

	return (
		<>
			<ChatPanel
				onClose={() => {}}
				abortOnUnmount={false}
				externalThinkingMessageId={thinkingMessageId}
				containerClassName="h-full min-h-0 w-full overflow-visible"
				containerStyle={{ borderRadius: 0, borderWidth: 0, overflow: "visible" }}
				composerContainerClassName="px-0 [&_.chat-composer-surface]:max-w-[600px]"
				composerReservesContextBarSpace
				conversationContentClassName="px-0 max-w-[600px]"
				showAgentTestControls
				suppressCustomAgentTabs
				greeting={{
					heading: testAgentProfile.name,
					suggestions: testAgentProfile.starters,
					showStarterGroupLabel: shouldShowTestHeader,
					starterGroupLabel: "Test the following",
					agentTestSection: (
						<AgentTestAutomationGreetingRows
							automationRules={rules}
							onEditAutomation={handleEditAutomation}
							onRunAutomation={handleRunAutomation}
						/>
					),
				}}
				greetingSelectedAgent={testAgentProfile}
				hideAiCursor
				hideComposerSourceAndModelControls
				hideHeader
			/>
			{editingRule ? (
				<AgentTriggersDialog
					automationRule={editingRule}
					onOpenChange={(open) => {
						if (!open) {
							setEditingRule(null);
						}
					}}
					onSave={handleTriggersSave}
					open
					title="Edit flow"
				/>
			) : null}
		</>
	);
}

export function AgentTestPanel({
	className,
	entry,
}: Readonly<AgentTestPanelProps>): ReactElement {
	const versionOptions = useMemo(() => getAgentTestVersionOptions(entry), [entry]);
	const [selectedVersionId, setSelectedVersionId] = useState("latest");
	const [resetKey, setResetKey] = useState(0);
	if (!versionOptions.some((option) => option.id === selectedVersionId)) {
		setSelectedVersionId("latest");
	}
	const selectedOption = versionOptions.find((option) => option.id === selectedVersionId) ?? versionOptions[0];
	const selectedResult = selectedOption.result;
	const automationRules = useMemo<readonly AgentAutomationRule[]>(
		() => selectedResult.automationRules ?? [],
		[selectedResult.automationRules],
	);
	const snapshotKey = `${entry.profile.id}:${selectedOption.id}:${JSON.stringify(selectedResult)}`;
	const testAgentProfile = useMemo(
		() => buildAgentTestProfile(entry, selectedResult, selectedOption.label),
		[entry, selectedOption.label, selectedResult],
	);

	return (
		<section
			aria-label="Agent test"
			data-testid="agent-test-panel"
			// Match the agent header / Configure tab inset (px-4) so the test
			// chat tab strip and composer align with the header above.
			className={cn("h-full min-h-0 px-4", className)}
		>
			<div className="flex h-full min-h-0 flex-col bg-surface">
				<AgentTestHeader
					onReset={() => setResetKey((currentKey) => currentKey + 1)}
					onSelectVersion={setSelectedVersionId}
					selectedVersionId={selectedVersionId}
					versionOptions={versionOptions}
				/>
				<RovoChatProvider
					key={`${snapshotKey}:${resetKey}`}
					agentProfiles={[testAgentProfile]}
					autoSelectAgentId={testAgentProfile.id}
				>
					<AgentTestChatPanel
						automationRules={automationRules}
						testAgentProfile={testAgentProfile}
					/>
				</RovoChatProvider>
			</div>
		</section>
	);
}
