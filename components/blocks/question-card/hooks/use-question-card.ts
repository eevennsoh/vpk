import { useCallback, useEffect, useRef, useState } from "react";
import type { QuestionCardAnswerValue, QuestionCardAnswers, QuestionCardQuestion } from "../types";
import {
	getNextFocusedIndex,
	getVisibleOptionCount,
} from "../lib/option-slots";
import { shouldAutoFocusCustomInputForQuestion } from "../lib/focus-policy";
import { getQuestionCardPrimaryAction, shouldShowQuestionCardFooterButton } from "../lib/footer-actions";
import {
	getCustomInputValue,
	getQuestionSignature,
	getSelectedValues,
	isQuestionAnswered,
} from "../lib/question-helpers";
import { QUESTION_CARD_SKIPPED_VALUE } from "../lib/skipped-answer";

interface UseQuestionCardOptions {
	questions: ReadonlyArray<QuestionCardQuestion>;
	isSubmitting: boolean;
	maxVisibleOptions: number;
	showCustomInput: boolean;
	defaultAnswers?: QuestionCardAnswers;
	toolCallId?: string;
	onSubmit: (answers: QuestionCardAnswers) => void;
	onDismiss?: () => void;
}

interface PersistedQuestionCardState {
	answers: QuestionCardAnswers;
	currentQuestionIndex: number;
	questionSignature: string;
}

const QUESTION_CARD_STORAGE_PREFIX = "vpk:question-card:";

function getQuestionCardStorageKey(toolCallId: string | undefined): string | null {
	if (!toolCallId) {
		return null;
	}

	return `${QUESTION_CARD_STORAGE_PREFIX}${toolCallId}`;
}

export { getQuestionSignature } from "../lib/question-helpers";

function readPersistedQuestionCardState(
	storageKey: string | null,
	questionSignature: string
): PersistedQuestionCardState | null {
	if (!storageKey || typeof window === "undefined") {
		return null;
	}

	try {
		const rawValue = window.sessionStorage.getItem(storageKey);
		if (!rawValue) {
			return null;
		}

		const parsedValue = JSON.parse(rawValue) as Partial<PersistedQuestionCardState>;
		if (
			parsedValue.questionSignature !== questionSignature ||
			typeof parsedValue.currentQuestionIndex !== "number" ||
			typeof parsedValue.answers !== "object" ||
			parsedValue.answers === null
		) {
			return null;
		}

		return {
			answers: parsedValue.answers as QuestionCardAnswers,
			currentQuestionIndex: Math.max(0, parsedValue.currentQuestionIndex),
			questionSignature,
		};
	} catch {
		return null;
	}
}

function writePersistedQuestionCardState(
	storageKey: string | null,
	state: PersistedQuestionCardState
) {
	if (!storageKey || typeof window === "undefined") {
		return;
	}

	try {
		window.sessionStorage.setItem(storageKey, JSON.stringify(state));
	} catch {
		// Losing this cache should not block answering a clarification card.
	}
}

function clearPersistedQuestionCardState(storageKey: string | null) {
	if (!storageKey || typeof window === "undefined") {
		return;
	}

	try {
		window.sessionStorage.removeItem(storageKey);
	} catch {
		// Ignore storage cleanup failures; the signature guard prevents stale reuse.
	}
}

