"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

const TooltipConfiguredContext = React.createContext(false)
const TooltipAnimateContext = React.createContext(true)
const TooltipPortalContainerContext = React.createContext<
	TooltipPrimitive.Portal.Props["container"]
>(undefined)

const TOOLTIP_POPUP_ANIMATION_CLASSES =
	"transition-[opacity,translate] duration-normal ease-out-practical motion-reduce:transition-none data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=top]:data-starting-style:translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=inline-start]:data-starting-style:translate-x-2 data-[side=inline-end]:data-starting-style:-translate-x-2 data-[side=bottom]:data-ending-style:-translate-y-2 data-[side=top]:data-ending-style:translate-y-2 data-[side=left]:data-ending-style:translate-x-2 data-[side=right]:data-ending-style:-translate-x-2 data-[side=inline-start]:data-ending-style:translate-x-2 data-[side=inline-end]:data-ending-style:-translate-x-2"

type TooltipProviderProps = TooltipPrimitive.Provider.Props & {
	delay?: number
	portalContainer?: TooltipPrimitive.Portal.Props["container"]
}

function TooltipProvider({
	delay = 0,
	portalContainer,
	...props
}: Readonly<TooltipProviderProps>) {
	return (
		<TooltipConfiguredContext value={true}>
			<TooltipPortalContainerContext value={portalContainer}>
				<TooltipPrimitive.Provider
					data-slot="tooltip-provider"
					delay={delay}
					{...props}
				/>
			</TooltipPortalContainerContext>
		</TooltipConfiguredContext>
	)
}

type TooltipProps = TooltipPrimitive.Root.Props & {
	animate?: boolean
}

function Tooltip({
	actionsRef,
	animate = true,
	defaultOpen = false,
	onOpenChange,
	open,
	...props
}: Readonly<TooltipProps>) {
	const hasProvider = React.use(TooltipConfiguredContext)
	const internalActionsRef = React.useRef<TooltipPrimitive.Root.Actions | null>(null)
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
	const isOpen = open ?? uncontrolledOpen

	React.useImperativeHandle(actionsRef, () => ({
		close: () => internalActionsRef.current?.close(),
		unmount: () => internalActionsRef.current?.unmount(),
	}))

	const handleOpenChange = React.useCallback<
		NonNullable<TooltipPrimitive.Root.Props["onOpenChange"]>
	>((nextOpen, eventDetails) => {
		if (open === undefined) {
			setUncontrolledOpen(nextOpen)
		}
		onOpenChange?.(nextOpen, eventDetails)
	}, [onOpenChange, open])

	React.useEffect(() => {
		if (!isOpen) {
			return undefined
		}

		const handleScroll = () => internalActionsRef.current?.close()
		window.addEventListener("scroll", handleScroll, {
			capture: true,
			passive: true,
		})

		return () => window.removeEventListener("scroll", handleScroll, true)
	}, [isOpen])

	const root = (
		<TooltipAnimateContext value={animate}>
			<TooltipPrimitive.Root
				actionsRef={internalActionsRef}
				data-slot="tooltip"
				defaultOpen={defaultOpen}
				onOpenChange={handleOpenChange}
				open={open}
				{...props}
			/>
		</TooltipAnimateContext>
	)

	return hasProvider ? root : <TooltipProvider>{root}</TooltipProvider>
}

type TooltipTriggerProps = TooltipPrimitive.Trigger.Props

function TooltipTrigger(props: Readonly<TooltipTriggerProps>) {
	return (
		<TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
	)
}

interface TooltipContentProps
	extends TooltipPrimitive.Popup.Props,
		Pick<
			TooltipPrimitive.Positioner.Props,
			"align" | "alignOffset" | "anchor" | "collisionAvoidance" | "side" | "sideOffset"
		> {
	animate?: boolean
	positionerClassName?: string
}

function TooltipContent({
	animate,
	className,
	side = "top",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	anchor,
	collisionAvoidance,
	positionerClassName,
	children,
	...props
}: Readonly<TooltipContentProps>) {
	const animateFromRoot = React.use(TooltipAnimateContext)
	const portalContainer = React.use(TooltipPortalContainerContext)
	const shouldAnimate = animate ?? animateFromRoot

	return (
		<TooltipPrimitive.Portal container={portalContainer}>
			<TooltipPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				collisionAvoidance={collisionAvoidance}
				side={side}
				sideOffset={sideOffset}
				className={cn("isolate z-[200]", positionerClassName)}
			>
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						"w-fit max-w-xs rounded-md bg-bg-neutral-bold px-3 py-1.5 text-xs text-text-inverse outline-hidden",
						shouldAnimate
							? TOOLTIP_POPUP_ANIMATION_CLASSES
							: "transition-none motion-reduce:transition-none",
						className
					)}
					{...props}
				>
					{children}
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	)
}

export {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
	type TooltipProps,
	type TooltipTriggerProps,
	type TooltipContentProps,
	type TooltipProviderProps,
}
