import type { LensDistortionProps, PaperTextureProps } from "@paper-design/shaders-react";

export type NumberControlMeta = Readonly<{
	min: number;
	max: number;
	step: number;
	unit?: string;
}>;

const NORMALIZED = { min: 0, max: 1, step: 0.01 } as const;
const SIGNED = { min: -1, max: 1, step: 0.01 } as const;

// Ranges from the published Paper 0.0.81 parameter documentation.
export const PAPER_TEXTURE_NUMBER_CONTROLS = {
	blending: NORMALIZED,
	distortion: SIGNED,
	roughnessSize: NORMALIZED,
	roughnessRows: NORMALIZED,
	foldSizeX: NORMALIZED,
	foldSizeY: NORMALIZED,
	foldOffsetX: NORMALIZED,
	foldOffsetY: NORMALIZED,
	wrinkles: NORMALIZED,
	wrinkleSize: NORMALIZED,
	crumpleCount: { min: 2, max: 15, step: 1 },
} as const satisfies Partial<Record<keyof PaperTextureProps, NumberControlMeta>>;

export const LENS_DISTORTION_NUMBER_CONTROLS = {
	spread: NORMALIZED,
	bias: SIGNED,
	count: { min: 2, max: 50, step: 1 },
	perspective: NORMALIZED,
	dispersion: NORMALIZED,
	dispersionShift: SIGNED,
	dispersionColor: NORMALIZED,
	focusCenter: NORMALIZED,
	focusEdges: NORMALIZED,
	swirl: SIGNED,
	noiseOffset: NORMALIZED,
	lensBulge: SIGNED,
	lensCircle: NORMALIZED,
	imageX: SIGNED,
	imageY: SIGNED,
} as const satisfies Partial<Record<keyof LensDistortionProps, NumberControlMeta>>;
