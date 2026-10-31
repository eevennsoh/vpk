"use client";

import { useState, type ReactNode } from "react";
import ProductSidebar from "@/components/blocks/product-sidebar/page";
import TopNavigation from "@/components/blocks/top-navigation/page";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProjectButterSettings } from "@/components/blocks/jira-work-item/project-butter/project-butter-settings";
import type { ProjectButterPresentation } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export function ProjectButterShell({ children, empty, onClose, onEmptyChange, onPresentationChange, open, presentation }: Readonly<{
	children: ReactNode;
	empty: boolean;
	onClose: () => void;
	onEmptyChange: (empty: boolean) => void;
	onPresentationChange: (presentation: ProjectButterPresentation) => void;
	open: boolean;
	presentation: ProjectButterPresentation;
}>) {
	const [settingsOpen, setSettingsOpen] = useState(false);
	return (
		<Dialog onOpenChange={(nextOpen, details) => {
			if (details.reason === "escape-key" && details.event.target instanceof Element && details.event.target.closest('[aria-roledescription="sortable"][aria-pressed="true"]')) {
				details.cancel();
				return;
			}
			if (!nextOpen) onClose();
		}} open={open}>
			<DialogContent className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-none" onKeyDown={(event) => {
				if (event.target instanceof Element && event.target.closest('[aria-roledescription="sortable"][aria-pressed="true"]')) event.preventBaseUIHandler();
			}} showCloseButton={false} size="xl">
				<DialogTitle className="sr-only">Project butter</DialogTitle>
				<DialogDescription className="sr-only">Explore the work item in full screen, a modal, or a side panel. Open Settings to change presentation or toggle Empty.</DialogDescription>
				<TopNavigation
					currentUser={{ id: "butter-annie", name: "Annie Cook", avatarSrc: projectButterPersonAvatar("Annie Cook"), initials: "AC" }}
					hideRovoAction
					onSettingsClick={() => setSettingsOpen(true)}
					product="jira"
					shellHeight="parent"
					sidebar={(state) => <ProductSidebar asChromeSlot headerOffsetPx={state.headerOffsetPx} isResizing={state.isResizing} product="jira" resizeHandle={state.resizeHandle} topOffset />}
				>
					<div aria-label="Project butter preview" className="relative flex min-h-0 min-w-0 flex-1 overflow-clip bg-surface" data-project-butter-presentation={presentation} role="region">
						{presentation === "full-screen" ? null : <div aria-hidden className="absolute inset-0 bg-blanket" />}
						<section
							aria-label={`Work item ${presentation === "full-screen" ? "full screen" : presentation === "side-panel" ? "side panel" : "modal"} view`}
							className={cn(
								"@container/butter relative z-10 flex min-h-0 min-w-0 flex-col overflow-clip bg-surface",
								presentation === "full-screen" ? "h-full w-full" : presentation === "modal"
									? "m-auto h-[calc(100%-4rem)] max-h-[960px] w-[calc(100%-4rem)] max-w-[1280px] rounded-xl"
									: "ml-auto h-full w-[440px] max-w-full",
							)}
							style={presentation === "full-screen" ? undefined : { boxShadow: token("elevation.shadow.overlay") }}
						>
							{children}
						</section>
					</div>
				</TopNavigation>
				<ProjectButterSettings empty={empty} onClose={() => setSettingsOpen(false)} onEmptyChange={onEmptyChange} onPresentationChange={onPresentationChange} open={settingsOpen} presentation={presentation} />
			</DialogContent>
		</Dialog>
	);
}
