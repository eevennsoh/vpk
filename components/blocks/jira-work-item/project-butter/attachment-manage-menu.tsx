"use client";

import DeleteIcon from "@atlaskit/icon/core/delete";
import DownloadIcon from "@atlaskit/icon/core/download";
import GridIcon from "@atlaskit/icon/core/grid";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProjectButterAttachmentViewMode } from "@/components/blocks/jira-work-item/project-butter/attachment-model";

/**
 * The Butter Attachments "More actions" menu (reference AttachmentsManageMenu, Work Item 2.0 branch):
 * switch view, Download all, Delete all. Uploads come through the left-column file drop instead.
 * Download all saves the dropped (file-backed) attachments; it is disabled when there are none.
 */
export function AttachmentManageMenu({ canDownload, onDeleteAll, onDownloadAll, onViewModeChange, viewMode }: Readonly<{
	canDownload: boolean;
	onDeleteAll: () => void;
	onDownloadAll: () => void;
	onViewModeChange: (viewMode: ProjectButterAttachmentViewMode) => void;
	viewMode: ProjectButterAttachmentViewMode;
}>) {
	const grid = viewMode === "grid";
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label="More actions" className="[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle" size="icon-compact" type="button" variant="ghost" />}>
				<ShowMoreHorizontalIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">
				<DropdownMenuItem elemBefore={grid ? <ListBulletedIcon label="" size="small" /> : <GridIcon label="" size="small" />} onSelect={() => onViewModeChange(grid ? "list" : "grid")}>{grid ? "Switch to list view" : "Switch to grid view"}</DropdownMenuItem>
				<DropdownMenuItem disabled={!canDownload} elemBefore={<DownloadIcon label="" size="small" />} onSelect={canDownload ? onDownloadAll : undefined}>Download all</DropdownMenuItem>
				<DropdownMenuItem elemBefore={<DeleteIcon label="" size="small" />} onSelect={onDeleteAll} variant="destructive">Delete all</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
