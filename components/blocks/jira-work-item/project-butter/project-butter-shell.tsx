"use client";

import { useState, type ReactNode } from "react";
import ProductSidebar from "@/components/blocks/product-sidebar/page";
import TopNavigation from "@/components/blocks/top-navigation/page";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProjectButterSettings } from "@/components/blocks/jira-work-item/project-butter/project-butter-settings";
import { useProjectButterPanelResize } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-panel-resize";
import type {
	ProjectButterPresentation,
	ProjectButterShellContext,
} from "@/components/blocks/jira-work-item/project-butter/presentation";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export function ProjectButterShell({
	children,
	empty,
	onClose,
	onEmptyChange,
	onPresentationChange,
	onSuggestionChange = () => {},
	open,
	presentation,
	shell = "standalone",
	suggestion = false,
}: Readonly<{
	children: ReactNode;
	empty: boolean;
	onClose: () => void;
	onEmptyChange: (empty: boolean) => void;
	onPresentationChange: (presentation: ProjectButterPresentation) => void;
	onSuggestionChange?: (suggestion: boolean) => void;
	open: boolean;
	presentation: ProjectButterPresentation;
	shell?: ProjectButterShellContext;
	suggestion?: boolean;
}>) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const panelResize = useProjectButterPanelResize(open && presentation === "side-panel");
	const standalone = shell === "standalone";
	const surface = (
		<div
			aria-label="Project butter preview"
			className="relative flex min-h-0 min-w-0 flex-1 overflow-clip bg-surface"
			data-project-butter-presentation={presentation}
			role="region"
		>
			{!standalone || presentation === "full-screen" ? null : (
				<div aria-hidden className="absolute inset-0 bg-blanket" />
			)}
			<section
				aria-label={`Work item ${presentation === "full-screen" ? "full screen" : presentation === "side-panel" ? "side panel" : "modal"} view`}
				className={cn(
					"@container/butter relative z-10 flex min-h-0 min-w-0 flex-col overflow-clip bg-surface",
					!standalone || presentation === "full-screen"
						? "h-full w-full"
						: presentation === "modal"
							? "m-auto h-[calc(100%-4rem)] max-h-[960px] w-[calc(100%-4rem)] max-w-[1280px] rounded-xl"
							: "ml-auto h-full max-w-full",
				)}
				style={
					!standalone || presentation === "full-screen"
						? undefined
						: {
								boxShadow: token("elevation.shadow.overlay"),
								width: presentation === "side-panel" ? panelResize.width : undefined,
							}
				}
			>
				{presentation === "side-panel" ? (
					<div
						{...panelResize.separatorProps}
						aria-label="Resize work item side panel"
						aria-orientation="vertical"
						className="group absolute inset-y-0 left-0 z-20 flex w-3 cursor-col-resize touch-none select-none justify-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
						role="separator"
						tabIndex={0}
					>
						<span
							aria-hidden
							className="h-full w-0.5 bg-transparent transition-colors duration-normal ease-out-practical group-hover:bg-border-focused group-focus-visible:bg-border-focused group-data-[resizing=true]:bg-border-focused"
						/>
					</div>
				) : null}
				{children}
			</section>
		</div>
	);
	return (
		<Dialog
			onOpenChange={(nextOpen, details) => {
				if (
					details.reason === "escape-key" &&
					(details.event.defaultPrevented ||
						(details.event.target instanceof Element &&
							(details.event.target.closest(
								'[aria-roledescription="sortable"][aria-pressed="true"], [data-project-butter-detail-fields] input, [data-project-butter-detail-fields] textarea, [data-project-butter-detail-fields] [contenteditable]',
							) ||
								details.event.target.ownerDocument.querySelector(
									'[data-project-butter-field-dragging="true"]',
								))))
				) {
					details.cancel();
					return;
				}
				if (!nextOpen) onClose();
			}}
			open={open}
		>
			<DialogContent
				aria-modal="true"
				className={cn(
					"flex min-h-0 flex-col gap-0 overflow-clip p-0",
					standalone || presentation === "full-screen"
						? "left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
						: presentation === "modal"
							? "h-[calc(100dvh-4rem)] max-h-[960px] w-[calc(100vw-4rem)] max-w-[1280px] sm:max-w-[1280px]"
							: "left-auto right-0 top-0 h-dvh max-w-full translate-x-0 translate-y-0 rounded-none sm:max-w-none",
				)}
				style={
					!standalone && presentation === "side-panel" ? { width: panelResize.width } : undefined
				}
				onKeyDown={(event) => {
					if (
						event.target instanceof Element &&
						(event.target.closest('[aria-roledescription="sortable"][aria-pressed="true"]') ||
							event.currentTarget.querySelector('[data-project-butter-field-dragging="true"]'))
					)
						event.preventBaseUIHandler();
				}}
				showCloseButton={false}
				size="xl"
			>
				<DialogTitle className="sr-only">Project butter</DialogTitle>
				<DialogDescription className="sr-only">
					{standalone
						? "Explore the work item in full screen, a modal, or a side panel. Open Settings to change presentation, Empty, or Suggestion."
						: "View and edit this work item. Close the dialog to return to the board."}
				</DialogDescription>
				{standalone ? (
					<TopNavigation
						currentUser={{
							id: "butter-annie",
							name: "Annie Cook",
							avatarSrc: projectButterPersonAvatar("Annie Cook"),
							initials: "AC",
						}}
						hideRovoAction
						onSettingsClick={() => setSettingsOpen(true)}
						product="jira"
						shellHeight="parent"
						sidebar={(state) => (
							<ProductSidebar
								asChromeSlot
								headerOffsetPx={state.headerOffsetPx}
								isResizing={state.isResizing}
								product="jira"
								resizeHandle={state.resizeHandle}
								topOffset
							/>
						)}
					>
						{surface}
					</TopNavigation>
				) : (
					surface
				)}
				{standalone ? (
					<ProjectButterSettings
						empty={empty}
						onClose={() => setSettingsOpen(false)}
						onEmptyChange={onEmptyChange}
						onPresentationChange={onPresentationChange}
						onSuggestionChange={onSuggestionChange}
						open={settingsOpen}
						presentation={presentation}
						suggestion={suggestion}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
