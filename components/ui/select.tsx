"use client"

import type { ComponentProps } from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { dropdownStyles, type MenuSpacing } from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import {
	SelectTag,
	SelectTags,
	type SelectTagProps,
	type SelectTagsProps,
} from "@/components/ui/select-tags"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down"
import CheckMarkIcon from "@atlaskit/icon/core/check-mark"
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up"

const Select = SelectPrimitive.Root

type SelectGroupProps = SelectPrimitive.Group.Props

function SelectGroup({ className, ...props }: Readonly<SelectGroupProps>) {
	return (
		<SelectPrimitive.Group
			data-slot="select-group"
			className={cn(dropdownStyles.group, "scroll-my-1", className)}
			{...props}
		/>
	)
}

type SelectValueProps = SelectPrimitive.Value.Props

function SelectValue({ className, ...props }: Readonly<SelectValueProps>) {
	return (
		<SelectPrimitive.Value
			data-slot="select-value"
			className={cn("flex flex-1 text-left", className)}
			{...props}
		/>
	)
}

interface SelectTriggerProps extends SelectPrimitive.Trigger.Props {
	size?: "sm" | "default"
	variant?: "default" | "subtle" | "none"
	isLoading?: boolean
	/**
	 * Host removable `SelectTag` controls inside the trigger. Renders as a
	 * non-button host (`nativeButton={false}`) and relaxes height/clamp so
	 * tags can wrap. Use for single-select clearable tags or multi-select tags.
	 */
	tags?: boolean
}

function SelectTrigger({
	className,
	size = "default",
	variant = "default",
	isLoading = false,
	tags = false,
	nativeButton,
	render,
	children,
	...props
}: Readonly<SelectTriggerProps>) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			data-variant={variant}
			data-tags={tags ? "true" : undefined}
			aria-busy={isLoading || undefined}
			nativeButton={tags ? false : nativeButton}
			render={tags ? (render ?? <div />) : render}
			className={cn(
				// Radius matches outline Button / dropdown triggers (`rounded-md`).
				// Resting tone matches outline Button (`text-text-subtle` /
				// `text-icon-subtle`). Empty form states stay washed via
				// `data-placeholder:text-text-subtlest`; chrome selects that should
				// stay outline-button grey can override placeholder back to subtle.
				"data-placeholder:text-text-subtlest focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive gap-1.5 rounded-md bg-transparent px-2.5 py-2 text-sm text-text-subtle transition-colors select-none focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit cursor-pointer items-center justify-between whitespace-nowrap outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon-subtle",
				// Default fill matches outline Button (`bg-bg-neutral-subtle`), not
				// `bg-bg-input` — input tokens read near-black in dark mode.
				"data-[variant=default]:border-border data-[variant=default]:border data-[variant=default]:bg-bg-neutral-subtle data-[variant=default]:hover:bg-bg-neutral-subtle-hovered data-[variant=default]:active:bg-bg-neutral-subtle-pressed",
				"data-[variant=subtle]:border data-[variant=subtle]:border-transparent data-[variant=subtle]:hover:bg-bg-neutral-subtle-hovered data-[variant=subtle]:active:bg-bg-neutral-subtle-pressed",
				"data-[variant=none]:border-0 data-[variant=none]:bg-transparent",
				// Border state overrides must be variant-scoped. The resting
				// `data-[variant=*]:border-*` rules above have the same specificity as the
				// unscoped `focus-visible:` / `aria-invalid:` borders and Tailwind emits
				// data-attribute variants last, so the resting border would otherwise win.
				// (`none` needs no entry — `border-0` leaves nothing to colour.)
				"data-[variant=default]:focus-visible:border-ring data-[variant=default]:aria-invalid:border-destructive",
				"data-[variant=subtle]:focus-visible:border-ring data-[variant=subtle]:aria-invalid:border-destructive",
				tags &&
					"h-auto min-h-8 whitespace-normal *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:flex-wrap [&_[data-slot=tag]_button]:pointer-events-auto",
				isLoading && "pointer-events-none opacity-(--opacity-loading)",
				className
			)}
			{...props}
		>
			{children}
			{isLoading ? (
				<Spinner size="xs" className="text-icon-subtle" />
			) : (
				<SelectPrimitive.Icon
					render={
						<Icon
							render={<ChevronDownIcon label="" size="small" spacing="none" />}
							label=""
							className="text-icon-subtle size-4 pointer-events-none"
						/>
					}
				/>
			)}
		</SelectPrimitive.Trigger>
	)
}

interface SelectContentProps
	extends SelectPrimitive.Popup.Props,
		Pick<
			SelectPrimitive.Positioner.Props,
			"align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
		> {
	spacing?: MenuSpacing
	showScrollButtons?: boolean
	/** Positioner stacking class. Defaults to `isolate z-[200]`; raise above dialogs (e.g. `z-[502]`). */
	positionerClassName?: string
}

