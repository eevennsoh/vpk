"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { FINALE_AUDIO_SRC, FINALE_SOUND_ENABLED } from "../data/finale-cues";

export interface FinaleClock {
	/** Fetch the soundtrack bytes; safe before any user gesture. */
	readonly prefetch: () => void;
	/** Create the AudioContext and decode; call from a user gesture (e.g. first pointerdown). */
	readonly prepare: () => Promise<void>;
	readonly start: (seek: number) => Promise<void>;
	/** Freeze on an exact frame without sound (rehearsal scrubbing). */
	readonly hold: (time: number) => void;
	readonly stop: () => void;
	readonly togglePause: () => void;
	readonly seekBy: (delta: number) => void;
	/** Seconds into the soundtrack, aligned to what the audience hears. */
	readonly time: () => number;
}

interface ClockState {
	context: AudioContext | null;
	buffer: AudioBuffer | null;
	bytes: Promise<ArrayBuffer | null> | null;
	decode: Promise<AudioBuffer | null> | null;
	source: AudioBufferSourceNode | null;
	gain: GainNode | null;
	/** `context.currentTime` (or performance seconds) that maps to music time 0. */
	origin: number;
	usesAudio: boolean;
	running: boolean;
	pausedAt: number;
}

const nowSeconds = () => performance.now() / 1000;
const RESUME_TIMEOUT_MS = 150;

function outputLatency(context: AudioContext): number {
	const latency = context.outputLatency || context.baseLatency || 0;
	return Number.isFinite(latency) ? latency : 0;
}

/**
 * Master clock. With sound enabled it is music-driven: visuals read the AudioContext timeline (minus the
 * output latency), so dropped frames can never drift picture from sound. If
 * audio cannot start, a silent performance clock keeps the sequence running.
 */
export function useFinaleAudioClock(): FinaleClock {
	const stateRef = useRef<ClockState>({
		context: null,
		buffer: null,
		bytes: null,
		decode: null,
		source: null,
		gain: null,
		origin: 0,
		usesAudio: false,
		running: false,
		pausedAt: 0,
	});

	const ensureContext = useCallback(() => {
		const state = stateRef.current;
		if (state.context || typeof window === "undefined" || typeof AudioContext === "undefined") return state.context;
		state.context = new AudioContext({ latencyHint: "playback" });
		return state.context;
	}, []);

	const prefetch = useCallback(() => {
		if (!FINALE_SOUND_ENABLED) return;
		const state = stateRef.current;
		state.bytes ??= fetch(FINALE_AUDIO_SRC)
			.then((response) => (response.ok ? response.arrayBuffer() : null))
			.catch(() => null);
	}, []);

	const prepare = useCallback(async () => {
		const state = stateRef.current;
		if (!FINALE_SOUND_ENABLED || state.buffer) return;
		const context = ensureContext();
		if (!context) return;
		prefetch();
		// decodeAudioData detaches its input, so decode a copy of the cached bytes.
		state.decode ??= (state.bytes ?? Promise.resolve(null))
			.then((bytes) => (bytes ? context.decodeAudioData(bytes.slice(0)) : null))
			.then((buffer) => {
				state.buffer = buffer;
				return buffer;
			})
			.catch(() => null);
		await state.decode;
	}, [ensureContext, prefetch]);

	const stopSource = useCallback(() => {
		const state = stateRef.current;
		state.source?.stop();
		state.source?.disconnect();
		state.gain?.disconnect();
		state.source = null;
		state.gain = null;
	}, []);

	const time = useCallback(() => {
		const state = stateRef.current;
		if (!state.running) return state.pausedAt;
		if (state.usesAudio && state.context) {
			return state.context.currentTime - state.origin - outputLatency(state.context);
		}
		return nowSeconds() - state.origin;
	}, []);

	const start = useCallback(async (seek: number) => {
		const state = stateRef.current;
		stopSource();
		await prepare();
		const context = state.context;
		const offset = Math.max(0, seek);
		if (context && state.buffer && context.state !== "running") {
			// Without user activation `resume()` stays pending forever; never let
			// audio hold the picture hostage — fall back to the silent clock.
			await Promise.race([
				context.resume().catch(() => undefined),
				new Promise((resolve) => window.setTimeout(resolve, RESUME_TIMEOUT_MS)),
			]);
		}
		if (context && state.buffer && context.state === "running" && offset < state.buffer.duration) {
			const source = context.createBufferSource();
			const gain = context.createGain();
			source.buffer = state.buffer;
			source.connect(gain).connect(context.destination);
			const startAt = context.currentTime + 0.02;
			source.start(startAt, offset);
			state.source = source;
			state.gain = gain;
			state.origin = startAt - offset;
			state.usesAudio = true;
		} else {
			state.origin = nowSeconds() - offset;
			state.usesAudio = false;
		}
		state.running = true;
	}, [prepare, stopSource]);

	const hold = useCallback((at: number) => {
		const state = stateRef.current;
		stopSource();
		state.running = false;
		state.pausedAt = Math.max(0, at);
	}, [stopSource]);

	const stop = useCallback(() => {
		const state = stateRef.current;
		if (state.gain && state.context) {
			// Short release so an early exit never clicks.
			const now = state.context.currentTime;
			state.gain.gain.setTargetAtTime(0, now, 0.04);
			const source = state.source;
			window.setTimeout(() => source?.stop(), 250);
			state.source = null;
			state.gain = null;
		} else {
			stopSource();
		}
		state.running = false;
		state.pausedAt = 0;
	}, [stopSource]);

	const togglePause = useCallback(() => {
		const state = stateRef.current;
		if (state.running) {
			state.pausedAt = time();
			stopSource();
			state.running = false;
			return;
		}
		void start(state.pausedAt);
	}, [start, stopSource, time]);

	const seekBy = useCallback((delta: number) => {
		const state = stateRef.current;
		const target = Math.max(0, time() + delta);
		if (state.running) {
			void start(target);
		} else {
			state.pausedAt = target;
		}
	}, [start, time]);

	useEffect(() => () => {
		const state = stateRef.current;
		stopSource();
		void state.context?.close();
		// AudioBuffers outlive their context, so a remount reuses the decode.
		state.context = null;
		state.decode = null;
		state.running = false;
	}, [stopSource]);

	return useMemo(
		() => ({ prefetch, prepare, start, hold, stop, togglePause, seekBy, time }),
		[hold, prefetch, prepare, seekBy, start, stop, time, togglePause],
	);
}
