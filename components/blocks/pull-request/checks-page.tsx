"use client";

import { useState } from "react";

import { PullRequestFlyoutChecks } from "@/components/blocks/pull-request/components/pull-request-flyout-parts";
import type { PullRequestCheck } from "@/components/blocks/pull-request/components/pull-request-checks-list";
import {
	PULL_REQUEST_CHECKS_SCENARIOS,
	type PullRequestChecksScenario,
} from "@/components/blocks/pull-request/data/demo-pull-request-checks";

/**
 * One permutation, drawn exactly as the flyout draws it: the summary row with
 * its status ring (or spinner while anything runs) opening onto the compact
 * check rows. Starts expanded because showing the rows is the point.
 */
function ChecksScenarioCard({
	scenario,
	onFixCheck,
}: Readonly<{
	scenario: PullRequestChecksScenario;
	onFixCheck: (checks: readonly PullRequestCheck[]) => void;
}>) {
	return (
		<section
			aria-label={scenario.label}
			className="flex w-80 shrink-0 flex-col gap-2"
			data-checks-scenario={scenario.id}
		>
			<div className="flex flex-col gap-0.5">
				<h3 className="text-sm font-medium text-text">{scenario.label}</h3>
				<p className="text-xs text-text-subtle">{scenario.description}</p>
			</div>
			{/* Same surface as the flyout's detail section so the rows read in context. */}
			<div className="rounded-lg bg-surface-raised p-3 shadow-2xl">
				<PullRequestFlyoutChecks checks={scenario.checks} defaultOpen onFixCheck={onFixCheck} />
			</div>
		</section>
	);
}

export default function PullRequestChecksPage() {
	const [fixRequest, setFixRequest] = useState<string | null>(null);

	return (
		<div className="flex w-full flex-col gap-4 bg-surface p-6 text-text">
			<div className="flex flex-wrap gap-8">
				{PULL_REQUEST_CHECKS_SCENARIOS.map((scenario) => (
					<ChecksScenarioCard
						key={scenario.id}
						onFixCheck={(checks) =>
							setFixRequest(`Fix requested for ${checks.map((check) => check.name).join(", ")}`)
						}
						scenario={scenario}
					/>
				))}
			</div>
			<p aria-live="polite" className="min-h-4 text-xs text-text-subtle" role="status">
				{fixRequest}
			</p>
		</div>
	);
}
