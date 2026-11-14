import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const METADATA_PICKER_POPOVER_CLASS =
	"w-auto gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none dark:shadow-none [[data-color-mode=dark]_&]:shadow-none";
export const METADATA_PICKER_POSITIONER_CLASS = "z-[700]";
export const METADATA_PICKER_SIDE_OFFSET = 8;
export const PERSON_PICKER_DROPDOWN_CLASS = cn(
	dropdownStyles.surface,
	dropdownStyles.padding,
	"rounded-lg! shadow-2xl! [&_.rich-text-command-menu-list]:p-0! [&_.rich-text-command-menu-item]:h-10!",
);
