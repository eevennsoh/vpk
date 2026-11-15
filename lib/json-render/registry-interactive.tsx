"use client";

// Interactive and form-input components for the json-render registry.
import { Children } from "react";
import { useBoundProp } from "@json-render/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import NodeIcon from "@atlaskit/icon/core/node";
import { Checkbox as CheckboxPrimitive } from "@/components/ui/checkbox";
import { Switch as SwitchPrimitive } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider as SliderPrimitive } from "@/components/ui/slider";
import { Toggle as TogglePrimitive } from "@/components/ui/toggle";
import { ToggleGroup as ToggleGroupPrimitive, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tag as TagPrimitive, TagGroup } from "@/components/ui/tag";
import { DatePicker as DatePickerPrimitive } from "@/components/ui/date-picker";
import { InlineEdit as InlineEditPrimitive } from "@/components/ui/inline-edit";
import { InputOTP as InputOTPRoot, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Calendar as CalendarPrimitive } from "@/components/ui/calendar";
import { TimePicker as TimePickerPrimitive } from "@/components/ui/time-picker";
import { DateTimePicker as DateTimePickerPrimitive } from "@/components/ui/date-time-picker";
import { FileTree as FileTreeRoot } from "@/components/ui-custom/file-tree";
import { nu, toSafeText, toSafeOptionalText } from "./registry-values";
import { parseDirectoryTreeText, parseTagTaxonomyText, renderFileTreeNode } from "./registry-file-tree";
import type { Components } from "@json-render/react";
import type { catalog } from "./catalog";


