"use client"

import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left"
import CrossIcon from "@atlaskit/icon/core/cross"
import FilterIcon from "@atlaskit/icon/core/filter"
import GrowDiagonalIcon from "@atlaskit/icon/core/grow-diagonal"
import LinkExternalIcon from "@atlaskit/icon/core/link-external"
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal"
import type { NewCoreIconProps } from "@atlaskit/icon/base-new"
import {
	type ComponentProps,
	type ComponentType,
	type MouseEvent,
	type ReactNode,
} from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type PanelActionIcon = ComponentType<NewCoreIconProps>

interface PanelContainerProps extends ComponentProps<"section"> {
	isFocusLockEnabled?: boolean
	testId?: string
}

interface PanelHeaderProps extends ComponentProps<"header"> {
	testId?: string
}

interface PanelTitleProps extends ComponentProps<"div"> {
	icon?: ReactNode
	testId?: string
}

interface PanelContentProps extends ComponentProps<"div"> {
	testId?: string
}

interface PanelBodyProps extends ComponentProps<"div"> {
	spacing?: "none" | "default"
	testId?: string
}

interface PanelSubheaderProps extends ComponentProps<"div"> {
	breadcrumbs?: ReactNode
	coverImage?: ReactNode
	inlineEdit?: ReactNode
	testId?: string
	title: string
	titleIcon?: ReactNode
}

interface PanelFooterProps extends ComponentProps<"footer"> {
	disclaimer?: ReactNode
	testId?: string
}

interface PanelDisclaimerProps extends ComponentProps<"div"> {
	testId?: string
}

interface PanelActionGroupProps extends ComponentProps<"div"> {
	testId?: string
}

interface PanelActionProps
	extends Omit<ComponentProps<typeof Button>, "size" | "variant" | "onClick"> {
	"aria-expanded"?: ComponentProps<"button">["aria-expanded"]
	"aria-haspopup"?: ComponentProps<"button">["aria-haspopup"]
	"aria-label"?: string
	appearance?: "default" | "primary" | "subtle" | "discovery"
	href?: string
	icon?: PanelActionIcon
	label?: string
	onClick?: (
		event: MouseEvent<HTMLButtonElement> | MouseEvent<HTMLAnchorElement>
	) => void
	rel?: string
	spacing?: "default" | "compact"
	target?: string
	testId?: string
	tooltip?: ReactNode
}

interface PanelActionCloseProps
	extends Pick<PanelActionProps, "label" | "onClick" | "testId"> {
	onBeforeClose?: () => boolean | Promise<boolean>
}

type PanelActionVariantProps = Pick<
	PanelActionProps,
	"aria-expanded" | "aria-haspopup" | "label" | "onClick" | "testId"
>

interface PanelActionNewTabProps
	extends Pick<PanelActionProps, "label" | "onClick" | "testId"> {
	href: string
}

function PanelContainer({
	children,
	className,
	isFocusLockEnabled = false,
	testId,
	...props
}: Readonly<PanelContainerProps>) {
	return (
		<section
			data-focus-lock-enabled={isFocusLockEnabled ? true : undefined}
			data-slot="panel-container"
			data-testid={testId}
			className={cn(
				"relative flex h-full min-h-0 flex-col bg-surface text-text",
				className
			)}
			{...props}
		>
			<div className="flex min-h-0 flex-1 shrink flex-col overflow-hidden">
				{children}
			</div>
		</section>
	)
}

function PanelHeader({
	children,
	className,
	testId,
	...props
}: Readonly<PanelHeaderProps>) {
	return (
		<header
			data-slot="panel-header"
			data-testid={testId}
			className={cn(
				"flex h-14 items-center px-5 py-4",
				className
			)}
			{...props}
		>
			<div className="flex w-full items-center justify-between gap-2">
				{children}
			</div>
		</header>
	)
}

function PanelTitle({
	children,
	className,
	icon,
	testId,
	...props
}: Readonly<PanelTitleProps>) {
	return (
		<div
			data-slot="panel-title"
			data-testid={testId}
			className={cn("flex min-w-0 flex-1 items-center", className)}
			{...props}
		>
			{icon ? (
				<span className="flex size-6 shrink-0 items-center justify-center">
					{icon}
				</span>
			) : null}
			<span className={cn(icon && "pl-1")}>
				<h2 className="truncate text-base font-medium leading-5 text-text">
					{children}
				</h2>
			</span>
		</div>
	)
}

