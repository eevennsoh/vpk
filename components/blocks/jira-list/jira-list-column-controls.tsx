"use client";

import { useMemo, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import SearchIcon from "@atlaskit/icon/core/search";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COLUMN_OPTIONS = [
	{ id: "act-size", label: "Act size", type: "Dropdown", glyph: "⌄" },
	{ id: "actual-story-points", label: "Actual Story Points", type: "Number", glyph: "123" },
	{ id: "progress", label: "Progress", type: "Number", glyph: "∑" },
	{ id: "remaining-estimate", label: "Remaining Estimate", type: "Number", glyph: "∑" },
	{ id: "original-estimate", label: "Original Estimate", type: "Number", glyph: "∑" },
	{ id: "time-spent", label: "Time Spent", type: "Number", glyph: "∑" },
	{ id: "comments", label: "Comments", type: "Text", glyph: "Aa" },
	{ id: "components", label: "Components", type: "Dropdown", glyph: "⌄" },
] as const;

interface JiraListColumnBoundaryProps {
	anchorLabel: string;
	anchorSide: "left" | "right";
	boundaryIndex: number;
	isTargeted: boolean;
	positionAnchor: string;
	positionLabel: string;
}

export function JiraListColumnBoundary({
	anchorLabel,
	anchorSide,
	boundaryIndex,
	isTargeted,
	positionAnchor,
	positionLabel,
}: Readonly<JiraListColumnBoundaryProps>) {
	const [isOpen, setIsOpen] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(() => new Set());
	const isLineActive = isHovered || isFocused;
	const isVisible = isTargeted || isLineActive || isOpen;
	const visibleOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		return COLUMN_OPTIONS.filter((option) => (
			normalizedQuery.length === 0
			|| option.label.toLocaleLowerCase().includes(normalizedQuery)
			|| option.type.toLocaleLowerCase().includes(normalizedQuery)
		));
	}, [query]);

	return (
		<div
			className="pointer-events-none absolute top-0 bottom-10 z-40 w-0 overflow-visible"
			data-anchor-label={anchorLabel}
			data-testid={`jira-list-column-boundary-${boundaryIndex}`}
			style={{
				left: anchorSide === "left" ? "anchor(left)" : "anchor(right)",
				positionAnchor,
				top: 0,
			}}
		>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-border-selected opacity-0 transition-opacity duration-fast",
					isLineActive && "opacity-100",
				)}
				data-boundary-line
			/>
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<Tooltip>
					<TooltipTrigger
						render={
							<PopoverTrigger
								render={
									<Button
										aria-label={`Add column ${positionLabel}`}
										className={cn(
											"pointer-events-none fixed z-50 size-6 -translate-x-1/2 -translate-y-1/2 border border-border bg-surface-overlay! text-icon-subtle opacity-0 transition-opacity duration-fast hover:bg-surface-overlay-hovered! active:bg-surface-overlay-pressed! focus-visible:pointer-events-auto focus-visible:bg-surface-overlay! focus-visible:opacity-100",
											isVisible && "pointer-events-auto opacity-100",
										)}
										data-boundary-control
										onBlur={() => setIsFocused(false)}
										onFocus={() => setIsFocused(true)}
										onPointerEnter={() => setIsHovered(true)}
										onPointerLeave={() => setIsHovered(false)}
										size="icon"
										style={{
											// Hang on the header's top edge so the control sits outside
											// the header row. Unresolved anchors would otherwise paint
											// `fixed` at the static position inside the table; keep
											// that frame offscreen.
											left: anchorSide === "left"
												? "anchor(left, -100vw)"
												: "anchor(right, -100vw)",
											positionAnchor,
											positionVisibility: "anchors-visible",
											top: "anchor(top, -100vh)",
										}}
										variant="outline"
									/>
								}
							/>
						}
					>
						<Icon render={<AddIcon label="" size="small" />} />
					</TooltipTrigger>
					<TooltipContent>Add column</TooltipContent>
				</Tooltip>
				<PopoverContent
					align={anchorSide === "left" ? "start" : "end"}
					className="w-[320px] gap-0 overflow-hidden bg-surface p-0 shadow-overlay"
					side="bottom"
					sideOffset={8}
				>
					<div className="relative border-b border-border bg-surface p-3">
						<Icon
							className="pointer-events-none absolute top-1/2 left-5 z-10 -translate-y-1/2 text-icon-subtle"
							render={<SearchIcon label="" size="small" />}
						/>
						<Input
							aria-label="Search columns"
							autoFocus
							className="h-9 bg-surface pl-9"
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search columns"
							type="search"
							value={query}
						/>
					</div>
					<ul className="max-h-80 overflow-y-auto bg-surface py-1">
						{visibleOptions.map((option) => {
							const isSelected = selectedOptionIds.has(option.id);
							return (
								<li key={option.id}>
								<label
									className="flex min-h-12 cursor-pointer items-start gap-3 bg-surface px-3 py-2 hover:bg-bg-neutral-subtle-hovered"
								>
									<Checkbox
										aria-label={`Select ${option.label}`}
										checked={isSelected}
										className="mt-0.5"
										onCheckedChange={(checked) => {
											setSelectedOptionIds((currentIds) => {
												const nextIds = new Set(currentIds);
												if (checked) {
													nextIds.add(option.id);
												} else {
													nextIds.delete(option.id);
												}
												return nextIds;
											});
										}}
									/>
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-medium text-text">{option.label}</span>
										<span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-subtle">
											<span aria-hidden="true" className="w-6 text-center font-semibold">
												{option.glyph}
											</span>
											{option.type}
										</span>
									</span>
								</label>
								</li>
							);
						})}
						{visibleOptions.length === 0 ? (
							<li className="px-3 py-6 text-center text-sm text-text-subtle">No columns found</li>
						) : null}
					</ul>
					<div className="border-t border-border bg-surface px-3 py-2 text-right text-sm font-semibold text-text-subtle">
						34 of 58
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

export function JiraListColumnActions({ label }: Readonly<{ label: string }>) {
	const actionLabel = `More actions for ${label}`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={actionLabel}
						className="ml-auto size-7 shrink-0 rounded-md bg-surface-sunken opacity-0 transition-[opacity,background-color] duration-fast hover:opacity-100 focus-visible:opacity-100 group-hover/column-header:opacity-100 group-has-[:focus-visible]/column-header:opacity-100"
						data-column-action
						size="icon-compact"
						variant="ghost"
					/>
				}
			>
				<Icon render={<ShowMoreHorizontalIcon label="" size="small" />} />
			</TooltipTrigger>
			<TooltipContent>{actionLabel}</TooltipContent>
		</Tooltip>
	);
}
