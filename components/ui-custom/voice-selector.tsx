"use client";

import type { ComponentProps, ReactNode } from "react";

import { useControllableState } from "@/hooks/use-controllable-state";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
	CircleIcon,
	PauseIcon,
	PersonIcon,
	PlayIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import { createContext, use, useCallback, useMemo } from "react";

interface VoiceSelectorContextValue {
	value: string | undefined;
	setValue: (value: string | undefined) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
}

const VoiceSelectorContext = createContext<VoiceSelectorContextValue | null>(
	null
);

export function useVoiceSelector() {
	const context = use(VoiceSelectorContext);
	if (!context) {
		throw new Error(
			"VoiceSelector components must be used within VoiceSelector"
		);
	}
	return context;
}

export type VoiceSelectorProps = Omit<
	ComponentProps<typeof Dialog>,
	"onOpenChange" | "open" | "defaultOpen"
> & {
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string | undefined) => void;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function VoiceSelector({
	value: valueProp,
	defaultValue,
	onValueChange,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	children,
	...props
}: Readonly<VoiceSelectorProps>) {
	const [value, setValue] = useControllableState({
		defaultProp: defaultValue,
		onChange: onValueChange,
		prop: valueProp,
	});

	const [open, setOpen] = useControllableState({
		defaultProp: defaultOpen,
		onChange: onOpenChange,
		prop: openProp,
	});

	const voiceSelectorContext = useMemo(
		() => ({ open, setOpen, setValue, value }),
		[value, setValue, open, setOpen]
	);

	return (
		<VoiceSelectorContext value={voiceSelectorContext}>
			<Dialog onOpenChange={setOpen} open={open} {...props}>
				{children}
			</Dialog>
		</VoiceSelectorContext>
	);
}

export type VoiceSelectorTriggerProps = ComponentProps<typeof DialogTrigger>;

export function VoiceSelectorTrigger(props: Readonly<VoiceSelectorTriggerProps>) {
	return <DialogTrigger {...props} />;
}

export type VoiceSelectorContentProps = ComponentProps<typeof DialogContent> & {
	title?: ReactNode;
};

export function VoiceSelectorContent({
	className,
	children,
	title = "Voice Selector",
	...props
}: Readonly<VoiceSelectorContentProps>) {
	return (
		<DialogContent
			aria-describedby={undefined}
			className={cn("p-0", className)}
			{...props}
		>
			<DialogTitle className="sr-only">{title}</DialogTitle>
			<Command className="**:data-[slot=command-input-wrapper]:h-auto">
				{children}
			</Command>
		</DialogContent>
	);
}

export type VoiceSelectorDialogProps = ComponentProps<typeof CommandDialog>;

export function VoiceSelectorDialog(props: Readonly<VoiceSelectorDialogProps>) {
	return <CommandDialog {...props} />;
}

export type VoiceSelectorInputProps = ComponentProps<typeof CommandInput>;

export function VoiceSelectorInput({
	className,
	...props
}: Readonly<VoiceSelectorInputProps>) {
	return <CommandInput className={cn(className)} {...props} />;
}

export type VoiceSelectorListProps = ComponentProps<typeof CommandList>;

export function VoiceSelectorList(props: Readonly<VoiceSelectorListProps>) {
	return <CommandList {...props} />;
}

export type VoiceSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export function VoiceSelectorEmpty(props: Readonly<VoiceSelectorEmptyProps>) {
	return <CommandEmpty {...props} />;
}

export type VoiceSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export function VoiceSelectorGroup(props: Readonly<VoiceSelectorGroupProps>) {
	return <CommandGroup {...props} />;
}

export type VoiceSelectorItemProps = ComponentProps<typeof CommandItem>;

export function VoiceSelectorItem({
	className,
	...props
}: Readonly<VoiceSelectorItemProps>) {
	return <CommandItem className={cn("px-4 py-2", className)} {...props} />;
}

export type VoiceSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export function VoiceSelectorShortcut(props: Readonly<VoiceSelectorShortcutProps>) {
	return <CommandShortcut {...props} />;
}

export type VoiceSelectorSeparatorProps = ComponentProps<
	typeof CommandSeparator
>;

export function VoiceSelectorSeparator(props: Readonly<VoiceSelectorSeparatorProps>) {
	return <CommandSeparator {...props} />;
}

type GenderValue =
	| "male"
	| "female"
	| "transgender"
	| "androgyne"
	| "non-binary"
	| "intersex";

const GENDER_ICONS: Record<GenderValue, ReactNode> = {
	male: <PersonIcon className="size-4" />,
	female: <PersonIcon className="size-4" />,
	transgender: <PersonIcon className="size-4" />,
	androgyne: <PersonIcon className="size-4" />,
	"non-binary": <PersonIcon className="size-4" />,
	intersex: <PersonIcon className="size-4" />,
};

export type VoiceSelectorGenderProps = ComponentProps<"span"> & {
	value?: GenderValue;
};

export function VoiceSelectorGender({
	className,
	value,
	children,
	...props
}: Readonly<VoiceSelectorGenderProps>) {
	const icon = value
		? (GENDER_ICONS[value] ?? <CircleIcon className="size-4" />)
		: <CircleIcon className="size-4" />;

	return (
		<span className={cn("text-muted-foreground text-xs", className)} {...props}>
			{children ?? icon}
		</span>
	);
}

