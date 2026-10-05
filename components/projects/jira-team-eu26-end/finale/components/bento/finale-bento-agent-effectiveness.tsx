"use client";

import Image from "next/image";

import { BENTO_SESSION_AXIS, BENTO_SESSION_BARS, BENTO_SESSION_LEGEND, type BentoBar } from "@/components/projects/jira-team-eu26-end/finale/data/finale-bento-content";
import { BENTO_PANEL_HEADING, BentoFade, BentoLabel, BentoPanel } from "./finale-bento-parts";

const ASSET = "/illustration/jira-team-eu26-end/bento";
const AXIS = "text-[10px] leading-[normal] text-[#6B6E76]";
const FIGURES = { fontFeatureSettings: '"lnum" 1, "tnum" 1' } as const;

function StackedBar({ bar }: Readonly<{ bar: BentoBar }>) {
	return (
		<div className="flex min-w-px flex-1 flex-col justify-end overflow-hidden rounded-t-[4px]" style={{ height: bar.height }}>
			{bar.segments.map((segment, index) => (
				<div
					key={index}
					className={segment.height === undefined ? "min-h-px w-full flex-1" : "w-full shrink-0"}
					style={{ background: segment.color, height: segment.height }}
				/>
			))}
		</div>
	);
}

/** "Agent work by session": five months of agent sessions, stacked by kind of work. */
function SessionChart() {
	return (
		<div className="flex h-[159px] w-full items-start gap-[7.892px]">
			<div className={`${AXIS} flex h-full w-[18.94px] shrink-0 flex-col items-end justify-between pb-[39px] text-right`}>
				{BENTO_SESSION_AXIS.map((tick) => <p key={tick} className="w-full">{tick}</p>)}
			</div>
			<div className="flex h-[134px] min-w-px flex-1 flex-col gap-[7.892px]">
				<div className="relative flex h-[116px] w-full flex-col">
					{/* Gridlines under the bars, the darker baseline at their foot. */}
					<div className="absolute top-[5px] right-[-0.11%] left-[0.04%] h-[111px] -scale-y-100">
						<div className="absolute inset-[-0.36%_0_0_0]">
							<Image src={`${ASSET}/agent-effectiveness-lines.svg`} alt="" width={413} height={111} className="block size-full max-w-none" />
						</div>
					</div>
					<div className="relative flex min-h-px w-full flex-1 items-end justify-center gap-[15px]">
						{BENTO_SESSION_BARS.map((bar, index) => <StackedBar key={index} bar={bar} />)}
					</div>
				</div>
				<div className={`${AXIS} flex w-full`}>
					<p className="min-w-px flex-1">Jul 2026</p>
					<p className="min-w-px flex-1 text-right">Oct 2026</p>
				</div>
			</div>
		</div>
	);
}

function SessionLegend() {
	return (
		<div className="flex w-[439.56px] flex-col gap-[8px] px-[9.99px] text-[14.985px] leading-[19.98px]">
			{BENTO_SESSION_LEGEND.map((item, index) => (
				<div key={item.label} className="flex flex-col gap-[8px]">
					{index > 0 ? <div className="h-[0.789px] w-full bg-[#F3F4F6]" /> : null}
					<div className="flex w-full items-center justify-between">
						{/* A long label runs on under the figures' empty start, as in the Figma. */}
						<div className="flex min-w-0 items-center gap-[9.99px]">
							<div className="size-[9px] shrink-0 rounded-full" style={{ background: item.color }} />
							<p className="whitespace-nowrap text-[#6B6E76]">{item.label}</p>
						</div>
						<p className="flex w-[205.805px] shrink-0 justify-end gap-[3px] whitespace-nowrap" style={FIGURES}>
							<span className="text-[#292A2E]">{item.sessions}</span>
							<span className="text-[#6B6E76]">sessions</span>
						</p>
					</div>
				</div>
			))}
		</div>
	);
}

/** Agent Effectiveness: DX's session chart, the work agents did month by month. */
export function FinaleBentoAgentEffectiveness() {
	return (
		<>
			<BentoPanel className="top-[94px] left-[calc(50%+0.08px)] -translate-x-1/2">
				<div className="flex w-[439.56px] flex-col gap-[12px]">
					<p className={BENTO_PANEL_HEADING}>Agent work by session</p>
					<SessionChart />
				</div>
				<SessionLegend />
			</BentoPanel>
			<BentoFade size={69} />
			<BentoLabel text="Agent effectiveness" />
		</>
	);
}
