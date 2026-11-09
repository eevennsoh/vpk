"use client";

import FilterIcon from "@atlaskit/icon/core/filter";
import type { ProjectButterActivityFilters, ProjectButterActivitySort } from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const KINDS: readonly { key: keyof ProjectButterActivityFilters; label: string }[] = [
	{ key: "updates", label: "Updates" },
	{ key: "agents", label: "Agent sessions" },
	{ key: "comments", label: "Comments" },
];

/** Explore WIP Activity filter: which kinds show, their order, and whether change details start open. */
export function ProjectButterActivityFilterMenu({ filters, onFiltersChange, sort, onSortChange, expandDetails, onExpandDetailsChange }: Readonly<{
	filters: ProjectButterActivityFilters;
	onFiltersChange?: (filters: ProjectButterActivityFilters) => void;
	sort: ProjectButterActivitySort;
	onSortChange?: (sort: ProjectButterActivitySort) => void;
	expandDetails: boolean;
	onExpandDetailsChange: (open: boolean) => void;
}>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label="Filter activity" className="[&_svg]:text-icon-subtle" size="icon-compact" type="button" variant="ghost" />}>
				<FilterIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" positionerClassName="z-[650]">
				{onFiltersChange ? <>
					<DropdownMenuGroup>
						<DropdownMenuLabel>Show</DropdownMenuLabel>
						{KINDS.map(({ key, label }) => (
							<DropdownMenuCheckboxItem checked={filters[key]} key={key} onCheckedChange={(checked) => onFiltersChange({ ...filters, [key]: checked })}>
								{label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
				</> : null}
				{onSortChange ? <>
					<DropdownMenuGroup>
						<DropdownMenuLabel>Order</DropdownMenuLabel>
						<DropdownMenuRadioGroup onValueChange={(value) => onSortChange(value === "oldest" ? "oldest" : "newest")} value={sort}>
							<DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
				</> : null}
				<DropdownMenuCheckboxItem checked={expandDetails} onCheckedChange={onExpandDetailsChange}>
					Expand change details
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
