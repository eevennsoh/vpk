"use client";

// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.

import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { token } from "@/lib/tokens";
import TopNavigation from "@/components/blocks/top-navigation/page";
import Sidebar from "@/components/blocks/product-sidebar/page";
import FloatingRovoButton from "@/components/projects/shared/components/floating-rovo-button";
import type {
	FloatingRovoButtonOnboardingConfig,
	FloatingRovoButtonSuggestion,
} from "@/components/projects/shared/components/floating-rovo-button";
import ChatPanel from "@/components/projects/sidebar-chat/page";
import { MountOnFirstUse } from "@/components/projects/shared/components/mount-on-first-use";
import type { ChatPanelCustomAgentTabs, ChatPanelGreetingProps } from "@/components/projects/sidebar-chat/page";
import RovoFloatingChat from "@/components/projects/rovo-floating-chat/components/rovo-floating-chat";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import type { ChatSurfaceSwitchHandler } from "@/components/projects/shared/components/chat-surface-switcher";
import { SidebarResizeHandle } from "@/components/ui/sidebar";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import type { DesignVariantId } from "@/components/utils/design-variants";

type Product = "admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio";

interface AppLayoutProps {
	product: Product;
	children: React.ReactNode;
	defaultSidebarOpen?: boolean;
	sidebarContent?: React.ReactNode;
	topNavigationSearchAlignment?: "responsive" | "sidebar";
	shellHeight?: "viewport" | "parent";
	embedded?: boolean;
	embeddedHeight?: "parent" | "viewport";
	hideFloatingRovo?: boolean;
	hideRovoAction?: boolean;
	settingsDesignVariantIds?: readonly DesignVariantId[];
	settingsIconOnly?: boolean;
	onChatSurfaceSwitch?: ChatSurfaceSwitchHandler;
	chatContextBar?: ChatContextBarDescriptor | null;
	chatGreeting?: ChatPanelGreetingProps;
	customAgentTabs?: ChatPanelCustomAgentTabs;
	rovoButtonSuggestion?: FloatingRovoButtonSuggestion | null;
	rovoButtonOnboarding?: FloatingRovoButtonOnboardingConfig | null;
	onArtifactDialogOpen?: () => void;
	preserveFloatingSurfaceOnArtifactDialogOpen?: boolean;
	/**
	 * When true, render the sidebar chat flush against the surrounding shell:
	 * no outer padding, no border radius, and only a single dividing border on
	 * the left edge. Used by routes where the chat butts up against the top
	 * nav and viewport edges (e.g. /agents, /jira).
	 */
	chatPanelFlush?: boolean;
	/** Defer unused chat; retain its draft and exit transition after first use. */
	sidebarChatMount?: "eager" | "on-first-open";
}

/**
 * Detect iframe context so generated apps rendered inside the artifact
 * panel's iframe automatically hide all shell chrome (TopNavigation,
 * Sidebar, FloatingRovoButton, RovoChatPanel).
 *
 * Defers the browser-only check to an effect so the first client render
 * matches the server render (both return false), avoiding hydration mismatch.
 */
function useIsEmbedded(explicit: boolean): boolean {
	const [auto, setAuto] = useState(false);
	useEffect(() => {
		let timeout: ReturnType<typeof setTimeout> | null = null;
		let nextAuto = false;
		if (document.documentElement.dataset.embedded !== undefined) {
			nextAuto = true;
		} else {
			try {
				nextAuto = window.self !== window.top;
			} catch {
				nextAuto = true; // cross-origin iframe
			}
		}

		if (!nextAuto) {
			return;
		}

		let cancelled = false;
		const syncEmbeddedState = () => {
			if (!cancelled) {
				setAuto(true);
			}
		};

		if (typeof queueMicrotask === "function") {
			queueMicrotask(syncEmbeddedState);
		} else {
			timeout = setTimeout(syncEmbeddedState, 0);
		}

		return () => {
			cancelled = true;
			if (timeout !== null) {
				clearTimeout(timeout);
			}
		};
	}, []);
	return explicit || auto;
}

function useIsRovoCanvasOpen(): boolean {
	const [isRovoCanvasOpen, setIsRovoCanvasOpen] = useState(false);

	useEffect(() => {
		const updateRovoCanvasOpen = () => {
			setIsRovoCanvasOpen(document.documentElement.dataset.rovoCanvasOpen === "true");
		};

		updateRovoCanvasOpen();

		if (typeof MutationObserver !== "function") {
			return;
		}

		const observer = new MutationObserver(updateRovoCanvasOpen);
		observer.observe(document.documentElement, {
			attributeFilter: ["data-rovo-canvas-open"],
			attributes: true,
		});

		return () => observer.disconnect();
	}, []);

	return isRovoCanvasOpen;
}

