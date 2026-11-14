import {
	clamp,
	clampNeuralGraphParams,
	type NeuralGraphNumberKey,
	type NeuralGraphParams,
} from "./params";
import { lerp } from "@/lib/math";

export interface ResponsivePersonalGraphViewport {
	height: number;
	width: number;
}

export const RESPONSIVE_PERSONAL_GRAPH_WIDTHS = {
	compact: 360,
	medium: 768,
	wide: 1200,
} as const;

export const RESPONSIVE_PERSONAL_GRAPH_NUMERIC_PARAM_KEYS = [
	"coneAngle",
	"labelMetaSize",
	"labelSize",
	"maxVisibleNodes",
	"nodeSize",
	"originOffset",
	"originY",
	"radiusMax",
	"radiusMin",
	"rayOpacity",
	"rayOriginY",
	"radialArcAngle",
	"radialDepthCurve",
	"spread",
	"tiltX",
	"tiltZ",
] as const satisfies ReadonlyArray<NeuralGraphNumberKey>;

type ResponsivePersonalGraphNumberKey = (typeof RESPONSIVE_PERSONAL_GRAPH_NUMERIC_PARAM_KEYS)[number];
type ResponsivePersonalGraphNumericPreset = Pick<NeuralGraphParams, ResponsivePersonalGraphNumberKey>;

const COMPACT_PERSONAL_GRAPH_PARAMS = {
	coneAngle: 68,
	labelMetaSize: 7,
	labelSize: 10,
	maxVisibleNodes: 42,
	nodeSize: 5,
	originOffset: 0,
	originY: 0.54,
	radiusMax: 74,
	radiusMin: 24,
	rayOpacity: 0.008,
	rayOriginY: 0.54,
	radialArcAngle: 360,
	radialDepthCurve: 0.95,
	spread: 250,
	tiltX: -2,
	tiltZ: -3,
} as const satisfies ResponsivePersonalGraphNumericPreset;

const MEDIUM_PERSONAL_GRAPH_PARAMS = {
	coneAngle: 82,
	labelMetaSize: 9,
	labelSize: 12,
	maxVisibleNodes: 72,
	nodeSize: 5.5,
	originOffset: 0,
	originY: 0.53,
	radiusMax: 86,
	radiusMin: 22,
	rayOpacity: 0.014,
	rayOriginY: 0.53,
	radialArcAngle: 360,
	radialDepthCurve: 0.88,
	spread: 380,
	tiltX: -3,
	tiltZ: -5,
} as const satisfies ResponsivePersonalGraphNumericPreset;

function getResponsiveWidthProgress(width: number, startWidth: number, endWidth: number) {
	return clamp((width - startWidth) / Math.max(1, endWidth - startWidth), 0, 1);
}

function interpolateNumericParams({
	from,
	progress,
	to,
}: {
	from: ResponsivePersonalGraphNumericPreset;
	progress: number;
	to: ResponsivePersonalGraphNumericPreset;
}) {
	const params = {} as Record<ResponsivePersonalGraphNumberKey, number>;

	for (const key of RESPONSIVE_PERSONAL_GRAPH_NUMERIC_PARAM_KEYS) {
		params[key] = lerp(from[key], to[key], progress);
	}

	return params;
}

function pickResponsiveBaseParams(baseParams: NeuralGraphParams): ResponsivePersonalGraphNumericPreset {
	const params = {} as Record<ResponsivePersonalGraphNumberKey, number>;

	for (const key of RESPONSIVE_PERSONAL_GRAPH_NUMERIC_PARAM_KEYS) {
		params[key] = baseParams[key];
	}

	return params;
}

export function getResponsivePersonalGraphParams(
	viewport: ResponsivePersonalGraphViewport,
	baseParams: NeuralGraphParams,
) {
	const width = Math.max(1, viewport.width);
	const wideParams = pickResponsiveBaseParams(baseParams);
	const numericParams = width < RESPONSIVE_PERSONAL_GRAPH_WIDTHS.medium
		? interpolateNumericParams({
			from: COMPACT_PERSONAL_GRAPH_PARAMS,
			progress: getResponsiveWidthProgress(
				width,
				RESPONSIVE_PERSONAL_GRAPH_WIDTHS.compact,
				RESPONSIVE_PERSONAL_GRAPH_WIDTHS.medium,
			),
			to: MEDIUM_PERSONAL_GRAPH_PARAMS,
		})
		: interpolateNumericParams({
			from: MEDIUM_PERSONAL_GRAPH_PARAMS,
			progress: getResponsiveWidthProgress(
				width,
				RESPONSIVE_PERSONAL_GRAPH_WIDTHS.medium,
				RESPONSIVE_PERSONAL_GRAPH_WIDTHS.wide,
			),
			to: wideParams,
		});

	return clampNeuralGraphParams({
		...baseParams,
		...numericParams,
		showLabels: width >= 700,
		showRays: true,
	});
}

export function areResponsivePersonalGraphParamsEqual(
	currentParams: NeuralGraphParams,
	nextParams: NeuralGraphParams,
) {
	for (const key of Object.keys(nextParams) as Array<keyof NeuralGraphParams>) {
		if (!Object.is(currentParams[key], nextParams[key])) {
			return false;
		}
	}

	return true;
}

export function shouldAnimateResponsivePersonalGraphParams({
	hasMeasuredViewport,
	prefersReducedMotion,
}: {
	hasMeasuredViewport: boolean;
	prefersReducedMotion: boolean;
}) {
	return hasMeasuredViewport && !prefersReducedMotion;
}
