"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, local draft editing, object URL uploads, timers, and mounted GUI value registration.
// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component surface API.

import Image from "next/image";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ElementType,
	type ReactElement,
	type ReactNode,
} from "react";
import AddIcon from "@atlaskit/icon/core/add";
import CheckIcon from "@atlaskit/icon/core/check-mark";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CopyIcon from "@atlaskit/icon/core/copy";
import CrossIcon from "@atlaskit/icon/core/cross";
import ImageIcon from "@atlaskit/icon/core/image";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import UndoIcon from "@atlaskit/icon/core/undo";
import VideoIcon from "@atlaskit/icon/core/video";
import { useLazyRef } from "@/lib/use-lazy-ref";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	areGUIColorListsEqual,
	clampGUIValue,
	hexToRgbaUnit,
	hslaToRgbaUnit,
	isGUIHexColor,
	normalizeGUIColorValue,
	resolveGUIColorPickerValue,
	rgbaColorsEqual,
	rgbaUnitToCss,
	rgbaUnitToHex,
	rgbaUnitToHsla,
	rgbaUnitToRgb255,
	type GUIRGBAColor,
} from "@/components/utils/gui-color";
import { selectMountedGUIValues } from "@/components/utils/gui-values";
import { cn } from "@/lib/utils";

type GUIPanelContextValue = Readonly<{
	registerKeys: (keys: readonly string[]) => void;
	unregisterKeys: (keys: readonly string[]) => void;
}>;

const GUIPanelContext = createContext<GUIPanelContextValue | null>(null);

/** Register value keys so GUI.Panel only copies values for mounted controls. */
export function useGUIValueKeys(valueKeys?: string | readonly string[]) {
	const ctx = use(GUIPanelContext);
	const normalized = valueKeys == null ? [] : Array.isArray(valueKeys) ? valueKeys : [valueKeys];
	const serialized = normalized.join("\0");

	useEffect(() => {
		if (!ctx || normalized.length === 0) return;
		ctx.registerKeys(normalized);
		return () => ctx.unregisterKeys(normalized);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ctx, serialized]);
}

function formatValue(value: number, step: number, unit?: string): string {
	const digits = step < 1 ? String(step).split(".")[1]?.length ?? 0 : 0;
	const display = digits > 0 ? value.toFixed(digits) : String(Math.round(value));
	return unit ? `${display}${unit}` : display;
}

function GUIIcon({
	label,
	render,
}: Readonly<{
	label?: string;
	render: ReactElement;
}>) {
	return <Icon render={render} label={label} aria-hidden={label ? undefined : true} />;
}

type GUIResetButtonProps = Readonly<{
	ariaLabel: string;
	disabled: boolean;
	onClick: () => void;
	size?: "sm" | "md";
}>;

export function GUIResetButton({ ariaLabel, disabled, onClick, size = "md" }: GUIResetButtonProps) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"flex shrink-0 items-center justify-center rounded text-icon-subtle transition-colors hover:bg-bg-neutral hover:text-icon disabled:pointer-events-none disabled:opacity-0",
				size === "sm" ? "size-6" : "size-7",
			)}
		>
			<GUIIcon render={<UndoIcon label="" size="small" />} />
		</button>
	);
}

export type GUIControlProps = Readonly<{
	id: string;
	label: string;
	description?: string;
	value: number;
	defaultValue?: number;
	min: number;
	max: number;
	step: number;
	disabled?: boolean;
	unit?: string;
	onChange: (next: number) => void;
	valueKeys?: string | readonly string[];
}>;

export function GUIControl({
	id,
	label,
	description,
	value,
	defaultValue,
	min,
	max,
	step,
	disabled = false,
	unit,
	onChange,
	valueKeys,
}: GUIControlProps) {
	useGUIValueKeys(valueKeys);
	const [localInput, setLocalInput] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const displayValue = localInput ?? String(value);

	const commitRaw = (raw: string) => {
		setLocalInput(raw);
		const parsed = Number(raw);
		if (raw.length > 0 && Number.isFinite(parsed)) {
			onChange(parsed);
		}
	};

	const isDefault = defaultValue !== undefined && value === defaultValue;

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<Label
					htmlFor={`${id}-input`}
					className={cn(
						"text-xs font-medium text-text",
						disabled ? "text-text-disabled" : null,
					)}
				>
					{label}
				</Label>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					{defaultValue !== undefined ? (
						<GUIResetButton
							ariaLabel={`Reset ${label} to ${defaultValue}`}
							disabled={disabled || isDefault}
							onClick={() => {
								onChange(defaultValue);
								setLocalInput(null);
							}}
						/>
					) : null}
					<Input
						ref={inputRef}
						id={`${id}-input`}
						type="text"
						inputMode="decimal"
						isCompact
						disabled={disabled}
						value={displayValue}
						onChange={(event) => {
							commitRaw(event.currentTarget.value);
						}}
						onFocus={() => {
							setLocalInput(String(value));
						}}
						onBlur={() => {
							setLocalInput(null);
						}}
						onKeyDown={(event) => {
							if (event.key === "-") {
								event.preventDefault();
								const current = localInput ?? String(value);
								const toggled = current.startsWith("-")
									? current.slice(1)
									: `-${current}`;
								commitRaw(toggled);
								requestAnimationFrame(() => {
									inputRef.current?.setSelectionRange(
										toggled.length,
										toggled.length,
									);
								});
							}
						}}
						className="h-7 w-20 text-right font-mono text-xs tabular-nums"
					/>
					{unit ? (
						<span
							className={cn(
								"text-right text-[11px] text-text-subtle",
								disabled ? "text-text-disabled" : null,
							)}
						>
							{unit}
						</span>
					) : null}
				</div>
			</div>
			{description ? (
				<p
					className={cn(
						"text-[12px] leading-4 text-text-subtlest",
						disabled ? "text-text-disabled" : null,
					)}
				>
					{description}
				</p>
			) : null}
			<Slider
				aria-label={label}
				disabled={disabled}
				min={min}
				max={max}
				step={step}
				value={[clampGUIValue(value, min, max)]}
				onValueChange={(nextValue) => {
					const numericValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;
					if (typeof numericValue !== "number") return;
					onChange(clampGUIValue(numericValue, min, max));
				}}
			/>
			<div
				className={cn(
					"flex justify-between font-mono text-[11px] text-text-subtlest",
					disabled ? "text-text-disabled" : null,
				)}
			>
				<span>{formatValue(min, step, unit)}</span>
				<span>{formatValue(max, step, unit)}</span>
			</div>
		</div>
	);
}

