import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const ARTIFACT_PICKER_DROPDOWN_CLASS = cn(
	dropdownStyles.surface,
	dropdownStyles.padding,
	"rounded-lg! shadow-2xl! [&_.rich-text-command-menu-list]:p-0!",
);
