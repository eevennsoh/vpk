"use client"

import * as React from "react"
import CopyIcon from "@atlaskit/icon/core/copy"
import EditIcon from "@atlaskit/icon/core/edit"
import RetryIcon from "@atlaskit/icon/core/retry"
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down"
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up"

import { Button, type ButtonProps } from "@/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type MessageGroupProps = React.ComponentProps<"div">

function MessageGroup({ className, ...props }: Readonly<MessageGroupProps>) {
	return (
		<div
			data-slot="message-group"
			className={cn("flex min-w-0 flex-col gap-2", className)}
			{...props}
		/>
	)
}

export interface MessageProps extends React.ComponentProps<"div"> {
	align?: "start" | "end"
}

function Message({
	className,
	align = "start",
	...props
}: Readonly<MessageProps>) {
	return (
		<div
			data-slot="message"
			data-align={align}
			className={cn(
				"group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
				className
			)}
			{...props}
		/>
	)
}

export type MessageAvatarProps = React.ComponentProps<"div">

function MessageAvatar({ className, ...props }: Readonly<MessageAvatarProps>) {
	return (
		<div
			data-slot="message-avatar"
			className={cn(
				"flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-bg-neutral text-text-subtle group-has-data-[slot=message-footer]/message:-translate-y-8",
				className
			)}
			{...props}
		/>
	)
}

export type MessageContentProps = React.ComponentProps<"div">

function MessageContent({ className, ...props }: Readonly<MessageContentProps>) {
	return (
		<div
			data-slot="message-content"
			className={cn(
				"flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
				className
			)}
			{...props}
		/>
	)
}

export type MessageHeaderProps = React.ComponentProps<"div">

function MessageHeader({ className, ...props }: Readonly<MessageHeaderProps>) {
	return (
		<div
			data-slot="message-header"
			className={cn(
				"flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-text-subtlest group-has-data-[variant=ghost]/message:px-0",
				className
			)}
			{...props}
		/>
	)
}

export type MessageFooterProps = React.ComponentProps<"div">

function MessageFooter({ className, ...props }: Readonly<MessageFooterProps>) {
	return (
		<div
			data-slot="message-footer"
			className={cn(
				"flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-text-subtlest group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
				className
			)}
			{...props}
		/>
	)
}

export interface MessageActionsProps extends MessageFooterProps {
	/** `hover` hides the row on md+ screens until the message is hovered or an action has focus. */
	reveal?: "hover" | "always"
}

function MessageActions({
	className,
	reveal = "always",
	...props
}: Readonly<MessageActionsProps>) {
	return (
		<MessageFooter
			data-reveal={reveal}
			className={cn(
				"gap-1 px-0",
				reveal === "hover" &&
					"transition-opacity md:pointer-events-none md:opacity-0 md:group-hover/message:pointer-events-auto md:group-hover/message:opacity-100 md:focus-within:pointer-events-auto md:focus-within:opacity-100",
				className
			)}
			{...props}
		/>
	)
}

export interface MessageActionProps extends ButtonProps {
	/** Accessible name; also the tooltip text unless `tooltip` is set. */
	label?: string
	tooltip?: string
}

function MessageAction({
	label,
	tooltip,
	variant = "ghost",
	size = "icon",
	...props
}: Readonly<MessageActionProps>) {
	const button = (
		<Button
			data-slot="message-action"
			type="button"
			variant={variant}
			size={size}
			aria-label={label ?? tooltip}
			{...props}
		/>
	)
	const tooltipText = tooltip ?? label

	if (!tooltipText) {
		return button
	}

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent>
				<p>{tooltipText}</p>
			</TooltipContent>
		</Tooltip>
	)
}

export interface MessageCopyActionProps
	extends Omit<MessageActionProps, "children"> {
	text: string
}

function MessageCopyAction({ text, ...props }: Readonly<MessageCopyActionProps>) {
	return (
		<MessageAction
			tooltip="Copy"
			onClick={() => void navigator.clipboard.writeText(text)}
			{...props}
		>
			<CopyIcon label="" size="small" />
		</MessageAction>
	)
}

export type MessageEditActionProps = Omit<MessageActionProps, "children">

function MessageEditAction(props: Readonly<MessageEditActionProps>) {
	return (
		<MessageAction tooltip="Edit" {...props}>
			<EditIcon label="" size="small" />
		</MessageAction>
	)
}

export type MessageVote = "up" | "down"

export interface MessageVoteActionsProps {
	value?: MessageVote | null
	onVote: (value: MessageVote | null) => void
}

function MessageVoteActions({ value, onVote }: Readonly<MessageVoteActionsProps>) {
	return (
		<>
			<MessageAction
				aria-pressed={value === "up"}
				selectedAppearance="icon-only"
				className="aria-pressed:[&_svg]:text-icon-success"
				onClick={() => onVote(value === "up" ? null : "up")}
				tooltip="Like"
			>
				<ThumbsUpIcon label="" size="small" />
			</MessageAction>
			<MessageAction
				aria-pressed={value === "down"}
				selectedAppearance="icon-only"
				className="aria-pressed:[&_svg]:text-icon-danger"
				onClick={() => onVote(value === "down" ? null : "down")}
				tooltip="Dislike"
			>
				<ThumbsDownIcon label="" size="small" />
			</MessageAction>
		</>
	)
}

export type MessageRegenerateActionProps = Omit<MessageActionProps, "children">

function MessageRegenerateAction(props: Readonly<MessageRegenerateActionProps>) {
	return (
		<MessageAction tooltip="Regenerate" {...props}>
			<RetryIcon label="" size="small" />
		</MessageAction>
	)
}

export {
	MessageGroup,
	Message,
	MessageAvatar,
	MessageContent,
	MessageFooter,
	MessageHeader,
	MessageActions,
	MessageAction,
	MessageCopyAction,
	MessageEditAction,
	MessageVoteActions,
	MessageRegenerateAction,
}
