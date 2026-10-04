import { motion, useReducedMotion, type Variants } from "motion/react";

import { JiraSessionFlyoutBody } from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import type { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import {
	PanelActionClose,
	PanelActionGroup,
	PanelActionMore,
	PanelBody,
	PanelContainer,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@/components/ui/panel";
import { SidebarResizeHandle } from "@/components/ui/sidebar";
import { createAsxQueueSidebarSessionItem, type AsxQueueSession } from "../data/queue-sessions";
import { QueueDetailArtifacts } from "./queue-detail-artifacts";
import { motionEase } from "@/lib/motion";

const DETAIL_PREVIEW_POSITION = {
	align: "center",
	alignOffset: 0,
	side: "left",
} as const;

const PANEL_VARIANTS: Variants = {
	closed: {
		transform: "translateX(100%)",
		transition: { duration: 0.2, ease: motionEase.in }, // duration-medium + ease-in
	},
	open: {
		transform: "translateX(0%)",
		transition: { duration: 0.25, ease: motionEase.out }, // duration-slow + ease-out
	},
};

const REDUCED_MOTION_PANEL_VARIANTS: Variants = {
	closed: { transform: "translateX(0%)", transition: { duration: 0 } },
	open: { transform: "translateX(0%)", transition: { duration: 0 } },
};

interface QueueDetailPanelProps {
	onClose: () => void;
	resize: Pick<
		ReturnType<typeof useSidebarResize>,
		| "isResizing"
		| "maxWidth"
		| "minWidth"
		| "onResizeHandleDoubleClick"
		| "onResizeHandleKeyDown"
		| "onResizeHandlePointerDown"
		| "onResizeHandlePointerEnter"
		| "onResizeHandlePointerLeave"
		| "sidebarWidth"
	>;
	session: AsxQueueSession;
}

/**
 * The queue detail panel. Its session-info + Development block renders the exact
 * same `JiraSessionFlyoutBody` used by the sidebar hover flyout, so the two
 * surfaces share one implementation and cannot drift in content or layout. The
 * panel adds its own Sources and Output sections (which the compact flyout can't
 * show) below that shared body.
 */
export function QueueDetailPanel({ onClose, resize, session }: Readonly<QueueDetailPanelProps>) {
	const shouldReduceMotion = useReducedMotion();
	const sidebarSession = createAsxQueueSidebarSessionItem(session);

	return (
		<motion.div
			animate="open"
			className="absolute inset-y-0 right-0 z-20 h-full max-w-full shadow-overlay"
			exit="closed"
			initial="closed"
			style={{
				width: resize.sidebarWidth,
				willChange: shouldReduceMotion ? undefined : "transform",
			}}
			variants={shouldReduceMotion ? REDUCED_MOTION_PANEL_VARIANTS : PANEL_VARIANTS}
		>
			<PanelContainer
				aria-label="Details"
				className="h-full bg-surface"
				id="asx-queue-detail-panel"
			>
				<PanelHeader className="h-14 px-4 py-3">
					<PanelTitle>Details</PanelTitle>
					<PanelActionGroup>
						<PanelActionMore />
						<PanelActionClose label="Close detail panel" onClick={onClose} />
					</PanelActionGroup>
				</PanelHeader>

				<PanelContent>
					<PanelBody className="pb-4" spacing="none">
						<div className="px-4">
							<JiraSessionFlyoutBody
								hideHeader
								previewPosition={DETAIL_PREVIEW_POSITION}
								session={sidebarSession}
							/>
						</div>
						<QueueDetailArtifacts session={session} />
					</PanelBody>
				</PanelContent>
			</PanelContainer>
			<SidebarResizeHandle
				aria-label="Resize details panel"
				aria-orientation="vertical"
				aria-valuemax={resize.maxWidth}
				aria-valuemin={resize.minWidth}
				aria-valuenow={resize.sidebarWidth}
				className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				data-active={resize.isResizing ? "" : undefined}
				data-testid="asx-queue-detail-resize-handle"
				onDoubleClick={resize.onResizeHandleDoubleClick}
				onKeyDown={resize.onResizeHandleKeyDown}
				onPointerDown={resize.onResizeHandlePointerDown}
				onPointerEnter={resize.onResizeHandlePointerEnter}
				onPointerLeave={resize.onResizeHandlePointerLeave}
				role="separator"
				side="left"
				tabIndex={0}
			/>
		</motion.div>
	);
}
