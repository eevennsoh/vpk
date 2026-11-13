"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AudioWaveformIcon from "@atlaskit/icon-lab/core/audio-waveform";
import type { FloatingRovoButtonPersistentBar } from "@/components/blocks/rovo-button";
import { useRovoChatControls } from "@/app/contexts";

export interface RovoButtonDemoLiveChat {
	persistentBar: FloatingRovoButtonPersistentBar;
	/** Bumped on every request so `RovoFloatingChat` re-arms realtime voice. */
	requestKey: number;
	open: () => void;
}

/** Demo-only quick-action bar that hands the floating chat straight to voice. */
export function useRovoButtonDemoLiveChat(): RovoButtonDemoLiveChat {
	const { chatSurface, openChat } = useRovoChatControls();
	const [requestKey, setRequestKey] = useState(0);

	const open = useCallback(() => {
		setRequestKey((currentKey) => currentKey + 1);
		openChat("floating");
	}, [openChat]);

	useEffect(() => {
		if (chatSurface !== "floating") {
			setRequestKey(0);
		}
	}, [chatSurface]);

	const persistentBar = useMemo<FloatingRovoButtonPersistentBar>(() => ({
		ariaLabel: "Rovo quick actions",
		items: [
			{
				id: "rovo-button-bar-voice",
				ariaLabel: "Talk to Rovo",
				tooltipLabel: "Live chat",
				icon: <AudioWaveformIcon label="" color="currentColor" />,
				onClick: open,
			},
		],
	}), [open]);

	return useMemo(() => ({ persistentBar, requestKey, open }), [open, persistentBar, requestKey]);
}
