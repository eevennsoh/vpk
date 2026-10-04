"use client";

import { useState } from "react";

import RefreshIcon from "@atlaskit/icon/core/refresh";

import {
	AnimatedIcon,
	type AnimatedIconName,
} from "@/components/ui-custom/animated-icon";
import { Button } from "@/components/ui/button";

const DEMO_ICONS: ReadonlyArray<{ name: AnimatedIconName; label: string }> = [
	{ name: "ai-generative-text", label: "Generate text" },
	{ name: "ai-generative-text-summary", label: "Summarize text" },
	{ name: "ai-search", label: "Search" },
	{ name: "ai-sparkle", label: "AI" },
	{ name: "angle-brackets", label: "Code" },
	{ name: "magic-wand", label: "Suggest" },
	{ name: "rovo-chat", label: "Rovo chat" },
];

export default function AnimatedIconDemo() {
	const [playToken, setPlayToken] = useState(0);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap gap-6">
				{DEMO_ICONS.map(({ name, label }) => (
					<div
						key={name}
						className="flex w-20 flex-col items-center gap-2 text-center"
					>
						<AnimatedIcon
							name={name}
							label={label}
							playToken={playToken}
							className="text-text"
						/>
						<span className="text-xs text-text-subtle">{label}</span>
					</div>
				))}
			</div>
			<Button
				type="button"
				variant="ghost"
				className="self-center"
				onClick={() => setPlayToken((token) => token + 1)}
			>
				<RefreshIcon label="" size="small" />
				Replay
			</Button>
		</div>
	);
}

export function AnimatedIconDemoRainbow() {
	const [playToken, setPlayToken] = useState(0);

	return (
		<div className="flex flex-col gap-4">
			<p className="max-w-prose text-sm text-text-subtle">
				With <code>singleColor=false</code>, the icons reveal their Rovo gradient
				accents as they animate.
			</p>
			<div className="flex flex-wrap gap-6">
				{DEMO_ICONS.map(({ name, label }) => (
					<div
						key={name}
						className="flex w-20 flex-col items-center gap-2 text-center"
					>
						<AnimatedIcon
							name={name}
							label={label}
							singleColor={false}
							playToken={playToken}
							className="text-text"
						/>
						<span className="text-xs text-text-subtle">{label}</span>
					</div>
				))}
			</div>
			<Button
				type="button"
				variant="ghost"
				className="self-center"
				onClick={() => setPlayToken((token) => token + 1)}
			>
				<RefreshIcon label="" size="small" />
				Replay
			</Button>
		</div>
	);
}
