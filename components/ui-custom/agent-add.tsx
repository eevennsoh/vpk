"use client";

import { useId, useState, type ReactNode, type RefObject } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Hexagonal trigger and popover for an agent picker supplied by the host. */
export function AgentAdd({ children, disabled = false, label = "Add agent", onOpenChange, open, triggerRef }: Readonly<{
	children: ReactNode;
	disabled?: boolean;
	label?: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	triggerRef?: RefObject<HTMLButtonElement | null>;
}>) {
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const tooltipId = useId();
	return (
		<Popover open={open} onOpenChange={(nextOpen) => {
			if (nextOpen) setTooltipOpen(false);
			onOpenChange(nextOpen);
		}}>
			<Tooltip open={tooltipOpen && !open} onOpenChange={setTooltipOpen}>
				<TooltipTrigger render={<PopoverTrigger render={<button ref={triggerRef} disabled={disabled} type="button" aria-label={label} aria-describedby={tooltipOpen && !open ? tooltipId : undefined} className="group/butter-add-agent-trigger relative inline-flex size-6 items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} />} />}>
					<span data-slot="jira-issue-add-agent-visual" className="flex size-6 scale-90 transition-transform duration-normal ease-out-practical motion-reduce:scale-100 motion-reduce:transition-none group-hover/jira-issue:scale-100 group-has-[:focus-visible]/jira-issue:scale-100 group-data-[open=true]/butter-add-agent:scale-100">
						<Avatar aria-hidden animate={false} shape="hexagon" size="sm" borderTone={open ? "selected" : "default"}>
							<span className="flex size-full items-center justify-center bg-bg-neutral-subtle text-icon-subtle transition-colors duration-fast ease-out-practical motion-reduce:transition-none group-hover/butter-add-agent-trigger:bg-bg-neutral-subtle-hovered group-active/butter-add-agent-trigger:bg-bg-neutral-subtle-pressed group-aria-expanded/butter-add-agent-trigger:bg-bg-selected group-aria-expanded/butter-add-agent-trigger:text-icon-selected">
								<AddIcon label="" size="small" color="currentColor" />
							</span>
						</Avatar>
					</span>
				</TooltipTrigger>
				<TooltipContent id={tooltipId} role="tooltip" side="top" sideOffset={8}>Add agent</TooltipContent>
			</Tooltip>
			{children}
		</Popover>
	);
}
