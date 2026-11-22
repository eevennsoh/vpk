"use client";

import { useState, type ReactNode } from "react";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import AttachmentIcon from "@atlaskit/icon/core/attachment";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StoryIcon from "@atlaskit/icon/core/story";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import WorkItemIcon from "@atlaskit/icon/core/work-item";

import { PROJECT_BUTTER_ATTACHMENTS } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { ProjectButterDevelopmentActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-actions";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import { ProjectButterStatusGlyph } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { PROJECT_BUTTER_CHILD_ITEMS, PROJECT_BUTTER_LINKED_ITEMS } from "@/components/blocks/jira-work-item/project-butter/related-data";
import { PersonLabel, PriorityLabel } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { TEAM_EU26_DESCRIPTION } from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";
import { BUTTER_PAY_CURRENT_USER } from "@/components/projects/butter-v1/data/current-user";
import { BUTTER_WORK_ITEM_SESSIONS } from "@/components/projects/butter-v1/data/gallery-work-item-sessions";
import { AvatarGroup } from "@/components/ui/avatar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { LozengeDropdownTrigger } from "@/components/ui/lozenge";
import { Toggle } from "@/components/ui/toggle";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { token } from "@/lib/tokens";

const SUMMARY = "Redesign onboarding flow for new users";
const PERSON = { name: BUTTER_PAY_CURRENT_USER.name, avatarUrl: BUTTER_PAY_CURRENT_USER.avatarSrc };
const SECTION_COUNTS = [
	{ label: "Attachments", count: PROJECT_BUTTER_ATTACHMENTS.length, icon: AttachmentIcon },
	{ label: "Child work items", count: PROJECT_BUTTER_CHILD_ITEMS.length, icon: SubtasksIcon },
	{ label: "Linked work items", count: PROJECT_BUTTER_LINKED_ITEMS.length, icon: WorkItemIcon },
];

function PreviewDetails() {
	const [expanded, setExpanded] = useState(false);
	return (
		<TeamEuRailPanel
			defaultOpen
			footer={<ProjectButterExpandControl ariaLabel={expanded ? "Show less details" : "Show more details"} expanded={expanded} label={expanded ? "Show less" : "Show more"} onClick={() => setExpanded((value) => !value)} />}
			title="Details"
		>
			<dl className="flex min-w-0 flex-col gap-4 px-4 pb-4">
				<div><dt className="mb-0.5 text-xs leading-4 text-text-subtle">Assignee</dt><dd className="flex min-h-8 items-center"><PersonLabel person={PERSON} /></dd></div>
				<div>
					<dt className="mb-0.5 text-xs leading-4 text-text-subtle">Agents</dt>
					<dd className="flex min-h-8 items-center">
						<AvatarGroup className="-space-x-1.5" label="Agents on this work item" size="sm">
							{BUTTER_WORK_ITEM_SESSIONS.map(({ id, agent }) => <AgentAvatarVisual animate={false} appearance="coding" avatarSrc={agent.avatarSrc} brandName={agent.brandName} fallbackText={agent.name.slice(0, 1)} key={id} label={agent.name} sizePx={24} vpkLogo={agent.vpkLogo} />)}
						</AvatarGroup>
					</dd>
				</div>
				<div><dt className="mb-0.5 text-xs leading-4 text-text-subtle">Priority</dt><dd className="flex min-h-8 items-center [&_[data-slot=icon-tile]]:size-4"><PriorityLabel iconSize="small" value="High" /></dd></div>
				{expanded ? <>
					<div><dt className="mb-0.5 text-xs leading-4 text-text-subtle">Due Date</dt><dd className="py-1.5 text-sm">25 May 2026</dd></div>
					<div><dt className="mb-0.5 text-xs leading-4 text-text-subtle">Parent</dt><dd className="py-1.5 text-sm">VITA-22 User Experience Overhaul</dd></div>
					<div><dt className="mb-0.5 text-xs leading-4 text-text-subtle">Reporter</dt><dd className="flex min-h-8 items-center"><PersonLabel person={PERSON} /></dd></div>
				</> : null}
			</dl>
		</TeamEuRailPanel>
	);
}

export function WorkItemPreviewShell({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<section aria-label="VITA-1 work item preview" className="flex h-[860px] w-[1152px] max-w-full flex-col overflow-hidden bg-surface text-text" data-work-item-preview-shell>
			<header className="px-6 pt-6 pb-6">
				<Breadcrumb className="flex h-8 items-center" size="small">
					<BreadcrumbList><BreadcrumbItem className="gap-2"><span className="inline-flex text-icon-success"><StoryIcon label="Story" size="small" /></span><span>VITA-1</span></BreadcrumbItem></BreadcrumbList>
				</Breadcrumb>
				<div className="mt-4 flex min-w-0 items-center gap-2">
					<h1 className="min-w-0 flex-1 text-text" style={{ font: token("font.heading.medium") }}>{SUMMARY}</h1>
					<LozengeDropdownTrigger aria-label="Change status, In progress" icon={<ProjectButterStatusGlyph animated={false} status="In progress" />} size="spacious" variant="information">In progress</LozengeDropdownTrigger>
					<Button aria-label="More work item actions" size="icon" type="button" variant="outline"><ShowMoreHorizontalIcon label="" size="small" /></Button>
				</div>
			</header>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px]">
				<div className="flex min-w-0 flex-col gap-6 overflow-y-auto px-6 pb-2">
					<section aria-label="Description">
						<h2 className="text-sm font-medium">Description</h2>
						<p className="pt-2 text-sm leading-5">{TEAM_EU26_DESCRIPTION}</p>
					</section>
					<div aria-label="Work item sections" className="-ml-2 flex items-center gap-1" role="group">
						{SECTION_COUNTS.map(({ count, icon: Glyph, label }) => <Toggle aria-label={`${label}, ${count}`} className="font-normal" key={label} pressed={false} variant="subtle"><Glyph label="" size="small" /><span className="tabular-nums">{count}</span></Toggle>)}
					</div>
					{children}
				</div>
				<aside aria-label="Work item details" className="flex min-w-0 flex-col gap-4 overflow-y-auto px-6 pb-6 [&_h2]:font-medium">
					<PreviewDetails />
					<TeamEuRailPanel defaultOpen title="Development">
						<div className="px-4 pb-4">
							<ProjectButterDevelopmentActions code="VITA-1" description={TEAM_EU26_DESCRIPTION} showCopyPrompt={false} summary={SUMMARY} />
							<div className="-mx-2"><Button className="w-full justify-start gap-2 font-normal" type="button" variant="ghost"><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<AngleBracketsIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />Open in</Button></div>
						</div>
					</TeamEuRailPanel>
					<TeamEuRailPanel title="Automation"><div /></TeamEuRailPanel>
					<TeamEuRailPanel title="Apps"><div /></TeamEuRailPanel>
				</aside>
			</div>
		</section>
	);
}