export default function AppLayout({
	product,
	children,
	defaultSidebarOpen = true,
	sidebarContent,
	topNavigationSearchAlignment = "responsive",
	shellHeight = "viewport",
	embedded = false,
	embeddedHeight = "viewport",
	hideFloatingRovo,
	hideRovoAction = false,
	settingsDesignVariantIds,
	settingsIconOnly = false,
	onChatSurfaceSwitch,
	chatContextBar,
	chatGreeting,
	customAgentTabs,
	rovoButtonSuggestion,
	rovoButtonOnboarding,
	onArtifactDialogOpen,
	preserveFloatingSurfaceOnArtifactDialogOpen = false,
	chatPanelFlush = false,
	sidebarChatMount = "eager",
}: Readonly<AppLayoutProps>) {
	const isEmbedded = useIsEmbedded(embedded);
	const isRovoCanvasOpen = useIsRovoCanvasOpen();
	const { chatSurface, toggleChat } = useRovoChatControls();
	const chatResize = useSidebarResize({
		defaultWidth: 400,
		minWidth: 320,
		maxWidth: 720,
		direction: "rtl",
	});
	const chatPanelWidth = chatResize.sidebarWidth;
	const shouldHideRovoAction = hideRovoAction || isRovoCanvasOpen;
	const isSidebarChatActive = chatSurface === "sidebar";
	const isFloatingChatActive = chatSurface === "floating";
	const showChatPanel = !isEmbedded && !shouldHideRovoAction && isSidebarChatActive;
	const showFloatingChat = !isEmbedded && !hideFloatingRovo && !shouldHideRovoAction && isFloatingChatActive;
	const showFloatingRovoButton = !isEmbedded && !hideFloatingRovo && !shouldHideRovoAction;
	const embeddedShellHeight = embeddedHeight === "parent" ? "100%" : "100dvh";
	// Embedded mode styles (fallback when not using the TopNavigation shell)
	const shellStyle = {
		minHeight: isEmbedded ? embeddedShellHeight : "100vh",
		height: isEmbedded ? embeddedShellHeight : "100vh",
		backgroundColor: token("color.background.neutral.subtle"),
		overflow: "hidden",
	} as React.CSSProperties;

	// Main content area with chat panel and floating elements
	const mainContent = (
		<>
			{/* Main Content Area */}
			<div
				style={{
					marginRight: showChatPanel ? `${chatPanelWidth}px` : "0px",
					transition: isEmbedded || chatResize.isResizing
						? undefined
						: "margin-right var(--duration-medium) var(--ease-in-out)",
					flex: 1,
					height: isEmbedded ? "100%" : undefined,
					overflow: "auto",
				}}
			>
				{children}
			</div>

			{/* In-situ Rovo Chat Panel */}
			{!isEmbedded && !shouldHideRovoAction ? (
				<div
					data-shell-chrome=""
					aria-hidden={!isSidebarChatActive}
					{...(!isSidebarChatActive ? { inert: true } : {})}
					style={{
						position: "absolute",
						top: 0,
						right: 0,
						bottom: 0,
						width: `${chatPanelWidth}px`,
						padding: chatPanelFlush ? 0 : token("space.100"),
						pointerEvents: isSidebarChatActive ? "auto" : "none",
						transform: isSidebarChatActive ? "translateX(0)" : `translateX(${chatPanelWidth}px)`,
						transition: chatResize.isResizing ? undefined : "transform var(--duration-medium) var(--ease-in-out)",
						willChange: "transform",
						zIndex: 90,
					}}
				>
					<MountOnFirstUse active={sidebarChatMount === "eager" || isSidebarChatActive}>
						<ChatPanel
							onClose={toggleChat}
							abortOnUnmount={false}
							onSurfaceSwitch={onChatSurfaceSwitch}
							chatContextBar={chatContextBar}
							greeting={chatGreeting}
							customAgentTabs={customAgentTabs}
							onArtifactDialogOpen={onArtifactDialogOpen}
							preserveFloatingSurfaceOnArtifactDialogOpen={preserveFloatingSurfaceOnArtifactDialogOpen}
							containerStyle={
								chatPanelFlush
									? {
											borderRadius: 0,
											borderWidth: 0,
										}
									: undefined
							}
						/>
					</MountOnFirstUse>
					<SidebarResizeHandle
						side="left"
						data-active={chatResize.isResizing ? "" : undefined}
						onDoubleClick={chatResize.onResizeHandleDoubleClick}
						onPointerDown={chatResize.onResizeHandlePointerDown}
						onPointerEnter={chatResize.onResizeHandlePointerEnter}
						onPointerLeave={chatResize.onResizeHandlePointerLeave}
					/>
				</div>
			) : null}

			{/* Floating Rovo Chat (anchored bottom-right) */}
			<AnimatePresence>
				{showFloatingChat ? (
					<RovoFloatingChat
						key="floating-chat"
						onSurfaceSwitch={onChatSurfaceSwitch}
						chatContextBar={chatContextBar}
						greeting={chatGreeting}
						customAgentTabs={customAgentTabs}
						onArtifactDialogOpen={onArtifactDialogOpen}
						preserveFloatingSurfaceOnArtifactDialogOpen={preserveFloatingSurfaceOnArtifactDialogOpen}
					/>
				) : null}
			</AnimatePresence>

			{/* Floating Rovo Button */}
			<div data-shell-chrome="">
				<AnimatePresence>
					{showFloatingRovoButton ? (
						<FloatingRovoButton
							key="floating-rovo-button"
							product={product}
							embedded={isEmbedded}
							suggestion={rovoButtonSuggestion}
							onboarding={rovoButtonOnboarding}
						/>
					) : null}
				</AnimatePresence>
			</div>
		</>
	);

	// When embedded, render without the TopNavigation shell
	if (isEmbedded) {
		return (
			<div style={shellStyle}>
				{mainContent}
			</div>
		);
	}

	// Use the canonical TopNavigation shell variant
	return (
		<TopNavigation
			defaultSidebarOpen={defaultSidebarOpen}
			product={product}
			shellHeight={shellHeight}
			searchAlignment={topNavigationSearchAlignment}
			variant="shell"
			hideRovoAction={shouldHideRovoAction}
			settingsDesignVariantIds={settingsDesignVariantIds}
			settingsIconOnly={settingsIconOnly}
			sidebar={(slot) => (
				<Sidebar
					product={product}
					content={sidebarContent}
					asChromeSlot
					resizeHandle={slot.resizeHandle}
					isResizing={slot.isResizing}
					headerOffsetPx={slot.headerOffsetPx}
					topOffset
				/>
			)}
		>
			<div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
				{mainContent}
			</div>
		</TopNavigation>
	);
}
