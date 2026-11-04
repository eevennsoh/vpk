"use client";

import { useState } from "react";

import { PullRequest } from "@/components/blocks/pull-request/components/pull-request";
import type { PullRequestVariant } from "@/components/blocks/pull-request/components/pull-request-types";
import {
	PULL_REQUEST_CHECKS_SCENARIOS,
	pullRequestChecksScenario,
} from "@/components/blocks/pull-request/data/demo-pull-request-checks";
import { DEMO_PULL_REQUESTS } from "@/components/blocks/pull-request/data/demo-pull-requests";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function PullRequestPage({
	variant: lockedVariant,
}: Readonly<{ variant?: PullRequestVariant }> = {}) {
	const [variantState, setVariantState] = useState<PullRequestVariant>(
		lockedVariant ?? "dropdown",
	);
	const variant = lockedVariant ?? variantState;
	const isFlyout = variant === "flyout";
	const [selectedNumber, setSelectedNumber] = useState<number | null>(
		DEMO_PULL_REQUESTS[0]?.number ?? null,
	);

	const [checksScenarioId, setChecksScenarioId] = useState("in-progress");

	return (
		<div className="flex h-full min-h-[360px] w-full items-center justify-center bg-surface p-6 text-text">
			<div
				className={
					isFlyout
						? "flex w-[344px] flex-col gap-3"
						: "flex w-full max-w-xl flex-col gap-3"
				}
			>
				{lockedVariant ? null : (
					<ToggleGroup
						aria-label="Pull request card variant"
						onValueChange={(values) => {
							const nextVariant = values[0] as PullRequestVariant | undefined;
							if (nextVariant) {
								setVariantState(nextVariant);
							}
						}}
						value={[variant]}
						variant="outline"
					>
						<ToggleGroupItem value="dropdown">Dropdown compact</ToggleGroupItem>
						<ToggleGroupItem value="spacious">Dropdown spacious</ToggleGroupItem>
						<ToggleGroupItem value="flyout">Flyout</ToggleGroupItem>
					</ToggleGroup>
				)}
				{isFlyout ? (
					<ToggleGroup
						aria-label="CI checks state"
						onValueChange={(values) => {
							if (values[0]) {
								setChecksScenarioId(values[0]);
							}
						}}
						size="sm"
						value={[checksScenarioId]}
						variant="outline"
					>
						{PULL_REQUEST_CHECKS_SCENARIOS.map((scenario) => (
							<ToggleGroupItem key={scenario.id} value={scenario.id}>
								{scenario.shortLabel}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				) : null}
				{DEMO_PULL_REQUESTS.map((item) => (
					<PullRequest
						key={item.number}
						{...item}
						checks={isFlyout ? pullRequestChecksScenario(checksScenarioId) : item.checks}
						variant={variant}
						selected={isFlyout ? false : item.number === selectedNumber}
						onActivate={
							isFlyout
								? undefined
								: () =>
									setSelectedNumber((current) => (
										current === item.number ? null : item.number
									))
						}
					/>
				))}
			</div>
		</div>
	);
}

export { PullRequest } from "@/components/blocks/pull-request/components/pull-request";
export type {
	PullRequestAuthor,
	PullRequestProps,
	PullRequestStatus,
	PullRequestVariant,
} from "@/components/blocks/pull-request/components/pull-request-types";
