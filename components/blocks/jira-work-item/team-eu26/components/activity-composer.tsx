"use client";

import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
	type Ref,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition, type Variants } from "motion/react";

import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory";
import {
	EDITOR_PALETTE_MENTION_SOURCES,
	mapAgentToMentionItem,
} from "@/components/blocks/editor-palette/data/mention-sources";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import {
	JiraActivityComposer,
	serializeActivityCommentsContext,
} from "@/components/blocks/jira-activity";
import {
	PullRequestReview,
	type PullRequestReviewSubmission,
} from "@/components/blocks/pull-request-review";
import {
	PullRequestFix,
	type PullRequestFixSubmission,
} from "@/components/blocks/pull-request-fix";
import { useActivityChatComments } from "@/components/blocks/jira-work-item/team-eu26/context-activity-chat-comments";
import { useFailingChecksComposer } from "@/components/blocks/jira-work-item/team-eu26/context-failing-checks-composer";
import { useJiraWorkItem } from "@/components/blocks/jira-work-item/team-eu26/context-jira-work-item";
import { useMetadataRail } from "@/components/blocks/jira-work-item/team-eu26/context-metadata-rail";
import { JiraWorkItemComposerMotion } from "@/components/blocks/jira-work-item/team-eu26/components/jira-work-item-composer-motion";
import { JIRA_WORK_ITEM_CURRENT_USER } from "@/components/blocks/jira-work-item/team-eu26/lib/jira-activity-adapter";
import {
	findMentionedAvailableAgents,
	findMentionedWorkingAgentSessions,
	findSteeredWorkingSessions,
} from "@/components/blocks/jira-work-item/team-eu26/lib/activity-composer-session-routing";
import {
	FAILING_CHECKS_COMPOSER_PROMPT,
	serializeFailingChecksContext,
} from "@/components/blocks/jira-work-item/team-eu26/lib/failing-checks-composer-context";
import { CommentsComposerChip } from "@/components/ui-custom/comments-composer-chip";
import { FailingChecksComposerChip } from "@/components/ui-custom/failing-checks-composer-chip";
import {
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor";
import { Tag } from "@/components/ui/tag";
import { motionEase } from "@/lib/motion";

const ACTIVITY_COMMENTS_PROMPT = "Discuss these activity comments.";

const COMPOSER_CONTENT_LAYOUT_TRANSITION = {
	duration: 0.25,
	ease: motionEase.inOut,
} satisfies Transition; // duration-slow + ease-in-out

const COMPOSER_CONTENT_VARIANTS = {
	hidden: {
		opacity: 0,
		transition: {
			duration: 0.1,
			ease: motionEase.in,
		}, // duration-fast + ease-in
	},
	visible: {
		opacity: 1,
		transition: COMPOSER_CONTENT_LAYOUT_TRANSITION,
	},
} satisfies Variants;

const JIRA_WORK_ITEM_MENTION_LABELS = { subagent: "Agents" } as const;
const JIRA_WORK_ITEM_SUGGESTION_VARIANT = { command: "flat", mention: "flat" } as const;
const SESSION_TARGET_MENU_ITEMS = [
	{
		id: "continue",
		label: "Continue in existing session",
		icon: <AiChatIcon label="" size="small" />,
	},
	{
		id: "new",
		label: "Start a new session",
		icon: <AddIcon label="" size="small" />,
	},
] satisfies readonly RichTextSuggestionMenuItem[];

type SessionTargetChoice = "continue" | "new";

interface SessionTargetSelection {
	sessionId: string;
	choice: SessionTargetChoice;
}

export interface ActivityComposerPullRequestReview {
	/** Committed inline file comments; omit or 0 to hide the Comment(s) badge. */
	commentCount?: number;
	onClose: () => void;
	onSubmit: (submission: PullRequestReviewSubmission) => void;
	reviewedCount: number;
	reviewedTotal: number;
	submitDisabled: boolean;
}

export interface ActivityComposerPullRequestFix {
	/** Failing CI check name (or aggregate label) shown beside the Fix heading. */
	checkName: string;
	/**
	 * Demo agent prompt pasted when Fix / Fix all opens the card. Empty/omitted
	 * keeps the placeholder for a manually opened composer.
	 */
	defaultValue?: string;
	onClose: () => void;
	onSubmit: (submission: PullRequestFixSubmission) => boolean | void;
	submitDisabled?: boolean;
}

function ComposerTransitionItem({
	children,
	ref,
	shouldReduceMotion,
}: Readonly<{
	children: ReactNode;
	ref?: Ref<HTMLDivElement>;
	shouldReduceMotion: boolean;
}>) {
	const [isAnimating, setIsAnimating] = useState(false);

	return (
		<motion.div
			animate="visible"
			className="w-full"
			exit={shouldReduceMotion ? undefined : "hidden"}
			initial={shouldReduceMotion ? false : "hidden"}
			layout={shouldReduceMotion ? false : "position"}
			onAnimationComplete={() => setIsAnimating(false)}
			onAnimationStart={() => setIsAnimating(true)}
			ref={ref}
			style={isAnimating && !shouldReduceMotion
				? { willChange: "transform, opacity" }
				: undefined}
			transition={shouldReduceMotion ? { duration: 0 } : COMPOSER_CONTENT_LAYOUT_TRANSITION}
			variants={COMPOSER_CONTENT_VARIANTS}
		>
			{children}
		</motion.div>
	);
}

/**
 * Unified comment/command composer. Reuses the Jira Activity prompt surface while
 * configuring its shared editor palette for direct people, team, and agent picks.
 * Mentioning a working session's agent offers a continue/new-session route; a
 * first-time agent mention invokes that agent and adds it to Crew.
 */
export function ActivityComposer({
	agents,
	autoFocus = false,
	onAgentPromptSubmit,
	onFailingChecksSubmit,
	pullRequestFix,
	pullRequestReview,
}: Readonly<{
	agents?: readonly AgentSelectorAgent[];
	autoFocus?: boolean;
	onAgentPromptSubmit?: (agentIds: readonly string[], prompt: string) => void;
	/** Advances Fix-chapter storytelling when a failing-checks chip is submitted. */
	onFailingChecksSubmit?: () => void;
	onOpenAgentChat?: (agentId: string) => void;
	/** Expanded PullRequestFix card (Fix / Fix all); replaces the activity prompt. */
	pullRequestFix?: ActivityComposerPullRequestFix;
	pullRequestReview?: ActivityComposerPullRequestReview;
}>) {
	const { state, actions, meta } = useJiraWorkItem();
	const { requestRevealLatestActivity } = useMetadataRail();
	const {
		comments: activityChatComments,
		focusRequestKey: activityCommentsFocusKey,
		removeAll: removeActivityChatComments,
	} = useActivityChatComments();
	const {
		checks: failingChecks,
		focusRequestKey: failingChecksFocusKey,
		promptPrefill: failingChecksPromptPrefill,
		removeAll: removeFailingChecks,
	} = useFailingChecksComposer();
	const composerRootRef = useRef<HTMLDivElement>(null);
	const appliedFailingChecksPrefillKeyRef = useRef(0);
	const appliedFailingChecksPrefillTextRef = useRef<string | null>(null);
	const shouldReduceMotion = Boolean(useReducedMotion());
	const availableAgents = agents ?? ROVO_AGENT_SELECTOR_AGENTS;
	const mentionSources = useMemo(() => agents
		? {
			...EDITOR_PALETTE_MENTION_SOURCES,
			subagent: agents.map(mapAgentToMentionItem),
		}
		: EDITOR_PALETTE_MENTION_SOURCES, [agents]);
	const [draft, setDraft] = useState("");
	const [sessionTargetSelection, setSessionTargetSelection] = useState<SessionTargetSelection | null>(null);
	const [selectedSessionTargetIndex, setSelectedSessionTargetIndex] = useState(0);
	const hasActivityChatComments = activityChatComments.length > 0;
	const hasFailingChecks = failingChecks.length > 0;
	const focusRequestKey = activityCommentsFocusKey + failingChecksFocusKey;
	const activityCommentsContext = useMemo(
		() => serializeActivityCommentsContext(meta.workItem, activityChatComments),
		[activityChatComments, meta.workItem],
	);
	const failingChecksContext = useMemo(
		() => serializeFailingChecksContext(failingChecks),
		[failingChecks],
	);
	const activityCommentsInputContext = hasActivityChatComments ? (
		<CommentsComposerChip
			comments={activityChatComments.map((comment) => ({
				id: comment.id,
				title: comment.actorName,
				subtitle: "Comment",
				body: comment.body,
			}))}
			onRemoveAll={removeActivityChatComments}
			removeAllLabel="Remove all activity comments"
			testId="activity-comments-chip"
		/>
	) : null;
	const failingChecksInputContext = hasFailingChecks ? (
		<FailingChecksComposerChip
			checks={failingChecks}
			onRemoveAll={removeFailingChecks}
		/>
	) : null;
	const composerInputContext = hasActivityChatComments || hasFailingChecks ? (
		<div className="flex min-w-0 flex-wrap items-center gap-1">
			{failingChecksInputContext}
			{activityCommentsInputContext}
		</div>
	) : undefined;
	const composerInputContextSubmitText = hasFailingChecks
		? (failingChecksPromptPrefill ?? FAILING_CHECKS_COMPOSER_PROMPT)
		: hasActivityChatComments
			? ACTIVITY_COMMENTS_PROMPT
			: undefined;

	useEffect(() => {
		if (failingChecksFocusKey === 0) {
			return;
		}
		if (
			!failingChecksPromptPrefill
			|| appliedFailingChecksPrefillKeyRef.current === failingChecksFocusKey
		) {
			return;
		}
		appliedFailingChecksPrefillKeyRef.current = failingChecksFocusKey;
		appliedFailingChecksPrefillTextRef.current = failingChecksPromptPrefill;
		setDraft(failingChecksPromptPrefill);
	}, [failingChecksFocusKey, failingChecksPromptPrefill]);

	useEffect(() => {
		if (hasFailingChecks) {
			return;
		}
		const stagedPrefill = appliedFailingChecksPrefillTextRef.current;
		if (!stagedPrefill) {
			return;
		}
		appliedFailingChecksPrefillTextRef.current = null;
		setDraft((current) => (current === stagedPrefill ? "" : current));
	}, [hasFailingChecks]);

	useEffect(() => {
		if (focusRequestKey === 0) {
			return undefined;
		}
		const animationFrame = requestAnimationFrame(() => {
			const dock = composerRootRef.current?.closest<HTMLElement>(
				"[data-jira-work-item-composer-dock]",
			) ?? composerRootRef.current;
			dock?.scrollIntoView({
				behavior: shouldReduceMotion ? "auto" : "smooth",
				block: "nearest",
			});
			const field = composerRootRef.current?.querySelector<HTMLElement>(
				"textarea, [contenteditable='true']",
			);
			field?.focus();
		});
		return () => cancelAnimationFrame(animationFrame);
	}, [focusRequestKey, shouldReduceMotion]);
	const mentionedWorkingAgentSessions = findMentionedWorkingAgentSessions(state.sessions, draft);
	const mentionedWorkingAgentSession = mentionedWorkingAgentSessions.length === 1
		? mentionedWorkingAgentSessions[0]
		: null;
	const hasResolvedSessionTarget = Boolean(
		mentionedWorkingAgentSession
		&& sessionTargetSelection?.sessionId === mentionedWorkingAgentSession.id,
	);
	const showSessionTargetMenu = Boolean(mentionedWorkingAgentSession) && !hasResolvedSessionTarget;
	const startsNewSession = Boolean(
		mentionedWorkingAgentSession
		&& sessionTargetSelection?.sessionId === mentionedWorkingAgentSession.id
		&& sessionTargetSelection.choice === "new",
	);
	const handlePromptChange = (next: string) => {
		setDraft(next);
		const nextMentionedSessions = findMentionedWorkingAgentSessions(state.sessions, next);
		const nextMentionedSession = nextMentionedSessions.length === 1 ? nextMentionedSessions[0] : null;
		setSelectedSessionTargetIndex(0);
		setSessionTargetSelection((currentSelection) =>
			nextMentionedSession && currentSelection?.sessionId === nextMentionedSession.id
				? currentSelection
				: null,
		);
	};

	const chooseSessionTarget = (choice: SessionTargetChoice) => {
		if (!mentionedWorkingAgentSession) {
			return;
		}
		setSessionTargetSelection({ sessionId: mentionedWorkingAgentSession.id, choice });
	};

	const handleSubmit = (body: string) => {
		const text = body.trim();
		if (!text) return;
		const contextParts = [
			activityCommentsContext,
			failingChecksContext,
		].filter(Boolean);
		const promptWithActivityContext = contextParts.length > 0
			? `${text}\n\n${contextParts.join("\n\n")}`
			: text;
		const mentionedAgentSessions = findMentionedWorkingAgentSessions(state.sessions, text);
		const mentionedAgentSession = mentionedAgentSessions.length === 1 ? mentionedAgentSessions[0] : null;
		const shouldStartNewSession = Boolean(
			mentionedAgentSession
			&& sessionTargetSelection?.sessionId === mentionedAgentSession.id
			&& sessionTargetSelection.choice === "new",
		);
		const steeredSessions = findSteeredWorkingSessions(state.sessions, text);
		const handledAgentIds = new Set<string>();
		const handledAgentNames = new Set<string>();
		if (mentionedAgentSession && shouldStartNewSession) {
			actions.invokeAgent(
				{
					id: mentionedAgentSession.agentId,
					name: mentionedAgentSession.agentName,
					avatarSrc: mentionedAgentSession.agentAvatarSrc,
				},
				"prompt",
				promptWithActivityContext,
			);
			handledAgentIds.add(mentionedAgentSession.agentId);
			handledAgentNames.add(mentionedAgentSession.agentName);
		} else {
			for (const steeredSession of steeredSessions) {
				actions.replySession(steeredSession.id, promptWithActivityContext);
				handledAgentIds.add(steeredSession.agentId);
				handledAgentNames.add(steeredSession.agentName);
			}
		}
		const invokedAgents = findMentionedAvailableAgents(
			availableAgents,
			text,
			handledAgentIds,
			handledAgentNames,
		);
		for (const invokedAgent of invokedAgents) {
			actions.invokeAgent(invokedAgent, "prompt", promptWithActivityContext);
		}
		onAgentPromptSubmit?.(
			[...handledAgentIds, ...invokedAgents.map((agent) => agent.id)],
			promptWithActivityContext,
		);
		if (hasFailingChecks) {
			// Story repair path: chip submit advances Fix chapter (checks go green).
			onFailingChecksSubmit?.();
		}
		if (handledAgentIds.size === 0 && invokedAgents.length === 0) {
			if (meta.composerDelivery === "broadcast-active-agents") {
				actions.broadcastComment(promptWithActivityContext);
			} else {
				actions.addComment(promptWithActivityContext);
			}
		} else {
			// Agent mention / assign-style submits land in Activity — open that
			// rail tab and scroll to the newest entry so the result is visible.
			requestRevealLatestActivity();
		}
		removeActivityChatComments();
		removeFailingChecks();
		setDraft("");
		setSessionTargetSelection(null);
		setSelectedSessionTargetIndex(0);
	};

	const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!showSessionTargetMenu) {
			return;
		}
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				event.stopPropagation();
				setSelectedSessionTargetIndex((index) => (index + 1) % SESSION_TARGET_MENU_ITEMS.length);
				break;
			case "ArrowUp":
				event.preventDefault();
				event.stopPropagation();
				setSelectedSessionTargetIndex((index) => (index - 1 + SESSION_TARGET_MENU_ITEMS.length) % SESSION_TARGET_MENU_ITEMS.length);
				break;
			case "Enter":
			case "Tab":
				event.preventDefault();
				event.stopPropagation();
				chooseSessionTarget(SESSION_TARGET_MENU_ITEMS[selectedSessionTargetIndex].id === "new" ? "new" : "continue");
				break;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				chooseSessionTarget("continue");
				break;
			default:
				break;
		}
	};

	const hasExpandedPullRequestComposer = Boolean(pullRequestReview || pullRequestFix);

	return (
		<div onKeyDownCapture={handleKeyDownCapture} ref={composerRootRef}>
			<div className="relative" data-jira-work-item-composer-state="sticky">
				<JiraWorkItemComposerMotion
					layout
					layoutDependency={hasExpandedPullRequestComposer}
					placement="sticky"
				>
					<AnimatePresence initial={false} mode="popLayout">
						{pullRequestReview ? (
							<ComposerTransitionItem key="pull-request-review" shouldReduceMotion={shouldReduceMotion}>
								<PullRequestReview
									autoFocus
									commentCount={pullRequestReview.commentCount}
									defaultVerdict="approve"
									expandOnFocus={false}
									onClose={pullRequestReview.onClose}
									onSubmit={pullRequestReview.onSubmit}
									reviewedCount={pullRequestReview.reviewedCount}
									reviewedTotal={pullRequestReview.reviewedTotal}
									submitDisabled={pullRequestReview.submitDisabled}
									variant="expanded"
								/>
							</ComposerTransitionItem>
						) : pullRequestFix ? (
							<ComposerTransitionItem
								key={`pull-request-fix-${pullRequestFix.checkName}`}
								shouldReduceMotion={shouldReduceMotion}
							>
								<PullRequestFix
									autoFocus
									checkName={pullRequestFix.checkName}
									defaultValue={pullRequestFix.defaultValue}
									expandOnFocus={false}
									onClose={pullRequestFix.onClose}
									onSubmit={pullRequestFix.onSubmit}
									submitDisabled={pullRequestFix.submitDisabled}
									variant="expanded"
								/>
							</ComposerTransitionItem>
						) : (
							<ComposerTransitionItem key="activity" shouldReduceMotion={shouldReduceMotion}>
								<JiraActivityComposer
									autoFocus={autoFocus}
									author={JIRA_WORK_ITEM_CURRENT_USER}
									inputContext={composerInputContext}
									inputContextSubmitText={composerInputContextSubmitText}
									mentionSources={mentionSources}
									mentionSectionLabels={JIRA_WORK_ITEM_MENTION_LABELS}
									onSubmit={handleSubmit}
									onValueChange={handlePromptChange}
									placeholder="Comment, @mention an agent, or / for skills"
									submitAccessory={startsNewSession ? (
										<Tag
											className="self-center"
											color="gray"
											onRemove={() => chooseSessionTarget("continue")}
											removeButtonLabel="Continue in existing session instead"
											shape="rounded"
										>
											New session
										</Tag>
									) : null}
									suggestionVariant={JIRA_WORK_ITEM_SUGGESTION_VARIANT}
									value={draft}
									variant="comment"
								/>
							</ComposerTransitionItem>
						)}
					</AnimatePresence>
				</JiraWorkItemComposerMotion>
				{showSessionTargetMenu && !hasExpandedPullRequestComposer ? (
					<div
						className="absolute inset-x-0 bottom-full z-20 mb-2"
						data-jira-work-item-session-target-menu
					>
						<RichTextSuggestionMenu
							className="rich-text-command-menu-borderless w-full!"
							emptyLabel=""
							items={SESSION_TARGET_MENU_ITEMS}
							onHover={setSelectedSessionTargetIndex}
							onSelect={(item) => chooseSessionTarget(item.id === "new" ? "new" : "continue")}
							selectedIndex={selectedSessionTargetIndex}
							title="Choose agent session"
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
