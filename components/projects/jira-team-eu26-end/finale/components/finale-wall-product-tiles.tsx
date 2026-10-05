"use client";

import { Fragment, useRef } from "react";
import Image from "next/image";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import CommentIcon from "@atlaskit/icon/core/comment";
import SearchIcon from "@atlaskit/icon/core/search";

import { TwgToolSourceIcon } from "@/components/ui-custom/twg-appstack";
import { JIRA_TEAM_EU26_END_COVER_APPS as COVER_APPS } from "@/components/projects/jira-team-eu26-end/data/keynote-board";

import { CUE } from "../data/finale-cues";
import { FINALE_BRAND, FINALE_COLORS } from "../data/finale-palette";
import { WALL_COMPOSER_PROMPTS, WALL_TERMINAL_SCRIPTS, wallAgentCard } from "../data/finale-wall-content";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { FINALE_INK, buildAfter } from "../lib/finale-build-style";
import type { WallAgentId } from "../lib/finale-wall-layout";
import { FinaleBuildSpan } from "./finale-build-text";
import { FINALE_TILE_RADIUS, FinaleDealt } from "./finale-tile";

/*
 * The product pieces on the wall, laid out at the 1920 stage's bento size
 * (the wall scales them down): the keynote's terminal, its agents, Rovo's
 * composer, and Jira's own status flow. Fixed brand surfaces, like the slide.
 *
 * Each takes a `revealStart`: landed blank from its GL sheet, it builds in the
 * bento's vocabulary from then on (text through the colour band, chrome dealt
 * in as the app stack deals its logos); null shows it already built.
 */

const SANS = { fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" } as const;
const LOZENGE = "rounded-[6px] px-3 py-1.5 text-[24px] leading-none font-bold tracking-normal uppercase";
const STATUS = {
	todo: { background: "#DDDEE1", color: "#292A2E" },
	progress: { background: "#E9F2FE", color: "#1558BC" },
	done: { background: "#DCFFF1", color: "#216E4E" },
} as const;
const SUBTLE = "#6B6E76";
const TERMINAL_INK = "#E6E6E6";
const TERMINAL_TONE = { brand: "#8FB8F6", dim: "#8C8F97", done: "#7EE2B8" } as const;
const TERMINAL_DOTS = ["#FF5F57", "#FEBC2E", "#28C840"] as const;
/** A terminal line types out over this long, the next starting before it is done. */
const TERMINAL_LINE_S = 0.5;
const TERMINAL_LINE_STAGGER_S = 0.3;

interface WallProductProps {
	/** When it builds (finale-clock seconds); null: already built. */
	readonly revealStart: number | null;
}

/**
 * A block caret that blinks on the finale clock, so it scrubs with everything
 * else; on a landed tile it waits, unlit, until its line has built (`from`).
 */
function Caret({ color, height, from }: Readonly<{ color: string; height: number; from: number | null }>) {
	const ref = useRef<HTMLSpanElement>(null);
	const onRef = useRef<boolean | null>(null);
	useFinaleFrame((time) => {
		const on = (from === null || time >= from) && time % 1.06 < 0.53;
		if (on === onRef.current || !ref.current) return;
		onRef.current = on;
		ref.current.style.opacity = on ? "1" : "0";
	});
	return <span ref={ref} className="inline-block align-middle" style={{ width: height * 0.5, height, background: color, marginLeft: 6, opacity: from === null ? undefined : 0 }} />;
}

export function WallTerminal({ script, revealStart }: Readonly<WallProductProps & { script: number }>) {
	const lines = WALL_TERMINAL_SCRIPTS[script % WALL_TERMINAL_SCRIPTS.length];
	const lineStart = (index: number) => buildAfter(revealStart, 0.25 + index * TERMINAL_LINE_STAGGER_S);
	return (
		<div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: FINALE_BRAND.black, borderRadius: FINALE_TILE_RADIUS, padding: 36, gap: 14 }}>
			<div className="flex gap-2.5 pb-3">
				{TERMINAL_DOTS.map((dot, index) => (
					<FinaleDealt key={dot} start={revealStart} index={index}>
						<span className="size-4 rounded-full" style={{ background: dot }} />
					</FinaleDealt>
				))}
			</div>
			{lines.map((line, index) => {
				// A line types out part by part, each in its own tone, as one sweep of the colour band.
				const length = line.reduce((sum, part) => sum + part.text.length, 0);
				let typed = 0;
				return (
					<p key={index} className="font-mono whitespace-pre" style={{ fontSize: 30, lineHeight: 1.25, color: TERMINAL_INK }}>
						{line.map((part, at) => {
							const share = part.text.length / length;
							const start = buildAfter(lineStart(index), (typed / length) * TERMINAL_LINE_S);
							typed += part.text.length;
							return <FinaleBuildSpan key={at} text={part.text} start={start} duration={share * TERMINAL_LINE_S} ink={part.tone ? TERMINAL_TONE[part.tone] : TERMINAL_INK} tracking="normal" />;
						})}
						{index === lines.length - 1 ? <Caret color={TERMINAL_INK} height={30} from={buildAfter(lineStart(index), TERMINAL_LINE_S)} /> : null}
					</p>
				);
			})}
		</div>
	);
}

