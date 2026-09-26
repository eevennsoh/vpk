// Adapted from BrowseAgentsModal's NeutralGridHeader at prototyping commit
// 168992687302b1aadb04928b160316dd401d07cf (studio/main/agent-lifecycle).
const GRID_X = [18, 42, 66, 90, 114, 138, 162, 186, 210, 234];
const GRID_Y = [18, 42, 66, 90];
export const GRID_WAVE_TIMES = [0, 0.12, 0.32, 0.54, 0.78, 1];

export function createGridPath(radius = 0): string {
	const warpPoint = (x: number, y: number): [number, number] => {
		if (radius === 0) return [x, y];
		const deltaX = x - 126;
		const deltaY = y - 54;
		const distance = Math.hypot(deltaX, deltaY);
		if (distance === 0) return [x, y];
		const displacement = 6 * Math.exp(-(((distance - radius) / (42 * 0.7)) ** 2));
		return [
			Number((x + (deltaX / distance) * displacement).toFixed(2)),
			Number((y + (deltaY / distance) * displacement).toFixed(2)),
		];
	};
	const linePath = (points: [number, number][]) => points.map(([x, y], index) => {
		const [warpedX, warpedY] = warpPoint(x, y);
		return `${index === 0 ? "M" : "L"}${warpedX} ${warpedY}`;
	}).join("");
	return [
		...GRID_Y.map((y) => linePath(Array.from({ length: 43 }, (_, index) => [index * 6, y]))),
		...GRID_X.map((x) => linePath(Array.from({ length: 19 }, (_, index) => [x, index * 6]))),
	].join("");
}

export const STATIC_GRID_PATH = createGridPath();
export const GRID_WAVE_PATHS = [0, 0.12, 0.31, 0.53, 0.77, 1].map((step, index) =>
	index === 0 || index === 5 ? STATIC_GRID_PATH : createGridPath(154 * step),
);
