"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

import { ExperimentalBreadcrumbActions } from "@/components/blocks/jira-work-item/experimental-v3/components/experimental-breadcrumb-actions";
import {
	ContextTitleBar,
	WorkItemKeyCopy,
} from "@/components/blocks/jira-work-item/experimental-v3/components/context-title-bar";
import { useWorkItemHeaderVariant } from "@/components/blocks/jira-work-item/experimental-v3/context-section-navigation";
import { ModalHeader } from "@/components/projects/jira/components/work-item-modal/modal-header";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

const HEADER_LAYOUT_TRANSITION = {
	duration: 0.2,
	ease: motionEase.inOut,
} as const; // duration-medium + ease-in-out

interface ExperimentalWorkItemDialogProps {
	inlineSurface: "card" | "card-fill" | "fill";
	open: boolean;
	onClose: () => void;
	presentation: "modal" | "inline";
	workItemCode: string;
	workItemTitle: string;
	children: ReactNode;
	/** Work-item control row, rendered under the title inside the header band. */
	controlRow?: (compact: boolean) => ReactNode;
	navigation?: ReactNode;
	blanketContent?: ReactNode;
	sidebar: ReactNode;
	sidebarOpen: boolean;
	sidebarResizeHandle?: ReactNode;
	sidebarResizing: boolean;
	sidebarWidth: number;
	onBodyWidthChange?: (width: number) => void;
}

