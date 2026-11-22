"use client";

import AddIcon from "@atlaskit/icon/core/add";
import type { JiraFilterCondition, JiraFilterField } from "@/components/blocks/jira-filter";
import { getJiraFilterFieldIcon } from "@/components/blocks/jira-filter/filter-field-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FilterChip, FilterChipFieldChoices, type FilterChipField } from "@/components/ui-custom/filter-chip";

const renderFieldIcon = (field: FilterChipField) => getJiraFilterFieldIcon(field.id);

export function BoardFilterPills({ conditions, fields, onChange }: Readonly<{
	conditions: readonly JiraFilterCondition[];
	fields: readonly JiraFilterField[];
	onChange: (conditions: JiraFilterCondition[]) => void;
}>) {
	const active = conditions.filter((condition) => condition.values.length);
	if (!active.length) return null;
	return (
		<div role="group" aria-label="Applied filters" className="mt-4 flex flex-wrap items-center gap-1 px-6">
			{active.map((condition) => {
				const field = fields.find((item) => item.id === condition.field);
				if (!field) return null;
				return <FilterChip key={condition.field} condition={condition} field={field} fields={fields.filter((item) => item.id === condition.field || !active.some((other) => other.field === item.id))} renderFieldIcon={renderFieldIcon} onChange={(next) => onChange(conditions.map((item) => item === condition ? next : item))} onRemove={() => onChange(conditions.filter((item) => item !== condition))} />;
			})}
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" size="icon-compact" shape="circle" aria-label="Add filter condition" />}><AddIcon label="" size="small" /></DropdownMenuTrigger>
				<DropdownMenuContent align="start" aria-label="Add filter condition"><FilterChipFieldChoices fields={fields.filter((field) => !active.some((item) => item.field === field.id))} renderFieldIcon={renderFieldIcon} onChoose={(field, value) => onChange([...conditions, { field: field.id, operator: "is", values: [value] }])} /></DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
