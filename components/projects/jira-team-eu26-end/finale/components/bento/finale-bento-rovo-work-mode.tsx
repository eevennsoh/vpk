"use client";

import type { ComponentType } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ScorecardIcon from "@atlaskit/icon/core/scorecard";

import { BentoFade, BentoLabel, bentoGenerativeGlow } from "./finale-bento-parts";

const ROW_GLOW = bentoGenerativeGlow(562, 200, "28.1 -12.523 35.19 10 281 100");
/** The picker's other modes, ghosted above and below the one chosen. */
const GHOST_ROW = "absolute left-[calc(50%+0.04px)] h-[92px] w-[478.071px] -translate-x-1/2 rounded-[19.714px] border-[1.643px] border-[#DDDEE1] shadow-[0_6px_36px_rgba(0,0,0,0.05)]";

/** A 16px ADS glyph scaled up to its Figma box, `size` px square. */
function Glyph({ icon: Icon, size }: Readonly<{ icon: ComponentType<{ label: string; color?: "currentColor" }>; size: number }>) {
	return (
		<span className="flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
			<span className="flex" style={{ scale: size / 16 }}><Icon label="" color="currentColor" /></span>
		</span>
	);
}

/** Work mode, chosen: its badge, name, Open Beta lozenge and description, ticked. */
function WorkModeRow() {
	return (
		<div className="absolute top-[calc(50%+0.4px)] left-[calc(50%+0.2px)] h-[92px] w-[506px] -translate-x-1/2 -translate-y-1/2">
			{/* Figma's "✦ Generative Border - Full": the brand glow the row floats on. */}
			<div className="absolute top-[1.64px] left-1/2 flex h-[88.714px] w-[496.143px] -translate-x-1/2 rounded-[20px] p-[32px]">
				<div className="h-full min-w-px flex-1 blur-[32px]" style={{ backgroundImage: ROW_GLOW }} />
			</div>
			<div className="absolute inset-0 flex flex-col justify-center overflow-hidden rounded-[19.714px] border-[0.5px] border-[#DDDEE1] bg-[#FFFFFF] py-[16px] shadow-[0_6px_36px_rgba(0,0,0,0.05)]">
				<div className="flex w-full items-center gap-[16px] px-[24px]">
					<span className="flex shrink-0 rounded-full bg-[#292A2E] p-[12.321px] text-[#FFFFFF]">
						<Glyph icon={ScorecardIcon} size={24.643} />
					</span>
					<div className="flex min-w-px flex-1 flex-col">
						<div className="flex items-center gap-[7.2px]">
							<p className="text-[24.643px] leading-[30.968px] font-medium whitespace-nowrap text-[#292A2E]">Work</p>
							{/* Its stroke sits inside its box, as Figma draws it. */}
							<span className="flex items-center rounded-[6.571px] bg-[#EED7FC] px-[6px] py-[4px] shadow-[inset_0_0_0_1.44px_#D8A0F7]">
								<span className="h-[20px] w-[90px] text-[18.071px] leading-[18.071px] whitespace-nowrap text-[#48245D]">Open Beta</span>
							</span>
						</div>
						<p className="flex h-[24.774px] items-center text-[18.071px] leading-[20px] whitespace-nowrap text-[#6B6E76]">Tackles complex work across your tools</p>
					</div>
					<span className="text-[#292A2E]"><Glyph icon={CheckMarkIcon} size={24.774} /></span>
				</div>
			</div>
		</div>
	);
}

/** Rovo Work Mode: Rovo's mode picker, switched to Work. */
export function FinaleBentoRovoWorkMode() {
	return (
		<>
			<div className={`${GHOST_ROW} top-[22px]`} />
			<div className={`${GHOST_ROW} top-[247px]`} />
			<BentoFade size={134} hold={0.173} />
			<BentoFade edge="top" size={134} hold={0.173} />
			<BentoFade size={67} />
			<BentoLabel text="Rovo work mode" />
			<WorkModeRow />
		</>
	);
}
