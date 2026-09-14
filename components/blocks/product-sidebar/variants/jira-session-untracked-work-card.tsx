"use client";

import { useId } from "react";

import ArchiveBoxIcon from "@atlaskit/icon/core/archive-box";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { cn } from "@/lib/utils";

import type { JiraSidebarSessionItem } from "./jira";
import { JiraSessionFlyoutCard } from "./jira-session-flyout-card";
import {
	JIRA_SESSION_FLYOUT_STATE,
	JIRA_SESSION_FLYOUT_STATE_LABEL,
	JIRA_SESSION_UPDATED_LABEL,
} from "./jira-session-flyout-data";
import { JiraSessionPullRequestSection } from "./jira-session-pull-request-section";
import { JiraSessionStatusIndicator } from "./jira-session-status-indicator";

function JiraSessionUntrackedWorkActions({
	archiveActionLabel = "Archive",
	issueKey,
	onArchiveSession,
	onCreateWorkItem,
	onLinkWorkItem,
}: Readonly<{
	archiveActionLabel?: string;
	issueKey: string;
	onAddAsSubtask?: (workItemKey: string) => void;
	onArchiveSession?: () => void;
	onCreateWorkItem?: () => void;
	onLinkWorkItem?: (workItemKey: string) => void;
}>) {
	const archiveUnavailable = onArchiveSession === undefined;
	const createUnavailable = onCreateWorkItem === undefined;
	const linkUnavailable = onLinkWorkItem === undefined;
	const hasIssueKey = issueKey.length > 0;
	const linkLabel = hasIssueKey ? `Link to ${issueKey}` : "Link work item";
	const createButton = (
		<Button
			disabled={createUnavailable}
			className="w-full flex-1 justify-center text-center"
			onClick={() => onCreateWorkItem?.()}
			size="compact"
			type="button"
			variant="outline"
		>
			Create new work item
		</Button>
	);
	const archiveButton = (
		<Button
			aria-label={archiveUnavailable ? `${archiveActionLabel} unavailable` : archiveActionLabel}
			disabled={archiveUnavailable}
			onClick={() => onArchiveSession?.()}
			size="icon-compact"
			type="button"
			variant="outline"
		>
			<ArchiveBoxIcon label="" size="small" />
		</Button>
	);

	return (
		<ButtonGroup
			aria-label={hasIssueKey ? `Link ${issueKey}` : "Create work item actions"}
			className="w-full gap-2"
			variant="separated"
		>
			{hasIssueKey ? (
				<>
					<Button
						aria-disabled={linkUnavailable}
						aria-label={linkUnavailable ? `${linkLabel} unavailable` : undefined}
						className={cn(
							"w-full flex-1 justify-center text-center",
							linkUnavailable ? "cursor-not-allowed opacity-(--opacity-disabled)" : undefined,
						)}
						onClick={() => onLinkWorkItem?.(issueKey)}
						size="compact"
						type="button"
						variant="outline"
					>
						{linkLabel}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={(
								<Button
									aria-label={`More actions for ${issueKey}`}
									size="icon-compact"
									type="button"
									variant="outline"
								>
									<ShowMoreHorizontalIcon label="" size="small" />
								</Button>
							)}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuGroup>
								<DropdownMenuItem
									disabled={createUnavailable}
									onSelect={() => onCreateWorkItem?.()}
								>
									Create new work item
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={archiveUnavailable}
									onSelect={() => onArchiveSession?.()}
								>
									{archiveActionLabel}
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</>
			) : (
				<>
					{createButton}
					{archiveButton}
				</>
			)}
		</ButtonGroup>
	);
}

/**
 * Hover-card suggestion for linking an untracked agent session to a Jira work
 * item. Pull requests render directly in a dedicated body section. The footer
 * keeps the fallback rationale when no relationship is available and always
 * owns the actions.
 */
export function JiraSessionUntrackedWorkCard({
	animateAvatars = true,
	archiveActionLabel,
	onAddAsSubtask,
	onArchiveSession,
	onCreateWorkItem,
	onLinkWorkItem,
	session,
	showFooter = true,
}: Readonly<{
	animateAvatars?: boolean;
	archiveActionLabel?: string;
	onAddAsSubtask?: (workItemKey: string) => void;
	onArchiveSession?: () => void;
	onCreateWorkItem?: () => void;
	onLinkWorkItem?: (workItemKey: string) => void;
	session: JiraSidebarSessionItem;
	showFooter?: boolean;
}>) {
	const titleId = useId();
	const rationaleId = useId();
	const pullRequestTitleId = useId();
	const hasIssueKey = session.issueKey.length > 0;
	const hasPullRequest = session.pullRequestNumber !== undefined;
	const lifecycleState = JIRA_SESSION_FLYOUT_STATE[session.status];
	const showRationale = !hasPullRequest || !hasIssueKey;
	const rationaleTitle = hasIssueKey ? "High confidence to link" : "Nothing available to link to";
	const confidenceRationale = hasIssueKey
		? `This session appears related to ${session.issueKey} because the work item matches its activity and context.`
		: "Create a work item to track it.";

	return (
		<JiraSessionFlyoutCard
			aria-labelledby={
				hasPullRequest
					? `${titleId} ${pullRequestTitleId}`
					: showFooter
						? `${titleId} ${rationaleId}`
						: undefined
			}
			body={
				hasPullRequest ? (
					<JiraSessionPullRequestSection
						session={session}
						titleId={pullRequestTitleId}
					/>
				) : undefined
			}
			footer={
				showFooter ? (
					<>
						{showRationale ? (
							<div className="flex flex-col gap-2">
								<h3 className="text-xs leading-4 font-medium text-text" id={rationaleId}>
									{rationaleTitle}
								</h3>
								<p className="text-xs leading-4 text-text-subtlest">
									{confidenceRationale}
								</p>
							</div>
						) : null}
						<JiraSessionUntrackedWorkActions
							archiveActionLabel={archiveActionLabel}
							issueKey={session.issueKey}
							onAddAsSubtask={onAddAsSubtask}
							onArchiveSession={onArchiveSession}
							onCreateWorkItem={onCreateWorkItem}
							onLinkWorkItem={onLinkWorkItem}
						/>
					</>
				) : undefined
			}
			meta={
				<div className="flex h-4 min-w-0 items-center gap-1">
					<span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
						<AgentAvatarVisual
							animate={animateAvatars}
							avatarClassName="after:border-0"
							avatarSrc={session.agentAvatarSrc}
							brandName={session.brandName}
							fallbackText={session.agentName}
							label=""
							sizePx={16}
							vpkLogo={session.vpkLogo}
						/>
					</span>
					<p className="min-w-0 truncate text-xs leading-4 text-text-subtlest">{session.agentName}</p>
					<span aria-hidden="true" className="shrink-0 text-xs leading-4 text-text-subtlest">·</span>
					<p className="shrink-0 text-xs leading-4 text-text-subtlest">
						{JIRA_SESSION_FLYOUT_STATE_LABEL[lifecycleState]}
					</p>
					<span aria-hidden="true" className="shrink-0 text-xs leading-4 text-text-subtlest">·</span>
					<p className="shrink-0 text-xs leading-4 text-text-subtlest">
						{JIRA_SESSION_UPDATED_LABEL[session.status]}
					</p>
				</div>
			}
			title={session.title}
			titleId={titleId}
			trailing={<JiraSessionStatusIndicator state={lifecycleState} />}
		/>
	);
}
