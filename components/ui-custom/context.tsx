"use client";

import type { LanguageModelUsage } from "ai";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createContext, use, useMemo } from "react";
import { getUsage } from "tokenlens";

const PERCENT_MAX = 100;
const TRIGGER_OPEN_DELAY_MS = 10;
const TRIGGER_CLOSE_DELAY_MS = 100;
const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 1,
	style: "percent",
});
const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
	notation: "compact",
});
const USD_FORMATTER = new Intl.NumberFormat("en-US", {
	currency: "USD",
	style: "currency",
});

type ModelId = string;

interface ContextSchema {
	usedTokens: number;
	maxTokens: number;
	usage?: LanguageModelUsage;
	modelId?: ModelId;
}

const ContextContext = createContext<ContextSchema | null>(null);

function useContextValue() {
	const context = use(ContextContext);

	if (!context) {
		throw new Error("Context components must be used within Context");
	}

	return context;
}

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema;

export function Context({
	usedTokens,
	maxTokens,
	usage,
	modelId,
	...props
}: Readonly<ContextProps>) {
	const contextValue = useMemo(
		() => ({ maxTokens, modelId, usage, usedTokens }),
		[maxTokens, modelId, usage, usedTokens]
	);

	return (
		<ContextContext value={contextValue}>
			<HoverCard {...props} />
		</ContextContext>
	);
}

export type ContextTriggerProps = ComponentProps<typeof Button>;

export function ContextTrigger({ children, ...props }: Readonly<ContextTriggerProps>) {
	const { usedTokens, maxTokens } = useContextValue();
	const renderedPercent = PERCENT_FORMATTER.format(usedTokens / maxTokens);

	return (
		<HoverCardTrigger
			closeDelay={TRIGGER_CLOSE_DELAY_MS}
			delay={TRIGGER_OPEN_DELAY_MS}
			render={<Button size="compact" type="button" variant="outline" {...props} />}
		>
			{children ?? `${renderedPercent} context`}
		</HoverCardTrigger>
	);
}

export type ContextContentProps = ComponentProps<typeof HoverCardContent>;

export function ContextContent({
	className,
	...props
}: Readonly<ContextContentProps>) {
	return (
		<HoverCardContent
			className={cn("min-w-60 divide-y overflow-hidden p-0", className)}
			{...props}
		/>
	);
}

export type ContextContentHeaderProps = ComponentProps<"div">;

export function ContextContentHeader({
	children,
	className,
	...props
}: Readonly<ContextContentHeaderProps>) {
	const { usedTokens, maxTokens } = useContextValue();
	const usedPercent = usedTokens / maxTokens;
	const used = COMPACT_NUMBER_FORMATTER.format(usedTokens);
	const total = COMPACT_NUMBER_FORMATTER.format(maxTokens);

	return (
		<div className={cn("flex w-full flex-col gap-3 p-3", className)} {...props}>
			{children ?? (
				<>
					<div className="flex items-center justify-between gap-3 text-sm">
						<span className="font-medium">Context</span>
						<span className="text-text-subtle">
							{used} / {total}
						</span>
					</div>
					<Progress aria-label="Context used" value={usedPercent * PERCENT_MAX} />
				</>
			)}
		</div>
	);
}

export type ContextContentBodyProps = ComponentProps<"div">;

export function ContextContentBody({
	children,
	className,
	...props
}: Readonly<ContextContentBodyProps>) {
	return (
		<div className={cn("w-full p-3", className)} {...props}>
			{children}
		</div>
	);
}

export type ContextContentFooterProps = ComponentProps<"div">;

export function ContextContentFooter({
	children,
	className,
	...props
}: Readonly<ContextContentFooterProps>) {
	const { modelId, usage } = useContextValue();
	const costUSD = modelId
		? getUsage({
				modelId,
				usage: {
					input: usage?.inputTokens ?? 0,
					output: usage?.outputTokens ?? 0,
				},
			}).costUSD?.totalUSD
		: undefined;
	const totalCost = USD_FORMATTER.format(costUSD ?? 0);

	return (
		<div
			className={cn(
				"flex w-full items-center justify-between gap-3 bg-secondary p-3 text-xs",
				className
			)}
			{...props}
		>
			{children ?? (
				<>
					<span className="text-muted-foreground">Total cost</span>
					<span>{totalCost}</span>
				</>
			)}
		</div>
	);
}

export type ContextInputUsageProps = ComponentProps<"div">;

export function ContextInputUsage({
	className,
	children,
	...props
}: Readonly<ContextInputUsageProps>) {
	const { usage, modelId } = useContextValue();
	const inputTokens = usage?.inputTokens ?? 0;

	if (children) {
		return children;
	}

	if (!inputTokens) {
		return null;
	}

	const inputCost = modelId
		? getUsage({
				modelId,
				usage: { input: inputTokens, output: 0 },
			}).costUSD?.totalUSD
		: undefined;
	const inputCostText = USD_FORMATTER.format(inputCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Input</span>
			<TokensWithCost costText={inputCostText} tokens={inputTokens} />
		</div>
	);
}

export type ContextOutputUsageProps = ComponentProps<"div">;

export function ContextOutputUsage({
	className,
	children,
	...props
}: Readonly<ContextOutputUsageProps>) {
	const { usage, modelId } = useContextValue();
	const outputTokens = usage?.outputTokens ?? 0;

	if (children) {
		return children;
	}

	if (!outputTokens) {
		return null;
	}

	const outputCost = modelId
		? getUsage({
				modelId,
				usage: { input: 0, output: outputTokens },
			}).costUSD?.totalUSD
		: undefined;
	const outputCostText = USD_FORMATTER.format(outputCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Output</span>
			<TokensWithCost costText={outputCostText} tokens={outputTokens} />
		</div>
	);
}

export type ContextReasoningUsageProps = ComponentProps<"div">;

export function ContextReasoningUsage({
	className,
	children,
	...props
}: Readonly<ContextReasoningUsageProps>) {
	const { usage, modelId } = useContextValue();
	const reasoningTokens = usage?.outputTokenDetails.reasoningTokens ?? 0;

	if (children) {
		return children;
	}

	if (!reasoningTokens) {
		return null;
	}

	const reasoningCost = modelId
		? getUsage({
				modelId,
				usage: { reasoningTokens },
			}).costUSD?.totalUSD
		: undefined;
	const reasoningCostText = USD_FORMATTER.format(reasoningCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Reasoning</span>
			<TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
		</div>
	);
}

export type ContextCacheUsageProps = ComponentProps<"div">;

export function ContextCacheUsage({
	className,
	children,
	...props
}: Readonly<ContextCacheUsageProps>) {
	const { usage, modelId } = useContextValue();
	const cacheTokens = usage?.inputTokenDetails.cacheReadTokens ?? 0;

	if (children) {
		return children;
	}

	if (!cacheTokens) {
		return null;
	}

	const cacheCost = modelId
		? getUsage({
				modelId,
				usage: { cacheReads: cacheTokens, input: 0, output: 0 },
			}).costUSD?.totalUSD
		: undefined;
	const cacheCostText = USD_FORMATTER.format(cacheCost ?? 0);

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Cache</span>
			<TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
		</div>
	);
}

function TokensWithCost({
	tokens,
	costText,
}: Readonly<{
	tokens?: number;
	costText?: string;
}>) {
	return (
		<span>
			{tokens === undefined
				? "—"
				: COMPACT_NUMBER_FORMATTER.format(tokens)}
			{costText ? (
				<span className="ml-2 text-muted-foreground">• {costText}</span>
			) : null}
		</span>
	);
}
