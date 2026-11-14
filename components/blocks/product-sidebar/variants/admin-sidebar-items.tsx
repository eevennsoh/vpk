"use client";

// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

import { useMemo, useState, type ReactNode } from "react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { AdminIconComponent, AdminNavLeaf, AdminNavSection } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { ADMIN_ICONS } from "@/components/blocks/product-sidebar/data/admin-navigation";

interface AdminSidebarLeafProps {
	item: AdminNavLeaf;
	selectedItem: string;
	onSelectItem: (item: string) => void;
}

export function AdminSidebarRootLeaf({
	icon: Icon,
	label,
	selectedItem,
	onSelectItem,
}: Readonly<{
	icon: AdminIconComponent;
	label: string;
	selectedItem: string;
	onSelectItem: (item: string) => void;
}>) {
	const isSelected = selectedItem === label;

	return (
		<button
			type="button"
			className={cn(
				"relative flex min-h-8 w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm font-medium transition-colors",
				isSelected
					? "bg-bg-selected text-text-selected"
					: "text-text-subtle hover:bg-bg-neutral-subtle-hovered",
			)}
			onClick={() => onSelectItem(label)}
		>
			{isSelected ? (
				<span className="absolute left-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-sm bg-border-selected" />
			) : null}
			<span className="flex size-6 shrink-0 items-center justify-center">
				<Icon label="" color={isSelected ? token("color.icon.selected") : token("color.icon.subtle")} />
			</span>
			<span className="min-w-0 flex-1 truncate pl-0.5">{label}</span>
		</button>
	);
}

export function AdminSidebarLeaf({
	item,
	selectedItem,
	onSelectItem,
}: Readonly<AdminSidebarLeafProps>) {
	const isSelected = selectedItem === item.label;

	return (
		<button
			type="button"
			className={cn(
				"relative flex min-h-8 w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm transition-colors",
				isSelected
					? "bg-bg-selected text-text-selected"
					: "text-text-subtle hover:bg-bg-neutral-subtle-hovered",
			)}
			onClick={() => onSelectItem(item.label)}
		>
			{isSelected ? (
				<span className="absolute left-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-sm bg-border-selected" />
			) : null}
			<AdminLeafGlyph item={item} isSelected={isSelected} />
			<span className="min-w-0 flex-1 truncate pl-0.5">{item.label}</span>
		</button>
	);
}

function AdminLeafGlyph({
	item,
	isSelected,
}: Readonly<{
	item: AdminNavLeaf;
	isSelected: boolean;
}>) {
	if (item.type === "site") {
		return (
			<span className="flex size-6 shrink-0 items-center justify-center">
				<span
					className={cn(
						"flex size-5 items-center justify-center rounded text-[11px] font-semibold text-text",
						item.colorClassName ?? "bg-neutral-100",
					)}
				>
					{item.emoji}
				</span>
			</span>
		);
	}

	if (item.type === "bullet") {
		return (
			<span className="flex size-6 shrink-0 items-center justify-center">
				<span className={cn("size-1 rounded-full", isSelected ? "bg-icon-selected" : "bg-icon-subtle")} />
			</span>
		);
	}

	return <span className="size-6 shrink-0" />;
}

interface AdminExpandableSectionProps {
	section: AdminNavSection;
	selectedItem: string;
	onSelectItem: (item: string) => void;
}