export function useQuestionCard({
	questions,
	isSubmitting,
	maxVisibleOptions,
	showCustomInput,
	defaultAnswers,
	toolCallId,
	onSubmit,
	onDismiss,
}: Readonly<UseQuestionCardOptions>) {
	const cardRef = useRef<HTMLDivElement>(null);
	const customInputRef = useRef<HTMLInputElement>(null);
	const footerButtonRef = useRef<HTMLButtonElement>(null);
	const previousQuestionIndexRef = useRef<number | null>(null);
	const questionSignature = getQuestionSignature(questions);
	const storageKey = getQuestionCardStorageKey(toolCallId);
	const initialPersistedStateRef = useRef<PersistedQuestionCardState | null | undefined>(undefined);
	if (initialPersistedStateRef.current === undefined) {
		initialPersistedStateRef.current = readPersistedQuestionCardState(storageKey, questionSignature);
	}
	const [navigationDirection, setNavigationDirection] = useState<"forward" | "backward">("forward");
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => initialPersistedStateRef.current?.currentQuestionIndex ?? 0);
	const [answers, setAnswers] = useState<QuestionCardAnswers>(() => defaultAnswers ?? initialPersistedStateRef.current?.answers ?? {});
	const [focusedIndex, setFocusedIndex] = useState(0);

	const totalQuestions = questions.length;
	const hasMultipleQuestions = totalQuestions > 1;
	const safeQuestionIndex = Math.min(Math.max(0, currentQuestionIndex), totalQuestions - 1);
	const currentQuestion = questions[safeQuestionIndex];
	const canGoToPreviousQuestion = safeQuestionIndex > 0;
	const canGoToNextQuestion = safeQuestionIndex < totalQuestions - 1;
	const visibleOptionCount = getVisibleOptionCount(currentQuestion.options.length, maxVisibleOptions);
	const customOptionIndex = visibleOptionCount;
	const customInputValue = getCustomInputValue(currentQuestion, answers[currentQuestion.id]);
	const currentQuestionAnswered = isQuestionAnswered(currentQuestion, answers);

	const allQuestionsAnswered = questions.every((question) => isQuestionAnswered(question, answers));
	const primaryAction = getQuestionCardPrimaryAction(allQuestionsAnswered, currentQuestionAnswered, canGoToNextQuestion);
	const hasFooterButton = shouldShowQuestionCardFooterButton(primaryAction);

	useEffect(() => {
		if (isSubmitting) return;
		// preventScroll: focusing the card for keyboard handling must not scroll the
		// card into view. When rendered inside a hover panel over a scrollable page
		// (e.g. the jira-issue "awaiting input" flyout), a scrolling focus jumps the
		// whole page to the top on hover.
		cardRef.current?.focus({ preventScroll: true });
	}, [isSubmitting]);

	const persistQuestionCardState = useCallback(
		(nextAnswers: QuestionCardAnswers, nextQuestionIndex: number) => {
			writePersistedQuestionCardState(storageKey, {
				answers: nextAnswers,
				currentQuestionIndex: Math.min(totalQuestions - 1, Math.max(0, nextQuestionIndex)),
				questionSignature,
			});
		},
		[questionSignature, storageKey, totalQuestions],
	);

	const clearPersistedState = useCallback(() => {
		clearPersistedQuestionCardState(storageKey);
	}, [storageKey]);

	useEffect(() => {
		const previousQuestionIndex = previousQuestionIndexRef.current;
		const hasQuestionChanged = previousQuestionIndex !== null && previousQuestionIndex !== safeQuestionIndex;
		previousQuestionIndexRef.current = safeQuestionIndex;

		if (!hasQuestionChanged) {
			return;
		}

		const shouldAutoFocusCustomInput = shouldAutoFocusCustomInputForQuestion({
			optionCount: currentQuestion.options.length,
			maxVisibleOptions,
			showCustomInput,
		});
		if (shouldAutoFocusCustomInput) {
			customInputRef.current?.focus({ preventScroll: true });
			return;
		}

		if (document.activeElement === customInputRef.current || cardRef.current?.contains(document.activeElement)) {
			cardRef.current?.focus({ preventScroll: true });
		}
	}, [safeQuestionIndex, currentQuestion, maxVisibleOptions, showCustomInput]);

	const resetFocusForNewQuestion = useCallback(() => {
		setFocusedIndex(0);
	}, []);

	const goToNextQuestion = useCallback((nextAnswers: QuestionCardAnswers = answers) => {
		setNavigationDirection("forward");
		resetFocusForNewQuestion();
		const nextIndex = Math.min(totalQuestions - 1, safeQuestionIndex + 1);
		setCurrentQuestionIndex(nextIndex);
		persistQuestionCardState(nextAnswers, nextIndex);
	}, [answers, totalQuestions, safeQuestionIndex, resetFocusForNewQuestion, persistQuestionCardState]);

	const goToPreviousQuestion = useCallback((nextAnswers: QuestionCardAnswers = answers) => {
		setNavigationDirection("backward");
		resetFocusForNewQuestion();
		const nextIndex = Math.max(0, safeQuestionIndex - 1);
		setCurrentQuestionIndex(nextIndex);
		persistQuestionCardState(nextAnswers, nextIndex);
	}, [answers, safeQuestionIndex, resetFocusForNewQuestion, persistQuestionCardState]);

	const submitAnswers = useCallback(
		(nextAnswers: QuestionCardAnswers) => {
			clearPersistedState();
			onSubmit(nextAnswers);
		},
		[clearPersistedState, onSubmit],
	);

	// Submit from the final step. Any question the user never answered — including ones they
	// only paged past with the chevron/ArrowRight — is explicitly stamped "Skipped" so the
	// submission never silently omits a question while still preserving every real answer.
	const submitWithImplicitSkips = useCallback(() => {
		if (isSubmitting) return;

		const nextAnswers: QuestionCardAnswers = { ...answers };
		for (const question of questions) {
			if (!isQuestionAnswered(question, nextAnswers)) {
				nextAnswers[question.id] = QUESTION_CARD_SKIPPED_VALUE;
			}
		}
		setAnswers(nextAnswers);
		submitAnswers(nextAnswers);
	}, [isSubmitting, answers, questions, submitAnswers]);

	const handleDismiss = useCallback(() => {
		clearPersistedState();
		onDismiss?.();
	}, [clearPersistedState, onDismiss]);

	const handleSkip = useCallback(() => {
		if (isSubmitting) return;

		const nextAnswers = {
			...answers,
			[currentQuestion.id]: QUESTION_CARD_SKIPPED_VALUE,
		};

		if (canGoToNextQuestion) {
			setAnswers(nextAnswers);
			goToNextQuestion(nextAnswers);
		} else {
			const hasAnyRealAnswer = questions.some((question) =>
				isQuestionAnswered(question, nextAnswers) &&
				nextAnswers[question.id] !== QUESTION_CARD_SKIPPED_VALUE
			);
			if (hasAnyRealAnswer) {
				setAnswers(nextAnswers);
				submitAnswers(nextAnswers);
			} else {
				handleDismiss();
			}
		}
	}, [isSubmitting, currentQuestion, canGoToNextQuestion, goToNextQuestion, questions, answers, submitAnswers, handleDismiss]);

	// Advance while preserving the current question's answer. Distinct from handleSkip, which
	// stamps the question as "Skipped". Used by the footer "Next"/"Submit" CTA once the current
	// question has a real answer (e.g. multi-select picks or custom text).
	const handleNext = useCallback(() => {
		if (isSubmitting) return;

		if (canGoToNextQuestion) {
			goToNextQuestion(answers);
		} else {
			submitWithImplicitSkips();
		}
	}, [isSubmitting, canGoToNextQuestion, goToNextQuestion, answers, submitWithImplicitSkips]);

	const handleSelectOption = useCallback(
		(optionId: string) => {
			if (isSubmitting) return;

			const nextAnswers = { ...answers, [currentQuestion.id]: optionId };
			setAnswers(nextAnswers);

			if (canGoToNextQuestion) {
				goToNextQuestion(nextAnswers);
				return;
			}

			const allAnswered = questions.every((question) => (question.id === currentQuestion.id ? true : isQuestionAnswered(question, nextAnswers)));
			if (allAnswered) {
				submitAnswers(nextAnswers);
			}
		},
		[isSubmitting, answers, currentQuestion, canGoToNextQuestion, goToNextQuestion, questions, submitAnswers],
	);

	const handleCustomInputSubmit = useCallback(
		(value: string) => {
			if (isSubmitting || !value.trim()) return;

			const nextAnswers = { ...answers, [currentQuestion.id]: value.trim() };
			setAnswers(nextAnswers);

			if (canGoToNextQuestion) {
				goToNextQuestion(nextAnswers);
				return;
			}

			const allAnswered = questions.every((question) => (question.id === currentQuestion.id ? true : isQuestionAnswered(question, nextAnswers)));
			if (allAnswered) {
				submitAnswers(nextAnswers);
			}
		},
		[isSubmitting, answers, currentQuestion, canGoToNextQuestion, goToNextQuestion, questions, submitAnswers],
	);

	const handleAnswerChange = useCallback(
		(answerValue: QuestionCardAnswerValue, options?: Readonly<{ autoAdvance?: boolean }>) => {
			if (isSubmitting) return;

			const nextAnswers = {
				...answers,
				[currentQuestion.id]: answerValue,
			};
			setAnswers(nextAnswers);

			if (options?.autoAdvance && currentQuestion.kind === "single-select") {
				if (canGoToNextQuestion) {
					goToNextQuestion(nextAnswers);
				} else {
					const allAnswered = questions.every((question) => (question.id === currentQuestion.id ? true : isQuestionAnswered(question, nextAnswers)));
					if (allAnswered) {
						submitAnswers(nextAnswers);
					}
				}
				return;
			}

			persistQuestionCardState(nextAnswers, safeQuestionIndex);
		},
		[isSubmitting, currentQuestion, safeQuestionIndex, canGoToNextQuestion, goToNextQuestion, answers, questions, persistQuestionCardState, submitAnswers],
	);

	const handleKeyboardOptionSelect = useCallback(
		(optionId: string) => {
			if (currentQuestion.kind === "multi-select") {
				const selectedValues = getSelectedValues(answers[currentQuestion.id]);
				const nextValues = selectedValues.includes(optionId)
					? selectedValues.filter((value) => value !== optionId)
					: [...selectedValues, optionId];
				const nextAnswers = {
					...answers,
					[currentQuestion.id]: nextValues,
				};
				setAnswers(nextAnswers);
				persistQuestionCardState(nextAnswers, safeQuestionIndex);
				return;
			}

			handleSelectOption(optionId);
		},
		[answers, currentQuestion, handleSelectOption, persistQuestionCardState, safeQuestionIndex],
	);

	const handleCustomInputFocus = useCallback(() => {
		setFocusedIndex(-1);
	}, []);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (isSubmitting) return;

			const isCustomInputFocused = document.activeElement === customInputRef.current;
			const isOptionButtonFocused = document.activeElement instanceof HTMLButtonElement
				&& document.activeElement.closest('[data-slot="question-card-option"]') !== null;
			switch (event.key) {
				case "Tab": {
					// Focus cycle: card options → custom input → footer button → card options
					const isFooterButtonFocused = document.activeElement === footerButtonRef.current;
					if (showCustomInput) {
						if (event.shiftKey) {
							if (isFooterButtonFocused) {
								event.preventDefault();
								customInputRef.current?.focus();
								setFocusedIndex(-1);
							} else if (isCustomInputFocused) {
								event.preventDefault();
								cardRef.current?.focus();
								if (visibleOptionCount > 0) {
									setFocusedIndex(visibleOptionCount - 1);
								}
							}
						} else {
							if (isCustomInputFocused) {
								event.preventDefault();
								if (hasFooterButton) {
									footerButtonRef.current?.focus();
								} else {
									cardRef.current?.focus();
									setFocusedIndex(0);
								}
							} else if (isFooterButtonFocused) {
								event.preventDefault();
								cardRef.current?.focus();
								setFocusedIndex(0);
							} else {
								event.preventDefault();
								setFocusedIndex(-1);
								customInputRef.current?.focus();
							}
						}
					} else if (hasFooterButton) {
						// No custom input: card options → footer button → card options
						if (event.shiftKey && isFooterButtonFocused) {
							event.preventDefault();
							cardRef.current?.focus();
							if (visibleOptionCount > 0) {
								setFocusedIndex(visibleOptionCount - 1);
							}
						} else if (!event.shiftKey && !isFooterButtonFocused) {
							event.preventDefault();
							footerButtonRef.current?.focus();
						} else if (!event.shiftKey && isFooterButtonFocused) {
							event.preventDefault();
							cardRef.current?.focus();
							setFocusedIndex(0);
						}
					} else {
						event.preventDefault();
						cardRef.current?.focus();
						if (event.shiftKey && visibleOptionCount > 0) {
							setFocusedIndex(visibleOptionCount - 1);
						} else {
							setFocusedIndex(0);
						}
					}
					break;
				}
				case "ArrowUp": {
					event.preventDefault();
					if (isCustomInputFocused) {
						// Move from custom input back to the last visible option
						cardRef.current?.focus();
						if (visibleOptionCount > 0) {
							setFocusedIndex(visibleOptionCount - 1);
						}
						break;
					}
					if (visibleOptionCount === 0) break;
					// Stop at first option — do not wrap around
					if (focusedIndex === 0) break;
					setFocusedIndex((previous) => getNextFocusedIndex(previous, visibleOptionCount, "up"));
					break;
				}
				case "ArrowDown": {
					event.preventDefault();
					if (isCustomInputFocused) break;
					if (visibleOptionCount === 0) break;
					// If at last option and custom input exists, move focus there
					if (showCustomInput && focusedIndex === visibleOptionCount - 1) {
						setFocusedIndex(-1);
						customInputRef.current?.focus();
						break;
					}
					setFocusedIndex((previous) => getNextFocusedIndex(previous, visibleOptionCount, "down"));
					break;
				}
				case "Enter": {
					if (isCustomInputFocused) {
						event.preventDefault();
						const inputValue = customInputRef.current?.value ?? "";
						handleCustomInputSubmit(inputValue);
						return;
					}

					// Preserve native activation for an explicitly focused option or footer
					// button. Card-level Enter handles only the virtual arrow-key focus.
					if (isOptionButtonFocused || document.activeElement === footerButtonRef.current) {
						break;
					}

					event.preventDefault();
					if (focusedIndex < visibleOptionCount) {
						const option = currentQuestion.options[focusedIndex];
						if (option) {
							handleKeyboardOptionSelect(option.id);
						}
					}
					break;
				}
				case "ArrowLeft": {
					if (isCustomInputFocused) return;
					event.preventDefault();
					if (canGoToPreviousQuestion) {
						goToPreviousQuestion();
					}
					break;
				}
				case "ArrowRight": {
					if (isCustomInputFocused) return;
					event.preventDefault();
					if (canGoToNextQuestion) {
						goToNextQuestion();
					}
					break;
				}
				case "Escape": {
					event.preventDefault();
					if (isCustomInputFocused) {
						cardRef.current?.focus();
						return;
					}
					handleSkip();
					break;
				}
				default: {
					if (isCustomInputFocused) break;
					const digit = Number(event.key);
					if (digit >= 1 && digit <= 9) {
						const index = digit - 1;
						if (index < visibleOptionCount) {
							event.preventDefault();
							const option = currentQuestion.options[index];
							if (option) {
								handleKeyboardOptionSelect(option.id);
							}
						} else if (showCustomInput && index === customOptionIndex) {
							event.preventDefault();
							setFocusedIndex(-1);
							customInputRef.current?.focus();
						}
					}
					break;
				}
			}
		},
		[
			isSubmitting,
			showCustomInput,
			hasFooterButton,
			focusedIndex,
			visibleOptionCount,
			customOptionIndex,
			currentQuestion,
			canGoToPreviousQuestion,
			canGoToNextQuestion,
			goToPreviousQuestion,
			goToNextQuestion,
			handleKeyboardOptionSelect,
			handleCustomInputSubmit,
			handleSkip,
		],
	);

	return {
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
		handleSkip,
		handleNext,
		handleAnswerChange,
		handleCustomInputFocus,
		handleKeyDown,
		onSubmit: submitWithImplicitSkips,
		onDismiss: handleDismiss,
	};
}