function PanelContent({
	children,
	className,
	testId,
	...props
}: Readonly<PanelContentProps>) {
	return (
		<div
			data-slot="panel-content"
			data-testid={testId}
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto",
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

function PanelBody({
	children,
	className,
	spacing = "default",
	testId,
	...props
}: Readonly<PanelBodyProps>) {
	return (
		<div
			data-slot="panel-body"
			data-testid={testId}
			className={cn(
				"relative flex-1 [overflow-wrap:anywhere]",
				spacing === "default" && "px-6",
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

function PanelSubheader({
	breadcrumbs,
	children,
	className,
	coverImage,
	inlineEdit,
	testId,
	title,
	titleIcon,
	...props
}: Readonly<PanelSubheaderProps>) {
	return (
		<div
			data-slot="panel-subheader"
			data-testid={testId}
			className={cn("flex flex-col gap-3 px-6 pb-4", className)}
			{...props}
		>
			{coverImage ? (
				<div className="-mx-6 h-40 overflow-hidden [&>*]:block [&>*]:h-full [&>*]:w-full [&>*]:object-cover">
					{coverImage}
				</div>
			) : null}
			<div className="flex flex-col gap-2">
				{breadcrumbs ? (
					<div className="flex min-h-6 items-center">{breadcrumbs}</div>
				) : null}
				<div className="flex items-start gap-3">
					{titleIcon ? (
						<span
							className={cn(
								"flex size-6 shrink-0 items-center justify-center [&>*]:max-h-6 [&>*]:max-w-6",
								inlineEdit && "mt-1.5"
							)}
						>
							{titleIcon}
						</span>
					) : null}
					{inlineEdit ?? (
						<h3 className="min-w-0 text-xl font-medium leading-6 text-text">
							{title}
						</h3>
					)}
				</div>
				{children}
			</div>
		</div>
	)
}

function PanelFooter({
	children,
	className,
	disclaimer,
	testId,
	...props
}: Readonly<PanelFooterProps>) {
	return (
		<footer
			data-slot="panel-footer"
			data-testid={testId}
			className={cn(
				"flex flex-col border-t border-border bg-bg-neutral-subtle",
				className
			)}
			{...props}
		>
			{children ? (
				<div className="flex px-6 py-4">
					<div className="flex w-full flex-row-reverse items-center justify-between gap-2">
						{children}
					</div>
				</div>
			) : null}
			{disclaimer}
		</footer>
	)
}

function PanelDisclaimer({
	children,
	className,
	testId,
	...props
}: Readonly<PanelDisclaimerProps>) {
	return (
		<div
			data-slot="panel-disclaimer"
			data-testid={testId}
			className={cn(
				"self-stretch bg-surface-sunken px-6 py-3 text-sm leading-5 text-text-subtle",
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

function PanelActionGroup({
	children,
	className,
	testId,
	...props
}: Readonly<PanelActionGroupProps>) {
	return (
		<div
			data-slot="panel-action-group"
			data-testid={testId}
			className={cn("flex items-center gap-1", className)}
			{...props}
		>
			{children}
		</div>
	)
}

function panelButtonVariant(appearance: PanelActionProps["appearance"]) {
	if (appearance === "primary") {
		return "default"
	}
	if (appearance === "discovery") {
		return "discovery"
	}
	return "ghost"
}

function wrapPanelActionTooltip(action: ReactNode, tooltip: ReactNode) {
	return (
		<Tooltip>
			<TooltipTrigger render={<span className="inline-flex" />}>
				{action}
			</TooltipTrigger>
			<TooltipContent>{tooltip}</TooltipContent>
		</Tooltip>
	)
}

function PanelAction({
	appearance = "subtle",
	children,
	className,
	href,
	icon: IconComponent,
	label,
	onClick,
	rel,
	spacing = "default",
	target,
	testId,
	tooltip,
	...props
}: Readonly<PanelActionProps>) {
	const iconOnly = Boolean(IconComponent)
	const size = iconOnly
		? spacing === "compact"
			? "icon-compact"
			: "icon"
		: "compact"

	const action = href ? (
		<a
			data-slot="panel-action"
			data-testid={testId}
			aria-label={iconOnly ? label ?? props["aria-label"] : props["aria-label"]}
			href={href}
			onClick={onClick}
			rel={rel}
			target={target}
			className={cn(
				buttonVariants({ variant: panelButtonVariant(appearance), size }),
				className
			)}
			{...(props as ComponentProps<"a">)}
		>
			{IconComponent ? (
				<Icon
					render={
						<IconComponent label="" color="currentColor" />
					}
					aria-hidden
				/>
			) : (
				children
			)}
		</a>
	) : (
		<Button
			data-slot="panel-action"
			data-testid={testId}
			aria-label={label ?? props["aria-label"]}
			className={className}
			onClick={onClick as ComponentProps<typeof Button>["onClick"]}
			size={size}
			variant={panelButtonVariant(appearance)}
			{...props}
		>
			{IconComponent ? (
				<Icon
					render={
						<IconComponent label="" color="currentColor" />
					}
					aria-hidden
				/>
			) : (
				children
			)}
		</Button>
	)

	return tooltip === undefined ? action : wrapPanelActionTooltip(action, tooltip)
}

function PanelActionBack({
	label,
	onClick,
	testId,
}: Readonly<PanelActionVariantProps>) {
	return (
		<PanelAction
			icon={ArrowLeftIcon}
			label={label ?? "Go back"}
			onClick={onClick}
			testId={testId}
		/>
	)
}

function PanelActionExpand({
	label,
	onClick,
	testId,
}: Readonly<PanelActionVariantProps>) {
	return (
		<PanelAction
			icon={GrowDiagonalIcon}
			label={label ?? "Expand panel"}
			onClick={onClick}
			testId={testId}
		/>
	)
}

function PanelActionFilter({
	"aria-expanded": ariaExpanded,
	"aria-haspopup": ariaHaspopup,
	label,
	onClick,
	testId,
}: Readonly<PanelActionVariantProps>) {
	return (
		<PanelAction
			aria-expanded={ariaExpanded}
			aria-haspopup={ariaHaspopup}
			icon={FilterIcon}
			label={label ?? "Filter"}
			onClick={onClick}
			testId={testId}
		/>
	)
}

function PanelActionMore({
	label,
	onClick,
	testId,
}: Readonly<PanelActionVariantProps>) {
	return (
		<PanelAction
			aria-haspopup="menu"
			icon={ShowMoreHorizontalIcon}
			label={label ?? "More actions"}
			onClick={onClick}
			testId={testId}
		/>
	)
}

function PanelActionNewTab({
	href,
	label,
	onClick,
	testId,
}: Readonly<PanelActionNewTabProps>) {
	return (
		<PanelAction
			href={href}
			icon={LinkExternalIcon}
			label={label ?? "Open in new tab"}
			onClick={onClick}
			rel="noopener noreferrer"
			target="_blank"
			testId={testId}
		/>
	)
}

function PanelActionClose({
	label,
	onBeforeClose,
	onClick,
	testId,
}: Readonly<PanelActionCloseProps>) {
	async function handleClick(
		event: MouseEvent<HTMLButtonElement> | MouseEvent<HTMLAnchorElement>
	) {
		if (onBeforeClose) {
			const canClose = await onBeforeClose()
			if (!canClose) {
				return
			}
		}
		onClick?.(event)
	}

	return (
		<PanelAction
			appearance="subtle"
			icon={CrossIcon}
			label={label ?? "Close panel"}
			onClick={handleClick}
			testId={testId}
		/>
	)
}

const Panel = PanelContainer

export {
	Panel,
	PanelAction,
	PanelActionBack,
	PanelActionClose,
	PanelActionExpand,
	PanelActionFilter,
	PanelActionGroup,
	PanelActionMore,
	PanelActionNewTab,
	PanelBody,
	PanelContainer,
	PanelContent,
	PanelDisclaimer,
	PanelFooter,
	PanelHeader,
	PanelSubheader,
	PanelTitle,
	type PanelActionCloseProps,
	type PanelActionGroupProps,
	type PanelActionNewTabProps,
	type PanelActionProps,
	type PanelBodyProps,
	type PanelContainerProps,
	type PanelContentProps,
	type PanelDisclaimerProps,
	type PanelFooterProps,
	type PanelHeaderProps,
	type PanelSubheaderProps,
	type PanelTitleProps,
}
