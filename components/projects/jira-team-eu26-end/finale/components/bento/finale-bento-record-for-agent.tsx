"use client";

import Image from "next/image";
import type { ComponentType } from "react";
import CameraIcon from "@atlaskit/icon/core/camera";
import CrossIcon from "@atlaskit/icon/core/cross";
import LockUnlockedIcon from "@atlaskit/icon/core/lock-unlocked";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";
import ScreenIcon from "@atlaskit/icon/core/screen";
import ScreenRecordIcon from "@atlaskit/icon-lab/core/screen-record";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import VideoMiniplayerIcon from "@atlaskit/icon-lab/core/video-miniplayer";
import VideoStrikethroughIcon from "@atlaskit/icon-lab/core/video-strikethrough";

import { BentoFade, BentoLabel, bentoGenerativeGlow } from "./finale-bento-parts";

const ASSET = "/illustration/jira-team-eu26-end/bento";
/** Loom's recorder is a macOS window: its labels are set in the system face. */
const SYSTEM_FONT = { fontFamily: "-apple-system, BlinkMacSystemFont, var(--font-sans)" } as const;
const SECONDARY = "rgba(0, 0, 0, 0.5)";
const BUTTON_GLOW = bentoGenerativeGlow(241.5, 60, "12.075 -3.7569 15.122 3 120.75 30");

type GlyphIcon = ComponentType<{ label: string; color?: "currentColor" }>;

/** An SF Symbol slot in the recorder, drawn with its ADS counterpart at the symbol's 19.5pt size. */
function Glyph({ icon: Icon, color = SECONDARY, opacity = 1 }: Readonly<{ icon: GlyphIcon; color?: string; opacity?: number }>) {
	return (
		<span className="flex size-[36px] items-center justify-center" style={{ color, opacity }}>
			<span className="flex scale-[1.375]"><Icon label="" color="currentColor" /></span>
		</span>
	);
}

function ControlButton({ icon, opacity }: Readonly<{ icon: GlyphIcon; opacity?: number }>) {
	return (
		<div className="flex size-[60px] shrink-0 items-center justify-center rounded-full p-[6px]">
			<Glyph icon={icon} opacity={opacity} />
		</div>
	);
}

/** Screen, window, area or camera: which capture the recorder is set to (screen). */
function ModeToggle() {
	return (
		<div className="relative flex h-[60px] shrink-0 items-center justify-center gap-[6px] rounded-full bg-[rgba(0,0,0,0.08)] p-[6px]">
			<Image src={`${ASSET}/record-mode-indicator.svg`} alt="" width={78} height={78} className="absolute top-[-3px] left-[-9px] size-[78px] max-w-none" />
			{[ScreenIcon, VideoMiniplayerIcon, ScreenRecordIcon, CameraIcon].map((icon, index) => (
				<div key={index} className="relative flex h-[54px] w-[48px] items-center justify-center">
					{index === 0 ? <Glyph icon={icon} color="rgba(0, 0, 0, 0.85)" opacity={0.8} /> : <Glyph icon={icon} />}
				</div>
			))}
		</div>
	);
}

/** Loom's recorder bar, its last button handing the recording to an agent. */
function RecorderControl() {
	return (
		<div className="absolute top-1/2 left-[calc(50%-181px)] flex -translate-x-1/2 -translate-y-1/2 items-center gap-[6px] rounded-full bg-[rgba(255,255,255,0.6)] p-[18px] shadow-[0_12px_36px_rgba(0,0,0,0.25)]" style={SYSTEM_FONT}>
			<ControlButton icon={CrossIcon} />
			<ModeToggle />
			<ControlButton icon={VideoStrikethroughIcon} opacity={0.5} />
			<div className="relative flex h-[60px] shrink-0 overflow-hidden rounded-full">
				<ControlButton icon={MicrophoneIcon} />
				<Image src={`${ASSET}/record-voice-level.svg`} alt="" width={146} height={17} className="absolute bottom-0 left-0 h-[17.25px] w-[145.5px] max-w-none" />
			</div>
			<ControlButton icon={LockUnlockedIcon} />
			<ControlButton icon={ShowMoreHorizontalIcon} />
			<div className="relative isolate flex h-[60px] w-[240px] shrink-0 items-center">
				<div className="relative z-[2] flex h-[60px] items-center gap-[6px] overflow-hidden rounded-full bg-[#292A2E] py-[12px] pr-[18px] pl-[3px]">
					<div className="relative flex size-[54px] shrink-0 items-center justify-center rounded-full bg-linear-to-b from-white to-[#ECECEC] drop-shadow-[0_5.4px_5.4px_rgba(0,0,0,0.16)]">
						<Image src={`${ASSET}/record-ai-cursor.svg`} alt="" width={21} height={25} className="h-[24.75px] w-[21.409px] max-w-none" />
					</div>
					<p className="text-[19.5px] leading-[24px] font-medium whitespace-nowrap text-white">Record for agent</p>
				</div>
				<div className="absolute top-0 left-0 z-[1] h-[60px] w-[241.5px] rounded-[200px] opacity-50 blur-[24px]" style={{ backgroundImage: BUTTON_GLOW }} />
			</div>
		</div>
	);
}

/** Record for Agent: Loom records the screen for an agent to watch and act on. */
export function FinaleBentoRecordForAgent() {
	return (
		<>
			<RecorderControl />
			<BentoFade edge="left" size={80} />
			<BentoLabel text="Record for agent" />
		</>
	);
}
