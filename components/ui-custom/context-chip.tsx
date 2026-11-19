"use client";

import type { ReactNode } from "react";

import CrossIcon from "@atlaskit/icon/core/cross";

import { Button } from "@/components/ui/button";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ContextChipItem {
	id: string;
	/** Primary line in the popover (file path, check name, author, etc.). */
	title: string;
	/** Optional secondary line (line number, check details, etc.). */
	subtitle?: string;
	body: string;
}

export interface ContextChipProps {
	items: readonly ContextChipItem[];
	/** Leading icon inside the chip trigger. */
	icon: ReactNode;
	/** Visible count label (e.g. "1 comment", "2 failing checks"). */
	countLabel: string;
	/** Accessible name for the popover trigger. Defaults to `Review ${countLabel}`. */
	triggerLabel?: string;
	onRemoveAll: () => void;
	/** Accessible label for the dismiss control. */
	removeAllLabel: string;
	/** Test id for the chip root. */
	testId: string;
}

/**
 * One-turn composer context pill: count chip + popover detail list + dismiss.
 * Shared by comment chips and failing CI-check chips so PromptInput attachments
 * share the same chrome.
 */
export function ContextChip({
	items,
	icon,
	countLabel,
	triggerLabel,
	onRemoveAll,
	removeAllLabel,
	testId,
}: Readonly<ContextChipProps>) {
	return (
		<div
			className="group/context-chip inline-flex min-w-0 max-w-full origin-left items-center rounded-md bg-transparent hover:bg-bg-neutral has-[:focus-visible]:bg-bg-neutral motion-safe:transition-[scale,opacity] motion-safe:duration-normal motion-safe:ease-out-practical motion-safe:starting:scale-95 motion-safe:starting:opacity-0"
			data-testid={testId}
		>
			<Popover>
				<PopoverTrigger
					render={
						<Button
							aria-label={triggerLabel ?? `Review ${countLabel}`}
							className="min-w-0 border-0 bg-transparent pl-2 pr-0 font-normal text-text-subtlest [&_svg]:text-icon-subtlest hover:bg-transparent aria-expanded:text-text-subtlest aria-expanded:[&_svg]:text-icon-subtlest"
							size="compact"
							title={countLabel}
							variant="ghost"
						/>
					}
				>
					{icon}
					<span className="truncate">{countLabel}</span>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="max-h-72 w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-y-auto p-1"
					positionerClassName="z-[600]"
					side="top"
					sideOffset={8}
				>
					<ul>
						{items.map((item, index) => (
							<li className="min-w-0" key={item.id}>
								{index > 0 ? (
									<hr className={dropdownStyles.separator} />
								) : null}
								<div className="px-3 py-2">
									<div className="truncate text-xs font-semibold text-text" title={item.title}>
										{item.title}
									</div>
									{item.subtitle ? (
										<div className="mt-0.5 text-xs text-text-subtle">
											{item.subtitle}
										</div>
									) : null}
									<p className="mt-1 whitespace-pre-wrap break-words text-sm text-text">{item.body}</p>
								</div>
							</li>
						))}
					</ul>
				</PopoverContent>
			</Popover>
			<Button
				aria-label={removeAllLabel}
				className="pointer-events-none shrink-0 border-0 bg-transparent text-icon-subtlest opacity-0 [&_svg]:text-icon-subtlest group-hover/context-chip:pointer-events-auto group-hover/context-chip:opacity-100 group-has-[:focus-visible]/context-chip:pointer-events-auto group-has-[:focus-visible]/context-chip:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
				onClick={onRemoveAll}
				size="icon-compact"
				variant="ghost"
			>
				<CrossIcon color="currentColor" label="" size="small" />
			</Button>
		</div>
	);
}
