"use client";

import Image from "next/image";
import AppIcon from "@atlaskit/icon/core/app";

import { IconTile } from "@/components/ui/icon-tile";
import { LogoThirdParty } from "@/components/ui/logo-third-party";

import { BENTO_MODEL_SPLIT, BENTO_PROVIDER_COSTS, type BentoCostRow } from "@/components/projects/jira-team-eu26-end/finale/data/finale-bento-content";
import { BENTO_PANEL_HEADING, BentoFade, BentoLabel, BentoPanel } from "./finale-bento-parts";

const ASSET = "/illustration/jira-team-eu26-end/bento";
const FIGURES = { fontFeatureSettings: '"lnum" 1, "tnum" 1' } as const;
/** The donut's series, each drawn by its own arc: Anthropic's green ring, then OpenAI, Cursor, Canva and the rest. */
const DONUT_ARCS = [
	{ src: "ai-capital-donut-1.svg", className: "inset-0 size-full" },
	{ src: "ai-capital-donut-2.svg", className: "top-[30.97%] left-0 h-[69.03%] w-[57.16%]" },
	{ src: "ai-capital-donut-3.svg", className: "top-[0.56%] left-0 h-[56.87%] w-[44.65%]" },
	{ src: "ai-capital-donut-4.svg", className: "top-0 left-[14.64%] h-[24.54%] w-[35.36%]" },
	{ src: "ai-capital-donut-5.svg", className: "top-0 left-[37.06%] h-[15.23%] w-[12.94%]" },
] as const;

/** A provider's brand tile, or ADS's grey App tile (in its light-mode colours) for the rest. */
function BrandTile({ logo }: Readonly<{ logo: BentoCostRow["logo"] }>) {
	if (logo === "app") {
		return <IconTile icon={<AppIcon label="" color="currentColor" />} label="" size="xsmall" className="bg-[#F0F1F2] text-[#6B6E76]" aria-hidden />;
	}
	return (
		<span className="flex size-[21px] items-center justify-center">
			<span className="flex scale-[1.05]"><LogoThirdParty name={logo} size="xsmall" label="" /></span>
		</span>
	);
}

function CostByProvider() {
	return (
		<div className="flex w-[439.56px] flex-col gap-[12px]">
			<p className={BENTO_PANEL_HEADING}>Cost by provider</p>
			<div className="relative h-[199.8px] w-full">
				<div className="absolute top-0 left-0 size-[199.8px] overflow-hidden">
					{DONUT_ARCS.map((arc) => (
						<Image key={arc.src} src={`${ASSET}/${arc.src}`} alt="" width={200} height={200} className={`absolute max-w-none ${arc.className}`} />
					))}
					<div className="absolute top-[calc(50%+0.42px)] left-[calc(50%+0.62px)] flex w-[149.85px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center whitespace-nowrap">
						<p className="text-[22.5px] leading-[21px] font-semibold text-[#292A2E]" style={FIGURES}>$5.6m</p>
						<p className="text-[12px] leading-[19.98px] text-[#6B6E76]">Total cost</p>
					</div>
				</div>
				<div className="absolute top-[15px] left-[229.77px] flex w-[209.79px] flex-col gap-[14.985px]">
					{BENTO_PROVIDER_COSTS.map((row) => (
						<div key={row.label} className="flex h-[22.477px] items-center justify-between text-[15px] leading-[19.5px]">
							<div className="flex items-center gap-[4.5px]">
								<div className="flex items-center gap-[6px]">
									<div className="size-[9px] rounded-full" style={{ background: row.color }} />
									<BrandTile logo={row.logo} />
								</div>
								<p className="whitespace-nowrap text-[#6B6E76]">{row.label}</p>
							</div>
							<p className="text-right whitespace-nowrap text-[#292A2E]" style={FIGURES}>{row.cost}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function CostByModel() {
	return (
		<div className="flex w-[439.56px] flex-col gap-[12px]">
			<p className={BENTO_PANEL_HEADING}>Cost by model</p>
			<p className="text-[24.975px] leading-[29.97px] whitespace-nowrap text-[#505258]">Opus 4.6: 20.03%</p>
			<div className="flex w-full gap-[2.498px] overflow-hidden rounded-[2.498px]">
				{BENTO_MODEL_SPLIT.map((share) => <div key={share.color} className="h-[9.99px] shrink-0 first:rounded-l-[1.249px] last:rounded-r-[1.249px]" style={{ background: share.color, width: share.width }} />)}
			</div>
		</div>
	);
}

/** AI Capital Management: what the company spends on AI, by provider and by model. */
export function FinaleBentoAiCapital() {
	return (
		<>
			<BentoPanel className="top-[81px] right-[44.42px]">
				<div className="flex flex-col gap-[24px]">
					<CostByProvider />
					<CostByModel />
				</div>
			</BentoPanel>
			<BentoFade size={69} />
			<BentoLabel text="AI Capital management" />
		</>
	);
}
