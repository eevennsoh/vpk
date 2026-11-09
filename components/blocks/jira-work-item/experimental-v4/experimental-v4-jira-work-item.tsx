"use client";

import { LayoutGroup } from "motion/react";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { useRovoChatControls } from "@/app/contexts";
import type { SkillDirectorySkill } from "@/app/data/directory";
import { getAgentsWorkItemForCard } from "@/components/projects/jira/data/rfp-work-items";
import { WorkItemModalProvider } from "@/app/contexts/context-work-item-modal";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import {
	JiraInsightProvider,
	JiraInsightScrubber,
	useJiraInsight,
	type JiraInsightSource,
	type JiraInsightSnapshot,
} from "@/components/blocks/jira-insight";
import { EMPTY_JIRA_INSIGHT_SNAPSHOT } from "@/components/blocks/jira-insight/data";
import type { InlineReviewComment } from "@/components/blocks/code-review/lib/inline-comments";
import type {
	JiraWorkItemComposerDelivery,
	JiraWorkItemPreset,
	JiraWorkItemState,
} from "@/components/blocks/jira-work-item/data/session-state";
import { SESSION_EPOCH_MS } from "@/components/blocks/jira-work-item/data/session-fixtures";
import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import { ActivityChatCommentsProvider } from "@/components/blocks/jira-work-item/experimental-v4/context-activity-chat-comments";
import {
	FailingChecksComposerProvider,
	useFailingChecksComposer,
} from "@/components/blocks/jira-work-item/experimental-v4/context-failing-checks-composer";
import {
	JiraWorkItemProvider,
	useJiraWorkItemActions,
	useJiraWorkItemMeta,
	useJiraWorkItemState,
} from "@/components/blocks/jira-work-item/experimental-v4/context-jira-work-item";
import {
	MetadataRailProvider,
	useMetadataRail,
} from "@/components/blocks/jira-work-item/experimental-v4/context-metadata-rail";
import { PanelLayoutProvider } from "@/components/blocks/jira-work-item/experimental-v4/context-panel-layout";
import {
	SectionNavigationProvider,
	usePublishInsightsCount,
	useSectionNavigation,
} from "@/components/blocks/jira-work-item/experimental-v4/context-section-navigation";
import { ExperimentalWorkItemDialog } from "@/components/blocks/jira-work-item/experimental-v4/components/experimental-work-item-dialog";
import { ExperimentalWorkItemLayout } from "@/components/blocks/jira-work-item/experimental-v4/components/experimental-work-item-layout";
import { ContextPanel } from "@/components/blocks/jira-work-item/experimental-v4/components/context-panel";
import { ContextResources } from "@/components/blocks/jira-work-item/experimental-v4/components/context-resources";
import { PullRequestsSelect } from "@/components/blocks/jira-work-item/experimental-v4/components/pull-requests-select";
import { WorkItemSectionNav } from "@/components/blocks/jira-work-item/experimental-v4/components/work-item-section-nav";
import { WorkItemSidePanelResizeHandle } from "@/components/blocks/jira-work-item/experimental-v4/components/work-item-side-panel-resize-handle";
import { ActivityPanel } from "@/components/blocks/jira-work-item/experimental-v4/components/activity-panel";
import {
	ActivityComposer,
	type ActivityComposerPullRequestFix,
	type ActivityComposerPullRequestReview,
} from "@/components/blocks/jira-work-item/experimental-v4/components/activity-composer";
import type { PullRequestHeaderSubmitReviewAction } from "@/components/blocks/pull-request-header";
import type { PullRequestReviewSubmission } from "@/components/blocks/pull-request-review";
import type {
	PullRequestFixAgentId,
	PullRequestFixSubmission,
} from "@/components/blocks/pull-request-fix";
import { MetadataRail } from "@/components/blocks/jira-work-item/experimental-v4/components/metadata-rail";
import { FloatingSessionSurface } from "@/components/blocks/jira-work-item/experimental-v4/components/floating-session-surface";
import type { SessionReplyInterceptor } from "@/components/blocks/jira-work-item/experimental-v4/components/floating-session-surface";
import type { CodingAgentId } from "@/components/blocks/jira-work-item/experimental-v4/components/context-title-actions";
import type { WorkItemAutomationRule } from "@/components/blocks/jira-work-item/experimental-v4/components/automation-tab";
import {
	METADATA_PANEL_DEFAULT_WIDTH_PX,
	METADATA_PANEL_FALLBACK_MAX_WIDTH_PX,
	METADATA_PANEL_MIN_WIDTH_PX,
	resolveMetadataPanelMaxWidth,
} from "@/components/blocks/jira-work-item/experimental-v4/lib/layout-constants";
import {
	getPullRequestIdentity,
	selectPullRequestEntries,
	type ActivitySessionThreadConfig,
} from "@/components/blocks/jira-work-item/experimental-v4/lib/jira-activity-adapter";
import { buildPullRequestFixComposerPrompt } from "@/components/blocks/jira-work-item/experimental-v4/lib/failing-checks-composer-context";
import {
	resolvePullRequestDetailData,
	type PullRequestActivity,
	type PullRequestCheck,
	type PullRequestReviewer,
} from "@/components/blocks/jira-work-item/experimental-v4/lib/pull-request-detail-data";
import {
	createSubmittedPullRequestReviewActivity,
	mapReviewVerdictToReviewerStatus,
	PULL_REQUEST_REVIEW_TOASTER_ID,
} from "@/components/blocks/jira-work-item/experimental-v4/lib/pull-request-review-submit";
import { showPullRequestReviewToast } from "@/components/blocks/jira-work-item/experimental-v4/lib/show-pull-request-review-toast";
import { resolveInitialReviewedChapterIds } from "@/components/blocks/jira-work-item/experimental-v4/lib/resolve-initial-reviewed-chapter-ids";
import { resolveNewInsightsCount } from "@/components/blocks/jira-work-item/experimental-v4/lib/new-insights-count";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { Toaster } from "@/components/ui/sonner";