export function AdminExpandableSection({
	section,
	selectedItem,
	onSelectItem,
}: Readonly<AdminExpandableSectionProps>) {
	const containsSelected = useMemo(
		() => sectionContainsItem(section, selectedItem),
		[section, selectedItem],
	);
	const [isManuallyExpanded, setIsManuallyExpanded] = useState(section.defaultExpanded === true);
	const [collapsedSelection, setCollapsedSelection] = useState<string | null>(null);
	const isExpanded = containsSelected
		? collapsedSelection !== selectedItem
		: isManuallyExpanded;
	const toggleExpanded = () => {
		if (containsSelected) {
			setCollapsedSelection(isExpanded ? selectedItem : null);
			return;
		}
		setIsManuallyExpanded((expanded) => !expanded);
	};

	return (
		<div className="flex flex-col gap-0.5">
			<AdminSectionButton
				icon={section.icon}
				isExpanded={isExpanded}
				label={section.label}
				onClick={toggleExpanded}
			/>
			{isExpanded ? (
				<div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
					{section.items?.map((item) => (
						<AdminSidebarLeaf
							key={item.label}
							item={item}
							selectedItem={selectedItem}
							onSelectItem={onSelectItem}
						/>
					))}
					{section.nested?.map((nested) => (
						<AdminNestedSection
							key={nested.label}
							defaultExpanded={nested.defaultExpanded}
							items={nested.items}
							label={nested.label}
							selectedItem={selectedItem}
							onSelectItem={onSelectItem}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function AdminSectionButton({
	icon: Icon,
	isExpanded,
	label,
	onClick,
}: Readonly<{
	icon: AdminIconComponent;
	isExpanded: boolean;
	label: string;
	onClick: () => void;
}>) {
	const ChevronIcon = isExpanded ? ADMIN_ICONS.chevronDown : ADMIN_ICONS.chevronRight;

	return (
		<button
			type="button"
			aria-expanded={isExpanded}
			className="flex min-h-8 w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm font-medium text-text-subtle transition-colors hover:bg-bg-neutral-subtle-hovered"
			onClick={onClick}
		>
			<span className="flex size-6 shrink-0 items-center justify-center">
				<Icon label="" color={token("color.icon.subtle")} />
			</span>
			<span className="min-w-0 flex-1 truncate pl-0.5">{label}</span>
			<ChevronIcon label="" color={token("color.icon.subtle")} size="small" />
		</button>
	);
}

function AdminNestedSection({
	defaultExpanded,
	items,
	label,
	selectedItem,
	onSelectItem,
}: Readonly<{
	defaultExpanded?: boolean;
	items: readonly AdminNavLeaf[];
	label: string;
	selectedItem: string;
	onSelectItem: (item: string) => void;
}>) {
	const containsSelected = items.some((item) => item.label === selectedItem);
	const [isManuallyExpanded, setIsManuallyExpanded] = useState(defaultExpanded === true);
	const [collapsedSelection, setCollapsedSelection] = useState<string | null>(null);
	const isExpanded = containsSelected
		? collapsedSelection !== selectedItem
		: isManuallyExpanded;
	const ChevronIcon = isExpanded ? ADMIN_ICONS.chevronDown : ADMIN_ICONS.chevronRight;
	const toggleExpanded = () => {
		if (containsSelected) {
			setCollapsedSelection(isExpanded ? selectedItem : null);
			return;
		}
		setIsManuallyExpanded((expanded) => !expanded);
	};

	return (
		<div className="flex flex-col gap-0.5">
			<button
				type="button"
				aria-expanded={isExpanded}
				className="flex min-h-8 w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-text-subtle transition-colors hover:bg-bg-neutral-subtle-hovered"
				onClick={toggleExpanded}
			>
				<span className="flex size-6 shrink-0 items-center justify-center">
					<ChevronIcon label="" color={token("color.icon.subtle")} size="small" />
				</span>
				<span className="min-w-0 flex-1 truncate pl-0.5">{label}</span>
			</button>
			{isExpanded ? (
				<div className="ml-4 flex flex-col gap-0.5">
					{items.map((item) => (
						<AdminSidebarLeaf
							key={item.label}
							item={item}
							selectedItem={selectedItem}
							onSelectItem={onSelectItem}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

export function AdminSidebarGroup({ children }: Readonly<{ children: ReactNode }>) {
	return <div className="flex flex-col gap-0.5">{children}</div>;
}

function sectionContainsItem(section: AdminNavSection, itemLabel: string): boolean {
	return (
		section.items?.some((item) => item.label === itemLabel) === true
		|| section.nested?.some((nested) => nested.items.some((item) => item.label === itemLabel)) === true
	);
}
