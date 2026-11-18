"use client"

import type { ComponentProps, ReactNode, RefObject } from "react"
import { createContext, use, useCallback, useEffect, useMemo, useRef } from "react"
import type { UIMessage } from "ai"
import { DownloadIcon } from "@/components/ui/vpk-icons"
import { Button } from "@/components/ui/button"
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerViewport,
	useMessageScroller,
	useMessageScrollerScrollable,
} from "@/components/ui/message-scroller"
import { StickyRowScrollFade } from "@/components/visual/scroll-mask"
import { cn } from "@/lib/utils"

type ScrollAnimation = boolean | ScrollBehavior | "instant" | {
	damping: number
	stiffness: number
	mass: number
}

export interface ScrollToBottomOptions {
	animation?: ScrollAnimation
	ignoreEscapes?: boolean
	target?: "bottom" | "follow"
}

export interface ConversationScrollTargetOptions {
	scrollElement: HTMLElement
}

export type ConversationFollowMode = "bottom" | "target"
export type GetTargetScrollTop = (
	defaultTargetTop: number,
	options: ConversationScrollTargetOptions
) => number

export interface ConversationContextValue {
	scrollRef: RefObject<HTMLDivElement | null>
	contentRef: RefObject<HTMLDivElement | null>
	isAtBottom: boolean
	showTopScrollMask: boolean
	showBottomScrollMask: boolean
	scrollToBottom: (options?: ScrollToBottomOptions) => Promise<void>
}

type ConversationElements = {
	setScrollElement: (element: HTMLDivElement | null) => void
	setContentElement: (element: HTMLDivElement | null) => void
}
const ConversationContext = createContext<ConversationContextValue | null>(null)
const ConversationElementsContext = createContext<ConversationElements | null>(null)

export function useConversationContext(): ConversationContextValue {
	const context = use(ConversationContext)
	if (!context) throw new Error("useConversationContext must be used within <Conversation>")
	return context
}

export interface ConversationProps extends ComponentProps<"div"> {
	contextRef?: { current: ConversationContextValue | null }
	followMode?: ConversationFollowMode
	initial?: ScrollAnimation
	resize?: ScrollAnimation
	resizeTarget?: ScrollToBottomOptions["target"]
	targetScrollTop?: GetTargetScrollTop
}

