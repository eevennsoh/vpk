"use client";

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
	type RefObject,
} from "react";

import { useControllableState } from "@/hooks/use-controllable-state";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
	CommandPrimitiveInput,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSearchField,
	DropdownMenuTrigger,
	dropdownStyles,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, SearchIcon } from "@/components/ui/vpk-icons";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { cn } from "@/lib/utils";

import { useAudioDevices } from "@/components/ui-custom/hooks/use-audio-devices";

export { useAudioDevices } from "@/components/ui-custom/hooks/use-audio-devices";

// The menu shell is a Dropdown Menu; inside it, search, filtering and arrow-key
// highlighting belong to cmdk, as in the model selector.

const deviceIdRegex = /\(([\da-fA-F]{4}:[\da-fA-F]{4})\)$/;

interface MicSelectorContextType {
	data: MediaDeviceInfo[];
	value: string | undefined;
	onValueChange?: (value: string) => void;
	close: () => void;
}

const MicSelectorContext = createContext<MicSelectorContextType>({
	close: () => {},
	data: [],
	onValueChange: undefined,
	value: undefined,
});

type DropdownMenuProps = ComponentProps<typeof DropdownMenu>;

type MicSelectorActions =
	NonNullable<DropdownMenuProps["actionsRef"]> extends RefObject<infer Actions> ? Actions : never;

