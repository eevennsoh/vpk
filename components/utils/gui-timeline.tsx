"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { createDialTimelineRoot } from "dialkit/vanilla";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme } from "@/components/utils/theme-wrapper";
import { restoreGUITimelineFocus } from "@/components/utils/gui-timeline-focus";
import { deduplicateGUITimelineFromFolders } from "@/components/utils/gui-timeline-editors";
import {
	createGUITimelineState,
	type GUITimelineConfig,
	type GUITimelineOptions,
	type GUITimelineValues,
} from "@/components/utils/gui-timeline-state";
import { cn } from "@/lib/utils";
import "@/components/utils/gui-timeline.css";

export type { GUITimelineConfig, GUITimelineOptions, GUITimelineValues } from "@/components/utils/gui-timeline-state";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useGUITimeline<T extends GUITimelineConfig>(name: string, config: T, options: GUITimelineOptions = {}): GUITimelineValues<T> | null {
	const [state] = useState(createGUITimelineState<T>);
	const shouldReduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);
	const currentConfig = useEffectEvent(() => config);
	const autoplay = options.autoplay === true;
	const loop = options.loop === true || typeof options.loop === "object";
	const loopStart = typeof options.loop === "object" ? options.loop.from : undefined;

	useEffect(() => state.mount(name, currentConfig(), {
		autoplay,
		loop: loopStart === undefined ? loop : { from: loopStart },
	}, window.matchMedia(REDUCED_MOTION_QUERY).matches), [state, name, autoplay, loop, loopStart]);

	useEffect(() => { state.updateConfig(config); }, [state, config]);
	useEffect(() => {
		state.setReducedMotion(shouldReduceMotion);
	}, [state, shouldReduceMotion]);

	return useSyncExternalStore(state.subscribe, state.getSnapshot, state.getServerSnapshot);
}

export type GUITimelineProps = Readonly<{
	id?: string;
	label?: string;
	className?: string;
	defaultOpen?: boolean;
	visible?: boolean;
	onVisibilityChange?: (visible: boolean) => void;
}>;

export function GUITimeline({ id, label = "Motion timeline", className, defaultOpen = true, visible, onVisibilityChange }: GUITimelineProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const rootRef = useRef<ReturnType<typeof createDialTimelineRoot> | null>(null);
	const { actualTheme } = useTheme();
	const shouldReduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);
	const currentOptions = useEffectEvent(() => ({ theme: actualTheme, visible, onVisibilityChange }));

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const root = createDialTimelineRoot({ target: host, ...currentOptions(), defaultOpen, productionEnabled: true });
		const stopFocusRestoration = restoreGUITimelineFocus(root.element);
		const stopEditorRepair = deduplicateGUITimelineFromFolders(root.element);
		rootRef.current = root;
		return () => {
			rootRef.current = null;
			stopFocusRestoration();
			stopEditorRepair();
			root.destroy();
		};
	}, [defaultOpen]);

	useEffect(() => {
		rootRef.current?.update({ theme: actualTheme, visible, onVisibilityChange });
	}, [actualTheme, visible, onVisibilityChange]);

	useEffect(() => {
		const root = rootRef.current?.element;
		if (!root || !shouldReduceMotion) return;
		const playbackButtons = () => root.querySelectorAll<HTMLButtonElement>('button[aria-label="Play timeline"], button[aria-label="Replay timeline"]');
		const disablePlayback = () => playbackButtons().forEach((button) => { button.disabled = true; });
		disablePlayback();
		const observer = new MutationObserver(disablePlayback);
		observer.observe(root, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			playbackButtons().forEach((button) => { button.disabled = false; });
		};
	}, [shouldReduceMotion, defaultOpen]);

	return <div ref={hostRef} id={id} role="region" aria-label={label} data-reduced-motion={shouldReduceMotion || undefined} className={cn("vpk-gui-timeline", className)} />;
}
