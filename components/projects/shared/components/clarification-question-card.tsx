"use client";

import { QuestionCard } from "@/components/blocks/question-card/components/question-card";
import type { QuestionCardAnswers } from "@/components/blocks/question-card/components/question-card";
import type { ClarificationAnswers, ParsedQuestionCardPayload } from "@/components/projects/shared/lib/question-card-widget";

interface ClarificationQuestionCardProps {
	cardClassName?: string;
	questionCard: ParsedQuestionCardPayload;
	isSubmitting?: boolean;
	readOnly?: boolean;
	showDismissButton?: boolean;
	onSubmit: (answers: ClarificationAnswers) => void;
	onDismiss?: () => void;
}

const MAX_VISIBLE_CLARIFICATION_OPTIONS = 3;

export function ClarificationQuestionCard({ cardClassName, questionCard, isSubmitting, readOnly = false, showDismissButton = true, onSubmit, onDismiss }: Readonly<ClarificationQuestionCardProps>): React.ReactElement {
	return (
		<section
			aria-label={readOnly ? "Clarification questions — view only" : "Clarification questions — answer or skip to continue chatting"}
			aria-live="assertive"
		>
			<QuestionCard
				className={cardClassName}
				questions={questionCard.questions}
				isSubmitting={isSubmitting}
				readOnly={readOnly}
				showDismissButton={showDismissButton}
				maxVisibleOptions={MAX_VISIBLE_CLARIFICATION_OPTIONS}
				onSubmit={onSubmit as (answers: QuestionCardAnswers) => void}
				onDismiss={onDismiss}
				toolCallId={questionCard.deferredToolCallId}
			/>
		</section>
	);
}