export interface MicSelectorProps extends Omit<DropdownMenuProps, "open" | "onOpenChange"> {
	defaultValue?: string;
	value?: string | undefined;
	onValueChange?: (value: string | undefined) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function MicSelector({
	actionsRef,
	defaultValue,
	value: controlledValue,
	onValueChange: controlledOnValueChange,
	defaultOpen = false,
	modal = false,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	...props
}: Readonly<MicSelectorProps>) {
	const [value, onValueChange] = useControllableState<string | undefined>({
		defaultProp: defaultValue,
		onChange: controlledOnValueChange,
		prop: controlledValue,
	});
	const [open, setOpen] = useControllableState({
		defaultProp: defaultOpen,
		onChange: controlledOnOpenChange,
		prop: controlledOpen,
	});
	const fallbackActionsRef = useRef<MicSelectorActions>(null);
	const resolvedActionsRef = actionsRef ?? fallbackActionsRef;
	const close = useCallback(() => {
		resolvedActionsRef.current?.close();
	}, [resolvedActionsRef]);
	const { devices, loading, hasPermission, loadDevices } = useAudioDevices();

	useEffect(() => {
		if (open && !hasPermission && !loading) {
			loadDevices();
		}
	}, [open, hasPermission, loading, loadDevices]);

	const contextValue = useMemo(
		() => ({ close, data: devices, onValueChange, value }),
		[close, devices, onValueChange, value],
	);

	return (
		<MicSelectorContext value={contextValue}>
			<DropdownMenu
				actionsRef={resolvedActionsRef}
				modal={modal}
				onOpenChange={(nextOpen) => setOpen(nextOpen)}
				open={open}
				{...props}
			/>
		</MicSelectorContext>
	);
}

export type MicSelectorTriggerProps = ComponentProps<typeof Button>;

/** Outline button with the dropdown menu's chevron down. */
export function MicSelectorTrigger({
	children,
	className,
	...props
}: Readonly<MicSelectorTriggerProps>) {
	return (
		<DropdownMenuTrigger
			render={<Button className={cn("justify-between", className)} variant="outline" {...props} />}
		>
			{children}
			<ChevronDownIcon className="text-icon-subtle" data-icon="inline-end" label="" size="small" />
		</DropdownMenuTrigger>
	);
}

export type MicSelectorContentProps = ComponentProps<typeof DropdownMenuContent> & {
	title?: string;
};

/** Menu as wide as its trigger (at least the menu's 224px minimum). */
export function MicSelectorContent({
	className,
	children,
	title = "Microphones",
	...props
}: Readonly<MicSelectorContentProps>) {
	return (
		<DropdownMenuContent
			aria-label={title}
			className={cn("flex w-(--anchor-width) flex-col overflow-hidden p-0", className)}
			{...props}
		>
			<Command
				className={cn("min-h-0 flex-1 rounded-lg bg-transparent", dropdownStyles.padding)}
				label={title}
			>
				{children}
			</Command>
		</DropdownMenuContent>
	);
}

export interface MicSelectorInputProps {
	placeholder?: string;
	/** Controlled query; omit to let the input own it. */
	value?: string;
	onValueChange?: (value: string) => void;
}

/** The shared menu search field, flush with the menu's top edge. */
export function MicSelectorInput({
	placeholder = "Search microphones",
	value,
	onValueChange,
}: Readonly<MicSelectorInputProps>) {
	const [internalValue, setInternalValue] = useState("");
	const query = value ?? internalValue;
	const setQuery = (next: string) => {
		setInternalValue(next);
		onValueChange?.(next);
	};

	return (
		<div className="-mx-(--menu-inset) -mt-(--menu-inset) mb-0.5 shrink-0 overflow-hidden rounded-t-lg">
			<DropdownMenuSearchField
				autoFocus
				hostOwnsKeyNavigation
				icon={<SearchIcon className="size-4 text-icon-subtle" />}
				label={placeholder}
				onClear={() => setQuery("")}
				onValueChange={setQuery}
				placeholder={placeholder}
				renderInput={(input) => <CommandPrimitiveInput asChild value={query}>{input}</CommandPrimitiveInput>}
				value={query}
			/>
		</div>
	);
}

export interface MicSelectorListProps
	extends Omit<ComponentProps<typeof CommandList>, "children"> {
	children: (devices: MediaDeviceInfo[]) => ReactNode;
}

/** Scrollable device list; fades its top edge once it scrolls. */
export function MicSelectorList({
	children,
	className,
	style,
	...props
}: Readonly<MicSelectorListProps>) {
	const { data } = use(MicSelectorContext);
	const { ref: listRef, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const maskStyle = {
		...buildScrollMaskStyle({ fadeBottom: false, fadeSize: "3rem", fadeTop: showTopScrollMask }),
		"--scroll-mask-top-fade-size": "3rem",
	};

	return (
		<CommandList
			className={cn("max-h-72 min-h-0 flex-1 overscroll-contain p-0", className)}
			label="Microphones"
			ref={listRef}
			showScrollbar
			style={{ ...maskStyle, ...style }}
			{...props}
		>
			{children(data)}
		</CommandList>
	);
}

export type MicSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export function MicSelectorEmpty({
	children = "No microphone found.",
	className,
	...props
}: Readonly<MicSelectorEmptyProps>) {
	return (
		<CommandEmpty className={cn("py-4 text-text-subtle", className)} {...props}>
			{children}
		</CommandEmpty>
	);
}

export type MicSelectorItemProps = Omit<ComponentProps<typeof CommandItem>, "onSelect" | "value"> & {
	/** The device id this item selects. */
	value: string;
	onSelect?: (value: string) => void;
};

export function MicSelectorItem({
	className,
	keywords,
	onSelect,
	value,
	...props
}: Readonly<MicSelectorItemProps>) {
	const { close, data, onValueChange, value: selectedValue } = use(MicSelectorContext);
	const isChecked = selectedValue === value;
	// The value is an opaque device id, so search matches the device label.
	const label = data.find((device) => device.deviceId === value)?.label;

	return (
		<CommandItem
			aria-checked={isChecked}
			className={cn(
				"h-8 pr-3 data-selected:bg-bg-neutral-subtle-hovered! data-selected:text-text! data-selected:active:bg-bg-neutral-subtle-pressed! data-[checked=true]:text-text data-[checked=true]:*:[svg]:text-text-selected data-[checked=true]:[&_[data-slot=icon]]:text-text-selected",
				className
			)}
			data-checked={isChecked ? true : undefined}
			keywords={label ? [label, ...(keywords ?? [])] : keywords}
			onSelect={() => {
				onValueChange?.(value);
				onSelect?.(value);
				close();
			}}
			value={value}
			{...props}
		/>
	);
}

export interface MicSelectorLabelProps extends ComponentProps<"span"> {
	device: MediaDeviceInfo;
}

export function MicSelectorLabel({
	device,
	className,
	...props
}: Readonly<MicSelectorLabelProps>) {
	const matches = device.label.match(deviceIdRegex);

	if (!matches) {
		return (
			<span className={cn("truncate", className)} {...props}>
				{device.label}
			</span>
		);
	}

	const [, deviceId] = matches;
	const name = device.label.replace(deviceIdRegex, "");

	return (
		<span className={cn("truncate", className)} {...props}>
			<span>{name}</span>
			<span className="text-text-subtle"> ({deviceId})</span>
		</span>
	);
}

export type MicSelectorValueProps = ComponentProps<"span">;

export function MicSelectorValue({
	className,
	...props
}: Readonly<MicSelectorValueProps>) {
	const { data, value } = use(MicSelectorContext);
	const currentDevice = data.find((d) => d.deviceId === value);

	if (!currentDevice) {
		return (
			<span className={cn("flex-1 truncate text-left", className)} {...props}>
				Select microphone
			</span>
		);
	}

	return (
		<MicSelectorLabel
			className={cn("flex-1 text-left", className)}
			device={currentDevice}
			{...props}
		/>
	);
}
