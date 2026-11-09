"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type Ref } from "react";
import { useInstantTransition } from "motion/react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { DEFAULT_SKILLS } from "@/app/data/directory";
import { useDesignVariants } from "@/components/hooks/use-design-variants";
import { MountOnFirstUse, RetainedView } from "@/components/projects/shared/components/mount-on-first-use";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { Gallery } from "@/components/blocks/gallery";
import { DEVELOPMENT_PANEL_PULL_REQUESTS } from "@/components/blocks/pull-request/data/demo-pull-requests";
import { useRovoChat } from "@/app/contexts/context-rovo-chat";
import { getMessageText } from "@/lib/rovo-ui-messages";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { ButterInlineAgentPickerContext } from "@/components/blocks/jira-issue/project-butter-inline-picker-context";
import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue";
import { toJiraIssueDemoAttachedActivity } from "@/components/blocks/jira-issue/agent-session-demo-attach";
import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
import { PROJECT_BUTTER_MODAL_SIZE } from "@/components/blocks/jira-work-item/project-butter/presentation";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import type { ProjectButterDevelopmentJourneyProps } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-journey";
import { sessionTransferTintSeed } from "@/components/blocks/jira-issue/agent-session-drag";
import { AGENT_BRAND_TINT_FALLBACK, resolveAgentBrandTintColor } from "@/components/blocks/agent-session/agent-brand-tint";
import type { JiraIssueAgentSessionRef } from "@/components/blocks/jira-issue/agent-session-transfer";
import type { ProjectButterRelatedSearchItem, RelatedItemOpener } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { butterRelatedCatalog } from "@/components/projects/butter-v1/data/related-scope";
import type { JiraKanbanCardData } from "@/components/blocks/jira-kanban";
import ExperimentalJiraKanbanPage from "@/components/blocks/jira-kanban/experimental/page";
import { countNeedsInputAgents } from "@/components/blocks/jira-kanban/experimental/lib/board-agent-filter";
import {
	isPulseAgentSession,
	type PulseLooseWork,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { linkJiraKanbanAgentSession, moveJiraKanbanAgentSession, unlinkJiraKanbanAgentSession } from "@/components/blocks/jira-kanban/state";
import {
	useJiraListRowFlashSource,
	type JiraListAssignedAgent,
	type JiraListInsertion,
} from "@/components/blocks/jira-list";

import { HeaderLanyards } from "./components/header-lanyards";
import { statusVariant } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { renderEu26HeaderAssignee } from "@/components/projects/shared/components/eu26-header-assignee";

import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { BUTTER_CHAT_AGENT_PROFILES, BUTTER_DIRECTORY_AGENT_PROFILES, resolveButterChatAgentId } from "@/components/projects/butter-v1/data/chat-agent-profiles";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { JiraViewTabs } from "@/components/projects/jira/components/jira-header";
import {
	DEFAULT_JIRA_WORK_ITEM_VIEW,
	getJiraTabs,
	type JiraWorkItemView,
} from "@/components/projects/jira/data/tabs";
import {
	getJiraWorkItemsTabLabel,
	resolveJiraTab,
} from "@/components/projects/jira/lib/jira-tab-model";
import AppLayout from "@/components/projects/page";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import { ButterList } from "./components/butter-list";
import { ButterAgentSelectorControls, ButterAgentSelectorGallery, type ButterAgentPresentation } from "./components/butter-agent-selector-gallery";
import type { ButterPullRequestStatus } from "./components/butter-gallery-pull-request";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MerchantJourneyCompactControls, MerchantJourneyControls } from "./components/merchant-journey-controls";
import { applyMerchantJourneyToBoard, merchantJourneyAuthoredCard, type MerchantJourneyPhase } from "./data/merchant-journey";
import { BUTTER_GALLERY_ITEMS } from "./data/gallery-items";

import { renderButterAgentActivityIndicator } from "./data/agent-activity-indicators";
import { BUTTER_BOARD_AGENTS, BUTTER_SUGGESTION_DEMO_KEY, toButterAgentActivityFromSession } from "@/components/projects/butter-v1/data/presentation-board";
import {
	toButterDetachedAgentSession,
	BUTTER_PAY_BOARD_AGENTS,
	BUTTER_PAY_CURRENT_USER,
	BUTTER_PAY_HEADER_ASSIGNEES,
	BUTTER_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
	BUTTER_PAY_SESSION_MEMBERS,
} from "./data/presentation-story";
import { useButterAgentSessionSync } from "./hooks/use-butter-agent-session-sync";
import { BUTTER_SEEDED_AGENT_SESSION_OVERRIDES } from "./data/agent-session-sync";
import { useButterGenerativeActions } from "./hooks/use-butter-generative-actions";
import { useButterList } from "./hooks/use-butter-list";
import { useButterAssignmentMove } from "@/components/projects/butter-v1/hooks/use-butter-assignment-move";
import { useButterJourneyReplay } from "@/components/projects/butter-v1/hooks/use-butter-journey-replay";
import { useButterContent } from "./hooks/use-butter-content";
import { BUTTER_WORK_ITEM_PLACEHOLDERS } from "@/components/projects/butter-v1/data/work-item-placeholders";
import { useButterWorkItem } from "@/components/projects/butter-v1/hooks/use-butter-work-item";
import {
	WAC_BOARD_TITLE,
	WAC_HEADER_ASSIGNEES,
	WAC_SEEDED_AGENT_SESSION_OVERRIDES,
	WAC_AGENT_SESSION_SYNC_SOURCE,
	WAC_CURRENT_USER,
	WAC_SESSION_MEMBERS,
} from "./data/wac-content";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));
const SkillDirectoryDialog = dynamic(() => import("@/components/blocks/skill-directory").then((module) => module.SkillDirectoryDialog));
const ButterGalleryPullRequest = dynamic(() => import("./components/butter-gallery-pull-request"));
const DevelopmentPanel = dynamic(() => import("@/components/blocks/development-panel").then((module) => module.DevelopmentPanel));

const BUTTER_DEFAULT_REPORTER = { name: BUTTER_PAY_CURRENT_USER.name, avatarUrl: BUTTER_PAY_CURRENT_USER.avatarSrc };
const WAC_DEFAULT_REPORTER = { name: WAC_CURRENT_USER.name, avatarUrl: WAC_CURRENT_USER.avatarSrc };
const BUTTER_TABS = getJiraTabs(false);
const BUTTER_DEFAULT_TAB_LABEL = getJiraWorkItemsTabLabel(BUTTER_TABS);
const BUTTER_ADD_AGENT_LABEL = "Add agent";
const BUTTER_PINNED_CODING_AGENT_IDS = BUTTER_PAY_BOARD_AGENTS.map((agent) => agent.id);
const BUTTER_SETTINGS_DESIGN_VARIANT_IDS = [
	"kanbanBackground",
	"advancedTimeline",
	"agentSessionColumnResizing",
	"manualLink",
	"autoArrange",
	"sessionStroke",
	"sessionBloom",
	"sessionProximity",
	"sessionPeel",
	"moveVisual",
] as const;
const isButterLooseWorkResumable = () => true;

