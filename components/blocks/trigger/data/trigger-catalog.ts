import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

export type AgentTriggerProviderId =
	| "scheduled"
	| "jira"
	| "confluence"
	| "github-gitlab"
	| "slack"
	| "microsoft-teams"
	| "sentry"
	| "linear"
	| "webhook"
	| "pagerduty";

export type AgentTriggerConnectionState =
	| "connected"
	| "needs-connection"
	| "connecting"
	| "connection-error";

export interface AgentTriggerOption {
	label: string;
	value: string;
	description?: string;
}

export interface AgentTriggerParamDefinition {
	id: string;
	label: string;
	connector: string;
	placeholder: string;
	defaultValue?: string;
	options: readonly AgentTriggerOption[];
}

export interface AgentTriggerEventDefinition {
	id: string;
	label: string;
	description: string;
	groupLabel?: string;
	requiresConnection?: boolean;
	params?: readonly AgentTriggerParamDefinition[];
}

export interface AgentTriggerProviderDefinition {
	id: AgentTriggerProviderId;
	label: string;
	description: string;
	icon: AgentTriggerProviderIcon;
	requiresConnection?: boolean;
	events: readonly AgentTriggerEventDefinition[];
}

export type AgentTriggerProviderIcon =
	| { kind: "atlassian-logo"; name: "jira" | "confluence" | "teams" | "opsgenie" | "bitbucket" }
	| { kind: "atlaskit-icon"; name: "automation" | "branch" | "clock" | "incident" | "webhook" }
	| { kind: "third-party"; name: ThirdPartyLogoName }
	| { kind: "image"; src: string };

export interface AgentTriggerValue {
	id: string;
	providerId: AgentTriggerProviderId;
	eventId: string;
	label?: string;
	params?: Readonly<Record<string, string>>;
	connectionState?: AgentTriggerConnectionState;
	/** Legacy shared automation prompt mirrored across all trigger rows. */
	prompt?: string;
	/** Legacy shared automation name mirrored across all trigger rows. */
	automationName?: string;
	/** Whether the trigger is active. Treated as `true` when undefined. */
	enabled?: boolean;
}

export interface AgentAutomationRule {
	id: string;
	name?: string;
	/** Short human summary of what the automation does, shown under the name in the editor. */
	description?: string;
	prompt?: string;
	/** Whether the automation rule is active. Treated as `true` when undefined. */
	enabled?: boolean;
	triggers: readonly AgentTriggerValue[];
}

const REPOSITORY_OPTIONS = [
	{ label: "Select repos", value: "select-repos" },
	{ label: "vpf", value: "vpf", description: "eevennsoh" },
	{ label: "proximity", value: "proximity", description: "eevennsoh" },
	{ label: "venn-prototype-skills", value: "venn-prototype-skills", description: "eevennsoh" },
	{ label: "venn-prototyping-kit", value: "venn-prototyping-kit", description: "eevennsoh" },
	{ label: "vpk", value: "vpk", description: "eevennsoh" },
] as const satisfies readonly AgentTriggerOption[];

const ACTOR_OPTIONS = [
	{ label: "Anyone", value: "anyone" },
	{ label: "Me", value: "me" },
	{ label: "Specific people", value: "specific-people" },
] as const satisfies readonly AgentTriggerOption[];

const PROJECT_OPTIONS = [
	{ label: "Any project", value: "any-project" },
	{ label: "Rovo Studio", value: "rovo-studio" },
	{ label: "Enterprise RFP Response", value: "enterprise-rfp-response" },
] as const satisfies readonly AgentTriggerOption[];

const SPACE_OPTIONS = [
	{ label: "Any space", value: "any-space" },
	{ label: "Product", value: "product" },
	{ label: "Engineering", value: "engineering" },
] as const satisfies readonly AgentTriggerOption[];

