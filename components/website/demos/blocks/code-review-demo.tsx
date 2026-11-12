"use client";

import { useState } from "react";

import {
	getRovoAgentProfile,
	ROVO_AGENT_ID,
	type RovoAgentProfile,
} from "@/app/data/directory/agents";
import {
	CodeReview,
	type CodeReviewAgentVariant,
} from "@/components/blocks/code-review";
import { JGP_CLAUDE_CODE_AGENT_PROFILE } from "@/components/projects/jira-golden-journey-v1/data/agent-chat-data";
import { Button } from "@/components/ui/button";

interface CodeReviewDemoVariant {
	agentProfile: RovoAgentProfile;
	label: string;
	value: CodeReviewAgentVariant;
}

const CODE_REVIEWER_AGENT_PROFILE = getRovoAgentProfile("code-reviewer");
const ROVO_AGENT_PROFILE = getRovoAgentProfile(ROVO_AGENT_ID);
const DEMO_VARIANTS: readonly CodeReviewDemoVariant[] = [
	{
		agentProfile: JGP_CLAUDE_CODE_AGENT_PROFILE,
		label: "3P (Cloud)",
		value: "third-party-cloud",
	},
	{
		agentProfile: JGP_CLAUDE_CODE_AGENT_PROFILE,
		label: "3P (Local)",
		value: "third-party-local",
	},
	{
		agentProfile: CODE_REVIEWER_AGENT_PROFILE,
		label: "Custom agents",
		value: "custom",
	},
	{
		agentProfile: ROVO_AGENT_PROFILE,
		label: "Rovo",
		value: "rovo",
	},
];

export default function CodeReviewDemo() {
	const [agentVariant, setAgentVariant] = useState<CodeReviewAgentVariant | null>(null);
	const selectedVariant =
		DEMO_VARIANTS.find((variant) => variant.value === agentVariant) ?? null;

	return (
		<main className="flex h-screen items-center justify-center bg-surface">
			<div
				aria-label="Open code review variant"
				className="flex flex-wrap items-center justify-center gap-2"
				role="group"
			>
				{DEMO_VARIANTS.map((variant) => (
					<Button
						key={variant.value}
						onClick={() => setAgentVariant(variant.value)}
						type="button"
						variant="outline"
					>
						{variant.label}
					</Button>
				))}
			</div>
			<CodeReview
				agentProfile={selectedVariant?.agentProfile}
				agentVariant={selectedVariant?.value ?? "custom"}
				onOpenChange={(open) => {
					if (!open) {
						setAgentVariant(null);
					}
				}}
				open={selectedVariant !== null}
			/>
		</main>
	);
}
