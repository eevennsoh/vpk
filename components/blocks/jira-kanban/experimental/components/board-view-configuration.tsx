"use client";

import { useState, type RefObject } from "react";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import { DEFAULT_JIRA_VIEW_CONFIGURATION, JiraViewConfiguration } from "@/components/blocks/jira-view-configuration";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function BoardViewConfiguration({ container }: Readonly<{ container: RefObject<HTMLDivElement | null> }>) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState(DEFAULT_JIRA_VIEW_CONFIGURATION);
	return (
		<Sheet modal={false} disablePointerDismissal open={open} onOpenChange={setOpen}>
			<SheetTrigger render={<Button aria-label="Customize" size="icon" variant="outline" />}>
				<Icon render={<CustomizeIcon label="" />} />
			</SheetTrigger>
			<SheetContent contained portalContainer={container} side="right" aria-label="View settings" showOverlay={false} showCloseButton={false} className="pointer-events-auto data-[side=right]:w-[340px] max-w-full overflow-hidden">
				<JiraViewConfiguration value={value} onChange={setValue} onClose={() => setOpen(false)} className="min-h-0 flex-1" />
			</SheetContent>
		</Sheet>
	);
}
