import CalendarIcon from "@atlaskit/icon/core/calendar";

import { Avatar, AvatarImage } from "@/components/ui/avatar";

import type { SuggestionValue } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { SuggestionValueView } from "@/components/blocks/jira-work-item/suggestion-canvas/suggestion-value-view";

/** Full value, with richer person and date rendering than the shared view. Nothing is clipped. */
export function ProvenanceValue({ value }: Readonly<{ value: SuggestionValue }>) {
	if (value.kind === "person") {
		return (
			<span className="flex items-center gap-2.5">
				<Avatar size="sm"><AvatarImage alt="" src={value.person.avatarUrl} /></Avatar>
				<span className="flex min-w-0 flex-col">
					<span className="text-sm font-medium text-text">{value.person.name}</span>
					<span className="text-xs text-pretty text-text-subtlest">{value.person.role}</span>
				</span>
			</span>
		);
	}
	if (value.kind === "date") {
		return (
			<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text">
				<span className="text-icon-subtle"><CalendarIcon color="currentColor" label="" size="small" /></span>
				<time dateTime={value.iso}>{value.display}</time>
				<span className="text-xs text-text-subtlest">{value.relative}</span>
			</span>
		);
	}
	return <SuggestionValueView value={value} />;
}
