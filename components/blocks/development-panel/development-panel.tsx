"use client";

import { useId, useState, type ReactNode } from "react";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import BranchIcon from "@atlaskit/icon/core/branch";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CommitIcon from "@atlaskit/icon/core/commit";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import DataNumberIcon from "@atlaskit/icon/core/data-number";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import SettingsIcon from "@atlaskit/icon/core/settings";

import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { getPullRequestStatusPresentation, type PullRequestStatusIconKind } from "@/components/blocks/jira-work-item/team-eu26/lib/pull-request-status-presentation";
import { ProjectButterDevelopmentActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-actions";
import { BranchNameSettings } from "@/components/blocks/development-panel/branch-name-settings";
import { PullRequestSettings, type PullRequestSettingsProps } from "@/components/blocks/development-panel/pull-request-settings";
import { PullRequest, type PullRequestProps, type PullRequestStatus } from "@/components/blocks/pull-request";
import { PullRequestChecksSummary } from "@/components/blocks/pull-request/components/pull-request-flyout-parts";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { AtlassianLogoMark } from "@/components/ui/logo-mark";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { JIRA_CODING_AGENT_GLYPH } from "@/lib/agent-avatar-visuals";

export interface DevelopmentPanelProps {
	pullRequests?: readonly PullRequestProps[];
	workItem: { code: string; summary: string; description: string };
	onStartCoding?: () => void;
	pullRequestSettings?: PullRequestSettingsProps;
	headerExtra?: ReactNode;
	footerExtra?: ReactNode;
	surface?: "card" | "inline";
}

const DEVELOPMENT_ROW_CLASS = "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-sm text-text-subtle outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring";
const STATUS_ICONS: Record<PullRequestStatusIconKind, typeof PullRequestIcon> = {
	"pull-request": PullRequestIcon,
	"merge-success": MergeSuccessIcon,
	"merge-failure": MergeFailureIcon,
};
const STATUS_COLORS: Record<PullRequestStatus, string> = {
	Draft: "text-icon-accent-gray",
	Open: "text-icon-accent-lime",
	Merged: "text-icon-accent-purple",
	Failed: "text-icon-danger",
};

function StartCodingMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label="Start coding" size="icon-compact" type="button" variant="ghost" />}>
				<BranchIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72 [&_[role=menuitem]>span:first-child]:size-4">
				<DropdownMenuGroup><DropdownMenuLabel>Create branch in...</DropdownMenuLabel>
				<DropdownMenuItem elemBefore={<AtlassianLogoMark frame="chip" label="" name="bitbucket" />}>Bitbucket Cloud</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<span aria-hidden><LogoThirdParty className="[&_svg]:size-3!" label="" name="github" size="xxsmall" tileBackground="surface" /></span>}>GitHub</DropdownMenuItem></DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem elemBefore={<IconTile aria-hidden as="span" icon={<BranchIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />}>Copy create branch command</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<IconTile aria-hidden as="span" icon={<CommitIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />}>Copy create commit command</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<IconTile aria-hidden as="span" icon={<DataNumberIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />}>Copy work item key</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger elemBefore={<IconTile aria-hidden as="span" icon={<SettingsIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />}>Branch name settings</DropdownMenuSubTrigger>
					<DropdownMenuSubContent aria-label="Branch name settings" className="max-h-[min(32rem,var(--available-height,32rem))] w-80 max-w-[calc(100vw-2rem)] p-4" role="dialog" side="left">
						<BranchNameSettings />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ConnectionRow({ icon, name, connected }: Readonly<{ icon: ReactNode; name: string; connected?: boolean }>) {
	return (
		<div className="flex min-h-10 items-center gap-3 px-4 text-sm text-text-subtle">
			<span aria-hidden className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
			<span className="min-w-0 flex-1">{name}</span>
			{connected ? <span aria-label="Connected" className="text-icon-success" role="img"><CheckMarkIcon label="" size="medium" /></span> : <Button aria-label={`Request ${name}`} size="compact" type="button" variant="outline">Request</Button>}
		</div>
	);
}

function DevelopmentSettings() {
	const [open, setOpen] = useState(false);
	const repositoriesId = useId();
	const agentsId = useId();
	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<Button aria-label="Development settings" size="icon-compact" type="button" variant="ghost" />}>
				<CustomizeIcon label="" size="small" />
			</PopoverTrigger>
			<PopoverContent align="end" aria-label="Development settings" className="w-[350px] max-w-[calc(100vw-2rem)] gap-0 p-0">
				<section aria-labelledby={repositoriesId} className="py-3">
					<h3 className="px-4 pb-2 text-xs font-semibold text-text-subtle" id={repositoriesId}>Code repositories</h3>
					<ConnectionRow connected icon={<AtlassianLogoMark frame="chip" label="" name="bitbucket" />} name="Bitbucket" />
					<ConnectionRow connected icon={<LogoThirdParty label="" name="github" size="xxsmall" tileBackground="surface" />} name="GitHub for Atlassian" />
					<ConnectionRow icon={<LogoThirdParty label="" name="gitlab" size="xxsmall" tileBackground="surface" />} name="GitLab for Jira Cloud" />
				</section>
				<Separator className="mx-2 data-horizontal:w-auto" />
				<section aria-labelledby={agentsId} className="py-3">
					<h3 className="px-4 pb-2 text-xs font-semibold text-text-subtle" id={agentsId}>Agents</h3>
					<ConnectionRow connected icon={<AgentAvatarVisual animate={false} appearance="coding" avatarSrc={JIRA_CODING_AGENT_GLYPH} label="" sizePx={20} />} name="Jira Coding Agent" />
					<ConnectionRow icon={<AgentAvatarVisual animate={false} appearance="coding" brandName="github-copilot" label="" sizePx={20} />} name="GitHub Copilot for Jira" />
					<ConnectionRow connected icon={<AgentAvatarVisual animate={false} appearance="coding" brandName="cursor" label="" sizePx={20} />} name="Cursor" />
					<ConnectionRow icon={<AgentAvatarVisual animate={false} appearance="coding" brandName="claude" label="" sizePx={20} />} name="Claude Agent for Jira" />
				</section>
				<Separator className="mx-2 data-horizontal:w-auto" />
				<div className="p-2"><Button className="w-full justify-start gap-3 px-[7px] font-normal" type="button" variant="ghost"><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<AngleBracketsIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />Manage connections</Button></div>
			</PopoverContent>
		</Popover>
	);
}

