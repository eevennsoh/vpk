"use client";

// oxlint-disable react-doctor/no-noninteractive-tabindex -- These surfaces intentionally receive keyboard focus for application-style keyboard handling or card-level shortcuts.
// oxlint-disable react-doctor/prefer-html-dialog -- These are embedded styled cards, not browser top-layer dialog elements.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import ReturnIcon from "@atlaskit/icon-lab/core/return";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { shouldShowQuestionCardFooter } from "@/components/blocks/question-card/lib/footer-actions";
import { getVisibleOptionCount } from "@/components/blocks/question-card/lib/option-slots";
import { getSelectedValues } from "@/components/blocks/question-card/lib/question-helpers";
import { getQuestionSignature, useQuestionCard } from "@/components/blocks/question-card/hooks/use-question-card";
import type { QuestionCardAnswerValue, QuestionCardAnswers, QuestionCardQuestion } from "../types";
import { motionEase } from "@/lib/motion";

// Re-export types for backward compatibility
export type { QuestionCardOption, QuestionCardQuestion, QuestionCardAnswerValue, QuestionCardAnswers } from "../types";

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface QuestionCardProps extends Omit<React.ComponentProps<"div">, "onSubmit"> {
	/** Ordered list of questions to present. */
	questions: ReadonlyArray<QuestionCardQuestion>;
	/** When `true`, all interactions are disabled and a loading state is shown. */
	isSubmitting?: boolean;
	/** Called with the collected answers when the user completes all questions or clicks Submit. */
	onSubmit: (answers: QuestionCardAnswers) => void;
	/** Called when the user dismisses the card (Escape, Skip for deferred cards, or header close). When omitted, the dismiss button is hidden. */
	onDismiss?: () => void;
	/** When set, Skip closes the whole card (deferred clarification); parent should cancel the tool in `onDismiss`. */
	toolCallId?: string;
	/** Maximum number of pre-defined options to display per question. Additional options are truncated. @default 3 */
	maxVisibleOptions?: number;
	/** Placeholder text for the free-form custom input row. @default "Tell Rovo what to do..." */
	customInputPlaceholder?: string;
	/** Whether to show the free-form custom input row after the option list. @default true */
	showCustomInput?: boolean;
	/** Initial answers to pre-populate. Keys are question IDs. */
	defaultAnswers?: QuestionCardAnswers;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_VISIBLE_OPTIONS = 3;
const DEFAULT_CUSTOM_INPUT_PLACEHOLDER = "Tell Rovo what to do...";

// ---------------------------------------------------------------------------
// Question transition animation
// ---------------------------------------------------------------------------

const SLIDE_OFFSET = 12;
const SLIDE_TRANSITION = { duration: 0.2, ease: motionEase.inOut } as const; // --duration-medium (200ms), --ease-in-out

type SlideDirection = "forward" | "backward";

const slideVariants = {
	enter: (d: SlideDirection) => ({ x: d === "forward" ? SLIDE_OFFSET : -SLIDE_OFFSET, opacity: 0 }),
	center: { x: 0, opacity: 1 },
};

const noMotionVariants = {
	enter: { x: 0, opacity: 1 },
	center: { x: 0, opacity: 1 },
};

// ---------------------------------------------------------------------------
// QuestionOptionRow (internal)
// ---------------------------------------------------------------------------

interface QuestionOptionRowProps {
	index: number;
	label: string;
	description?: string;
	selected: boolean;
	focused: boolean;
	disabled: boolean;
	kind: QuestionCardQuestion["kind"];
	onPress: () => void;
	onMouseEnter: () => void;
}

function QuestionOptionRow({
	index,
	label,
	description,
	selected,
	focused,
	disabled,
	kind,
	onPress,
	onMouseEnter,
}: Readonly<QuestionOptionRowProps>): React.ReactElement {
	const isMultiSelect = kind === "multi-select";

	return (
		<li data-slot="question-card-option">
			<button
				type="button"
				aria-pressed={selected}
				disabled={disabled}
				onClick={onPress}
				onMouseEnter={onMouseEnter}
				tabIndex={-1}
				className={cn(
					"group/option flex w-full items-center gap-4 rounded-lg px-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50",
					selected ? "bg-bg-selected" : focused ? "bg-bg-neutral-subtle-hovered" : "bg-surface",
				)}
			>
				<span
					data-slot="question-card-option-index"
					className={cn(
						"inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border bg-surface text-sm leading-5 font-medium",
						selected ? "border-border-selected text-text-selected" : "border-border text-text",
					)}
				>
					{index + 1}
				</span>
				<span data-slot="question-card-option-content" className="min-w-0 flex-1">
					<span className={cn("block whitespace-normal break-words text-sm leading-5 font-medium", selected ? "text-text-selected" : "text-text")}>{label}</span>
					{description ? <span className={cn("block text-sm leading-5 font-normal", selected ? "text-text-selected" : "text-text-subtle")}>{description}</span> : null}
				</span>
				{isMultiSelect ? (
					<span
						data-slot="question-card-option-checkbox"
						aria-hidden="true"
						className={cn(
							"inline-flex size-4 shrink-0 items-center justify-center rounded-sm border",
							selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-bg-input",
						)}
					>
						{selected ? <CheckMarkIcon label="" size="small" /> : null}
					</span>
				) : null}
				{!isMultiSelect ? (
					<span
						aria-hidden="true"
						className={cn(
							"inline-flex size-6 shrink-0 items-center justify-center text-icon-disabled opacity-0",
							focused && "opacity-100",
						)}
					>
						<ReturnIcon label="" />
					</span>
				) : null}
			</button>
		</li>
	);
}

// ---------------------------------------------------------------------------
// QuestionInput (internal)
// ---------------------------------------------------------------------------

interface QuestionInputProps {
	question: QuestionCardQuestion;
	answerValue: QuestionCardAnswerValue | undefined;
	focusedIndex: number;
	isSubmitting: boolean;
	maxVisibleOptions: number;
	onFocusIndex: (index: number) => void;
	onAnswerChange: (value: QuestionCardAnswerValue, options?: Readonly<{ autoAdvance?: boolean }>) => void;
}

function QuestionInput({
	question,
	answerValue,
	focusedIndex,
	isSubmitting,
	maxVisibleOptions,
	onFocusIndex,
	onAnswerChange,
}: Readonly<QuestionInputProps>): React.ReactElement | null {
	const selectedValues = getSelectedValues(answerValue);
	const visibleOptionCount = getVisibleOptionCount(question.options.length, maxVisibleOptions);
	const visibleOptions = question.options.slice(0, visibleOptionCount);

	if (visibleOptionCount === 0) {
		return null;
	}

	return (
		<ul data-slot="question-card-options" className="m-0 flex list-none flex-col gap-1 p-0" role="group" aria-label={question.label}>
			{visibleOptions.map((option, index) => {
				const isSelected = selectedValues.includes(option.id);
				return (
					<QuestionOptionRow
						key={option.id}
						index={index}
						label={option.label}
						description={option.description}
						selected={isSelected}
						focused={focusedIndex === index}
						disabled={isSubmitting}
						kind={question.kind}
						onMouseEnter={() => onFocusIndex(index)}
						onPress={() => {
							if (question.kind === "single-select") {
								onAnswerChange(option.id, { autoAdvance: true });
								return;
							}

							const nextValues = isSelected ? selectedValues.filter((value) => value !== option.id) : [...selectedValues, option.id];
							onAnswerChange(nextValues);
						}}
					/>
				);
			})}
		</ul>
	);
}

// ---------------------------------------------------------------------------
// QuestionCard
// ---------------------------------------------------------------------------

function QuestionCardContent({
	questions,
	isSubmitting = false,
	onSubmit,
	onDismiss,
	toolCallId,
	maxVisibleOptions = DEFAULT_MAX_VISIBLE_OPTIONS,
	customInputPlaceholder = DEFAULT_CUSTOM_INPUT_PLACEHOLDER,
	showCustomInput = true,
	defaultAnswers,
	className,
	...props
}: Readonly<QuestionCardProps>): React.ReactElement {
	const {
		cardRef,
		customInputRef,
		footerButtonRef,
		navigationDirection,
		answers,
		focusedIndex,
		setFocusedIndex,
		currentQuestion,
		safeQuestionIndex,
		totalQuestions,
		hasMultipleQuestions,
		canGoToPreviousQuestion,
		canGoToNextQuestion,
		visibleOptionCount,
		customInputValue,
		customOptionIndex,
		primaryAction,
		goToNextQuestion,
		goToPreviousQuestion,
		handleNext,
		handleAnswerChange,
		handleCustomInputFocus,
		handleKeyDown,
		onSubmit: handleSubmit,
		onDismiss: handleDismiss,
	} = useQuestionCard({
		questions,
		isSubmitting,
		maxVisibleOptions,
		showCustomInput,
		defaultAnswers,
		toolCallId,
		onSubmit,
		onDismiss,
	});
	const shouldReduceMotion = useReducedMotion();
	const direction = navigationDirection;
	const variants = shouldReduceMotion ? noMotionVariants : slideVariants;
	const footerActionLabel = primaryAction === "submit"
		? (isSubmitting ? "Submitting..." : "Submit")
		: "Next";
	const showFooter = shouldShowQuestionCardFooter(showCustomInput, primaryAction);
	let footerActionButton: React.ReactNode = null;
	switch (primaryAction) {
		case "submit":
			footerActionButton = (
				<Button ref={footerButtonRef} disabled={isSubmitting} onClick={handleSubmit} tabIndex={-1} className="shrink-0">
					{footerActionLabel}
				</Button>
			);
			break;
		case "next":
			footerActionButton = (
				<Button ref={footerButtonRef} variant="outline" disabled={isSubmitting} onClick={handleNext} tabIndex={-1} className="shrink-0">
					{footerActionLabel}
				</Button>
			);
			break;
		case "skip":
			footerActionButton = null;
			break;
		default: {
			const _exhaustive: never = primaryAction;
			footerActionButton = _exhaustive;
		}
	}

	return (
		<div
			ref={cardRef}
			data-slot="question-card"
			data-testid="question-card"
			tabIndex={0}
			role="dialog"
			aria-modal="true"
			aria-label={`Question ${safeQuestionIndex + 1} of ${totalQuestions}: ${currentQuestion.label}`}
			onKeyDown={handleKeyDown}
			className={cn("mx-auto flex max-h-[min(70vh,32rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_-2px_50px_8px_rgba(30,31,33,0.08)] outline-none", className)}
			{...props}
		>
			<header data-slot="question-card-header" className={cn("px-4 pt-4", visibleOptionCount > 0 ? "pb-4" : "pb-0")}>
				{hasMultipleQuestions ? (
					<>
						<div className="mb-3 flex h-8 items-center justify-between gap-2">
							<div className="flex min-w-0 items-center gap-1">
								<div className="flex items-center gap-2">
									<Button
										type="button"
										aria-label="Previous question"
										size="icon"
										variant="ghost"
										disabled={!canGoToPreviousQuestion || isSubmitting}
										onClick={() => goToPreviousQuestion()}
										tabIndex={-1}
										className="shrink-0"
									>
										<ChevronLeftIcon label="" size="small" />
									</Button>
									<span className="whitespace-nowrap text-sm text-text-subtlest">{safeQuestionIndex + 1} / {totalQuestions}</span>
									<Button
										type="button"
										aria-label="Next question"
										size="icon"
										variant="ghost"
										disabled={!canGoToNextQuestion || isSubmitting}
										onClick={() => goToNextQuestion()}
										tabIndex={-1}
										className="shrink-0"
									>
										<ChevronRightIcon label="" size="small" />
									</Button>
								</div>
							</div>
							{onDismiss ? (
								<Button aria-label="Dismiss questions" size="icon" variant="ghost" disabled={isSubmitting} className="-mr-1 shrink-0" onClick={handleDismiss} tabIndex={-1}>
									<CrossIcon label="" size="small" />
								</Button>
							) : null}
						</div>
						<h5 className="min-w-0 whitespace-normal break-words text-text">{currentQuestion.label}</h5>
					</>
				) : (
					<div className="flex items-center justify-between gap-2">
						<h5 className="min-w-0 whitespace-normal break-words text-text">{currentQuestion.label}</h5>
						{onDismiss ? (
							<Button aria-label="Dismiss questions" size="icon" variant="ghost" disabled={isSubmitting} className="-mr-1 shrink-0" onClick={handleDismiss} tabIndex={-1}>
								<CrossIcon label="" size="small" />
							</Button>
						) : null}
					</div>
				)}
			</header>

			<AnimatePresence initial={false} custom={direction}>
				<motion.div
					key={currentQuestion.id}
					custom={direction}
					variants={variants}
					initial="enter"
					animate="center"
					exit="exit"
					transition={SLIDE_TRANSITION}
					data-slot="question-card-body"
					className={cn(
						"min-h-0 flex-1 overflow-y-auto overscroll-contain",
						visibleOptionCount > 0 ? "px-3" : undefined,
						visibleOptionCount > 0 && !showFooter ? "pb-3" : undefined,
					)}
				>
					<QuestionInput
						question={currentQuestion}
						answerValue={answers[currentQuestion.id]}
						focusedIndex={focusedIndex}
						isSubmitting={isSubmitting}
						maxVisibleOptions={maxVisibleOptions}
						onFocusIndex={setFocusedIndex}
						onAnswerChange={handleAnswerChange}
					/>
				</motion.div>
			</AnimatePresence>

			{showFooter ? (
				<footer
					data-slot="question-card-footer"
					className="flex items-center gap-2 px-3 py-3"
				>
					{showCustomInput ? (
						<div className="flex min-w-0 flex-1 items-center gap-4 pl-2">
							<span className="inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-border bg-surface text-sm leading-5 font-medium text-text">{customOptionIndex + 1}</span>
							<Input
								ref={customInputRef}
								variant="none"
								data-slot="question-card-custom-input"
								aria-label={`${currentQuestion.label} custom answer`}
								value={customInputValue ?? ""}
								onChange={(event) => handleAnswerChange((event.target as HTMLInputElement).value)}
								onFocus={handleCustomInputFocus}
								disabled={isSubmitting}
								placeholder={currentQuestion.placeholder ?? customInputPlaceholder}
								className="h-8 min-w-0 flex-1 px-0 text-sm leading-5 focus-visible:ring-0 focus-visible:border-transparent"
							/>
						</div>
					) : null}
					{footerActionButton}
				</footer>
			) : null}
		</div>
	);
}

function QuestionCard(props: Readonly<QuestionCardProps>): React.ReactElement {
	const resetKey = `${props.toolCallId}:${getQuestionSignature(props.questions)}:${JSON.stringify(props.defaultAnswers ?? {})}`;
	return <QuestionCardContent key={resetKey} {...props} />;
}

export { QuestionCard };
