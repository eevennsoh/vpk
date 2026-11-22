"use client";

import AddIcon from "@atlaskit/icon/core/add";
import CrossIcon from "@atlaskit/icon/core/cross";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Combobox, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxTrigger, ComboboxValue, useComboboxAnchor } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import type { JiraFilterCondition, JiraFilterField } from "./model";

const EMPTY_CONDITION: JiraFilterCondition = { field: "", operator: "is", values: [] };
function ConditionValues({ condition, field, index, onChange }: Readonly<{
	condition: JiraFilterCondition;
	field?: JiraFilterField;
	index: number;
	onChange: (values: readonly string[]) => void;
}>) {
	const anchor = useComboboxAnchor();
	const label = (value: string) => field?.options.find((option) => option.value === value)?.label ?? value;
	return (
		<Combobox multiple autoHighlight disabled={!field} items={field?.options.map((option) => option.value) ?? []} itemToStringLabel={label} value={[...condition.values]} onValueChange={onChange}>
			<ComboboxChips ref={anchor} className="h-8 min-h-8 min-w-0 flex-nowrap overflow-hidden rounded-md px-1.5 py-0 has-data-[slot=tag]:px-1">
				<ComboboxValue>{(values: string[]) => <>
					{values[0] ? <Tag className="min-w-0 max-w-full shrink" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onRemove={() => onChange(condition.values.filter((value) => value !== values[0]))}>{label(values[0])}</Tag> : null}
					{values.length > 1 ? <span className="shrink-0 text-xs text-text-subtle">+{values.length - 1}</span> : null}
					<ComboboxChipsInput aria-label={`Value ${index + 1}`} className="min-w-0 flex-1 text-sm" placeholder={values.length ? "" : "Search values"} />
					<ComboboxTrigger aria-label={`Show values for condition ${index + 1}`} className="inline-flex size-4 shrink-0 items-center justify-center [&>span]:inline-flex [&>span]:items-center [&>span]:justify-center [&_svg]:size-3!" />
				</>}</ComboboxValue>
			</ComboboxChips>
			<ComboboxContent anchor={anchor} className="max-h-48">
				<ComboboxEmpty>No values found</ComboboxEmpty>
				<ComboboxList>{(item: string) => <ComboboxItem key={item} value={item}>{label(item)}</ComboboxItem>}</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

export function AdvancedFilterBuilder({ fields, draft, onChange }: Readonly<{
	fields: readonly JiraFilterField[];
	draft: readonly JiraFilterCondition[];
	onChange: (next: JiraFilterCondition[]) => void;
}>) {
	const conditions = draft.length ? draft : [EMPTY_CONDITION];
	const update = (index: number, next: JiraFilterCondition) => onChange(conditions.map((condition, current) => current === index ? next : condition));
	return (
		<div className="flex max-h-60 min-h-0 flex-col">
			<div className="min-h-0 overflow-y-auto p-3">
				<div className="space-y-2">
					{conditions.map((condition, index) => {
						const field = fields.find((item) => item.id === condition.field);
						const availableFields = fields.filter((item) => item.id === condition.field || !conditions.some((other) => other.field === item.id));
						return <div key={index} className="grid grid-cols-[minmax(0,128px)_minmax(0,88px)_minmax(0,1fr)_24px] items-center gap-1.5">
							<Select items={availableFields.map((item) => ({ label: item.label, value: item.id }))} value={condition.field || null} onValueChange={(value) => { if (value) update(index, { field: value, operator: "is", values: [] }); }}>
								<SelectTrigger aria-label={`Field ${index + 1}`} className="w-full min-w-0"><SelectValue placeholder="Attribute" /></SelectTrigger>
								<SelectContent align="start" alignItemWithTrigger={false} positionerClassName="z-[750]">{availableFields.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
							</Select>
							<Select value={condition.operator} onValueChange={(value) => { if (value === "is" || value === "is not") update(index, { ...condition, operator: value }); }}>
								<SelectTrigger aria-label={`Operator ${index + 1}`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
								<SelectContent align="start" alignItemWithTrigger={false} positionerClassName="z-[750]"><SelectItem value="is">is</SelectItem><SelectItem value="is not">is not</SelectItem></SelectContent>
							</Select>
							<ConditionValues key={condition.field} condition={condition} field={field} index={index} onChange={(values) => update(index, { ...condition, values: field?.multiple ? values : values.slice(-1) })} />
							<Button aria-label={`Remove condition ${index + 1}`} disabled={conditions.length === 1 && !condition.field} onClick={() => onChange(conditions.filter((_, current) => current !== index))} size="icon-compact" variant="ghost"><CrossIcon label="" size="small" /></Button>
						</div>;
					})}
					<div className="grid grid-cols-[minmax(0,1fr)_24px] gap-1.5"><Button className="relative justify-center" disabled={conditions.length >= fields.length} onClick={() => onChange([...conditions, EMPTY_CONDITION])} variant="outline"><span className="absolute left-2 inline-flex"><AddIcon label="" size="small" /></span>Add condition</Button></div>
				</div>
			</div>
			<div className="shrink-0 border-t border-border p-1.5"><DropdownMenuItem closeOnClick={false} onClick={() => onChange([])}>Clear</DropdownMenuItem></div>
		</div>
	);
}