export function ExperimentalWorkItemDialog({
	inlineSurface,
	open,
	onClose,
	presentation,
	workItemCode,
	workItemTitle,
	children,
	blanketContent,
	sidebar,
	sidebarOpen,
	sidebarResizeHandle,
	sidebarResizing,
	controlRow,
	navigation,
	sidebarWidth,
	onBodyWidthChange,
}: Readonly<ExperimentalWorkItemDialogProps>) {
	const dialogBodyRef = useRef<HTMLDivElement | null>(null);
	const headerContentRef = useRef<HTMLDivElement | null>(null);
	const [headerHeight, setHeaderHeight] = useState<number | null>(null);
	const shouldReduceMotion = useReducedMotion() ?? false;
	const headerVariant = useWorkItemHeaderVariant();
	const headerPositionLayout = shouldReduceMotion ? false : "position";
	const description = `Details, agent sessions, and activity for work item ${workItemCode}.`;
	const fillsInlineContainer = presentation === "inline" && inlineSurface !== "card";
	const isFlushInlineSurface = presentation === "inline" && inlineSurface === "fill";
	useEffect(() => {
		if (!open) {
			return;
		}

		document.documentElement.dataset.jiraWorkItemOpen = "true";
		return () => {
			delete document.documentElement.dataset.jiraWorkItemOpen;
		};
	}, [open]);
	// Metadata and embedded chat share this source of truth so resizing either
	// surface is immediately reflected when switching between them.
	const sidePanelStyle = {
		"--work-item-side-panel-width": `${sidebarWidth}px`,
	} as CSSProperties;
	useLayoutEffect(() => {
		const dialogBody = dialogBodyRef.current;
		if (!dialogBody || !onBodyWidthChange) {
			return;
		}

		const syncBodyWidth = () => onBodyWidthChange(dialogBody.clientWidth);
		syncBodyWidth();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const resizeObserver = new ResizeObserver(syncBodyWidth);
		resizeObserver.observe(dialogBody);
		return () => resizeObserver.disconnect();
	}, [onBodyWidthChange]);
	useLayoutEffect(() => {
		const headerContent = headerContentRef.current;
		if (!headerContent) {
			return;
		}

		const syncHeaderHeight = () => {
			const nextHeaderHeight = headerContent.offsetHeight;
			setHeaderHeight((currentHeaderHeight) =>
				currentHeaderHeight === nextHeaderHeight ? currentHeaderHeight : nextHeaderHeight,
			);
		};
		syncHeaderHeight();
		if (typeof ResizeObserver === "undefined") {
			return;
		}
		const resizeObserver = new ResizeObserver(syncHeaderHeight);
		resizeObserver.observe(headerContent);
		return () => resizeObserver.disconnect();
	}, [headerVariant]);
	const content = (
		<div
			ref={dialogBodyRef}
			className="@container/workitemdialog relative grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden"
			// Positioned ancestor for surfaces that must sit inside the dialog
			// rather than the viewport (e.g. the embedded Rovo launcher), which
			// resolve this node as their `offsetParent`.
			data-jira-work-item-dialog-body
			style={sidePanelStyle}
		>
			<div
				className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]"
				data-jira-work-item-main-column
				>
				{/* Header height drives the grid; keep the bottom composer out of this layout group. */}
				<LayoutGroup inherit={false}>
					<motion.div
						animate={headerHeight == null ? undefined : { height: headerHeight }}
						className={cn(
							sidebarResizing
								? "transition-none"
								: "transition-[margin-right] duration-medium ease-in-out motion-reduce:transition-none",
							sidebarOpen
								? "@[860px]/workitemdialog:mr-[var(--work-item-side-panel-width)]"
								: null,
						)}
						data-jira-work-item-header-column
						data-jira-work-item-header-band
						transition={{ height: shouldReduceMotion ? { duration: 0 } : HEADER_LAYOUT_TRANSITION }}
					>
						<div ref={headerContentRef} data-jira-work-item-header-content>
							<motion.div
								layout={headerPositionLayout}
								transition={{ layout: HEADER_LAYOUT_TRANSITION }}
							>
								<ModalHeader
									actions={<ExperimentalBreadcrumbActions />}
									actionsClassName="gap-1"
									breadcrumbLeadingContent={<WorkItemKeyCopy />}
									breadcrumbRevealOnHover
									closeButtonDisabled={presentation === "inline"}
									closeButtonVariant="ghost"
									paddingBottom={0}
									paddingTop={token("space.150")}
								/>
							</motion.div>
							<ContextTitleBar controlRow={controlRow} />
							{navigation ? (
								<motion.div
									layout={headerPositionLayout}
									transition={{ layout: HEADER_LAYOUT_TRANSITION }}
								>
									{navigation}
								</motion.div>
							) : null}
						</div>
					</motion.div>
				</LayoutGroup>
				<div style={{ minHeight: 0, minWidth: 0, display: "grid", overflow: "hidden" }}>
					{children}
				</div>
			</div>
			<div
				aria-hidden={!sidebarOpen}
				className={cn(
					"group/chat-panel absolute inset-y-0 right-0 z-30 w-full translate-x-full overflow-visible transition-transform duration-medium ease-in-out will-change-transform motion-reduce:transition-none @[860px]/workitemdialog:w-[var(--work-item-side-panel-width)]",
					sidebarOpen ? "translate-x-0" : "pointer-events-none",
				)}
				data-jira-work-item-chat-column
				inert={sidebarOpen ? undefined : true}
			>
				{sidebar}
				{sidebarOpen ? (
					<div className="hidden @[860px]/workitemdialog:contents">
						{sidebarResizeHandle}
					</div>
				) : null}
			</div>
		</div>
	);
	const surfaceStyle = {
		backgroundColor: token("elevation.surface.overlay"),
		borderRadius: isFlushInlineSurface ? 0 : token("radius.xlarge"),
		boxShadow: isFlushInlineSurface ? "none" : token("elevation.shadow.overlay"),
		display: "grid",
		gridTemplateColumns: "minmax(0, 1fr)",
		gridTemplateRows: "minmax(0, 1fr)",
		overflow: "hidden",
	} as const;

	if (presentation === "inline") {
		// Inline hosts can keep the existing content-height card, stretch that
		// modal-like card to the available height, or use a flush fill surface.
		return (
			<>
				<section
					aria-label={workItemTitle}
					className={cn(
						"max-h-full w-full max-w-none shrink-0 outline-none",
						fillsInlineContainer ? "h-full min-h-0 flex-1 shrink" : null,
					)}
					style={surfaceStyle}
				>
					{content}
					<p className="sr-only">{description}</p>
				</section>
				{open ? blanketContent : null}
			</>
		);
	}

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					onClose();
				}
			}}
			modal
		>
			<Dialog.Portal keepMounted>
				<Dialog.Backdrop className="bg-blanket fixed inset-0 z-[500] transition-[opacity] duration-slow ease-out motion-reduce:transition-none data-ending-style:duration-medium data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0" />
				<Dialog.Popup
					className={cn(
						// Match Rovo Canvas modal shell: even `inset-4` gutters on every side.
						"fixed inset-4 z-[501] h-auto w-auto max-w-none origin-center translate-x-0 translate-y-0 outline-none",
						"transition-[opacity,scale] duration-slow ease-in-out motion-reduce:transition-none",
						"data-ending-style:duration-medium data-ending-style:ease-in",
						"data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
					)}
					style={surfaceStyle}
				>
					{content}

					<Dialog.Title className="sr-only">{workItemTitle}</Dialog.Title>
					<Dialog.Description className="sr-only">{description}</Dialog.Description>
				</Dialog.Popup>
				{open ? blanketContent : null}
			</Dialog.Portal>
		</Dialog.Root>
	);
}