export type GUIPercentControlProps = Omit<GUIControlProps, "value" | "defaultValue" | "min" | "max" | "step" | "unit" | "onChange"> & Readonly<{
	value: number;
	defaultValue?: number;
	min?: number;
	max?: number;
	step?: number;
	onChange: (next: number) => void;
}>;

export function GUIPercentControl({
	value,
	defaultValue,
	min = 0,
	max = 1,
	step = 0.01,
	onChange,
	...props
}: GUIPercentControlProps) {
	return (
		<GUIControl
			{...props}
			value={value * 100}
			defaultValue={defaultValue === undefined ? undefined : defaultValue * 100}
			min={min * 100}
			max={max * 100}
			step={step * 100}
			unit="%"
			onChange={(next) => onChange(next / 100)}
		/>
	);
}

export type GUIPanelProps = Readonly<{
	title: string;
	values: Record<string, unknown>;
	defaultOpen?: boolean;
	onPlay?: () => void;
	playLabel?: string;
	children: ReactNode;
}>;

export function GUIPanel({ title, values, defaultOpen = true, onPlay, playLabel = "Replay", children }: GUIPanelProps) {
	const [open, setOpen] = useState(defaultOpen);
	const [copied, setCopied] = useState(false);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const registeredKeysRef = useLazyRef<Map<string, number>>(() => new Map());
	const [mountedValueKeys, setMountedValueKeys] = useState<readonly string[]>([]);

	const syncMountedValueKeys = useCallback(() => {
		setMountedValueKeys(Array.from(registeredKeysRef.current.keys()));
	}, [registeredKeysRef]);

	const registerValueKeys = useCallback((keys: readonly string[]) => {
		let changed = false;
		for (const key of keys) {
			const currentCount = registeredKeysRef.current.get(key) ?? 0;
			registeredKeysRef.current.set(key, currentCount + 1);
			if (currentCount === 0) changed = true;
		}
		if (changed) syncMountedValueKeys();
	}, [registeredKeysRef, syncMountedValueKeys]);

	const unregisterValueKeys = useCallback((keys: readonly string[]) => {
		let changed = false;
		for (const key of keys) {
			const currentCount = registeredKeysRef.current.get(key) ?? 0;
			if (currentCount <= 1) {
				if (registeredKeysRef.current.delete(key)) changed = true;
			} else {
				registeredKeysRef.current.set(key, currentCount - 1);
			}
		}
		if (changed) syncMountedValueKeys();
	}, [registeredKeysRef, syncMountedValueKeys]);

	const panelContext = useMemo<GUIPanelContextValue>(() => ({
		registerKeys: registerValueKeys,
		unregisterKeys: unregisterValueKeys,
	}), [registerValueKeys, unregisterValueKeys]);

	const handleCopy = useCallback(() => {
		const text = JSON.stringify(selectMountedGUIValues(values, mountedValueKeys), null, "\t");
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTooltipOpen(true);
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
			copiedTimerRef.current = setTimeout(() => {
				setCopied(false);
				setTooltipOpen(false);
			}, 1500);
		});
	}, [mountedValueKeys, values]);

	useEffect(() => {
		return () => {
			if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
		};
	}, []);

	return (
		<GUIPanelContext value={panelContext}>
			<TooltipProvider>
				<div className="w-full space-y-4">
					<div className="flex w-full items-center justify-between">
						<span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtlest">
							{title}
						</span>
						<span className="flex items-center gap-2">
							{onPlay && open ? (
								<Tooltip>
									<TooltipTrigger
										render={
											<button
												type="button"
												aria-label={playLabel}
												onClick={onPlay}
												className="flex items-center rounded p-0.5 text-text-subtle transition-colors hover:bg-bg-neutral hover:text-text"
											>
												<GUIIcon render={<RefreshIcon label="" size="small" />} />
											</button>
										}
									/>
									<TooltipContent>{playLabel}</TooltipContent>
								</Tooltip>
							) : null}
							{open ? (
								<Tooltip open={tooltipOpen} onOpenChange={(nextOpen) => {
									if (!copied) setTooltipOpen(nextOpen);
								}}>
									<TooltipTrigger
										render={
											<button
												type="button"
												aria-label="Copy values as JSON"
												onClick={handleCopy}
												className={cn(
													"flex items-center rounded p-0.5 transition-colors",
													copied
														? "text-success"
														: "text-text-subtle hover:bg-bg-neutral hover:text-text",
												)}
											>
												{copied ? (
													<GUIIcon render={<CheckIcon label="" size="small" />} />
												) : (
													<GUIIcon render={<CopyIcon label="" size="small" />} />
												)}
											</button>
										}
									/>
									<TooltipContent>
										{copied ? "Copied!" : "Copy values"}
									</TooltipContent>
								</Tooltip>
							) : null}
							<button
								type="button"
								aria-label={open ? "Collapse controls" : "Expand controls"}
								aria-expanded={open}
								onClick={() => setOpen((prev) => !prev)}
								className="flex items-center"
							>
								<span
									className={cn(
										"text-icon-subtle transition-transform duration-normal",
										open ? "rotate-0" : "-rotate-90",
									)}
								>
									<GUIIcon render={<ChevronDownIcon label="" size="small" />} />
								</span>
							</button>
						</span>
					</div>
					{open ? (
						<div
							className="max-h-[min(48svh,32rem)] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain py-1 pr-2 pl-1"
							data-gui-panel-scroll="true"
						>
							{children}
						</div>
					) : null}
				</div>
			</TooltipProvider>
		</GUIPanelContext>
	);
}