interface ExperimentalV4JiraWorkItemBaseProps {
	activitySessionThread?: ActivitySessionThreadConfig;
	automationRules?: readonly WorkItemAutomationRule[];
	/**
	 * When set, open this pull-request identity after each `stageKey` reset
	 * (once per stage). Used by jira-golden-journey-v2 Review and Fix to land on PR detail
	 * without an extra click. Clearing the PR does not re-open until the next stage.
	 */
	autoOpenPullRequestIdentity?: string | null;
	composerAgents?: readonly AgentSelectorAgent[];
	composerContextBar?: ReactNode;
	/** Optional host-owned controls rendered immediately after the side-chat Add button. */
	composerToolsAfterAdd?: ReactNode;
	initialPreset: JiraWorkItemPreset;
	initialState?: JiraWorkItemState;
	initialStateRevision?: string | number;
	insightsSnapshot?: JiraInsightSnapshot;
	/** Preserve an explicit user dismissal while an authored snapshot updates in place. */
	preserveActiveSessionOnHydration?: boolean;
	onAgentPromptSubmit?: (agentIds: readonly string[], prompt: string) => void;
	onOpenAgentChat?: (agentId: string) => void;
	onPullRequestApprove?: (identity: string) => void;
	/**
	 * Host callback when PullRequestFix submits (Fix / Fix all). Advances
	 * Fix-chapter storytelling with the selected coding agent — does not re-run CI.
	 */
	onPullRequestFix?: (identity: string, agentId: PullRequestFixAgentId) => void;
	onSessionReply?: SessionReplyInterceptor;
	onSkillInvoke?: (skill: SkillDirectorySkill) => boolean | void;
	outputs?: readonly string[];
	primaryCodingAgentId?: CodingAgentId;
	pullRequestApprovalStates?: Readonly<Record<string, "available" | "approved">>;
	/**
	 * When this key changes to a non-null value, open the Activity metadata tab
	 * and scroll to the latest entry (e.g. jira-golden-journey-v2 Plan orchestration), or
	 * to `revealActivityEntryId` when that prop is set.
	 */
	revealActivityKey?: string | number | null;
	/**
	 * Optional Activity entry id to scroll into view when `revealActivityKey`
	 * changes (e.g. Claude Code on Build).
	 */
	revealActivityEntryId?: string | null;
	stageKey?: string;
	/** Override status pill options (defaults to RFP board columns). */
	statusPhases?: readonly string[];
	workItem?: WorkItemData;
	composerDelivery?: JiraWorkItemComposerDelivery;
}

export type ExperimentalV4JiraWorkItemProps = ExperimentalV4JiraWorkItemBaseProps & (
	| { presentation?: "modal"; open: boolean; onClose: () => void }
	| {
		presentation: "inline";
		inlineSurface?: "card" | "card-fill" | "fill";
		open?: never;
		onClose?: never;
	}
);

const NOOP = () => undefined;

interface ExperimentalV4JiraWorkItemContentProps {
	activitySessionThread?: ActivitySessionThreadConfig;
	autoOpenPullRequestIdentity?: string | null;
	automationRules?: readonly WorkItemAutomationRule[];
	composerAgents?: readonly AgentSelectorAgent[];
	composerContextBar?: ReactNode;
	composerToolsAfterAdd?: ReactNode;
	hasInsights: boolean;
	insightsSnapshot: JiraInsightSnapshot;
	inlineSurface: "card" | "card-fill" | "fill";
	onAgentPromptSubmit?: (agentIds: readonly string[], prompt: string) => void;
	onClose: () => void;
	onOpenAgentChat?: (agentId: string) => void;
	onPullRequestApprove?: (identity: string) => void;
	onPullRequestFix?: (identity: string, agentId: PullRequestFixAgentId) => void;
	onSessionReply?: SessionReplyInterceptor;
	onSkillInvoke?: (skill: SkillDirectorySkill) => boolean | void;
	open: boolean;
	outputs?: readonly string[];
	presentation: "modal" | "inline";
	primaryCodingAgentId?: CodingAgentId;
	pullRequestApprovalStates?: Readonly<Record<string, "available" | "approved">>;
	stageKey?: string;
	workItem: WorkItemData;
}

