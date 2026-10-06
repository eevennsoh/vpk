"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { BENTO_ARTIFACTS, type BentoArtifact, type BentoArtifactAgent } from "@/components/projects/jira-team-eu26-end/finale/data/finale-bento-content";
import { BentoFade, BentoLabel } from "./finale-bento-parts";

const ASSET = "/illustration/jira-team-eu26-end/bento";
/** The preview's box inside a card: 356.724 wide less 6.222 padding a side, 219.842 tall less the same. */
const PREVIEW = { width: 344.28, height: 207.4 } as const;

/**
 * Each agent's hexagon and mark as one Figma export, placed where its export
 * frame sits in the 33.184 avatar box. Rovo Dev's outlined template hexagon
 * stands taller than the box, so its frame starts above and left of it.
 */
const AGENT_AVATARS: Record<BentoArtifactAgent, { readonly width: number; readonly height: number; readonly className: string }> = {
	cursor: { width: 34, height: 34, className: "top-[-1.13px] left-[-0.06px] size-[34px]" },
	claude: { width: 34, height: 34, className: "top-[-1.13px] left-[-0.06px] size-[34px]" },
	"rovo-dev": { width: 35, height: 39, className: "top-[-3.729px] left-[-0.828px] h-[39px] w-[35px]" },
};

/** The agent that made the artifact, with its author's photo tucked on its corner in a white ring. */
function ArtifactAvatars({ agent, authorAvatar }: Readonly<Pick<BentoArtifact, "agent" | "authorAvatar">>) {
	const avatar = AGENT_AVATARS[agent];
	return (
		<div className="relative size-[33.184px] shrink-0">
			<Image src={`${ASSET}/artifacts-agent-${agent}.svg`} alt="" width={avatar.width} height={avatar.height} className={`absolute max-w-none ${avatar.className}`} />
			{/* The Figma's ring is an outside stroke on the photo: a disc 1.383 wider a side, under it. */}
			<span className="absolute top-[17.974px] left-[17.974px] size-[19.358px] rounded-full bg-[#FFFFFF]" />
			<Image src={authorAvatar} alt="" width={17} height={17} className="absolute top-[19.357px] left-[19.357px] size-[16.6px] rounded-full object-cover" />
		</div>
	);
}

interface ArtifactCardProps {
	readonly artifact: BentoArtifact;
	readonly className: string;
	readonly children: ReactNode;
}

/** A Rovo artifact card: its preview, then title, author and age beside its avatars. */
function ArtifactCard({ artifact, className, children }: Readonly<ArtifactCardProps>) {
	return (
		<div className={`absolute flex w-[356.724px] flex-col items-center rounded-[10px] border-[0.75px] border-[#DDDEE1] bg-[#F7F7F7] pb-[11.061px] ${className}`}>
			<div className="flex h-[219.842px] w-full flex-col overflow-hidden p-[6.222px]">
				<div className="relative min-h-px w-full flex-1 overflow-hidden rounded-[8.296px]">{children}</div>
			</div>
			<div className="flex w-full items-center gap-[8.296px] px-[11.753px]">
				<div className="flex min-w-px flex-1 flex-col">
					<p className="truncate text-[14.518px] leading-[20.74px] font-medium text-[#292A2E]">{artifact.title}</p>
					<p className="flex h-[13.827px] items-center gap-[2.074px] text-[12.444px] leading-[16.592px] whitespace-nowrap text-[#6B6E76]">
						<span>{artifact.author}</span>
						<span>•</span>
						<span>Created 1h ago</span>
					</p>
				</div>
				<ArtifactAvatars agent={artifact.agent} authorAvatar={artifact.authorAvatar} />
			</div>
		</div>
	);
}

function Preview({ src }: Readonly<{ src: string }>) {
	return <Image src={src} alt="" width={PREVIEW.width * 2} height={PREVIEW.height * 2} className="absolute inset-0 size-full rounded-[8.296px] object-cover" />;
}

/** Artifacts: what Rovo made this week, a usage report and Design Studio's concept under its live prototype. */
export function FinaleBentoArtifacts() {
	return (
		<>
			<ArtifactCard artifact={BENTO_ARTIFACTS.report} className="top-[8px] right-[8.28px]">
				<Preview src={`${ASSET}/artifacts-amsterdam-itinerary.jpg`} />
			</ArtifactCard>
			<ArtifactCard artifact={BENTO_ARTIFACTS.concept} className="bottom-[8.27px] left-[7.67px]">
				{/* The Design Studio capture overhangs its preview box a little, as the Figma crops it. */}
				<div className="absolute top-[0.41px] left-[-0.36px] h-[207.411px] w-[391.957px] overflow-hidden">
					<Image src={`${ASSET}/artifacts-design-studio-concept.jpg`} alt="" width={800} height={427} className="absolute top-[-0.79%] left-[-0.28%] h-[101.84%] w-[100.83%] max-w-none" />
				</div>
			</ArtifactCard>
			<BentoFade size={78} />
			<ArtifactCard artifact={BENTO_ARTIFACTS.studio} className="top-[calc(50%-0.14px)] left-[calc(50%-0.3px)] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_9px_rgba(0,0,0,0.25)]">
				<Preview src={`${ASSET}/artifacts-design-studio-quiz.jpg`} />
			</ArtifactCard>
			<BentoLabel text="Artifacts" />
		</>
	);
}