export type GUIToggleProps = Readonly<{
	id: string;
	label: string;
	description?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (next: boolean) => void;
	valueKeys?: string | readonly string[];
}>;

export function GUIToggle({ id, label, description, checked, disabled = false, onChange, valueKeys }: GUIToggleProps) {
	useGUIValueKeys(valueKeys);
	const switchId = `${id}-toggle`;

	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between gap-2">
				<Label
					htmlFor={switchId}
					className={cn(
						"text-xs font-medium text-text",
						disabled ? "text-text-disabled" : null,
					)}
				>
					{label}
				</Label>
				<Switch
					id={switchId}
					checked={checked}
					disabled={disabled}
					onCheckedChange={onChange}
					label={label}
				/>
			</div>
			{description ? (
				<p
					className={cn(
						"text-[12px] leading-4 text-text-subtlest",
						disabled ? "text-text-disabled" : null,
					)}
				>
					{description}
				</p>
			) : null}
		</div>
	);
}

export type GUISelectOption<T extends string> = Readonly<{
	value: T;
	label: string;
	description?: string;
	meta?: string;
	swatch?: string;
}>;

const GUI_SELECT_SEGMENTED_MAX_OPTIONS = 4;

export type GUISelectProps<T extends string> = Readonly<{
	id: string;
	label: string;
	description?: string;
	value: T;
	defaultValue?: T;
	options: readonly GUISelectOption<T>[];
	onChange: (next: T) => void;
	stickyOptionValue?: T;
	valueKeys?: string | readonly string[];
}>;

function GUISelectOptionContent({
	option,
	showDetails = true,
}: Readonly<{
	option: GUISelectOption<string>;
	showDetails?: boolean;
}>) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			{option.swatch ? (
				<span
					aria-hidden="true"
					className="size-3 shrink-0 rounded-full border border-border"
					style={{ backgroundColor: option.swatch }}
				/>
			) : null}
			<span className={cn("min-w-0", showDetails ? "flex flex-col" : "truncate")}>
				<span className="truncate">{option.label}</span>
				{showDetails && option.description ? (
					<span className="truncate text-[11px] text-text-subtlest">
						{option.description}
					</span>
				) : null}
				{showDetails && option.meta ? (
					<span className="truncate font-mono text-[11px] text-text-subtlest">
						{option.meta}
					</span>
				) : null}
			</span>
		</span>
	);
}

