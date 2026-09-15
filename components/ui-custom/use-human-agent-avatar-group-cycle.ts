"use client";

import { useEffect, useState } from "react";

import type { HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";
import { useLatestRef } from "@/lib/use-latest-ref";

/** The group variation shares the orbit's two turns, holds, and repeat policy. */
export function useHumanAgentAvatarGroupCycle(
	config: HumanAgentAvatarMotionOptions,
	active: boolean,
	targetGrouped?: boolean,
	onAnimationComplete?: () => void,
) {
	const onComplete = useLatestRef(onAnimationComplete);
	const [grouped, setGrouped] = useState(false);
	const { durationMs, initialDelayMs, betweenTurnsMs, repeatDelayMs, repeat } =
		config;
	const cycleKey = JSON.stringify(config);

	useEffect(() => {
		setGrouped(false);
		if (!active || targetGrouped === false) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let frame = 0;
		let completed = 0;
		let cancelled = false;
		const expand = () => {
			if (cancelled) return;
			setGrouped(true);
			if (targetGrouped === true) {
				timer = setTimeout(() => onComplete.current?.(), durationMs);
				return;
			}
			timer = setTimeout(() => {
				setGrouped(false);
				if (repeat === "infinite" || completed < repeat) {
					completed += 1;
					timer = setTimeout(expand, durationMs + repeatDelayMs);
				} else {
					timer = setTimeout(() => onComplete.current?.(), durationMs);
				}
			}, durationMs + betweenTurnsMs);
		};
		// Let Motion measure the compact composition before promoting the group.
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => {
				timer = setTimeout(expand, initialDelayMs);
			});
		});
		return () => {
			cancelled = true;
			clearTimeout(timer);
			cancelAnimationFrame(frame);
		};
	}, [
		active,
		durationMs,
		initialDelayMs,
		betweenTurnsMs,
		repeatDelayMs,
		repeat,
		cycleKey,
		targetGrouped,
		onComplete,
	]);

	return active && grouped;
}
