// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally reset local card state on thread changes only.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SendPromptOptions } from "@/app/contexts";
import {
	buildClarificationMessageMetadata,
	buildClarificationDismissPrompt,
	buildClarificationSummaryPrompt,
	createClarificationSubmission,
	getLatestQuestionCardPayload,
	type ClarificationAnswers,
	type ParsedQuestionCardPayload,
} from "@/components/projects/shared/lib/question-card-widget";
import {
	getLatestPendingPlanWidget,
	type ParsedPlanWidgetPayload,
} from "@/components/projects/shared/lib/plan-widget";
import {
	getPlanApprovalKeyFromPlanWidget,
	type PlanApprovalSelection,
} from "@/components/projects/shared/lib/plan-approval";
import { useDismissibleCards } from "@/components/projects/shared/hooks/use-dismissible-cards";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { RovoChat } from "../lib/chat-panel-types";
import type { useChatSubmit } from "./use-chat-submit";

interface UseChatPanelDecisionsOptions {
	acceptPlanReview: RovoChat["acceptPlanReview"];
	activeThreadId: RovoChat["activeThreadId"];
	interceptClarificationAnswers: boolean;
	interceptSubmit: ReturnType<typeof useChatSubmit>["interceptSubmit"];
	isLocalConversationActive: boolean;
	isRequestInFlight: boolean;
	isStreamingLifecycleActive: boolean;
	rawUiMessages: ReadonlyArray<RovoUIMessage>;
	resolvedSendPromptOptions: SendPromptOptions | undefined;
	sendPrompt: RovoChat["sendPrompt"];
	submitPlanApproval: RovoChat["submitPlanApproval"];
}

/**
 * Decisions the chat docks above the composer: the latest clarification
 * question card and the latest pending plan approval, with their submit,
 * dismiss, and superseded-plan states.
 */