export function GUISelect<T extends string>({
	id,
	label,
	description,
	value,
	defaultValue,
	options,
	onChange,
	stickyOptionValue,
	valueKeys,
}: GUISelectProps<T>) {
	useGUIValueKeys(valueKeys);
	const selectedOption = options.find((option) => option.value === value);
	const stickyOption = stickyOptionValue
		? options.find((option) => option.value === stickyOptionValue)
		: undefined;
	const listOptions = stickyOption
		? options.filter((option) => option.value !== stickyOption.value)
		: options;
	const useDropdown = options.length > GUI_SELECT_SEGMENTED_MAX_OPTIONS
		|| options.some((option) => option.description || option.meta || option.swatch);
	const defaultOption = defaultValue ? options.find((option) => option.value === defaultValue) : undefined;
	const isDefault = defaultValue !== undefined && value === defaultValue;

	return (
		<div className="space-y-1.5">
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center gap-2">
					<Label htmlFor={`${id}-select`} className="text-xs leading-4 font-medium text-text">
						{label}
					</Label>
					{defaultValue !== undefined ? (
						<div className="ml-auto">
							<GUIResetButton
								ariaLabel={`Reset ${label}`}
								disabled={isDefault}
								onClick={() => onChange(defaultValue)}
							/>
						</div>
					) : null}
				</div>
				{useDropdown ? (
					<Select
						value={value}
						onValueChange={(nextValue) => onChange(nextValue as T)}
					>
						<SelectTrigger
							id={`${id}-select`}
							size="sm"
							className="w-fit min-w-40 max-w-full"
						>
							<SelectValue>
								{selectedOption ? (
									<GUISelectOptionContent option={selectedOption} showDetails={false} />
								) : (
									"Select option"
								)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent showScrollButtons={false} align="start" className="min-w-64">
							{stickyOption ? (
								<div className="sticky top-0 z-10 bg-popover">
									<SelectItem value={stickyOption.value}>
										<GUISelectOptionContent option={stickyOption} />
									</SelectItem>
									<SelectSeparator />
								</div>
							) : null}
							<SelectGroup>
								{listOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<GUISelectOptionContent option={option} />
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				) : (
					<div className="inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-md bg-bg-neutral p-0.5">
						{options.map((option) => (
							<button
								key={option.value}
								type="button"
								aria-pressed={value === option.value}
								onClick={() => {
									onChange(option.value);
								}}
								className={cn(
									"whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
									value === option.value
										? "bg-surface text-text shadow-sm"
										: "text-text-subtle hover:text-text",
								)}
							>
								{option.label}
							</button>
						))}
					</div>
				)}
			</div>
			<div className="space-y-1">
				{description ? (
					<p className="text-[12px] leading-4 text-text-subtlest">
						{description}
					</p>
				) : null}
				{selectedOption?.meta ? (
					<p className="font-mono text-[11px] leading-4 text-text-subtlest">
						{selectedOption.meta}
						{defaultOption && defaultOption.value !== selectedOption.value ? ` · default ${defaultOption.label}` : ""}
					</p>
				) : null}
			</div>
		</div>
	);
}

export type GUITextInputProps = Readonly<{
	id: string;
	label: string;
	description?: string;
	placeholder?: string;
	value: string;
	onChange: (next: string) => void;
	valueKeys?: string | readonly string[];
}>;

export function GUITextInput({ id, label, description, placeholder, value, onChange, valueKeys }: GUITextInputProps) {
	useGUIValueKeys(valueKeys);
	const inputId = `${id}-text`;

	return (
		<div className="space-y-1.5">
			<Label htmlFor={inputId} className="text-xs font-medium text-text">
				{label}
			</Label>
			<Input
				id={inputId}
				type="text"
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.currentTarget.value)}
				className="h-8 text-xs"
			/>
			{description ? (
				<p className="text-[12px] leading-4 text-text-subtlest">
					{description}
				</p>
			) : null}
		</div>
	);
}

export type GUIColorInputProps = Readonly<{
	id: string;
	label: string;
	description?: string;
	value: string;
	defaultValue?: string;
	disabled?: boolean;
	format?: "hex" | "css";
	onChange: (next: string) => void;
	valueKeys?: string | readonly string[];
}>;

