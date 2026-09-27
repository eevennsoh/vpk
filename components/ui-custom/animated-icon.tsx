"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { ANIMATED_ICONS, type AnimatedIconName } from "./animated-icon-registry";
import { resolveAiSparkleTiming } from "@/components/ui-custom/lib/ai-sparkle-timing";

export {
	ANIMATED_ICONS,
	animatedIconNames,
	type AnimatedIconName,
} from "./animated-icon-registry";

// How long a token-driven "replay" stays in the playing state before settling.
const REPLAY_MS = 1000;

export interface AnimatedIconProps
	extends Omit<React.ComponentProps<"span">, "color" | "children"> {
	/** Which animated icon to render. */
	name: AnimatedIconName;
	/** Icon size in pixels. */
	size?: number;
	/** Icon color. Defaults to `currentColor` so it inherits the text color. */
	color?: string;
	/** When false, the icon plays its multi-color Rovo gradient accents instead
	 * of a single solid color. Defaults to true (single color). */
	singleColor?: boolean;
	/** Replay the motion while the pointer is over the icon. Defaults to true. */
	replayOnHover?: boolean;
	/** Replay the motion while the icon is keyboard-focused. Defaults to true. */
	replayOnFocus?: boolean;
	/** Change this value to replay the motion imperatively (e.g. a "Replay all"
	 * button bumping a shared token across many icons). */
	playToken?: number;
	/** Start a single replay on mount, synchronized with sibling entrance motion. */
	playOnMount?: boolean;
	/** Full AI Sparkle cycle, including its return to rest, in seconds. */
	replayDuration?: number;
	/** Called when a replay starts returning to rest. */
	onReplayReturn?: () => void;
	/** Called after a replay has returned to rest. */
	onReplayComplete?: () => void;
	/** Accessible label. Omit (or leave empty) to render the icon decoratively. */
	label?: string;
}

export function AnimatedIcon({
	name,
	size = 16,
	color,
	singleColor = true,
	replayOnHover = true,
	replayOnFocus = true,
	playToken,
	playOnMount = false,
	replayDuration,
	onReplayReturn,
	onReplayComplete,
	label,
	className,
	onMouseEnter,
	onMouseLeave,
	onFocus,
	onBlur,
	...props
}: Readonly<AnimatedIconProps>) {
	const [playing, setPlaying] = useState(playOnMount);
	const prevToken = useRef(playOnMount ? null : playToken);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const callbacks = useRef({ onReplayReturn, onReplayComplete });
	useEffect(() => {
		callbacks.current = { onReplayReturn, onReplayComplete };
	}, [onReplayComplete, onReplayReturn]);

	useLayoutEffect(() => {
		if (prevToken.current === playToken) return;
		const previousToken = prevToken.current;
		prevToken.current = playToken;
		setPlaying(true);
		if (timer.current) clearTimeout(timer.current);
		const sparkle = name === "ai-sparkle" ? resolveAiSparkleTiming(replayDuration) : null;
		const playMs = sparkle && replayDuration !== undefined ? sparkle.playSeconds * 1000 : REPLAY_MS;
		timer.current = setTimeout(() => {
			setPlaying(false);
			callbacks.current.onReplayReturn?.();
			timer.current = setTimeout(() => callbacks.current.onReplayComplete?.(), (sparkle?.returnSeconds ?? 0) * 1000);
		}, playMs);
		return () => {
			if (timer.current) clearTimeout(timer.current);
			// Strict Mode replays effect setup after cleanup with refs preserved.
			prevToken.current = previousToken;
		};
	}, [name, playToken, replayDuration]);

	const Icon = ANIMATED_ICONS[name];
	const isDecorative = !label;

	return (
		<span
			data-slot="animated-icon"
			role={isDecorative ? undefined : "img"}
			aria-label={isDecorative ? undefined : label}
			aria-hidden={isDecorative ? true : undefined}
			className={cn("inline-flex items-center justify-center", className)}
			onMouseEnter={(event) => {
				onMouseEnter?.(event);
				if (replayOnHover) setPlaying(true);
			}}
			onMouseLeave={(event) => {
				onMouseLeave?.(event);
				if (replayOnHover) setPlaying(false);
			}}
			onFocus={(event) => {
				onFocus?.(event);
				if (replayOnFocus) setPlaying(true);
			}}
			onBlur={(event) => {
				onBlur?.(event);
				if (replayOnFocus) setPlaying(false);
			}}
			{...props}
		>
			<Icon
				size={size}
				color={color ?? "currentColor"}
				{...(name === "ai-sparkle" ? { duration: replayDuration } : {})}
				hovered={playing}
				singleColor={singleColor}
			/>
		</span>
	);
}

AnimatedIcon.displayName = "AnimatedIcon";
