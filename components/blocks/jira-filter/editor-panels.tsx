"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import AddIcon from "@atlaskit/icon/core/add";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import SearchIcon from "@atlaskit/icon/core/search";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuSearchField } from "@/components/ui/dropdown-menu";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type {
	JiraFilterCondition,
	JiraFilterField,
} from "@/components/blocks/jira-filter/model";

export function BasicPanel({
	fields,
	value,
	activeField,
	search,
	onFieldChange,
	onSearchChange,
	onChange,
	onDismiss,
}: Readonly<{
	fields: readonly JiraFilterField[];
	value: readonly JiraFilterCondition[];
	activeField: string;
	search: string;
	onFieldChange: (id: string) => void;
	onSearchChange: (value: string) => void;
	onChange: (value: JiraFilterCondition[]) => void;
	onDismiss: () => void;
}>) {
	const [visibleIds, setVisibleIds] = useState(() => [
		...new Set([
			...fields.slice(0, 6).map((item) => item.id),
			...value.map((item) => item.field),
		]),
	]);
	const field = fields.find((item) => item.id === activeField) ?? fields[0];
	const activeCondition = value.find((item) => item.field === field?.id);
	const selected = activeCondition?.values ?? [];
	const options =
		field?.options.filter((item) =>
			item.label
				.toLocaleLowerCase()
				.includes(search.trim().toLocaleLowerCase()),
		) ?? [];
	const update = (values: readonly string[]) =>
		onChange([
			...value.filter((item) => item.field !== field?.id),
			...(field && values.length
				? [
						{
							field: field.id,
							operator: activeCondition?.operator ?? "is",
							values,
						},
					]
				: []),
		]);
	return (
		<div className="grid min-h-80 grid-cols-[11rem_minmax(0,1fr)] max-sm:grid-cols-[8rem_minmax(0,1fr)]">
			<div className="max-h-80 overflow-y-auto border-r border-border p-2">
				{fields
					.filter((item) => visibleIds.includes(item.id))
					.map((item) => {
						const count =
							value.find((condition) => condition.field === item.id)?.values
								.length ?? 0;
						return (
							<button
								type="button"
								key={item.id}
								aria-pressed={field?.id === item.id}
								onClick={() => {
									onFieldChange(item.id);
									onSearchChange("");
								}}
								className={cn(
									"flex w-full justify-between rounded-md px-2 py-1.5 text-left hover:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-border-focused",
									field?.id === item.id && "bg-bg-selected text-text-selected",
								)}
							>
								<span>{item.label}</span>
								{count ? <span className="text-xs">{count}</span> : null}
							</button>
						);
					})}
				<NativeSelect
					className="mt-3 w-full"
					aria-label="Add filter"
					value=""
					disabled={visibleIds.length >= fields.length}
					onChange={(event) => {
						if (event.target.value) {
							setVisibleIds([...visibleIds, event.target.value]);
							onFieldChange(event.target.value);
							onSearchChange("");
						}
					}}
				>
					<NativeSelectOption value="">+ Add filter</NativeSelectOption>
					{fields
						.filter((item) => !visibleIds.includes(item.id))
						.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{item.label}
							</NativeSelectOption>
						))}
				</NativeSelect>
			</div>
			<div className="flex min-w-0 flex-col">
				<div className="relative z-10 pb-2">
					<DropdownMenuSearchField
						icon={<SearchIcon label="" />}
						label={`Search ${field?.label ?? "filter"} values`}
						placeholder="Search values"
						value={search}
						onValueChange={onSearchChange}
						onClear={() => onSearchChange("")}
						onEscape={onDismiss}
					/>
					<StickyRowScrollFade className="opacity-100" />
				</div>
				<div className="max-h-72 min-h-48 flex-1 overflow-y-auto px-3 py-1">
					{options.map((option) => (
						<button
							key={option.value}
							type="button"
							aria-pressed={selected.includes(option.value)}
							onClick={() =>
								update(
									selected.includes(option.value)
										? selected.filter((item) => item !== option.value)
										: field?.multiple
											? [...selected, option.value]
											: [option.value],
								)
							}
							className="flex w-full justify-between rounded-md px-2 py-1.5 text-left hover:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-border-focused"
						>
							<span>{option.label}</span>
							{selected.includes(option.value) ? (
								<CheckMarkIcon label="" />
							) : null}
						</button>
					))}
					{!options.length ? (
						<p className="p-2 text-text-subtlest">
							No values match your search
						</p>
					) : null}
				</div>
				<div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-subtlest">
					<Button
						variant="ghost"
						size="compact"
						disabled={!selected.length}
						onClick={() => update([])}
					>
						Clear
					</Button>
					<span>{selected.length} selected</span>
				</div>
			</div>
		</div>
	);
}

