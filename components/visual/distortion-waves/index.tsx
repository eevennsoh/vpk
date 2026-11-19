"use client";

/**
 * VPK-facing alias for distortion-waves 0.1.0.
 * Original: https://libraries.dev/waves
 * Source: https://github.com/Jakubantalik/Libraries.dev (packages/distortion-waves)
 *
 * A WebGL2 wave that opens from a button, an edge or an avatar and carries
 * one view into another. Without WebGL2 it falls back to a crossfade.
 */

import { type Ref } from "react";

import { DistortionWave as UpstreamDistortionWave } from "distortion-waves";
import type {
	DistortionWaveHandle,
	DistortionWaveProps as UpstreamDistortionWaveProps,
} from "distortion-waves";

import { captureWithTailwindBorders } from "./capture";

export interface DistortionWaveProps extends UpstreamDistortionWaveProps {
	ref?: Ref<DistortionWaveHandle>;
}

/**
 * `capture` defaults to a Tailwind-safe picture (see `capture.ts`); pass
 * `false` or your own function to opt out.
 */
export function DistortionWave({ ref, capture, ...props }: Readonly<DistortionWaveProps>) {
	return (
		<UpstreamDistortionWave
			ref={ref}
			capture={capture === undefined || capture === true ? captureWithTailwindBorders : capture}
			{...props}
		/>
	);
}

export type {
	DistortionWaveHandle,
	WaveOptions,
	WaveType,
} from "distortion-waves";

export {
	DEFAULT_DISTORTION_WAVE_CONFIG,
	DISTORTION_WAVE_LIVE_OPTIONS,
	DISTORTION_WAVE_PALETTE_OPTIONS,
	DISTORTION_WAVE_REDUCED_MOTION_OPTIONS,
	DISTORTION_WAVE_STYLE_GROUPS,
	DISTORTION_WAVE_TYPE_OPTIONS,
	getDistortionWaveStyleDefaults,
	type DistortionWaveControlConfig,
	type DistortionWaveStyleKey,
} from "./data";
