"use client";

import { useState } from "react";

import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { Button } from "@/components/ui/button";
import {
	resolveHumanAgentAvatarMotion,
	type HumanAgentAvatarMotionOptions,
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

export function HumanAgentAvatarDemoAnimated({
	variant = "orbit",
	human = HUMAN,
}: Readonly<{
	variant?: HumanAgentAvatarMotionOptions["variant"];
	human?: { name: string; avatarSrc: string };
}> = {}) {
	const [animate, setAnimate] = useState(true);
	const [config, setConfig] = useState(() => resolveHumanAgentAvatarMotion({ variant }));
	const [runId, setRunId] = useState(0);
	const [resetId, setResetId] = useState(0);
	const [sizePx, setSizePx] = useState<24 | 32>(32);

	return (
		<div
			className="flex w-full flex-col gap-4"
			data-human-agent-avatar-playground={
				variant === "orbit" ? true : undefined
			}
			data-human-agent-avatar-group-playground={
				variant === "horizontal-group" ? true : undefined
			}
		>
			<div className="flex flex-wrap items-center justify-center gap-4">
				<div role="group" aria-label="Avatar size" className="flex gap-1">
					{([24, 32] as const).map((size) => (
						<Button key={size} aria-pressed={sizePx === size} size="compact" variant="outline"
							onClick={() => { setSizePx(size); setRunId((current) => current + 1); }}>
							{size}×{size}
						</Button>
					))}
				</div>
				<HumanAgentAvatar
					key={runId}
					agent={AGENT}
					human={human}
					animate={animate}
					motion={config}
					sizePx={sizePx}
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
						setConfig(resolveHumanAgentAvatarMotion({ variant }));
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

export function HumanAgentAvatarDemoSizes() {
	return (
		<div className="flex items-center gap-8" data-human-agent-avatar-sizes>
			{([24, 32] as const).map((sizePx) => (
				<div key={sizePx} className="flex flex-col items-center gap-3" data-avatar-size={sizePx}>
					<HumanAgentAvatar
						agent={AGENT}
						human={HUMAN}
						sizePx={sizePx}
					/>
					<span className="text-xs text-text-subtle">{sizePx}×{sizePx}</span>
				</div>
			))}
		</div>
	);
}

export function HumanAgentAvatarDemoHorizontalGroup() {
	return (
		<HumanAgentAvatarDemoAnimated
			variant="horizontal-group"
			human={{
				name: "Jordan Okafor",
				avatarSrc: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
			}}
		/>
	);
}
