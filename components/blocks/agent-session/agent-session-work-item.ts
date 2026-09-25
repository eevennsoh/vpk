import { toAgentSessionFlyoutItem } from "@/components/blocks/agent-list/agent-list-session";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue/agent-activity";
import type { JiraSidebarSessionItem } from "@/components/blocks/product-sidebar/variants/jira";
import type { JiraSessionFlyoutSurfaceProps } from "@/components/blocks/product-sidebar/variants/jira-session-flyout";

import type { AgentSessionItem } from "./agent-session-types";

/**
 * Default flyout suggestion: the key the session already names in its details.
 *
 * Lives beside the card rather than inside it so the card file exports only a
 * component and Fast Refresh can preserve its state.
 */
export function suggestedAgentSessionWorkItemKey(item: AgentSessionItem): string | undefined {
	return item.sessionDetails?.issueKey;
}

/**
 * The work-item key the untracked-work flyout should offer.
 *
 * Several candidate keys collapse to the first: the flyout is one suggestion,
 * not one chin row per key.
 */
export function resolveAgentSessionWorkItemKey(
	item: AgentSessionItem,
	getSuggestedWorkItemKey?: (item: AgentSessionItem) => string | undefined,
	getSuggestedWorkItemKeys?: (item: AgentSessionItem) => readonly string[] | undefined,
): string | undefined {
	const firstKey = getSuggestedWorkItemKeys?.(item)?.[0];
	if (firstKey !== undefined) {
		return firstKey;
	}

	return getSuggestedWorkItemKey?.(item) ?? suggestedAgentSessionWorkItemKey(item);
}

/** Restores a chin-row activity from a detached session so drag-in can reattach. */
export function toJiraIssueAgentActivityFromSession(item: AgentSessionItem): JiraIssueAgentActivity {
	return {
		agentBrandName: item.agent.brandName,
		...(item.agent.vpkLogo ? { agentVpkLogo: item.agent.vpkLogo } : {}),
		avatarSrc: item.agent.avatarSrc,
		id: item.id,
		label: item.title,
		name: item.agent.name,
		state: item.state === "needs-input" || item.state === "attention"
			? "awaiting-input"
			: item.state === "complete"
				? "completed"
				: "working",
		...(item.invokedBy ? { invokedBy: item.invokedBy } : {}),
		...(item.host !== undefined ? { host: item.host } : {}),
		...(item.role !== undefined ? { role: item.role } : {}),
		...(item.timeLabel ? { timeLabel: item.timeLabel } : {}),
	};
}

/** Maps a session row onto the untracked-work flyout payload, with an optional key override. */
export function toAgentSessionUntrackedWorkFlyoutItem(
	item: AgentSessionItem,
	issueKey?: string,
): JiraSidebarSessionItem {
	const session = toAgentSessionFlyoutItem(item);
	const trimmed = issueKey?.trim();
	if (trimmed === undefined || trimmed.length === 0 || trimmed === session.issueKey) {
		return session;
	}

	return { ...session, issueKey: trimmed };
}

/**
 * Translates flyout-shaped work-item actions back onto the Agent Session row
 * model. The flyout speaks `JiraSidebarSessionItem`; every Agent Session
 * callback speaks `AgentSessionItem`.
 */
export function bindAgentSessionFlyoutActions(
	items: readonly AgentSessionItem[],
	actions: Readonly<{
		capturedItemIds?: ReadonlySet<string>;
		onArchiveSession?: (item: AgentSessionItem) => void;
		onCreateWorkItem?: (item: AgentSessionItem) => void;
		onLinkWorkItem?: (item: AgentSessionItem, workItemKey?: string) => void;
		onSubtasks?: (item: AgentSessionItem) => void;
	}>,
): Pick<
	JiraSessionFlyoutSurfaceProps,
	"onAddAsSubtask" | "onArchiveSession" | "onCreateWorkItem" | "onLinkWorkItem"
> {
	const byId = new Map(items.map((item: AgentSessionItem) => [item.id, item] as const));
	const resolve = (session: JiraSidebarSessionItem) => byId.get(session.id);
	const isCaptured = (session: JiraSidebarSessionItem) =>
		actions.capturedItemIds?.has(session.id) ?? false;

	return {
		onAddAsSubtask: actions.onSubtasks === undefined
			? undefined
			: (session: JiraSidebarSessionItem) => {
				if (isCaptured(session)) {
					return;
				}
				const item = resolve(session);
				if (item !== undefined) {
					actions.onSubtasks?.(item);
				}
			},
		onArchiveSession: actions.onArchiveSession === undefined
			? undefined
			: (session: JiraSidebarSessionItem) => {
				const item = resolve(session);
				if (item !== undefined) {
					actions.onArchiveSession?.(item);
				}
			},
		onCreateWorkItem: actions.onCreateWorkItem === undefined
			? undefined
			: (session: JiraSidebarSessionItem) => {
				if (isCaptured(session)) {
					return;
				}
				const item = resolve(session);
				if (item !== undefined) {
					actions.onCreateWorkItem?.(item);
				}
			},
		onLinkWorkItem: actions.onLinkWorkItem === undefined
			? undefined
			: (session: JiraSidebarSessionItem, workItemKey: string) => {
				if (isCaptured(session)) {
					return;
				}
				const item = resolve(session);
				if (item !== undefined) {
					actions.onLinkWorkItem?.(item, workItemKey.length > 0 ? workItemKey : undefined);
				}
			},
	};
}