interface PullRequestReviewState {
	identity: string;
	/** Committed inline file comments from the Files / CodeReview surface. */
	inlineComments: readonly InlineReviewComment[];
	reviewedChapterIds: ReadonlySet<string>;
	total: number;
}

interface PullRequestFixComposerState {
	/** Badge label for the expanded PullRequestFix card. */
	checkName: string;
	/** Terse demo agent prompt pasted into the Fix composer on open. */
	defaultValue: string;
}

/** Badge copy for Fix / Fix all — single check uses its name; Fix all aggregates. */
function resolvePullRequestFixCheckName(checks: readonly PullRequestCheck[]): string {
	if (checks.length === 1) {
		return checks[0]?.name ?? "Failing check";
	}
	return `${checks.length} failing checks`;
}

function InsightsAwareComposer({
	hasInsights,
	...composerProps
}: Readonly<ComponentProps<typeof ActivityComposer> & { hasInsights: boolean }>) {
	const { activityEvents } = useJiraWorkItemMeta();
	const { contextResources } = useJiraWorkItemState();
	const { insightsSelected } = useSectionNavigation();
	const { unreadCheckpointIds } = useJiraInsight();
	const activityTimestamps = useMemo(
		() => activityEvents.flatMap((entry) => (
			entry.createdAtMs == null ? [] : [entry.createdAtMs]
		)),
		[activityEvents],
	);
	usePublishInsightsCount(
		resolveNewInsightsCount(
			contextResources,
			hasInsights ? unreadCheckpointIds.length : undefined,
		),
	);

	return insightsSelected && hasInsights ? (
		<JiraInsightScrubber activityTimestamps={activityTimestamps} />
	) : (
		<ActivityComposer {...composerProps} />
	);
}

function InsightsAwareActivityPanel({
	surface = "activity",
	...props
}: Readonly<ComponentProps<typeof ActivityPanel>>) {
	const { onSourceSelect } = useJiraInsight();

	return (
		<ActivityPanel
			{...props}
			onInsightSourceSelect={onSourceSelect}
			surface={surface}
		/>
	);
}

function WorkItemInsightsProvider({
	children,
	onOpenPullRequestIdentity,
	snapshot,
}: Readonly<{
	children: ReactNode;
	onOpenPullRequestIdentity?: (identity: string) => void;
	snapshot: JiraInsightSnapshot;
}>) {
	const actions = useJiraWorkItemActions();
	const { requestRevealLatestActivity } = useMetadataRail();
	const { selectSection } = useSectionNavigation();
	const handleInsightSourceSelect = useCallback((source: JiraInsightSource) => {
		if (source.kind === "work-item-section") {
			selectSection(source.sectionId);
			return;
		}
		if (source.kind === "activity-entry") {
			selectSection("activity");
			requestRevealLatestActivity(source.entryId);
			return;
		}
		if (source.kind === "agent-session") {
			actions.openSession(source.sessionId);
			return;
		}
		if (source.kind === "pull-request") {
			onOpenPullRequestIdentity?.(source.identity);
		}
	}, [actions, onOpenPullRequestIdentity, requestRevealLatestActivity, selectSection]);

	return (
		<JiraInsightProvider onSourceSelect={handleInsightSourceSelect} snapshot={snapshot}>
			{children}
		</JiraInsightProvider>
	);
}

