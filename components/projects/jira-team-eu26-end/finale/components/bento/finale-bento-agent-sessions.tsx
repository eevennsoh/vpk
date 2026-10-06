"use client";

import Image from "next/image";
import TaskIcon from "@atlaskit/icon/core/task";

import { BentoFade, BentoLabel } from "./finale-bento-parts";

const ASSIGNEE = "/avatar-human/robi-lopez.png";
const ASSET = "/illustration/jira-team-eu26-end/bento";
/** Jira board UI at 1.667×: the Figma's stage scale for a Kanban card. */
const BODY = { fontSize: 23.341, lineHeight: "33.344px" } as const;
/**
 * The Figma frame (587 × 480 at the 1920 stage), centred on the tile and as
 * tall as it. The board slice keeps the Figma's coordinates inside it, pinned
 * under the label, so the dragged session stays on its card whatever shape
 * the screen gives the tile; a taller tile adds plain tile below the fade.
 */
const FRAME = "absolute inset-y-0 left-1/2 w-[586.667px] -translate-x-1/2";
/**
 * The board's columns, ghosted behind the cards, run off the tile's foot. A
 * Figma frame with no fill casts its shadow from its stroke alone, so this is
 * a `drop-shadow` filter, not a box shadow.
 */
const COLUMN = "absolute top-[117px] bottom-[-62px] w-[440px] rounded-[28px] border-[1.5px] border-[#DDDEE1] drop-shadow-[0_7.304px_43.826px_rgba(0,0,0,0.05)]";
/**
 * The drop target's 2px brand stroke, fading out toward its top right: the
 * Figma's linear stroke (#3941FE solid to 33%, clear at 100%) mapped onto the
 * 410 × 160 card. The stroke paints over the card's white fill, as Figma's
 * inside stroke does.
 */
const TARGET_STROKE = {
	borderColor: "transparent",
	backgroundImage: "linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(136.876deg, #3941FE 28.738%, rgba(57, 65, 254, 0) 61.756%)",
	backgroundOrigin: "border-box",
	backgroundClip: "padding-box, border-box",
} as const;

interface SessionSlotProps {
	readonly summary: string;
	/** The card the session is being dropped on: brand-outlined, in a neutral well. */
	readonly target?: boolean;
	readonly className: string;
}

/** A Jira card with the "Link agent session" chin a dragged session opens under it. */
function SessionSlot({ summary, target = false, className }: Readonly<SessionSlotProps>) {
	return (
		<div className={`absolute left-[82px] h-[233px] w-[420px] rounded-[16px] ${className}`}>
			<div
				className="absolute top-0 left-[calc(50%-0.27px)] flex w-[423.47px] -translate-x-1/2 flex-col gap-[6.669px] rounded-[20px] p-[6.669px]"
				style={{ background: target ? "rgba(5, 21, 36, 0.06)" : "rgba(23, 23, 23, 0.03)" }}
			>
				<div className="relative isolate flex flex-col rounded-[16px] px-[20.006px] pt-[20.006px] pb-[13.338px] shadow-[0_0_1.667px_rgba(9,30,66,0.31),0_1.667px_1.667px_rgba(9,30,66,0.25)]">
					<div className={`absolute inset-0 z-[1] rounded-[16px] bg-[#FFFFFF] ${target ? "border-2" : ""}`} style={target ? TARGET_STROKE : undefined} />
					<p className="relative z-[2] h-[66.688px] w-[370.119px] text-[#292A2E]" style={BODY}>{summary}</p>
					<div className="relative z-[2] mt-[13.338px] flex h-[46.682px] items-center gap-[6.669px]">
						<div className="flex flex-1 items-center gap-[6.669px]">
							<span className="flex h-[33.344px] w-[26.675px] items-center justify-center">
								<span className="flex scale-[1.667] text-[#1868DB]">
									<TaskIcon label="" color="currentColor" />
								</span>
							</span>
							<span className="text-[20px] leading-[27px] font-semibold text-[#505258]">TEU-112</span>
						</div>
						<Image src={ASSIGNEE} alt="" width={40} height={40} className="size-[40.013px] rounded-full object-cover" />
					</div>
				</div>
				<div className="flex h-[53.351px] items-center justify-center rounded-[10px] text-[#6B6E76]" style={BODY}>
					Link agent session
				</div>
			</div>
		</div>
	);
}

/** Jordan Okafor's agent session, picked up off the board and carried by the grab cursor. */
function SessionChip() {
	return (
		<>
			<div className="absolute top-[94px] left-[20px] flex h-[98.526px] w-[272.942px] items-center justify-center">
				<div
					className="flex h-[80.026px] w-[268.013px] rotate-4 items-center justify-center gap-[12px] overflow-hidden rounded-[16px] px-[20.006px] py-[13.338px] shadow-[0_0_1.667px_rgba(30,31,33,0.31),0_13.338px_20.006px_rgba(30,31,33,0.15)]"
					style={{ backgroundImage: "linear-gradient(270deg, rgba(57, 65, 255, 0.128) 0%, rgba(57, 65, 255, 0) 28.065%), linear-gradient(90deg, #FFFFFF, #FFFFFF)" }}
				>
					{/* Two 32px avatars, the agent's hex over the person it works for, 8px overlapping. */}
					<div className="isolate flex shrink-0 items-center">
						<span className="relative z-[2] mr-[-8px] size-[32px] shrink-0">
							<Image src={`${ASSET}/agent-sessions-agent-avatar.svg`} alt="" width={35} height={37} className="absolute top-[-2.438px] left-[-1.43px] h-[36.882px] w-[34.857px] max-w-none" />
						</span>
						<Image src={ASSIGNEE} alt="" width={32} height={32} className="relative z-[1] size-[32px] shrink-0 rounded-full object-cover" />
					</div>
					<p className="whitespace-nowrap text-[#000000]" style={BODY}>Jordan Okafor</p>
				</div>
			</div>
			<Image src={`${ASSET}/agent-sessions-grab.svg`} alt="" width={34} height={32} className="absolute top-[168.796px] left-[140.247px] h-[31.786px] w-[34.292px] max-w-none" />
		</>
	);
}

/** Agent Sessions: a session dragged from the board onto the Jira card it worked on. */
export function FinaleBentoAgentSessions() {
	return (
		<>
			<div className={FRAME}>
				<div className={`${COLUMN} left-[72px]`} />
				<div className={`${COLUMN} left-[531px]`} />
				<div className={`${COLUMN} left-[-388px]`} />
				<SessionSlot summary="Publish and link the rollback rehearsal runbook" className="top-[370px]" />
			</div>
			{/* The Figma's 186px fade from y=294, solid tile below it on a taller tile, so the second card fades as it does in the Figma. */}
			<BentoFade size="calc(100% - 294px)" hold="calc(100% - 186px)" />
			<div className={FRAME}>
				<SessionSlot summary="Confirm the sandbox key retention window before replay" target className="top-[127px] overflow-hidden" />
				<SessionChip />
			</div>
			<BentoLabel text="Agent sessions" />
		</>
	);
}
