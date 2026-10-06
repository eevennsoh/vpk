"use client";

import { useSyncExternalStore } from "react";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import VideoPauseIcon from "@atlaskit/icon/core/video-pause";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import type { LanyardPlayer } from "../lanyard-player";

interface Lanyard3DTransportProps {
	readonly player: LanyardPlayer;
}

/** Subscribes to the player alone, so the per-frame timeline never re-renders the editor. */
export function Lanyard3DTransport({ player }: Lanyard3DTransportProps) {
	const { time, playing, looping } = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);

	return (
		<div className="flex items-center gap-3" data-slot="lanyard-3d-transport">
			<Button aria-label="Replay animation" onClick={() => player.replay()} size="icon" variant="ghost">
				<RefreshIcon label="" size="small" />
			</Button>
			<Button aria-label={playing ? "Pause animation" : "Play animation"} onClick={() => (playing ? player.pause() : player.play())} size="icon" variant="ghost">
				{playing ? <VideoPauseIcon label="" size="small" /> : <VideoPlayIcon label="" size="small" />}
			</Button>
			<Slider
				aria-label="Animation timeline"
				className="min-w-0 flex-1"
				max={player.duration}
				min={0}
				onValueChange={(next) => player.seek(Array.isArray(next) ? (next[0] ?? 0) : next)}
				step={0.01}
				value={time}
			/>
			<span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
				{time.toFixed(1)} / {player.duration.toFixed(1)}s
			</span>
			<Toggle aria-label="Loop animation" onPressedChange={(pressed) => player.setLooping(pressed)} pressed={looping} size="sm" variant="outline">
				Loop
			</Toggle>
		</div>
	);
}