type ButterWorkItemHandle = {
	open: (card: JiraKanbanCardData, columnTitle: string) => void;
	close: () => void;
};

function ButterWorkItemDialog(props: ComponentProps<typeof ProjectButterJiraWorkItem>) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setMounted(true));
		return () => window.cancelAnimationFrame(frame);
	}, []);
	return <ProjectButterJiraWorkItem {...props} open={mounted && props.open} />;
}

function getMerchantWorkItemProps(issueKey: string, journey: Pick<ComponentProps<typeof ProjectButterJiraWorkItem>, "journeyPhase" | "journeySession" | "journeyControls" | "developmentJourney">) {
	const isMerchant = issueKey === BUTTER_SUGGESTION_DEMO_KEY;
	return {
		initialSuggestion: isMerchant,
		suggestionProfile: isMerchant ? "payments" as const : "default" as const,
		showAuditInActivity: isMerchant,
		autoAssignClaudeToCurrentUser: isMerchant,
		...(isMerchant ? journey : {}),
	};
}

function ButterWorkItemSurface({ ref, defaultReporter, journeyPhase, journeySession, journeyControls, developmentJourney, hideLauncherWhenClosed, onBrowseAgents, onCreateAgent, onAgentSessionStart, onOpenCloudSession, onStoryPointsChange, onAssigneeChange, onWorkItemClose, openRelatedItem, relatedCatalog, ...overlayProps }: ComponentProps<typeof JgpRovoOverlay> & {
	/** Board lookup from a related work key to an opener; keys that are not on the board render as plain text. */
	openRelatedItem: RelatedItemOpener;
	/** Board cards as related-work matches, so composers offer this project's items. */
	relatedCatalog: readonly ProjectButterRelatedSearchItem[];
	ref: Ref<ButterWorkItemHandle>;
	defaultReporter: ComponentProps<typeof ProjectButterJiraWorkItem>["defaultReporter"];
	journeyPhase?: ComponentProps<typeof ProjectButterJiraWorkItem>["journeyPhase"];
	journeySession?: ProjectButterSessionItem;
	journeyControls?: React.ReactNode;
	developmentJourney?: ProjectButterDevelopmentJourneyProps;
	hideLauncherWhenClosed?: boolean;
	onBrowseAgents: () => void;
	onCreateAgent: () => void;
	onAgentSessionStart: (issueKey: string, session: ProjectButterSessionItem) => void;
	onOpenCloudSession: (issueKey: string, issueSummary: string, session: AgentSessionItem & { message: string; prompt?: string }, draft?: string) => Promise<boolean>;
	onStoryPointsChange: (issueKey: string, storyPoints: number | undefined) => void;
	onAssigneeChange: (issueKey: string, assignee: NonNullable<ComponentProps<typeof ProjectButterJiraWorkItem>["currentUser"]>) => void;
	onWorkItemClose: () => void;
}) {
	const workItem = useButterWorkItem();
	const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
	const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
	useLayoutEffect(() => {
		const host = document.createElement("div");
		host.style.display = "contents";
		document.body.appendChild(host);
		const frame = window.requestAnimationFrame(() => setOverlayHost(host));
		return () => { window.cancelAnimationFrame(frame); host.remove(); };
	}, []);
	useLayoutEffect(() => {
		if (overlayHost) (workItem.open && overlayContainer ? overlayContainer : document.body).appendChild(overlayHost);
	}, [overlayContainer, overlayHost, workItem.open]);
	const { openWorkItem, closeWorkItem } = workItem;
	useImperativeHandle(ref, () => ({ open: openWorkItem, close: () => { closeWorkItem(); onWorkItemClose(); } }), [closeWorkItem, onWorkItemClose, openWorkItem]);
	return (
		<>
			{workItem.selection ? (
				<ButterWorkItemDialog
					initialPresentation="modal"
					shell="project"
					initialPreset="filled"
					{...getMerchantWorkItemProps(workItem.selection.workItem.code, { journeyPhase, journeySession, journeyControls, developmentJourney })}
					defaultReporter={defaultReporter}
					currentUser={defaultReporter}
					initialSessions={workItem.selection.initialSessions}
					overlayContainerRef={setOverlayContainer}
					onOpenCloudSession={(session, draft) => workItem.selection ? onOpenCloudSession(workItem.selection.workItem.code, workItem.selection.workItem.title, session, draft) : Promise.resolve(false)}
					onBrowseAgents={onBrowseAgents}
					onCreateAgent={onCreateAgent}
					onAgentSessionStart={(session) => { if (workItem.selection) onAgentSessionStart(workItem.selection.workItem.code, session); }}
					onStoryPointsChange={(points) => { if (workItem.selection) onStoryPointsChange(workItem.selection.workItem.code, points); }}
					onAssigneeChange={(assignee) => { if (workItem.selection) onAssigneeChange(workItem.selection.workItem.code, assignee); }}
					onClose={() => { workItem.closeWorkItem(); onWorkItemClose(); }}
					open={workItem.open}
					openRelatedItem={openRelatedItem}
					relatedScope={{ catalog: relatedCatalog, parentType: workItem.selection.workType }}
					placeholders={BUTTER_WORK_ITEM_PLACEHOLDERS}
					workItem={workItem.selection.workItem}
				/>
			) : null}
			{overlayHost ? <JgpRovoOverlay {...overlayProps} launcher={hideLauncherWhenClosed && !workItem.open ? "hidden" : overlayProps.launcher} portalContainer={overlayHost} contained={workItem.open && Boolean(overlayContainer)} /> : null}
		</>
	);
}

