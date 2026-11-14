"use client";

import type { ReactNode } from "react";

import { AgentCardShell } from "@/components/blocks/agent-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tile } from "@/components/ui/tile";
import { TWGAppstack, type TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import PatternTile, { type PatternStrokeOptions } from "@/components/website/demos/visual/pattern-tile";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	DEFAULT_TWG_AGENT_CARD_SOURCES,
	DEFAULT_TWG_AGENT_CARD_SUGGESTIONS,
} from "../data/demo";

export interface TWGAgentSuggestion {
	id: string;
	name: string;
	description: string;
	avatarSrc: string;
}

export interface TWGAgentCardProps {
	userName?: string;
	userAvatarSrc?: string;
	headline?: ReactNode;
	suggestedAgents?: readonly TWGAgentSuggestion[];
	sources?: readonly TwgToolSource[];
	onSelect?: () => void;
	selectLabel?: string;
	className?: string;
}

const DEFAULT_USER_AVATAR_SRC = "/avatar-user/venn/venn.png";
const DEFAULT_HEADLINE = "based on what we know from Teamwork Graph, these are the agents we suggest for you.";
const GRID_SCALE = 16;
const GRID_STRIP_STROKE = {
	width: 1,
} satisfies PatternStrokeOptions;

function TWGAgentCardHeadline({
	headline,
	userAvatarSrc,
	userName,
}: Readonly<{
	headline: ReactNode;
	userAvatarSrc: string;
	userName: string;
}>) {
	return (
		<div className="grid w-full gap-1 text-text" style={{ font: token("font.body") }}>
			<p aria-hidden="true" style={{ font: token("font.heading.large") }}>👋</p>
			<p>
				<span className="inline-flex items-center gap-2 align-middle">
					<span>G&apos;day</span>
					<Avatar aria-hidden size="xs">
						<AvatarImage alt="" src={userAvatarSrc} />
						<AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
					</Avatar>
					<span>{userName},</span>
				</span>{" "}
				{headline}
			</p>
		</div>
	);
}

function TWGAgentSuggestionRow({ suggestion }: Readonly<{ suggestion: TWGAgentSuggestion }>) {
	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<Avatar aria-hidden shape="hexagon" size="sm">
				<AvatarImage alt="" src={suggestion.avatarSrc} />
				<AvatarFallback>{suggestion.name.slice(0, 2).toUpperCase()}</AvatarFallback>
			</Avatar>
			<div className="grid min-w-0 gap-0">
				<p className="truncate text-text" style={{ font: token("font.heading.xxsmall") }}>
					{suggestion.name}
				</p>
				<p className="truncate text-text-subtlest" style={{ font: token("font.body.small") }}>
					{suggestion.description}
				</p>
			</div>
		</div>
	);
}

function TWGAgentCardStats({
	connectedSourceCount,
	suggestedAgentCount,
}: Readonly<{ connectedSourceCount: number; suggestedAgentCount: number }>) {
	return (
		<div
			className="relative z-10 isolate h-[208px] shrink-0 overflow-hidden bg-surface p-4"
			data-slot="twg-agent-card-stats"
		>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="h-[calc(100%+16px)] w-[calc(100%+16px)] -translate-x-[0.5px] -translate-y-[0.5px]">
					<PatternTile
						patternType="grid"
						front={token("color.border")}
						back="transparent"
						scale={GRID_SCALE}
						stroke={GRID_STRIP_STROKE}
						fill="tile"
						opacity={1}
						position="top-left"
					/>
				</div>
			</div>
			<div className="relative z-10 grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
				<div className="relative flex min-w-0 flex-col justify-end px-3 pt-2 pb-4" data-slot="twg-agent-card-stat-tile">
					<div aria-hidden="true" className="pointer-events-none absolute inset-px bg-surface" />
					<div
						aria-label={`${suggestedAgentCount} suggested agents`}
						className="relative z-10 font-mono text-[148px]/[0.7] font-thin tabular-nums text-text"
					>
						{suggestedAgentCount}
					</div>
					<p className="relative z-10 mt-4 text-text-subtlest" style={{ font: token("font.body.small") }}>suggested agents</p>
				</div>
				<div className="grid min-w-0 grid-rows-2 gap-4">
					<div className="relative flex flex-col justify-center px-3 py-2" data-slot="twg-agent-card-stat-tile">
						<div aria-hidden="true" className="pointer-events-none absolute inset-px bg-surface" />
						<p className="relative z-10 font-mono text-[28px]/[1] font-semibold tabular-nums text-text">6</p>
						<p className="relative z-10 mt-1 text-text-subtlest" style={{ font: token("font.body.small") }}>hours saved per week</p>
					</div>
					<div className="relative flex flex-col justify-center px-3 py-2" data-slot="twg-agent-card-stat-tile">
						<div aria-hidden="true" className="pointer-events-none absolute inset-px bg-surface" />
						<p className="relative z-10 font-mono text-[28px]/[1] font-semibold tabular-nums text-text">{connectedSourceCount}</p>
						<p className="relative z-10 mt-1 text-text-subtlest" style={{ font: token("font.body.small") }}>connected apps</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export function TWGAgentCard({
	className,
	headline = DEFAULT_HEADLINE,
	onSelect,
	selectLabel = "Open Teamwork Graph agent recommendations",
	sources = DEFAULT_TWG_AGENT_CARD_SOURCES,
	suggestedAgents = DEFAULT_TWG_AGENT_CARD_SUGGESTIONS,
	userAvatarSrc = DEFAULT_USER_AVATAR_SRC,
	userName = "Venn",
}: Readonly<TWGAgentCardProps>) {
	const visibleSuggestions = suggestedAgents.slice(0, 3);

	return (
		<AgentCardShell
			className={cn(
				"h-[553px] w-[368px] max-w-[368px] gap-0 overflow-hidden rounded-2xl bg-surface p-0 after:rounded-2xl [&_[data-slot=agent-card-select]]:rounded-2xl",
				className,
			)}
			onSelect={onSelect}
			selectLabel={selectLabel}
		>
			<div
				className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl"
				data-slot="twg-agent-card"
			>
				<div className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-4">
					<Tile
						className="bg-surface"
						hasBorder
						label="Teamwork Graph"
						size="large"
						variant="transparent"
					>
						<TWGLoader label="Teamwork Graph" size="small" />
					</Tile>
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-text-subtle" style={{ font: token("font.heading.xxsmall") }}>
							Powered by Teamwork Graph
						</h3>
						<TWGAppstack
							className="mt-1 justify-start"
							direction="left-to-right"
							iconSize="small"
							maxVisible={7}
							sources={sources}
						/>
					</div>
				</div>

				<div className="relative z-10 shrink-0 px-4 pt-4 pb-4">
					<TWGAgentCardHeadline
						headline={headline}
						userAvatarSrc={userAvatarSrc}
						userName={userName}
					/>
				</div>

				<TWGAgentCardStats connectedSourceCount={sources.length} suggestedAgentCount={suggestedAgents.length} />

				<div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-4 px-4 pt-4 pb-4" data-slot="twg-agent-card-suggestions">
					{visibleSuggestions.map((suggestion) => (
						<TWGAgentSuggestionRow key={suggestion.id} suggestion={suggestion} />
					))}
				</div>
			</div>
		</AgentCardShell>
	);
}

TWGAgentCard.displayName = "TWGAgentCard";
