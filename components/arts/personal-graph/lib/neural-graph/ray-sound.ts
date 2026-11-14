import type { PlayOptions, SoundDefinition } from "@web-kits/audio";
import type { NeuralPoint, NeuralViewport } from "./camera";
import type { NeuralHitTestResult, NeuralRayHitTestResult } from "./interaction";
import type { NeuralGraphParams } from "./params";
import { clamp } from "@/lib/utils";

export interface NeuralRaySoundSettings {
	cooldownMs: number;
	enabled: boolean;
	pitchSpread: number;
	volume: number;
}

export interface NeuralNodeSoundSettings {
	cooldownMs: number;
	enabled: boolean;
	volume: number;
}

export interface NeuralRaySoundTriggerState {
	lastNodeId: string | null;
	lastPlayedAt: number;
	wasOnRay: boolean;
}

export interface NeuralNodeSoundTriggerState {
	lastNodeId: string | null;
	lastPlayedAt: number;
	wasOnNode: boolean;
}

export const DEFAULT_NEURAL_RAY_SOUND_SETTINGS: NeuralRaySoundSettings = {
	cooldownMs: 70,
	enabled: true,
	pitchSpread: 18,
	volume: 0.7,
};

export const INITIAL_NEURAL_RAY_SOUND_TRIGGER_STATE: NeuralRaySoundTriggerState = {
	lastNodeId: null,
	lastPlayedAt: Number.NEGATIVE_INFINITY,
	wasOnRay: false,
};

export const INITIAL_NEURAL_NODE_SOUND_TRIGGER_STATE: NeuralNodeSoundTriggerState = {
	lastNodeId: null,
	lastPlayedAt: Number.NEGATIVE_INFINITY,
	wasOnNode: false,
};

export const NEURAL_RAY_SOUND_DEFINITION: SoundDefinition = {
	source: {
		type: "sine",
		frequency: { start: 920, end: 1480 },
		fm: { ratio: 3.5, depth: 210 },
	},
	envelope: { attack: 0, decay: 0.048, sustain: 0, release: 0.012 },
	filter: { type: "highpass", frequency: 420, resonance: 0.7 },
	gain: 0.44,
	effects: [
		{
			type: "eq",
			bands: [
				{ type: "peaking", frequency: 1350, gain: 1.8, Q: 0.9 },
				{ type: "highshelf", frequency: 3600, gain: 2.2 },
			],
		},
		{ type: "compressor", threshold: -13, knee: 10, ratio: 2.6, attack: 0.002, release: 0.08 },
		{ type: "gain", value: 1.18 },
	],
};

export const NEURAL_NODE_HOVER_SOUND_DEFINITION: SoundDefinition = {
	layers: [
		{
			source: { type: "triangle", frequency: { start: 280, end: 420 } },
			envelope: { attack: 0.006, decay: 0.14, sustain: 0, release: 0.045 },
			filter: {
				type: "lowpass",
				frequency: 1800,
				resonance: 0.55,
				envelope: { attack: 0.008, peak: 2600, decay: 0.09 },
			},
			gain: 0.3,
		},
		{
			source: { type: "sine", frequency: { start: 540, end: 720 }, fm: { ratio: 1.5, depth: 24 } },
			envelope: { attack: 0.002, decay: 0.095, sustain: 0, release: 0.028 },
			gain: 0.16,
		},
	],
	effects: [
		{
			type: "eq",
			bands: [
				{ type: "lowshelf", frequency: 420, gain: 2.1 },
				{ type: "highshelf", frequency: 2800, gain: -2.4 },
			],
		},
		{ type: "compressor", threshold: -16, knee: 12, ratio: 2.2, attack: 0.004, release: 0.12 },
	],
};

function normalize(value: number, min: number, max: number): number {
	if (max <= min) return 0;
	return clamp((value - min) / (max - min), 0, 1);
}

function hashUnit(value: string): number {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash / 0xffffffff;
}

export function clampNeuralRaySoundSettings(
	input: Partial<NeuralRaySoundSettings> = {},
): NeuralRaySoundSettings {
	return {
		cooldownMs: clamp(
			typeof input.cooldownMs === "number" ? input.cooldownMs : DEFAULT_NEURAL_RAY_SOUND_SETTINGS.cooldownMs,
			0,
			240,
		),
		enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_NEURAL_RAY_SOUND_SETTINGS.enabled,
		pitchSpread: clamp(
			typeof input.pitchSpread === "number" ? input.pitchSpread : DEFAULT_NEURAL_RAY_SOUND_SETTINGS.pitchSpread,
			0,
			36,
		),
		volume: clamp(
			typeof input.volume === "number" ? input.volume : DEFAULT_NEURAL_RAY_SOUND_SETTINGS.volume,
			0,
			1,
		),
	};
}

export function shouldTriggerNeuralRaySound({
	nodeId,
	now,
	settings,
	state,
}: {
	nodeId: string;
	now: number;
	settings: NeuralRaySoundSettings;
	state: NeuralRaySoundTriggerState;
}): boolean {
	if (!settings.enabled || settings.volume <= 0) return false;
	if (state.wasOnRay && state.lastNodeId === nodeId) return false;
	return now - state.lastPlayedAt >= settings.cooldownMs;
}

