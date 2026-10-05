"use client";

import Image from "next/image";

import { BentoFade, BentoLabel, bentoGenerativeGlow } from "./finale-bento-parts";

const ASSET = "/illustration/jira-team-eu26-end/bento";
const PANEL_GLOW = bentoGenerativeGlow(855.22, 304.35, "42.761 -19.057 53.55 15.217 427.61 152.17");
const NAV_TEXT = "absolute top-[11.01px] text-[30px] leading-[40px] whitespace-nowrap";

interface NavRowProps {
	readonly glyph: string;
	readonly label: string;
	readonly labelLeft: number;
	readonly selected?: boolean;
}

/** One of Rovo's sidebar rows, its glyph 22px in and its label beside it. */
function NavRow({ glyph, label, labelLeft, selected = false }: Readonly<NavRowProps>) {
	return (
		<div className={`relative w-full shrink-0 ${selected ? "h-[60px] rounded-[10px] bg-[rgba(28,29,33,0.08)]" : "h-[62.5px]"}`}>
			<Image src={`${ASSET}/${glyph}`} alt="" width={31} height={31} className="absolute top-[15.41px] left-[22.02px] size-[30.826px]" />
			<p className={`${NAV_TEXT} ${selected ? "text-[#292A2E]" : "text-[#6B6E76]"}`} style={{ left: labelLeft }}>{label}</p>
			{/* The presenter's pointer, resting on New chat. */}
			{selected ? <Image src={`${ASSET}/rovo-pointer.svg`} alt="" width={42} height={57} className="absolute top-[20.234px] left-[282.885px] h-[56.756px] w-[41.533px] max-w-none" /> : null}
		</div>
	);
}

/** Search or Chat: Rovo's two modes, Chat chosen. */
function ModeSwitch() {
	return (
		<div className="flex h-[80px] w-full items-center justify-center rounded-full bg-[rgba(5,21,36,0.06)] p-[5px] text-[30px] leading-[30px] whitespace-nowrap">
			<div className="flex h-full min-w-px flex-1 items-center justify-center gap-[5px] rounded-full px-[20px] text-[#6B6E76]">
				<Image src={`${ASSET}/rovo-search-glyph.svg`} alt="" width={45} height={45} className="size-[45px]" />
				Search
			</div>
			<div className="flex h-full min-w-px flex-1 items-center justify-center gap-[5px] rounded-full border-[0.75px] border-[#DDDEE1] bg-white px-[20px] text-[#292A2E] drop-shadow-[0_5.479px_5.479px_rgba(0,0,0,0.16)]">
				<Image src={`${ASSET}/rovo-chat-glyph.svg`} alt="" width={45} height={43} className="h-[42.5px] w-[45px]" />
				Chat
			</div>
		</div>
	);
}

/** Rovo Work Mode: Rovo's own app, switched to Chat and starting a new one. */
export function FinaleBentoRovoWorkMode() {
	return (
		<>
			{/* Figma's "✦ Generative Border - Full": the brand glow the panel floats on. */}
			<div className="absolute top-[121px] left-[73.67px] flex h-[374px] w-[440px] rounded-[30.435px] p-[48.696px]">
				<div className="h-full min-w-px flex-1 blur-[48.696px]" style={{ backgroundImage: PANEL_GLOW }} />
			</div>
			<div className="absolute top-[calc(50%+113px)] left-[calc(50%+0.33px)] h-[464px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border-[0.75px] border-[#DDDEE1] bg-[rgba(255,255,255,0.95)] shadow-[0_7.534px_45.202px_rgba(0,0,0,0.05)]" />
			<div className="absolute bottom-[48px] left-[calc(50%+0.33px)] flex w-[400px] -translate-x-1/2 flex-col items-center gap-[20px]">
				<ModeSwitch />
				<div className="flex w-full flex-col gap-[2.5px]">
					<NavRow glyph="rovo-for-you-glyph.svg" label="For you" labelLeft={79.32} />
					<NavRow glyph="rovo-new-chat-glyph.svg" label="New chat" labelLeft={78.85} selected />
					<NavRow glyph="rovo-agents-glyph.svg" label="Agents" labelLeft={79.49} />
				</div>
			</div>
			<BentoFade size={113} />
			<BentoLabel text="Rovo work mode" />
		</>
	);
}
