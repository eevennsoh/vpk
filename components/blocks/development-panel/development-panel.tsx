"use client";

import { useId, useState, type ReactNode } from "react";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import BranchIcon from "@atlaskit/icon/core/branch";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CommitIcon from "@atlaskit/icon/core/commit";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import DataNumberIcon from "@atlaskit/icon/core/data-number";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import SettingsIcon from "@atlaskit/icon/core/settings";

import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { BranchNameSettings } from "@/components/blocks/development-panel/branch-name-settings";
import { PullRequest, type PullRequestProps } from "@/components/blocks/pull-request";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { AtlassianLogoGlyph, AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export interface DevelopmentPanelProps {
	pullRequests?: readonly PullRequestProps[];
}

const DEVELOPMENT_ROW_CLASS = "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-sm text-text-subtle outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring";

function StartCodingMenu({ compact = false }: Readonly<{ compact?: boolean }>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label="Start coding" className={compact ? undefined : "w-full justify-start font-normal"} size={compact ? "icon-compact" : "default"} type="button" variant="ghost" />}>
				<BranchIcon label="" size="small" />{compact ? null : "Start coding"}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72 [&_[role=menuitem]_svg]:size-4!">
				<DropdownMenuGroup><DropdownMenuLabel>Create branch in...</DropdownMenuLabel>
				<DropdownMenuItem elemBefore={<AtlassianLogoMark frame="chip" label="" name="bitbucket" />}>Bitbucket Cloud</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<BrandLogoMark frame="chip" label="" name="github" />}>GitHub</DropdownMenuItem></DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem elemBefore={<BranchIcon label="" size="small" />}>Copy create branch command</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<CommitIcon label="" size="small" />}>Copy create commit command</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<DataNumberIcon label="" size="small" />}>Copy work item key</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger elemBefore={<SettingsIcon label="" size="small" />}>Branch name settings</DropdownMenuSubTrigger>
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
			<span aria-hidden className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
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
					<ConnectionRow connected icon={<svg aria-hidden className="size-4 rounded-tile outline outline-border dark:invert [[data-color-mode=dark]_&]:invert" viewBox="8 8 32 32"><use href="/3p/development-panel-logos.svg#github" /></svg>} name="GitHub for Atlassian" />
					<ConnectionRow icon={<svg aria-hidden className="size-4 rounded-tile outline outline-border" viewBox="8 8 32 32"><use href="/3p/development-panel-logos.svg#gitlab" /></svg>} name="GitLab for Jira Cloud" />
				</section>
				<Separator className="mx-2 data-horizontal:w-auto" />
				<section aria-labelledby={agentsId} className="py-3">
					<h3 className="px-4 pb-2 text-xs font-semibold text-text-subtle" id={agentsId}>Agents</h3>
					<ConnectionRow connected icon={<AtlassianLogoGlyph className="size-4" name="rovo-dev-agent" size="xxsmall" />} name="Jira Coding Agent" />
					<ConnectionRow icon={<svg aria-hidden className="size-4 dark:invert [[data-color-mode=dark]_&]:invert" viewBox="4.5 4.5 15 15"><image height="24" href="/3p/github-copilot/24.svg" width="24" /></svg>} name="GitHub Copilot for Jira" />
					<ConnectionRow connected icon={<svg aria-hidden className="size-4 dark:invert [[data-color-mode=dark]_&]:invert" viewBox="3 2 18 18"><image height="24" href="/3p/cursor/24.svg" width="24" /></svg>} name="Cursor" />
					<ConnectionRow icon={<svg aria-hidden className="size-4" viewBox="8 8 32 32"><use href="/3p/development-panel-logos.svg#claude" /></svg>} name="Claude Agent for Jira" />
				</section>
				<Separator className="mx-2 data-horizontal:w-auto" />
				<div className="p-2"><Button className="w-full justify-start gap-3 px-[7px] font-normal" type="button" variant="ghost"><span aria-hidden className="flex size-4 shrink-0 items-center justify-center"><AngleBracketsIcon label="" size="medium" /></span>Manage connections</Button></div>
			</PopoverContent>
		</Popover>
	);
}

export function DevelopmentPanel({ pullRequests = [] }: Readonly<DevelopmentPanelProps>) {
	const hasPullRequests = pullRequests.length > 0;
	return (
		<TeamEuRailPanel
			defaultOpen
			headerActions={<div className="flex items-center opacity-0 group-hover/rail-panel:opacity-100 group-focus-within/rail-panel:opacity-100 has-[[aria-expanded=true]]:opacity-100">{hasPullRequests ? <StartCodingMenu compact /> : null}<DevelopmentSettings /></div>}
			title="Development"
			footer={hasPullRequests ? <div className="border-t border-border-disabled px-2 py-2"><button className={`${DEVELOPMENT_ROW_CLASS} h-8`} type="button"><Icon aria-hidden className="shrink-0" render={<ListBulletedIcon label="" size="small" />} /><span>View development activity</span></button></div> : null}
		>
			<div className={hasPullRequests ? "px-2 pb-4" : "px-4 pb-4"}>
				{hasPullRequests ? pullRequests.map((request) => (
					<Popover key={request.number}>
						<PopoverTrigger render={<button className={`${DEVELOPMENT_ROW_CLASS} min-h-10`} type="button" />}>
							<Icon aria-hidden className={request.status === "Merged" ? "shrink-0 text-icon-success" : "shrink-0 text-icon-information"} render={<PullRequestIcon label="" size="small" />} />
							<span className="min-w-0 truncate">#{request.number} {request.title}</span>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-[344px] max-w-[calc(100vw-2rem)] p-0" side="left">
							<PullRequest {...request} onActivate={undefined} selected={false} variant="flyout" />
						</PopoverContent>
					</Popover>
				)) : <StartCodingMenu />}
			</div>
		</TeamEuRailPanel>
	);
}
