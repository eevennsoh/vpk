"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "motion/react";

import {
	AgentList,
	type AgentListItem,
} from "@/components/blocks/agent-list";
import type { JiraSidebarSessionStatus } from "@/components/blocks/product-sidebar/variants/jira";
import { JiraSessionFlyoutBody, JiraSessionSectionHeading } from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { SmartLink } from "@/components/blocks/smart-link/components/smart-link";
import { AttachmentPreviewCard } from "@/components/ui-custom/attachment-preview-card";
import { FileChartColumnIcon, FileIcon } from "@/components/ui/vpk-icons";
import type { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import {
	PanelActionClose,
	PanelActionGroup,
	PanelBody,
	PanelContainer,
	PanelContent,
	PanelHeader,
	PanelTitle,
} from "@/components/ui/panel";
import { SidebarResizeHandle } from "@/components/ui/sidebar";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { JiraForYouItem } from "./jira-for-you-types";
import type {
	JiraForYouWorkspaceAgentSession,
	JiraForYouWorkspaceItemDetails,
} from "./jira-for-you-workspace-types";
import { motionEase } from "@/lib/motion";

const DETAIL_PREVIEW_POSITION = {
	align: "center",
	alignOffset: 0,
	side: "left",
} as const;

const DESKTOP_PANEL_VARIANTS: Variants = {
	closed: {
		transform: "translateX(100%)",
		transition: { duration: 0.2, ease: motionEase.in },
	},
	open: {
		transform: "translateX(0%)",
		transition: { duration: 0.25, ease: motionEase.out },
	},
};

const MOBILE_PANEL_VARIANTS: Variants = {
	closed: {
		opacity: 0,
		transform: "translateY(12px)",
		transition: { duration: 0.18, ease: motionEase.in },
	},
	open: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: { duration: 0.22, ease: motionEase.out },
	},
};

const REDUCED_MOTION_PANEL_VARIANTS: Variants = {
	closed: { opacity: 1, transform: "translateX(0%)", transition: { duration: 0 } },
	open: { opacity: 1, transform: "translateX(0%)", transition: { duration: 0 } },
};

function toAgentSessionState(
	status: JiraSidebarSessionStatus,
): AgentListItem["state"] {
	switch (status) {
		case "awaiting-input":
			return "needs-input";
		case "running":
			return "running";
		case "pr-open":
		case "merged":
		case "stopped":
			return "complete";
		default: {
			const exhaustiveStatus: never = status;
			return exhaustiveStatus;
		}
	}
}

function toAgentSessionPrStatus(
	status: JiraSidebarSessionStatus,
): AgentListItem["prStatus"] {
	switch (status) {
		case "pr-open":
			return "created";
		case "merged":
			return "merged";
		case "awaiting-input":
		case "running":
		case "stopped":
			return undefined;
		default: {
			const exhaustiveStatus: never = status;
			return exhaustiveStatus;
		}
	}
}

function isSpreadsheet(title: string): boolean {
	return /\.xlsx$/iu.test(title);
}

function getPanelVariants(
	isNarrow: boolean,
	shouldReduceMotion: boolean | null,
): Variants {
	if (shouldReduceMotion) {
		return REDUCED_MOTION_PANEL_VARIANTS;
	}

	if (isNarrow) {
		return MOBILE_PANEL_VARIANTS;
	}

	return DESKTOP_PANEL_VARIANTS;
}

function AgentSection({
	agentSessions,
	branch,
	onAgentPrompt,
	onAgentSelect,
	selectedAgentId,
}: Readonly<{
	agentSessions: readonly JiraForYouWorkspaceAgentSession[];
	branch: string;
	onAgentPrompt: (agentId: string, prompt: string) => void;
	onAgentSelect: (agentId: string) => void;
	selectedAgentId: string;
}>) {
	const sessionItems: readonly AgentListItem[] = agentSessions.map(
		(agentSession) => ({
			agent: {
				avatarSrc: agentSession.profile.avatarSrc,
				id: agentSession.profile.id,
				name: agentSession.profile.name,
			},
			branch,
			id: agentSession.id,
			prStatus: toAgentSessionPrStatus(agentSession.status),
			state: toAgentSessionState(agentSession.status),
			title: agentSession.activityTitle,
		}),
	);

	return (
		<section
			aria-labelledby="jira-for-you-agents-heading"
			className="flex flex-col gap-2 px-4 pt-4"
			data-testid="jira-for-you-agent-section"
		>
			<JiraSessionSectionHeading id="jira-for-you-agents-heading">Agents</JiraSessionSectionHeading>
			<AgentList
				className="w-full"
				flyout="composer"
				items={sessionItems}
				onSubmitPrompt={(sessionItem, prompt) => onAgentPrompt(sessionItem.id, prompt)}
				onView={(sessionItem) => onAgentSelect(sessionItem.id)}
				selectedItemId={selectedAgentId}
				variant="compact"
			/>
		</section>
	);
}

