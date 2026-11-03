"use client";

import { useState } from "react";

import DeleteIcon from "@atlaskit/icon/core/delete";

import { LABEL_OPTIONS } from "@/components/blocks/jira-work-item/data/metadata-fixtures";
import {
	METADATA_PICKER_POPOVER_CLASS,
	METADATA_PICKER_POSITIONER_CLASS,
	METADATA_PICKER_SIDE_OFFSET,
} from "@/components/blocks/jira-work-item/experimental/components/detail-field-editors";
import { DetailValueTrigger } from "@/components/blocks/jira-work-item/experimental/components/detail-field-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, TagGroup, type TagColor } from "@/components/ui/tag";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { RichTextCommandMenuSearchField, useCommandMenuScrollMask } from "@/components/ui-custom/rich-text-editor";

const LABEL_COLORS = ["blue", "green", "purple", "orange", "teal", "magenta", "yellow"] as const satisfies readonly TagColor[];

function labelColor(label: string): TagColor {
	const optionIndex = LABEL_OPTIONS.indexOf(label);
	if (optionIndex >= 0) {
		return LABEL_COLORS[(optionIndex * 3 + 1) % LABEL_COLORS.length];
	}

	const hash = Array.from(label).reduce((total, character) => total + character.codePointAt(0)!, 0);
	return LABEL_COLORS[hash % LABEL_COLORS.length];
}

function LabelOptionGroup({
	heading,
	labels,
	onToggle,
	selected,
}: Readonly<{
	heading: string;
	labels: readonly string[];
	onToggle: (label: string) => void;
	selected: boolean;
}>) {
	if (labels.length === 0) {
		return null;
	}

	return (
		<>
			<div className="rich-text-command-menu-heading" role="presentation">
				{heading}
			</div>
			{labels.map((label) => (
				<button
					aria-label={selected ? `Remove ${label}` : `Add ${label}`}
					aria-selected={selected}
					className={selected
						? "rich-text-command-menu-item group/label-option grid-cols-[minmax(0,1fr)_24px]! hover:bg-bg-neutral-subtle-hovered! focus-visible:bg-bg-neutral-subtle-hovered! focus-visible:outline-none"
						: "rich-text-command-menu-item grid-cols-1! hover:bg-bg-neutral-subtle-hovered! focus-visible:bg-bg-neutral-subtle-hovered! focus-visible:outline-none"}
					key={label}
					onClick={() => onToggle(label)}
					onMouseDown={(event) => event.preventDefault()}
					role="option"
					type="button"
				>
					<Tag className="self-center justify-self-start" color={labelColor(label)}>{label}</Tag>
					{selected ? (
						<span
							aria-hidden
							className="flex size-6 items-center justify-center justify-self-end text-icon-subtle opacity-0 transition-[color,opacity] duration-normal ease-out-practical group-hover/label-option:text-icon-danger group-hover/label-option:opacity-100 group-focus-visible/label-option:text-icon-danger group-focus-visible/label-option:opacity-100 motion-reduce:transition-none"
						>
							<DeleteIcon label="" size="small" />
						</span>
					) : null}
				</button>
			))}
		</>
	);
}

export function ArtifactLabelsField({
	hideSelected = false,
	onChange,
	options = LABEL_OPTIONS,
	value,
}: Readonly<{ hideSelected?: boolean; onChange: (next: string[]) => void; options?: readonly string[]; value: readonly string[] }>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	// This picker hand-rolls the command-menu markup (its rows are Tag pills with
	// a hover-delete affordance, which RichTextSuggestionMenuItem can't express),
	// so it has to opt into the top fade mask that RichTextSuggestionMenu applies
	// for free. Filtering the list shorter clamps scrollTop, which fires a scroll
	// event, so the scroll handler alone keeps the mask in sync.
	const { listProps, menuProps } = useCommandMenuScrollMask();
	const normalizedQuery = query.trim().toLowerCase();
	const allLabels = Array.from(new Set([...value, ...options]));
	const visibleLabels = allLabels.filter((label) => label.toLowerCase().includes(normalizedQuery));
	const selectedLabels = hideSelected ? [] : visibleLabels.filter((label) => value.includes(label));
	const moreLabels = visibleLabels.filter((label) => !value.includes(label));
	const firstVisibleLabel = moreLabels[0] ?? selectedLabels[0];
	const customLabel = query.trim();
	const canCreateCustomLabel = customLabel.length > 0 && !allLabels.some((label) => label.toLowerCase() === normalizedQuery);

	const toggle = (label: string) => {
		onChange(value.includes(label) ? value.filter((item) => item !== label) : [...value, label]);
	};

	const createCustomLabel = (label: string) => {
		onChange([...value, label]);
		setQuery("");
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label="Edit labels" className="py-1.5!" />}>
				{value.length > 0 ? (
					<TagGroup className="gap-1">
						{value.map((label) => (
							<Tag color={labelColor(label)} key={label}>
								{label}
							</Tag>
						))}
					</TagGroup>
				) : (
					<span className="text-sm text-text-subtlest">Add label</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label="Edit labels"
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<div
					className="rich-text-command-menu rich-text-command-menu-borderless"
					data-has-header="true"
					{...menuProps}
				>
					<RichTextCommandMenuSearchField
						autoFocus
						icon={<SearchIcon className="size-4 text-icon-subtle" />}
						label="Search labels"
						onClear={() => setQuery("")}
						onEscape={() => setOpen(false)}
						onSubmit={() => {
							if (firstVisibleLabel) {
								toggle(firstVisibleLabel);
							} else if (canCreateCustomLabel) {
								createCustomLabel(customLabel);
							}
						}}
						onValueChange={setQuery}
						value={query}
					/>
					<div
						aria-label="Search labels"
						aria-multiselectable="true"
						className="rich-text-command-menu-list"
						role="listbox"
						{...listProps}
					>
						{selectedLabels.length + moreLabels.length > 0 ? (
							<>
								<LabelOptionGroup heading="Selected" labels={selectedLabels} onToggle={toggle} selected />
								<LabelOptionGroup heading="More labels" labels={moreLabels} onToggle={toggle} selected={false} />
							</>
						) : canCreateCustomLabel ? (
							<LabelOptionGroup heading="New label" labels={[customLabel]} onToggle={createCustomLabel} selected={false} />
						) : null}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
