"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface OpenInProps {
	app: { name: string; icon: ReactNode } | null;
	children: ReactNode;
	onAppClick: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	contentLabel: string;
	status?: string;
}

export function OpenIn({ app, children, onAppClick, open, onOpenChange, contentLabel, status }: Readonly<OpenInProps>) {
	return <ButtonGroup aria-label="Open in an app" variant="split">
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger render={<Button type="button" variant="outline" />}>Open in</PopoverTrigger>
			<PopoverContent aria-label={contentLabel} align="end" sideOffset={8} initialFocus={(interactionType) => interactionType === "keyboard"} className="w-80 max-h-[min(26rem,var(--available-height,26rem))] gap-0 overflow-hidden rounded-xl p-0 shadow-2xl [&_[cmdk-group]:last-child]:!pb-0" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}>
				{children}
			</PopoverContent>
		</Popover>
		{app ? <Button aria-label={`Open in ${app.name}`} onClick={onAppClick} size="icon" type="button" variant="outline"><span aria-hidden="true" className="inline-flex size-4 items-center justify-center">{app.icon}</span></Button> : null}
		<span className="sr-only" role="status">{status}</span>
	</ButtonGroup>;
}
