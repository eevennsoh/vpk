"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import {
	type ToolApprovalDecisionState,
	getToolApprovalDecisionTransition,
	getToolApprovalProgressLabel,
	type ToolApprovalProgressMode,
	type ToolApprovalSubmissionMode,
	type ToolApprovalSubmitDecision,
} from "@/components/blocks/tool-approval/lib/tool-approval-utils";
import type { ToolApprovalPayload } from "@/lib/rovo-ui-messages";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactElement } from "react";
import { useId, useState } from "react";

export type { ToolApprovalSubmitDecision } from "@/components/blocks/tool-approval/lib/tool-approval-utils";

export interface ToolApprovalProps extends Omit<ComponentProps<"section">, "onSubmit"> {
	toolApproval: ToolApprovalPayload;
	isSubmitting?: boolean;
	progressMode?: ToolApprovalProgressMode;
	submissionMode?: ToolApprovalSubmissionMode;
	onSubmit: (
		toolApproval: ToolApprovalPayload,
		decisions: ToolApprovalSubmitDecision[],
	) => Promise<void> | void;
}

function getRiskLabel(riskLevel?: "low" | "medium" | "high"): string {
	if (riskLevel === "high") {
		return "High impact";
	}

	if (riskLevel === "low") {
		return "Low impact";
	}

	return "Medium impact";
}

function getRiskVariant(riskLevel?: "low" | "medium" | "high"): "success" | "warning" | "danger" {
	if (riskLevel === "high") {
		return "danger";
	}

	if (riskLevel === "low") {
		return "success";
	}

	return "warning";
}

interface MetadataChipProps {
	children: string;
	className?: string;
}

function MetadataChip({ children, className }: Readonly<MetadataChipProps>): ReactElement {
	return (
		<span
			className={cn(
				"max-w-full truncate rounded-full border border-border bg-bg-neutral px-2 py-1 font-mono text-[11px] text-text-subtle",
				className,
			)}
			title={children}
		>
			{children}
		</span>
	);
}

export function ToolApproval({
	toolApproval,
	...props
}: Readonly<ToolApprovalProps>): ReactElement | null {
	return <ToolApprovalStateful key={toolApproval.approvalId} toolApproval={toolApproval} {...props} />;
}

function ToolApprovalStateful({
	toolApproval,
	isSubmitting = false,
	progressMode = "position",
	submissionMode = "batch",
	onSubmit,
	className,
	...props
}: Readonly<ToolApprovalProps>): ReactElement | null {
	const headingId = useId();
	const [activeIndex, setActiveIndex] = useState(0);
	const [decisionsByToolCallId, setDecisionsByToolCallId] = useState<Record<string, ToolApprovalDecisionState>>({});

	const items = toolApproval.items;
	const activeItem = items[activeIndex] ?? items[0] ?? null;
	const activeDecision = activeItem ? decisionsByToolCallId[activeItem.toolCallId] ?? null : null;
	const hasMultipleItems = items.length > 1;
	const progressLabel = getToolApprovalProgressLabel({
		items,
		activeIndex,
		decisionsByToolCallId,
		progressMode,
	});

	if (!activeItem) {
		return null;
	}

	async function submitDecision(approved: boolean) {
		if (isSubmitting) {
			return;
		}

		const transition = getToolApprovalDecisionTransition({
			items,
			activeIndex,
			decisionsByToolCallId,
			toolCallId: activeItem.toolCallId,
			approved,
			submissionMode,
		});
		setDecisionsByToolCallId(transition.nextDecisionsByToolCallId);

		if (transition.shouldSubmit) {
			await onSubmit(toolApproval, transition.submission);
			if (transition.isComplete) {
				return;
			}
		}

		setActiveIndex(transition.nextActiveIndex);
	}

	return (
		<section
			aria-labelledby={headingId}
			className={cn("w-full", className)}
			data-slot="tool-approval"
			{...props}
		>
			<Card
				className="gap-0 overflow-hidden border-border bg-surface-raised shadow-[0_-2px_24px_rgba(9,30,66,0.08)]"
				size="sm"
			>
				<CardHeader className="border-b border-border/70 pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h3
									id={headingId}
									className="text-sm font-semibold text-text"
								>
									{activeItem.title}
								</h3>
								<Lozenge size="compact" variant="neutral">
									Approval required
								</Lozenge>
							</div>
							<p className="mt-1 text-sm leading-6 text-text-subtle">
								{activeItem.description}
							</p>
						</div>
						{progressLabel ? (
							<div className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-subtle">
								{progressLabel}
							</div>
						) : null}
					</div>
				</CardHeader>

				<CardContent className="space-y-4 py-3">
					<div className="flex flex-wrap items-center gap-2">
						<Lozenge className="font-mono" size="compact" variant="neutral">
							{activeItem.toolName}
						</Lozenge>
						<Lozenge size="compact" variant={getRiskVariant(activeItem.riskLevel)}>
							{getRiskLabel(activeItem.riskLevel)}
						</Lozenge>
						{activeItem.targetPath ? <MetadataChip>{activeItem.targetPath}</MetadataChip> : null}
						{activeItem.commandPreview ? <MetadataChip className="max-w-[22rem]">{activeItem.commandPreview}</MetadataChip> : null}
					</div>
				</CardContent>

				<CardFooter className="flex flex-wrap items-center gap-2">
					<Button
						aria-pressed={activeDecision?.approved === true}
						disabled={isSubmitting}
						onClick={() => void submitDecision(true)}
						size="default"
						type="button"
						variant={activeDecision?.approved === true ? "default" : "outline"}
					>
						Approve
					</Button>
					<Button
						aria-pressed={activeDecision?.approved === false}
						disabled={isSubmitting}
						onClick={() => void submitDecision(false)}
						size="default"
						type="button"
						variant={activeDecision?.approved === false ? "destructive" : "outline"}
					>
						Deny
					</Button>

					{hasMultipleItems && submissionMode !== "per-decision" ? (
						<div className="ml-auto flex items-center gap-2">
							<Button
								disabled={isSubmitting || activeIndex === 0}
								onClick={() => setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1))}
								size="default"
								type="button"
								variant="ghost"
							>
								Previous
							</Button>
							<Button
								disabled={isSubmitting || activeIndex >= items.length - 1}
								onClick={() => setActiveIndex((currentIndex) => Math.min(items.length - 1, currentIndex + 1))}
								size="default"
								type="button"
								variant="ghost"
							>
								Next
							</Button>
						</div>
					) : null}

					{isSubmitting ? (
						<span className={cn("ml-auto text-xs font-medium text-text-subtle", hasMultipleItems ? "w-full text-right" : null)}>
							Submitting approval...
						</span>
					) : null}
				</CardFooter>
			</Card>
		</section>
	);
}