function SelectContent({
	className,
	children,
	side = "bottom",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	alignItemWithTrigger = true,
	showScrollButtons = true,
	spacing = "compact",
	positionerClassName,
	"aria-label": ariaLabel,
	...props
}: Readonly<SelectContentProps>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				alignItemWithTrigger={alignItemWithTrigger}
				className={cn("isolate z-[200]", positionerClassName)}
			>
				<SelectPrimitive.Popup
					data-slot="select-content"
					data-menu-spacing={spacing}
					data-align-trigger={alignItemWithTrigger}
					className={cn(
						dropdownStyles.popup,
						dropdownStyles.surface,
						dropdownStyles.padding[spacing],
						"relative isolate data-[align-trigger=true]:w-(--anchor-width) data-[align-trigger=true]:animate-none",
						className
					)}
					{...props}
				>
					{showScrollButtons ? <SelectScrollUpButton /> : null}
					<SelectPrimitive.List aria-label={ariaLabel}>{children}</SelectPrimitive.List>
					{showScrollButtons ? <SelectScrollDownButton /> : null}
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	)
}

interface SelectLabelProps extends SelectPrimitive.GroupLabel.Props {
	inset?: boolean
}

function SelectLabel({ className, inset, ...props }: Readonly<SelectLabelProps>) {
	return (
		<SelectPrimitive.GroupLabel
			data-slot="select-label"
			data-inset={inset}
			className={cn(dropdownStyles.label, "data-inset:pl-8", className)}
			{...props}
		/>
	)
}

interface SelectItemProps extends SelectPrimitive.Item.Props {
	/** Extra classes for ItemText (e.g. `whitespace-normal` for rich multi-line content). */
	textClassName?: string
	/**
	 * When false, omits the trailing selected checkmark and its reserved
	 * right padding (e.g. card-style options that show selection elsewhere).
	 * Defaults to true.
	 */
	showIndicator?: boolean
}

/**
 * Select rows have always carried the check on the trailing edge. Gutter and
 * glyph share DropdownMenu's `indicatorPlacement="end"` tokens so the tick
 * sits in the same in-flow 12px slot as a submenu chevron.
 */
function SelectItem({
	className,
	textClassName,
	showIndicator = true,
	children,
	...props
}: Readonly<SelectItemProps>) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				dropdownStyles.selectableItem,
				showIndicator ? dropdownStyles.selectableItemIndicatorEnd : "pl-2",
				"data-selected:text-text data-selected:data-highlighted:text-text",
				className
			)}
			{...props}
		>
			<SelectPrimitive.ItemText
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap",
					textClassName,
				)}
			>
				{children}
			</SelectPrimitive.ItemText>
			{showIndicator ? (
				<span
					data-slot="select-item-indicator"
					className={dropdownStyles.indicatorEnd}
				>
					<SelectPrimitive.ItemIndicator>
						<Icon
							render={<CheckMarkIcon label="" size="small" />}
							label="Selected"
							className="text-icon-subtle"
						/>
					</SelectPrimitive.ItemIndicator>
				</span>
			) : null}
		</SelectPrimitive.Item>
	)
}

type SelectSeparatorProps = SelectPrimitive.Separator.Props

function SelectSeparator({
	className,
	...props
}: Readonly<SelectSeparatorProps>) {
	return (
		<SelectPrimitive.Separator
			data-slot="select-separator"
			className={cn(dropdownStyles.separator, "pointer-events-none", className)}
			{...props}
		/>
	)
}

type SelectScrollUpButtonProps = ComponentProps<typeof SelectPrimitive.ScrollUpArrow>

function SelectScrollUpButton({
	className,
	...props
}: Readonly<SelectScrollUpButtonProps>) {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot="select-scroll-up-button"
			className={cn(
				"bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4 top-0 w-full",
				className
			)}
			{...props}
		>
			<ChevronUpIcon label="" size="small" spacing="none" />
		</SelectPrimitive.ScrollUpArrow>
	)
}

type SelectScrollDownButtonProps = ComponentProps<typeof SelectPrimitive.ScrollDownArrow>

function SelectScrollDownButton({
	className,
	...props
}: Readonly<SelectScrollDownButtonProps>) {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot="select-scroll-down-button"
			className={cn(
				"bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4 bottom-0 w-full",
				className
			)}
			{...props}
		>
			<ChevronDownIcon label="" size="small" spacing="none" />
		</SelectPrimitive.ScrollDownArrow>
	)
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTag,
	SelectTags,
	SelectTrigger,
	SelectValue,
	type SelectGroupProps,
	type SelectValueProps,
	type SelectTriggerProps,
	type SelectContentProps,
	type SelectLabelProps,
	type SelectItemProps,
	type SelectSeparatorProps,
	type SelectScrollUpButtonProps,
	type SelectScrollDownButtonProps,
	type SelectTagProps,
	type SelectTagsProps,
}