export default function ButterPage(): React.ReactElement {
	const [selectedId, setSelectedId] = useState("board");
	const [journeyResetKey, setJourneyResetKey] = useState(0);
	const [collapsedBoardColumns, setCollapsedBoardColumns] = useState<ReadonlySet<string>>(() => new Set());
	const [agentSelectorResetKey, setAgentSelectorResetKey] = useState(0);
	const [duplicativeSessionsResetKey, setDuplicativeSessionsResetKey] = useState(0);
	const [agentSelectorPresentation, setAgentSelectorPresentation] = useState<ButterAgentPresentation>("inline");
	const [duplicativeSessionsPresentation, setDuplicativeSessionsPresentation] = useState<ButterAgentPresentation>("inline");
	const [pullRequestResetKey, setPullRequestResetKey] = useState(0);
	const [workItemResetKey, setWorkItemResetKey] = useState(0);
	const [pullRequestStatus, setPullRequestStatus] = useState<ButterPullRequestStatus>("open");
	const journeyActive = selectedId === "e2e-journey";
	const standaloneView = selectedId === "board" || selectedId === "list" ? selectedId : undefined;
	const [phase, setPhase] = useState<MerchantJourneyPhase>("prepare");
	const [activeStep, setActiveStep] = useState(0);
	const [journeySession, setJourneySession] = useState<ProjectButterSessionItem>();
	const [jumpRevision, setJumpRevision] = useState(0);
	const [pullRequestVisible, setPullRequestVisible] = useState(false);
	const journeyRef = useRef<{ selectStep: (step: number) => void; cancelReplay: () => void }>(null);
	const [autoFixEnabled, setAutoFixEnabled] = useState(true);
	const [autoMergeEnabled, setAutoMergeEnabled] = useState(true);
	useEffect(() => {
		if (!journeyActive) return;
		const next = phase === "failed" && autoFixEnabled ? "fixing" : phase === "fixing" ? "passed" : phase === "passed" && autoMergeEnabled ? "merged" : null;
		if (!next) return;
		const timeout = window.setTimeout(() => setPhase(next), 5000);
		return () => window.clearTimeout(timeout);
	}, [autoFixEnabled, autoMergeEnabled, journeyActive, jumpRevision, phase]);
	useEffect(() => {
		if (!journeyActive || phase !== "pr") return;
		const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
		const timer = window.setTimeout(() => setPullRequestVisible(true), delay);
		return () => window.clearTimeout(timer);
	}, [journeyActive, jumpRevision, phase]);
	const selectStep = useCallback((step: number) => {
		const phases = ["prepare", "working", "pr", "failed", "merged"] as const;
		const next = phases[step];
		if (!next) return;
		journeyRef.current?.selectStep(step);
		if (step === 2) setPullRequestVisible(false);
		setActiveStep(step);
		setPhase(next);
		if (step >= 1) setJourneySession((session) => session ?? {
			id: "PAY-999:merchant-journey", title: "Improve merchant onboarding", state: "running", host: "cloud", timeLabel: "Just now", message: "Working on the merchant onboarding quickstart.",
			agent: { id: "claude-code", kind: "agent", name: "Claude", brandName: "claude" },
			invokedBy: { name: BUTTER_DEFAULT_REPORTER.name, avatarSrc: BUTTER_DEFAULT_REPORTER.avatarUrl },
		});
		setJumpRevision((current) => current + 1);
	}, []);
	const reset = useCallback(() => { journeyRef.current?.cancelReplay(); setPhase("prepare"); setActiveStep(0); setJourneySession(undefined); setJumpRevision(0); setAutoFixEnabled(true); setAutoMergeEnabled(true); setPullRequestVisible(false); setJourneyResetKey((current) => current + 1); }, []);
	const controls = { onSelectStep: selectStep, activeStep };
	const galleryControls = selectedId === "agent-selector"
		? <ButterAgentSelectorControls presentation={agentSelectorPresentation} onPresentationChange={setAgentSelectorPresentation} />
		: selectedId === "duplicative-sessions"
			? <ButterAgentSelectorControls presentation={duplicativeSessionsPresentation} onPresentationChange={setDuplicativeSessionsPresentation} />
			: selectedId === "pull-request"
				? <ToggleGroup aria-label="Pull request status" onValueChange={(values) => { if (values[0] === "open" || values[0] === "merged") setPullRequestStatus(values[0]); }} size="sm" value={[pullRequestStatus]} variant="outline">
					<ToggleGroupItem value="open">Open PR</ToggleGroupItem>
					<ToggleGroupItem value="merged">Merged PR</ToggleGroupItem>
				</ToggleGroup>
				: null;
	return (
		<div className="relative h-dvh w-full overflow-hidden bg-surface">
			<Gallery
				className={cn("pointer-events-none relative z-50 [&>div:first-child]:pointer-events-auto", selectedId === "pull-request" || selectedId === "work-item" ? "[&_[aria-label='Gallery_items']]:pointer-events-none [&_[aria-label='Gallery_items']>div]:pointer-events-auto" : "[&_[aria-label='Gallery_items']]:pointer-events-auto", galleryControls && "[&>div:first-child_h2]:min-w-0 [&>div:first-child_h2]:max-w-full")}
				items={BUTTER_GALLERY_ITEMS}
				selectedColor={token("color.text")}
				selectedId={selectedId}
				onSelectedChange={setSelectedId}
				title="Project Butter v1"
				showTopBarBorder
				stagePosition="center"
				onReset={(item) => { if (item.id === "e2e-journey" || item.id === "board" || item.id === "list") { setCollapsedBoardColumns(new Set()); reset(); } else if (item.id === "agent-selector") { setAgentSelectorPresentation("inline"); setAgentSelectorResetKey((current) => current + 1); } else if (item.id === "duplicative-sessions") { setDuplicativeSessionsPresentation("inline"); setDuplicativeSessionsResetKey((current) => current + 1); } else if (item.id === "work-item") { setWorkItemResetKey((current) => current + 1); } else if (item.id === "pull-request") { setPullRequestStatus("open"); setPullRequestResetKey((current) => current + 1); } }}
				topBarCenter={journeyActive ? <MerchantJourneyControls {...controls} /> : galleryControls}
				topBarCenterCompact={journeyActive ? <MerchantJourneyCompactControls {...controls} /> : galleryControls}
				renderSelectedItem={(item) => item.id === "development-panel" ? (
					<div className="pointer-events-auto w-full max-w-sm">
						<DevelopmentPanel pullRequests={DEVELOPMENT_PANEL_PULL_REQUESTS} workItem={{ code: "PAY-999", summary: "Improve merchant onboarding for Payments SDK v2", description: "" }} />
					</div>
				) : item.id === "e2e-journey" || item.id === "board" || item.id === "list" || item.id === "agent-selector" || item.id === "duplicative-sessions" || item.id === "work-item" || item.id === "pull-request" ? null : (
					<h2 className="text-center font-semibold text-4xl tracking-tight text-text sm:text-6xl">{item.title}</h2>
				)}
			/>
			<RetainedView active={selectedId === "agent-selector"} retain>
				<div className="pointer-events-none absolute inset-x-0 top-12 bottom-0 flex justify-center overflow-y-auto px-4 pt-4 pb-56">
					<ButterAgentSelectorGallery key={agentSelectorResetKey} presentation={agentSelectorPresentation} />
				</div>
			</RetainedView>
			<RetainedView active={selectedId === "duplicative-sessions"} retain>
				<div className="pointer-events-none absolute inset-x-0 top-12 bottom-0 flex justify-center overflow-y-auto px-4 pt-4 pb-56">
					<ButterAgentSelectorGallery key={duplicativeSessionsResetKey} presentation={duplicativeSessionsPresentation} variant="duplicative-sessions" />
				</div>
			</RetainedView>
			<RetainedView active={selectedId === "work-item"} retain>
				<RovoChatProvider key={workItemResetKey} agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
					<ButterGalleryWorkItem open={selectedId === "work-item"} onClose={() => setSelectedId("board")} />
				</RovoChatProvider>
			</RetainedView>
			<RetainedView active={selectedId === "pull-request"} retain>
				<div key={pullRequestResetKey} className="absolute inset-x-0 top-12 bottom-0 transform-gpu overflow-hidden">
					<ButterGalleryPullRequest status={pullRequestStatus} />
				</div>
			</RetainedView>
			<RetainedView active={journeyActive || Boolean(standaloneView)} retain>
				<div key={journeyResetKey} className="absolute inset-x-0 top-12 bottom-0 transform-gpu overflow-hidden">
						<RovoChatProvider agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
							<ButterApp ref={journeyRef} standaloneView={standaloneView} collapsedColumns={collapsedBoardColumns} onCollapsedColumnsChange={setCollapsedBoardColumns} phase={phase} pullRequestVisible={pullRequestVisible} setPhase={setPhase} journeySession={journeySession} setJourneySession={setJourneySession} journeyControls={<div data-merchant-journey-controls><div className="hidden lg:block"><MerchantJourneyControls {...controls} /></div><div className="lg:hidden"><MerchantJourneyCompactControls {...controls} /></div></div>} autoFixEnabled={autoFixEnabled} setAutoFixEnabled={setAutoFixEnabled} autoMergeEnabled={autoMergeEnabled} setAutoMergeEnabled={setAutoMergeEnabled} />
						</RovoChatProvider>
				</div>
			</RetainedView>
		</div>
	);
}

