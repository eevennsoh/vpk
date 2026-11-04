"use client";

import { useState } from "react";

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
import { IconTile } from "@/components/ui/icon-tile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/components/ui/tag";
import type { RichTextSuggestionMenuItem } from "@/components/ui-custom/rich-text-editor";

type ArtifactEpicColor = "blue" | "green" | "purple";

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
			render={<EpicIcon color="currentColor" label="" size="medium" spacing="none" />}
		/>
	);
}

function ArtifactEpicMenuIcon({ color }: Readonly<{ color: ArtifactEpicColor }>) {
	return (
		<IconTile
			aria-hidden
			as="span"
			icon={<ArtifactEpicIcon />}
			label=""
			size="small"
			variant={color}
		/>
	);
}

export function ArtifactParentField({
	value,
	onChange,
	options = PARENT_OPTIONS,
}: Readonly<{ value: string | null; onChange: (key: string) => void; options?: readonly Pick<ParentOption, "key" | "summary">[] }>) {
	const [open, setOpen] = useState(false);
	const selected = options.find((option) => option.key === value);
	const items = options.map((option): RichTextSuggestionMenuItem => ({
		description: option.key,
		icon: null,
		id: option.key,
		label: option.summary,
		leadingVisual: <ArtifactEpicMenuIcon color={artifactEpicColor(option.key)} />,
	}));

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label="Change parent" />}>
				{selected ? (
					<Tag
						className="max-w-full self-center"
						color={artifactEpicColor(selected.key)}
						elemBefore={<ArtifactEpicIcon />}
					>
						{selected.summary}
					</Tag>
				) : (
					<span className="text-sm text-text-subtlest">Add parent</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={METADATA_PICKER_POPOVER_CLASS}
				positionerClassName={METADATA_PICKER_POSITIONER_CLASS}
				sideOffset={METADATA_PICKER_SIDE_OFFSET}
			>
				<div className="[&_.rich-text-command-menu-item:hover]:bg-bg-neutral-subtle-hovered!">
					<MetadataSearchPicker
						emptyLabel="No work items found"
						items={items}
						onEscape={() => setOpen(false)}
						onSelect={(item) => {
							onChange(item.id);
							setOpen(false);
						}}
						placeholder="Search work items"
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