function ConversationBridge({
	children,
	contextRef,
	followMode,
	resize,
	resizeTarget,
	targetScrollTop,
}: Readonly<{
	children: ReactNode
	contextRef?: { current: ConversationContextValue | null }
	followMode?: ConversationFollowMode
	resize: ScrollAnimation
	resizeTarget: ScrollToBottomOptions["target"]
	targetScrollTop?: GetTargetScrollTop
}>) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const setScrollElement = useCallback((element: HTMLDivElement | null) => {
		scrollRef.current = element
	}, [])
	const setContentElement = useCallback((element: HTMLDivElement | null) => {
		contentRef.current = element
	}, [])
	const { scrollToEnd } = useMessageScroller()
	const scrollable = useMessageScrollerScrollable()
	const targetFollowPausedRef = useRef(false)
	const userScrollIntentRef = useRef(false)
	const scrollToBottom = useCallback(async (options?: ScrollToBottomOptions) => {
		if (options?.ignoreEscapes) {
			targetFollowPausedRef.current = false
			userScrollIntentRef.current = false
		}
		const animation = options?.animation
		const behavior = animation === false || animation === "instant"
			? "instant"
			: animation === "auto" ? "auto" : "smooth"
		const scrollElement = scrollRef.current
		if (scrollElement && options?.target !== "bottom" && targetScrollTop && (followMode ?? "target") === "target") {
			const bottom = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
			scrollElement.scrollTo({ top: Math.max(0, targetScrollTop(bottom, { scrollElement })), behavior })
			return
		}
		scrollToEnd({ behavior })
	}, [followMode, scrollToEnd, targetScrollTop])
	useEffect(() => {
		const viewport = scrollRef.current
		const content = contentRef.current
		if (!viewport || !content || !targetScrollTop || (followMode ?? "target") !== "target" || resize === false || resizeTarget === "bottom" || typeof ResizeObserver === "undefined") {
			return
		}
		const onIntent = () => { userScrollIntentRef.current = true }
		const onScroll = () => {
			if (!userScrollIntentRef.current) return
			targetFollowPausedRef.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 24
			userScrollIntentRef.current = false
		}
		viewport.addEventListener("wheel", onIntent, { passive: true })
		viewport.addEventListener("touchmove", onIntent, { passive: true })
		viewport.addEventListener("keydown", onIntent)
		viewport.addEventListener("scroll", onScroll, { passive: true })
		const observer = new ResizeObserver(() => {
			if (!targetFollowPausedRef.current) void scrollToBottom({ animation: resize, target: resizeTarget })
		})
		observer.observe(viewport)
		observer.observe(content)
		return () => {
			observer.disconnect()
			viewport.removeEventListener("wheel", onIntent)
			viewport.removeEventListener("touchmove", onIntent)
			viewport.removeEventListener("keydown", onIntent)
			viewport.removeEventListener("scroll", onScroll)
		}
	}, [followMode, resize, resizeTarget, scrollToBottom, targetScrollTop])
	const elements = useMemo(() => ({ setScrollElement, setContentElement }), [setContentElement, setScrollElement])
	const value = useMemo<ConversationContextValue>(() => ({
		scrollRef,
		contentRef,
		isAtBottom: !scrollable.end,
		showTopScrollMask: scrollable.start,
		showBottomScrollMask: scrollable.end,
		scrollToBottom,
	}), [scrollable.end, scrollable.start, scrollToBottom])
	useEffect(() => {
		if (contextRef) contextRef.current = value
		return () => {
			if (contextRef) contextRef.current = null
		}
	}, [contextRef, value])
	return (
		<ConversationContext value={value}>
			<ConversationElementsContext value={elements}>
				<StickyRowScrollFade className={cn("top-0 z-10", scrollable.start ? "opacity-100" : null)} data-slot="conversation-top-scroll-fade" />
				{children}
			</ConversationElementsContext>
		</ConversationContext>
	)
}

export function Conversation({
	children,
	className,
	contextRef,
	followMode,
	initial = "smooth",
	resize = "smooth",
	resizeTarget = "follow",
	targetScrollTop,
	...props
}: Readonly<ConversationProps>) {
	return (
		<MessageScroller
			autoScroll={resize !== false && !(targetScrollTop && (followMode ?? "target") === "target" && resizeTarget === "follow")}
			defaultScrollPosition={initial === false ? "start" : "end"}
			scrollEdgeThreshold={24}
			className={cn("min-h-0 min-w-0 flex-1", className)}
			{...props}
		>
			<ConversationBridge contextRef={contextRef} followMode={followMode} resize={resize} resizeTarget={resizeTarget} targetScrollTop={targetScrollTop}>
				{children}
			</ConversationBridge>
		</MessageScroller>
	)
}

export type ConversationContentProps = ComponentProps<"div"> & {
	reserveScrollbarGutter?: boolean
	revealScrollbarOnScroll?: boolean
}

export function ConversationContent({
	className,
	reserveScrollbarGutter = true,
	revealScrollbarOnScroll = true,
	...props
}: Readonly<ConversationContentProps>) {
	const context = use(ConversationContext)
	const elements = use(ConversationElementsContext)
	if (!context || !elements) throw new Error("ConversationContent must be used within <Conversation>")
	const setScrollElement = useCallback((element: HTMLDivElement | null) => elements.setScrollElement(element), [elements])
	const setContentElement = useCallback((element: HTMLDivElement | null) => elements.setContentElement(element), [elements])
	useEffect(() => {
		const el = context.scrollRef.current
		if (!el) return
		if (!revealScrollbarOnScroll) {
			el.removeAttribute("data-scrolling")
			return
		}
		let timeout: ReturnType<typeof setTimeout>
		function onScroll() {
			el!.setAttribute("data-scrolling", "")
			clearTimeout(timeout)
			timeout = setTimeout(() => el!.removeAttribute("data-scrolling"), 1000)
		}
		el.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			el.removeEventListener("scroll", onScroll)
			clearTimeout(timeout)
		}
	}, [context.scrollRef, revealScrollbarOnScroll])
	const maskImage = context.showBottomScrollMask ? "linear-gradient(to bottom, black 92%, transparent 100%)" : undefined
	return (
		<MessageScrollerViewport
			ref={setScrollElement}
			className="min-h-0 w-full flex-1 overflow-x-hidden scrollbar-auto-hide"
			style={{ maskImage, WebkitMaskImage: maskImage, scrollbarGutter: reserveScrollbarGutter ? undefined : "auto" }}
		>
			<MessageScrollerContent ref={setContentElement} className={cn("flex flex-col gap-8 p-4", className)} {...props} />
		</MessageScrollerViewport>
	)
}

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
	title?: string
	description?: string
	icon?: ReactNode
}