export function WallAgent({ agent, revealStart }: Readonly<WallProductProps & { agent: WallAgentId }>) {
	const card = wallAgentCard(agent);
	return (
		<div className="absolute inset-0 flex flex-col justify-between overflow-hidden" style={{ ...SANS, background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS, padding: 40, color: FINALE_INK }}>
			<div className="flex items-center gap-6">
				<FinaleDealt start={revealStart}>
					<Image src={card.avatarSrc} alt="" width={112} height={112} className="size-28 rounded-[24px]" />
				</FinaleDealt>
				<div className="flex flex-col gap-3">
					<FinaleBuildSpan text={card.name} start={revealStart} className="text-[44px] leading-none" />
					<FinaleBuildSpan text="Agent session" start={buildAfter(revealStart, 0.2)} ink={SUBTLE} className="text-[28px] leading-none" />
				</div>
			</div>
			<div className="flex flex-col gap-4">
				<FinaleBuildSpan text={`${card.code} · ${card.story}`} start={buildAfter(revealStart, 0.4)} className="text-[34px] leading-tight" />
				<div className="flex gap-3">
					<FinaleDealt start={buildAfter(revealStart, 0.8)} index={0}><span className={LOZENGE} style={STATUS.done}>Done</span></FinaleDealt>
					<FinaleDealt start={buildAfter(revealStart, 0.8)} index={1}><span className={LOZENGE} style={STATUS.todo}>Reviewed</span></FinaleDealt>
				</div>
			</div>
		</div>
	);
}

export function WallComposer({ prompt, revealStart }: Readonly<WallProductProps & { prompt: number }>) {
	const text = WALL_COMPOSER_PROMPTS[prompt % WALL_COMPOSER_PROMPTS.length];
	const asked = buildAfter(revealStart, 0.3);
	return (
		<div className="absolute inset-0 flex flex-col justify-between overflow-hidden" style={{ ...SANS, background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS, padding: 32, color: FINALE_INK }}>
			<div className="flex items-center gap-3 text-[28px] leading-none text-[#6B6E76]">
				<FinaleDealt start={revealStart}>
					<span className="origin-left scale-[1.75]"><TwgToolSourceIcon source={COVER_APPS.rovo} size="small" /></span>
				</FinaleDealt>
				<FinaleBuildSpan text="Ask Rovo" start={revealStart} ink={SUBTLE} className="inline-block pl-4" />
			</div>
			<FinaleDealt start={buildAfter(revealStart, 0.15)} className="block">
				<div className="flex items-end gap-4 rounded-[28px] border-2 border-[#DDDEE1] p-5">
					<p className="min-w-0 flex-1 text-[34px] leading-[1.2]">
						{/* Inline, so a prompt that wraps types out line after line. */}
						<FinaleBuildSpan text={text} start={asked} duration={CUE.reveal * 0.8} className="inline" />
						<Caret color={FINALE_BRAND.blue} height={34} from={buildAfter(asked, CUE.reveal * 0.8)} />
					</p>
					<FinaleDealt start={buildAfter(asked, CUE.reveal * 0.6)} className="flex shrink-0">
						<span className="flex size-14 items-center justify-center rounded-full" style={{ background: "#1868DB" }}>
							<span className="scale-[1.75] text-white"><ArrowUpIcon label="" color="currentColor" size="small" /></span>
						</span>
					</FinaleDealt>
				</div>
			</FinaleDealt>
		</div>
	);
}

const FLOW = [
	{ label: "To do", tone: STATUS.todo },
	{ label: "In progress", tone: STATUS.progress },
	{ label: "Done", tone: STATUS.done },
] as const;

/** Jira's status flow, end to end, dealt in from left to right. */
export function WallFlow({ revealStart }: Readonly<WallProductProps>) {
	return (
		<div className="absolute inset-0 flex items-center justify-center gap-4 overflow-hidden" style={{ ...SANS, background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS, color: SUBTLE }}>
			{FLOW.map((step, index) => (
				<Fragment key={step.label}>
					{index > 0 ? <FinaleDealt start={revealStart} index={index * 2 - 1}><span className="text-[30px]">→</span></FinaleDealt> : null}
					<FinaleDealt start={revealStart} index={index * 2}><span className={LOZENGE} style={step.tone}>{step.label}</span></FinaleDealt>
				</Fragment>
			))}
		</div>
	);
}

/** Rovo's search and chat switch. */
export function WallSearch({ revealStart }: Readonly<WallProductProps>) {
	return (
		<div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ ...SANS, background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS, color: FINALE_INK }}>
			<FinaleDealt start={revealStart}>
				<div className="flex items-center gap-2 rounded-full bg-[#F1F2F4] p-2 text-[32px] leading-none">
					<span className="flex items-center gap-3 rounded-full bg-white px-6 py-3 shadow-[0_1px_3px_rgba(9,30,66,0.2)]">
						<span className="scale-150"><SearchIcon label="" color="currentColor" size="small" /></span>
						<FinaleBuildSpan text="Search" start={buildAfter(revealStart, 0.2)} duration={CUE.reveal * 0.6} />
					</span>
					<span className="flex items-center gap-3 px-6 py-3 text-[#6B6E76]">
						<span className="scale-150"><CommentIcon label="" color="currentColor" size="small" /></span>
						<FinaleBuildSpan text="Chat" start={buildAfter(revealStart, 0.35)} duration={CUE.reveal * 0.6} ink={SUBTLE} />
					</span>
				</div>
			</FinaleDealt>
		</div>
	);
}
