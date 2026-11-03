"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { RELATED_DISPLAY_PROPERTIES, RELATED_SORT_OPTIONS, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";

export function ProjectButterRelatedDisplayOptions({ editor, label, onChange }: Readonly<{
	editor: ProjectButterRelatedListEditor;
	label: string;
	onChange: (patch: Partial<ProjectButterRelatedListEditor>) => void;
}>) {
	const ordering = RELATED_SORT_OPTIONS.find((option) => option.value === editor.sortBy)?.label ?? "Rank";
	return (
		<Popover onOpenChange={(displayOptionsOpen) => onChange({ displayOptionsOpen })} open={editor.displayOptionsOpen}>
			<PopoverTrigger render={<Button aria-label={`${label} display options`} size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></PopoverTrigger>
			<PopoverContent align="end" aria-label={`${label} display options`} className="w-80 gap-0 p-0" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]" side="top" sideOffset={8}>
				<div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2"><span className="text-text-subtle">Ordering</span><div className="flex items-center gap-1">
					<DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Ordering, ${ordering}`} size="compact" type="button" variant="secondary" />}>{ordering}<ChevronDownIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} align="end" positionerClassName="z-[700]">{RELATED_SORT_OPTIONS.map((option) => <DropdownMenuItem key={option.value} onSelect={() => onChange({ sortBy: option.value })} selected={(editor.sortBy ?? "rank") === option.value}>{option.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
				</div></div>
				<div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2"><span className="text-text-subtle">Hide done work items</span><Switch checked={editor.hideDone} label="Hide done work items" onCheckedChange={(hideDone) => onChange({ hideDone })} /></div>
				<div className="space-y-2 px-4 py-3"><p className="text-xs text-text-subtle">Display properties</p><div aria-label="Display properties" className="flex flex-wrap gap-1.5" role="group">{RELATED_DISPLAY_PROPERTIES.map((property) => <Toggle key={property.id} onPressedChange={(pressed) => onChange({ visibleFields: { ...editor.visibleFields, [property.id]: pressed } })} pressed={editor.visibleFields[property.id]} size="sm">{property.label}</Toggle>)}</div></div>
			</PopoverContent>
		</Popover>
	);
}
