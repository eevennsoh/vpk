"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- PopoverTrigger uses a render-node trigger so the Button owns the visual state.

import { type ReactNode, useMemo, useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import SearchIcon from "@atlaskit/icon/core/search";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { cn } from "@/lib/utils";

export { toggleSelectedValue } from "./experimental-directory-values";

export interface ExperimentalDirectoryEmptyState {
	title: string;
	description: string;
}

export interface ExperimentalDirectoryFilterOption {
	id: string;
	label: string;
}

export type ExperimentalDirectoryFacet<TOption extends ExperimentalDirectoryFilterOption = ExperimentalDirectoryFilterOption> =
	| {
			active: boolean;
			id: string;
			kind: "toggle";
			label: string;
			onToggle: () => void;
	  }
	| {
			activeLabel: string;
			id: string;
			kind: "dropdown";
			label: string;
			onToggle: (value: string) => void;
			options: readonly TOption[];
			renderOptionLeading?: (option: TOption) => ReactNode;
			selectedValues: readonly string[];
	  };

function facetIsActive<TOption extends ExperimentalDirectoryFilterOption>(
	facet: ExperimentalDirectoryFacet<TOption>,
): boolean {
	return facet.kind === "toggle" ? facet.active : facet.selectedValues.length > 0;
}

export interface ExperimentalDirectoryViewProps<TOption extends ExperimentalDirectoryFilterOption = ExperimentalDirectoryFilterOption> {
	children: ReactNode;
	contentClassName?: string;
	emptyState: ExperimentalDirectoryEmptyState;
	facets: readonly ExperimentalDirectoryFacet<TOption>[];
	isEmpty: boolean;
	onQueryChange: (query: string) => void;
	onResetFilters: () => void;
	query: string;
	resultCount: number;
	resultLabel?: string;
	searchLabel: string;
	searchPlaceholder: string;
}

export function ExperimentalDirectoryView<TOption extends ExperimentalDirectoryFilterOption = ExperimentalDirectoryFilterOption>({
	children,
	contentClassName,
	emptyState,
	facets,
	isEmpty,
	onQueryChange,
	onResetFilters,
	query,
	resultCount,
	resultLabel = "results",
	searchLabel,
	searchPlaceholder,
}: Readonly<ExperimentalDirectoryViewProps<TOption>>) {
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();
	const activeFacet = facets.find(facetIsActive)?.id ?? null;
	const hasActiveFilters = Boolean(query.trim()) || activeFacet !== null;
	const showFacet = (facet: ExperimentalDirectoryFacet<TOption>) => activeFacet === null || activeFacet === facet.id;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 flex-col gap-4 px-6 pt-1 pb-2">
				<InputGroup>
					<InputGroupAddon>
						<SearchIcon label="" />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						aria-label={searchLabel}
						placeholder={searchPlaceholder}
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
					/>
				</InputGroup>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-wrap items-center gap-2">
						{facets.map((facet) => (
							showFacet(facet) ? (
								facet.kind === "toggle" ? (
									<Button
										aria-pressed={facet.active ? true : undefined}
										key={facet.id}
										onClick={facet.onToggle}
										type="button"
										variant="outline"
									>
										{facet.label}
									</Button>
								) : (
									<FacetFilterDropdown
										activeLabel={facet.activeLabel}
										key={facet.id}
										label={facet.label}
										onToggle={facet.onToggle}
										options={facet.options}
										renderOptionLeading={facet.renderOptionLeading}
										selectedValues={facet.selectedValues}
									/>
								)
							) : null
						))}
						{hasActiveFilters ? (
							<Button type="button" variant="ghost" onClick={onResetFilters}>
								Reset
							</Button>
						) : null}
					</div>
					<p className="text-sm leading-5 text-text-subtle">
						Showing {resultCount.toLocaleString("en-US")} {resultLabel}
					</p>
				</div>
			</div>
			<div
				ref={contentOverflow.ref}
				className={cn(
					"flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2",
					contentClassName,
					contentOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
				)}
			>
				{isEmpty ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center">
						<p className="text-sm font-medium leading-5 text-text">{emptyState.title}</p>
						<p className="text-sm leading-5 text-text-subtlest">{emptyState.description}</p>
					</div>
				) : children}
			</div>
		</div>
	);
}

export interface FacetFilterDropdownProps<TOption extends ExperimentalDirectoryFilterOption = ExperimentalDirectoryFilterOption> {
	activeLabel: string;
	label: string;
	onToggle: (value: string) => void;
	options: readonly TOption[];
	renderOptionLeading?: (option: TOption) => ReactNode;
	selectedValues: readonly string[];
}

export function FacetFilterDropdown<TOption extends ExperimentalDirectoryFilterOption = ExperimentalDirectoryFilterOption>({
	activeLabel,
	label,
	onToggle,
	options,
	renderOptionLeading,
	selectedValues,
}: Readonly<FacetFilterDropdownProps<TOption>>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const visibleOptions = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return normalized
			? options.filter((option) => option.label.toLowerCase().includes(normalized))
			: options;
	}, [options, query]);
	const selectedCount = selectedValues.length;
	const triggerLabel = selectedCount > 0 ? activeLabel : label;

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button
						aria-expanded={open}
						aria-pressed={selectedCount > 0 ? true : undefined}
						className="gap-2"
						type="button"
						variant="outline"
					/>
				}
			>
				<span>{triggerLabel}</span>
				{selectedCount > 0 ? <Badge>{selectedCount}</Badge> : null}
				<Icon
					render={<ChevronDownIcon label="" size="small" color="currentColor" />}
					className={cn(
						"transition-transform duration-fast",
						selectedCount > 0 || open ? "[&_svg]:text-icon-selected" : "[&_svg]:text-icon-subtle",
						open ? "rotate-180" : null,
					)}
				/>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 gap-2 p-2 pb-0">
				<InputGroup className="pl-[7px]">
					<InputGroupAddon className="w-4 p-0">
						<SearchIcon label="" />
					</InputGroupAddon>
					<InputGroupInput
						aria-label={`Search ${label}`}
						className="px-2"
						placeholder="Search options"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<div className="max-h-64 overflow-y-auto">
					{visibleOptions.length === 0 ? (
						<p className="px-2 py-3 text-sm text-text-subtlest">No options found.</p>
					) : (
						<ul className="flex flex-col gap-px pb-2">
							{visibleOptions.map((option) => (
								<li key={option.id}>
									<label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-text hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed">
										<Checkbox
											checked={selectedValues.includes(option.id)}
											onCheckedChange={(checked) => {
												if (checked === true || checked === false) {
													onToggle(option.id);
												}
											}}
										/>
										{renderOptionLeading ? renderOptionLeading(option) : null}
										<span className="min-w-0 flex-1 truncate">{option.label}</span>
									</label>
								</li>
							))}
						</ul>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export interface ExperimentalDirectorySectionProps<TItem> {
	heading: string;
	items: readonly TItem[];
	renderItem: (item: TItem) => ReactNode;
}

export function ExperimentalDirectorySection<TItem extends { id: string }>({
	heading,
	items,
	renderItem,
}: Readonly<ExperimentalDirectorySectionProps<TItem>>) {
	return (
		<section aria-label={heading} className="flex flex-col gap-2">
			<h2 className="px-1.5 text-xs font-semibold leading-4 text-text-subtlest">
				{heading}
			</h2>
			<ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
				{items.map((item) => (
					<li key={item.id}>
						{renderItem(item)}
					</li>
				))}
			</ul>
		</section>
	);
}