const ACCENT_EMOJIS: Record<string, string> = {
	american: "\u{1F1FA}\u{1F1F8}",
	british: "\u{1F1EC}\u{1F1E7}",
	australian: "\u{1F1E6}\u{1F1FA}",
	canadian: "\u{1F1E8}\u{1F1E6}",
	irish: "\u{1F1EE}\u{1F1EA}",
	scottish: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
	indian: "\u{1F1EE}\u{1F1F3}",
	"south-african": "\u{1F1FF}\u{1F1E6}",
	"new-zealand": "\u{1F1F3}\u{1F1FF}",
	spanish: "\u{1F1EA}\u{1F1F8}",
	french: "\u{1F1EB}\u{1F1F7}",
	german: "\u{1F1E9}\u{1F1EA}",
	italian: "\u{1F1EE}\u{1F1F9}",
	portuguese: "\u{1F1F5}\u{1F1F9}",
	brazilian: "\u{1F1E7}\u{1F1F7}",
	mexican: "\u{1F1F2}\u{1F1FD}",
	argentinian: "\u{1F1E6}\u{1F1F7}",
	japanese: "\u{1F1EF}\u{1F1F5}",
	chinese: "\u{1F1E8}\u{1F1F3}",
	korean: "\u{1F1F0}\u{1F1F7}",
	russian: "\u{1F1F7}\u{1F1FA}",
	arabic: "\u{1F1F8}\u{1F1E6}",
	dutch: "\u{1F1F3}\u{1F1F1}",
	swedish: "\u{1F1F8}\u{1F1EA}",
	norwegian: "\u{1F1F3}\u{1F1F4}",
	danish: "\u{1F1E9}\u{1F1F0}",
	finnish: "\u{1F1EB}\u{1F1EE}",
	polish: "\u{1F1F5}\u{1F1F1}",
	turkish: "\u{1F1F9}\u{1F1F7}",
	greek: "\u{1F1EC}\u{1F1F7}",
};

export type VoiceSelectorAccentProps = ComponentProps<"span"> & {
	value?: string;
};

export function VoiceSelectorAccent({
	className,
	value,
	children,
	...props
}: Readonly<VoiceSelectorAccentProps>) {
	const emoji = value ? (ACCENT_EMOJIS[value] ?? null) : null;

	return (
		<span className={cn("text-muted-foreground text-xs", className)} {...props}>
			{children ?? emoji}
		</span>
	);
}

export type VoiceSelectorAgeProps = ComponentProps<"span">;

export function VoiceSelectorAge({
	className,
	...props
}: Readonly<VoiceSelectorAgeProps>) {
	return (
		<span
			className={cn("text-muted-foreground text-xs tabular-nums", className)}
			{...props}
		/>
	);
}

export type VoiceSelectorNameProps = ComponentProps<"span">;

export function VoiceSelectorName({
	className,
	...props
}: Readonly<VoiceSelectorNameProps>) {
	return (
		<span
			className={cn("flex-1 truncate text-left font-medium", className)}
			{...props}
		/>
	);
}

export type VoiceSelectorDescriptionProps = ComponentProps<"span">;

export function VoiceSelectorDescription({
	className,
	...props
}: Readonly<VoiceSelectorDescriptionProps>) {
	return (
		<span className={cn("text-muted-foreground text-xs", className)} {...props} />
	);
}

export type VoiceSelectorAttributesProps = ComponentProps<"div">;

export function VoiceSelectorAttributes({
	className,
	children,
	...props
}: Readonly<VoiceSelectorAttributesProps>) {
	return (
		<div className={cn("flex items-center text-xs", className)} {...props}>
			{children}
		</div>
	);
}

export type VoiceSelectorBulletProps = ComponentProps<"span">;

export function VoiceSelectorBullet({
	className,
	...props
}: Readonly<VoiceSelectorBulletProps>) {
	return (
		<span
			aria-hidden="true"
			className={cn("select-none text-border", className)}
			{...props}
		>
			&bull;
		</span>
	);
}

export type VoiceSelectorPreviewProps = Omit<
	ComponentProps<"button">,
	"children"
> & {
	playing?: boolean;
	loading?: boolean;
	onPlay?: () => void;
};

export function VoiceSelectorPreview({
	className,
	playing,
	loading,
	onPlay,
	onClick,
	...props
}: Readonly<VoiceSelectorPreviewProps>) {
	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onClick?.(event);
			onPlay?.();
		},
		[onClick, onPlay]
	);

	let icon = <PlayIcon className="size-3" />;

	if (loading) {
		icon = <Spinner className="size-3" />;
	} else if (playing) {
		icon = <PauseIcon className="size-3" />;
	}

	return (
		<Button
			aria-label={playing ? "Pause preview" : "Play preview"}
			className={cn("size-6", className)}
			disabled={loading}
			onClick={handleClick}
			size="icon"
			type="button"
			variant="outline"
			{...props}
		>
			{icon}
		</Button>
	);
}
