"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import {
	tabsExperimentalListClass,
} from "@/components/ui/tabs-experimental"
import { cn } from "@/lib/utils"

type TabsProps = TabsPrimitive.Root.Props

function Tabs({
	className,
	orientation = "horizontal",
	...props
}: Readonly<TabsProps>) {
	const isHorizontal = orientation === "horizontal"
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			{...(isHorizontal
				? { "data-horizontal": "" }
				: { "data-vertical": "" })}
			className={cn(
				"group/tabs flex data-horizontal:flex-col data-vertical:gap-2",
				className
			)}
			{...props}
		/>
	)
}

const tabsLineListOverflowClass = "overflow-x-auto -mb-px pb-px"

const tabsLineIndicatorClass =
	"after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-border-selected"

const tabsListVariants = cva(
	"group/tabs-list text-text-subtle inline-flex items-center justify-center group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
	{
		variants: {
			variant: {
				default: "rounded-md bg-muted",
				experimental: tabsExperimentalListClass,
				line: `gap-0 bg-transparent shadow-[inset_0_-1px_0_0_var(--color-border)] ${tabsLineListOverflowClass}`,
			},
			size: {
				default: "group-data-horizontal/tabs:h-8",
				compact: "group-data-horizontal/tabs:h-6",
			},
			fullWidth: {
				true: "w-full",
				false: "w-fit",
			},
		},
		compoundVariants: [
			{
				variant: "default",
				size: "default",
				className: "p-[3px]",
			},
			{
				variant: "default",
				size: "compact",
				className: "p-0.5",
			},
		],
		defaultVariants: {
			variant: "default",
			size: "default",
			fullWidth: false,
		},
	}
)

interface TabsListProps
	extends TabsPrimitive.List.Props,
		VariantProps<typeof tabsListVariants> {
	animateIndicator?: boolean
}

function TabsList({
	animateIndicator = false,
	children,
	className,
	variant = "default",
	size = "default",
	fullWidth = false,
	...props
}: Readonly<TabsListProps>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-size={size}
			data-variant={variant}
			data-animated-indicator={animateIndicator && variant === "line" ? "" : undefined}
			className={cn(tabsListVariants({ variant, size, fullWidth }), animateIndicator && variant === "line" ? "relative" : null, className)}
			{...props}
		>
			{children}
			{animateIndicator && variant === "line" ? <TabsPrimitive.Indicator
				data-slot="tabs-indicator"
				className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) bg-border-selected transition-[translate,width,height] duration-normal ease-out-practical group-data-vertical/tabs:inset-y-auto group-data-vertical/tabs:bottom-auto group-data-vertical/tabs:left-auto group-data-vertical/tabs:right-0 group-data-vertical/tabs:top-0 group-data-vertical/tabs:h-(--active-tab-height) group-data-vertical/tabs:w-0.5 group-data-vertical/tabs:translate-x-0 group-data-vertical/tabs:translate-y-(--active-tab-top)"
			/> : null}
		</TabsPrimitive.List>
	)
}

type TabsTriggerProps = TabsPrimitive.Tab.Props

function TabsTrigger({ className, ...props }: Readonly<TabsTriggerProps>) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				"gap-1.5 rounded-sm border border-transparent py-0.5 text-sm font-medium focus-visible:border-ring focus-visible:ring-ring/50 text-text-subtle relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-[background-color,border-color,border-radius,box-shadow,color,opacity] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-[size=default]/tabs-list:px-3 group-data-[size=compact]/tabs-list:px-2 group-data-[size=default]/tabs-list:[&_svg:not([class*='size-'])]:size-4 group-data-[size=compact]/tabs-list:[&_svg:not([class*='size-'])]:size-3 group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-(--opacity-disabled) aria-disabled:pointer-events-none aria-disabled:opacity-(--opacity-disabled) [&_[data-slot=icon]]:text-icon-subtle [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon-subtle",
				// Default (pill) variant states — idle and selected keep text-subtle / icon-subtle
				"group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=default]/tabs-list:hover:bg-bg-neutral-subtle-hovered group-data-[variant=default]/tabs-list:active:bg-bg-neutral-subtle-pressed group-data-[variant=default]/tabs-list:data-active:bg-surface",
				// Line variant states use the ADS selected text and icon tokens.
				"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:hover:bg-bg-neutral-subtle-hovered group-data-[variant=line]/tabs-list:hover:rounded-t-md group-data-[variant=line]/tabs-list:active:bg-bg-neutral-subtle-pressed group-data-[variant=line]/tabs-list:active:rounded-t-md group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:text-text-selected group-data-[variant=line]/tabs-list:data-active:[&_[data-slot=icon]]:text-icon-selected group-data-[variant=line]/tabs-list:data-active:[&_svg]:text-icon-selected",
				// Experimental variant — compact Jira navigation treatment
				"group-data-[variant=experimental]/tabs-list:h-full group-data-[variant=experimental]/tabs-list:rounded-sm group-data-[variant=experimental]/tabs-list:border-y-0 group-data-[variant=experimental]/tabs-list:border-x-[6px]! group-data-[variant=experimental]/tabs-list:border-x-transparent! group-data-[variant=experimental]/tabs-list:px-0! group-data-[variant=experimental]/tabs-list:text-xs group-data-[variant=experimental]/tabs-list:font-medium group-data-[variant=experimental]/tabs-list:leading-4 group-data-[variant=experimental]/tabs-list:hover:rounded-md group-data-[variant=experimental]/tabs-list:active:rounded-md group-data-[variant=experimental]/tabs-list:active:bg-bg-neutral-subtle-pressed group-data-[variant=experimental]/tabs-list:data-active:bg-transparent",
				// Selected indicator (underline for line variant)
				"after:content-[''] after:pointer-events-none after:absolute after:opacity-0 after:transition-opacity group-data-vertical/tabs:after:inset-x-auto group-data-vertical/tabs:after:bottom-auto group-data-vertical/tabs:after:h-auto group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:right-0 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100 group-data-[variant=experimental]/tabs-list:data-active:after:opacity-100",
				tabsLineIndicatorClass,
				"group-data-animated-indicator/tabs-list:after:hidden",
				"group-data-[variant=experimental]/tabs-list:after:bg-bg-neutral-bold",
				className
			)}
			{...props}
		/>
	)
}

type TabsContentProps = TabsPrimitive.Panel.Props

function TabsContent({ className, keepMounted = true, ...props }: Readonly<TabsContentProps>) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			keepMounted={keepMounted}
			className={cn("text-sm flex-1 outline-none", className)}
			render={(elementProps, state) => (
				<div
					{...elementProps}
					// `hidden="until-found"` keeps the panel content discoverable by
					// the browser's find-in-page (Cmd-F) while visually hidden.
					// Baseline Newly Available (2024-08-06). Overrides Base UI's
					// default boolean `hidden` so inactive tab content can still be
					// searched. React's hidden prop type allows the string value.
					hidden={
						state.hidden
							? ("until-found" as unknown as boolean)
							: undefined
					}
				/>
			)}
			{...props}
		/>
	)
}

export {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
	tabsLineIndicatorClass,
	tabsLineListOverflowClass,
	tabsListVariants,
	type TabsProps,
	type TabsListProps,
	type TabsTriggerProps,
	type TabsContentProps,
}
