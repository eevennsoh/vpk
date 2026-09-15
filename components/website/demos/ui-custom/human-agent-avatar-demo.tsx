"use client";

import { useState } from "react";

import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { Button } from "@/components/ui/button";
import {
	DEFAULT_HUMAN_AGENT_AVATAR_MOTION,
	resolveHumanAgentAvatarMotion,
} from "@/components/ui-custom/human-agent-avatar-motion-config";
import { HumanAgentAvatarMotionControls } from "./human-agent-avatar-motion-controls";

const AGENT = { name: "Cursor", brandName: "cursor" } as const;
const HUMAN = {
	name: "Priya Raman",
	avatarSrc: "/avatar-user/ting-chen/color/asow-strategy-orange-64.png",
};

export default function HumanAgentAvatarDemo() {
	return <HumanAgentAvatar agent={AGENT} human={HUMAN} />;
}

export function HumanAgentAvatarDemoAnimated() {
	const [animate, setAnimate] = useState(true);
	const [config, setConfig] = useState(DEFAULT_HUMAN_AGENT_AVATAR_MOTION);
	const [runId, setRunId] = useState(0);
	const [resetId, setResetId] = useState(0);

	return (
		<div
			className="flex w-full flex-col gap-4"
			data-human-agent-avatar-playground
		>
			<div className="flex items-center justify-center gap-4">
				<HumanAgentAvatar
					key={runId}
					agent={AGENT}
					human={HUMAN}
					animate={animate}
					motion={config}
				/>
				<Button
					aria-pressed={animate}
					onClick={() => setAnimate((current) => !current)}
					size="compact"
					variant="outline"
				>
					{animate ? "Pause animation" : "Animate avatar"}
				</Button>
				<Button
					size="compact"
					variant="outline"
					onClick={() => {
						setConfig(DEFAULT_HUMAN_AGENT_AVATAR_MOTION);
						setRunId((current) => current + 1);
						setResetId((current) => current + 1);
					}}
				>
					Reset motion
				</Button>
			</div>
			<HumanAgentAvatarMotionControls
				key={resetId}
				config={config}
				onChange={(patch) =>
					setConfig((current) =>
						resolveHumanAgentAvatarMotion({ ...current, ...patch }),
					)
				}
				onReplay={() => {
					setAnimate(true);
					setRunId((current) => current + 1);
				}}
			/>
		</div>
	);
}

export function HumanAgentAvatarDemoHumanFirst() {
	return (
		<HumanAgentAvatar
			agent={AGENT}
			human={HUMAN}
			attributionOrder="human-first"
		/>
	);
}
