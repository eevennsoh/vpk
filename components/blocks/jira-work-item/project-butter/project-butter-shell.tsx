"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import TaskIcon from "@atlaskit/icon/core/task";
import ProductSidebar from "@/components/blocks/product-sidebar/page";
import TopNavigation from "@/components/blocks/top-navigation/page";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PanelActionClose, PanelActionExpand, PanelActionGroup, PanelContainer, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ProjectButterSettings } from "@/components/blocks/jira-work-item/project-butter/project-butter-settings";
import { useProjectButterPanelResize } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-panel-resize";
import type {
	ProjectButterPresentation,
	ProjectButterShellContext,
} from "@/components/blocks/jira-work-item/project-butter/presentation";
import { PROJECT_BUTTER_CONTENT_WIDTH, PROJECT_BUTTER_MODAL_SIZE } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export function ProjectButterShell({
	chatPanel,
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
	overlayContainerRef,
	toastSlot,
}: Readonly<{
	/** Host-owned sidebar chat beside the standalone work item; also shows the Ask Rovo pill that opens it. */
	chatPanel?: ReactNode;
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
	overlayContainerRef?: (element: HTMLDivElement | null) => void;
	toastSlot?: ReactNode;
}>) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const panelResize = useProjectButterPanelResize(open && presentation === "side-panel");
	const standalone = shell === "standalone";
	const sectionLabel = `Work item ${presentation === "full-screen" ? "full screen" : presentation === "side-panel" ? "side panel" : "modal"} view`;
	const frameClassName = cn(
		"@container/butter relative z-10 flex min-h-0 min-w-0 flex-col overflow-clip bg-surface",
		!standalone || presentation === "full-screen"
			? "h-full w-full"
			: presentation === "modal"
				? "m-auto h-[calc(100%-4rem)] max-h-[960px] w-[calc(100%-4rem)] max-w-[1280px] rounded-xl"
				: "ml-auto h-full max-w-full",
		shell === "project" && presentation === "full-screen" && cn("mx-auto", PROJECT_BUTTER_CONTENT_WIDTH),
	);
	const frameStyle =
		!standalone || presentation === "full-screen"
			? undefined
			: {
					boxShadow: token("elevation.shadow.overlay"),
					width: presentation === "side-panel" ? panelResize.width : undefined,
				};
	const surface = (
		<div
			aria-label="Project butter preview"
			className="relative flex min-h-0 min-w-0 flex-1 overflow-clip rounded-[inherit] bg-surface"
			data-project-butter-presentation={presentation}
			role="region"
		>
			{!standalone || presentation === "full-screen" ? null : (
				<div aria-hidden className="absolute inset-0 bg-blanket" />
			)}
			{presentation === "side-panel" ? (
				<div className={frameClassName} style={frameStyle}>
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
					<PanelContainer aria-label={sectionLabel}>
						<PanelHeader>
							<PanelTitle icon={<TaskIcon label="" />}>Jira work item</PanelTitle>
							<PanelActionGroup>
								<PanelActionExpand label="Expand work item" onClick={() => onPresentationChange("modal")} />
								<PanelActionClose label="Close Project butter work item" onClick={onClose} />
							</PanelActionGroup>
						</PanelHeader>
						{children}
					</PanelContainer>
				</div>
			) : (
				<section aria-label={sectionLabel} className={frameClassName} style={frameStyle}>
					{children}
				</section>
			)}
		</div>
	);
	if (shell === "gallery") return <>{surface}{typeof document !== "undefined" ? createPortal(toastSlot, document.body) : null}</>;
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
				ref={overlayContainerRef}
				aria-modal="true"
				initialFocus={titleRef}
				className={cn(
					"flex min-h-0 flex-col gap-0 p-0",
					overlayContainerRef ? "overflow-visible" : "overflow-clip",
					standalone || presentation === "full-screen"
						? "left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none"
						: presentation === "modal"
							? cn(PROJECT_BUTTER_MODAL_SIZE, "sm:max-w-[1280px]")
							: "left-auto right-0 top-0 h-dvh max-w-full translate-x-0 translate-y-0 rounded-none sm:max-w-none",
					overlayContainerRef ? cn(
						"translate-none data-starting-style:scale-none data-ending-style:scale-none",
						presentation === "modal" && !standalone ? "inset-0 m-auto" : null,
					) : null,
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
				<DialogTitle ref={titleRef} className="sr-only" tabIndex={-1}>Project butter</DialogTitle>
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
						hideRovoAction={!chatPanel}
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
						{chatPanel ? (
							// Stands in for the surface as the nav body's flex child, so the work item keeps a bounded height and scrolls.
							<div className="relative flex min-h-0 min-w-0 flex-1">
								<div className="flex min-h-0 min-w-0 flex-1">{surface}</div>
								{chatPanel}
							</div>
						) : surface}
					</TopNavigation>
				) : (
					surface
				)}
				{toastSlot}
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