export function AdvancedPanel({
	fields,
	conditions,
	onChange,
	onClear,
	compact = false,
}: Readonly<{
	fields: readonly JiraFilterField[];
	conditions: readonly JiraFilterCondition[];
	onChange: (value: JiraFilterCondition[]) => void;
	onClear: () => void;
	compact?: boolean;
}>) {
	const update = (index: number, next: JiraFilterCondition) =>
		onChange(conditions.map((item, i) => (i === index ? next : item)));
	return (
		<div className={compact ? "p-1" : "min-h-80 p-4"}>
			<div className="space-y-3">
				{conditions.map((condition, index) => {
					const field = fields.find((item) => item.id === condition.field);
					return (
						<div key={index} className="flex flex-wrap items-start gap-2">
							<NativeSelect
								aria-label={`Field ${index + 1}`}
								value={condition.field}
								onChange={(event) =>
									update(index, {
										field: event.target.value,
										operator: "is",
										values: [],
									})
								}
							>
								<NativeSelectOption value="">Choose field</NativeSelectOption>
								{fields
									.filter(
										(item) =>
											item.id === condition.field ||
											!conditions.some((other) => other.field === item.id),
									)
									.map((item) => (
										<NativeSelectOption key={item.id} value={item.id}>
											{item.label}
										</NativeSelectOption>
									))}
							</NativeSelect>
							<NativeSelect
								aria-label={`Operator ${index + 1}`}
								value={condition.operator}
								onChange={(event) =>
									update(index, {
										...condition,
										operator: event.target.value === "is not" ? "is not" : "is",
									})
								}
							>
								<NativeSelectOption value="is">is</NativeSelectOption>
								<NativeSelectOption value="is not">is not</NativeSelectOption>
							</NativeSelect>
							<NativeSelect
								aria-label={`Value ${index + 1}`}
								value={condition.values[0] ?? ""}
								disabled={!field}
								onChange={(event) =>
									update(index, {
										...condition,
										values: event.target.value
											? [
													event.target.value,
													...condition.values
														.slice(1)
														.filter((value) => value !== event.target.value),
												]
											: [],
									})
								}
							>
								<NativeSelectOption value="">Choose value</NativeSelectOption>
								{field?.options.map((option) => (
									<NativeSelectOption key={option.value} value={option.value}>
										{option.label}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Remove condition ${index + 1}`}
								onClick={() =>
									onChange(conditions.filter((_, i) => i !== index))
								}
							>
								<CrossIcon label="" />
							</Button>
							{field?.multiple ? (
								<fieldset className="basis-full pl-1">
									<legend className="text-xs text-text-subtlest">
										Additional {field.label} values
									</legend>
									<div className="flex flex-wrap gap-3 pt-1">
										{field.options
											.filter((option) => option.value !== condition.values[0])
											.map((option) => (
												<label
													key={option.value}
													className="flex items-center gap-1.5 text-sm"
												>
													<Checkbox
														checked={condition.values.includes(option.value)}
														onCheckedChange={(checked) =>
															update(index, {
																...condition,
																values: checked
																	? [...condition.values, option.value]
																	: condition.values.filter(
																			(value) => value !== option.value,
																		),
															})
														}
													/>
													{option.label}
												</label>
											))}
									</div>
								</fieldset>
							) : null}
						</div>
					);
				})}
			</div>
			{!conditions.length ? (
				<p className={cn("text-center text-text-subtlest", compact ? "py-4" : "py-12")}>
					Add a condition to filter work items.
				</p>
			) : null}
			<Button
				variant="ghost"
				onClick={() =>
					onChange([...conditions, { field: "", operator: "is", values: [] }])
				}
				disabled={conditions.length >= fields.length}
			>
				<AddIcon label="" />
				Add condition
			</Button>
			{conditions.length ? (
				<Button variant="ghost" onClick={onClear}>
					Clear
				</Button>
			) : null}
		</div>
	);
}
