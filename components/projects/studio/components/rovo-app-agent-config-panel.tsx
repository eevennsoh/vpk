"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import AppsIcon from "@atlaskit/icon/core/apps";
import AutomationIcon from "@atlaskit/icon/core/automation";
import ChangesIcon from "@atlaskit/icon/core/changes";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CommentIcon from "@atlaskit/icon/core/comment";
import CrossIcon from "@atlaskit/icon/core/cross";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";
import PageIcon from "@atlaskit/icon/core/page";
import AiComputeIcon from "@atlaskit/icon-lab/core/ai-compute";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AiModelIcon from "@atlaskit/icon-lab/core/ai-model";
import AudioWaveformIcon from "@atlaskit/icon-lab/core/audio-waveform";
import HistoryIcon from "@atlaskit/icon-lab/core/history";
import SkillIcon from "@atlaskit/icon-lab/core/skill";

import { KnowledgeDirectoryDialog, type KnowledgeDirectoryAddPayload } from "@/components/blocks/knowledge-directory";
import { Memory } from "@/components/blocks/memory";
import { AgentAccess } from "@/components/blocks/agent-access";
import { AgentEvaluation } from "@/components/blocks/agent-evaluation";
import { AgentInsights } from "@/components/blocks/agent-insights";
import { AgentSurfaces } from "@/components/blocks/agent-surfaces";
import { DEFAULT_KNOWLEDGE_APPS } from "@/app/data/directory/knowledge";
import { SkillsDirectoryDialog, type SkillsDirectorySkill } from "@/components/blocks/skills-directory";
import { DEFAULT_SKILLS } from "@/app/data/directory/skills";
import { ToolsDirectoryDialog } from "@/components/blocks/tools-directory";
import { AppsDirectoryDialog, type AppsDirectoryAddPayload } from "@/components/blocks/apps-directory";
import { DEMO_SESSION_TOOLS, DEMO_TOOLS } from "@/app/data/directory/tools";
import { DIRECTORY_APPS, getAppById } from "@/app/data/directory/apps";
import {
	ConversationStartersDialog,
	DEFAULT_STARTER_ICON,
	type ConversationStarter,
	type StarterIconKey,
} from "@/components/blocks/conversation-starters";
import {
	getTriggerProvider,
	markSessionProviderConnected,
	type AgentAutomationRule,
	type AgentTriggerProviderId,
	type AgentTriggerValue,
} from "@/components/blocks/triggers/data/trigger-catalog";
import { AgentTriggerProviderTileIcon } from "@/components/blocks/triggers/page";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ManageSubagentsDialog } from "@/components/blocks/subagents/components/manage-subagents-dialog";
import { SubagentsNavigator } from "@/components/blocks/subagents/subagents-navigator";
import type { SubagentsBaseAgent } from "@/components/blocks/subagents/data/demo-agents";
import { getListItems, updateConfigListItem } from "@/components/blocks/subagents/lib/subagent-prompts";
import { AgentUsers } from "@/components/blocks/agent-users";
import { useAgentConfigSubagents } from "@/components/projects/studio/hooks/use-agent-config-subagents";
import { useSubagentsNavigatorTop } from "@/components/projects/studio/hooks/use-subagents-navigator-top";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import {
	Agent,
	AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS,
	AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM,
	AgentCompactHeaderNav,
	type AgentCompactHeaderSection,
	AgentConfigFields,
	type AgentDirectoryKind,
	AgentHeader,
	AgentMoreOptionsMenu,
	toggleAgentConfigDisabledItem,
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigTextFieldName,
	type AgentHideableConfigField,
} from "@/components/blocks/agent";
import { getAgentConfigListLookupValue, getSkillConfigLabel } from "@/components/blocks/agent/lib/agent-config-model";
import type { EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import FloatingRovoButton, {
	type FloatingRovoButtonPersistentBar,
} from "@/components/projects/shared/components/floating-rovo-button";
import RovoFloatingChat from "@/components/projects/rovo-floating-chat/components/rovo-floating-chat";
import type { ChatPanelGreetingProps, ChatSubmitInterceptOutcome } from "@/components/projects/sidebar-chat/page";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import { getStudioSessionAgentDisplayName, useRovoChat } from "@/app/contexts";
import type { SendPromptOptions } from "@/app/contexts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { SONNER_TOAST_AUTO_DISMISS_MS, SonnerToast, Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import type {
	StudioSessionAgentEntry,
} from "@/app/contexts/context-rovo-chat";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import { cn } from "@/lib/utils";
import { getStudioAgentChangeSummary, type StudioAgentChangeSection, type StudioAgentChangeSummary } from "@/components/projects/rovo-core/lib/agent-records/agent-versioning";
import { motionEase } from "@/lib/motion";

type AgentResult = RovoDataParts["agent-result"];
export type AgentConfigView = "configure" | "insights" | "test";
type PublishDropdownView = "summary" | "draftChanges" | "history" | "versionDetail";

function getSkillByConfigLabel(value: string): SkillsDirectorySkill | undefined {
	const normalized = getSkillConfigLabel(value);
	return DEFAULT_SKILLS.find((skill) => skill.id === normalized || getSkillConfigLabel(skill.name) === normalized);
}

const STUDIO_AGENT_PUBLISH_TOASTER_ID = "studio-agent-publish-toaster";
const STUDIO_AGENT_PROFILE_BASE_PATH = "/studio";

// Capabilities a subagent can't own. Hidden from the config rows while a
// subagent prompt is selected/created (these aren't configurable per-subagent).
const SUBAGENT_HIDDEN_CONFIG_FIELDS: ReadonlySet<AgentHideableConfigField> = new Set([
	"trigger",
	"subagents",
	"conversationStarters",
]);

interface RovoAppAgentConfigPanelProps {
	activeView: AgentConfigView;
	entry: StudioSessionAgentEntry;
	onClose?: () => void;
	onCommitPublishReady: (profileId: string) => void;
	onPublish: (profileId: string) => void;
	onTest: (profileId: string) => void;
	onViewChange: (view: AgentConfigView) => void;
	testPanel: ReactNode;
	chatContextBar?: ChatContextBarDescriptor | null;
	chatGreeting?: ChatPanelGreetingProps;
	chatSendPromptOptions?: SendPromptOptions;
	onChatInterceptSubmit?: (text: string) => ChatSubmitInterceptOutcome;
	onUpdateDraft: (
		profileId: string,
		patch: Partial<AgentResult>,
	) => void;
	// Opens the host-owned Agent Directory on its first template tab when the
	// empty-instructions "start with a template" link is clicked.
	onStartWithTemplate?: () => void;
	// Receives the config's automation-dialog opener so the shell can let the
	// Ask Rovo agent-edit-summary card jump to the trigger/flow dialog.
	registerAutomationDialogOpener?: (opener: (() => void) | null) => void;
	className?: string;
}

function stringifyForComparison(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function formatRelativeTime(timestamp: number | null): string {
	if (!timestamp || !Number.isFinite(timestamp)) {
		return "Not published yet";
	}

	const elapsedMs = Math.max(0, Date.now() - timestamp);
	const elapsedMinutes = Math.floor(elapsedMs / 60_000);
	if (elapsedMinutes < 1) {
		return "Just now";
	}
	if (elapsedMinutes < 60) {
		return `${elapsedMinutes}m ago`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) {
		return `${elapsedHours}h ago`;
	}

	const elapsedDays = Math.floor(elapsedHours / 24);
	return `${elapsedDays}d ago`;
}

function formatAbsoluteDateTime(timestamp: number): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeZone: "UTC",
		timeStyle: "short",
	}).format(new Date(timestamp));
}

function getChangeCountLabel(changeSummary: StudioAgentChangeSummary): string {
	return changeSummary.count === 1 ? "1 change" : `${changeSummary.count} changes`;
}

function getDraftChangeCountLabel(changeSummary: StudioAgentChangeSummary): string {
	return changeSummary.count === 0
		? "No unpublished changes"
		: `${changeSummary.count} unpublished ${changeSummary.count === 1 ? "change" : "changes"}`;
}

function getDraftChangePreviewLabel(changeSummary: StudioAgentChangeSummary, publishedVersionLabel: string): string {
	if (changeSummary.count === 0) {
		return `Latest matches ${publishedVersionLabel}`;
	}

	const visibleLabels = changeSummary.sections.slice(0, 2).map((section) => section.label);
	const hiddenCount = Math.max(0, changeSummary.sections.length - visibleLabels.length);

	if (hiddenCount > 0) {
		return `${visibleLabels.join(", ")} +${hiddenCount} more`;
	}

	return visibleLabels.join(", ");
}

