"use client";

import { useRef, useState } from "react";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import PriorityLowestIcon from "@atlaskit/icon/core/priority-lowest";
import PersonIcon from "@atlaskit/icon/core/person";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MetadataSearchPicker, PriorityLabel, METADATA_PICKER_POPOVER_CLASS, PRIORITY_OPTIONS, type PriorityValue } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import type { ProjectButterRelatedItem } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { cn } from "@/lib/utils";

const PRIORITY_ICONS = { High: PriorityHighIcon, Highest: PriorityHighestIcon, Medium: PriorityMediumIcon, Low: PriorityLowIcon, Lowest: PriorityLowestIcon };
const PEOPLE = ["Unassigned", "Automatic", "Annie Cook", "Sarah Lim", "Marcus Kim", "Elena Rodriguez", "Sia Vale", "Amara Okafor", "Zoe Loft", "Marcus Aurelius", "Liam Wilson", "Oliver Knight", "Hiroshi Tanaka"];
const RELATED_RELATIONSHIPS = ["Blocks", "Blocked by", "Is blocked by", "Clones", "Is cloned by", "Duplicates", "Is duplicated by", "Relates to"];

export function RelatedPriorityGlyph({ value }: Readonly<{ value: PriorityValue }>) {
	const Icon = PRIORITY_ICONS[value];
	return <span className={cn("flex shrink-0 items-center justify-center", value === "High" || value === "Highest" ? "text-icon-danger" : value === "Medium" ? "text-icon-warning" : "text-icon-information")}><Icon color="currentColor" label="" size="small" /></span>;
}

export function RelatedPriorityField({ item, onChange }: Readonly<{ item: ProjectButterRelatedItem; onChange: (priority: PriorityValue) => void }>) {
	return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Edit priority for ${item.key}, ${item.priority}`} size="icon-compact" type="button" variant="ghost" />}><RelatedPriorityGlyph value={item.priority} /></DropdownMenuTrigger><DropdownMenuContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">{PRIORITY_OPTIONS.map((priority) => <DropdownMenuItem key={priority} onSelect={() => onChange(priority)} selected={priority === item.priority}><PriorityLabel value={priority} /></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

export function RelatedRelationshipField({ label, value, onChange }: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
	return <span className="w-[90px] shrink-0"><DropdownMenu><DropdownMenuTrigger render={<Button aria-label={label} className="max-w-full justify-start" size="compact" type="button" variant="ghost" />}><span className="truncate font-normal text-text-subtle">{value}</span></DropdownMenuTrigger><DropdownMenuContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">{RELATED_RELATIONSHIPS.map((relationship) => <DropdownMenuItem key={relationship} onSelect={() => onChange(relationship)} selected={relationship === value}>{relationship}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></span>;
}

export function RelatedAssigneeField({ item, onChange }: Readonly<{ item: ProjectButterRelatedItem; onChange: (assignee: string) => void }>) {
	const [open, setOpen] = useState(false);
	const names = [...new Set([item.assignee, ...PEOPLE])];
	const people = names.map((name) => ({ id: name, label: name, icon: <PersonIcon label="" size="small" />, ...(name === "Unassigned" || name === "Automatic" ? {} : { visual: { kind: "avatar" as const, shape: "circle" as const, src: projectButterPersonAvatar(name) } }) }));
	return <Popover onOpenChange={setOpen} open={open}><PopoverTrigger render={<Button aria-label={`Edit assignee for ${item.key}: ${item.assignee}`} size="icon-compact" type="button" variant="ghost" />}><Avatar label={item.assignee} size="xs">{item.assignee === "Unassigned" || item.assignee === "Automatic" ? null : <AvatarImage src={projectButterPersonAvatar(item.assignee)} />}<AvatarFallback>{item.assignee === "Unassigned" || item.assignee === "Automatic" ? <PersonIcon label="" size="small" /> : item.assignee.slice(0, 1)}</AvatarFallback></Avatar></PopoverTrigger><PopoverContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} align="end" className={METADATA_PICKER_POPOVER_CLASS} positionerClassName="z-[650]"><MetadataSearchPicker emptyLabel="No people found" items={people} onEscape={() => setOpen(false)} onSelect={(person) => { onChange(person.id); setOpen(false); }} placeholder="Search people" /></PopoverContent></Popover>;
}

export function RelatedDueDateField({ item, onChange }: Readonly<{ item: ProjectButterRelatedItem; onChange: (dueDate: string) => void }>) {
	const [open, setOpen] = useState(false);
	const value = item.dueDate ? new Date(`${item.dueDate}T12:00:00`) : undefined;
	const display = item.dueDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${item.dueDate}T00:00:00Z`)) : "—";
	return <Popover onOpenChange={setOpen} open={open}><PopoverTrigger render={<Button aria-label={`Edit due date for ${item.key}, ${display}`} size="compact" type="button" variant="ghost" />}><span className="text-xs font-normal text-text-subtlest">{display}</span></PopoverTrigger><PopoverContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} align="end" className="w-auto" positionerClassName="z-[650]"><Calendar mode="single" onSelect={(date) => { onChange(date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : ""); setOpen(false); }} selected={value} /></PopoverContent></Popover>;
}

export function RelatedEstimateField({ item, onChange }: Readonly<{ item: ProjectButterRelatedItem; onChange: (estimate: string) => void }>) {
	const [editing, setEditing] = useState(false);
	const initialEstimate = useRef(item.estimate ?? "");
	if (!editing) return <Button aria-label={`Edit estimate for ${item.key}, ${item.estimate ?? "none"}`} onClick={() => { initialEstimate.current = item.estimate ?? ""; setEditing(true); }} size="compact" type="button" variant="ghost"><span className="rounded-xs bg-bg-accent-gray-subtlest px-1 text-xs font-normal">{item.estimate || "—"}</span></Button>;
	return <input aria-label={`Estimate for ${item.key}`} autoFocus className="w-8 rounded-xs bg-bg-accent-gray-subtlest text-center text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" inputMode="numeric" maxLength={3} onBlur={() => setEditing(false)} onChange={(event) => onChange(event.currentTarget.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (event.key === "Escape") onChange(initialEstimate.current); setEditing(false); } }} value={item.estimate ?? ""} />;
}