function DetailArtifacts({
	details,
}: Readonly<{ details: JiraForYouWorkspaceItemDetails }>) {
	return (
		<>
			<section
				aria-labelledby="jira-for-you-sources-heading"
				className="flex flex-col gap-2 px-4 pt-4"
				data-testid="jira-for-you-detail-sources"
			>
				<JiraSessionSectionHeading id="jira-for-you-sources-heading">Sources</JiraSessionSectionHeading>
				<ul className="space-y-1">
					{details.sources.map((source) => (
						<li className="flex min-w-0" key={source.id}>
							<SmartLink align="center" alignOffset={0} className="max-w-full" item={source} side="left" />
						</li>
					))}
				</ul>
			</section>
			<section
				aria-labelledby="jira-for-you-output-heading"
				className="flex flex-col gap-2 px-4 pt-4 pb-4"
				data-testid="jira-for-you-detail-output"
			>
				<JiraSessionSectionHeading id="jira-for-you-output-heading">Output</JiraSessionSectionHeading>
				<div className="grid grid-cols-2 gap-2 px-0.5">
					{details.outputs.map((output) => (
						<AttachmentPreviewCard
							key={output.id}
							preview={(
								<Image
									alt=""
									className="absolute inset-0 m-auto size-16 object-contain"
									height={64}
									src={`/illustration/rich-icon/${output.illustration}/standard.svg`}
									width={64}
								/>
							)}
							previewBackgroundColor={token("elevation.surface.sunken")}
							title={output.title}
							trailingVisual={isSpreadsheet(output.title)
								? <FileChartColumnIcon className="size-3 text-icon-subtlest" size={12} />
								: <FileIcon className="size-3 text-icon-subtlest" size={12} />}
						/>
					))}
				</div>
			</section>
		</>
	);
}

function DetailPanelInner({
	agentSessions,
	details,
	item,
	onAgentPrompt,
	onAgentSelect,
	onClose,
	selectedAgentId,
}: Readonly<{
	agentSessions: readonly JiraForYouWorkspaceAgentSession[];
	details: JiraForYouWorkspaceItemDetails;
	item: JiraForYouItem;
	onAgentPrompt: (agentId: string, prompt: string) => void;
	onAgentSelect: (agentId: string) => void;
	onClose: () => void;
	selectedAgentId: string;
}>) {
	return (
		<PanelContainer
			aria-label={`Details for ${item.issueKey}`}
			className="h-full bg-surface"
			id="jira-for-you-detail-panel"
		>
			<PanelHeader className="h-14 px-4 py-3">
				<PanelTitle>Details</PanelTitle>
				<PanelActionGroup>
					<PanelActionClose label="Close detail panel" onClick={onClose} />
				</PanelActionGroup>
			</PanelHeader>

			<PanelContent>
				<PanelBody className="pb-4" spacing="none">
					<div className="px-4 pt-4" data-testid="jira-for-you-item-details">
						<JiraSessionFlyoutBody
							hideAgentRow
							hideHeader
							previewPosition={DETAIL_PREVIEW_POSITION}
							session={details.session}
						/>
					</div>
					<AgentSection
						agentSessions={agentSessions}
						branch={details.session.branch ?? `jira/${item.issueKey.toLowerCase()}`}
						onAgentPrompt={onAgentPrompt}
						onAgentSelect={onAgentSelect}
						selectedAgentId={selectedAgentId}
					/>
					<DetailArtifacts details={details} />
				</PanelBody>
			</PanelContent>
		</PanelContainer>
	);
}

interface JiraForYouDetailPanelProps {
	agentSessions: readonly JiraForYouWorkspaceAgentSession[];
	details: JiraForYouWorkspaceItemDetails;
	isNarrow: boolean;
	item: JiraForYouItem;
	onAgentPrompt: (agentId: string, prompt: string) => void;
	onAgentSelect: (agentId: string) => void;
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
	selectedAgentId: string;
}

export function JiraForYouDetailPanel({
	agentSessions,
	details,
	isNarrow,
	item,
	onAgentPrompt,
	onAgentSelect,
	onClose,
	resize,
	selectedAgentId,
}: Readonly<JiraForYouDetailPanelProps>) {
	const shouldReduceMotion = useReducedMotion();
	const panelVariants = getPanelVariants(isNarrow, shouldReduceMotion);

	return (
		<motion.div
			animate="open"
			className={cn(
				"z-20 h-full max-w-full shadow-overlay",
				isNarrow ? "absolute inset-0" : "absolute inset-y-0 right-0",
			)}
			exit="closed"
			initial="closed"
			style={{
				width: isNarrow ? "100%" : resize.sidebarWidth,
				willChange: shouldReduceMotion ? undefined : "transform",
			}}
			variants={panelVariants}
		>
			<DetailPanelInner
				agentSessions={agentSessions}
				details={details}
				item={item}
				onAgentPrompt={onAgentPrompt}
				onAgentSelect={onAgentSelect}
				onClose={onClose}
				selectedAgentId={selectedAgentId}
			/>
			{isNarrow ? null : (
				<SidebarResizeHandle
					aria-label="Resize details panel"
					aria-orientation="vertical"
					aria-valuemax={resize.maxWidth}
					aria-valuemin={resize.minWidth}
					aria-valuenow={resize.sidebarWidth}
					className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					data-active={resize.isResizing ? "" : undefined}
					data-testid="jira-for-you-detail-resize-handle"
					onDoubleClick={resize.onResizeHandleDoubleClick}
					onKeyDown={resize.onResizeHandleKeyDown}
					onPointerDown={resize.onResizeHandlePointerDown}
					onPointerEnter={resize.onResizeHandlePointerEnter}
					onPointerLeave={resize.onResizeHandlePointerLeave}
					role="separator"
					side="left"
					tabIndex={0}
				/>
			)}
		</motion.div>
	);
}
