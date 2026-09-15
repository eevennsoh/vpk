import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { AgentSessionColumnFrame } from "./agent-session-column-frame";

/** Shared content-sized pill geometry for collapsed status and empty session columns. */
export function CollapsedColumnLabel({
	appearance: chrome,
	countRow,
	headerFrame,
	title,
}: Readonly<{
	appearance: {
		readonly pillClassName: string;
		readonly captionPaddingBottom: string | undefined;
		readonly countPaddingTop: string | undefined;
		readonly pillRadius: string;
		readonly pillPaddingBlock: string;
	};
	countRow: ReactNode;
	headerFrame: AgentSessionColumnFrame;
	title: string;
}>): ReactNode {
	const titleLabel = (
		<span className="min-h-0 truncate text-xs font-medium leading-4 text-text-subtle [writing-mode:vertical-rl]">
			{title}
		</span>
	);
	const pillStyle = {
		borderRadius: chrome.pillRadius,
		paddingBlock: chrome.pillPaddingBlock,
	};

	switch (headerFrame) {
		case "caption":
			return (
				<div className="flex w-full flex-col">
					<div className="w-full" style={{ paddingBottom: chrome.captionPaddingBottom }}>
						{countRow}
					</div>
					<div
						className={cn("flex w-full flex-col items-center justify-center", chrome.pillClassName)}
						style={pillStyle}
					>
						{titleLabel}
					</div>
				</div>
			);
		case "enclosed":
			return (
				<div className="flex w-full flex-col">
					<div
						className={cn("flex w-full flex-col items-center", chrome.pillClassName)}
						style={{ borderRadius: chrome.pillRadius, paddingTop: chrome.countPaddingTop }}
					>
						{countRow}
						<div
							className="flex w-full flex-col items-center justify-center"
							style={{ paddingBlock: chrome.pillPaddingBlock }}
						>
							{titleLabel}
						</div>
					</div>
				</div>
			);
		default: {
			const exhaustive: never = headerFrame;
			return exhaustive;
		}
	}
}
