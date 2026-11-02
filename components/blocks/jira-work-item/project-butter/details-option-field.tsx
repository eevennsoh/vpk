"use client";

import { useState } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import TagIcon from "@atlaskit/icon/core/tag";
import WorkItemEpicIcon from "@atlaskit/icon/core/epic";
import AssetsObjectIcon from "@atlaskit/icon-lab/core/assets-object";
import { MetadataSearchPicker, METADATA_PICKER_POPOVER_CLASS } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { DetailValueTrigger } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/components/ui/tag";

export function DetailsOptionField({ label, onChange, options, tagAppearance = "plain", values, multiple = false }: Readonly<{
	label: string;
	onChange: (values: string[]) => void;
	options: readonly string[];
	tagAppearance?: "plain" | "labels" | "parent" | "asset";
	values: readonly string[];
	multiple?: boolean;
}>) {
	const [open, setOpen] = useState(false);
	const IconComponent = tagAppearance === "parent" ? WorkItemEpicIcon : tagAppearance === "asset" ? AssetsObjectIcon : TagIcon;
	const allOptions = [...new Set([...values, ...options])];
	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<DetailValueTrigger aria-label={`Change ${label.toLowerCase()}`} />}>
				{values.length ? <span className="flex min-w-0 flex-wrap items-center gap-1.5">{values.map((value, index) => tagAppearance === "plain" ? <span className="min-w-0 truncate" key={value}>{value}</span> : <Tag color={tagAppearance === "labels" ? index === 0 ? "blue" : "teal" : "purple"} elemBefore={tagAppearance === "parent" || tagAppearance === "asset" ? <IconComponent label="" size="small" /> : undefined} key={value}>{value}</Tag>)}</span> : <span className="flex min-w-0 items-center gap-2 text-text-subtle"><IconComponent label="" size="small" /><span>{`Add ${label.toLowerCase()}`}</span></span>}
			</PopoverTrigger>
			<PopoverContent align="start" className={METADATA_PICKER_POPOVER_CLASS} positionerClassName="z-[700]" sideOffset={8}>
				<MetadataSearchPicker
					emptyLabel={`No ${label.toLowerCase()} found`}
					items={allOptions.map((option) => ({ id: option, label: option, icon: values.includes(option) ? <CheckMarkIcon label="Selected" size="small" /> : <IconComponent label="" size="small" /> }))}
					onEscape={() => setOpen(false)}
					onSelect={({ id }) => {
						onChange(multiple ? values.includes(id) ? values.filter((value) => value !== id) : [...values, id] : [id]);
						if (!multiple) setOpen(false);
					}}
					placeholder={`Search ${label.toLowerCase()}`}
				/>
			</PopoverContent>
		</Popover>
	);
}
