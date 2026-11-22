import { LABEL_OPTIONS } from "@/components/blocks/jira-work-item/data/metadata-fixtures";
import type { TagColor } from "@/components/ui/tag";

const LABEL_COLORS = ["blue", "green", "purple", "orange", "teal", "magenta", "yellow"] as const satisfies readonly TagColor[];

export function labelColor(label: string): TagColor {
	const optionIndex = LABEL_OPTIONS.indexOf(label);
	if (optionIndex >= 0) return LABEL_COLORS[(optionIndex * 3 + 1) % LABEL_COLORS.length];
	const hash = Array.from(label).reduce((total, character) => total + character.codePointAt(0)!, 0);
	return LABEL_COLORS[hash % LABEL_COLORS.length];
}
