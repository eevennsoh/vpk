"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";

interface CheckboxFilterDropdownProps {
	label: string;
	options: readonly string[];
	selectedValues: string[];
	onToggle: (value: string) => void;
}

export function CheckboxFilterDropdown({
	label,
	options,
	selectedValues,
	onToggle,
}: Readonly<CheckboxFilterDropdownProps>) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger
				render={
					<Button
						aria-expanded={isOpen}
						aria-pressed={selectedValues.length > 0}
						className="gap-2"
						variant="secondary"
					/>
				}
			>
				{label}
				{selectedValues.length > 0 ? <Badge variant="information">
						{selectedValues.length}
					</Badge> : null}
				{isOpen ? <ChevronUpIcon label="" size="small" /> : <ChevronDownIcon label="" size="small" />}
			</PopoverTrigger>
			<PopoverContent align="start" className="min-w-[200px] gap-0 p-1">
				{options.map((option) => (
					<label
						key={option}
						className="hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-[13px] leading-5 select-none"
					>
						<Checkbox
							checked={selectedValues.includes(option)}
							onCheckedChange={(checked) => {
								if (checked === true || checked === false) {
									onToggle(option);
								}
							}}
						/>
						<span>{option}</span>
					</label>
				))}
			</PopoverContent>
		</Popover>
	);
}
