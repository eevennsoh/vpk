export type PatternStrokeStyle = "solid" | "dashed";

export type PatternStrokeLineCap = "butt" | "round" | "square";

export type PatternStrokeLineJoin = "miter" | "round" | "bevel";

export interface PatternStrokeOptions {
	style?: PatternStrokeStyle;
	width?: number;
	dash?: number;
	gap?: number;
	dashArray?: string;
	dashOffset?: number;
	lineCap?: PatternStrokeLineCap;
	lineJoin?: PatternStrokeLineJoin;
	miterLimit?: number;
}

export const STROKE_STYLE_TYPES: { value: PatternStrokeStyle; label: string }[] = [
	{ value: "solid", label: "Solid" },
	{ value: "dashed", label: "Dashed" },
];

export const STROKE_LINE_CAP_TYPES: { value: PatternStrokeLineCap; label: string }[] = [
	{ value: "butt", label: "Butt" },
	{ value: "round", label: "Round" },
	{ value: "square", label: "Square" },
];

export const STROKE_LINE_JOIN_TYPES: { value: PatternStrokeLineJoin; label: string }[] = [
	{ value: "miter", label: "Miter" },
	{ value: "round", label: "Round" },
	{ value: "bevel", label: "Bevel" },
];

function toFinitePositive(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: fallback;
}

function toFiniteNumber(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function escapeSvgAttribute(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("\"", "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export function resolvePatternStrokeDashArray(stroke?: PatternStrokeOptions): string | undefined {
	if (stroke?.style !== "dashed") return undefined;

	const dashArray = stroke.dashArray?.trim();
	if (dashArray) return dashArray;

	const dash = toFinitePositive(stroke.dash, 4);
	const gap = toFinitePositive(stroke.gap, 4);

	return `${dash} ${gap}`;
}

export function buildGridStrokeMaskImage(scale: number, stroke?: PatternStrokeOptions, centered = false): string {
	const strokeWidth = toFinitePositive(stroke?.width, 1);
	const tileSize = toFinitePositive(scale, 1);
	const pathInset = centered ? tileSize / 2 : strokeWidth / 2;
	const lineCap = stroke?.lineCap ?? "butt";
	const lineJoin = stroke?.lineJoin ?? "miter";
	const miterLimit = toFinitePositive(stroke?.miterLimit, 4);
	const dashArray = resolvePatternStrokeDashArray(stroke);
	const dashOffset = toFiniteNumber(stroke?.dashOffset, 0);
	const dashAttributes = dashArray
		? ` stroke-dasharray="${escapeSvgAttribute(dashArray)}" stroke-dashoffset="${dashOffset}"`
		: "";

	const svg = [
		// CSS round-repeat can resize each tile into a rectangle. Fill it rather than letterboxing.
		`<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" preserveAspectRatio="none">`,
		`<path d="M 0 ${pathInset} H ${tileSize} M ${pathInset} 0 V ${tileSize}" fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="${lineCap}" stroke-linejoin="${lineJoin}" stroke-miterlimit="${miterLimit}"${dashAttributes}/>`,
		"</svg>",
	].join("");

	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
