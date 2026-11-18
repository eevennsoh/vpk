"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RovoChatProvider, useRovoChat } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import { ChatMessages } from "@/components/projects/shared/components/chat-messages";
import { getRovoAppShellLayout } from "@/components/projects/rovo-core/lib/rovo-app-shell-layout";
import { useBrowserWorkspace } from "@/components/website/demos/utils/hooks/use-browser-workspace";
import { BrowserPreviewPanel } from "@/components/website/demos/utils/components/browser-preview-panel";
import {
	PromptInput,
	PromptInputBody,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputFooter,
} from "@/components/ui-custom/prompt-input";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import GlobeIcon from "@atlaskit/icon/core/globe";
import { Footer } from "@/components/ui-custom/footer";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
	"Browse https://example.com and describe what you see",
	"Open https://news.ycombinator.com in a new tab and compare it with example.com",
	"Navigate to https://example.com and click the 'More information...' link",
]

const SPRING_TRANSITION = {
	type: "spring" as const,
	stiffness: 300,
	damping: 30,
}

function buildBrowserPromptOptions(workspaceId: string): SendPromptOptions {
	const helper = `node scripts/chromium-preview-agent.js --workspace ${workspaceId}`

	return {
		contextDescription: [
			"You are a browser automation assistant.",
			`Use the bash tool together with \`${helper}\`.`,
			"This helper controls the same embedded browser workspace shown in the preview pane.",
			"The agent always operates on the active tab in that workspace.",
			"Do NOT use browser_navigate, browser_snapshot, browser_take_screenshot, mcp_get_tool_schema, or other external browser MCP tools for normal browsing here.",
			"When the user asks you to browse a website, use this workflow:",
			`1. Open the URL in the active tab: \`${helper} open https://example.com\``,
			`2. Get interactive refs: \`${helper} snapshot -i\``,
			`3. Interact using refs from the snapshot: \`${helper} click-ref @e1\`, \`${helper} hover-ref @e2\`, \`${helper} fill-ref @e3 "text"\`, \`${helper} type-ref @e3 "text"\`, \`${helper} select-ref @e4 "value"\``,
			`4. Use keyboard and scrolling when needed: \`${helper} press Enter\`, \`${helper} type "hello"\`, \`${helper} scroll down 800\`, \`${helper} back\`, \`${helper} forward\`, \`${helper} reload\``,
			`5. Use workspace tab commands when the user wants multiple tabs: \`${helper} tab list\`, \`${helper} tab new https://example.com\`, \`${helper} tab switch 1\`, \`${helper} tab close 1\``,
			`6. Re-run \`${helper} snapshot -i\` after navigation, tab switches, or significant DOM changes`,
			"If the user asks you to click, type, select, scroll, or manage tabs, you must perform that exact interaction before you answer.",
			`If the user explicitly asks for a saved screenshot, use \`${helper} screenshot ./output/<name>.png\`.`,
			"Describe what you see as you go.",
			"If the user asks to interact with elements, use the accessibility refs from the active browser tab snapshot.",
		].join(" "),
	}
}

function AgentBrowserEmptyState({
	isWorkspaceReady,
}: Readonly<{
	isWorkspaceReady: boolean
}>) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
			<div
				className="bg-surface-raised flex items-center justify-center rounded-2xl"
				style={{ width: 56, height: 56 }}
			>
				<GlobeIcon label="" size="medium" color={token("color.icon.brand")} />
			</div>
			<div className="flex flex-col gap-1">
				<p className="text-text text-lg font-semibold">Agent Browser</p>
				<p className="text-text-subtlest max-w-md text-sm">
					{isWorkspaceReady
						? "Browse websites with AI assistance. The preview pane is bound to a dedicated browser workspace with real tabs and accessibility snapshots."
						: "Launching a dedicated browser workspace…"}
				</p>
			</div>
		</div>
	)
}

