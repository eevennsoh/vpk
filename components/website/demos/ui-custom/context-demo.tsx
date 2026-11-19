"use client";

import {
	Context,
	ContextTrigger,
	ContextContent,
	ContextContentHeader,
	ContextContentBody,
	ContextContentFooter,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextCacheUsage,
} from "@/components/ui-custom/context";
import type { LanguageModelUsage } from "ai";

const SAMPLE_USAGE: LanguageModelUsage = {
	inputTokens: 12_450,
	outputTokens: 3_280,
	totalTokens: 21_490,
	inputTokenDetails: {
		noCacheTokens: 8_250,
		cacheReadTokens: 4_200,
		cacheWriteTokens: undefined,
	},
	outputTokenDetails: {
		textTokens: 1_720,
		reasoningTokens: 1_560,
	},
};

const DEMO_USAGE = {
	input: 8_420,
	output: 1_260,
	reasoning: 980,
	limit: 128_000,
};

const DEMO_USED = DEMO_USAGE.input + DEMO_USAGE.output + DEMO_USAGE.reasoning;

const DEMO_ROWS = [
	{ label: "Input", value: DEMO_USAGE.input },
	{ label: "Output", value: DEMO_USAGE.output },
	{ label: "Reasoning", value: DEMO_USAGE.reasoning },
];

function formatTokens(value: number) {
	if (value < 1000) {
		return String(value);
	}

	return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export default function ContextDemo() {
	return (
		<div className="flex justify-center py-12">
			<Context maxTokens={DEMO_USAGE.limit} usedTokens={DEMO_USED}>
				<ContextTrigger />
				<ContextContent className="w-64">
					<ContextContentHeader />
					<ContextContentBody className="flex flex-col gap-1 text-sm">
						{DEMO_ROWS.map((row) => (
							<div key={row.label} className="flex justify-between gap-3">
								<span className="text-text-subtle">{row.label}</span>
								<span>{formatTokens(row.value)}</span>
							</div>
						))}
					</ContextContentBody>
				</ContextContent>
			</Context>
		</div>
	);
}

export function ContextDemoWithCost() {
	return (
		<div className="flex items-center justify-center p-8">
			<Context
				maxTokens={128_000}
				usedTokens={21_490}
				usage={SAMPLE_USAGE}
				modelId="openai:gpt-4o"
			>
				<ContextTrigger />
				<ContextContent>
					<ContextContentHeader />
					<ContextContentBody>
						<ContextInputUsage />
						<ContextOutputUsage />
						<ContextReasoningUsage />
						<ContextCacheUsage />
					</ContextContentBody>
					<ContextContentFooter />
				</ContextContent>
			</Context>
		</div>
	);
}

export function ContextDemoMinimal() {
	return (
		<div className="flex items-center justify-center p-8">
			<Context maxTokens={128_000} usedTokens={64_000}>
				<ContextTrigger />
				<ContextContent>
					<ContextContentHeader />
				</ContextContent>
			</Context>
		</div>
	);
}

export function ContextDemoHighUsage() {
	const highUsage: LanguageModelUsage = {
		inputTokens: 95_000,
		outputTokens: 28_000,
		totalTokens: 123_000,
		inputTokenDetails: {
			noCacheTokens: 95_000,
			cacheReadTokens: undefined,
			cacheWriteTokens: undefined,
		},
		outputTokenDetails: {
			textTokens: 28_000,
			reasoningTokens: undefined,
		},
	};

	return (
		<div className="flex items-center justify-center p-8">
			<Context
				maxTokens={128_000}
				usedTokens={123_000}
				usage={highUsage}
				modelId="openai:gpt-4o"
			>
				<ContextTrigger />
				<ContextContent>
					<ContextContentHeader />
					<ContextContentBody>
						<ContextInputUsage />
						<ContextOutputUsage />
					</ContextContentBody>
					<ContextContentFooter />
				</ContextContent>
			</Context>
		</div>
	);
}

export function ContextDemoCustomTrigger() {
	return (
		<div className="flex items-center justify-center p-8">
			<Context
				maxTokens={200_000}
				usedTokens={45_000}
				usage={SAMPLE_USAGE}
				modelId="anthropic:claude-3.5-sonnet"
			>
				<ContextTrigger className="text-xs">
					<span className="text-muted-foreground">45K / 200K tokens</span>
				</ContextTrigger>
				<ContextContent>
					<ContextContentHeader />
					<ContextContentBody>
						<ContextInputUsage />
						<ContextOutputUsage />
						<ContextReasoningUsage />
						<ContextCacheUsage />
					</ContextContentBody>
					<ContextContentFooter />
				</ContextContent>
			</Context>
		</div>
	);
}
