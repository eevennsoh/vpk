"use client";

import { useRef, useState } from "react";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import PriorityLowestIcon from "@atlaskit/icon/core/priority-lowest";
import StatusProgressIcon from "@atlaskit/icon-lab/core/status-workflow-in-progress";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { PersonRowField, PriorityRowField, type PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProjectButterRelatedItem, ProjectButterRelatedStatus } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { cn } from "@/lib/utils";

const PRIORITY_ICONS = { High: PriorityHighIcon, Highest: PriorityHighestIcon, Medium: PriorityMediumIcon, Low: PriorityLowIcon, Lowest: PriorityLowestIcon };
const STATUS_OPTIONS: readonly ProjectButterRelatedStatus[] = ["To do", "In progress", "In review", "Done"];

function PriorityGlyph({ value }: Readonly<{ value: PriorityValue }>) {
	const Icon = PRIORITY_ICONS[value];
	return <span className={cn("flex size-8 shrink-0 items-center justify-center", value === "High" || value === "Highest" ? "text-icon-danger" : value === "Medium" ? "text-icon-warning" : "text-icon-information")}><Icon color="currentColor" label={`${value} priority`} size="small" /></span>;
}

export function ProjectButterRelatedItemRow({ faded, item, onChange, onRemove }: Readonly<{ faded: boolean; item: ProjectButterRelatedItem; onChange: (patch: Partial<ProjectButterRelatedItem>) => void; onRemove: () => void }>) {
	const [summary, setSummary] = useState(item.summary);
	const cancelled = useRef(false);
	const StatusIcon = item.status === "Done" ? StatusSuccessIcon : item.status === "To do" ? TaskToDoIcon : StatusProgressIcon;
	const names = [...new Set([item.assignee, "Automatic", "Annie Cook", "Sarah Lim", "Marcus Kim", "Elena Rodriguez", "Sia Vale", "Amara Okafor", "Zoe Loft"])];
	const people = names.map((name) => ({ name, avatarUrl: name === "Automatic" ? undefined : projectButterPersonAvatar(name) }));
	return (
		<li className="group/work-row flex min-h-11 min-w-0 items-center gap-2 px-3 hover:bg-surface-hovered focus-within:bg-surface-hovered">
			{item.relationship ? <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Edit relationship for ${item.key}: ${item.relationship}`} size="compact" type="button" variant="ghost" />}>{item.relationship}</DropdownMenuTrigger><DropdownMenuContent positionerClassName="z-[650]">{["Blocks", "Blocked by", "Relates to", "Clones"].map((value) => <DropdownMenuItem key={value} onSelect={() => onChange({ relationship: value })}>{value}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : null}
			<DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Edit status for ${item.key}, ${item.status}`} size="icon-compact" type="button" variant="ghost" />}><span className={item.status === "Done" ? "text-icon-success" : item.status === "To do" ? "text-icon-subtle" : "text-icon-information"}><StatusIcon color="currentColor" label="" size="small" /></span></DropdownMenuTrigger><DropdownMenuContent positionerClassName="z-[650]">{STATUS_OPTIONS.map((status) => <DropdownMenuItem key={status} onSelect={() => onChange({ status })} selected={status === item.status}>{status}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
			<span className={cn("shrink-0 text-sm text-text-subtle", faded && "opacity-50")}>{item.key}</span>
			<input aria-label={`Edit summary for ${item.key}`} className={cn("min-w-0 flex-1 rounded-sm bg-transparent py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring", faded && "opacity-50 focus:opacity-100")} onBlur={() => { if (cancelled.current) { cancelled.current = false; return; } if (summary.trim()) onChange({ summary: summary.trim() }); else setSummary(item.summary); }} onChange={(event) => setSummary(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelled.current = true; setSummary(item.summary); event.currentTarget.blur(); } else if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} value={summary} />
			<span className="shrink-0 opacity-0 group-hover/work-row:opacity-100 group-focus-within/work-row:opacity-100 has-[[aria-expanded=true]]:opacity-100"><DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`More actions for ${item.key}`} size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent positionerClassName="z-[650]"><DropdownMenuItem onSelect={onRemove}>Remove from work item</DropdownMenuItem></DropdownMenuContent></DropdownMenu></span>
			<span className="w-8 shrink-0"><PriorityRowField onChange={(priority) => onChange({ priority })} renderValue={(value) => <PriorityGlyph value={value} />} value={item.priority} /></span>
			<span className="w-6 shrink-0"><PersonRowField ariaLabel={`Edit assignee for ${item.key}: ${item.assignee}`} onChange={(person) => onChange({ assignee: person.name })} people={people} placeholder="Automatic" renderValue={(person) => <Avatar label={person.name} size="sm"><AvatarImage src={person.avatarUrl} /><AvatarFallback>{person.name.slice(0, 1)}</AvatarFallback></Avatar>} value={people[0]} /></span>

		</li>
	);
}