export function DevelopmentPanel({ pullRequests = [], workItem, onStartCoding, pullRequestSettings, headerExtra, footerExtra, surface = "card" }: Readonly<DevelopmentPanelProps>) {
	const hasPullRequests = pullRequests.length > 0;
	return (
		<TeamEuRailPanel
			alwaysShowHeaderActions={Boolean(headerExtra)}
			defaultOpen
			headerActions={<div className="flex items-center opacity-0 group-hover/rail-panel:opacity-100 group-focus-within/rail-panel:opacity-100 has-[[aria-expanded=true]]:opacity-100">{hasPullRequests ? <StartCodingMenu /> : null}<PullRequestSettings {...pullRequestSettings} /><DevelopmentSettings />{headerExtra}</div>}
			surface={surface}
			title="Development"
			footer={hasPullRequests ? <div className="border-t border-border-disabled px-2 py-2"><button className={`${DEVELOPMENT_ROW_CLASS} h-8`} type="button"><Icon aria-hidden className="size-4 shrink-0" render={<ListBulletedIcon label="" size="small" />} /><span>View development activity</span></button><div className="px-2"><ProjectButterDevelopmentActions {...workItem} showStartCoding={false} /></div>{footerExtra}</div> : null}
		>
			<div className={hasPullRequests ? "px-2 pb-2" : "px-4 pb-4"}>
				{hasPullRequests ? pullRequests.map((request) => {
					const StatusIcon = STATUS_ICONS[getPullRequestStatusPresentation(request.status).iconKind];
					const showChecks = request.status !== "Merged" && Boolean(request.checks?.length);
					return (
					<Popover key={request.number}>
						<PopoverTrigger render={<button className={`${DEVELOPMENT_ROW_CLASS} min-h-10 ${showChecks ? "py-2" : ""}`} type="button" />}>
							<Icon aria-hidden className={`size-4 shrink-0 ${STATUS_COLORS[request.status]}`} render={<StatusIcon label="" size="small" />} />
							<span className="min-w-0 flex-1"><span className="block truncate"><span className="text-text-subtlest">#{request.number} </span><span className="text-text">{request.title}</span><span className="sr-only"> {request.status}</span></span>{showChecks && request.checks ? <PullRequestChecksSummary checks={request.checks} /> : null}</span>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-[344px] max-w-[calc(100vw-2rem)] p-0 shadow-none" side="left">
							<PullRequest {...request} onActivate={undefined} selected={false} variant="flyout" />
						</PopoverContent>
					</Popover>
				); }) : <div className="-mb-2 space-y-3"><ProjectButterDevelopmentActions {...workItem} onStartCoding={onStartCoding} /></div>}
			</div>
		</TeamEuRailPanel>
	);
}