function ExperimentalV4JiraWorkItemContent({
	activitySessionThread,
	autoOpenPullRequestIdentity = null,
	automationRules,
	composerAgents,
	composerContextBar,
	composerToolsAfterAdd,
	hasInsights,
	insightsSnapshot,
	inlineSurface,
	onAgentPromptSubmit,
	onClose,
	onOpenAgentChat,
	onPullRequestApprove,
	onPullRequestFix,
	onSessionReply,
	onSkillInvoke,
	open,
	outputs,
	presentation,
	primaryCodingAgentId,
	pullRequestApprovalStates,
	stageKey,
	workItem,
}: Readonly<ExperimentalV4JiraWorkItemContentProps>) {
	const composerLayoutGroupId = useId();
	const [selectedPullRequestIdentity, setSelectedPullRequestIdentity] = useState<string | null>(null);
	const [pullRequestReviewByIdentity, setPullRequestReviewByIdentity] = useState<
		Readonly<Record<string, PullRequestReviewState>>
	>({});
	const [reviewComposerIdentity, setReviewComposerIdentity] = useState<string | null>(null);
	const [fixComposer, setFixComposer] = useState<PullRequestFixComposerState | null>(null);
	const [pullRequestReviewerStatuses, setPullRequestReviewerStatuses] = useState<
		Readonly<Record<string, PullRequestReviewer["status"]>>
	>({});
	const [submittedReviewActivityByIdentity, setSubmittedReviewActivityByIdentity] = useState<
		Readonly<Record<string, readonly PullRequestActivity[]>>
	>({});
	const [restoreActivityComposerFocus, setRestoreActivityComposerFocus] = useState(false);
	const submittedReviewSequenceRef = useRef(0);
	const previousStageKeyRef = useRef(stageKey);
	const autoOpenedForStageRef = useRef<string | null>(null);
	const { setSuppressActivityPanelReveal } = useMetadataRail();
	const { removeAll: removeFailingChecks } = useFailingChecksComposer();
	const { chatSurface } = useRovoChatControls();
	const { activityEvents } = useJiraWorkItemMeta();
	const { elapsedMs } = useJiraWorkItemState();
	const agentChatOpen = chatSurface === "floating";
	const [metadataPanelMaxWidth, setMetadataPanelMaxWidth] = useState(
		METADATA_PANEL_FALLBACK_MAX_WIDTH_PX,
	);
	const handleDialogBodyWidthChange = useCallback((width: number) => {
		setMetadataPanelMaxWidth(resolveMetadataPanelMaxWidth(width));
	}, []);
	const metadataPanelResize = useSidebarResize({
		defaultWidth: METADATA_PANEL_DEFAULT_WIDTH_PX,
		direction: "rtl",
		maxWidth: metadataPanelMaxWidth,
		minWidth: METADATA_PANEL_MIN_WIDTH_PX,
		minWidthResistance: true,
	});
	const pullRequestEntries = useMemo(() => (
		selectPullRequestEntries(activityEvents, SESSION_EPOCH_MS + elapsedMs).map((entry) => {
			if (!entry.pullRequest) return entry;
			const identity = getPullRequestIdentity(entry.pullRequest);
			if (pullRequestApprovalStates?.[identity] === "approved") {
				return {
					...entry,
					pullRequest: {
						...entry.pullRequest,
						reviewDecision: "approved" as const,
						mergeState: "ready" as const,
					},
				};
			}
			if (pullRequestReviewerStatuses[identity] === "changes-requested") {
				return {
					...entry,
					pullRequest: {
						...entry.pullRequest,
						reviewDecision: "changes-requested" as const,
						mergeState: "blocked" as const,
					},
				};
			}
			return entry;
		})
	), [activityEvents, elapsedMs, pullRequestApprovalStates, pullRequestReviewerStatuses]);
	useLayoutEffect(() => {
		if (
			stageKey === undefined
			|| Object.is(previousStageKeyRef.current, stageKey)
		) {
			return;
		}
		previousStageKeyRef.current = stageKey;
		autoOpenedForStageRef.current = null;
		setSelectedPullRequestIdentity(null);
		setPullRequestReviewByIdentity({});
		setReviewComposerIdentity(null);
		setFixComposer(null);
		setPullRequestReviewerStatuses({});
		setSubmittedReviewActivityByIdentity({});
		submittedReviewSequenceRef.current = 0;
		setRestoreActivityComposerFocus(false);
		removeFailingChecks();
	}, [removeFailingChecks, stageKey]);
	const selectedPullRequestEntry = useMemo(
		() => pullRequestEntries.find((entry) => (
			entry.pullRequest
			&& getPullRequestIdentity(entry.pullRequest) === selectedPullRequestIdentity
		)) ?? null,
		[pullRequestEntries, selectedPullRequestIdentity],
	);
	const pullRequestReviewState = selectedPullRequestIdentity
		? pullRequestReviewByIdentity[selectedPullRequestIdentity] ?? null
		: null;
	// Build/Plan revealActivityKey must not steal the rail away from PR Details.
	useLayoutEffect(() => {
		const suppressed = selectedPullRequestIdentity !== null;
		setSuppressActivityPanelReveal(suppressed);
		return () => {
			setSuppressActivityPanelReveal(false);
		};
	}, [selectedPullRequestIdentity, setSuppressActivityPanelReveal]);
	// Shared by Activity PR titles and "Review pull request" — open the PR and
	// land on Details (PR overview / details rail), not the Activity tab.
	// List-only PRs (no guided-review fixture) stay in the select/metrics and
	// no-op on select so they don't replace the description with empty detail.
	const handlePullRequestSelect = useCallback((entry: JiraActivityEventEntry) => {
		if (!entry.pullRequest) return;
		const detail = resolvePullRequestDetailData(entry);
		const guidedReview = detail?.guidedReview;
		if (!guidedReview) return;
		const identity = getPullRequestIdentity(entry.pullRequest);
		setReviewComposerIdentity(null);
		setFixComposer(null);
		setRestoreActivityComposerFocus(false);
		setSelectedPullRequestIdentity(identity);
		// Retain chapter checks + inline comments when reopening the same PR.
		setPullRequestReviewByIdentity((current) => {
			if (current[identity]) return current;
			return {
				...current,
				[identity]: {
					identity,
					inlineComments: [],
					reviewedChapterIds: resolveInitialReviewedChapterIds(
						guidedReview,
						pullRequestApprovalStates?.[identity],
					),
					total: guidedReview.chapters.length,
				},
			};
		});
	}, [pullRequestApprovalStates]);
	const handlePullRequestIdentitySelect = useCallback((identity: string) => {
		const entry = pullRequestEntries.find((candidate) => (
			candidate.pullRequest
			&& getPullRequestIdentity(candidate.pullRequest) === identity
		));
		if (entry) handlePullRequestSelect(entry);
	}, [handlePullRequestSelect, pullRequestEntries]);
	// jira-golden-journey-v2 Review: open the guided PR once per stage so detail is default.
	useLayoutEffect(() => {
		if (!autoOpenPullRequestIdentity) return;
		const stageToken = stageKey ?? "";
		if (autoOpenedForStageRef.current === stageToken) return;
		const entry = pullRequestEntries.find((candidate) => (
			candidate.pullRequest
			&& getPullRequestIdentity(candidate.pullRequest) === autoOpenPullRequestIdentity
		));
		if (!entry) return;
		autoOpenedForStageRef.current = stageToken;
		handlePullRequestSelect(entry);
	}, [autoOpenPullRequestIdentity, handlePullRequestSelect, pullRequestEntries, stageKey]);
	// Fix / Fix all opens the PullRequestFix card with the demo agent prompt
	// prefilled (not the activity chip path). Story repair runs when the host
	// wires onPullRequestFix on submit.
	const handlePullRequestFixOpen = useCallback((checks: readonly PullRequestCheck[]) => {
		if (checks.length === 0) return;
		removeFailingChecks();
		setRestoreActivityComposerFocus(false);
		setReviewComposerIdentity(null);
		const detail = selectedPullRequestEntry
			? resolvePullRequestDetailData(selectedPullRequestEntry)
			: null;
		const defaultValue = detail
			? buildPullRequestFixComposerPrompt({
				repository: detail.repository,
				number: detail.number,
				url: detail.url,
				headBranch: detail.headBranch,
				baseBranch: detail.baseBranch,
				checks: checks.map((check) => ({
					name: check.name,
					details: check.details,
				})),
			})
			: "";
		setFixComposer({
			checkName: resolvePullRequestFixCheckName(checks),
			defaultValue,
		});
	}, [removeFailingChecks, selectedPullRequestEntry]);
	const handlePullRequestFixSubmit = useCallback<
		(submission: PullRequestFixSubmission) => boolean
	>((submission) => {
		if (!selectedPullRequestIdentity) return false;
		onPullRequestFix?.(selectedPullRequestIdentity, submission.agentId);
		setRestoreActivityComposerFocus(true);
		setFixComposer(null);
		return true;
	}, [onPullRequestFix, selectedPullRequestIdentity]);
	const selectedPullRequestApprovalState = selectedPullRequestIdentity
		? pullRequestApprovalStates?.[selectedPullRequestIdentity]
		: undefined;
	const selectedPullRequestReviewedChapterIds = pullRequestReviewState?.identity === selectedPullRequestIdentity
		? pullRequestReviewState.reviewedChapterIds
		: undefined;
	const pullRequestReviewSubmissionAvailable = Boolean(
		onPullRequestApprove
		&& selectedPullRequestApprovalState === "available"
		&& pullRequestReviewState?.identity === selectedPullRequestIdentity
		&& pullRequestReviewState.reviewedChapterIds.size === pullRequestReviewState.total,
	);
	// Only hard-block Send when approval is already done or the host cannot
	// accept one. Chapter progress / "available" still gate the approve action
	// in `handlePullRequestReviewSubmit` — not the CTA's enabled state — so a
	// typed comment is never stuck behind guided-review prerequisites.
	// Keep Send available after an approval so reviewers can still land
	// Comment / Request changes. Approve itself stays gated in submit.
	const pullRequestReviewSubmitDisabled = !onPullRequestApprove;
	const handlePullRequestChapterReviewedChange = useCallback((
		identity: string,
		chapterId: string,
		reviewed: boolean,
	) => {
		setPullRequestReviewByIdentity((current) => {
			const existing = current[identity];
			if (!existing) return current;
			if (existing.reviewedChapterIds.has(chapterId) === reviewed) return current;
			const reviewedChapterIds = new Set(existing.reviewedChapterIds);
			if (reviewed) {
				reviewedChapterIds.add(chapterId);
			} else {
				reviewedChapterIds.delete(chapterId);
			}
			return { ...current, [identity]: { ...existing, reviewedChapterIds } };
		});
	}, []);
	const handlePullRequestInlineCommentsChange = useCallback((
		identity: string,
		comments: readonly InlineReviewComment[],
	) => {
		setPullRequestReviewByIdentity((current) => {
			const existing = current[identity];
			if (!existing) return current;
			if (
				existing.inlineComments.length === comments.length
				&& existing.inlineComments.every((comment, index) => comment.id === comments[index]?.id)
			) {
				return current;
			}
			return { ...current, [identity]: { ...existing, inlineComments: comments } };
		});
	}, []);
	const handlePullRequestReviewSubmit = useCallback((submission: PullRequestReviewSubmission) => {
		if (!reviewComposerIdentity) return false;
		// Approve still requires guided-chapter progress; Comment / Request changes
		// dismiss and land a review without that gate.
		if (submission.verdict === "approve" && !pullRequestReviewSubmissionAvailable) {
			return false;
		}

		const reviewerStatus = mapReviewVerdictToReviewerStatus(submission.verdict);
		setPullRequestReviewerStatuses((current) => ({
			...current,
			[reviewComposerIdentity]: reviewerStatus,
		}));
		submittedReviewSequenceRef.current += 1;
		const submittedReviewActivity = createSubmittedPullRequestReviewActivity(
			submission,
			{
				id: `submitted-review-${submittedReviewSequenceRef.current}`,
				occurredAtMs: Date.now(),
			},
		);
		setSubmittedReviewActivityByIdentity((current) => ({
			...current,
			[reviewComposerIdentity]: [
				...(current[reviewComposerIdentity] ?? []),
				submittedReviewActivity,
			],
		}));
		if (submission.verdict === "approve") {
			onPullRequestApprove?.(reviewComposerIdentity);
		}
		setReviewComposerIdentity(null);
		setRestoreActivityComposerFocus(false);
		showPullRequestReviewToast(submission.verdict);
		return true;
	}, [onPullRequestApprove, pullRequestReviewSubmissionAvailable, reviewComposerIdentity]);
	const selectedPullRequestReviewerStatus = selectedPullRequestIdentity
		? pullRequestReviewerStatuses[selectedPullRequestIdentity]
		: undefined;
	const selectedSubmittedReviewActivity = selectedPullRequestIdentity
		? submittedReviewActivityByIdentity[selectedPullRequestIdentity] ?? []
		: [];
	const pullRequestSubmitReviewAction = useMemo<PullRequestHeaderSubmitReviewAction | undefined>(() => {
		// Guided PR detail only: show whenever a guided review is open (Guide tab).
		// Opening the review composer is always available; host approval state and
		// chapter progress gate its Send control instead of hiding the transition.
		// Merged PRs hide Submit review entirely (header shows Revert PR).
		if (
			!selectedPullRequestIdentity
			|| selectedPullRequestEntry?.pullRequest?.status !== "Open"
			|| pullRequestReviewState?.identity !== selectedPullRequestIdentity
			|| pullRequestReviewState.total === 0
		) return undefined;

		const { inlineComments, reviewedChapterIds } = pullRequestReviewState;
		const checkedCount = reviewedChapterIds.size + inlineComments.length;
		return {
			ariaLabel: checkedCount > 0
				? `Submit review, ${checkedCount} checked`
				: "Submit review",
			badge: checkedCount > 0 ? String(checkedCount) : undefined,
			// Stay Submit review (and clickable) before merge — approval is not a
			// terminal header state; reviewers can still open and submit again.
			disabled: !onPullRequestApprove,
			label: "Submit review",
			onClick: () => {
				setRestoreActivityComposerFocus(false);
				setFixComposer(null);
				setReviewComposerIdentity(selectedPullRequestIdentity);
			},
		};
	}, [
		onPullRequestApprove,
		pullRequestReviewState,
		selectedPullRequestEntry,
		selectedPullRequestIdentity,
	]);
	const activePullRequestReview = useMemo<ActivityComposerPullRequestReview | undefined>(() => {
		if (
			!reviewComposerIdentity
			|| reviewComposerIdentity !== selectedPullRequestIdentity
			|| pullRequestReviewState?.identity !== reviewComposerIdentity
		) return undefined;

		return {
			commentCount: pullRequestReviewState.inlineComments.length,
			onClose: () => {
				setRestoreActivityComposerFocus(true);
				setReviewComposerIdentity(null);
			},
			onSubmit: handlePullRequestReviewSubmit,
			reviewedCount: pullRequestReviewState.reviewedChapterIds.size,
			reviewedTotal: pullRequestReviewState.total,
			submitDisabled: pullRequestReviewSubmitDisabled,
		};
	}, [
		handlePullRequestReviewSubmit,
		pullRequestReviewState,
		pullRequestReviewSubmitDisabled,
		reviewComposerIdentity,
		selectedPullRequestIdentity,
	]);
	const activePullRequestFix = useMemo<ActivityComposerPullRequestFix | undefined>(() => {
		if (!fixComposer) return undefined;

		return {
			checkName: fixComposer.checkName,
			defaultValue: fixComposer.defaultValue,
			onClose: () => {
				setRestoreActivityComposerFocus(true);
				setFixComposer(null);
			},
			onSubmit: handlePullRequestFixSubmit,
		};
	}, [fixComposer, handlePullRequestFixSubmit]);
	const handlePullRequestClear = useCallback(() => {
		setRestoreActivityComposerFocus(false);
		setReviewComposerIdentity(null);
		setFixComposer(null);
		setSelectedPullRequestIdentity(null);
	}, []);

	return (
		<PanelLayoutProvider>
			<SectionNavigationProvider active={open}>
				<WorkItemInsightsProvider
					onOpenPullRequestIdentity={handlePullRequestIdentitySelect}
					snapshot={insightsSnapshot}
				>
					<Toaster id={PULL_REQUEST_REVIEW_TOASTER_ID} position="bottom-left" />
					<LayoutGroup id={composerLayoutGroupId}>
						<ExperimentalWorkItemDialog
					controlRow={(compact) => (
						<ContextResources
							compact={compact}
							outputs={outputs}
							primaryCodingAgentId={primaryCodingAgentId}
						/>
					)}
						navigation={(
							<WorkItemSectionNav
								endControl={(
									<PullRequestsSelect
										entries={pullRequestEntries}
										selectedIdentity={selectedPullRequestIdentity}
										onSelectEntry={handlePullRequestSelect}
									/>
								)}
								onSectionSelect={selectedPullRequestIdentity ? handlePullRequestClear : undefined}
							/>
						)}
						inlineSurface={inlineSurface}
						open={open}
						onBodyWidthChange={handleDialogBodyWidthChange}
						onClose={onClose}
						presentation={presentation}
						sidebar={<FloatingSessionSurface composerToolsAfterAdd={composerToolsAfterAdd} onSessionReply={onSessionReply} />}
						sidebarOpen={agentChatOpen}
						sidebarResizeHandle={(
							<WorkItemSidePanelResizeHandle
								ariaLabel="Resize agent chat panel"
								className="top-0! bottom-0! left-0! bg-border group-hover/chat-panel:[&>div]:opacity-100"
								resize={metadataPanelResize}
								testId="jira-work-item-chat-resize-handle"
							/>
						)}
						sidebarResizing={metadataPanelResize.isResizing}
						sidebarWidth={metadataPanelResize.sidebarWidth}
						workItemCode={workItem.code}
						workItemTitle={workItem.title}
					>
						<ExperimentalWorkItemLayout
							metadataPanelResizing={metadataPanelResize.isResizing}
							metadataPanelWidth={metadataPanelResize.sidebarWidth}
							context={(scrollContainerRef) => (
								<ContextPanel
									activity={(
									<InsightsAwareActivityPanel
										activitySessionThread={activitySessionThread}
										onOpenPullRequest={handlePullRequestSelect}
									/>
								)}
								hasInsights={hasInsights}
									insightsFeed={(
										<InsightsAwareActivityPanel
											activitySessionThread={activitySessionThread}
											onOpenPullRequest={handlePullRequestSelect}
											surface="insights"
										/>
									)}
									onPullRequestChapterReviewedChange={handlePullRequestChapterReviewedChange}
									onPullRequestInlineCommentsChange={handlePullRequestInlineCommentsChange}
									pullRequestApprovalState={selectedPullRequestApprovalState}
									pullRequestInlineComments={pullRequestReviewState?.inlineComments}
									pullRequestReviewedChapterIds={selectedPullRequestReviewedChapterIds}
									scrollContainerRef={scrollContainerRef}
									selectedPullRequestEntry={selectedPullRequestEntry}
									submittedReviewActivity={selectedSubmittedReviewActivity}
									submitReviewAction={pullRequestSubmitReviewAction}
								/>
							)}
							composer={(
								<InsightsAwareComposer
									agents={composerAgents}
									autoFocus={restoreActivityComposerFocus}
									composerContextBar={composerContextBar}
									hasInsights={hasInsights}
									onAgentPromptSubmit={onAgentPromptSubmit}
									onOpenAgentChat={onOpenAgentChat}
									pullRequestFix={activePullRequestFix}
									pullRequestReview={activePullRequestReview}
									onSkillInvoke={onSkillInvoke}
								/>
							)}
							fillContainer={inlineSurface !== "card"}
							metadata={(
								<div
									aria-hidden={agentChatOpen}
									className="group/metadata-resize relative flex min-h-0 min-w-0 flex-1 flex-col"
									inert={agentChatOpen ? true : undefined}
								>
									<MetadataRail
										automationRules={automationRules}
										borderless
										currentReviewerStatus={selectedPullRequestReviewerStatus}
										onPullRequestFix={handlePullRequestFixOpen}
										selectedPullRequestEntry={selectedPullRequestEntry}
									/>
									<div className="hidden @[860px]/agentlayout:contents">
										{/* The description content ends 24px before the split while rail
										content starts 36px after it (24px shell + 12px rail padding).
										Shift the separator 6px right to sit at that visual midpoint. */}
										<WorkItemSidePanelResizeHandle
											ariaLabel="Resize details and activity panel"
											className="top-[3.875rem]! left-[calc(-1.5rem+0.375rem)]! bg-transparent! hover:bg-transparent! data-[active]:bg-transparent! focus-visible:bg-transparent! focus-visible:ring-0 group-hover/metadata-panel:[&>div]:opacity-100"
											resize={metadataPanelResize}
											testId="jira-work-item-metadata-resize-handle"
										/>
									</div>
								</div>
							)}
							/>
						</ExperimentalWorkItemDialog>
					</LayoutGroup>
				</WorkItemInsightsProvider>
			</SectionNavigationProvider>
		</PanelLayoutProvider>
	);
}

