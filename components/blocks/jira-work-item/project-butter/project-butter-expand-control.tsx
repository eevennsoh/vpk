"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProjectButterExpandControl({ chevron = false, expanded, label, onClick }: Readonly<{
	chevron?: boolean;
	expanded: boolean;
	label: string;
	onClick: () => void;
}>) {
	return (
		<div className="absolute -bottom-[0.5px] left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
			<Button aria-expanded={expanded} aria-label={chevron ? label : undefined} className={chevron ? "w-10" : undefined} onClick={onClick} size="disclosure" type="button" variant="disclosure">
				{chevron ? <span className={cn("inline-flex transition-transform duration-normal ease-out-practical", expanded && "rotate-180")}><ChevronDownIcon label="" size="small" /></span> : label}
			</Button>
		</div>
	);
}
