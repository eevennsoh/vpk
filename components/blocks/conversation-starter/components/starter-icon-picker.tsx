"use client";

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
	STARTER_ICON_OPTIONS,
	type StarterIconKey,
	type StarterIconOption,
} from "../data/starters";

export interface StarterIconPickerProps {
	value: StarterIconKey;
	onChange: (icon: StarterIconKey) => void;
	options?: readonly StarterIconOption[];
	disabled?: boolean;
}

/**
 * Per-starter icon button that opens a grid popover for choosing a new glyph.
 * The popup is controlled so a selection closes it immediately.
 */
export function StarterIconPicker({
	value,
	onChange,
	options = STARTER_ICON_OPTIONS,
	disabled = false,
}: Readonly<StarterIconPickerProps>) {
	const [open, setOpen] = useState(false);
	// Resolve via member access (option.Icon) rather than a call returning a
	// component, which the React Compiler flags as creating a component in render.
	const current = options.find((option) => option.key === value) ?? options[0];

	function handleSelect(icon: StarterIconKey): void {
		onChange(icon);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						aria-label="Change conversation starter icon"
						className="text-icon-subtlest"
						disabled={disabled}
						size="icon"
						type="button"
						variant="outline"
					/>
				}
			>
				<current.Icon label="" color="currentColor" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto" sideOffset={6}>
				<div className="grid grid-cols-5 gap-1" role="listbox" aria-label="Conversation starter icons">
					{options.map((option) => {
						const OptionIcon = option.Icon;
						const isSelected = option.key === value;
						return (
							<Button
								aria-label={option.label}
								aria-selected={isSelected}
								className={cn(isSelected && "bg-bg-selected text-text-selected")}
								key={option.key}
								onClick={() => handleSelect(option.key)}
								role="option"
								size="icon"
								type="button"
								variant="ghost"
							>
								<OptionIcon label="" size="small" color="currentColor" />
							</Button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
