import type { JSX, RefObject } from "react";

import { cn } from "@/lib/utils";

export interface GalleryTitleLinesProps {
	title: string;
	lines?: readonly string[];
	className?: string;
	textRef?: RefObject<HTMLSpanElement | null>;
}

export function GalleryTitleLines({
	title,
	lines,
	className,
	textRef,
}: Readonly<GalleryTitleLinesProps>): JSX.Element {
	const renderedLines = lines ?? title.split(/\s+/);

	return (
		<span ref={textRef} className={cn("block w-full font-semibold leading-[1.02] tracking-tight", className)}>
			{lines?.length === 1 ? lines[0] : renderedLines.map((line, index) => (
				<span key={index} className="block whitespace-nowrap">
					{line}
				</span>
			))}
		</span>
	);
}
