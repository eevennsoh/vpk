"use client";

import { useState, type ReactNode } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
	DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface FilterChipField {
	id: string;
	label: string;
	options: readonly { value: string; label: string }[];
}

export interface FilterChipCondition {
	field: string;
	operator: "is" | "is not";
	values: readonly string[];
}

export interface FilterChipProps {
	condition: FilterChipCondition;
	field: FilterChipField;
	fields: readonly FilterChipField[];
	onChange: (condition: FilterChipCondition) => void;
	onRemove: () => void;
	renderFieldIcon?: (field: FilterChipField) => ReactNode;
}

const partClass = "h-full rounded-none border-0 px-1 text-xs font-normal text-text-subtlest hover:bg-bg-neutral-subtle-hovered aria-expanded:border-transparent focus-visible:z-10 focus-visible:ring-inset";

export interface FilterChipFieldChoicesProps {
	fields: readonly FilterChipField[];
	onChoose: (field: FilterChipField, value: string) => void;
	renderFieldIcon?: (field: FilterChipField) => ReactNode;
}

export function FilterChipFieldChoices({ fields, onChoose, renderFieldIcon }: Readonly<FilterChipFieldChoicesProps>) {
	return fields.map((field) => (
		<DropdownMenuSub key={field.id}>
			<DropdownMenuSubTrigger elemBefore={renderFieldIcon?.(field)} elemBeforeSize={16}>{field.label}</DropdownMenuSubTrigger>
			<DropdownMenuSubContent aria-label={`${field.label} filter options`}>
				{field.options.map((option) => (
					<DropdownMenuItem key={option.value} onClick={() => onChoose(field, option.value)}>{option.label}</DropdownMenuItem>
				))}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	));
}

export function FilterChip({ condition, field, fields, onChange, onRemove, renderFieldIcon }: Readonly<FilterChipProps>) {
	const [openPart, setOpenPart] = useState<"field" | "operator" | "value" | null>(null);
	const label = field.options.find((option) => option.value === condition.values[0])?.label ?? condition.values[0];
	const value = condition.values.length > 1 ? `${label} +${condition.values.length - 1}` : label;
	return (
		<div role="group" aria-label={`${field.label} ${condition.operator} ${value}`} className={cn("inline-flex h-6 max-w-full items-stretch gap-px overflow-hidden rounded-full border border-dashed border-border-disabled bg-bg-neutral-subtle p-px text-xs hover:border-solid hover:border-border focus-within:border-solid focus-within:border-border", openPart ? "border-solid border-border-selected bg-bg-selected text-text-selected hover:border-border-selected focus-within:border-border-selected" : null)}>
			<DropdownMenu open={openPart === "field"} onOpenChange={(open) => setOpenPart(open ? "field" : null)}>
				<DropdownMenuTrigger render={<Button variant="ghost" className={cn(partClass, "rounded-l-full rounded-r-none pl-2", openPart ? "text-text-selected" : null)} aria-label={`Change ${field.label} field`} />}>{field.label}</DropdownMenuTrigger>
				<DropdownMenuContent align="start" aria-label="Filter fields"><FilterChipFieldChoices fields={fields} renderFieldIcon={renderFieldIcon} onChoose={(next, selected) => { onChange({ field: next.id, operator: condition.operator, values: [selected] }); setOpenPart(null); }} /></DropdownMenuContent>
			</DropdownMenu>
			<DropdownMenu open={openPart === "operator"} onOpenChange={(open) => setOpenPart(open ? "operator" : null)}>
				<DropdownMenuTrigger render={<Button variant="ghost" className={cn(partClass, openPart ? "text-text-selected" : null)} aria-label={`Change ${field.label} operator`} />}>{condition.operator}</DropdownMenuTrigger>
				<DropdownMenuContent align="start" aria-label="Filter operator">
					{(["is", "is not"] as const).map((operator) => <DropdownMenuCheckboxItem key={operator} checked={condition.operator === operator} indicatorPlacement="end" onCheckedChange={() => { onChange({ ...condition, operator }); setOpenPart(null); }}>{operator}</DropdownMenuCheckboxItem>)}
				</DropdownMenuContent>
			</DropdownMenu>
			<DropdownMenu open={openPart === "value"} onOpenChange={(open) => setOpenPart(open ? "value" : null)}>
				<DropdownMenuTrigger render={<Button variant="ghost" className={cn(partClass, "max-w-40 text-text", openPart ? "text-text-selected" : null)} aria-label={`Change ${field.label} values`} />}><span className="truncate">{value}</span></DropdownMenuTrigger>
				<DropdownMenuContent align="start" aria-label={`${field.label} filter options`}>
					{field.options.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={condition.values.includes(option.value)} closeOnClick={false} indicatorPlacement="end" onCheckedChange={() => {
						const values = condition.values.includes(option.value) ? condition.values.filter((value) => value !== option.value) : [...condition.values, option.value];
						if (values.length) onChange({ ...condition, values }); else onRemove();
					}}>{option.label}</DropdownMenuCheckboxItem>)}
				</DropdownMenuContent>
			</DropdownMenu>
			<Button variant="ghost" size="icon-compact" className="h-full w-6 rounded-l-none rounded-r-full border-0 pr-1 text-icon-subtlest focus-visible:ring-inset" aria-label={`Remove ${field.label} filter`} onClick={onRemove}><CrossIcon label="" size="small" /></Button>
		</div>
	);
}
