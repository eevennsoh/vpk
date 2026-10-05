"use client";

import Image from "next/image";

import { BENTO_SESSION_AXIS, BENTO_SESSION_BARS, BENTO_SESSION_LEGEND, type BentoBar } from "@/components/projects/jira-team-eu26-end/finale/data/finale-bento-content";
import { BentoFade, BentoLabel } from "./finale-bento-parts";

const ASSET = "/illustration/jira-team-eu26-end/bento";
const AXIS = "text-[8px] leading-[normal] text-[#9CA3AF]";

function StackedBar({ bar }: Readonly<{ bar: BentoBar }>) {
	return (
		<div className="flex min-w-px flex-1 flex-col justify-end overflow-hidden rounded-[2px]" style={{ height: bar.height }}>
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

/** "Agent work by session": seven months of agent sessions, stacked by kind of work. */
function SessionChart() {
	return (
		<div className="relative flex h-[134.157px] w-full items-start gap-[7.892px]">
			<div className={`${AXIS} flex h-full w-[18.94px] shrink-0 flex-col items-end gap-[19px] pb-[15.783px] text-right`}>
				{BENTO_SESSION_AXIS.map((tick) => <p key={tick} className="w-full">{tick}</p>)}
			</div>
			<div className="absolute top-[5px] left-[27px] flex h-[134px] w-[463px] flex-col gap-[7.892px]">
				<div className="relative flex min-h-px flex-1 flex-col">
					{/* Gridlines, the baseline darker, under the bars. */}
					<div className="absolute inset-x-0 top-0 bottom-[0.58%] flex flex-col justify-between">
						{[0, 1, 2, 3].map((line) => <div key={line} className="h-[0.789px] w-full bg-[#F3F4F6]" />)}
						<Image src={`${ASSET}/agent-effectiveness-gridline.svg`} alt="" width={463} height={1} className="h-[0.789px] w-full max-w-none" />
					</div>
					<div className="relative flex min-h-px flex-1 items-end justify-center gap-[8px]">
						{BENTO_SESSION_BARS.map((bar, index) => <StackedBar key={index} bar={bar} />)}
					</div>
				</div>
				<div className={`${AXIS} flex w-full`}>
					<p className="flex-1">Jul 2026</p>
					<p className="flex-1 text-right">Oct 2026</p>
				</div>
			</div>
		</div>
	);
}

function SessionLegend() {
	return (
		<div className="flex w-full flex-col">
			{BENTO_SESSION_LEGEND.map((item) => (
				<div key={item.label} className="flex items-center gap-[6.313px] border-b-[0.789px] border-[#F3F4F6] px-[3.157px] py-[4.735px] text-[7.89px] leading-[normal]">
					<div className="size-[9.47px] shrink-0 rounded-[2px]" style={{ background: item.color }} />
					<p className="flex-1 whitespace-nowrap text-[#292A2E]">{item.label}</p>
					<p className="flex gap-[3.157px] whitespace-nowrap">
						<span className="text-[#292A2E]">{item.sessions}</span>
						<span className="text-[#6B6E76]">sessions</span>
					</p>
				</div>
			))}
			<div className="flex items-center justify-center gap-[3.157px] py-[3.157px] text-[8.1px] leading-[normal] text-[#6B7280]">
				Show all
				<Image src={`${ASSET}/agent-effectiveness-chevron.svg`} alt="" width={13} height={13} className="size-[12.627px]" />
			</div>
		</div>
	);
}

/** Agent Effectiveness: DX's session chart, the work agents did month by month. */
export function FinaleBentoAgentEffectiveness() {
	return (
		<>
			<div className="absolute top-[81px] left-[32.33px] flex w-[522px] flex-col gap-[12px] rounded-[8px] border-[0.3px] border-[#DDDEE1] bg-white px-[16px] py-[12px] drop-shadow-[0_3px_9px_rgba(0,0,0,0.05)]">
				<p className="text-[10px] leading-[normal] font-semibold tracking-[-0.1px] text-[#030712]">Agent work by session</p>
				<div className="flex w-full flex-col gap-[20px]">
					<SessionChart />
					<SessionLegend />
				</div>
			</div>
			<BentoFade size={67} />
			<BentoLabel text="Agent effectiveness" />
		</>
	);
}