export function getNextNeuralRaySoundTriggerState({
	didPlay,
	nodeId,
	now,
	state,
}: {
	didPlay: boolean;
	nodeId: string | null;
	now: number;
	state: NeuralRaySoundTriggerState;
}): NeuralRaySoundTriggerState {
	if (!nodeId) {
		return {
			...state,
			lastNodeId: null,
			wasOnRay: false,
		};
	}

	if (!didPlay) {
		return {
			...state,
			wasOnRay: true,
		};
	}

	return {
		lastNodeId: nodeId,
		lastPlayedAt: now,
		wasOnRay: true,
	};
}

export function shouldTriggerNeuralNodeSound({
	nodeId,
	now,
	settings,
	state,
}: {
	nodeId: string;
	now: number;
	settings: NeuralNodeSoundSettings;
	state: NeuralNodeSoundTriggerState;
}): boolean {
	if (!settings.enabled || settings.volume <= 0) return false;
	if (state.wasOnNode && state.lastNodeId === nodeId) return false;
	return now - state.lastPlayedAt >= settings.cooldownMs;
}

export function getNextNeuralNodeSoundTriggerState({
	didPlay,
	nodeId,
	now,
	state,
}: {
	didPlay: boolean;
	nodeId: string | null;
	now: number;
	state: NeuralNodeSoundTriggerState;
}): NeuralNodeSoundTriggerState {
	if (!nodeId) {
		return {
			...state,
			lastNodeId: null,
			wasOnNode: false,
		};
	}

	if (!didPlay) {
		return {
			...state,
			wasOnNode: true,
		};
	}

	return {
		lastNodeId: nodeId,
		lastPlayedAt: now,
		wasOnNode: true,
	};
}

export function getNeuralRaySoundPlayOptions({
	hit,
	params,
	pointer,
	settings,
	viewport,
}: {
	hit: NeuralRayHitTestResult;
	params: NeuralGraphParams;
	pointer: NeuralPoint;
	settings: NeuralRaySoundSettings;
	viewport: NeuralViewport;
}): PlayOptions {
	const radiusMix = normalize(params.rayElasticRadius, 0, 220);
	const strengthMix = normalize(Math.abs(params.rayElasticStrength), 0, 80);
	const tensionMix = normalize(params.rayElasticTension, 60, 600);
	const dampingMix = normalize(params.rayElasticDamping, 6, 80);
	const hitThreshold = Math.max(10, params.rayWidth * 2 + 8);
	const distanceMix = clamp(hit.distance / hitThreshold, 0, 1);
	const progress = clamp(hit.progress, 0, 1);
	const nodeJitter = (hashUnit(hit.node.id) - 0.5) * Math.min(260, settings.pitchSpread * 18);
	const progressCents = (progress - 0.5) * settings.pitchSpread * 100;
	const springCents = (tensionMix - 0.5) * 420;
	const radiusCents = -radiusMix * 260;
	const detune = clamp(progressCents + springCents + radiusCents + nodeJitter, -2400, 2400);
	const velocity = clamp(0.24 + strengthMix * 0.46 + (1 - distanceMix) * 0.22 - radiusMix * 0.1, 0.08, 0.92);
	const playbackRate = clamp(0.86 + tensionMix * 0.24 + dampingMix * 0.18 - radiusMix * 0.1, 0.72, 1.32);
	const pan = clamp((pointer.x / Math.max(1, viewport.width)) * 2 - 1, -0.85, 0.85);
	const volume = clamp(settings.volume * (0.82 + strengthMix * 0.42 + (1 - distanceMix) * 0.32), 0, 1);

	return {
		detune,
		pan,
		playbackRate,
		velocity,
		volume,
	};
}

const NODE_KIND_DETUNE_CENTS = {
	concept: -120,
	entity: 80,
	raw: -260,
	source: 160,
	synthesis: 260,
} as const;

export function getNeuralNodeSoundPlayOptions({
	hit,
	pointer,
	settings,
	viewport,
}: {
	hit: NeuralHitTestResult;
	pointer: NeuralPoint;
	settings: NeuralNodeSoundSettings;
	viewport: NeuralViewport;
}): PlayOptions {
	const distanceMix = clamp(hit.distance / 44, 0, 1);
	const nodeJitter = (hashUnit(hit.node.id) - 0.5) * 180;
	const kindCents = NODE_KIND_DETUNE_CENTS[hit.node.node.kind] ?? 0;
	const detune = clamp(kindCents + nodeJitter - distanceMix * 90, -900, 900);
	const pan = clamp((pointer.x / Math.max(1, viewport.width)) * 2 - 1, -0.72, 0.72);
	const velocity = clamp(0.38 + (1 - distanceMix) * 0.42 + Math.min(1, hit.node.node.degree / 12) * 0.12, 0.18, 0.92);
	const playbackRate = clamp(0.88 + Math.min(1, hit.node.node.degree / 16) * 0.14 + (1 - distanceMix) * 0.08, 0.78, 1.22);
	const volume = clamp(settings.volume * (0.72 + (1 - distanceMix) * 0.32), 0, 1);

	return {
		detune,
		pan,
		playbackRate,
		velocity,
		volume,
	};
}