function ButterGalleryWorkItem({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
	return (
		<>
			<div className="pointer-events-none absolute inset-x-0 top-12 bottom-0 flex items-start justify-center overflow-hidden">
				<div className={cn("pointer-events-auto flex min-h-0 min-w-0", PROJECT_BUTTER_MODAL_SIZE, "h-full max-h-none")}>
					<ProjectButterJiraWorkItem currentUser={BUTTER_DEFAULT_REPORTER} defaultAssignee={BUTTER_DEFAULT_REPORTER} defaultReporter={BUTTER_DEFAULT_REPORTER} initialPreset="filled" onClose={onClose} open={open} shell="gallery" />
				</div>
			</div>
			{open ? <JgpRovoOverlay /> : null}
		</>
	);
}

function ButterSessionPromptObserver({ activeSessionId, isSwitchingSession, onPrompt }: Readonly<{
	activeSessionId: string | null;
	isSwitchingSession: boolean;
	onPrompt: (sessionId: string, prompt: string) => void;
}>) {
	const { uiMessages } = useRovoChat();
	useEffect(() => {
		if (!activeSessionId || isSwitchingSession) return;
		const firstPrompt = uiMessages.find((message) => message.role === "user");
		if (firstPrompt) onPrompt(activeSessionId, getMessageText(firstPrompt));
	}, [activeSessionId, isSwitchingSession, onPrompt, uiMessages]);
	return null;
}

function ButterApp({ ref, standaloneView, collapsedColumns, onCollapsedColumnsChange, phase, pullRequestVisible, setPhase, journeySession, setJourneySession, journeyControls, autoFixEnabled, setAutoFixEnabled, autoMergeEnabled, setAutoMergeEnabled }: Readonly<{
	ref: Ref<{ selectStep: (step: number) => void; cancelReplay: () => void }>;
	standaloneView?: "board" | "list";
	collapsedColumns: ReadonlySet<string>;
	onCollapsedColumnsChange: (columns: ReadonlySet<string>) => void;
	phase: MerchantJourneyPhase;
	pullRequestVisible: boolean;
	setPhase: React.Dispatch<React.SetStateAction<MerchantJourneyPhase>>;
	journeySession?: ProjectButterSessionItem;
	setJourneySession: React.Dispatch<React.SetStateAction<ProjectButterSessionItem | undefined>>;
	journeyControls: React.ReactNode;
	autoFixEnabled: boolean;
	setAutoFixEnabled: React.Dispatch<React.SetStateAction<boolean>>;
	autoMergeEnabled: boolean;
	setAutoMergeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}>): React.ReactElement {
	const boardOnly = standaloneView !== undefined;
	const router = useRouter();
	const { designVariants } = useDesignVariants();
	const { activeSessionId, chatContextBar, externalThinkingMessageId, isSwitchingSession, openAgentChat } = useJgpAgentChatDemo();
	const [agentsDirectoryOpen, setAgentsDirectoryOpen] = useState(false);
	const [skillDirectoryOpen, setSkillDirectoryOpen] = useState(false);
	const browseAgents = useCallback(() => setAgentsDirectoryOpen(true), []);
	const createAgent = useCallback(() => router.push("/studio"), [router]);
	const workItemRef = useRef<ButterWorkItemHandle>(null);
	const pendingWorkItemAssignment = useRef<Readonly<{ issueKey: string; session: AgentSessionItem }> | null>(null);
	const [agentAssignmentRequest, setAgentAssignmentRequest] = useState<Readonly<{ issueKey: string; session: AgentSessionItem }>>();
	const openButterWorkItem = useCallback((card: JiraKanbanCardData, columnTitle: string) => {
		pendingWorkItemAssignment.current = null;
		setAgentAssignmentRequest(undefined);
		workItemRef.current?.open(card.code === BUTTER_SUGGESTION_DEMO_KEY ? merchantJourneyAuthoredCard(card) : card, columnTitle);
	}, []);
	const {
		boardColumns,
		contentMode,
		detachedActivitiesByIdRef,
		detachedAgentSessionsByCard,
		setBoardColumns,
		setDetachedAgentSessionsByCard,
		toggleWacContent,
		wacContent,
	} = useButterContent();
	const { issueMoveRequest, onBoardAssignedAgentIdsChange, onBoardColumnsChange, onSelectedCardsAgentAssign, queueUpdate, startAgentSession } = useButterAssignmentMove({
		agents: BUTTER_BOARD_AGENTS,
		boardColumns,
		setBoardColumns,
	});
	const { active: replayActive, cancel: cancelReplay, start: startReplay } = useButterJourneyReplay({ boardColumns, journeySession, phase, queueUpdate, setBoardColumns, wacContent });
	useEffect(() => {
		if (!replayActive && !wacContent && (phase !== "prepare" || journeySession)) {
			const boardPhase = phase === "pr" && !pullRequestVisible ? "working" : phase;
			setBoardColumns((columns) => applyMerchantJourneyToBoard(columns, boardPhase, journeySession ? toButterAgentActivityFromSession(journeySession) : undefined));
		}
	}, [journeySession, phase, pullRequestVisible, replayActive, setBoardColumns, wacContent]);
	const revealedBoardPhase = useRef<MerchantJourneyPhase | null>(null);
	useEffect(() => {
		if (replayActive || wacContent || (phase !== "working" && phase !== "pr" && phase !== "merged")) { revealedBoardPhase.current = null; return; }
		const column = phase === "merged" ? "Done" : "In progress";
		if (revealedBoardPhase.current === phase || !boardColumns.some((item) => item.title === column && item.cards.some((card) => card.code === BUTTER_SUGGESTION_DEMO_KEY))) return;
		const frame = window.requestAnimationFrame(() => {
			revealedBoardPhase.current = phase;
			document.querySelector<HTMLElement>(`[data-butter-board-surface] [data-issue-key="${BUTTER_SUGGESTION_DEMO_KEY}"][data-board-column-title="${column}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
		});
		return () => window.cancelAnimationFrame(frame);
	}, [boardColumns, phase, replayActive, wacContent]);
	// Same selector the Needs input focus uses, so the count names the rows it shows.
	const needsInputCount = countNeedsInputAgents(boardColumns);
	const {
		composerPrefillRequest,
		prefillComposerText,
		handleCardGenerativeActionSubmit,
		handleComposerPrefillConsumed,
	} =
		useButterGenerativeActions({
			openAgentChat,
			setBoardColumns,
			onStartAgentSession: startAgentSession,
		});
	const cardGenerativeActionFooterActions = {
		onBrowseAgents: browseAgents,
		onBrowseSkills: () => setSkillDirectoryOpen(true),
		onCreateAgent: createAgent,
		onCreateSkill: () => router.push("/skills"),
	};
	// Team EU 26 keeps its page structure fixed: Board and List remain sibling
	// tabs, untracked work remains an in-flow column, and standard kanban chrome
	// stays on. Only the timeline interaction model is user-configurable.
	const tabs = BUTTER_TABS;
	const createWorkItemDropZoneLabel = "Drop to create work item";
	const [workItemView, setWorkItemView] = useState<JiraWorkItemView>(DEFAULT_JIRA_WORK_ITEM_VIEW);
	const [selectedTabLabel, setSelectedTabLabel] = useState(BUTTER_DEFAULT_TAB_LABEL);
	const startInstantTransition = useInstantTransition();
	const activeTab = resolveJiraTab(tabs, selectedTabLabel, workItemView);
	const tabOwnsView = activeTab?.view !== undefined;
	const activeView = standaloneView ?? activeTab?.view ?? workItemView;
	const showBoardContent = boardOnly || activeTab?.hasContent === true;
	const [agentSessionColumnInteracting, setAgentSessionColumnInteracting] = useState(false);
	const defaultSessionSync = useButterAgentSessionSync({
		active: showBoardContent && !wacContent,
		paused: agentSessionColumnInteracting,
	});
	const wacSessionSync = useButterAgentSessionSync({
		active: showBoardContent && wacContent,
		paused: agentSessionColumnInteracting,
		source: WAC_AGENT_SESSION_SYNC_SOURCE,
	});
	const { settled: agentSessionsSettled, reviewAgentSessions, newAgentSessionIds, stateChangeVersions, syncedAgentSessions } = wacContent ? wacSessionSync : defaultSessionSync;
	const handleTabChange = useCallback((tabLabel: string) => {
		const tabView = tabs.find((tab) => tab.label === tabLabel)?.view;
		if (!tabView) {
			setSelectedTabLabel(tabLabel);
			return;
		}

		// Board and List keep their DOM through React Activity. Block Motion's
		// cross-view projection so a hidden chin cannot become the next FLIP origin.
		startInstantTransition(() => {
			setSelectedTabLabel(tabLabel);
			setWorkItemView(tabView);
		});
	}, [startInstantTransition, tabs]);
	const [resumeAnnouncement, setResumeAnnouncement] = useState("");
	// Team EU presents every unlinked session as locally resumable, even when the
	// fixture names a teammate's machine. The card owns the clipboard copy and
	// its own "Copied" label, so the announcement here is the only thing a screen
	// reader hears.
	const handleResumeLooseWork = useCallback((item: PulseLooseWork) => {
		if (!isPulseAgentSession(item)) return;
		setResumeAnnouncement(
			`Resume command copied for ${item.title}. Paste it in a terminal on ${item.machineName} to continue the session.`,
		);
	}, []);
	const handleViewChat = useCallback((activity: JiraIssueAgentActivity, card: JiraKanbanCardData) => {
		if (activity.host === "local") return;
		openAgentChat({
			sessionId: activity.id,
			agentId: resolveButterChatAgentId({ name: activity.name }, activity.id),
			agentName: activity.name,
			issueKey: card.code,
			issueSummary: card.title,
			intro: activity.message,
			request: activity.prompt,
			question: activity.question,
		});
	}, [openAgentChat]);
	const handleCardCreateCloudSession = useCallback((agent: AgentSelectorAgent, card: JiraKanbanCardData) => {
		const session: AgentSessionItem = {
			id: `${card.code}:${crypto.randomUUID()}`,
			agent: { id: agent.id, kind: "agent", name: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo },
			title: card.title,
			state: "needs-input",
			host: "cloud",
			startedAtMs: Date.now(),
			timeLabel: "Just now",
			invokedBy: { name: "Annie Cook", avatarSrc: "/avatar-user/maia-ma/color/asow-dev-lime.png" },
		};
		startAgentSession(card.code, { ...toButterAgentActivityFromSession(session), waitingForPrompt: true });
	}, [startAgentSession]);
	const handleSessionPrompt = useCallback((sessionId: string, prompt: string) => {
		if (!prompt.trim()) return;
		setBoardColumns((columns) => {
			if (!columns.some((column) => column.cards.some((card) => card.agentActivities?.some((activity) => activity.id === sessionId && activity.waitingForPrompt)))) return columns;
			return columns.map((column) => {
				if (!column.cards.some((card) => card.agentActivities?.some((activity) => activity.id === sessionId && activity.waitingForPrompt))) return column;
				return { ...column, cards: column.cards.map((card) => {
					if (!card.agentActivities?.some((activity) => activity.id === sessionId && activity.waitingForPrompt)) return card;
					return { ...card, agentActivities: card.agentActivities.map((activity) => activity.id === sessionId && activity.waitingForPrompt ? { ...activity, state: "working", waitingForPrompt: false, prompt } : activity) };
				}) };
			});
		});
	}, [setBoardColumns]);
	const handleViewCompletedRun = useCallback((run: JiraIssueCompletedAgentRun) => {
		openAgentChat({
			agentId: run.agentName.toLowerCase().replace(/\s+/g, "-"),
			agentName: run.agentName,
			issueKey: run.issueKey,
			issueSummary: run.issueSummary,
			intro: run.description,
		});
	}, [openAgentChat]);
	const handleListAssignedAgentSelect = useCallback((
		issueKey: string,
		agent: JiraListAssignedAgent,
	) => {
		if (agent.host === "local") return;
		const card = boardColumns
			.flatMap((column) => column.cards)
			.find((candidate) => candidate.code === issueKey);
		if (!card) {
			openAgentChat({
				agentId: agent.id,
				agentName: agent.name,
				issueKey,
				issueSummary: "",
			});
			return;
		}

		const activity = card.agentActivities?.find((candidate) => (
			candidate.id === agent.id
			|| candidate.id.endsWith(`:${agent.id}`)
			|| candidate.name === agent.name
		));
		if (activity) {
			handleViewChat(activity, card);
			return;
		}

		const run = card.agentDoneRuns?.find((candidate) => (
			candidate.id === agent.id
			|| candidate.agentName === agent.name
		));
		if (run) {
			handleViewCompletedRun(run);
			return;
		}

		openAgentChat({
			agentId: agent.id,
			agentName: agent.name,
			issueKey: card.code,
			issueSummary: card.title,
		});
	}, [boardColumns, handleViewChat, handleViewCompletedRun, openAgentChat]);
	const handleListIssueOpen = useCallback((issueKey: string) => {
		for (const column of boardColumns) {
			const card = column.cards.find((candidate) => candidate.code === issueKey);
			if (card) { openButterWorkItem(card, column.title); return; }
		}
	}, [boardColumns, openButterWorkItem]);
	const { flash: listRowFlash, flashRow: flashListRow } = useJiraListRowFlashSource();
	const handleListAgentAssigned = useCallback((issueKey: string, agent: AgentSelectorAgent) => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const tint = resolveAgentBrandTintColor(sessionTransferTintSeed(agent.brandName, agent.vpkLogo, agent.name, agent.id)) ?? AGENT_BRAND_TINT_FALLBACK;
		flashListRow(issueKey, `color-mix(in srgb, ${tint} 28%, transparent)`);
	}, [flashListRow]);
	const handleWorkItemSessionStart = useCallback((issueKey: string, session: ProjectButterSessionItem) => {
		const card = boardColumns.flatMap((column) => column.cards).find((candidate) => candidate.code === issueKey);
		if (!card || card.agentActivities?.some((activity) => activity.id === session.id)) return;
		pendingWorkItemAssignment.current = { issueKey, session };
		if (issueKey === BUTTER_SUGGESTION_DEMO_KEY && session.agent.name === "Claude" && (phase === "prepare" || phase === "invoke")) { setJourneySession(session); setPhase("working"); }
		startAgentSession(issueKey, toButterAgentActivityFromSession(session));
	}, [boardColumns, phase, setJourneySession, setPhase, startAgentSession]);
	const handleWorkItemClose = useCallback(() => {
		const pending = pendingWorkItemAssignment.current;
		pendingWorkItemAssignment.current = null;
		if (!pending) return;
		if (activeView === "list") {
			const { issueKey, session } = pending;
			const tint = resolveAgentBrandTintColor(sessionTransferTintSeed(session.agent.brandName, session.agent.vpkLogo, session.agent.name, session.agent.id)) ?? AGENT_BRAND_TINT_FALLBACK;
			if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) flashListRow(issueKey, `color-mix(in srgb, ${tint} 28%, transparent)`);
		} else {
			setAgentAssignmentRequest(pending);
		}
	}, [activeView, flashListRow]);
	useImperativeHandle(ref, () => ({ cancelReplay, selectStep: (step) => {
		startReplay(step);
		const column = boardColumns.find((candidate) => candidate.cards.some((card) => card.code === BUTTER_SUGGESTION_DEMO_KEY));
		const card = column?.cards.find((candidate) => candidate.code === BUTTER_SUGGESTION_DEMO_KEY);
		if (!card || !column) return;
		if (step === 1 || step === 2 || step === 4) {
			workItemRef.current?.close();
			handleTabChange("Board");
		}
		else openButterWorkItem(card, column.title);
	} }), [boardColumns, cancelReplay, handleTabChange, openButterWorkItem, startReplay]);
	const openRelatedItem = useCallback<RelatedItemOpener>((issueKey) => {
		for (const column of boardColumns) {
			const card = column.cards.find((candidate) => candidate.code === issueKey);
			if (card) return () => openButterWorkItem(card, column.title);
		}
		return undefined;
	}, [boardColumns, openButterWorkItem]);
	const relatedCatalog = useMemo(() => butterRelatedCatalog(boardColumns), [boardColumns]);
	const {
		createBoardFromAgentSession,
		createFromAgentSession,
		getProps: getListProps,
		onVisibleRowsChange,
	} = useButterList({
		agents: BUTTER_BOARD_AGENTS,
		boardColumns,
		contentMode,
		listAriaLabel: wacContent ? "Checkout roadmap work items list" : undefined,
		onAgentAssigned: handleListAgentAssigned,
		onAssignedAgentSelect: handleListAssignedAgentSelect,
		onBrowseAgents: browseAgents,
		onCreateAgent: createAgent,
		onIssueOpen: handleListIssueOpen,
		setBoardColumns,
	});
	// Sessions dropped into the list neither select the rows they land in nor
	// leave a badge behind, so the flash carries the acknowledgement. One drop of
	// three marked sessions publishes one flash covering all three rows.
	//
	// It only reaches rows the list is rendering. Board-created cards are
	// assigned to Venn (the prototype current user), so the matching assignee
	// filter keeps the new row visible long enough for this acknowledgement.
	// Unlink always lands in `detachedAgentSessionsByCard`. The Untracked list
	// reads that map, so the session reappears there immediately. Proximity
	// stays off, so it never parks beside the card.
	const handleAgentSessionUnlink = useCallback((session: { id: string }, card: JiraKanbanCardData) => {
		const activity = card.agentActivities?.find((candidate) => candidate.id === session.id);
		if (!activity) return;
		const detachedSession = toButterDetachedAgentSession(activity, card);
		detachedActivitiesByIdRef.current = {
			...detachedActivitiesByIdRef.current,
			[activity.id]: activity,
		};
		setDetachedAgentSessionsByCard((current) => {
			const currentSessions = current[card.code] ?? [];
			return currentSessions.some((candidate) => candidate.id === detachedSession.id)
				? current
				: { ...current, [card.code]: [...currentSessions, detachedSession] };
		});
		setBoardColumns((columns) => unlinkJiraKanbanAgentSession(columns, card.code, session.id));
	}, [detachedActivitiesByIdRef, setBoardColumns, setDetachedAgentSessionsByCard]);
	const consumeDetachedAgentSession = useCallback((session: AgentSessionItem) => {
		const activity = detachedActivitiesByIdRef.current[session.id]
			?? toJiraIssueDemoAttachedActivity(session);
		if (session.id in detachedActivitiesByIdRef.current) {
			const rest = { ...detachedActivitiesByIdRef.current };
			delete rest[session.id];
			detachedActivitiesByIdRef.current = rest;
		}
		setDetachedAgentSessionsByCard((current) => {
			let changed = false;
			const next: Record<string, readonly AgentSessionItem[]> = {};
			for (const [cardCode, sessions] of Object.entries(current)) {
				const nextSessions = sessions.filter((candidate) => candidate.id !== session.id);
				if (nextSessions.length !== sessions.length) {
					changed = true;
				}
				if (nextSessions.length > 0) {
					next[cardCode] = nextSessions;
				}
			}
			return changed ? next : current;
		});
		return activity;
	}, [detachedActivitiesByIdRef, setDetachedAgentSessionsByCard]);
	const handleAgentSessionLink = useCallback((session: AgentSessionItem, card: JiraKanbanCardData) => {
		const activity = consumeDetachedAgentSession(session);
		setBoardColumns((columns) => linkJiraKanbanAgentSession(columns, card.code, activity));
		flashListRow(card.code);
	}, [consumeDetachedAgentSession, flashListRow, setBoardColumns]);
	const handleBoardAgentSessionCreate = useCallback((
		session: AgentSessionItem,
		columnTitle: string,
		insertAtIndex?: number,
		issueType?: JiraKanbanCardData["issueType"],
	) => {
		const activity = consumeDetachedAgentSession(session);
		return createBoardFromAgentSession({
			activity,
			columnTitle,
			insertAtIndex,
			issueType,
			session,
		});
	}, [consumeDetachedAgentSession, createBoardFromAgentSession]);
	const handleListAgentSessionCreate = useCallback((
		session: AgentSessionItem,
		insertion: JiraListInsertion,
	) => {
		const activity = consumeDetachedAgentSession(session);
		flashListRow(createFromAgentSession({
			activity,
			insertion,
			session,
		}));
	}, [consumeDetachedAgentSession, createFromAgentSession, flashListRow]);
	const handleAgentSessionMove = useCallback((
		session: JiraIssueAgentSessionRef,
		sourceCard: JiraKanbanCardData,
		targetCard: JiraKanbanCardData,
	) => {
		setBoardColumns((columns) => moveJiraKanbanAgentSession(
			columns,
			sourceCard.code,
			targetCard.code,
			session.id,
		));
	}, [setBoardColumns]);

	return (
		<>
			<HeaderLanyards>
			<AppLayout
				hideShellChrome={boardOnly}
				chatContextBar={chatContextBar}
				chatPanelFlush
				sidebarChatMount="on-first-open"
				defaultSidebarOpen={false}
				hideFloatingRovo
				product="jira"
				shellHeight="parent"
				currentUser={wacContent ? WAC_CURRENT_USER : undefined}
				settingsDesignVariantIds={BUTTER_SETTINGS_DESIGN_VARIANT_IDS}
				settingsMenuItems={[{
					checked: wacContent,
					id: "butter-wac-content",
					label: "WAC Content",
					onSelect: () => startInstantTransition(toggleWacContent),
				}]}
			>
				<div
					className={cn(
						"h-full min-h-0 min-w-0 overflow-hidden [&>div]:min-h-0",
						designVariants.kanbanBackground ? "bg-bg-accent-gray-subtlest" : "bg-surface",
					)}
					data-butter-board-surface=""
					data-butter-content={wacContent ? "wac" : "default"}
					data-agent-session-sync={agentSessionsSettled ? "settled" : "pending"}
				>
					<ButterInlineAgentPickerContext value={boardOnly}>
					<ExperimentalJiraKanbanPage
						showSessionAddAgent={false}
						boardOnly={boardOnly}
						collapsedColumns={collapsedColumns}
						onCollapsedColumnsChange={onCollapsedColumnsChange}
						addAgentLabel={BUTTER_ADD_AGENT_LABEL}
						activeView={activeView}
						retainWorkItemViews
						additionalAgentSessions={syncedAgentSessions}
						agentSessionSeedOverrides={wacContent ? WAC_SEEDED_AGENT_SESSION_OVERRIDES : BUTTER_SEEDED_AGENT_SESSION_OVERRIDES}
						agentActivityLayout="merged"
						agentSessionMembers={wacContent ? WAC_SESSION_MEMBERS : BUTTER_PAY_SESSION_MEMBERS}
						agentSessionMultiSelect={false}
						cardGenerativeActionFooterActions={cardGenerativeActionFooterActions}
						cardGenerativeActionPinnedAgentIds={BUTTER_PINNED_CODING_AGENT_IDS}
						cardGenerativeActionPresentation="more-actions"
						iconScale="comfortable"
						cardAppearance="project-butter"
						issueSelectionAppearance="fused-backdrop"
						getStatusVariant={statusVariant}
						autoArrangeEnabled={designVariants.autoArrange}
						issueDragTransitions
						issueDropMotion="solitaire"
						issueMoveRequest={issueMoveRequest}
						agentAssignmentRequest={agentAssignmentRequest}
						issueMoveVisual={designVariants.moveVisual}
						createWellBounce="off"
						createWorkItemDropZoneLabel={createWorkItemDropZoneLabel}
						agentSessionAssigneeIdAliases={BUTTER_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID}
						agentSessionLinkingVariant="glow"
						agentSessionPreviewEffect={designVariants.sessionPeel ? "peel" : undefined}
						suggestSessionBoardLinkOnHover={false}
						agentSessionPresentation="column"
						advancedAgentSessionTimeline={designVariants.advancedTimeline}
						agentSessionColumnResizable={designVariants.agentSessionColumnResizing}
						agentSessionColumnGlow={{
							glowBloom: designVariants.sessionBloom,
							glowReach: designVariants.sessionProximity,
							glowStroke: designVariants.sessionStroke,
						}}
						columnChrome="default"
						columnSizing="content"
						agents={BUTTER_BOARD_AGENTS}
						ariaLabel={boardOnly ? "Payments SDK v2 Kanban board" : wacContent ? "Track the Checkout roadmap. Scroll horizontally to review all delivery statuses." : "Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses."}
						boardTitle={wacContent ? WAC_BOARD_TITLE : undefined}
						boardColumns={boardColumns}
						boardFilterScopeKey={contentMode}
						defaultAgentSessionColumnCollapsed={wacContent}
						defaultShowUntracked={false}
						detachedAgentSessionsByCard={detachedAgentSessionsByCard}
						headerAssignees={wacContent ? WAC_HEADER_ASSIGNEES : BUTTER_PAY_HEADER_ASSIGNEES}
						headerAvatarLimit={wacContent ? WAC_HEADER_ASSIGNEES.length + 1 : undefined}
						renderHeaderAssignee={renderEu26HeaderAssignee}
						insightsEnabled={false}
						isLooseWorkResumable={isButterLooseWorkResumable}
						newAgentSessionIds={newAgentSessionIds}
						stateChangeVersions={stateChangeVersions}
						onAgentSessionColumnInteractionChange={setAgentSessionColumnInteracting}
						onAgentSessionsReviewed={reviewAgentSessions}
						onBoardAgentSessionCreate={handleBoardAgentSessionCreate}
						onBoardColumnsChange={onBoardColumnsChange}
						onCardClick={openButterWorkItem}
						onCardAgentActivityViewChat={handleViewChat}
						onCardAssignedAgentIdsChange={onBoardAssignedAgentIdsChange}
						onCardCreateCloudSession={handleCardCreateCloudSession}
						onSelectedCardsAgentAssign={onSelectedCardsAgentAssign}
						onCardAgentDoneRunView={handleViewCompletedRun}
						onCardGenerativeActionSubmit={handleCardGenerativeActionSubmit}
						onCardAgentSessionLink={handleAgentSessionLink}
						onCardAgentSessionMove={handleAgentSessionMove}
						onCardAgentSessionUnlink={handleAgentSessionUnlink}
						onListAgentSessionCreate={handleListAgentSessionCreate}
						showAgentSessionUnlinkWell={false}
						subtaskChrome="stroke"
						onResumeLooseWork={handleResumeLooseWork}
						onViewChange={tabOwnsView ? undefined : setWorkItemView}
						renderListContent={(columns, layout) => (
							<ButterList
								addAgentLabel={BUTTER_ADD_AGENT_LABEL}
								centered={standaloneView === "list"}
								columns={columns}
								getProps={getListProps}
								onVisibleRowsChange={onVisibleRowsChange}
								rowFlash={listRowFlash}
								{...layout}
							/>
						)}
						renderAgentActivityIndicator={renderButterAgentActivityIndicator}
						showAgentSessionColumn={!boardOnly}
						showAgentSessionFlyoutFooter={false}
						showAgentSessionFilter={false}
						showAgentSessionLinkAction={false}
						showAgentSessionLinkWorkItemMenuItem={designVariants.manualLink}
						showAgentSessionOverflow={false}
						showBoardContent={showBoardContent}
						moreControlsPlacement="end"
						showMoreControls
						showCustomizeControl
						simpleViews={false}
						needsInputCount={needsInputCount}
						viewTabs={(
							<JiraViewTabs
								selectedTabLabel={selectedTabLabel}
								onTabChange={handleTabChange}
								tabs={tabs}
								workItemView={workItemView}
							/>
						)}
					/>
					</ButterInlineAgentPickerContext>
				</div>
			</AppLayout>
			</HeaderLanyards>
			{/* Resume swaps the button label to "Copied" — colour and text alone,
			    which a screen reader on the row never hears. Announce it instead. */}
			<span aria-live="polite" className="sr-only" role="status">
				{resumeAnnouncement}
			</span>
			<MountOnFirstUse active={agentsDirectoryOpen}>
				<Suspense fallback={null}>
					<AgentsDirectoryDialog
						agents={BUTTER_DIRECTORY_AGENT_PROFILES}
						variant="standard-v2"
						onCreateAgent={() => router.push("/studio")}
						onOpenChange={setAgentsDirectoryOpen}
						onSelectAgent={() => setAgentsDirectoryOpen(false)}
						open={agentsDirectoryOpen}
					/>
				</Suspense>
			</MountOnFirstUse>
			<MountOnFirstUse active={skillDirectoryOpen}>
				<SkillDirectoryDialog
					onCreateSkill={() => router.push("/skills")}
					onOpenChange={setSkillDirectoryOpen}
					open={skillDirectoryOpen}
					skills={DEFAULT_SKILLS}
				/>
			</MountOnFirstUse>
			<ButterWorkItemSurface
				ref={workItemRef}
				hideLauncherWhenClosed={boardOnly}
				defaultReporter={wacContent ? WAC_DEFAULT_REPORTER : BUTTER_DEFAULT_REPORTER}
				journeyPhase={!wacContent && phase !== "prepare" ? phase : undefined}
				journeySession={!wacContent ? journeySession : undefined}
				journeyControls={!wacContent ? journeyControls : undefined}
				developmentJourney={!wacContent ? {
					phase: phase !== "prepare" && phase !== "invoke" && phase !== "working" ? phase : undefined,
					agentName: "Claude",
					author: { ...BUTTER_DEFAULT_REPORTER, assistedBy: { name: "Claude", brandName: "claude" } },
					autoFixEnabled,
					autoMergeEnabled,
					onAutoFixChange: setAutoFixEnabled,
					onAutoMergeChange: setAutoMergeEnabled,
					onFixCheck: () => setPhase("fixing"),
					onMergePullRequest: () => setPhase("merged"),
				} : undefined}
				onBrowseAgents={browseAgents}
				onCreateAgent={createAgent}
				onAgentSessionStart={handleWorkItemSessionStart}
				onOpenCloudSession={async (issueKey, issueSummary, session, draft) => { const opened = await openAgentChat({
					sessionId: session.id,
					agentId: resolveButterChatAgentId(session.agent, session.id),
					agentName: session.agent.name,
					issueKey,
					issueSummary,
					intro: session.message,
					request: session.prompt,
				}); if (opened && draft) prefillComposerText(draft); return opened; }}
				onStoryPointsChange={(issueKey, storyPoints) => setBoardColumns((columns) => columns.map((column) => ({ ...column, cards: column.cards.map((card) => card.code === issueKey ? { ...card, storyPoints } : card) })))}
				onAssigneeChange={(issueKey, assignee) => setBoardColumns((columns) => columns.map((column) => ({ ...column, cards: column.cards.map((card) => card.code === issueKey ? { ...card, assignee: assignee.name === "Unassigned" || assignee.name === "Automatic" ? undefined : { id: assignee.name === "Venn" ? "venn" : assignee.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: assignee.name, avatarSrc: assignee.avatarUrl }, avatarSrc: assignee.avatarUrl } : card) })))}
				onWorkItemClose={handleWorkItemClose}
				chatContextBar={chatContextBar}
				composerPrefillRequest={composerPrefillRequest}
				externalThinkingMessageId={externalThinkingMessageId}
				isSwitchingSession={isSwitchingSession}
				onComposerPrefillConsumed={handleComposerPrefillConsumed}
				openRelatedItem={openRelatedItem}
				relatedCatalog={relatedCatalog}
			/>
			<ButterSessionPromptObserver activeSessionId={activeSessionId} isSwitchingSession={isSwitchingSession} onPrompt={handleSessionPrompt} />
		</>
	);
}
