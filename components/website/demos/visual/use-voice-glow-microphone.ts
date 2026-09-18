"use client";

import { useEffect, useRef, useState } from "react";
import { useMicrophone } from "@/components/visual/voice-glow";
import { requestVoiceGlowMicrophone } from "@/components/visual/voice-glow/microphone-request";

/** Bounded workaround for voice-glow 0.2.0's uncancelled permission request. */
export function useVoiceGlowMicrophone() {
	const mic = useMicrophone();
	const generation = useRef(0);
	const mounted = useRef(false);
	const pending = useRef(false);
	const [requesting, setRequesting] = useState(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			generation.current += 1;
		};
	}, []);
	const stop = () => {
		generation.current += 1;
		mic.stop();
	};
	const start = async () => {
		if (pending.current) return null;
		pending.current = true;
		setRequesting(true);
		const request = ++generation.current;
		try {
			const stream = await requestVoiceGlowMicrophone(mic.start, () => mounted.current && generation.current === request);
			// No second request is permitted while this one is pending, so stop
			// cannot accidentally clear a newer stream here.
			if (!stream && mounted.current && generation.current !== request) mic.stop();
			return stream;
		} finally {
			pending.current = false;
			if (mounted.current) setRequesting(false);
		}
	};
	return { ...mic, start, stop, state: requesting ? "requesting" as const : mic.state };
}
