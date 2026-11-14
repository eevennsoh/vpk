import type { NeuralPoint, NeuralViewport } from "./camera";
import { clamp, lerp } from "@/lib/math";

export interface NeuralGraphInteractionSettings {
	enabled: boolean;
	flowBoost: number;
	intensity: number;
	nodeSoundCooldownMs: number;
	nodeSoundEnabled: boolean;
	nodeSoundVolume: number;
	rayEmphasis: number;
}

export interface NeuralGraphInteractionState {
	activeNodeId: string | null;
	activeRayNodeId: string | null;
	flowBoost: number;
	intensity: number;
	pointer: NeuralPoint | null;
	rayDistance: number;
	rayEmphasis: number;
	rayProgress: number;
	velocity: number;
	velocityPxPerSecond: number;
}

export interface NeuralPointerVelocity {
	normalized: number;
	pxPerSecond: number;
}

export type NeuralGraphInteractionHitTarget = "none" | "node" | "ray";

export const DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS: NeuralGraphInteractionSettings = {
	enabled: true,
	flowBoost: 0.85,
	intensity: 0.9,
	nodeSoundCooldownMs: 95,
	nodeSoundEnabled: true,
	nodeSoundVolume: 0.7,
	rayEmphasis: 1,
};

export const EMPTY_NEURAL_GRAPH_INTERACTION_STATE: NeuralGraphInteractionState = {
	activeNodeId: null,
	activeRayNodeId: null,
	flowBoost: 0,
	intensity: 0,
	pointer: null,
	rayDistance: 0,
	rayEmphasis: 0,
	rayProgress: 0,
	velocity: 0,
	velocityPxPerSecond: 0,
};

export function isRayOnlyNeuralGraphInteraction(
	interaction: NeuralGraphInteractionState | null | undefined,
): boolean {
	return Boolean(interaction?.activeRayNodeId && !interaction.activeNodeId);
}

export function clampNeuralGraphInteractionSettings(
	input: Partial<NeuralGraphInteractionSettings> = {},
): NeuralGraphInteractionSettings {
	return {
		enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.enabled,
		flowBoost: clamp(
			typeof input.flowBoost === "number" ? input.flowBoost : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.flowBoost,
			0,
			1.5,
		),
		intensity: clamp(
			typeof input.intensity === "number" ? input.intensity : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.intensity,
			0,
			1.5,
		),
		nodeSoundCooldownMs: clamp(
			typeof input.nodeSoundCooldownMs === "number" ? input.nodeSoundCooldownMs : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.nodeSoundCooldownMs,
			0,
			240,
		),
		nodeSoundEnabled: typeof input.nodeSoundEnabled === "boolean" ? input.nodeSoundEnabled : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.nodeSoundEnabled,
		nodeSoundVolume: clamp(
			typeof input.nodeSoundVolume === "number" ? input.nodeSoundVolume : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.nodeSoundVolume,
			0,
			1,
		),
		rayEmphasis: clamp(
			typeof input.rayEmphasis === "number" ? input.rayEmphasis : DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS.rayEmphasis,
			0,
			1.5,
		),
	};
}

export function getSmoothedNeuralGraphInteractionState({
	current,
	next,
	smoothing,
}: {
	current: NeuralGraphInteractionState;
	next: NeuralGraphInteractionState;
	smoothing: number;
}): NeuralGraphInteractionState {
	const amount = clamp(smoothing, 0, 1);
	const pointer = next.pointer
		? current.pointer
			? {
				x: lerp(current.pointer.x, next.pointer.x, amount),
				y: lerp(current.pointer.y, next.pointer.y, amount),
			}
			: { ...next.pointer }
		: null;

	return {
		...next,
		pointer,
		rayDistance: lerp(current.rayDistance, next.rayDistance, amount),
		rayProgress: lerp(current.rayProgress, next.rayProgress, amount),
		velocity: lerp(current.velocity, next.velocity, amount),
		velocityPxPerSecond: lerp(current.velocityPxPerSecond, next.velocityPxPerSecond, amount),
	};
}

export function getNeuralPointerVelocity({
	elapsedMs,
	from,
	to,
	viewport,
}: {
	elapsedMs: number;
	from: NeuralPoint | null;
	to: NeuralPoint;
	viewport: NeuralViewport;
}): NeuralPointerVelocity {
	if (!from || elapsedMs <= 0) {
		return { normalized: 0, pxPerSecond: 0 };
	}

	const distance = Math.hypot(to.x - from.x, to.y - from.y);
	const pxPerSecond = distance / (elapsedMs / 1000);
	const diagonal = Math.hypot(viewport.width, viewport.height);
	const normalizer = clamp(diagonal * 1.15, 640, 1600);
	return {
		normalized: clamp(pxPerSecond / normalizer, 0, 1),
		pxPerSecond,
	};
}

export function getNeuralInteractionTargetIntensity({
	settings,
	target,
	velocity,
}: {
	settings: NeuralGraphInteractionSettings;
	target: NeuralGraphInteractionHitTarget;
	velocity: number;
}): number {
	if (!settings.enabled || settings.intensity <= 0) return 0;
	const normalizedVelocity = clamp(velocity, 0, 1);
	const hitBase = target === "ray" ? 0.26 : target === "node" ? 0.08 : 0;
	const velocityWeight = target === "ray" ? 0.66 : target === "node" ? 0.3 : 0.42;
	return clamp((hitBase + normalizedVelocity * velocityWeight) * settings.intensity, 0, 1.5);
}