function getChangeStatusLabel(section: StudioAgentChangeSection): string {
	if (section.status === "Modified" && (section.addedCount || section.removedCount)) {
		return `+${section.addedCount ?? 0} -${section.removedCount ?? 0}`;
	}
	return section.status;
}

function getChangeStatusClassName(section: StudioAgentChangeSection): string {
	if (section.status === "Added") {
		return "text-text-success";
	}
	if (section.status === "Removed") {
		return "text-text-danger";
	}
	return "text-text-subtle";
}

function getPublishProfileHref(profileId: string): string {
	return `${STUDIO_AGENT_PROFILE_BASE_PATH}?agent=${encodeURIComponent(profileId)}`;
}

// How long the transient "Saved just now" confirmation lingers before it
// fades away. "Saving..." and "Unable to save" stay visible until resolved.
const AGENT_SAVE_CONFIRMATION_LINGER_MS = 2_500;

function AgentSaveStatusIndicator({
	savedAt,
	status,
}: Readonly<{
	savedAt: number | null;
	status: "idle" | "saving" | "saved" | "error";
}>) {
	const reduceMotion = useReducedMotion();
	// The success confirmation is transient: show it briefly after a save, then
	// fade it out. Persistent states ("saving"/"error") are never dismissed here.
	const isTransientConfirmation = status === "saved" && savedAt != null;
	const [confirmationVisible, setConfirmationVisible] = useState(isTransientConfirmation);

	useEffect(() => {
		if (!isTransientConfirmation) {
			setConfirmationVisible(false);
			return;
		}
		setConfirmationVisible(true);
		const timer = setTimeout(
			() => setConfirmationVisible(false),
			AGENT_SAVE_CONFIRMATION_LINGER_MS,
		);
		return () => clearTimeout(timer);
		// Re-arm the timer on each new save (savedAt changes per save).
	}, [isTransientConfirmation, savedAt]);

	const label = status === "saving"
		? "Saving..."
		: status === "error"
			? "Unable to save"
			: savedAt
				? "Saved just now"
				: "Saved";

	// Render nothing once the confirmation has faded out (avoids a lingering
	// empty min-width slot in the header actions).
	const showIndicator = isTransientConfirmation ? confirmationVisible : status !== "idle";

	return (
		<AnimatePresence>
			{showIndicator ? (
				// Stable key so the wrapper stays mounted across saving → saved →
				// error transitions; only the wrapper fades in on first appearance
				// and out on dismissal. Swapping the label text is handled by the
				// inner AnimatePresence so the two states never co-render and shift.
				<motion.div
					key="save-indicator"
					className="relative flex h-full items-center justify-end"
					aria-live="polite"
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
				>
					{/* Gradient scrim that veils the nav behind the label, fading
					    leftward into the nav. Mirrors the scroll-mask fade
					    direction (solid → transparent). */}
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 right-0 -z-10 bg-linear-to-l from-surface from-75% to-transparent"
						style={{ width: "calc(100% + var(--ds-space-600))" }}
					/>
					{/* mode="wait" ensures the old label fully fades before the new
					    one appears, so the two states never co-render (no "Saving…
					    Saved just now" overlap). The label stays in normal flow so
					    the right-anchored wrapper + scrim size to it; the wrapper
					    lives in an absolute overlay, so width changes grow leftward
					    into the scrim rather than pushing the action buttons. */}
					<AnimatePresence initial={false} mode="wait">
						<motion.span
							key={status}
							className={cn(
								"pointer-events-auto flex items-center gap-1.5 pl-2 text-xs leading-4 whitespace-nowrap",
								status === "error" ? "text-text-danger" : "text-text-subtle",
							)}
							initial={reduceMotion ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
						>
							{status === "saving" ? <Spinner size="xs" className="text-text-subtle" /> : null}
							<span>{label}</span>
						</motion.span>
					</AnimatePresence>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}

const PUBLISH_CHANGE_SECTION_ICONS: Record<string, ReactNode> = {
	triggers: <AutomationIcon label="" size="small" />,
	skills: <SkillIcon label="" size="small" />,
	tools: <AppsIcon label="" size="small" />,
	subagents: <AiAgentIcon label="" size="small" />,
	memory: <AiModelIcon label="" size="small" />,
	conversationStarters: <CommentIcon label="" size="small" />,
	reasoning: <AiComputeIcon label="" size="small" />,
};

function getPublishChangeSectionIcon(id: string): ReactElement {
	return (PUBLISH_CHANGE_SECTION_ICONS[id] ?? <PageIcon label="" size="small" />) as ReactElement;
}

function AgentPublishChangeList({
	changeSummary,
	limit = 4,
}: Readonly<{
	changeSummary: StudioAgentChangeSummary;
	limit?: number;
}>) {
	const [expanded, setExpanded] = useState(false);
	const visibleSections = expanded ? changeSummary.sections : changeSummary.sections.slice(0, limit);
	const hiddenCount = Math.max(0, changeSummary.sections.length - limit);

	if (changeSummary.count === 0) {
		return (
			<div className="rounded-sm bg-bg-neutral-subtle px-3 py-2 text-sm text-text-subtle">
				No unpublished changes
			</div>
		);
	}

	return (
		<div className="flex flex-col divide-y divide-border">
			{visibleSections.map((section) => (
				<div className="flex items-center gap-2 py-2 text-sm" key={section.id}>
					<Icon aria-hidden render={getPublishChangeSectionIcon(section.id)} className="text-text-subtle" />
					<span className="min-w-0 flex-1 truncate text-text">{section.label}</span>
					<span className={cn("shrink-0 text-xs", getChangeStatusClassName(section))}>
						{getChangeStatusLabel(section)}
					</span>
				</div>
			))}
			{hiddenCount > 0 ? (
				<button
					type="button"
					className="py-2 text-left text-sm text-text-subtle"
					onClick={() => setExpanded((prev) => !prev)}
				>
					{expanded ? "Show less" : `+${hiddenCount} more`}
				</button>
			) : null}
		</div>
	);
}

function AgentPublishDropdown({
	changeSummary,
	entry,
	onBackToLatest,
	onPreviewVersion,
	onPublishUpdate,
	onRestoreVersion,
	previewVersionId,
}: Readonly<{
	changeSummary: StudioAgentChangeSummary;
	entry: StudioSessionAgentEntry;
	onBackToLatest: () => void;
	onPreviewVersion: (versionId: string) => void;
	onPublishUpdate: () => void;
	onRestoreVersion: (versionId: string) => void;
	previewVersionId: string | null;
}>) {
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<PublishDropdownView>("summary");
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
	// Scroll-driven fade beneath the pinned back header — mirrors the editor
	// palette's nested "back" experience (no hard divider; the list top fades
	// once it scrolls under the sticky header).
	const historyOverflow = useHasVerticalOverflow<HTMLDivElement>();
	// Scroll-driven fades on the version detail body so content dissolves under
	// the pinned back header and above the pinned action footer instead of
	// hitting a hard edge.
	const versionDetailOverflow = useHasVerticalOverflow<HTMLDivElement>();
	const selectedVersion = selectedVersionId
		? entry.versionHistory.find((version) => version.id === selectedVersionId) ?? null
		: null;
	const publishedVersions = entry.versionHistory.filter((version) => version.kind === "publish" || version.kind === "update");
	const hasChanges = changeSummary.count > 0;
	const profileHref = getPublishProfileHref(entry.profile.id);
	const publishedVersionLabel = `V${entry.publishedVersion || 1}`;
	const agentName = getStudioSessionAgentDisplayName(entry);
	const agentAvatarSrc = entry.profile.avatarSrc;

	const resetToSummary = () => {
		setView("summary");
		setSelectedVersionId(null);
	};

	return (
		<DropdownMenu open={open} onOpenChange={(next) => {
			setOpen(next);
			if (!next) {
				resetToSummary();
			}
		}}>
			<DropdownMenuTrigger
				render={(
					<Button
						type="button"
						size="default"
						variant="default"
						data-testid="agent-config-publish"
						data-screen-assistant-target="studio-agent-config-publish"
					/>
				)}
			>
				<span className="inline-flex items-center gap-2">
					Publish
					{hasChanges ? (
						<Badge variant="inverse">{changeSummary.count}</Badge>
					) : null}
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="flex max-h-[min(480px,var(--available-height,480px))] w-[360px] flex-col overflow-hidden rounded-2xl p-0">
				{view === "summary" ? (
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
						<div className="px-2 pt-2">
							<a
								className="flex items-center gap-3 rounded-lg py-2 pr-3 pl-2 no-underline hover:bg-bg-neutral-subtle-hovered hover:no-underline"
								href={profileHref}
							>
								<Avatar aria-hidden="true" shape="hexagon" size="default" className="shrink-0 after:border-0">
									{agentAvatarSrc ? <AvatarImage alt="" src={agentAvatarSrc} /> : null}
									<AvatarFallback>{agentName.slice(0, 2).toUpperCase()}</AvatarFallback>
								</Avatar>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium text-text">View agent profile</span>
									<span className="mt-1 flex items-center gap-1 text-xs text-text-subtle">
										<Badge variant="success">{publishedVersionLabel}</Badge>
										<span aria-hidden>·</span>
										<span className="shrink-0">{formatRelativeTime(entry.lastPublishedAt)}</span>
										<span aria-hidden>·</span>
										<span className="truncate">by {entry.lastPublishedBy ?? "Venn Soh"}</span>
									</span>
								</span>
								<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<LinkExternalIcon label="" size="small" />} />
							</a>
						</div>
						<DropdownMenuSeparator className="mx-4 my-2" />
						<div className="px-2">
							<button
								type="button"
								className="flex w-full items-center gap-3 rounded-lg py-2 pr-3 pl-2 text-left hover:bg-bg-neutral-subtle-hovered"
								onClick={() => setView("history")}
							>
								<IconTile aria-hidden icon={<HistoryIcon label="" />} label="" />
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-medium text-text-subtle">Version history</span>
									<span className="block text-xs text-text-subtle">
										{publishedVersions.length} saved {publishedVersions.length === 1 ? "version" : "versions"}
									</span>
								</span>
								<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<ChevronRightIcon label="" size="small" />} />
							</button>
						</div>
						<DropdownMenuSeparator className="mx-4 my-2" />
						<div className="flex flex-col gap-2 px-2 pb-4">
							<button
								type="button"
								className="flex w-full items-center gap-3 rounded-lg py-1.5 pr-3 pl-2 text-left hover:bg-bg-neutral-subtle-hovered"
								onClick={() => setView("draftChanges")}
							>
								<IconTile aria-hidden icon={<ChangesIcon label="" />} label="" />
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-medium text-text-subtle">
										{getDraftChangeCountLabel(changeSummary)}
									</span>
									<span className="block truncate text-xs text-text-subtle">
										{getDraftChangePreviewLabel(changeSummary, publishedVersionLabel)}
									</span>
								</span>
								<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<ChevronRightIcon label="" size="small" />} />
							</button>
							<div className="px-2">
								<Button
									type="button"
									className="w-full"
									disabled={!hasChanges}
									onClick={onPublishUpdate}
								>
									Update
								</Button>
							</div>
						</div>
					</div>
				) : null}
				{view === "draftChanges" ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="shrink-0 sticky top-0 z-10 flex items-center gap-2 bg-popover p-3">
							<Button aria-label="Back to publish summary" size="icon-compact" type="button" variant="ghost" onClick={resetToSummary}>
								<ArrowLeftIcon label="" size="small" />
							</Button>
							<div className="min-w-0 flex-1 truncate text-sm font-semibold text-text">Unpublished changes</div>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
							<div className="text-xs font-semibold text-text-subtlest">
								{getDraftChangeCountLabel(changeSummary)}
							</div>
							<div className="mt-1">
								<AgentPublishChangeList changeSummary={changeSummary} />
							</div>
						</div>
						<div className="shrink-0 p-4 pt-2">
							<Button
								type="button"
								className="w-full"
								disabled={!hasChanges}
								onClick={onPublishUpdate}
							>
								Update
							</Button>
						</div>
					</div>
				) : null}
				{view === "history" ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="shrink-0 sticky top-0 z-10 flex items-center gap-2 bg-popover p-3">
							<Button aria-label="Back to publish summary" size="icon-compact" type="button" variant="ghost" onClick={resetToSummary}>
								<ArrowLeftIcon label="" size="small" />
							</Button>
							<div className="text-sm font-semibold text-text">Version history</div>
						</div>
						<div
							ref={historyOverflow.ref}
							className={cn(
								"min-h-0 flex-1 overflow-y-auto p-2",
								historyOverflow.showTopScrollMask && "scroll-mask-top",
							)}
						>
							{publishedVersions.map((version) => (
								<button
									type="button"
									className="flex w-full items-center gap-3 rounded-lg py-2 pr-3 pl-2 text-left hover:bg-bg-neutral-subtle-hovered"
									key={version.id}
									onClick={() => {
										setSelectedVersionId(version.id);
										setView("versionDetail");
									}}
								>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-2">
											<Badge variant="success">{`V${version.version}`}</Badge>
											{version.version === entry.publishedVersion ? <Badge variant="neutral">Live</Badge> : null}
										</span>
										<span className="mt-1 block text-xs text-text-subtle">
											{version.label} · {formatRelativeTime(version.createdAt)}
										</span>
									</span>
									<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<ChevronRightIcon label="" size="small" />} />
								</button>
							))}
						</div>
					</div>
				) : null}
				{view === "versionDetail" && selectedVersion ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="shrink-0 sticky top-0 z-10 flex items-center gap-2 bg-popover p-3">
							<Button aria-label="Back to version history" size="icon-compact" type="button" variant="ghost" onClick={() => setView("history")}>
								<ArrowLeftIcon label="" size="small" />
							</Button>
							<div className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{`V${selectedVersion.version}`}</div>
							{previewVersionId === selectedVersion.id ? <Badge variant="neutral">Previewing</Badge> : null}
						</div>
						<div
							ref={versionDetailOverflow.ref}
							className={cn(
								"min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-2",
								versionDetailOverflow.showTopScrollMask && "scroll-mask-top",
								versionDetailOverflow.showBottomScrollMask && "scroll-mask-bottom",
							)}
						>
							<div className="text-xs font-semibold text-text-subtlest">{selectedVersion.label}</div>
							<div className="mt-1 text-sm text-text">{formatAbsoluteDateTime(selectedVersion.createdAt)}</div>
							<div className="mt-4 text-xs font-semibold text-text-subtlest">Published by</div>
							<div className="mt-1 text-sm text-text">{selectedVersion.createdBy}</div>
							<div className="mt-4 text-xs font-semibold text-text-subtlest">
								{getChangeCountLabel(selectedVersion.changeSummary)}
							</div>
							<div className="mt-1">
								<AgentPublishChangeList changeSummary={selectedVersion.changeSummary} />
							</div>
						</div>
						<div className="shrink-0 grid grid-cols-2 gap-2 p-4 pt-2">
							<Button type="button" variant="outline" onClick={onBackToLatest}>
								Back to latest
							</Button>
							{previewVersionId === selectedVersion.id ? (
								<Button type="button" onClick={() => onRestoreVersion(selectedVersion.id)}>
									Rollback
								</Button>
							) : (
								<Button type="button" onClick={() => onPreviewVersion(selectedVersion.id)}>
									Preview
								</Button>
							)}
						</div>
					</div>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function RovoAppAgentConfigPanel({
	activeView,
	entry,
	onClose,
	onCommitPublishReady,
	onPublish,
	onTest,
	onViewChange,
	testPanel,
	chatContextBar,
	chatGreeting,
	chatSendPromptOptions,
	onChatInterceptSubmit,
	onUpdateDraft,
	onStartWithTemplate,
	registerAutomationDialogOpener,
	className,
}: Readonly<RovoAppAgentConfigPanelProps>) {
	const shouldReduceMotion = useReducedMotion();
	const profileId = entry.profile.id;
	const agentName = getStudioSessionAgentDisplayName(entry);
	const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
	const previewVersion = previewVersionId
		? entry.versionHistory.find((version) => version.id === previewVersionId) ?? null
		: null;
	const isPreviewingVersion = Boolean(previewVersion);
	const draft = previewVersion?.snapshot ?? entry.draftResult;
	// The floating SubagentsNavigator must top-align with the first line of the
	// instructions editor. That line moves as the profile/content above it
	// reflows or scrolls, so measure it relative to the positioned TabsContent
	// (the navigator's positioning context) instead of using a fixed `top`.
	const configureTabRef = useRef<HTMLDivElement | null>(null);
	const navigatorTop = useSubagentsNavigatorTop(configureTabRef);
	const [activeDirectory, setActiveDirectory] = useState<AgentDirectoryKind | null>(null);
	const [activeCompactSection, setActiveCompactSection] = useState<AgentCompactHeaderSection | null>(null);
	const [instructionsViewMode, setInstructionsViewMode] = useState<EditorToolbarViewMode>("rendered");
	const lastCompactSectionRef = useRef<AgentCompactHeaderSection>("details");
	// Tool to focus when the tools directory opens (e.g. clicking a tool chip).
	// Cleared on close so a plain "Add" opens at the directory list instead.
	const [directorySelectedToolId, setDirectorySelectedToolId] = useState<string | null>(null);
	// Unified Apps directory: the app to focus when it opens (chip click / picker).
	const [directorySelectedAppId, setDirectorySelectedAppId] = useState<string | null>(null);
	// App to open the knowledge directory on (e.g. picking an app in the "Add
	// knowledge" flyout). Cleared on close so "Browse knowledge" opens the grid.
	const [directoryKnowledgeAppId, setDirectoryKnowledgeAppId] = useState<string | null>(null);
	const [directorySkillIds, setDirectorySkillIds] = useState<readonly string[]>([]);
	// Skill to open the skills directory on (e.g. clicking a configured skill
	// chip). Cleared on close so "Browse skills" opens the grid, not a detail view.
	const [directorySelectedSkillId, setDirectorySelectedSkillId] = useState<string | null>(null);
	const [isManageSubagentsOpen, setIsManageSubagentsOpen] = useState(false);

	// Floating Rovo chat launcher for the agent config screen. studio surfaces
	// suppress the floating button by default (the shell owns chat), so we render
	// it with product="home" — product only gates visibility, it has no visual
	// effect — and pair it with the RovoFloatingChat surface the button opens,
	// mirroring the components/projects/rovo-button demo.
	const {
		chatSurface,
		openChat,
		resetAgentToRovo,
		restoreSessionAgentVersion,
		sessionAgentSaveStatus,
		sessionAgentSavedAt,
	} = useRovoChat();

	const updateDraft = useCallback(
		(patch: Partial<AgentResult>) => {
			if (isPreviewingVersion) {
				return;
			}
			onUpdateDraft(profileId, patch);
		},
		[isPreviewingVersion, onUpdateDraft, profileId],
	);

	// Base agent + subagent prompts. `activeConfig` is the base draft or the
	// selected subagent's config; field edits route through `updateActiveConfig`.
	const {
		activeConfig,
		activeConfigId,
		activePrompt,
		activeSubagentId,
		baseConfig,
		createSubagent,
		deleteSubagentById,
		handleConditionChange,
		handleTriggerNameChange,
		isSubagentActive,
		removeSubagentByDerivedIndex,
		reorderSubagents,
		selectBaseAgent,
		selectSubagent,
		selectSubagentByDerivedIndex,
		selectedSubagentIndex,
		subagentPrompts,
		toggleSubagent,
		updateActiveConfig,
	} = useAgentConfigSubagents({ draft, updateDraft });

	// Profile name/description always edit the base agent, even while a subagent
	// is selected (wired to AgentConfigFields' `onProfileTextChange`).
	const handleBaseTextChange = useCallback(
		(field: AgentConfigTextFieldName, value: string) => {
			if (field === "description") {
				updateDraft({ description: value, summary: value });
				return;
			}
			updateDraft({ [field]: value } as Partial<AgentResult>);
		},
		[updateDraft],
	);
	const handleBaseAvatarChange = useCallback(
		(avatarSrc: string) => {
			updateDraft({ avatarSrc });
		},
		[updateDraft],
	);

	// Instructions and other config text edit whichever config is active.
	const handleConfigTextChange = useCallback(
		(field: AgentConfigTextFieldName, value: string) => {
			updateActiveConfig((config) => ({
				...config,
				[field]: value,
				...(field === "description" ? { summary: value } : {}),
			}));
		},
		[updateActiveConfig],
	);

	const updateListItem = useCallback(
		(field: AgentConfigListFieldName, index: number, value: string) => {
			// Subagent chips derive from prompt trigger names; they aren't free-text
			// editable from the list row.
			if (field === "subagents") {
				return;
			}
			updateActiveConfig((config) => updateConfigListItem(config, field, index, value));
		},
		[updateActiveConfig],
	);

	const removeListItem = useCallback(
		(field: AgentConfigListFieldName, index: number) => {
			if (field === "subagents") {
				if (!isSubagentActive) {
					removeSubagentByDerivedIndex(index);
				}
				return;
			}
			updateActiveConfig((config) => ({
				...config,
				[field]: getListItems(config, field).filter((_, itemIndex) => itemIndex !== index),
				...(field === "conversationStarters"
					? {
							conversationStarterIcons: Array.isArray(config.conversationStarterIcons)
								? config.conversationStarterIcons.filter((_, itemIndex) => itemIndex !== index)
								: undefined,
						}
					: {}),
			}));
		},
		[isSubagentActive, removeSubagentByDerivedIndex, updateActiveConfig],
	);

	const toggleListItem = useCallback(
		(field: AgentConfigListFieldName, index: number, enabled: boolean) => {
			updateActiveConfig((config) => {
				const label = getListItems(config, field)[index];
				return label ? toggleAgentConfigDisabledItem(config, field, label, enabled) : config;
			});
		},
		[updateActiveConfig],
	);

	const appendListItem = useCallback(
		(field: AgentConfigListFieldName) => {
			if (field === "subagents") {
				createSubagent();
				return;
			}
			updateActiveConfig((config) => ({
				...config,
				[field]: [...getListItems(config, field), ""],
			}));
		},
		[createSubagent, updateActiveConfig],
	);

	const appendListValues = useCallback(
		(field: AgentConfigListFieldName, values: readonly string[]) => {
			const nextValues = values
				.map((value) => field === "skills" ? getSkillConfigLabel(value) : value.trim())
				.filter(Boolean);

			if (nextValues.length === 0) {
				return;
			}

			const current = getListItems(activeConfig, field);
			const existing = new Set(current.map((value) => getAgentConfigListLookupValue(field, value)));
			const additions = nextValues.filter((value) => !existing.has(getAgentConfigListLookupValue(field, value)));

			if (additions.length === 0) {
				return;
			}

			updateActiveConfig((config) => ({
				...config,
				[field]: [...getListItems(config, field), ...additions],
			}));
		},
		[activeConfig, updateActiveConfig],
	);

	const handleSelectListItem = useCallback(
		(field: AgentConfigListFieldName, index: number) => {
			if (field === "subagents") {
				selectSubagentByDerivedIndex(index);
			}
		},
		[selectSubagentByDerivedIndex],
	);
	const handleAutomationRulesChange = useCallback(
		(automationRules: readonly AgentAutomationRule[]) => {
			updateActiveConfig((config) => ({
				...config,
				automationRules,
			}));
		},
		[updateActiveConfig],
	);
	// Fake provider connection flow: connecting a provider marks ALL its triggers
	// connected after a short "Authorizing…" delay, and persists for the session.
	const [connectingProvider, setConnectingProvider] = useState<{
		providerId: AgentTriggerProviderId;
		trigger: AgentTriggerValue;
	} | null>(null);
	const connectTimerRef = useRef<number | null>(null);
	// oxlint-disable react-doctor/exhaustive-deps -- Unmount cleanup intentionally clears whichever fake provider connection timer is still active.
	useEffect(() => {
		return () => {
			if (connectTimerRef.current !== null) {
				window.clearTimeout(connectTimerRef.current);
			}
		};
	}, []);
	// oxlint-enable react-doctor/exhaustive-deps
	const handleConnectTrigger = useCallback(
		(targetTrigger: AgentTriggerValue) => {
			const { providerId } = targetTrigger;
			// Mark every trigger sharing this provider as connecting (provider-level).
			updateActiveConfig((config) => {
				const automationRules = (config.automationRules ?? []).map((rule) => ({
					...rule,
					triggers: rule.triggers.map((trigger) =>
						trigger.providerId === providerId
							? { ...trigger, connectionState: "connecting" as const }
							: trigger,
					),
				}));
				return { ...config, automationRules };
			});
			setConnectingProvider({ providerId, trigger: targetTrigger });

			if (connectTimerRef.current !== null) {
				window.clearTimeout(connectTimerRef.current);
			}
			connectTimerRef.current = window.setTimeout(() => {
				markSessionProviderConnected(providerId);
				updateActiveConfig((config) => {
					const automationRules = (config.automationRules ?? []).map((rule) => ({
						...rule,
						triggers: rule.triggers.map((trigger) =>
							trigger.providerId === providerId
								? { ...trigger, connectionState: "connected" as const }
								: trigger,
						),
					}));
					return { ...config, automationRules };
				});
				setConnectingProvider(null);
				connectTimerRef.current = null;
			}, 1200);
		},
		[updateActiveConfig],
	);
	const handleOpenDirectory = useCallback((directory: AgentDirectoryKind, selectedItem?: string) => {
		if (directory === "tools") {
			if (selectedItem) {
				// The "Add tools" picker passes a tool id; tool chips pass a tool
				// name. Resolve either to the directory's tool id so the dialog can
				// open directly on that tool's detail view.
				const normalized = selectedItem.trim().toLowerCase();
				const allTools = [...DEMO_TOOLS, ...DEMO_SESSION_TOOLS];
				const matchedTool =
					allTools.find((tool) => tool.id === selectedItem) ??
					allTools.find((tool) => tool.name.trim().toLowerCase() === normalized);
				setDirectorySelectedToolId(matchedTool?.id ?? null);
			} else {
				setDirectorySelectedToolId(null);
			}
		} else if (directory === "apps") {
			// Apps chips pass an app name; the picker passes an app id. Resolve
			// either to the app id so the dialog opens on that app's detail.
			if (selectedItem) {
				const normalized = selectedItem.trim().toLowerCase();
				const matched =
					getAppById(selectedItem) ??
					DIRECTORY_APPS.find((app) => app.name.trim().toLowerCase() === normalized);
				setDirectorySelectedAppId(matched?.id ?? null);
			} else {
				setDirectorySelectedAppId(null);
			}
		} else if (directory === "skills") {
			// Skill chips pass the configured kebab-case label; older drafts may still
			// pass a display name. Resolve either to the directory's skill id so the
			// dialog opens directly on that skill's detail/config view.
			if (selectedItem) {
				const matched =
					DEFAULT_SKILLS.find((skill) => skill.id === selectedItem) ??
					getSkillByConfigLabel(selectedItem);
				setDirectorySelectedSkillId(matched?.id ?? null);
			} else {
				setDirectorySelectedSkillId(null);
			}
		}
		setActiveDirectory(directory);
	}, []);
	// The apps already on the agent, as catalog ids — drives the Apps dialog's
	// "added" state. Derived from the canonical apps[] (display names) so it stays
	// in sync after every add/remove.
	const addedAppIds = useMemo(() => {
		const names = getListItems(activeConfig, "apps");
		return names
			.map((name) => {
				const normalized = name.trim().toLowerCase();
				return DIRECTORY_APPS.find((app) => app.name.trim().toLowerCase() === normalized)?.id;
			})
			.filter((id): id is string => Boolean(id));
	}, [activeConfig]);
	// Tools already on the agent, as catalog ids — drives the Tools dialog's
	// "added" check (and Add/Remove + "My tools" filter). Config-derived so the
	// indicator survives reopen, mirroring addedAppIds.
	const addedToolIds = useMemo(() => {
		const catalog = [...DEMO_TOOLS, ...DEMO_SESSION_TOOLS];
		return getListItems(activeConfig, "tools")
			.map((name) => {
				const normalized = name.trim().toLowerCase();
				return catalog.find((tool) => tool.name.trim().toLowerCase() === normalized)?.id;
			})
			.filter((id): id is string => Boolean(id));
	}, [activeConfig]);
	// Skills already on the agent, as catalog ids — drives the persistent "added"
	// check, distinct from the in-dialog multi-select (directorySkillIds).
	const addedSkillIds = useMemo(() => {
		return getListItems(activeConfig, "skills")
			.map((name) => {
				return getSkillByConfigLabel(name)?.id;
			})
			.filter((id): id is string => Boolean(id));
	}, [activeConfig]);
	// Skills parked disabled on the agent (config `disabledItems.skills`), as catalog
	// ids — drives the detail header's disable Switch.
	const disabledSkillIds = useMemo(() => {
		const labels = new Set((activeConfig.disabledItems?.skills ?? []).map(getSkillConfigLabel));
		if (labels.size === 0) {
			return [];
		}
		return DEFAULT_SKILLS.filter((skill) => labels.has(getSkillConfigLabel(skill.name))).map((skill) => skill.id);
	}, [activeConfig]);
	// Knowledge apps contributing knowledge to the agent — matched by the
	// "<App> - all content" entry or any of the app's content names.
	const addedKnowledgeAppIds = useMemo(() => {
		const entries = getListItems(activeConfig, "knowledge").map((name) => name.trim().toLowerCase());
		if (entries.length === 0) {
			return [];
		}
		return DEFAULT_KNOWLEDGE_APPS.filter((app) => {
			const appPrefix = `${app.name.trim().toLowerCase()} - `;
			const contentNames = new Set(app.contents.map((content) => content.name.trim().toLowerCase()));
			return entries.some((entry) => entry.startsWith(appPrefix) || contentNames.has(entry));
		}).map((app) => app.id);
	}, [activeConfig]);
	const handleDirectoryAppIdsChange = useCallback(
		(nextIds: readonly string[]) => {
			const nextIdSet = new Set(nextIds);
			const previousIdSet = new Set(addedAppIds);
			const addedIds = nextIds.filter((id) => !previousIdSet.has(id));
			const removedIds = addedAppIds.filter((id) => !nextIdSet.has(id));

			// Removing an app strips its canonical apps[] membership and the facets it
			// contributed (tool name + "<App> - all content" knowledge). Without this,
			// addedAppIds (derived from apps[]) would re-add the removed app next render.
			if (removedIds.length > 0) {
				const removeAppNames = new Set<string>();
				const removeToolNames = new Set<string>();
				const removeKnowledgeNames = new Set<string>();
				for (const id of removedIds) {
					const app = getAppById(id);
					if (!app) {
						continue;
					}
					removeAppNames.add(app.name.toLowerCase());
					if (app.hasToolFacet) {
						removeToolNames.add(app.name.toLowerCase());
					}
					if (app.hasKnowledgeFacet && app.knowledgeApp) {
						// Strip both the app-level "all content" entry and any per-content
						// names — the app may have been added with custom content selected.
						removeKnowledgeNames.add(`${app.knowledgeApp.name} - all content`.toLowerCase());
						for (const content of app.knowledgeApp.contents) {
							removeKnowledgeNames.add(content.name.toLowerCase());
						}
					}
				}
				updateActiveConfig((config) => ({
					...config,
					apps: getListItems(config, "apps").filter((name) => !removeAppNames.has(name.trim().toLowerCase())),
					tools: getListItems(config, "tools").filter((name) => !removeToolNames.has(name.trim().toLowerCase())),
					knowledge: getListItems(config, "knowledge").filter(
						(name) => !removeKnowledgeNames.has(name.trim().toLowerCase()),
					),
				}));
			}

			// Adding an app wires BOTH facets: the canonical apps[] membership plus
			// its tool (name) and knowledge ("<App> - all content") so the existing
			// generation/persistence consumers stay populated. appendListValues dedupes.
			for (const id of addedIds) {
				const app = getAppById(id);
				if (!app) {
					continue;
				}
				appendListValues("apps", [app.name]);
				if (app.hasToolFacet) {
					appendListValues("tools", [app.name]);
				}
				if (app.hasKnowledgeFacet && app.knowledgeApp) {
					appendListValues("knowledge", [`${app.knowledgeApp.name} - all content`]);
				}
			}
			if (addedIds.length > 0) {
				setActiveDirectory(null);
			}
		},
		[appendListValues, updateActiveConfig, addedAppIds],
	);
	const handleAddApp = useCallback(
		(payload: AppsDirectoryAddPayload) => {
			const app = getAppById(payload.appId);
			if (!app) {
				return;
			}
			appendListValues("apps", [app.name]);
			if (app.hasToolFacet) {
				appendListValues("tools", [app.name]);
			}
			// Honor the per-app knowledge selection from the dialog: "all" → the app's
			// all-content entry, "custom" → the chosen content names, "none" → nothing.
			if (app.hasKnowledgeFacet && app.knowledgeApp) {
				if (payload.knowledgeMode === "all") {
					appendListValues("knowledge", [`${app.knowledgeApp.name} - all content`]);
				} else if (payload.knowledgeMode === "custom") {
					const contentNameById = new Map(
						app.knowledgeApp.contents.map((content) => [content.id, content.name]),
					);
					appendListValues(
						"knowledge",
						payload.knowledgeContentIds.map((id) => contentNameById.get(id) ?? id),
					);
				}
			}
			setActiveDirectory(null);
		},
		[appendListValues],
	);
	const handleAddKnowledge = useCallback(
		(payload: KnowledgeDirectoryAddPayload) => {
			const app = DEFAULT_KNOWLEDGE_APPS.find((candidate) => candidate.id === payload.appId);

			if (!app) {
				return;
			}

			if (payload.contentIds === "all") {
				appendListValues("knowledge", [`${app.name} - all content`]);
			} else {
				const contentById = new Map(app.contents.map((content) => [content.id, content.name]));
				appendListValues(
					"knowledge",
					payload.contentIds.map((contentId) => contentById.get(contentId) ?? contentId),
				);
			}

			setActiveDirectory(null);
		},
		[appendListValues],
	);
	const handleDirectoryToolIdsChange = useCallback(
		(nextIds: readonly string[]) => {
			const nextIdSet = new Set(nextIds);
			const previousIdSet = new Set(addedToolIds);
			const addedIds = nextIds.filter((id) => !previousIdSet.has(id));
			const removedIds = addedToolIds.filter((id) => !nextIdSet.has(id));
			const toolsById = new Map([...DEMO_TOOLS, ...DEMO_SESSION_TOOLS].map((tool) => [tool.id, tool]));

			// Removing a tool strips its name from the canonical tools[]; without this,
			// addedToolIds (derived from tools[]) would re-add it on the next render.
			if (removedIds.length > 0) {
				const removeNames = new Set(removedIds.map((id) => (toolsById.get(id)?.name ?? id).trim().toLowerCase()));
				updateActiveConfig((config) => ({
					...config,
					tools: getListItems(config, "tools").filter((name) => !removeNames.has(name.trim().toLowerCase())),
				}));
			}

			appendListValues(
				"tools",
				addedIds.map((toolId) => toolsById.get(toolId)?.name ?? toolId),
			);

			if (addedIds.length > 0) {
				setActiveDirectory(null);
			}
		},
		[addedToolIds, appendListValues, updateActiveConfig],
	);
	const handleAddSkills = useCallback(
		(_skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => {
			appendListValues("skills", skills.map((skill) => getSkillConfigLabel(skill.name)));
			setDirectorySkillIds([]);
		},
		[appendListValues],
	);
	// Disable persists into the agent config's `disabledItems.skills` (same store the
	// compact-nav row toggles use), so a parked skill stays added but off.
	const handleToggleSkillEnabled = useCallback(
		(skill: SkillsDirectorySkill, enabled: boolean) => {
			updateActiveConfig((config) => toggleAgentConfigDisabledItem(config, "skills", skill.name, enabled));
		},
		[updateActiveConfig],
	);
	// Remove strips the skill from the canonical skills[] (and clears any disabled
	// entry) so it is actually off the agent, not just deselected in the dialog.
	const handleRemoveSkills = useCallback(
		(_skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => {
			const removeNames = new Set(skills.map((skill) => getSkillConfigLabel(skill.name)));
			updateActiveConfig((config) => {
				const next = {
					...config,
					skills: getListItems(config, "skills").filter((name) => !removeNames.has(getSkillConfigLabel(name))),
				};
				return skills.reduce<AgentConfigFormValue>(
					(acc, skill) => toggleAgentConfigDisabledItem(acc, "skills", skill.name, true),
					next,
				);
			});
		},
		[updateActiveConfig],
	);

	// Conversation starters are edited as a whole set in a dedicated dialog
	// (reorder / icon / generate), unlike the append-only directories. Seed the
	// dialog from the active config's text + parallel icon array, defaulting the icon.
	const conversationStarterDialogValue = useMemo<readonly ConversationStarter[]>(() => {
		const texts = getListItems(activeConfig, "conversationStarters");
		const icons = Array.isArray(activeConfig.conversationStarterIcons)
			? activeConfig.conversationStarterIcons
			: [];
		return texts.map((text, index) => ({
			id: `starter-${index}`,
			text,
			icon: (icons[index] as StarterIconKey | undefined) ?? DEFAULT_STARTER_ICON,
		}));
	}, [activeConfig]);
	const handleSaveConversationStarters = useCallback(
		(starters: readonly ConversationStarter[]) => {
			updateActiveConfig((config) => ({
				...config,
				conversationStarters: starters.map((starter) => starter.text),
				conversationStarterIcons: starters.map((starter) => starter.icon),
			}));
			setActiveDirectory(null);
		},
		[updateActiveConfig],
	);

	const hasPublishedVersion = entry.publishedVersion > 0 || Boolean(entry.publishedResult);
	const unpublishedChangeSummary = useMemo(
		() => getStudioAgentChangeSummary(entry.publishedResult, entry.draftResult),
		[entry.draftResult, entry.publishedResult],
	);
	const hasUpdateChanges = useMemo(() => {
		return (
			stringifyForComparison(entry.draftResult) !==
			stringifyForComparison(entry.publishReadyResult)
		);
	}, [entry.draftResult, entry.publishReadyResult]);

	const hasPublishChanges = useMemo(() => {
		if (!entry.publishedResult) {
			return true;
		}
		return (
			stringifyForComparison(entry.publishReadyResult) !==
			stringifyForComparison(entry.publishedResult)
		);
	}, [entry.publishReadyResult, entry.publishedResult]);

	const handlePublish = useCallback(() => {
		// Ensure publish-ready snapshot reflects current draft before publishing.
		if (hasUpdateChanges) {
			onCommitPublishReady(profileId);
		}
		onPublish(profileId);
		// Confirm every publish with a flag — the first launch and each later
		// update. The toast id is version-scoped so successive publishes don't
		// dedupe into a single stale toast.
		const nextVersion = entry.publishedVersion + 1;
		toast.custom(
			(id) => (
				<SonnerToast
					appearance="success"
					title={hasPublishedVersion ? "Changes published" : "Agent launched"}
					description={
						hasPublishedVersion
							? `${agentName} is now live as V${nextVersion}.`
							: `${agentName} is live as V1.`
					}
					dismissible
					onDismiss={() => toast.dismiss(id)}
				/>
			),
			{
				id: `${STUDIO_AGENT_PUBLISH_TOASTER_ID}-${profileId}-v${nextVersion}`,
				toasterId: STUDIO_AGENT_PUBLISH_TOASTER_ID,
				duration: SONNER_TOAST_AUTO_DISMISS_MS,
			},
		);
		setPreviewVersionId(null);
	}, [agentName, entry.publishedVersion, hasPublishedVersion, hasUpdateChanges, onCommitPublishReady, onPublish, profileId]);

	const handleRestoreVersion = useCallback(
		(versionId: string) => {
			restoreSessionAgentVersion(profileId, versionId);
			setPreviewVersionId(null);
		},
		[profileId, restoreSessionAgentVersion],
	);

	const handleTest = useCallback(() => {
		if (hasUpdateChanges) {
			onCommitPublishReady(profileId);
		}
		onTest(profileId);
	}, [hasUpdateChanges, onCommitPublishReady, onTest, profileId]);
	const [floatingLiveChatRequestKey, setFloatingLiveChatRequestKey] = useState(0);
	// Opening the floating chat (button tap) must NOT start voice. Voice is only
	// requested by the persistent bar's "Talk to Rovo" action, which bumps the
	// request key consumed as `startRealtimeVoiceRequestKey`.
	const handleOpenFloatingRovoChat = useCallback(() => {
		// Preserve the current thread so opening Ask Rovo keeps the agent's
		// generation conversation visible instead of resetting to the
		// "Improve your agent?" greeting.
		resetAgentToRovo({ preserveCurrentThread: true });
		openChat("floating");
	}, [openChat, resetAgentToRovo]);
	const handleStartFloatingRovoVoice = useCallback(() => {
		// Same as the floating chat button: keep the generation conversation.
		resetAgentToRovo({ preserveCurrentThread: true });
		setFloatingLiveChatRequestKey((currentKey) => currentKey + 1);
		openChat("floating");
	}, [openChat, resetAgentToRovo]);
	useEffect(() => {
		if (chatSurface !== "floating") {
			setFloatingLiveChatRequestKey(0);
		}
	}, [chatSurface]);

	// On the agent config screen the floating Rovo button shows its persistent
	// toolbar variant, mirroring the rovo-button demo.
	const rovoButtonPersistentBar = useMemo<FloatingRovoButtonPersistentBar>(() => ({
		ariaLabel: "Rovo quick actions",
		items: [
			{
				id: "agent-config-rovo-bar-voice",
				ariaLabel: "Talk to Rovo",
				tooltipLabel: "Live chat",
				icon: <AudioWaveformIcon label="" color="currentColor" />,
				onClick: handleStartFloatingRovoVoice,
			},
		],
	}), [handleStartFloatingRovoVoice]);

	const activeHeaderSection: AgentCompactHeaderSection | null =
		activeView === "insights"
			? "insights"
			: activeView === "configure"
				? activeCompactSection ?? "details"
				: null;
	const shouldShowSubagentsNavigator =
		activeView === "configure" &&
		activeCompactSection === null &&
		instructionsViewMode !== "data-flow";

	const restoreCompactSection = useCallback(
		(section: AgentCompactHeaderSection = lastCompactSectionRef.current) => {
			if (section === "insights") {
				setActiveCompactSection(null);
				onViewChange("insights");
				return;
			}
			onViewChange("configure");
			if (section === "details") {
				setActiveCompactSection(null);
				return;
			}
			setActiveCompactSection(
				section === "surfaces" ||
				section === "access" ||
				section === "users" ||
				section === "evaluation"
					? section
					: null,
			);
		},
		[onViewChange],
	);

	const handleViewChange = useCallback(
		(value: string | null) => {
			if (value !== "configure" && value !== "insights" && value !== "test") {
				return;
			}
			if (value === "test") {
				if (activeHeaderSection) {
					lastCompactSectionRef.current = activeHeaderSection;
				}
				handleTest();
				return;
			}
			lastCompactSectionRef.current = value === "insights" ? "insights" : "details";
			setActiveCompactSection(null);
			onViewChange(value);
		},
		[activeHeaderSection, handleTest, onViewChange],
	);

	const handleCompactSectionChange = useCallback(
		(section: AgentCompactHeaderSection) => {
			lastCompactSectionRef.current = section;
			restoreCompactSection(section);
		},
		[restoreCompactSection],
	);

	const handleTestPressedChange = useCallback(
		(pressed: boolean) => {
			if (pressed) {
				if (activeHeaderSection) {
					lastCompactSectionRef.current = activeHeaderSection;
				}
				handleTest();
				return;
			}
			restoreCompactSection(lastCompactSectionRef.current ?? "details");
		},
		[activeHeaderSection, handleTest, restoreCompactSection],
	);

	const compactHeaderNavItems = useMemo(
		() => hasPublishedVersion
			? [AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM, ...AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS]
			: [AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM],
		[hasPublishedVersion],
	);

	// Mirror the avatar the sidebar nav renders for this agent (entry.profile.avatarSrc)
	// so the header + profile cover match instead of falling back to the static default.
	const agentAvatarSrc = entry.profile.avatarSrc;
	// `name` is still required by AgentHeader (accessibility/fallback); the compact
	// nav supplied via `leadingContent` is what actually renders on the left.

	// Base agent shape the floating SubagentsNavigator expects. The navigator only
	// reads `config.name` + `avatarSrc`, so derive both from the live draft.
	const navigatorBaseAgent = useMemo<SubagentsBaseAgent>(
		() => ({ id: profileId, avatarSrc: agentAvatarSrc, config: baseConfig }),
		[agentAvatarSrc, baseConfig, profileId],
	);

	return (
		<>
			<motion.div
				className={cn("flex h-full w-full flex-col overflow-hidden bg-surface", className)}
				data-screen-assistant-target="studio-agent-config-panel"
				initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.24, ease: motionEase.out }}
			>
			<Agent className="flex min-h-0 flex-1 flex-col">
				<Tabs
					className="min-h-0 flex-1"
					onValueChange={handleViewChange}
					value={activeView}
				>
					<AgentHeader
						name={agentName}
						leadingContent={
							<AgentCompactHeaderNav
								activeSection={activeHeaderSection}
								avatarSrc={agentAvatarSrc}
								items={compactHeaderNavItems}
								onSectionChange={handleCompactSectionChange}
							/>
						}
						leadingOverlay={
							<AgentSaveStatusIndicator
								status={sessionAgentSaveStatus}
								savedAt={sessionAgentSavedAt}
							/>
						}
						actions={
							<>
								<AgentMoreOptionsMenu />
								<Toggle
									aria-label="Toggle agent test view"
									className="rounded-[6px] text-text-subtle hover:border-border data-pressed:hover:border-border-selected"
									data-testid="agent-config-test"
									data-screen-assistant-target="studio-agent-config-test"
									onPressedChange={handleTestPressedChange}
									pressed={activeView === "test"}
									size="default"
									type="button"
									variant="outline"
								>
									Test
								</Toggle>
								{hasPublishedVersion ? (
									<AgentPublishDropdown
										changeSummary={unpublishedChangeSummary}
										entry={entry}
										onBackToLatest={() => setPreviewVersionId(null)}
										onPreviewVersion={setPreviewVersionId}
										onPublishUpdate={handlePublish}
										onRestoreVersion={handleRestoreVersion}
										previewVersionId={previewVersionId}
									/>
								) : (
									<Button
										type="button"
										size="default"
										variant="default"
										onClick={handlePublish}
										disabled={!hasPublishChanges}
										data-testid="agent-config-publish"
										data-screen-assistant-target="studio-agent-config-publish"
									>
										Activate
									</Button>
								)}
								{onClose ? (
									<Button
										type="button"
										size="icon"
										variant="ghost"
										onClick={onClose}
										aria-label="Close agent config"
									>
										<CrossIcon label="" spacing="none" />
									</Button>
								) : null}
							</>
						}
					/>
					<TabsContent ref={configureTabRef} value="configure" className="relative min-h-0 flex-1 overflow-hidden data-[hidden]:hidden">
						{activeCompactSection === "evaluation" ? (
							// Evaluation owns its own scroll container, max-width, and
							// padding, so render it full-bleed rather than inside the
							// constrained config wrapper (and skip the subagent navigator).
							<AgentEvaluation />
						) : (
							<>
								{/* Floating switcher to jump between the base agent and its
								    subagents. Self-hides until at least one subagent exists.
								    The wrapper carries the measured `top` so the switcher
								    top-aligns with the first line of the instructions editor. */}
								{shouldShowSubagentsNavigator ? (
									<div
										className="absolute right-4 z-20 hidden md:block"
										style={{ top: navigatorTop }}
									>
										<SubagentsNavigator
											activeSubagentId={activeSubagentId}
											baseAgent={navigatorBaseAgent}
											onCreateSubagent={createSubagent}
											onDeleteSubagent={deleteSubagentById}
											onManageSubagents={() => setIsManageSubagentsOpen(true)}
											onSelectBaseAgent={selectBaseAgent}
											onSelectSubagent={selectSubagent}
											onToggleSubagent={toggleSubagent}
											subagents={subagentPrompts}
										/>
									</div>
								) : null}
								<div
									className={cn(
										"mx-auto flex h-full min-h-0 w-full flex-col px-4",
										// Agent config takes its 24px top space inside the scroll
										// region (compactScrollAreaClassName `pt-6`) so it collapses
										// as soon as the content scrolls; access/surfaces/users keep
										// the fixed `py-4` since they don't share that scroll area.
										// The config fields read best in a narrower 800px column,
										// but that cap lives INSIDE the scroll region (centered on
										// each scroll child via compactScrollAreaClassName) rather
										// than on this wrapper, so the scrollable element spans the
										// full panel width and the wheel works anywhere — not only
										// over the centered column.
										// access/surfaces/users keep the wider max-w-7xl shell.
										(activeCompactSection === "access" ||
											activeCompactSection === "surfaces" ||
											activeCompactSection === "users") &&
											"max-w-7xl py-4",
									)}
								>
									{activeCompactSection === "access" ? (
										<div className="-mr-4 min-h-0 flex-1 overflow-y-auto pr-4">
											<div className="mx-auto w-full max-w-4xl pb-6">
												<AgentAccess onGoToAgentDetails={() => setActiveCompactSection(null)} />
											</div>
										</div>
									) : activeCompactSection === "surfaces" ? (
										<AgentSurfaces className="-mr-4 pr-4" />
									) : activeCompactSection === "users" ? (
										<div
											className="-mr-4 flex min-h-0 flex-1 flex-col overflow-y-auto pr-4"
											data-agent-compact-section="users"
										>
											<AgentUsers />
										</div>
									) : (
										<AgentConfigFields
											config={activeConfig}
											avatarSrc={agentAvatarSrc}
											profileAvatarSrc={agentAvatarSrc}
											profileConfig={baseConfig}
											// Subagents can't own triggers, their own subagents, or
											// conversation starters, so suppress those rows while editing one.
											hiddenConfigFields={isSubagentActive ? SUBAGENT_HIDDEN_CONFIG_FIELDS : undefined}
											// Subagent header: breadcrumb (base agent → subagent) plus the
											// big editable title bound to the subagent's name (its triggerName).
											isSubagent={isSubagentActive}
											baseAgentName={baseConfig.name}
											subagentName={activePrompt?.triggerName}
											onSelectBaseAgent={selectBaseAgent}
											onSubagentNameChange={handleTriggerNameChange}
											subagentCondition={activePrompt?.condition}
											onSubagentConditionChange={handleConditionChange}
											// Pull the scroll area's left edge back 6px (-ml-1.5) so it
											// cancels part of the shared px-4 wrapper. Combined with the
											// scroll area's own px-1.5 ring-clearance inset, content lands
											// flush at 16px from the panel edge (10px wrapper + 6px inset)
											// while the focus-ring clip clearance is preserved. The top
											// gap is split: `pt-2` (8px) lives inside the scrollport and
											// `[&>*:first-child]:mt-2` adds another 8px above the first
											// child, so at rest the profile sits 16px below the header,
											// but only the 8px scrollport padding offsets a sticky child.
											// That way the pinned instructions toolbar sits 8px below the
											// header (the first-child margin scrolls away), matching its
											// 8px bottom padding for symmetric top/bottom spacing. Content
											// still bleeds to the edges mid-scroll (the wrapper drops its
											// fixed py-4 for this branch). The bottom gap is
											// the subtle one: the scrollport's last child (the
											// instructions composer) is `flex-1 min-h-0`, so when its
											// content is tall its `<section>` box collapses to its 0%
											// flex basis while the editor *content* overflows it visibly
											// — that visible overflow is what actually scrolls. So none
											// of these reach the real content end: `pb-4` on the
											// scrollport (Chromium clips trailing padding-block-end in a
											// flex-column scroller), an `::after` spacer (lands after the
											// collapsed section box, mid-scroll), nor `pb-4` on the
											// section itself (its padding rides the collapsed box, ~1300px
											// above the fold — measured). The only element whose bottom IS
											// the scroll-overflow boundary is the editor body
											// (`.rich-text-editor-content`, the last/lowest child of the
											// composer). padding-bottom there extends scrollHeight by 16px
											// and only shows once scrolled to the end. Scoped to this
											// config branch only; access/surfaces/users keep px-4.
											// The 800px reading-width cap now rides on the scroll
											// content itself (`[&>*]:mx-auto [&>*]:w-full
											// [&>*]:max-w-[800px]`) instead of the wrapper, so the
											// scrollable element fills the panel and the content stays
											// centered at 800px.
											compactScrollAreaClassName="-ml-1.5 -mr-4 pr-4 pt-2 [&>*:first-child]:mt-2 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[800px] [&_[data-agent-field=instructions]_.rich-text-editor-content]:pb-4"
											idPrefix={`agent-${profileId}-${activeConfigId}`}
											onTextChange={handleConfigTextChange}
											onProfileTextChange={handleBaseTextChange}
											onProfileAvatarChange={handleBaseAvatarChange}
											onListItemChange={updateListItem}
											onRemoveListItem={removeListItem}
											onToggleListItem={toggleListItem}
											onAddListValues={appendListValues}
											onAppendListItem={appendListItem}
											onConnectTrigger={handleConnectTrigger}
											onInstructionsViewModeChange={setInstructionsViewMode}
											onManageSubagents={() => setIsManageSubagentsOpen(true)}
											onSelectListItem={handleSelectListItem}
											onStartWithTemplate={onStartWithTemplate}
											onAutomationRulesChange={handleAutomationRulesChange}
											// Subagents can't own triggers (the row is hidden), so only
											// expose the automation opener for the base agent.
											registerAutomationDialogOpener={
												isSubagentActive ? undefined : registerAutomationDialogOpener
											}
											onOpenDirectory={handleOpenDirectory}
											selectedListItemIndexByField={{ subagents: selectedSubagentIndex }}
											screenAssistantTargetPrefix="studio-agent-config"
										/>
									)}
								</div>
							</>
						)}
					</TabsContent>
					<TabsContent value="test" keepMounted={false} className="min-h-0 flex-1 data-[hidden]:hidden">
						{testPanel}
					</TabsContent>
					<TabsContent value="insights" keepMounted={false} className="min-h-0 flex-1 data-[hidden]:hidden">
						<AgentInsights />
					</TabsContent>
				</Tabs>
			</Agent>
		</motion.div>
			<Toaster id={STUDIO_AGENT_PUBLISH_TOASTER_ID} position="bottom-left" expand={true} />
			{chatSurface === null ? (
				<FloatingRovoButton
					ariaLabel="Open Rovo chat"
					product="home"
					onButtonClick={handleOpenFloatingRovoChat}
					persistentBar={rovoButtonPersistentBar}
				/>
			) : null}
			<AnimatePresence>
				{chatSurface === "floating" ? (
					<RovoFloatingChat
						key="floating-chat"
						chatContextBar={chatContextBar}
						greeting={chatGreeting}
						hideComposerSourceAndModelControls={Boolean(chatContextBar)}
						sendPromptOptions={chatSendPromptOptions}
						onInterceptSubmit={onChatInterceptSubmit}
						startRealtimeVoiceRequestKey={floatingLiveChatRequestKey}
					/>
				) : null}
			</AnimatePresence>
			<KnowledgeDirectoryDialog
				// Remount per open so `defaultSelectedAppId` re-seeds the step: a
				// plain "Browse knowledge" opens the grid, while picking an app in
				// the "Add knowledge" flyout opens that app's content step.
				key={`knowledge-${directoryKnowledgeAppId ?? "browse"}`}
				addedAppIds={addedKnowledgeAppIds}
				defaultSelectedAppId={directoryKnowledgeAppId}
				open={activeDirectory === "knowledge"}
				onOpenChange={(open) => {
					setActiveDirectory(open ? "knowledge" : null);
					if (!open) {
						setDirectoryKnowledgeAppId(null);
					}
				}}
				onAddKnowledge={handleAddKnowledge}
			/>
			<ToolsDirectoryDialog
				addedToolIds={addedToolIds}
				initialSelectedToolId={directorySelectedToolId}
				open={activeDirectory === "tools"}
				onAddedToolIdsChange={handleDirectoryToolIdsChange}
				onOpenChange={(open) => {
					setActiveDirectory(open ? "tools" : null);
					if (!open) {
						setDirectorySelectedToolId(null);
					}
				}}
				sessionTools={DEMO_SESSION_TOOLS}
				tools={DEMO_TOOLS}
			/>
			<AppsDirectoryDialog
				key={`apps-${directorySelectedAppId ?? "browse"}`}
				variant="experimental"
				addedToolIds={addedAppIds}
				initialSelectedToolId={directorySelectedAppId}
				open={activeDirectory === "apps"}
				onAddedToolIdsChange={handleDirectoryAppIdsChange}
					onAddApp={handleAddApp}
				onOpenChange={(open) => {
					setActiveDirectory(open ? "apps" : null);
					if (!open) {
						setDirectorySelectedAppId(null);
					}
				}}
				tools={DIRECTORY_APPS}
			/>
			<SkillsDirectoryDialog
				key={`skills-${directorySelectedSkillId ?? "browse"}`}
				addedSkillIds={addedSkillIds}
				disabledSkillIds={disabledSkillIds}
				variant="experimental"
				initialDetailSkillId={directorySelectedSkillId}
				onAddSkills={handleAddSkills}
				onOpenChange={(open) => {
					setActiveDirectory(open ? "skills" : null);
					if (!open) {
						setDirectorySelectedSkillId(null);
						setDirectorySkillIds([]);
					}
				}}
				onRemoveSkills={handleRemoveSkills}
				onSelectedSkillIdsChange={setDirectorySkillIds}
				selectionExperience="studio-bulk-add"
				onToggleSkillEnabled={handleToggleSkillEnabled}
				open={activeDirectory === "skills"}
				selectedSkillIds={directorySkillIds}
				skills={DEFAULT_SKILLS}
			/>
			<Memory
				open={activeDirectory === "memory"}
				onOpenChange={(open) => setActiveDirectory(open ? "memory" : null)}
				showTrigger={false}
			/>
			<ConversationStartersDialog
				open={activeDirectory === "conversationStarters"}
				onOpenChange={(open) => setActiveDirectory(open ? "conversationStarters" : null)}
				starters={conversationStarterDialogValue}
				maxStarters={3}
				saveLabel={conversationStarterDialogValue.length > 0 ? "Save" : "Add"}
				onSave={handleSaveConversationStarters}
			/>
			<ManageSubagentsDialog
				open={isManageSubagentsOpen}
				onOpenChange={setIsManageSubagentsOpen}
				onCreateSubagent={() => {
					setIsManageSubagentsOpen(false);
					createSubagent();
				}}
				onDeleteSubagent={deleteSubagentById}
				onReorderSubagents={reorderSubagents}
				onToggleSubagent={toggleSubagent}
				subagents={subagentPrompts}
			/>
			<Dialog
				open={connectingProvider !== null}
				onOpenChange={(open) => {
					if (!open) {
						setConnectingProvider(null);
					}
				}}
			>
				<DialogContent size="sm" showCloseButton={false} className="text-center">
					<DialogTitle className="sr-only">
						Connecting {connectingProvider ? getTriggerProvider(connectingProvider.providerId)?.label : "provider"}
					</DialogTitle>
					{connectingProvider ? (
						<div className="flex flex-col items-center gap-4 py-2">
							<div className="flex size-12 items-center justify-center">
								<AgentTriggerProviderTileIcon trigger={connectingProvider.trigger} />
							</div>
							<div className="flex items-center gap-2 text-text">
								<Spinner />
								<span className="text-sm font-medium">
									Authorizing {getTriggerProvider(connectingProvider.providerId)?.label ?? "provider"}…
								</span>
							</div>
							<p className="text-sm text-text-subtle">
								Connecting your account so this agent&rsquo;s triggers can run.
							</p>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
