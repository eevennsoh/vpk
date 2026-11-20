"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
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
	iconSize?: ComponentProps<typeof Button>["iconSize"];
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
	iconSize,
	countLabel,
	triggerLabel,
	onRemoveAll,
	removeAllLabel,
	testId,
}: Readonly<ContextChipProps>) {
	return (
		<div
			className="inline-flex min-w-0 max-w-full origin-left items-center motion-safe:transition-[scale,opacity] motion-safe:duration-normal motion-safe:ease-out-practical motion-safe:starting:scale-95 motion-safe:starting:opacity-0"
			data-testid={testId}
		>
			<span aria-hidden className={`flex h-6 w-9 shrink-0 items-center justify-center pr-1 text-icon-subtle ${iconSize === "default" ? "[&_svg]:size-4" : "[&>span]:size-3! [&_svg]:size-3!"}`}>{icon}</span>
			<Popover>
				<PopoverTrigger
					nativeButton={false}
					render={
						<Tag
							aria-label={triggerLabel ?? `Review ${countLabel}`}
							className="h-6 max-w-full shrink border-transparent text-sm text-text-subtlest hover:border-border-accent-gray-subtle [&_[data-slot=tag-remove-overlay-button]]:end-0.75 [&_[data-tag-text]]:leading-6"
							onRemove={onRemoveAll}
							removeButtonLabel={removeAllLabel}
							removeVariant="overlay"
							title={countLabel}
						>
							<span>{countLabel}</span>
						</Tag>
					}
				/>
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
		</div>
	);
}
