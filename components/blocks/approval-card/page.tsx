"use client";

// oxlint-disable react-doctor/no-noninteractive-element-to-interactive-role -- This custom selection list owns keyboard behavior outside native listbox constraints.
// oxlint-disable react-doctor/no-noninteractive-tabindex -- These surfaces intentionally receive keyboard focus for application-style keyboard handling or card-level shortcuts.
// oxlint-disable react-doctor/prefer-html-dialog -- These are embedded styled cards, not browser top-layer dialog elements.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import CloseIcon from "@atlaskit/icon/core/close";
import ReturnIcon from "@atlaskit/icon-lab/core/return";
import type { PlanApprovalDecision, PlanApprovalSelection } from "@/components/projects/shared/lib/plan-approval";
import { APPROVAL_OPTIONS } from "./data/options";

const MAX_GENERATED_OPTIONS = APPROVAL_OPTIONS.length;

interface ApprovalCardProps {
	onSelect?: (selection: PlanApprovalSelection) => void;
	onDismiss?: () => void;
	isSubmitting?: boolean;
}

export function ApprovalCard({ onSelect, onDismiss, isSubmitting = false }: Readonly<ApprovalCardProps>) {
	const cardRef = useRef<HTMLDivElement>(null);
	const [selectedId, setSelectedId] = useState<PlanApprovalDecision | null>(APPROVAL_OPTIONS.find((o) => o.selected)?.id ?? null);
	const [focusedIndex, setFocusedIndex] = useState(0);

	useEffect(() => {
		cardRef.current?.focus();
	}, []);

	const handleDismiss = useCallback(() => {
		if (onDismiss) {
			onDismiss();
			return;
		}

		setSelectedId(null);
		setFocusedIndex(0);
		cardRef.current?.focus();
	}, [onDismiss]);

	const handleSelectOption = useCallback(
		(id: PlanApprovalDecision) => {
			setSelectedId(id);
			if (onSelect) {
				onSelect({
					decision: id,
					customInstruction: undefined,
				});
			}
		},
		[onSelect],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			switch (event.key) {
				case "ArrowUp": {
					event.preventDefault();
					setFocusedIndex((previous) => (previous <= 0 ? MAX_GENERATED_OPTIONS - 1 : previous - 1));
					break;
				}
				case "ArrowDown": {
					event.preventDefault();
					setFocusedIndex((previous) => (previous >= MAX_GENERATED_OPTIONS - 1 ? 0 : previous + 1));
					break;
				}
				case "Enter": {
					event.preventDefault();
					if (focusedIndex < MAX_GENERATED_OPTIONS) {
						const option = APPROVAL_OPTIONS[focusedIndex];
						if (option) {
							handleSelectOption(option.id);
						}
					}
					break;
				}
				case "Escape": {
					event.preventDefault();
					handleDismiss();
					break;
				}
				default: {
					const digit = Number(event.key);
					if (digit >= 1 && digit <= MAX_GENERATED_OPTIONS) {
						const index = digit - 1;
						event.preventDefault();
						const option = APPROVAL_OPTIONS[index];
						if (option) {
							handleSelectOption(option.id);
						}
					}
					break;
				}
			}
		},
		[focusedIndex, handleSelectOption, handleDismiss],
	);

	return (
		<div
			ref={cardRef}
			data-testid="approval-card"
			tabIndex={0}
			role="dialog"
			aria-label="Accept this plan?"
			onKeyDown={handleKeyDown}
			className="mx-auto w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[0_-2px_50px_8px_rgba(30,31,33,0.08)] outline-none"
		>
			<header className="px-4 pt-4">
				<div className="flex h-6 items-center justify-between gap-3">
					<h2 className="text-sm leading-5 font-semibold text-text">Accept this plan?</h2>
					<button
						type="button"
						aria-label="Close approval card"
						onClick={handleDismiss}
						disabled={isSubmitting}
						tabIndex={-1}
						className="inline-flex size-6 shrink-0 items-center justify-center rounded text-icon-subtle hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed disabled:cursor-not-allowed disabled:opacity-60"
					>
						<CloseIcon label="" size="small" />
					</button>
				</div>
			</header>

			<div className="px-3 pt-3 pb-4">
				<ul className="m-0 flex list-none flex-col gap-1 p-0" role="listbox">
					{APPROVAL_OPTIONS.map((option, index) => {
						const isSelected = selectedId === option.id;
						return (
							<li key={option.id}>
								<button
									type="button"
									aria-pressed={isSelected}
									disabled={isSubmitting}
									onClick={() => {
										setFocusedIndex(index);
										handleSelectOption(option.id);
									}}
									onMouseEnter={() => setFocusedIndex(index)}
									tabIndex={-1}
									className={cn(
										"flex w-full items-center gap-4 rounded-lg px-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-60",
										isSelected ? "bg-bg-selected" : focusedIndex === index ? "bg-bg-neutral-subtle-hovered" : "bg-surface",
									)}
								>
									<span
										className={cn(
											"inline-flex size-5 shrink-0 items-center justify-center rounded-sm border bg-surface text-sm leading-5 font-medium",
											isSelected ? "border-border-selected text-text-selected" : "border-border text-text",
										)}
									>
										{option.step}
									</span>
									<p className={cn("min-w-0 flex-1 text-sm leading-5 font-medium", isSelected ? "text-text-selected" : "text-text")}>{option.label}</p>
									<span
										aria-hidden="true"
										className={cn(
											"inline-flex size-6 shrink-0 items-center justify-center text-icon-disabled opacity-0",
											focusedIndex === index && !isSelected && "opacity-100",
										)}
									>
										<ReturnIcon label="" />
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

export default function ApprovalCardPreview() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [key, setKey] = useState(0);
	const submitTimeoutRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (submitTimeoutRef.current !== null) {
				window.clearTimeout(submitTimeoutRef.current);
			}
		},
		[],
	);

	const handleSelect = useCallback(
		() => {
			if (isSubmitting) return;

			setIsSubmitting(true);
			if (submitTimeoutRef.current !== null) {
				window.clearTimeout(submitTimeoutRef.current);
			}
			submitTimeoutRef.current = window.setTimeout(() => {
				setIsSubmitting(false);
				submitTimeoutRef.current = null;
			}, 600);
		},
		[isSubmitting],
	);

	const handleDismiss = useCallback(() => {
		if (submitTimeoutRef.current !== null) {
			window.clearTimeout(submitTimeoutRef.current);
			submitTimeoutRef.current = null;
		}
		setIsSubmitting(false);
		setKey((previous) => previous + 1);
	}, []);

	return <ApprovalCard key={key} onSelect={handleSelect} onDismiss={handleDismiss} isSubmitting={isSubmitting} />;
}
