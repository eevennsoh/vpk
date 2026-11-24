"use client";

import { useId, type ReactNode } from "react";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProjectButterContentPreview({ children, expanded, forceExpanded = false, label, onExpandedChange }: Readonly<{
	children: ReactNode;
	expanded: boolean;
	forceExpanded?: boolean;
	label: "description" | "attachments";
	onExpandedChange: (expanded: boolean) => void;
}>) {
	const id = useId();
	const { ref, hasVerticalOverflow } = useHasVerticalOverflow<HTMLDivElement>({ trackInput: true });
	const open = expanded || forceExpanded;
	return (
		<div>
			<div
				className={cn("-m-1 p-1", !open && "overflow-hidden", !open && (label === "description" ? "max-h-40" : "max-h-56"), !open && hasVerticalOverflow && "scroll-mask-bottom [--scroll-mask-fade-size:3rem] [--scroll-mask-scrollbar-width:0px]")}
				id={id}
				onFocusCapture={() => { if (hasVerticalOverflow) onExpandedChange(true); }}
				ref={ref}
			>
				{children}
			</div>
			{expanded || hasVerticalOverflow ? (
				<div className={cn("mt-2", label === "attachments" && "-ml-2")}>
					<Button
						aria-controls={id}
						aria-expanded={open}
						className={label === "description" ? "h-auto border-0 p-0 text-xs font-normal text-text-subtlest aria-expanded:bg-transparent aria-expanded:text-text-subtlest aria-expanded:hover:bg-transparent aria-expanded:active:bg-transparent" : undefined}
						onClick={() => onExpandedChange(!expanded)}
						type="button"
						variant={label === "description" ? "link" : "ghost"}
					>
						{open ? `Show less ${label}` : `Show more ${label}`}
					</Button>
				</div>
			) : null}
		</div>
	);
}
