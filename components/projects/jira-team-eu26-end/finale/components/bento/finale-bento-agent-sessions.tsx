"use client";

import Image from "next/image";
import TaskIcon from "@atlaskit/icon/core/task";

import { BentoFade, BentoLabel } from "./finale-bento-parts";

const ASSIGNEE = "/avatar-human/robi-lopez.png";
const ASSET = "/illustration/jira-team-eu26-end/bento";
/** Jira board UI at 1.667×: the Figma's stage scale for a Kanban card. */
const BODY = { fontSize: 23.341, lineHeight: "33.344px" } as const;
/** The board's columns, ghosted behind the cards. */
const COLUMN = "absolute bottom-[-62px] h-[425px] w-[440px] rounded-[28px] border-[1.5px] border-[#DDDEE1] shadow-[0_7.304px_43.826px_rgba(0,0,0,0.05)]";

interface SessionSlotProps {
	readonly summary: string;
	/** The card the session is being dropped on: brand-outlined, in a neutral well. */
	readonly target?: boolean;
	readonly className: string;
}

/** A Jira card with the "Link agent session" chin a dragged session opens under it. */
function SessionSlot({ summary, target = false, className }: Readonly<SessionSlotProps>) {
	return (
		<div className={`absolute h-[233px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] ${className}`}>
			<div
				className="absolute top-0 left-[calc(50%-0.27px)] flex w-[423.47px] -translate-x-1/2 flex-col gap-[6.669px] rounded-[20px] p-[6.669px]"
				style={{ background: target ? "rgba(5, 21, 36, 0.06)" : "rgba(23, 23, 23, 0.03)" }}
			>
				<div className="relative isolate flex flex-col rounded-[16px] px-[20px] pt-[20px] pb-[13.338px] shadow-[0_0_1.667px_rgba(9,30,66,0.31),0_1.667px_1.667px_rgba(9,30,66,0.25)]">
					<div className={`absolute inset-0 z-[1] rounded-[16px] bg-[#FFFFFF] ${target ? "border-2 border-[#3941FE]" : ""}`} />
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
						<Image src={ASSIGNEE} alt="" width={40} height={40} className="size-[40px] rounded-full object-cover" />
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
					className="flex h-[80.026px] w-[268.013px] rotate-4 items-center justify-center gap-[12px] overflow-hidden rounded-[16px] px-[20px] py-[13.338px] shadow-[0_0_1.667px_rgba(30,31,33,0.31),0_13.338px_20.006px_rgba(30,31,33,0.15)]"
					style={{ backgroundImage: "linear-gradient(270deg, rgba(57, 65, 255, 0.128) 0%, rgba(57, 65, 255, 0) 28.065%), linear-gradient(90deg, #FFFFFF, #FFFFFF)" }}
				>
					<div className="relative h-[34.154px] w-[58.096px] shrink-0">
						<Image src={`${ASSET}/agent-sessions-agent-avatar.svg`} alt="" width={37} height={39} className="absolute top-[-2.6px] left-[-1.53px] z-[2] h-[39.365px] w-[37.204px] max-w-none" />
						<Image src={ASSIGNEE} alt="" width={34} height={34} className="absolute top-0 left-[24px] z-[1] size-[34.154px] rounded-full object-cover" />
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
			<div className={`${COLUMN} left-[calc(50%-1.33px)] -translate-x-1/2`} />
			<div className={`${COLUMN} right-[-384.33px]`} />
			<div className={`${COLUMN} left-[-388px]`} />
			<SessionSlot summary="Publish and link the rollback rehearsal runbook" className="top-[calc(50%+246.5px)] left-[calc(50%-1.33px)]" />
			<BentoFade size={186} />
			<SessionSlot summary="Confirm the sandbox key retention window before replay" target className="top-[calc(50%+3.5px)] left-[calc(50%-1.33px)] overflow-hidden" />
			<SessionChip />
			<BentoLabel text="Agent sessions" />
		</>
	);
}
