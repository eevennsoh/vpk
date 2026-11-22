"use client";

import { useState, type ReactElement } from "react";

import EpicIcon from "@atlaskit/icon/core/epic";

import { PARENT_OPTIONS, type ParentOption } from "@/components/blocks/jira-work-item/data/metadata-fixtures";
import {
	METADATA_PICKER_POPOVER_CLASS,
	METADATA_PICKER_POSITIONER_CLASS,
	METADATA_PICKER_SIDE_OFFSET,
	MetadataSearchPicker,
} from "@/components/blocks/jira-work-item/experimental/components/detail-field-editors";
import { DetailValueTrigger } from "@/components/blocks/jira-work-item/experimental/components/detail-field-row";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/components/ui/tag";
import type { RichTextSuggestionMenuItem } from "@/components/ui-custom/rich-text-editor";
import { ARTIFACT_PICKER_DROPDOWN_CLASS } from "@/components/blocks/artifact-pane/artifact-picker-dropdown-styles";
import { cn } from "@/lib/utils";

type ArtifactEpicColor = "blue" | "green" | "purple";
const ARTIFACT_EPIC_ICON_COLORS: Readonly<Record<ArtifactEpicColor, string>> = {
	blue: "text-icon-accent-blue",
	green: "text-icon-accent-green",
	purple: "text-icon-accent-purple",
};

const ARTIFACT_EPIC_COLORS: Readonly<Record<string, ArtifactEpicColor>> = {
	"RFP-100": "purple",
	"RFP-102": "blue",
	"RFP-103": "green",
};

function artifactEpicColor(key: string): ArtifactEpicColor {
	return ARTIFACT_EPIC_COLORS[key] ?? "purple";
}

function ArtifactEpicIcon() {
	return (
		<Icon
			aria-hidden
			render={<EpicIcon color="currentColor" label="" size="small" spacing="none" />}
		/>
	);
}

function ArtifactEpicMenuIcon({ color }: Readonly<{ color: ArtifactEpicColor }>) {
	return (
		<span className={cn("inline-flex size-4 shrink-0 items-center justify-center", ARTIFACT_EPIC_ICON_COLORS[color])}>
			<ArtifactEpicIcon />
		</span>
	);
}

export function ArtifactParentTag({ parent, placeholder = "Uncategorised" }: Readonly<{
	parent: Pick<ParentOption, "key" | "summary"> | null;
	placeholder?: string;
}>) {
	return (
		<Tag className="max-w-full self-center" color={parent ? artifactEpicColor(parent.key) : "standard"} elemBefore={parent ? <ArtifactEpicIcon /> : undefined}>
			{parent?.summary ?? placeholder}
		</Tag>
	);
}

export function ArtifactParentField({
	value,
	onChange,
	onClear,
	options = PARENT_OPTIONS,
	trigger,
	fieldName = "parent",
}: Readonly<{ value: string | null; onChange: (key: string) => void; onClear?: () => void; options?: readonly Pick<ParentOption, "key" | "summary">[]; trigger?: ReactElement; fieldName?: "parent" | "epic" }>) {
	const [open, setOpen] = useState(false);
	const selected = options.find((option) => option.key === value);
	const items = options.map((option): RichTextSuggestionMenuItem => ({
		description: option.key,
		icon: null,
		id: option.key,
		label: option.summary,
		leadingVisual: <ArtifactEpicMenuIcon color={artifactEpicColor(option.key)} />,
		leadingVisualSize: "compact",
	}));
	if (selected && onClear) items.push({ id: "", label: `Remove ${fieldName}`, icon: null, leadingVisual: <span aria-hidden />, leadingVisualSize: "compact" });

	return (
		<Popover onOpenChange={setOpen} open={open}>
			{trigger ? <PopoverTrigger render={trigger} /> : <PopoverTrigger render={<DetailValueTrigger aria-label={`Change ${fieldName}`} />}>
				{selected ? (
					<ArtifactParentTag parent={selected} />
				) : (
					<span className="text-sm text-text-subtlest">Add {fieldName}</span>
				)}
			</PopoverTrigger>}
			<PopoverContent
				align="start"
				aria-label={`Change ${fieldName}`}
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<div className="[&_.rich-text-command-menu-item:hover]:bg-bg-neutral-subtle-hovered!">
					<MetadataSearchPicker
						className={ARTIFACT_PICKER_DROPDOWN_CLASS}
						iconContainerSize={16}
						emptyLabel="No work items found"
						items={items}
						onEscape={() => setOpen(false)}
						onSelect={(item) => {
							if (item.id === "" && onClear) onClear();
							else onChange(item.id);
							setOpen(false);
						}}
						placeholder="Search work items"
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