export function GUIColorInput({
	id,
	label,
	description,
	value,
	defaultValue,
	disabled = false,
	format = "hex",
	onChange,
	valueKeys,
}: GUIColorInputProps) {
	useGUIValueKeys(valueKeys);
	const [textDraft, setTextDraft] = useState<string | null>(null);
	const displayValue = textDraft ?? value;
	const isDefault = defaultValue == null
		? true
		: normalizeGUIColorValue(displayValue) === normalizeGUIColorValue(defaultValue);

	function commitPickerValue(nextColor: string) {
		setTextDraft(null);
		onChange(nextColor);
	}

	function commitTextValue(nextValue: string) {
		setTextDraft(nextValue);
		if (format === "css" || isGUIHexColor(nextValue)) {
			onChange(nextValue);
		}
	}

	return (
		<div className={cn("space-y-2", disabled && "pointer-events-none opacity-40")}>
			<div className="flex items-center gap-2">
				<Label htmlFor={`${id}-text`} className="text-xs font-medium text-text">
					{label}
				</Label>
				{defaultValue ? (
					<div className="ml-auto">
						<GUIResetButton
							ariaLabel={`Reset ${label}`}
							disabled={isDefault || disabled}
							onClick={() => {
								setTextDraft(null);
								onChange(defaultValue);
							}}
						/>
					</div>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				<input
					id={`${id}-picker`}
					type="color"
					aria-label={`${label} color`}
					value={resolveGUIColorPickerValue(value, defaultValue)}
					onInput={(event) => commitPickerValue(event.currentTarget.value)}
					onChange={(event) => commitPickerValue(event.currentTarget.value)}
					disabled={disabled}
					className="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
				/>
				<Input
					id={`${id}-text`}
					type="text"
					value={displayValue}
					onChange={(event) => commitTextValue(event.currentTarget.value)}
					onFocus={() => {
						setTextDraft(value);
					}}
					onBlur={() => {
						setTextDraft(null);
					}}
					disabled={disabled}
					isCompact
					isMonospaced
					className="h-7 flex-1 text-xs"
				/>
			</div>
			{description ? (
				<p className="text-[12px] leading-4 text-text-subtlest">
					{description}
				</p>
			) : null}
		</div>
	);
}

export type GUIColorListProps = Readonly<{
	id: string;
	label: string;
	description?: string;
	value: readonly string[];
	defaultValue?: readonly string[];
	onChange: (next: string[]) => void;
	allowAddRemove?: boolean;
	addColor?: string;
	maxColors?: number;
	disabled?: boolean;
	valueKeys?: string | readonly string[];
}>;

export function GUIColorList({
	id,
	label,
	description,
	value,
	defaultValue,
	onChange,
	allowAddRemove = false,
	addColor = "#808080",
	maxColors,
	disabled = false,
	valueKeys,
}: GUIColorListProps) {
	useGUIValueKeys(valueKeys);
	const isDefault = defaultValue == null ? true : areGUIColorListsEqual(value, defaultValue);
	const canAdd = !disabled && allowAddRemove && (maxColors == null || value.length < maxColors);
	const canRemove = !disabled && allowAddRemove && value.length > 1;

	return (
		<div className={cn("space-y-2", disabled && "opacity-40")}>
			<div className="flex items-center gap-2">
				<Label className="text-xs font-medium text-text">{label}</Label>
				{defaultValue ? (
					<div className="ml-auto">
						<GUIResetButton
							ariaLabel={`Reset ${label}`}
							disabled={isDefault || disabled}
							onClick={() => onChange([...defaultValue])}
						/>
					</div>
				) : null}
			</div>
			<div className="flex flex-col gap-1.5">
				{value.map((color, index) => (
					<div key={`${id}-${index}`} className="flex items-center gap-2">
						<input
							type="color"
							aria-label={`${label} color ${index + 1}`}
							value={resolveGUIColorPickerValue(color, defaultValue?.[index])}
							onChange={(event) => {
								const next = [...value];
								next[index] = event.currentTarget.value;
								onChange(next);
							}}
							disabled={disabled}
							className="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0 disabled:cursor-not-allowed"
						/>
						<Input
							type="text"
							aria-label={`${label} value ${index + 1}`}
							value={color}
							onChange={(event) => {
								const next = [...value];
								next[index] = event.currentTarget.value;
								onChange(next);
							}}
							disabled={disabled}
							isCompact
							isMonospaced
							className="h-7 flex-1 text-xs"
						/>
						{canRemove ? (
							<button
								type="button"
								aria-label={`Remove ${label} ${index + 1}`}
								onClick={() => onChange(value.filter((_, valueIndex) => valueIndex !== index))}
								className="flex size-7 shrink-0 items-center justify-center rounded text-icon-subtle transition-colors hover:bg-bg-neutral hover:text-icon"
							>
								<GUIIcon render={<CrossIcon label="" size="small" />} />
							</button>
						) : null}
					</div>
				))}
				{canAdd ? (
					<button
						type="button"
						onClick={() => onChange([...value, addColor])}
						className="flex h-7 items-center gap-1.5 rounded px-1 text-xs text-text-subtle transition-colors hover:bg-bg-neutral hover:text-text"
					>
						<GUIIcon render={<AddIcon label="" size="small" />} />
						<span>Add color</span>
					</button>
				) : null}
			</div>
			{description ? (
				<p className="text-[12px] leading-4 text-text-subtlest">
					{description}
				</p>
			) : null}
		</div>
	);
}

function createCheckerboardStyle(color: GUIRGBAColor): CSSProperties {
	const cssColor = rgbaUnitToCss(color);

	return {
		backgroundColor: "var(--color-surface)",
		backgroundImage: `linear-gradient(${cssColor}, ${cssColor}), conic-gradient(from 45deg, rgba(9, 30, 66, 0.12) 0 25%, transparent 0 50%, rgba(9, 30, 66, 0.12) 0 75%, transparent 0 100%)`,
		backgroundSize: "100% 100%, 12px 12px",
	};
}

function cloneColor(color: GUIRGBAColor): GUIRGBAColor {
	return [color[0], color[1], color[2], color[3]];
}

type GUIColorFieldProps = Readonly<{
	id: string;
	label: string;
	max: number;
	min?: number;
	unit?: string;
	value: number;
	onChange: (next: number) => void;
}>;

function GUIColorField({
	id,
	label,
	max,
	min = 0,
	unit,
	value,
	onChange,
}: GUIColorFieldProps) {
	const [draft, setDraft] = useState<string | null>(null);
	const displayValue = draft ?? String(value);
	const hasUnit = Boolean(unit);

	return (
		<div className="space-y-1">
			<Label htmlFor={id} className="text-[11px] font-medium text-text-subtle">
				{label}
			</Label>
			<div className="relative">
				<Input
					id={id}
					type="text"
					inputMode="decimal"
					value={displayValue}
					onChange={(event) => {
						const rawValue = event.currentTarget.value;
						setDraft(rawValue);
						const parsed = Number(rawValue);
						if (!Number.isFinite(parsed)) {
							return;
						}

						onChange(clampGUIValue(parsed, min, max));
					}}
					onBlur={() => {
						setDraft(null);
					}}
					isMonospaced
					className={hasUnit ? "h-8 pr-7 pl-2 text-right text-xs" : "h-8 px-2 text-right text-xs"}
				/>
				{unit ? (
					<span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-text-subtlest">
						{unit}
					</span>
				) : null}
			</div>
		</div>
	);
}

export type GUIRgbaColorInputProps = Readonly<{
	id: string;
	label: string;
	value: GUIRGBAColor;
	defaultValue?: GUIRGBAColor;
	onChange: (next: GUIRGBAColor) => void;
	valueKeys?: string | readonly string[];
}>;

export function GUIRgbaColorInput({
	id,
	label,
	value,
	defaultValue,
	onChange,
	valueKeys,
}: GUIRgbaColorInputProps) {
	useGUIValueKeys(valueKeys);
	const [format, setFormat] = useState<"hex" | "rgb" | "hsl">("hex");
	const [open, setOpen] = useState(false);
	const [hexDraft, setHexDraft] = useState(rgbaUnitToHex(value));

	const rgb = useMemo(() => rgbaUnitToRgb255(value), [value]);
	const hsl = useMemo(() => rgbaUnitToHsla(value), [value]);
	const alphaPercent = Math.round(value[3] * 100);
	const swatchStyle = useMemo(() => createCheckerboardStyle(value), [value]);
	const isDefault = defaultValue ? rgbaColorsEqual(value, defaultValue) : true;

	useEffect(() => {
		setHexDraft(rgbaUnitToHex(value));
	}, [value]);

	const updateRgb = (index: 0 | 1 | 2, nextValue: number) => {
		const nextColor = cloneColor(value);
		nextColor[index] = clampGUIValue(nextValue, 0, 255) / 255;
		onChange(nextColor);
	};

	const updateAlphaPercent = (nextValue: number) => {
		const nextColor = cloneColor(value);
		nextColor[3] = clampGUIValue(nextValue, 0, 100) / 100;
		onChange(nextColor);
	};

	const updateHsl = (index: 0 | 1 | 2, nextValue: number) => {
		const nextHsl = [...hsl] as typeof hsl;
		nextHsl[index] = nextValue;
		onChange(hslaToRgbaUnit(nextHsl[0], nextHsl[1], nextHsl[2], value[3]));
	};

	return (
		<div className="flex items-center justify-between gap-3">
			<Label htmlFor={`${id}-trigger`} className="text-xs font-medium text-text">
				{label}
			</Label>
			<div className="flex items-center gap-1.5">
				{defaultValue ? (
					<GUIResetButton
						ariaLabel={`Reset ${label}`}
						disabled={isDefault}
						size="sm"
						onClick={() => onChange(cloneColor(defaultValue))}
					/>
				) : null}
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						render={
							<button
								id={`${id}-trigger`}
								type="button"
								aria-label={`Edit ${label}`}
								className="relative size-7 overflow-hidden rounded-md border border-border bg-surface transition-transform outline-none hover:scale-[1.02] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						}
					>
						<span className="absolute inset-0" style={swatchStyle} />
					</PopoverTrigger>
					<PopoverContent align="end" className="w-[320px] gap-3 p-3">
						<div className="flex items-start gap-3">
							<div className="relative size-12 overflow-hidden rounded-md border border-border bg-surface">
								<div className="absolute inset-0" style={swatchStyle} />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-xs font-medium text-text">{label}</p>
								<p className="font-mono text-[11px] text-text-subtle">
									{rgbaUnitToHex(value)}
								</p>
								<p className="text-[11px] text-text-subtlest">
									Alpha {alphaPercent}%
								</p>
							</div>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor={`${id}-alpha`} className="text-xs font-medium text-text">
									Alpha
								</Label>
								<span className="font-mono text-[11px] text-text-subtle">
									{alphaPercent}%
								</span>
							</div>
							<Slider
								aria-label={`${label} alpha`}
								max={100}
								min={0}
								step={1}
								value={[alphaPercent]}
								onValueChange={(nextValue) => {
									const numericValue = Array.isArray(nextValue)
										? nextValue[0]
										: nextValue;
									if (typeof numericValue !== "number") {
										return;
									}

									updateAlphaPercent(numericValue);
								}}
							/>
						</div>

						<Tabs
							value={format}
							onValueChange={(nextValue) => {
								setFormat(nextValue as typeof format);
							}}
							className="gap-3"
						>
							<TabsList className="w-full">
								<TabsTrigger value="hex">HEX</TabsTrigger>
								<TabsTrigger value="rgb">RGB</TabsTrigger>
								<TabsTrigger value="hsl">HSL</TabsTrigger>
							</TabsList>

							<TabsContent value="hex" className="space-y-1.5">
								<Label htmlFor={`${id}-hex`} className="text-xs font-medium text-text">
									Hex With Alpha
								</Label>
								<Input
									id={`${id}-hex`}
									type="text"
									autoCapitalize="characters"
									autoCorrect="off"
									spellCheck={false}
									value={hexDraft}
									onChange={(event) => {
										const nextDraft = event.currentTarget.value.toUpperCase();
										setHexDraft(nextDraft);

										const parsed = hexToRgbaUnit(nextDraft, value[3]);
										if (parsed) {
											onChange(parsed);
										}
									}}
									onBlur={() => {
										setHexDraft(rgbaUnitToHex(value));
									}}
									className="h-8 font-mono text-xs"
								/>
								<p className="text-[11px] leading-4 text-text-subtlest">
									Accepts `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`.
								</p>
							</TabsContent>

							<TabsContent value="rgb" className="grid grid-cols-4 gap-2">
								<GUIColorField
									id={`${id}-rgb-r`}
									label="R"
									max={255}
									value={rgb[0]}
									onChange={(nextValue) => updateRgb(0, nextValue)}
								/>
								<GUIColorField
									id={`${id}-rgb-g`}
									label="G"
									max={255}
									value={rgb[1]}
									onChange={(nextValue) => updateRgb(1, nextValue)}
								/>
								<GUIColorField
									id={`${id}-rgb-b`}
									label="B"
									max={255}
									value={rgb[2]}
									onChange={(nextValue) => updateRgb(2, nextValue)}
								/>
								<GUIColorField
									id={`${id}-rgb-a`}
									label="A"
									max={100}
									unit="%"
									value={alphaPercent}
									onChange={updateAlphaPercent}
								/>
							</TabsContent>

							<TabsContent value="hsl" className="grid grid-cols-4 gap-2">
								<GUIColorField
									id={`${id}-hsl-h`}
									label="H"
									max={360}
									value={Math.round(hsl[0])}
									onChange={(nextValue) => updateHsl(0, nextValue)}
								/>
								<GUIColorField
									id={`${id}-hsl-s`}
									label="S"
									max={100}
									unit="%"
									value={Math.round(hsl[1])}
									onChange={(nextValue) => updateHsl(1, nextValue)}
								/>
								<GUIColorField
									id={`${id}-hsl-l`}
									label="L"
									max={100}
									unit="%"
									value={Math.round(hsl[2])}
									onChange={(nextValue) => updateHsl(2, nextValue)}
								/>
								<GUIColorField
									id={`${id}-hsl-a`}
									label="A"
									max={100}
									unit="%"
									value={alphaPercent}
									onChange={updateAlphaPercent}
								/>
							</TabsContent>
						</Tabs>
					</PopoverContent>
				</Popover>
				<span className="w-24 font-mono text-[11px] text-text-subtle">
					{rgbaUnitToHex(value)}
				</span>
			</div>
		</div>
	);
}

export type GUIImageInputProps = Readonly<{
	id: string;
	label: string;
	value?: string;
	description?: string;
	previewAlt?: string;
	placeholder?: string;
	accept?: string;
	previewType?: "image" | "video";
	objectFit?: "contain" | "cover";
	previewClassName?: string;
	uploadLabel?: string;
	changeLabel?: string;
	clearLabel?: string;
	showClear?: boolean;
	onChange?: (next: string | undefined) => void;
	onFile?: (file: File) => void | Promise<void>;
	onClear?: () => void;
	valueKeys?: string | readonly string[];
}>;

export function GUIImageInput({
	id,
	label,
	value,
	description,
	previewAlt = "Uploaded image",
	placeholder,
	accept = "image/*",
	previewType = "image",
	objectFit = "cover",
	previewClassName,
	uploadLabel = "Upload",
	changeLabel = "Change",
	clearLabel = "Clear",
	showClear = true,
	onChange,
	onFile,
	onClear,
	valueKeys,
}: GUIImageInputProps) {
	useGUIValueKeys(valueKeys);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(
		(file: File) => {
			if (onFile) {
				void onFile(file);
				return;
			}

			onChange?.(URL.createObjectURL(file));
		},
		[onChange, onFile],
	);

	const handleClear = useCallback(() => {
		if (onClear) {
			onClear();
			return;
		}

		onChange?.(undefined);
	}, [onChange, onClear]);

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<Label htmlFor={`${id}-file`} className="text-xs font-medium text-text">
					{label}
				</Label>
				{description ? (
					<span className="text-[11px] text-text-subtlest">
						{description}
					</span>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				{value && previewType === "video" ? (
					<div
						aria-hidden
						className={cn(
							"flex size-9 shrink-0 items-center justify-center rounded border border-border bg-bg-neutral text-icon-subtle",
							previewClassName,
						)}
					>
						<GUIIcon render={<VideoIcon label="" size="small" />} />
					</div>
				) : value ? (
					<Image
						src={value}
						alt={previewAlt}
						width={36}
						height={36}
						unoptimized
						className={cn(
							"size-9 shrink-0 rounded border border-border bg-bg-neutral p-0",
							objectFit === "contain" ? "object-contain" : "object-cover",
							previewClassName,
						)}
					/>
				) : (
					<div className="flex size-9 shrink-0 items-center justify-center rounded border border-border bg-bg-neutral text-icon-subtle">
						<GUIIcon render={<ImageIcon label="" size="small" />} />
					</div>
				)}
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="h-7 rounded border border-border bg-transparent px-3 text-xs text-text transition-colors hover:bg-bg-neutral"
				>
					{value ? changeLabel : uploadLabel}
				</button>
				{value && showClear ? (
					<button
						type="button"
						aria-label={clearLabel}
						onClick={handleClear}
						className="flex size-7 shrink-0 items-center justify-center rounded text-icon-subtle transition-colors hover:bg-bg-neutral hover:text-icon"
					>
						<GUIIcon render={<CrossIcon label="" size="small" />} />
					</button>
				) : null}
				{placeholder && !value ? (
					<span className="text-[11px] text-text-subtlest">{placeholder}</span>
				) : null}
				<input
					ref={inputRef}
					id={`${id}-file`}
					type="file"
					accept={accept}
					className="hidden"
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						if (file) {
							handleFile(file);
						}
						event.currentTarget.value = "";
					}}
				/>
			</div>
		</div>
	);
}

export type GUISwatchOption<T extends string = string> = Readonly<{
	value: T;
	label: string;
	color?: string;
}>;

export type GUISwatchGroupProps<T extends string = string> = Readonly<{
	id: string;
	label: string;
	description?: string;
	value: readonly T[];
	options: readonly GUISwatchOption<T>[];
	onChange: (next: T[]) => void;
	minSelected?: number;
	shape?: "circle" | "square";
	valueKeys?: string | readonly string[];
}>;

export function GUISwatchGroup<T extends string>({
	id,
	label,
	description,
	value,
	options,
	onChange,
	minSelected = 0,
	shape = "circle",
	valueKeys,
}: GUISwatchGroupProps<T>) {
	useGUIValueKeys(valueKeys);
	const selectedValues = new Set(value);

	function toggle(nextValue: T) {
		const isSelected = selectedValues.has(nextValue);
		if (isSelected && selectedValues.size <= minSelected) return;
		onChange(
			options
				.filter((option) =>
					option.value === nextValue ? !isSelected : selectedValues.has(option.value),
				)
				.map((option) => option.value),
		);
	}

	return (
		<div className="space-y-2">
			<Label className="text-xs font-medium text-text">{label}</Label>
			<div id={id} className="flex flex-wrap items-center gap-2">
				{options.map((option) => {
					const selected = selectedValues.has(option.value);
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={selected}
							aria-label={`${option.label}${selected ? " (selected)" : ""}`}
							title={option.label}
							onClick={() => toggle(option.value)}
							style={{ background: option.color ?? option.value }}
							className={cn(
								"size-8 border-2 transition-all",
								shape === "circle" ? "rounded-full" : "rounded",
								selected
									? "border-text"
									: "border-transparent opacity-40 hover:opacity-100",
							)}
						/>
					);
				})}
			</div>
			{description ? (
				<p className="text-[12px] leading-4 text-text-subtlest">
					{description}
				</p>
			) : null}
		</div>
	);
}

export type GUISegmentedOption<T extends string | boolean = string> = Readonly<{
	value: T;
	label: string;
	icon?: ElementType<{ label: string; size?: "small" | "medium" }>;
}>;

export type GUISegmentedControlProps<T extends string | boolean = string> = Readonly<{
	id: string;
	label: string;
	description?: string;
	value: T;
	options: readonly GUISegmentedOption<T>[];
	onChange: (next: T) => void;
	valueKeys?: string | readonly string[];
}>;

export function GUISegmentedControl<T extends string | boolean>({
	id,
	label,
	description,
	value,
	options,
	onChange,
	valueKeys,
}: GUISegmentedControlProps<T>) {
	useGUIValueKeys(valueKeys);

	return (
		<div className="space-y-1.5">
			<Label className="text-xs font-medium text-text">{label}</Label>
			<div
				id={id}
				role="group"
				aria-label={label}
				className="inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-md bg-bg-neutral p-0.5"
			>
				{options.map((option) => {
					const selected = value === option.value;
					const OptionIcon = option.icon;
					return (
						<button
							key={String(option.value)}
							type="button"
							aria-pressed={selected}
							onClick={() => onChange(option.value)}
							className={cn(
								"flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
								selected
									? "bg-surface text-text shadow-sm"
									: "text-text-subtle hover:text-text",
							)}
						>
							{OptionIcon ? (
								<GUIIcon render={<OptionIcon label="" size="small" />} />
							) : null}
							{option.label}
						</button>
					);
				})}
			</div>
			{description ? (
				<p className="text-[12px] leading-4 text-text-subtlest">
					{description}
				</p>
			) : null}
		</div>
	);
}

export type GUISectionProps = Readonly<{
	title: string;
	defaultOpen?: boolean;
	borderTop?: boolean;
	children: ReactNode;
}>;

export function GUISection({ title, defaultOpen = true, borderTop = true, children }: GUISectionProps) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div>
			{borderTop ? <div className="border-t border-border pt-4" /> : null}
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((prev) => !prev)}
				className="flex w-full items-center justify-between pb-1"
			>
				<span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtlest">
					{title}
				</span>
				<span
					className={cn(
						"text-icon-subtle transition-transform duration-normal",
						open ? "rotate-0" : "-rotate-90",
					)}
				>
					<GUIIcon render={<ChevronDownIcon label="" size="small" />} />
				</span>
			</button>
			{open ? (
				<div className="space-y-4 pt-1">
					{children}
				</div>
			) : null}
		</div>
	);
}