export function ConversationEmptyState({
	className,
	title = "No messages yet",
	description = "Start a conversation to see messages here",
	icon,
	children,
	...props
}: Readonly<ConversationEmptyStateProps>) {
	return (
		<div className={cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className)} {...props}>
			{children ?? (
				<>
					{icon ? <div className="text-muted-foreground">{icon}</div> : null}
					<div className="space-y-1">
						<h3 className="text-sm font-medium">{title}</h3>
						{description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
					</div>
				</>
			)}
		</div>
	)
}

export type ConversationScrollButtonProps = ComponentProps<typeof Button>

export function ConversationScrollButton({
	className,
	render,
	style,
	variant,
	size,
	shape,
	"aria-label": ariaLabel = "Scroll to bottom",
	...props
}: Readonly<ConversationScrollButtonProps>) {
	const customButton = render || typeof className === "function" || typeof style === "function"
		? <Button render={render} variant={variant ?? "ghost"} size={size ?? "icon"} shape={shape ?? "circle"} className={typeof className === "function" ? className : undefined} style={typeof style === "function" ? style : undefined} />
		: undefined
	return (
		<MessageScrollerButton
			aria-label={ariaLabel}
			className={typeof className === "string" ? className : undefined}
			style={typeof style === "function" ? undefined : style}
			variant={variant}
			size={size}
			shape={shape}
			render={customButton}
			{...props}
		/>
	)
}

export interface ConversationMessage {
	role: "user" | "assistant" | "system" | "data" | "tool"
	content: string
}

const getMessageText = (message: ConversationMessage | UIMessage): string => {
	if ("parts" in message && Array.isArray(message.parts)) {
		return message.parts
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text)
			.join("")
	}
	return (message as ConversationMessage).content
}

export type ConversationDownloadProps = Omit<
	ComponentProps<typeof Button>,
	"onClick"
> & {
	messages: ConversationMessage[] | UIMessage[]
	filename?: string
	formatMessage?: (message: ConversationMessage | UIMessage, index: number) => string
}

const defaultFormatMessage = (message: ConversationMessage | UIMessage): string => {
	const roleLabel =
		message.role.charAt(0).toUpperCase() + message.role.slice(1)
	return `**${roleLabel}:** ${getMessageText(message)}`
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const messagesToMarkdown = (
	messages: ConversationMessage[] | UIMessage[],
	formatMessage: (
		message: ConversationMessage | UIMessage,
		index: number
	) => string = defaultFormatMessage
): string => messages.map((msg, index) => formatMessage(msg, index)).join("\n\n")

export function ConversationDownload({
	messages,
	filename = "conversation.md",
	formatMessage = defaultFormatMessage,
	className,
	children,
	"aria-label": ariaLabel = "Download conversation",
	...props
}: Readonly<ConversationDownloadProps>) {
	const handleDownload = useCallback(() => {
		const markdown = messagesToMarkdown(messages, formatMessage)
		const blob = new Blob([markdown], { type: "text/markdown" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.href = url
		link.download = filename
		document.body.append(link)
		link.click()
		link.remove()
		URL.revokeObjectURL(url)
	}, [messages, filename, formatMessage])

	return (
		<Button
			aria-label={ariaLabel}
			className={cn("absolute top-4 right-4 rounded-full", className)}
			onClick={handleDownload}
			size="icon"
			type="button"
			variant="outline"
			{...props}
		>
			{children ?? <DownloadIcon className="size-4" />}
		</Button>
	)
}
