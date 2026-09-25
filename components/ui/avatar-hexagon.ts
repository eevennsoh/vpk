export const AVATAR_HEXAGON_REFERENCE_SIZE = 24;
export const AVATAR_HEXAGON_REFERENCE_RADIUS = 4;
// The 24px / 4px and 32px / 6px anchors add 2px of radius per 8px of size.
const RADIUS_RATIO = (6 - AVATAR_HEXAGON_REFERENCE_RADIUS) / (32 - AVATAR_HEXAGON_REFERENCE_SIZE);
const RADIUS_OFFSET = AVATAR_HEXAGON_REFERENCE_RADIUS - AVATAR_HEXAGON_REFERENCE_SIZE * RADIUS_RATIO;

export function avatarHexagonCornerRadius(sizePx: number) {
	return sizePx * RADIUS_RATIO + RADIUS_OFFSET;
}

const CORNERS = [
	[0, -0.5, -120],
	[Math.sqrt(3) / 4, -0.25, -60],
	[Math.sqrt(3) / 4, 0.25, 0],
	[0, 0.5, 60],
	[-Math.sqrt(3) / 4, 0.25, 120],
	[-Math.sqrt(3) / 4, -0.25, 180],
] as const;

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/** Percent and pixel terms preserve both radius anchors, borders, and separators. */
export function avatarHexagonPoints(inset = 0, outset = 0) {
	return CORNERS.flatMap(([x, y, start]) => Array.from({ length: 7 }, (_, step) => {
		const angle = (start + step * 10) * Math.PI / 180;
		const correction = RADIUS_OFFSET + outset * (1 - 2 * RADIUS_RATIO);
		return {
			xPercent: round((0.5 + x * (1 - 2 * RADIUS_RATIO) + Math.cos(angle) * RADIUS_RATIO) * 100),
			yPercent: round((0.5 + y * (1 - 2 * RADIUS_RATIO) + Math.sin(angle) * RADIUS_RATIO) * 100),
			xPixels: round((Math.cos(angle) - 2 * x) * correction - Math.cos(angle) * inset),
			yPixels: round((Math.sin(angle) - 2 * y) * correction - Math.sin(angle) * inset),
		};
	}));
}

function coordinate(percent: number, pixels: number) {
	return pixels === 0 ? `${percent}%` : `calc(${percent}% ${pixels < 0 ? "-" : "+"} ${Math.abs(pixels)}px)`;
}

/** The upper-right curve sample that keeps a status dot flush with the hexagon. */
export function avatarHexagonStatusAnchor() {
	const point = avatarHexagonPoints()[8]!;
	return {
		...point,
		left: coordinate(point.xPercent, point.xPixels),
		top: coordinate(point.yPercent, point.yPixels),
	};
}

function polygonPoints(inset = 0, outset = 0) {
	return avatarHexagonPoints(inset, outset).map(({ xPercent, yPercent, xPixels, yPixels }) =>
		`${coordinate(xPercent, xPixels)} ${coordinate(yPercent, yPixels)}`);
}

export function avatarHexagonClip(outset = 0) {
	return `polygon(${polygonPoints(0, outset).join(", ")})`;
}

/** An inward 1px border follows the same centers, with the inner radius reduced by 1px. */
export function avatarHexagonBorderClip() {
	const outer = polygonPoints();
	const inner = polygonPoints(1).reverse();
	return `polygon(evenodd, ${[...outer, outer[0], ...inner, inner[0]].join(", ")})`;
}
