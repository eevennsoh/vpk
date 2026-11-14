import { clamp } from "@/lib/utils";

export const SQUIRCLE_DEFAULT_SMOOTHNESS = 100;
export const SQUIRCLE_CORNER_SHAPE_FALLBACK = 0.566;
export const SQUIRCLE_LARGE_RADIUS_PX = 1000;
export const SQUIRCLE_DEFAULT_CORNER_SHAPE = 2;
export const SQUIRCLE_DEFAULT_EXPONENT = 2 ** SQUIRCLE_DEFAULT_CORNER_SHAPE;
export const SQUIRCLE_MAX_EXPONENT = 7.5;

export function mapSmoothnessToExponent(smoothness: number): number {
	const normalized = clamp(smoothness, 0, 100) / 100;
	return SQUIRCLE_MAX_EXPONENT + normalized * (SQUIRCLE_DEFAULT_EXPONENT - SQUIRCLE_MAX_EXPONENT);
}

export function mapExponentToCornerShapeValue(exponent: number): number {
	return Math.log2(Math.max(exponent, Number.MIN_VALUE));
}

export function mapSmoothnessToCornerShapeValue(smoothness: number): number {
	return mapExponentToCornerShapeValue(mapSmoothnessToExponent(smoothness));
}

export function formatCornerShapeSuperellipse(smoothness: number): string {
	const value = Number(mapSmoothnessToCornerShapeValue(smoothness).toFixed(3));
	return `superellipse(${value})`;
}

export function buildSuperellipsePath(
	width: number,
	height: number,
	exponent: number,
	inset: number,
	segments = 120,
): string {
	const safeInset = clamp(inset, 0, Math.min(width, height) / 2 - 1);
	const semiX = Math.max(1, width / 2 - safeInset);
	const semiY = Math.max(1, height / 2 - safeInset);
	const centerX = width / 2;
	const centerY = height / 2;

	const points = Array.from({ length: segments }, (_, index) => {
		const angle = (index / segments) * Math.PI * 2;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const x =
			centerX
			+ Math.sign(cos) * (Math.abs(cos) ** (2 / exponent)) * semiX;
		const y =
			centerY
			+ Math.sign(sin) * (Math.abs(sin) ** (2 / exponent)) * semiY;

		return `${x.toFixed(3)} ${y.toFixed(3)}`;
	});

	return `M ${points.join(" L ")} Z`;
}

export function buildObjectBoundingBoxSuperellipsePath(
	smoothness = SQUIRCLE_DEFAULT_SMOOTHNESS,
	inset = 0.002,
	segments = 120,
): string {
	return buildSuperellipsePath(
		1,
		1,
		mapSmoothnessToExponent(smoothness),
		inset,
		segments,
	);
}

export function buildSvgPathMaskImage(
	pathData: string,
	width: number,
	height: number,
): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path d="${pathData}" fill="white"/></svg>`;
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function buildObjectBoundingBoxSuperellipseMaskImage(
	smoothness = SQUIRCLE_DEFAULT_SMOOTHNESS,
	inset = 0.002,
	segments = 120,
): string {
	return buildSvgPathMaskImage(
		buildObjectBoundingBoxSuperellipsePath(smoothness, inset, segments),
		1,
		1,
	);
}
