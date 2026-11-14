"use client";

import { useState } from "react";
import { Lozenge } from "@/components/ui/lozenge";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnswerCardRow {
	question: string;
	answer: string;
	status?: "skipped";
}

export interface AnswerCardProps extends Omit<ComponentProps<"section">, "children"> {
	/** Label displayed as the section header. @default "Your answers" */
	label?: string;
	/** Ordered list of question/answer pairs to display. */
	rows: ReadonlyArray<AnswerCardRow>;
	/** Whether the card starts collapsed. @default false */
	defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// AnswerCard
// ---------------------------------------------------------------------------

function AnswerCard({
	label = "Your answers",
	rows,
	defaultCollapsed = false,
	className,
	...props
}: Readonly<AnswerCardProps>): React.ReactElement {
	const [collapsed, setCollapsed] = useState(defaultCollapsed);

	return (
		<section
			data-slot="answer-card"
			className={cn(
				"mx-auto w-full overflow-hidden rounded-xl bg-surface-raised shadow-sm",
				className,
			)}
			{...props}
		>
			<header className="flex items-center gap-3 px-4 py-3">
				<IconTile icon={<QuestionCircleIcon label="" />} label="Answers" variant="gray" size="medium" />
				<span className="min-w-0 flex-1">
					<span className="block text-sm leading-5 font-bold text-text">{label}</span>
					{rows.length > 0 ? (
						<span className="block text-xs leading-4 text-text-subtle">
							{rows.length} {rows.length === 1 ? "question" : "questions"}
						</span>
					) : null}
				</span>
				{rows.length > 0 ? (
					<Button
						variant="ghost"
						size="icon"
						className="text-text-subtle"
						aria-label={collapsed ? "Expand answers" : "Collapse answers"}
						onClick={() => setCollapsed((prev) => !prev)}
					>
						<span
							className="transition-transform duration-medium ease-in-out"
							style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}
						>
							<ChevronRightIcon label="" size="small" />
						</span>
					</Button>
				) : null}
			</header>

			{collapsed || rows.length === 0 ? null : (
				<div className="px-4 pb-3">
					<ul className="m-0 flex list-none flex-col gap-1 p-0">
						{rows.map((row, index) => (
							<li
								key={`${row.question}-${index}`}
								className="flex items-center gap-3 rounded-lg py-1.5"
							>
								<span className="inline-flex size-8 shrink-0 items-center justify-center">
									<span className="inline-flex size-5 items-center justify-center rounded-sm text-sm leading-5 font-medium text-text-subtle">
										{index + 1}.
									</span>
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-sm leading-5 font-medium text-text">{row.question}</p>
									{row.status === "skipped" ? (
										<Lozenge variant="neutral" className="mt-1">
											No preferences
										</Lozenge>
									) : (
										<p className="mt-0.5 text-sm leading-5 text-text-subtle">{row.answer}</p>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

export { AnswerCard };