export function useChatPanelDecisions({
	acceptPlanReview,
	activeThreadId,
	interceptClarificationAnswers,
	interceptSubmit,
	isLocalConversationActive,
	isRequestInFlight,
	isStreamingLifecycleActive,
	rawUiMessages,
	resolvedSendPromptOptions,
	sendPrompt,
	submitPlanApproval,
}: Readonly<UseChatPanelDecisionsOptions>) {
	const activeQuestionCard = useMemo(() => (
		isLocalConversationActive ? null : getLatestQuestionCardPayload(rawUiMessages)
	), [isLocalConversationActive, rawUiMessages]);
	const handleClarificationDismiss = useCallback(
		(questionCard: ParsedQuestionCardPayload) => {
			const dismissPrompt = buildClarificationDismissPrompt(questionCard);
			void sendPrompt(dismissPrompt, {
				...resolvedSendPromptOptions,
				messageMetadata: {
					...(resolvedSendPromptOptions?.messageMetadata ?? {}),
					...buildClarificationMessageMetadata(questionCard, {
						status: "dismissed",
					}),
				},
			});
		},
		[resolvedSendPromptOptions, sendPrompt],
	);

	const {
		shouldShowQuestionCard: shouldShowQuestionCardRaw,
		activeQuestionCardKey,
		hideQuestionCard,
		dismissQuestionCard,
	} = useDismissibleCards({
		activeQuestionCard,
		onDismissQuestionCard: handleClarificationDismiss,
	});
	const shouldShowQuestionCard = !isRequestInFlight && shouldShowQuestionCardRaw;
	const activePendingPlan = useMemo(() => (
		isLocalConversationActive ? null : getLatestPendingPlanWidget(rawUiMessages)
	), [isLocalConversationActive, rawUiMessages]);
	const [dismissedApprovalCardKey, setDismissedApprovalCardKey] = useState<string | null>(null);
	const [isSubmittingPlanApproval, setIsSubmittingPlanApproval] = useState(false);
	const pendingPlanKey = activePendingPlan?.planWidget.deferredToolCallId ?? null;
	const shouldShowApprovalCard =
		activePendingPlan !== null &&
		pendingPlanKey !== dismissedApprovalCardKey &&
		!shouldShowQuestionCard &&
		!isStreamingLifecycleActive;

	useEffect(() => {
		setDismissedApprovalCardKey(null);
		setIsSubmittingPlanApproval(false);
	}, [activeThreadId]);

	const handleClarificationSubmit = useCallback(
		(answers: ClarificationAnswers) => {
			if (!activeQuestionCard) return;

			const clarificationSubmission = createClarificationSubmission(activeQuestionCard, answers);
			const clarificationPrompt = buildClarificationSummaryPrompt(activeQuestionCard, answers);

			// Opt-in: let a deterministic interceptor (e.g. the create-skill flow)
			// handle the answer locally. interceptSubmit returns false when there is
			// no interceptor or it declines, in which case we fall back to the model.
			if (interceptClarificationAnswers) {
				const clarificationMetadata = {
					...(resolvedSendPromptOptions?.messageMetadata ?? {}),
					...buildClarificationMessageMetadata(activeQuestionCard, { answers, status: "answered" }),
				};
				void interceptSubmit(clarificationPrompt, [], { userMetadata: clarificationMetadata }).then((handled) => {
					if (handled) return;
					void sendPrompt(clarificationPrompt, {
						...resolvedSendPromptOptions,
						messageMetadata: clarificationMetadata,
						clarification: clarificationSubmission,
					});
				});
				return;
			}

			const clarificationMetadata = {
				...(resolvedSendPromptOptions?.messageMetadata ?? {}),
				...buildClarificationMessageMetadata(activeQuestionCard, {
					answers,
					status: "answered",
				}),
			};

			void sendPrompt(clarificationPrompt, {
				...resolvedSendPromptOptions,
				messageMetadata: clarificationMetadata,
				clarification: clarificationSubmission,
			});
		},
		[activeQuestionCard, interceptClarificationAnswers, interceptSubmit, resolvedSendPromptOptions, sendPrompt],
	);
	const handleBuildPlan = useCallback(
		(planWidget: ParsedPlanWidgetPayload) => {
			return acceptPlanReview(planWidget);
		},
		[acceptPlanReview],
	);
	const handlePlanApprovalSubmit = useCallback(
		(selection: PlanApprovalSelection) => {
			if (!activePendingPlan) return;
			setIsSubmittingPlanApproval(true);
			void submitPlanApproval(activePendingPlan.planWidget, selection)
				.finally(() => setIsSubmittingPlanApproval(false));
		},
		[activePendingPlan, submitPlanApproval],
	);
	const handleDismissApprovalCard = useCallback(() => {
		setDismissedApprovalCardKey(pendingPlanKey);
	}, [pendingPlanKey]);
	const resolvePlanBuildState = useCallback(
		(planWidget: ParsedPlanWidgetPayload, message: { id: string }) => {
			if (!planWidget.deferredToolCallId) {
				return {};
			}

			const isActivePendingPlan =
				activePendingPlan?.sourceMessageId === message.id &&
				getPlanApprovalKeyFromPlanWidget(activePendingPlan.planWidget) ===
					getPlanApprovalKeyFromPlanWidget(planWidget);
			if (isActivePendingPlan) {
				return {};
			}

			return {
				isBuildDisabled: true,
				buildDisabledReason: activePendingPlan
					? "A newer reply superseded this plan."
					: "This plan is no longer awaiting review.",
			};
		},
		[activePendingPlan],
	);

	return {
		activePendingPlan,
		activeQuestionCard,
		activeQuestionCardKey,
		dismissQuestionCard,
		handleBuildPlan,
		handleClarificationSubmit,
		handleDismissApprovalCard,
		handlePlanApprovalSubmit,
		hideQuestionCard,
		isSubmittingPlanApproval,
		pendingPlanKey,
		resolvePlanBuildState,
		shouldShowApprovalCard,
		shouldShowQuestionCard,
	};
}

export type ChatPanelDecisions = ReturnType<typeof useChatPanelDecisions>;
