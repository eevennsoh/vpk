"use client";

import {
	EmojiPicker,
	type EmojiPickerListCategoryHeaderProps,
	type EmojiPickerListComponents,
	type EmojiPickerListEmojiProps,
	type EmojiPickerListRowProps,
} from "frimousse";

import { cn } from "@/lib/utils";
import { dropdownStyles } from "@/components/ui/dropdown-menu";

export interface EmojiPickerPanelProps {
	onSelect: (emoji: string) => void;
	className?: string;
}

/**
 * frimousse virtualises the list and measures one header, one row and one emoji
 * to size the rest, so these parts must keep a constant size and a stable
 * component identity — hence module scope rather than inline definitions.
 */
function PanelCategoryHeader({
	category,
	className,
	...props
}: Readonly<EmojiPickerListCategoryHeaderProps>) {
	return (
		<div
			{...props}
			className={cn(
				"h-7 bg-surface", dropdownStyles.label,
				className,
			)}
		>
			{category.label}
		</div>
	);
}

function PanelRow({ children, className, ...props }: Readonly<EmojiPickerListRowProps>) {
	return (
		<div {...props} className={cn("flex px-1", className)}>
			{children}
		</div>
	);
}

function PanelEmoji({ emoji, className, ...props }: Readonly<EmojiPickerListEmojiProps>) {
	return (
		<button
			{...props}
			aria-label={emoji.label}
			className={cn(
				"flex size-8 items-center justify-center rounded-sm text-lg leading-none",
				emoji.isActive ? "bg-bg-neutral-subtle-hovered" : null,
				className,
			)}
			type="button"
		>
			<span aria-hidden="true">{emoji.emoji}</span>
		</button>
	);
}

const PANEL_LIST_COMPONENTS: Partial<EmojiPickerListComponents> = {
	CategoryHeader: PanelCategoryHeader,
	Emoji: PanelEmoji,
	Row: PanelRow,
};

/**
 * The full searchable picker. This is the only module that imports frimousse —
 * everything else reaches it through `next/dynamic`, so neither the library nor
 * its ~762 KB emojibase fetch happens until the user opens the full view.
 *
 * `emojibaseUrl` points at `public/emoji-data/`, so the data is same-origin and
 * survives offline use and the Micros static export.
 */
export function EmojiPickerPanel({ onSelect, className }: Readonly<EmojiPickerPanelProps>) {
	return (
		<EmojiPicker.Root
			className={cn("isolate flex w-full flex-col bg-surface text-text", className)}
			columns={8}
			emojibaseUrl="/emoji-data"
			locale="en"
			onEmojiSelect={({ emoji }) => onSelect(emoji)}
		>
			<div className="border-b border-border p-2">
				<EmojiPicker.Search
					aria-label="Search emoji"
					className="placeholder:text-text-subtlest focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border border-input bg-bg-input px-2.5 text-sm text-text outline-none transition-colors duration-normal ease-out-practical focus-visible:ring-3 motion-reduce:transition-none"
					placeholder="Search emoji"
				/>
			</div>
			<EmojiPicker.Viewport className="relative max-h-64 overflow-y-auto">
				<EmojiPicker.Loading className="flex h-24 items-center justify-center text-sm text-text-subtlest">
					Loading emoji…
				</EmojiPicker.Loading>
				<EmojiPicker.Empty className="flex h-24 items-center justify-center px-4 text-center text-sm text-text-subtlest">
					{({ search }) => `No emoji found for "${search}"`}
				</EmojiPicker.Empty>
				<EmojiPicker.List className="pb-1 select-none" components={PANEL_LIST_COMPONENTS} />
			</EmojiPicker.Viewport>
			<div className="flex items-center gap-2 border-t border-border px-2 py-1.5">
				<EmojiPicker.SkinToneSelector
					aria-label="Change skin tone"
					className="flex size-7 shrink-0 items-center justify-center rounded-sm text-base hover:bg-bg-neutral-subtle-hovered"
				/>
				<EmojiPicker.ActiveEmoji>
					{({ emoji }) => (
						<span className="truncate text-xs text-text-subtlest">
							{emoji ? emoji.label : "Select an emoji"}
						</span>
					)}
				</EmojiPicker.ActiveEmoji>
			</div>
		</EmojiPicker.Root>
	);
}

export default EmojiPickerPanel;
