"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import DeleteIcon from "@atlaskit/icon/core/delete";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import SearchIcon from "@atlaskit/icon/core/search";
import { DropdownMenuSearchField } from "@/components/ui/dropdown-menu";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";
import { cn } from "@/lib/utils";
import {
	jiraFiltersEqual,
	type JiraFilterCondition,
	type JiraSavedFilter,
} from "@/components/blocks/jira-filter/model";

type Directory = "all" | "team" | "personal" | "pinned";

export function SavedPanel({
	filters,
	value,
	pinned,
	recent,
	directory,
	search,
	onDirectoryChange,
	onSearchChange,
	onSelect,
	onPin,
	onDelete,
	onClear,
	onDismiss,
}: Readonly<{
	filters: readonly JiraSavedFilter[];
	value: readonly JiraFilterCondition[];
	pinned: readonly string[];
	recent: readonly string[];
	directory: Directory;
	search: string;
	onDirectoryChange: (value: Directory) => void;
	onSearchChange: (value: string) => void;
	onSelect: (filter: JiraSavedFilter) => void;
	onPin: (id: string) => void;
	onDelete: (id: string) => void;
	onClear: () => void;
	onDismiss: () => void;
}>) {
	const searchRef = useRef<HTMLDivElement>(null);
	const counts = {
		all: filters.length,
		team: filters.filter((item) => item.group === "team").length,
		personal: filters.filter((item) => item.group !== "team").length,
		pinned: filters.filter((item) => pinned.includes(item.id)).length,
	};
	const available = filters.filter(
		(item) =>
			directory === "all" ||
			(directory === "pinned"
				? pinned.includes(item.id)
				: directory === "team"
					? item.group === "team"
					: item.group !== "team"),
	);
	const visible = available.filter((item) =>
		item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
	);
	const remaining = visible.filter((item) => !pinned.includes(item.id));
	const recentItems =
		directory === "all"
			? recent.flatMap((id) => remaining.find((item) => item.id === id) ?? [])
			: [];
	const grouped = remaining.filter((item) => !recentItems.includes(item));
	const groups = [
		{ label: "Recent filters", items: recentItems },
		{
			label: "Pinned filters",
			items: visible.filter((item) => pinned.includes(item.id)),
		},
		{
			label: "Team filters",
			items: grouped.filter((item) => item.group === "team"),
		},
		{
			label: "My filters",
			items: grouped.filter((item) => item.group === "personal"),
		},
		{
			label: "Default filters",
			items: grouped.filter((item) => item.group === "default"),
		},
	];
	return (
		<div className="grid min-h-80 grid-cols-[11rem_minmax(0,1fr)] max-sm:grid-cols-1">
			<nav
				aria-label="Saved filter directory"
				className="border-r border-border p-2 max-sm:flex max-sm:flex-wrap max-sm:gap-1 max-sm:border-r-0 max-sm:border-b"
			>
				{(
					[
						...(counts.pinned ? ["pinned" as const] : []),
						"all",
						"team",
						"personal",
					] as Directory[]
				).map((item) => (
					<button
						key={item}
						type="button"
						aria-pressed={directory === item}
						aria-label={`${item.charAt(0).toUpperCase()}${item.slice(1)} ${counts[item]}`}
						onClick={() => onDirectoryChange(item)}
						className={cn(
							"flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm max-sm:w-auto hover:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-border-focused",
							directory === item && "bg-bg-selected text-text-selected",
						)}
					>
						<span className="capitalize">{item}</span>
						<span className="rounded-sm bg-bg-neutral px-1.5 text-xs">
							{counts[item]}
						</span>
					</button>
				))}
			</nav>
			<div className="flex min-w-0 flex-col">
				<div ref={searchRef} className="relative z-10 pb-2">
					<DropdownMenuSearchField
						icon={<SearchIcon label="" />}
						label="Search saved filters"
						placeholder="Search filters"
						value={search}
						onValueChange={onSearchChange}
						onClear={() => onSearchChange("")}
						onEscape={onDismiss}
					/>
					<StickyRowScrollFade className="opacity-100" />
				</div>
				<div className="max-h-72 min-h-48 flex-1 overflow-y-auto px-3 py-1">
					{groups.map((group) =>
						group.items.length ? (
							<div key={group.label} className="mb-3">
								<div className="px-2 py-1 text-xs font-semibold text-text-subtlest">
									{group.label}
								</div>
								<ul>
									{group.items.map((item) => (
										<li
											key={item.id}
											className="group flex items-center rounded-md hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered"
										>
											<button
												type="button"
												aria-pressed={jiraFiltersEqual(value, item.conditions)}
												onClick={() => onSelect(item)}
												className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-border-focused"
											>
												<span className="truncate">{item.name}</span>
												{jiraFiltersEqual(value, item.conditions) ? (
													<CheckMarkIcon label="" />
												) : null}
											</button>
											<Button
												variant="ghost"
												size="icon-compact"
												aria-label={`${pinned.includes(item.id) ? "Unpin" : "Pin"} ${item.name}`}
												aria-pressed={pinned.includes(item.id)}
												onClick={() => onPin(item.id)}
											>
												{pinned.includes(item.id) ? (
													<PinFilledIcon label="" />
												) : (
													<PinIcon label="" />
												)}
											</Button>
											<Button
												variant="ghost"
												size="icon-compact"
												aria-label={`Delete ${item.name}`}
												onClick={() => {
													searchRef.current?.querySelector("input")?.focus();
													onDelete(item.id);
												}}
											>
												<DeleteIcon label="" />
											</Button>
										</li>
									))}
								</ul>
							</div>
						) : null,
					)}
					{visible.length === 0 ? (
						<p className="p-2 text-text-subtlest">
							No filters match your search
						</p>
					) : null}
				</div>
				<div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-subtlest">
					<Button
						variant="ghost"
						size="compact"
						onClick={onClear}
						disabled={!value.length}
					>
						Clear
					</Button>
					<span>
						{Number(
							available.some((item) =>
								jiraFiltersEqual(value, item.conditions),
							),
						)}{" "}
						selected
					</span>
				</div>
			</div>
		</div>
	);
}
