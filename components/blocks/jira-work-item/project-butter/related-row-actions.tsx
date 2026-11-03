"use client";

import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Child row actions (reference SubItemActionsMenu), always visible like the reference. The reference items are all inert; Clone and Delete
 * are VPK additions with real effects; Change parent, Move and Archive have no capability here, so they render disabled (VPK rule: no enabled no-op controls).
 */
export function RelatedRowActions({ itemKey, onClone, onDelete }: Readonly<{ itemKey: string; onClone: () => void; onDelete: () => void }>) {
	return (
		<span className="flex shrink-0" data-component="SubItemActionsMenu">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button aria-label={`More actions for ${itemKey}`} className="-mx-1.5 [&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle" size="icon-compact" type="button" variant="ghost" />}>
					<ShowMoreHorizontalIcon label="" size="small" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" aria-label={`Actions for ${itemKey}`} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">
					<DropdownMenuItem disabled>Change parent</DropdownMenuItem>
					<DropdownMenuItem onSelect={onClone}>Clone</DropdownMenuItem>
					<DropdownMenuItem disabled>Move</DropdownMenuItem>
					<DropdownMenuItem disabled>Archive</DropdownMenuItem>
					<DropdownMenuItem onSelect={onDelete}>Delete</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</span>
	);
}