export const interactiveComponents = {
	// ── Interactive ────────────────────────────────
	Tabs: ({ props, children }) => {
		const { tabs, defaultValue } = props;
		return (
			<Tabs defaultValue={toSafeOptionalText(defaultValue) || toSafeOptionalText(tabs[0]?.value)}>
				<TabsList className="w-full overflow-x-auto">
					{tabs.map((tab: { value: string; label: string }) => (
						<TabsTrigger key={toSafeText(tab.value)} value={toSafeText(tab.value)}>
							{toSafeText(tab.label)}
						</TabsTrigger>
					))}
				</TabsList>
				{children}
			</Tabs>
		);
	},

	TabContent: ({ props, children }) => {
		const { value } = props;
		return <TabsContent value={value}>{children}</TabsContent>;
	},

	Progress: ({ props }) => {
		const { value, max = 100, label } = props;
		const maxVal = max ?? 100;
		const percentage = maxVal > 0 ? (value / maxVal) * 100 : 0;
		return (
			<div className="space-y-1">
				{label ? <p className="text-sm text-text-subtle">{toSafeText(label)}</p> : null}
				<Progress value={percentage} />
			</div>
		);
	},

	Skeleton: ({ props }) => {
		const { width, height, className } = props;
		return <Skeleton className={className ?? undefined} style={{ width: width ?? undefined, height: height ?? undefined }} />;
	},

	Callout: ({ props }) => {
		const { type = "info" } = props;
		const title = toSafeOptionalText(props.title);
		const content = toSafeText(props.content);
		const icon = toSafeOptionalText(props.icon);
		const colorMap: Record<string, string> = {
			info: "border-border-information bg-bg-information",
			warning: "border-border-warning bg-bg-warning",
			success: "border-border-success bg-bg-success",
			error: "border-border-danger bg-bg-danger",
		};
		const iconMap: Record<string, string> = {
			info: "\u2139\uFE0F",
			warning: "\u26A0\uFE0F",
			success: "\u2705",
			error: "\u274C",
		};
		return (
			<div className={cn("rounded-lg border p-4", colorMap[type ?? "info"] || colorMap.info)}>
				<div className="flex gap-2">
					{icon ? <span className="shrink-0">{icon}</span> : (type ?? "info") in iconMap ? <span className="shrink-0">{iconMap[type ?? "info"]}</span> : null}
					<div>
						{title ? <p className="text-sm font-medium text-text">{title}</p> : null}
						<p className="text-sm text-text-subtle">{content}</p>
					</div>
				</div>
			</div>
		);
	},

	Accordion: ({ props }) => {
		const { items } = props;
		return (
			<Accordion>
				{items.map((item: { title: string; content: string }) => {
					const title = toSafeText(item.title);
					const content = toSafeText(item.content);
					const itemKey = `${title}-${content.slice(0, 64)}`;
					return (
						<AccordionItem key={itemKey} value={itemKey}>
							<AccordionTrigger>{title}</AccordionTrigger>
							<AccordionContent>
								{(() => {
									const fileTreeData = parseDirectoryTreeText(content);
									if (fileTreeData) {
										return (
											<div className="rounded-md border border-border bg-surface p-2">
												<FileTreeRoot
													className="bg-transparent text-xs"
													defaultExpanded={new Set(fileTreeData.defaultExpandedPaths)}
												>
													{fileTreeData.roots.map((node) => renderFileTreeNode(node))}
												</FileTreeRoot>
											</div>
										);
									}

									const tagTaxonomy = /tag taxonomy/i.test(title)
										? parseTagTaxonomyText(content)
										: null;
									if (tagTaxonomy) {
										return (
											<div className="space-y-3">
												{tagTaxonomy.map((group) => (
													<div key={group.label} className="space-y-1.5">
														<div className="text-xs font-medium text-text-subtlest">
															{group.label}
														</div>
														<TagGroup className="gap-1.5">
															{group.tags.map((tag) => (
																<TagPrimitive
																	key={`${group.label}-${tag}`}
																	color={group.color}
																	variant="rounded"
																>
																	{tag}
																</TagPrimitive>
															))}
														</TagGroup>
													</div>
												))}
											</div>
										);
									}

									return content;
								})()}
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>
		);
	},

	AccordionForm: ({ props, children }) => {
		const { items, defaultOpenValues } = props;
		const childArray = Children.toArray(children);
		return (
			<Accordion defaultValue={defaultOpenValues ?? undefined}>
				{items.map((item: { value: string; title: string }, i: number) => (
					<AccordionItem key={item.value} value={item.value}>
						<AccordionTrigger>{toSafeText(item.title)}</AccordionTrigger>
						<AccordionContent>
							{childArray[i] ?? null}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		);
	},

	Timeline: ({ props }) => {
		const { items } = props;
		return (
			<div className="flex flex-col">
				{items.map((item, i) => (
					<div key={i} className="flex gap-3">
						<div className="flex flex-col items-center">
							<div className="flex h-5 shrink-0 items-center justify-center">
								<NodeIcon label="" size="small" color={token("color.icon.subtlest")} />
							</div>
							{i < items.length - 1 ? <div className="w-px flex-1 bg-border" /> : null}
						</div>
						<div className="pb-4">
							<p className="text-sm font-medium leading-5 text-text">{toSafeText(item.title)}</p>
							{item.description ? <p className="text-xs text-text-subtle">{toSafeText(item.description)}</p> : null}
							{item.date ? <p className="mt-0.5 text-xs text-text-subtlest">{toSafeText(item.date)}</p> : null}
						</div>
					</div>
				))}
			</div>
		);
	},

	CalendarTimeline: ({ props }) => {
		const { events } = props;
		const colorMap: Record<string, { dot: string; bar: string; bg: string }> = {
			blue: { dot: "bg-blue-500", bar: "bg-blue-500/30", bg: "bg-blue-500/8" },
			green: { dot: "bg-green-500", bar: "bg-green-500/30", bg: "bg-green-500/8" },
			red: { dot: "bg-red-500", bar: "bg-red-500/30", bg: "bg-red-500/8" },
			purple: { dot: "bg-purple-500", bar: "bg-purple-500/30", bg: "bg-purple-500/8" },
			yellow: { dot: "bg-yellow-500", bar: "bg-yellow-500/30", bg: "bg-yellow-500/8" },
			teal: { dot: "bg-teal-500", bar: "bg-teal-500/30", bg: "bg-teal-500/8" },
		};
		return (
			<div className="flex flex-col">
				{events.map((event, i) => {
					const c = colorMap[toSafeText(event.color)] ?? colorMap.blue;
					const isCurrent = event.status === "current";
					const isPast = event.status === "past";
					return (
						<div key={i} className="flex gap-3">
							{/* Time column */}
							<div className="flex w-16 shrink-0 justify-end pt-2.5">
								<span className={cn("text-xs font-medium tabular-nums", isPast ? "text-text-subtlest" : "text-text-subtle")}>
									{toSafeText(event.time)}
								</span>
							</div>
							{/* Timeline rail */}
							<div className="flex flex-col items-center">
								<div className="flex h-8 shrink-0 items-center justify-center">
									<div
										className={cn(
											"rounded-full transition-all",
											isCurrent ? "h-3 w-3 ring-2 ring-offset-1 ring-offset-surface" : "h-2 w-2",
											isCurrent ? cn(c.dot, "ring-blue-500/40") : isPast ? "bg-text-subtlest" : c.dot,
										)}
									/>
								</div>
								{i < events.length - 1 ? <div className={cn("w-px flex-1", isPast ? "bg-border" : c.bar)} /> : null}
							</div>
							{/* Event card */}
							<div className={cn("mb-2 flex-1 rounded-lg border px-3 py-2", isCurrent ? cn("border-blue-500/30", c.bg) : "border-border bg-surface")}>
								<p className={cn("text-sm font-medium", isPast ? "text-text-subtle" : "text-text")}>
									{toSafeText(event.title)}
								</p>
								<div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
									{event.duration ? (
										<span className="text-xs text-text-subtlest">{toSafeText(event.duration)}</span>
									) : null}
									{event.location ? (
										<span className="text-xs text-text-subtlest">{toSafeText(event.location)}</span>
									) : null}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		);
	},

	RadioGroup: ({ props, bindings }) => {
		const { options, label } = props;
		const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<RadioGroup value={value ?? ""} onValueChange={setValue}>
					{options.map((opt) => (
						<div key={toSafeText(opt.value)} className="flex items-center gap-2">
							<RadioGroupItem value={toSafeText(opt.value)} />
							<Label className="font-normal">{toSafeText(opt.label)}</Label>
						</div>
					))}
				</RadioGroup>
			</div>
		);
	},

	SelectInput: ({ props, bindings }) => {
		const { options, placeholder, label } = props;
		const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<Select
					value={value ?? ""}
					onValueChange={(v) => {
						if (v !== null) setValue(v);
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder={toSafeOptionalText(placeholder) ?? "Select..."} />
					</SelectTrigger>
					<SelectContent>
						{options.map((opt) => (
							<SelectItem key={toSafeText(opt.value)} value={toSafeText(opt.value)}>
								{toSafeText(opt.label)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	},

	TextInput: ({ props, bindings }) => {
		const { placeholder, label, type = "text" } = props;
		const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<Input type={nu(type)} placeholder={toSafeOptionalText(placeholder)} value={value ?? ""} onChange={(e) => setValue(e.target.value)} />
			</div>
		);
	},

	Button: ({ props, emit }) => {
		const { label, variant = "default", size = "default", disabled } = props;
		return (
			<Button variant={variant} size={size} disabled={disabled ?? false} onClick={() => emit("press")}>
				{toSafeText(label)}
			</Button>
		);
	},

	// ── Interactive (extended) ────────────────────
	Checkbox: ({ props, bindings }) => {
		const { label, disabled } = props;
		const [checked, setChecked] = useBoundProp<boolean>(nu(props.checked), bindings?.checked);
		return (
			<div className="flex items-center gap-2">
				<CheckboxPrimitive checked={checked ?? false} onCheckedChange={(v) => setChecked(v as boolean)} disabled={nu(disabled)} />
				{label ? <Label className="font-normal">{toSafeText(label)}</Label> : null}
			</div>
		);
	},

	Switch: ({ props, bindings }) => {
		const { label, size = "default", disabled } = props;
		const [checked, setChecked] = useBoundProp<boolean>(nu(props.checked), bindings?.checked);
		return (
			<div className="flex items-center gap-2">
				<SwitchPrimitive checked={checked ?? false} onCheckedChange={setChecked} size={nu(size)} disabled={nu(disabled)} />
				{label ? <Label className="font-normal">{toSafeText(label)}</Label> : null}
			</div>
		);
	},

	TextArea: ({ props, bindings }) => {
		const { placeholder, label, rows = 3 } = props;
		const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<Textarea placeholder={toSafeOptionalText(placeholder)} value={value ?? ""} onChange={(e) => setValue(e.target.value)} rows={nu(rows)} />
			</div>
		);
	},

	Slider: ({ props, bindings }) => {
		const { min = 0, max = 100, step = 1, label } = props;
		const [value, setValue] = useBoundProp<number>(nu(props.value), bindings?.value);
		const displayValue = value ?? min ?? 0;
		return (
			<div className="space-y-2">
				{label ? (
					<div className="flex items-center justify-between">
						<Label>{toSafeText(label)}</Label>
						<span className="text-xs tabular-nums text-text-subtle">{displayValue}</span>
					</div>
				) : null}
				<SliderPrimitive value={[displayValue]} onValueChange={(v) => setValue(Array.isArray(v) ? v[0] : v)} min={nu(min)} max={nu(max)} step={nu(step)} />
			</div>
		);
	},

	Toggle: ({ props, bindings }) => {
		const { text, variant = "default", size = "default" } = props;
		const [pressed, setPressed] = useBoundProp<boolean>(nu(props.pressed), bindings?.pressed);
		return (
			<TogglePrimitive variant={variant} size={size} pressed={pressed ?? false} onPressedChange={setPressed}>
				{toSafeText(text)}
			</TogglePrimitive>
		);
	},

	ToggleGroup: ({ props, bindings }) => {
		const { options, type = "single" } = props;
		const [value, setValue] = useBoundProp<string | string[]>(nu(props.value), bindings?.value);
		const arrayValue = type === "multiple" ? (Array.isArray(value) ? value : value ? [value] : []) : typeof value === "string" && value ? [value] : [];
		return (
			<ToggleGroupPrimitive
				value={arrayValue}
				onValueChange={(v: string[]) => {
					if (type === "multiple") {
						setValue(v);
					} else {
						setValue(v[0] ?? "");
					}
				}}
			>
				{options.map((opt: { label: string; value: string }) => (
					<ToggleGroupItem key={toSafeText(opt.value)} value={toSafeText(opt.value)}>
						{toSafeText(opt.label)}
					</ToggleGroupItem>
				))}
			</ToggleGroupPrimitive>
		);
	},

	// ── Form Inputs (extended) ────────────────────────
	DatePicker: ({ props, bindings }) => {
		const { placeholder, label, disabled } = props;
		const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
		const dateValue = value ? new Date(value) : undefined;
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<DatePickerPrimitive
					value={dateValue}
					onChange={(date) => setValue(date ? date.toISOString().split("T")[0] : "")}
					placeholder={toSafeOptionalText(placeholder)}
					disabled={nu(disabled)}
				/>
			</div>
		);
	},

	TimePicker: ({ props, bindings }) => {
		const { placeholder, label, stepMinutes, disabled } = props;
		const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
		const step = stepMinutes ? (Number(stepMinutes) as 15 | 30 | 60) : undefined;
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<TimePickerPrimitive
					value={value ?? undefined}
					onChange={setValue}
					placeholder={toSafeOptionalText(placeholder)}
					stepMinutes={step}
					disabled={nu(disabled)}
				/>
			</div>
		);
	},

	DateTimePicker: ({ props, bindings }) => {
		const { label, disabled } = props;
		const [date, setDate] = useBoundProp<string>(nu(props.date), bindings?.date);
		const [time, setTime] = useBoundProp<string>(nu(props.time), bindings?.time);
		const dateValue = date ? new Date(date) : undefined;
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<DateTimePickerPrimitive
					value={{ date: dateValue, time: time ?? undefined }}
					onChange={(val) => {
						setDate(val.date ? val.date.toISOString().split("T")[0] : "");
						setTime(val.time ?? "");
					}}
					disabled={nu(disabled)}
				/>
			</div>
		);
	},

	InlineEdit: ({ props, bindings }) => {
		const { label, placeholder } = props;
		const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
		return (
			<InlineEditPrimitive
				value={value ?? ""}
				onConfirm={setValue}
				label={toSafeOptionalText(label)}
				placeholder={toSafeOptionalText(placeholder)}
			/>
		);
	},

	InputOTP: ({ props, bindings }) => {
		const { length, label } = props;
		const [value, setValue] = useBoundProp<string>(nu(props.value), bindings?.value);
		const slotCount = length ?? 6;
		return (
			<div className="space-y-2">
				{label ? <Label>{toSafeText(label)}</Label> : null}
				<InputOTPRoot maxLength={slotCount} value={value ?? ""} onChange={(v) => setValue(v)}>
					<InputOTPGroup>
						{Array.from({ length: slotCount }, (_, i) => (
							<InputOTPSlot key={i} index={i} />
						))}
					</InputOTPGroup>
				</InputOTPRoot>
			</div>
		);
	},

	Calendar: ({ props, bindings }) => {
		const { label } = props;
		const [selected, setSelected] = useBoundProp<string>(nu(props.selected), bindings?.selected);
		const dateValue = selected ? new Date(selected) : undefined;
		return (
			<div className="space-y-2">
				{label ? <p className="text-sm font-medium text-text">{toSafeText(label)}</p> : null}
				<CalendarPrimitive
					mode="single"
					selected={dateValue}
					onSelect={(date) => setSelected(date ? date.toISOString().split("T")[0] : "")}
				/>
			</div>
		);
	},
} satisfies Partial<Components<typeof catalog>>;
