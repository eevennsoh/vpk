"use client";

import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import { useId, useState } from "react";

import { DONE_OPTIONS, FIELDS, MUTE_OPTIONS, type JiraViewConfigurationValue } from "@/components/blocks/jira-view-configuration/model";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
	Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger, useComboboxAnchor,
} from "@/components/ui/combobox";
import {
	Panel, PanelActionClose, PanelBody, PanelContent, PanelHeader, PanelTitle,
} from "@/components/ui/panel";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { cn } from "@/lib/utils";

type Option = { readonly value: string; readonly label: string };
const choiceClassName = "font-normal aria-pressed:border-border-accent-blue aria-pressed:bg-bg-accent-blue-subtlest aria-pressed:text-text-accent-blue aria-pressed:hover:bg-bg-accent-blue-subtler";

function TimingPicker<T extends Option>({
	id, label, options, selected, onChange,
}: Readonly<{
	id: string;
	label: string;
	options: readonly T[];
	selected: T;
	onChange: (option: T) => void;
}>) {
	const anchor = useComboboxAnchor();
	return (
		<div className="space-y-2">
			<label htmlFor={id} className="block text-xs text-text">{label}</label>
			<Combobox items={options} value={selected} onValueChange={(option) => {
				if (option) onChange(option);
			}}>
				<ComboboxInput anchorRef={anchor} id={id} className="w-full" showTrigger={false}>
					<ComboboxTrigger aria-label={`Show ${label} options`} className="mr-1.5 flex size-6 items-center justify-center" />
				</ComboboxInput>
				<ComboboxContent align="end" anchor={anchor}>
					<ComboboxEmpty>No options found</ComboboxEmpty>
					<ComboboxList>
						{(option: T) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</div>
	);
}

export interface JiraViewConfigurationProps {
	value: JiraViewConfigurationValue;
	onChange: (value: JiraViewConfigurationValue) => void;
	onClose: () => void;
	className?: string;
}

export function JiraViewConfiguration({ value, onChange, onClose, className }: Readonly<JiraViewConfigurationProps>) {
	const id = useId();
	const fieldsAnchor = useComboboxAnchor();
	const [previewWidth, setPreviewWidth] = useState<JiraViewConfigurationValue["columnWidth"] | null>(null);
	const width = previewWidth ?? value.columnWidth;
	const selectedDone = DONE_OPTIONS.find((option) => option.value === value.doneAfter) ?? DONE_OPTIONS[3];
	const selectedMute = MUTE_OPTIONS.find((option) => option.value === value.muteAgentSessionsAfter) ?? MUTE_OPTIONS[7];

	return (
		<Panel
			aria-label="View settings"
			className={cn("w-full", className)}
			onKeyDown={(event) => {
				if (event.key === "Escape" && !event.defaultPrevented) {
					event.stopPropagation();
					onClose();
				}
			}}
		>
			<PanelHeader className="px-6">
				<PanelTitle>View settings</PanelTitle>
				<PanelActionClose label="Close view settings" onClick={onClose} />
			</PanelHeader>
			<ScrollFade render={<PanelContent />} size={6}>
				<PanelBody className="space-y-6 pb-6 pt-3">
					<TimingPicker id={`${id}-done`} label="Hide done work items after" options={DONE_OPTIONS} selected={selectedDone}
						onChange={(option) => onChange({ ...value, doneAfter: option.value })} />
					<TimingPicker id={`${id}-mute`} label="Mute agent sessions after" options={MUTE_OPTIONS} selected={selectedMute}
						onChange={(option) => onChange({ ...value, muteAgentSessionsAfter: option.value })} />
					<section aria-labelledby={`${id}-columns`}>
						<h3 id={`${id}-columns`} className="text-xs font-normal">Columns</h3>
						<p className="mt-0.5 text-xs text-text-subtlest">Choose whether columns keep a fixed width or flexible to fill space.</p>
						<div aria-hidden="true" data-column-width-preview={width} className={cn(
							"mt-3 grid h-20 gap-1.5 overflow-hidden rounded-lg border border-border p-2 pb-0 transition-[grid-template-columns] duration-slow ease-in-out",
							width === "fixed" ? "grid-cols-[repeat(4,3rem)]" : "grid-cols-[repeat(4,4rem)]",
						)}>
							{[0, 1, 2, 3].map((cell) => <div key={cell} className="rounded-t-sm bg-linear-to-b from-bg-neutral from-90% to-transparent" />)}
						</div>
						<div role="group" aria-label="Column width" className="mt-3 grid grid-cols-2 gap-3">
							{(["flexible", "fixed"] as const).map((choice) => (
								<Button key={choice} variant="outline" className={choiceClassName} aria-pressed={value.columnWidth === choice}
									onMouseEnter={() => setPreviewWidth(choice)} onMouseLeave={() => setPreviewWidth(null)}
									onFocus={() => setPreviewWidth(choice)} onBlur={() => setPreviewWidth(null)}
									onClick={() => onChange({ ...value, columnWidth: choice })}>
									{choice === "flexible" ? "Flexible" : "Fixed"}
								</Button>
							))}
						</div>
					</section>
					<section aria-labelledby={`${id}-scrolling`}>
						<h3 id={`${id}-scrolling`} className="text-xs font-normal">Scrolling</h3>
						<p className="mt-0.5 text-xs text-text-subtlest">Set scrolling to individual columns or across the whole board.</p>
						<div role="group" aria-label="Board scrolling" className="mt-3 grid grid-cols-2 gap-3">
							<Button variant="outline" className={choiceClassName} aria-pressed={value.scrollMode === "columns"} onClick={() => onChange({ ...value, scrollMode: "columns" })}>Within columns</Button>
							<Button variant="outline" className={choiceClassName} aria-pressed={value.scrollMode === "board"} onClick={() => onChange({ ...value, scrollMode: "board" })}>Whole board</Button>
						</div>
					</section>
					<div>
						<label htmlFor={`${id}-fields`} className="mb-2 block text-xs">Fields</label>
						<Combobox<(typeof FIELDS)[number]> items={FIELDS} value={null} onValueChange={(field) => {
							if (field && !value.visibleFieldIds.includes(field.value)) {
								onChange({ ...value, visibleFieldIds: [...value.visibleFieldIds, field.value] });
							}
						}}>
							<ComboboxInput anchorRef={fieldsAnchor} id={`${id}-fields`} placeholder="Add fields" className="w-full" showTrigger={false}>
								<ComboboxTrigger aria-label="Show field options" className="mr-1.5 flex size-6 items-center justify-center" />
							</ComboboxInput>
							<ComboboxContent align="end" anchor={fieldsAnchor}>
								<ComboboxEmpty>No fields found</ComboboxEmpty>
								<ComboboxList>
									{(field: (typeof FIELDS)[number]) => (
										<ComboboxItem key={field.value} value={field} aria-selected={value.visibleFieldIds.includes(field.value)}>
											{field.label}
											{value.visibleFieldIds.includes(field.value) ? <span className="ml-auto" aria-hidden="true"><CheckMarkIcon label="" size="small" /></span> : null}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<ul className="pt-3">
							{FIELDS.filter((field) => value.visibleFieldIds.includes(field.value)).map((field) => (
								<li key={field.value} className="group flex h-10 items-center gap-2 rounded-md px-2 hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
									<IconTile aria-hidden as="span" className="shrink-0 text-icon-subtle" icon={<field.icon label="" size="small" />} iconSize="small" label="" size="xxsmall" variant="transparent" />
									<span className="min-w-0 flex-1 text-sm">{field.label}</span>
									<Button variant="ghost" size="icon-compact" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-label={`Remove ${field.label}`}
										onClick={() => onChange({ ...value, visibleFieldIds: value.visibleFieldIds.filter((fieldId) => fieldId !== field.value) })}>
										<CrossIcon label="" size="small" />
									</Button>
								</li>
							))}
						</ul>
					</div>
				</PanelBody>
			</ScrollFade>
		</Panel>
	);
}
