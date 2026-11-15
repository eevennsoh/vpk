"use client";

import CustomizeIcon from "@atlaskit/icon/core/customize";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { useRef, useState } from "react";

import {
	DEFAULT_JIRA_VIEW_CONFIGURATION,
	JiraViewConfiguration,
	type JiraViewConfigurationValue,
} from "@/components/blocks/jira-view-configuration";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function areEqual(left: JiraViewConfigurationValue, right: JiraViewConfigurationValue) {
	return left.doneAfter === right.doneAfter &&
		left.muteAgentSessionsAfter === right.muteAgentSessionsAfter &&
		left.columnWidth === right.columnWidth && left.scrollMode === right.scrollMode &&
		left.visibleFieldIds.length === right.visibleFieldIds.length &&
		left.visibleFieldIds.every((field, index) => field === right.visibleFieldIds[index]);
}

export default function JiraViewConfigurationPage() {
	const [value, setValue] = useState(DEFAULT_JIRA_VIEW_CONFIGURATION);
	const [saved, setSaved] = useState(DEFAULT_JIRA_VIEW_CONFIGURATION);
	const [open, setOpen] = useState(true);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const changed = !areEqual(value, saved);

	function close() {
		setOpen(false);
		triggerRef.current?.focus();
	}

	return (
		<div className="relative flex h-[640px] w-full flex-col overflow-hidden bg-bg-neutral-subtle sm:flex-row">
			<div className="flex min-w-0 items-start justify-end gap-2 p-4 sm:flex-1">
				<Button ref={triggerRef} variant="outline" size="icon" aria-label="View settings" aria-expanded={open} onClick={() => setOpen(!open)}>
					<CustomizeIcon label="" />
				</Button>
				<DropdownMenu onOpenChange={(isOpen) => { if (isOpen) setOpen(false); }}>
					<DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More" />}>
						<ShowMoreHorizontalIcon label="" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem disabled={!changed} onClick={() => setSaved(value)}>Save board view</DropdownMenuItem>
						<DropdownMenuItem disabled={!changed} onClick={() => setValue(saved)}>Reset to last view</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{open ? (
				<JiraViewConfiguration value={value} onChange={setValue} onClose={close} className="min-h-0 flex-1 border-t border-border sm:w-[340px] sm:flex-none sm:border-l sm:border-t-0" />
			) : null}
		</div>
	);
}