const CHANNEL_OPTIONS = [
	{ label: "Select channels", value: "select-channels" },
	{ label: "#triage", value: "triage" },
	{ label: "#incidents", value: "incidents" },
	{ label: "#releases", value: "releases" },
] as const satisfies readonly AgentTriggerOption[];

const SERVICE_OPTIONS = [
	{ label: "Any service", value: "any-service" },
	{ label: "Frontend", value: "frontend" },
	{ label: "API", value: "api" },
] as const satisfies readonly AgentTriggerOption[];

const TEAM_OPTIONS = [
	{ label: "Any team", value: "any-team" },
	{ label: "Product engineering", value: "product-engineering" },
	{ label: "Support", value: "support" },
] as const satisfies readonly AgentTriggerOption[];

const REPOSITORY_PARAM = {
	id: "repository",
	label: "Repository",
	connector: "in",
	placeholder: "Select repos",
	defaultValue: "select-repos",
	options: REPOSITORY_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

const ACTOR_PARAM = {
	id: "actor",
	label: "Actor",
	connector: "by",
	placeholder: "Anyone",
	defaultValue: "anyone",
	options: ACTOR_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

const PROJECT_PARAM = {
	id: "project",
	label: "Project",
	connector: "in",
	placeholder: "Any project",
	defaultValue: "any-project",
	options: PROJECT_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

const SPACE_PARAM = {
	id: "space",
	label: "Space",
	connector: "in",
	placeholder: "Any space",
	defaultValue: "any-space",
	options: SPACE_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

const CHANNEL_PARAM = {
	id: "channel",
	label: "Channel",
	connector: "in",
	placeholder: "Select channels",
	defaultValue: "select-channels",
	options: CHANNEL_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

const SERVICE_PARAM = {
	id: "service",
	label: "Service",
	connector: "for",
	placeholder: "Any service",
	defaultValue: "any-service",
	options: SERVICE_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

const TEAM_PARAM = {
	id: "team",
	label: "Team",
	connector: "for",
	placeholder: "Any team",
	defaultValue: "any-team",
	options: TEAM_OPTIONS,
} as const satisfies AgentTriggerParamDefinition;

export const TRIGGER_PROVIDERS = [
	{
		id: "scheduled",
		label: "Scheduled",
		description: "Run the agent on a fixed cadence.",
		icon: { kind: "atlaskit-icon", name: "clock" },
		events: [
			{
				id: "every-hour",
				label: "Every hour",
				description: "Run once every hour.",
			},
			{
				id: "every-weekday-morning",
				label: "Every weekday morning",
				description: "Run on weekdays at the start of the workday.",
			},
			{
				id: "daily-at-7am",
				label: "Every day at 7:00 AM",
				description: "Run once every morning at 7:00 AM.",
			},
			{
				id: "weekly-friday-9am",
				label: "Custom schedule (Every Friday, 9am)",
				description: "Run once a week, every Friday at 9:00 AM.",
			},
			{
				id: "custom-schedule",
				label: "Custom schedule",
				description: "Use a custom recurring schedule.",
			},
		],
	},
	{
		id: "jira",
		label: "Jira",
		description: "React to Jira work item activity.",
		icon: { kind: "atlassian-logo", name: "jira" },
		events: [
			{
				id: "work-item-created",
				label: "Work item created",
				description: "Run when a new Jira work item is created.",
				params: [PROJECT_PARAM, ACTOR_PARAM],
			},
			{
				id: "work-item-updated",
				label: "Work item updated",
				description: "Run when a Jira work item changes.",
				params: [PROJECT_PARAM, ACTOR_PARAM],
			},
			{
				id: "status-changed",
				label: "Status changed",
				description: "Run when a work item transitions between statuses.",
				params: [PROJECT_PARAM, ACTOR_PARAM],
			},
			{
				id: "comment-added",
				label: "Comment added",
				description: "Run when a comment is added to a work item.",
				params: [PROJECT_PARAM, ACTOR_PARAM],
			},
		],
	},
	{
		id: "confluence",
		label: "Confluence",
		description: "React to page and space activity.",
		icon: { kind: "atlassian-logo", name: "confluence" },
		events: [
			{
				id: "page-published",
				label: "Page published",
				description: "Run when a page is published.",
				params: [SPACE_PARAM, ACTOR_PARAM],
			},
			{
				id: "page-updated",
				label: "Page updated",
				description: "Run when a page is edited.",
				params: [SPACE_PARAM, ACTOR_PARAM],
			},
			{
				id: "comment-added",
				label: "Comment added",
				description: "Run when someone comments on a page.",
				params: [SPACE_PARAM, ACTOR_PARAM],
			},
			{
				id: "scheduled-page-review",
				label: "Scheduled page review",
				description: "Run a scheduled review for selected Confluence spaces.",
				params: [SPACE_PARAM],
			},
		],
	},
	{
		id: "github-gitlab",
		label: "GitHub / GitLab",
		description: "React to repository and pull request activity.",
		icon: { kind: "atlaskit-icon", name: "branch" },
		requiresConnection: true,
		events: [
			{
				id: "draft-opened",
				label: "Draft opened",
				description: "Run when a draft pull request or merge request opens.",
				params: [REPOSITORY_PARAM, ACTOR_PARAM],
			},
			{
				id: "pull-request-opened",
				label: "Pull request opened",
				description: "Run when a pull request or merge request opens.",
				params: [REPOSITORY_PARAM, ACTOR_PARAM],
			},
			{
				id: "comment-added",
				label: "Comment added",
				description: "Run when a review or discussion comment is added.",
				params: [REPOSITORY_PARAM, ACTOR_PARAM],
			},
			{
				id: "push-to-branch",
				label: "New push to branch",
				description: "Run when commits are pushed to a branch.",
				params: [REPOSITORY_PARAM, ACTOR_PARAM],
			},
			{
				id: "label-change",
				label: "Label change",
				description: "Run when a pull request label changes.",
				groupLabel: "GitHub only",
				params: [REPOSITORY_PARAM, ACTOR_PARAM],
			},
			{
				id: "checks-completed",
				label: "Checks completed",
				description: "Run when GitHub checks finish.",
				groupLabel: "GitHub only",
				params: [REPOSITORY_PARAM],
			},
		],
	},
	{
		id: "slack",
		label: "Slack",
		description: "React to messages and mentions.",
		icon: { kind: "third-party", name: "slack" },
		requiresConnection: true,
		events: [
			{
				id: "new-message",
				label: "New message",
				description: "Run when a new message appears in selected channels.",
				params: [CHANNEL_PARAM],
			},
			{
				id: "mention",
				label: "Mention",
				description: "Run when the agent is mentioned.",
				params: [CHANNEL_PARAM],
			},
			{
				id: "emoji-reaction",
				label: "Emoji reaction",
				description: "Run when a reaction is added in selected channels.",
				params: [CHANNEL_PARAM, ACTOR_PARAM],
			},
		],
	},
	{
		id: "microsoft-teams",
		label: "Microsoft Teams",
		description: "React to Teams channel activity.",
		icon: { kind: "atlassian-logo", name: "teams" },
		requiresConnection: true,
		events: [
			{
				id: "new-message",
				label: "New message",
				description: "Run when a new Teams message is posted.",
				params: [CHANNEL_PARAM],
			},
			{
				id: "mention",
				label: "Mention",
				description: "Run when the agent is mentioned in Teams.",
				params: [CHANNEL_PARAM],
			},
		],
	},
	{
		id: "sentry",
		label: "Sentry",
		description: "React to errors and regressions.",
		icon: { kind: "third-party", name: "sentry" },
		requiresConnection: true,
		events: [
			{
				id: "issue-created",
				label: "Issue created",
				description: "Run when Sentry creates a new issue.",
				params: [SERVICE_PARAM],
			},
			{
				id: "issue-regressed",
				label: "Issue regressed",
				description: "Run when a resolved issue regresses.",
				params: [SERVICE_PARAM],
			},
		],
	},
	{
		id: "linear",
		label: "Linear",
		description: "React to Linear issue activity.",
		icon: { kind: "atlaskit-icon", name: "automation" },
		requiresConnection: true,
		events: [
			{
				id: "issue-created",
				label: "Issue created",
				description: "Run when a Linear issue is created.",
				params: [TEAM_PARAM, ACTOR_PARAM],
			},
			{
				id: "issue-updated",
				label: "Issue updated",
				description: "Run when a Linear issue changes.",
				params: [TEAM_PARAM, ACTOR_PARAM],
			},
			{
				id: "status-changed",
				label: "Status changed",
				description: "Run when a Linear issue changes status.",
				params: [TEAM_PARAM, ACTOR_PARAM],
			},
		],
	},
	{
		id: "webhook",
		label: "Webhook Triggered",
		description: "Run when an external service calls a webhook.",
		icon: { kind: "atlaskit-icon", name: "webhook" },
		events: [
			{
				id: "incoming-webhook",
				label: "Incoming webhook",
				description: "Run when a webhook request is received.",
			},
		],
	},
	{
		id: "pagerduty",
		label: "PagerDuty",
		description: "React to incident lifecycle events.",
		icon: { kind: "third-party", name: "pagerduty" },
		requiresConnection: true,
		events: [
			{
				id: "incident-triggered",
				label: "Incident triggered",
				description: "Run when a new incident is triggered.",
				params: [SERVICE_PARAM],
			},
			{
				id: "incident-acknowledged",
				label: "Incident acknowledged",
				description: "Run when an incident is acknowledged.",
				params: [SERVICE_PARAM],
			},
			{
				id: "incident-resolved",
				label: "Incident resolved",
				description: "Run when an incident is resolved.",
				params: [SERVICE_PARAM],
			},
		],
	},
] as const satisfies readonly AgentTriggerProviderDefinition[];

export function getTriggerProvider(
	providerId: AgentTriggerProviderId,
): AgentTriggerProviderDefinition | undefined {
	return TRIGGER_PROVIDERS.find((provider) => provider.id === providerId);
}

export function getTriggerEvent(
	providerId: AgentTriggerProviderId,
	eventId: string,
): AgentTriggerEventDefinition | undefined {
	return getTriggerProvider(providerId)?.events.find((event) => event.id === eventId);
}

export function getAgentTriggerDefaultConnectionState(
	provider: AgentTriggerProviderDefinition,
	event: AgentTriggerEventDefinition,
): AgentTriggerConnectionState {
	return provider.requiresConnection || event.requiresConnection ? "needs-connection" : "connected";
}

/**
 * Session-scoped set of providers the user has "connected" this session. The
 * connection flow is a fake demo affordance — connecting a provider once marks
 * ALL its triggers connected and persists in memory until a full reload. Lives
 * here (module scope) so both the rule-builder dialog and the studio config
 * panel share one source of truth.
 */
const sessionConnectedProviders = new Set<AgentTriggerProviderId>();

export function markSessionProviderConnected(providerId: AgentTriggerProviderId): void {
	sessionConnectedProviders.add(providerId);
}

export function isSessionProviderConnected(providerId: AgentTriggerProviderId): boolean {
	return sessionConnectedProviders.has(providerId);
}

export function createAgentTriggerValue(
	providerId: AgentTriggerProviderId,
	eventId: string,
	index = 1,
): AgentTriggerValue | null {
	const provider = getTriggerProvider(providerId);
	const event = provider ? getTriggerEvent(providerId, eventId) : undefined;

	if (!provider || !event) {
		return null;
	}

	const params = Object.fromEntries(
		(event.params ?? []).map((param) => [
			param.id,
			param.defaultValue ?? param.options[0]?.value ?? "",
		]),
	);
	const trigger = {
		id: `${providerId}-${eventId}-${index}`,
		providerId,
		eventId,
		params,
		connectionState: isSessionProviderConnected(providerId)
			? "connected"
			: getAgentTriggerDefaultConnectionState(provider, event),
		prompt: "",
	} satisfies AgentTriggerValue;

	return {
		...trigger,
		label: getAgentTriggerReadableLabel(trigger),
	};
}

export function getAgentTriggerParamLabel(
	param: AgentTriggerParamDefinition,
	value: string | undefined,
): string {
	const option = param.options.find((candidate) => candidate.value === value);
	return option?.label ?? param.placeholder;
}

export function getAgentTriggerReadableLabel(trigger: AgentTriggerValue): string {
	const provider = getTriggerProvider(trigger.providerId);
	const event = provider ? getTriggerEvent(provider.id, trigger.eventId) : undefined;

	if (!provider || !event) {
		return trigger.label?.trim() || "Unknown trigger";
	}

	if (!event.params || event.params.length === 0) {
		return event.label;
	}

	return event.params.reduce((label, param) => {
		const valueLabel = getAgentTriggerParamLabel(param, trigger.params?.[param.id]);
		return `${label} ${param.connector} ${valueLabel}`;
	}, event.label);
}

/** A trigger counts as enabled unless its `enabled` flag is explicitly `false`. */
export function isAgentTriggerEnabled(trigger: AgentTriggerValue): boolean {
	return trigger.enabled !== false;
}

/**
 * Maps a free-text trigger string (as emitted by agent generation) to a
 * structured `scheduled` event id, or `undefined` when it isn't a recognized
 * recurring schedule. Lets a generated "every day at 7am" line hydrate into a
 * real structured trigger (clock icon + schedule semantics) instead of a plain
 * label-only chip. Order matters: the most specific time match wins.
 */
export function inferScheduledEventId(trigger: string): string | undefined {
	const text = trigger.toLowerCase();
	if (/\b(7|seven)(:\.?0{0,2})?\s*(am|a\.m\.)\b|\b7\s*o'?clock/.test(text)) {
		return "daily-at-7am";
	}
	if (/\b(hourly|every hour|each hour)\b/.test(text)) {
		return "every-hour";
	}
	if (/\b(weekday morning|every morning|each morning|start of the workday|every weekday)\b/.test(text)) {
		return "every-weekday-morning";
	}
	return undefined;
}

/**
 * Infers structured `triggerDefinitions` from a list of generated trigger
 * strings. Returns `undefined` unless EVERY string maps to a known scheduled
 * event, so the definitions stay index-aligned with the trigger labels (the
 * summary UI only shows provider icons when the two arrays align). A mixed list
 * (some schedule, some not) is left as plain label-only chips.
 */
export function inferScheduledTriggerDefinitions(
	triggers: readonly string[] | undefined,
): AgentTriggerValue[] | undefined {
	if (!triggers || triggers.length === 0) {
		return undefined;
	}

	const definitions: AgentTriggerValue[] = [];
	for (let index = 0; index < triggers.length; index += 1) {
		const eventId = inferScheduledEventId(triggers[index]);
		if (!eventId) {
			return undefined;
		}
		const definition = createAgentTriggerValue("scheduled", eventId, index + 1);
		if (!definition) {
			return undefined;
		}
		definitions.push(definition);
	}

	return definitions;
}

/**
 * Keyword → (provider, event) inference for a single free-text trigger string.
 * Each provider is matched by name/domain keywords, then a best-fit event is
 * chosen from phrasing cues. A schedule/cadence catch-all ensures every string
 * resolves to *some* provider so {@link inferTriggerDefinitions} can attach a
 * per-trigger icon (templates author their triggers to name a provider, so this
 * catch-all is only a safety net for arbitrary generated strings).
 */
function inferTriggerProviderEvent(
	trigger: string,
): { providerId: AgentTriggerProviderId; eventId: string } | undefined {
	const text = trigger.toLowerCase();
	const has = (re: RegExp) => re.test(text);

	// PagerDuty / incidents (check before scheduled so "incident ... due" maps here).
	if (has(/\bpagerduty\b|\bon[-\s]?call\b|\bpages?\b|\bincident\b|\balert\b/)) {
		const eventId = has(/\bresolved\b/)
			? "incident-resolved"
			: has(/\backnowledg/)
				? "incident-acknowledged"
				: "incident-triggered";
		return { providerId: "pagerduty", eventId };
	}
	// Sentry / errors.
	if (has(/\bsentry\b|\berror\b|\bexception\b|\bcrash\b|\bspike/)) {
		return { providerId: "sentry", eventId: has(/\bregress/) ? "issue-regressed" : "issue-created" };
	}
	// GitHub / GitLab / code.
	if (has(/\bgithub\b|\bgitlab\b|\bpull request\b|\bpr\b|\bcommit\b|\bbranch\b|\brelease is cut\b|\bmerge/)) {
		const eventId = has(/\brelease is cut\b|\bpush\b|\bmerge/)
			? "push-to-branch"
			: has(/\bcheck/)
				? "checks-completed"
				: has(/\bcomment\b/)
					? "comment-added"
					: "pull-request-opened";
		return { providerId: "github-gitlab", eventId };
	}
	// Slack.
	if (has(/\bslack\b|#|\bchannel\b/)) {
		const eventId = has(/\bmention/) ? "mention" : has(/\breact|emoji/) ? "emoji-reaction" : "new-message";
		return { providerId: "slack", eventId };
	}
	// Microsoft Teams.
	if (has(/\bmicrosoft teams\b|\bteams\b/)) {
		return { providerId: "microsoft-teams", eventId: has(/\bmention/) ? "mention" : "new-message" };
	}
	// Linear.
	if (has(/\blinear\b/)) {
		const eventId = has(/\bstatus\b/) ? "status-changed" : has(/\bupdated?\b/) ? "issue-updated" : "issue-created";
		return { providerId: "linear", eventId };
	}
	// Confluence / docs / DACI.
	if (has(/\bconfluence\b|\bdaci\b|\bpage\b|\bdoc\b|\bspace\b|\bwiki\b|\bpostmortem\b|\bprd\b/)) {
		const eventId = has(/\breview\b/)
			? "scheduled-page-review"
			: has(/\bupdated?\b/)
				? "page-updated"
				: has(/\bcomment\b/)
					? "comment-added"
					: "page-published";
		return { providerId: "confluence", eventId };
	}
	// Jira / delivery work.
	if (has(/\bjira\b|\bissue\b|\bwork item\b|\bsprint\b|\bbacklog\b|\bepic\b|\bbug\b|\bmilestone\b|\bticket\b|\bgoal\b/)) {
		const eventId = has(/\bblocked\b|\bstatus\b|\bmarked\b|\bclose|\breleased?\b/)
			? "status-changed"
			: has(/\bupdated?\b/)
				? "work-item-updated"
				: has(/\bcomment\b/)
					? "comment-added"
					: "work-item-created";
		return { providerId: "jira", eventId };
	}
	// Explicit webhook.
	if (has(/\bwebhook\b/)) {
		return { providerId: "webhook", eventId: "incoming-webhook" };
	}
	// Schedule / cadence (covers "due", "weekly", "quarter", "every", etc.).
	const scheduledEventId = inferScheduledEventId(trigger);
	if (scheduledEventId || has(/\bschedul|\bevery\b|\bdaily\b|\bweekly\b|\bquarter|\bcadence\b|\bdue\b|\bmorning\b|\bhourly\b/)) {
		return { providerId: "scheduled", eventId: scheduledEventId ?? "custom-schedule" };
	}
	// Universal fallback: a generic incoming event. This guarantees EVERY trigger
	// resolves to a structured, editable definition (provider + event), so a
	// trigger chip is never a dead label and clicking it always opens a populated
	// rule builder rather than an empty one.
	return { providerId: "webhook", eventId: "incoming-webhook" };
}

/**
 * Infers structured `triggerDefinitions` from generated/authored trigger strings,
 * mapping EACH string independently to a provider+event so every chip shows a
 * per-provider icon, carries connection state, AND opens a populated rule builder
 * when clicked. inferTriggerProviderEvent always resolves (universal webhook
 * fallback), so a non-empty input always yields a full, index-aligned array —
 * never a dead label-only trigger. Returns `undefined` only for empty input.
 */
export function inferTriggerDefinitions(
	triggers: readonly string[] | undefined,
): AgentTriggerValue[] | undefined {
	if (!triggers || triggers.length === 0) {
		return undefined;
	}

	const definitions: AgentTriggerValue[] = [];
	for (let index = 0; index < triggers.length; index += 1) {
		const match = inferTriggerProviderEvent(triggers[index]);
		if (!match) {
			continue;
		}
		const definition = createAgentTriggerValue(match.providerId, match.eventId, index + 1);
		if (definition) {
			definitions.push(definition);
		}
	}

	return definitions.length > 0 ? definitions : undefined;
}

export function createAgentAutomationRule({
	enabled = true,
	id,
	name,
	description,
	prompt,
	triggers,
}: Readonly<{
	enabled?: boolean;
	id: string;
	name?: string;
	description?: string;
	prompt?: string;
	triggers: readonly AgentTriggerValue[];
}>): AgentAutomationRule {
	return {
		id,
		name,
		description,
		prompt,
		enabled,
		triggers: [...triggers],
	};
}

export function inferAutomationRules(
	triggers: readonly string[] | undefined,
	options?: Readonly<{
		automationName?: string;
		prompt?: string;
	}>,
): AgentAutomationRule[] | undefined {
	const triggerDefinitions = inferTriggerDefinitions(triggers);
	if (!triggerDefinitions || triggerDefinitions.length === 0) {
		return undefined;
	}

	return [
		createAgentAutomationRule({
			id: "automation-1",
			name: options?.automationName,
			prompt: options?.prompt,
			triggers: triggerDefinitions,
		}),
	];
}

export function getAgentAutomationRuleLabel(rule: AgentAutomationRule, index = 0): string {
	const name = rule.name?.trim();
	return name && name.length > 0 ? name : `Automation ${index + 1}`;
}

export function serializeAgentTriggerLabels(
	triggers: readonly AgentTriggerValue[] | undefined,
): string[] {
	return (triggers ?? [])
		.map((trigger) => getAgentTriggerReadableLabel(trigger).trim())
		.filter(Boolean);
}

export const DEFAULT_CONFIGURED_TRIGGER_VALUES = [
	createAgentTriggerValue("scheduled", "every-hour", 1),
	createAgentTriggerValue("github-gitlab", "draft-opened", 2),
].filter(Boolean) as AgentTriggerValue[];

export const DEFAULT_CONFIGURED_AUTOMATION_RULES = [
	createAgentAutomationRule({
		id: "automation-1",
		name: "Draft review automation",
		triggers: DEFAULT_CONFIGURED_TRIGGER_VALUES,
	}),
] as const satisfies readonly AgentAutomationRule[];

export const DEFAULT_NEEDS_CONNECTION_TRIGGER_VALUES = [
	{
		...(createAgentTriggerValue("scheduled", "every-hour", 1) as AgentTriggerValue),
		connectionState: "connected",
	},
	{
		...(createAgentTriggerValue("github-gitlab", "draft-opened", 2) as AgentTriggerValue),
		connectionState: "connected",
	},
	{
		...(createAgentTriggerValue("slack", "new-message", 3) as AgentTriggerValue),
		connectionState: "needs-connection",
	},
] as const satisfies readonly AgentTriggerValue[];
