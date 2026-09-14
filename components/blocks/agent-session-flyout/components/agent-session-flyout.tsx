"use client";

import { useState, type ComponentProps, type ReactNode } from "react";

import BranchIcon from "@atlaskit/icon/core/branch";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import VideoStopIcon from "@atlaskit/icon/core/video-stop";

import {
	JiraSessionLabel,
	type JiraSidebarSessionItem,
} from "@/components/blocks/product-sidebar/variants/jira";
import {
	JiraSessionFlyoutSurface,
	JiraSessionFlyoutTrigger,
	createJiraSessionFlyoutHandle,
	type JiraSessionFlyoutContent,
	type JiraSessionFlyoutSurfaceProps,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { AGENT_SESSION_FLYOUT_SESSIONS } from "@/components/blocks/agent-session-flyout/agent-session-flyout-data";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const TRAILING_ICON_TONE_CLASS = {
	subtlest: "text-icon-subtlest",
	subtle: "text-icon-subtle",
	information: "text-icon-information",
	success: "text-icon-success",
	discovery: "text-icon-discovery",
	danger: "text-icon-danger",
} as const;

type TrailingIconTone = keyof typeof TRAILING_ICON_TONE_CLASS;

function trailingIcon(
	icon: ReactNode,
	title: string,
	tone: TrailingIconTone,
) {
	return (
		<span
			className={cn(
				"grid size-4 shrink-0 place-items-center",
				TRAILING_ICON_TONE_CLASS[tone],
			)}
			title={title}
		>
			{icon}
		</span>
	);
}

/**
 * Compact list glyphs match the board View PR legend: green open, purple
 * merged, red closed. Branch-only rows use `text-icon-subtlest`; needs-input
 * uses the information (blue) icon token.
 */
function AgentSessionFlyoutTrailingIcon({
	session,
}: Readonly<{ session: JiraSidebarSessionItem }>) {
	if (session.branch && !session.pullRequestNumber) {
		return trailingIcon(
			<BranchIcon color="currentColor" label="Branch created" size="small" />,
			"Branch created",
			"subtlest",
		);
	}

	if (session.pullRequestNumber && session.status === "stopped") {
		return trailingIcon(
			<MergeFailureIcon color="currentColor" label="Pull request failed" size="small" />,
			"Pull request failed",
			"danger",
		);
	}

	switch (session.status) {
		case "awaiting-input":
			return trailingIcon(
				<StatusInformationIcon color="currentColor" label="Needs input" size="small" />,
				"Needs input",
				"information",
			);
		case "running":
			return <Spinner label="Running" size="xs" />;
		case "pr-open":
			return trailingIcon(
				<PullRequestIcon color="currentColor" label="Pull request open" size="small" />,
				"Pull request open",
				"success",
			);
		case "merged":
			return trailingIcon(
				<MergeSuccessIcon color="currentColor" label="Pull request merged" size="small" />,
				"Pull request merged",
				"discovery",
			);
		case "stopped":
			return trailingIcon(
				<VideoStopIcon color="currentColor" label="Stopped" size="small" />,
				"Stopped",
				"subtle",
			);
		default: {
			const _exhaustive: never = session.status;
			return _exhaustive;
		}
	}
}

/** Compact bordered list chrome shared by catalog session lists. */
export const AGENT_SESSION_FLYOUT_LIST_CLASSNAME =
	"flex max-w-sm flex-col gap-1 rounded-lg border border-border bg-surface p-1";

/**
 * The `/jira-golden-journeys-v0` queue session flyout showcase. The compact session list feeds the
 * shared `JiraSessionFlyoutSurface` — the exact direction-aware flyout used by
 * the live Jira product sidebar. It defaults to session details and can opt
 * into the Agent States composer or an untracked-work suggestion.
 */

export interface AgentSessionFlyoutProps extends Pick<
	JiraSessionFlyoutSurfaceProps,
	| "onAddAsSubtask"
	| "onArchiveSession"
	| "onCreateWorkItem"
	| "onLinkWorkItem"
	| "showUntrackedWorkFooter"
> {
	/** Sessions to render in the compact list. Defaults to the `/jira-golden-journeys-v0` queue seeds. */
	sessions?: readonly JiraSidebarSessionItem[];
	/**
	 * Hover flyout body. Defaults to session details; pass `"composer"` for the
	 * Agent States card or `"untracked-work"` for an embedded PR summary and
	 * suggested Jira relationship.
	 */
	content?: JiraSessionFlyoutContent;
	/** Additional classes applied to the outer session list. */
	className?: string;
}

interface AgentSessionFlyoutTriggerProps extends Omit<ComponentProps<"button">, "children"> {
	session: JiraSidebarSessionItem;
}

/** A session-row trigger styled like the live Jira sidebar row. */
function AgentSessionFlyoutTrigger({
	className,
	session,
	type = "button",
	...props
}: Readonly<AgentSessionFlyoutTriggerProps>) {
	return (
		<button
			className={cn(
				"group/session flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast ease-out hover:bg-surface-hovered focus-visible:bg-surface-hovered focus-visible:outline-none",
				className,
			)}
			type={type}
			{...props}
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="min-w-0 text-sm font-medium text-text">
					<JiraSessionLabel session={session} />
				</span>
				<span className="min-w-0 text-xs text-text-subtlest">
					{session.issueKey}: {session.issueSummary}
				</span>
			</span>
			<span className="grid size-6 shrink-0 place-items-center">
				<AgentSessionFlyoutTrailingIcon session={session} />
			</span>
		</button>
	);
}

/**
 * Renders the queue sessions as one continuous list, matching the way the
 * triggers appear in a real chat history. Hover a row to open its flyout, then
 * move directly up or down the list to exercise the directional transition.
 */
export function AgentSessionFlyout({
	className,
	content = "details",
	onAddAsSubtask,
	onArchiveSession,
	onCreateWorkItem,
	onLinkWorkItem,
	sessions = AGENT_SESSION_FLYOUT_SESSIONS,
	showUntrackedWorkFooter,
}: Readonly<AgentSessionFlyoutProps>) {
	const [flyoutHandle] = useState(createJiraSessionFlyoutHandle);

	return (
		<div className={cn(AGENT_SESSION_FLYOUT_LIST_CLASSNAME, className)}>
			{sessions.map((session) => (
				<JiraSessionFlyoutTrigger
					closeDelay={160}
					handle={flyoutHandle}
					key={session.id}
					render={<div className="w-full" />}
					session={session}
				>
					<AgentSessionFlyoutTrigger session={session} />
				</JiraSessionFlyoutTrigger>
			))}
			<JiraSessionFlyoutSurface
				content={content}
				handle={flyoutHandle}
				onAddAsSubtask={onAddAsSubtask}
				onArchiveSession={onArchiveSession}
				onCreateWorkItem={onCreateWorkItem}
				onLinkWorkItem={onLinkWorkItem}
				showUntrackedWorkFooter={showUntrackedWorkFooter}
			/>
		</div>
	);
}

export default AgentSessionFlyout;
