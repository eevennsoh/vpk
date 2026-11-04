"use client";

import { useRef } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { RelatedTooltip } from "@/components/blocks/jira-work-item/project-butter/related-tooltip";
import { RELATED_DISPLAY_PROPERTIES, RELATED_SORT_OPTIONS, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";

/**
 * Header "More actions" popover (reference ChildWorkItemsDisplayMenu): Ordering, Hide done and property chips.
 * Opens with focus on Ordering; closing returns focus to the trigger. Its aria-expanded keeps the header cluster visible.
 */
export function ProjectButterRelatedDisplayOptions({ editor, menuLabel, onChange }: Readonly<{
	editor: ProjectButterRelatedListEditor;
	/** Popover name, e.g. "Child work item display options". */
	menuLabel: string;
	onChange: (patch: Partial<ProjectButterRelatedListEditor>) => void;
}>) {
	const ordering = RELATED_SORT_OPTIONS.find((option) => option.value === editor.sortBy)?.label ?? "Rank";
	const orderingTrigger = useRef<HTMLButtonElement>(null);
	return (
		<Popover onOpenChange={(displayOptionsOpen) => onChange({ displayOptionsOpen })} open={editor.displayOptionsOpen}>
			<RelatedTooltip label="More actions">
				<PopoverTrigger render={<Button aria-label="More actions" className="aria-expanded:bg-bg-selected aria-expanded:text-text-selected [&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></PopoverTrigger>
			</RelatedTooltip>
			<PopoverContent align="end" aria-label={menuLabel} className="w-80 gap-0 p-0" initialFocus={orderingTrigger} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]" side="top" sideOffset={8}>
				<div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2"><span className="text-sm text-text-subtle">Ordering</span>
					<DropdownMenu><DropdownMenuTrigger ref={orderingTrigger} render={<Button aria-label={`Ordering, ${ordering}`} size="compact" type="button" variant="secondary" />}>{ordering}<ChevronDownIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[700]">{RELATED_SORT_OPTIONS.map((option) => <DropdownMenuItem key={option.value} onSelect={() => onChange({ sortBy: option.value })} selected={(editor.sortBy ?? "rank") === option.value}>{option.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
				</div>
				<div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2"><span className="text-sm text-text-subtle">Hide done work items</span><Switch checked={editor.hideDone} label="Hide done work items" onCheckedChange={(hideDone) => onChange({ hideDone })} /></div>
				<div className="space-y-2 px-4 py-3"><p className="text-xs text-text-subtle">Display properties</p><div aria-label="Display properties" className="flex flex-wrap gap-1.5" role="group">{RELATED_DISPLAY_PROPERTIES.map((property) => <Toggle key={property.id} onPressedChange={(pressed) => onChange({ visibleFields: { ...editor.visibleFields, [property.id]: pressed } })} pressed={editor.visibleFields[property.id]} size="sm" variant="outline">{property.label}</Toggle>)}</div></div>
			</PopoverContent>
		</Popover>
	);
}