/**
 * Composition root for the experimental v4 Jira Work Item surface.
 *
 * Forked from the v2 tree so v4 can diverge freely without touching v1 or v2.
 * It owns its entire component tree; the session/planner model under `data/` is
 * deliberately shared, so model fixes reach every variant.
 *
 * v4's divergence is a single scroll-linked section nav — Description and
 * Activity, plus Guide and Files while a guided pull request is open —
 * replacing both the metadata-rail Details/Activity toggle and the separate
 * pull-request tab strip.
 *
 * Wraps the whole experience in the block-local `JiraWorkItemProvider` (one
 * shared session-state instance) so the launcher, the embedded session panel,
 * and the Activity `@`-reply composer all act on the same sessions. The session
 * panel replaces the metadata rail while it is open and expands into a
 * full-height sibling column, keeping the chat within the work-item surface.
 */
export function ExperimentalV4JiraWorkItem(props: Readonly<ExperimentalV4JiraWorkItemProps>) {
	const { initialPreset, initialState } = props;
	let presentation: "modal" | "inline";
	let inlineSurface: "card" | "card-fill" | "fill" = "card";
	let open: boolean;
	let onClose: () => void;
	if (props.presentation === "inline") {
		presentation = "inline";
		inlineSurface = props.inlineSurface ?? "card";
		open = true;
		onClose = NOOP;
	} else {
		presentation = "modal";
		open = props.open;
		onClose = props.onClose;
	}
	const defaultWorkItem = useMemo(
		() => getAgentsWorkItemForCard({
				title: "Acmecorp: Prepare for bid recommendation for ESM RFP",
				code: "RFP-101",
			}),
		[],
	);
	const workItem = props.workItem ?? defaultWorkItem;
	const insightsSnapshot = props.insightsSnapshot ?? EMPTY_JIRA_INSIGHT_SNAPSHOT;

	return (
		// Keep the WorkItemModalProvider mounted (isOpen always true) so the reused
		// standard ModalHeader has its context and the Base UI dialog owns its own
		// open/close lifecycle + enter/exit animation. Read-only reuse — the standard
		// modal itself is untouched.
		<WorkItemModalProvider isOpen onClose={onClose} workItem={workItem}>
			<JiraWorkItemProvider
				active={open}
				composerDelivery={props.composerDelivery}
				initialPreset={initialPreset}
				initialState={initialState}
				initialStateRevision={props.initialStateRevision}
				preserveActiveSessionOnHydration={props.preserveActiveSessionOnHydration}
				statusPhases={props.statusPhases}
				workItem={workItem}
			>
				{/* Above content so pull-request select can switch the rail to Details. */}
				<MetadataRailProvider
					revealActivityEntryId={props.revealActivityEntryId}
					revealActivityKey={props.revealActivityKey}
				>
					<ActivityChatCommentsProvider>
						<FailingChecksComposerProvider>
							<ExperimentalV4JiraWorkItemContent
								activitySessionThread={props.activitySessionThread}
								autoOpenPullRequestIdentity={props.autoOpenPullRequestIdentity}
								automationRules={props.automationRules}
								composerAgents={props.composerAgents}
								composerContextBar={props.composerContextBar}
								composerToolsAfterAdd={props.composerToolsAfterAdd}
								hasInsights={props.insightsSnapshot != null}
								insightsSnapshot={insightsSnapshot}
								inlineSurface={inlineSurface}
								onAgentPromptSubmit={props.onAgentPromptSubmit}
								onClose={onClose}
								onOpenAgentChat={props.onOpenAgentChat}
								onPullRequestApprove={props.onPullRequestApprove}
								onPullRequestFix={props.onPullRequestFix}
								onSessionReply={props.onSessionReply}
								onSkillInvoke={props.onSkillInvoke}
								open={open}
								outputs={props.outputs}
								presentation={presentation}
								primaryCodingAgentId={props.primaryCodingAgentId}
								pullRequestApprovalStates={props.pullRequestApprovalStates}
								stageKey={props.stageKey}
								workItem={workItem}
							/>
						</FailingChecksComposerProvider>
					</ActivityChatCommentsProvider>
				</MetadataRailProvider>
			</JiraWorkItemProvider>
		</WorkItemModalProvider>
	);
}

export default ExperimentalV4JiraWorkItem;
