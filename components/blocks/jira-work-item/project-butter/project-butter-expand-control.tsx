"use client";

import { Button } from "@/components/ui/button";

export function ProjectButterExpandControl({ ariaLabel, expanded, label, onClick }: Readonly<{
	ariaLabel?: string;
	expanded: boolean;
	label: string;
	onClick: () => void;
}>) {
	return (
		<div className="absolute -bottom-[0.5px] left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 items-center justify-center">
			<Button aria-expanded={expanded} aria-label={ariaLabel} onClick={onClick} size="disclosure" type="button" variant="disclosure">
				{label}
			</Button>
		</div>
	);
}
