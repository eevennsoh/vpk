"use client";

import { useState } from "react";
import { LiveWaveform } from "@/components/ui-custom/live-waveform";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function LiveWaveformPreview({
	initialMode = "static",
}: Readonly<{ initialMode?: "scrolling" | "static" }>) {
	const [active, setActive] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [mode, setMode] = useState<"scrolling" | "static">(initialMode);

	return (
		<Card className="mx-auto w-full max-w-xl py-6">
			<CardHeader className="px-6">
				<CardTitle>Live Audio Waveform</CardTitle>
				<CardDescription className="text-text-subtle">
					Real-time microphone input visualization with audio reactivity.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 px-6">
				<LiveWaveform
					active={active}
					barGap={1}
					barWidth={3}
					className="w-full rounded-lg bg-bg-neutral p-2"
					height={80}
					mode={mode}
					processing={processing}
				/>
				<div className="flex flex-wrap justify-center gap-2">
					<Button
						onClick={() => {
							if (!active) {
								setProcessing(false);
							}
							setActive(!active);
						}}
						size="default"
						variant={active ? "default" : "outline"}
					>
						{active ? "Stop Listening" : "Start Listening"}
					</Button>
					<Button
						onClick={() => {
							if (!processing) {
								setActive(false);
							}
							setProcessing(!processing);
						}}
						size="default"
						variant={processing ? "default" : "outline"}
					>
						{processing ? "Stop Processing" : "Show Processing"}
					</Button>
					<Button
						onClick={() => {
							setMode((current) =>
								current === "static" ? "scrolling" : "static"
							);
						}}
						size="default"
						variant="outline"
					>
						{mode === "static" ? "Use Scrolling Mode" : "Use Static Mode"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default function LiveWaveformDemo() {
	return <LiveWaveformPreview />;
}

export function LiveWaveformDemoScrolling() {
	return <LiveWaveformPreview initialMode="scrolling" />;
}