function AgentBrowserView() {
	const pathname = usePathname()
	const isPreviewRoute = pathname.startsWith("/preview/")

	const {
		uiMessages,
		sendPrompt,
		stopStreaming,
		resetChat,
		isStreaming,
		isSubmitPending,
	} = useRovoChat()
	const workspace = useBrowserWorkspace()
	const browserPromptOptions = useMemo(
		() =>
			workspace.workspaceId
				? buildBrowserPromptOptions(workspace.workspaceId)
				: null,
		[workspace.workspaceId],
	)

	const [prompt, setPrompt] = useState("")
	const [previewDismissed, setPreviewDismissed] = useState(false)
	const isSubmittingRef = useRef(false)
	const isRequestInFlight = isStreaming || isSubmitPending
	const isPreviewOpen = !previewDismissed
	const isWorkspaceReady = Boolean(workspace.workspaceId)

	const shellRef = useRef<HTMLDivElement | null>(null)
	const [shellWidth, setShellWidth] = useState(0)

	useEffect(() => {
		const shellElement = shellRef.current
		if (!shellElement || typeof ResizeObserver === "undefined") {
			return
		}

		const updateWidth = () => {
			setShellWidth(shellElement.clientWidth)
		}

		updateWidth()
		const observer = new ResizeObserver(() => {
			updateWidth()
		})
		observer.observe(shellElement)
		return () => observer.disconnect()
	}, [])

	const layout = getRovoAppShellLayout(shellWidth)
	const shouldSplit = isPreviewOpen && layout.mode === "split"

	const handleSubmit = useCallback(async () => {
		const trimmed = prompt.trim()
		if (
			!trimmed ||
			!browserPromptOptions ||
			isSubmittingRef.current
		) {
			return
		}

		isSubmittingRef.current = true
		setPrompt("")
		try {
			await sendPrompt(trimmed, browserPromptOptions)
		} finally {
			isSubmittingRef.current = false
		}
	}, [browserPromptOptions, prompt, sendPrompt])

	const handleSuggestionClick = useCallback(
		async (question: string) => {
			if (!browserPromptOptions || isSubmittingRef.current) {
				return
			}

			isSubmittingRef.current = true
			try {
				await sendPrompt(question, browserPromptOptions)
			} finally {
				isSubmittingRef.current = false
			}
		},
		[browserPromptOptions, sendPrompt],
	)

	const handleStop = useCallback(() => {
		void stopStreaming()
	}, [stopStreaming])

	useEffect(() => {
		return () => {
			void stopStreaming()
		}
	}, [stopStreaming])

	const handleNewSession = useCallback(() => {
		resetChat()
		setPrompt("")
		setPreviewDismissed(false)
		void workspace.resetWorkspace()
	}, [resetChat, workspace])

	const submitStatus = isStreaming
		? ("streaming" as const)
		: isSubmitPending
			? ("submitted" as const)
			: ("ready" as const)
	const isChatMode = uiMessages.length > 0

	return (
		<div
			ref={shellRef}
			className={cn(
				"relative flex w-full overflow-hidden bg-background",
				isPreviewRoute
					? "h-[calc(100svh-1px)]"
					: "h-[720px] min-h-[640px] max-h-[80dvh]",
			)}
		>
			<motion.div
				layout
				transition={SPRING_TRANSITION}
				style={
					shouldSplit
						? { width: `${layout.chatPaneWidth ?? shellWidth}px` }
						: undefined
				}
				className={cn(
					"relative z-10 flex min-w-0 flex-col bg-background",
					shouldSplit ? "w-full shrink-0 flex-none" : "flex-1",
				)}
			>
				<div
					className="border-border flex shrink-0 items-center justify-between border-b px-4"
					style={{ height: 56 }}
				>
					<div className="flex items-center gap-2">
						<GlobeIcon label="" size="small" color={token("color.icon.brand")} />
						<span className="text-text text-sm font-semibold">Agent Browser</span>
					</div>

					<div className="flex items-center gap-2">
						{!isPreviewOpen ? (
							<button
								type="button"
								onClick={() => setPreviewDismissed(false)}
								className="text-text-subtle hover:text-text border-border hover:bg-surface-raised rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
							>
								Preview
							</button>
						) : null}
						<button
							type="button"
							onClick={handleNewSession}
							disabled={isRequestInFlight}
							className="text-text-subtle hover:text-text border-border hover:bg-surface-raised rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
						>
							New session
						</button>
					</div>
				</div>

				{!isChatMode ? (
					<div className="flex flex-1 flex-col">
						<AgentBrowserEmptyState isWorkspaceReady={isWorkspaceReady} />
						<div className="flex flex-wrap justify-center gap-2 px-4 pb-4">
							{SUGGESTIONS.map((suggestion) => (
								<button
									key={suggestion}
									type="button"
									onClick={() => void handleSuggestionClick(suggestion)}
									disabled={!isWorkspaceReady}
									className="text-text-subtle bg-surface-raised border-border hover:bg-surface-raised-hovered rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
								>
									{suggestion}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="flex flex-1 flex-col items-center overflow-hidden">
						<div className="flex w-full max-w-[768px] flex-1 flex-col overflow-hidden">
							<ChatMessages
								defaultScrollPosition="last-anchor"
								uiMessages={uiMessages}
								onSuggestedQuestionClick={handleSuggestionClick}
								isStreaming={isStreaming}
								isSubmitPending={isSubmitPending}
								messageMode="ask"
								streamingIndicatorVariant="reasoning-expanded"
							/>
						</div>
					</div>
				)}

				<div className="mx-auto flex w-full max-w-[800px] shrink-0 flex-col gap-2 px-3 pb-3">
					<PromptInput onSubmit={handleSubmit}>
						<PromptInputBody>
							<PromptInputTextarea
								placeholder={
									isWorkspaceReady
										? "Enter a URL to browse or describe what you want to do…"
										: "Launching browser workspace…"
								}
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
							/>
						</PromptInputBody>
						<PromptInputFooter>
							<PromptInputSubmit
								aria-label="Submit"
								disabled={
									!isWorkspaceReady ||
									(!isRequestInFlight && !prompt.trim())
								}
								status={submitStatus}
								onStop={handleStop}
								size="icon-sm"
							>
								<ArrowUpIcon label="" />
							</PromptInputSubmit>
						</PromptInputFooter>
					</PromptInput>
					<Footer>
						Rovo Dev may produce inaccurate information
					</Footer>
				</div>
			</motion.div>

			<AnimatePresence>
				{isPreviewOpen ? (
					<motion.div
						animate={{
							opacity: 1,
							x: shouldSplit ? layout.artifactPaneX : 0,
							width: shouldSplit ? layout.artifactPaneWidth : shellWidth || "100%",
							height: "100%",
						}}
						className="absolute top-0 left-0 z-40 flex h-full flex-col overflow-hidden border-border bg-background md:border-l"
						exit={{
							opacity: 0,
							x: shellWidth,
							transition: {
								...SPRING_TRANSITION,
								stiffness: 600,
							},
						}}
						initial={{
							opacity: 0,
							x: shellWidth,
							width: shouldSplit ? layout.artifactPaneWidth : shellWidth || "100%",
							height: "100%",
						}}
						transition={SPRING_TRANSITION}
					>
						<BrowserPreviewPanel
							key={workspace.workspaceId ?? "browser-preview-panel"}
							workspace={workspace}
							onClose={() => setPreviewDismissed(true)}
						/>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}

export default function AgentBrowser() {
	return (
		<RovoChatProvider>
			<AgentBrowserView />
		</RovoChatProvider>
	)
}
