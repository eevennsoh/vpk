import type { FinaleRect } from "../data/finale-stories";

export interface MasonryItem {
	readonly key: string;
	readonly width: number;
	readonly height: number;
}

/** Free-size, horizontal masonry. Candidate edges come from placed items, never a column grid. */
export function packWallMasonry(items: readonly MasonryItem[], reserved: readonly FinaleRect[], height: number, gutter: number): readonly FinaleRect[] {
	const occupied = [...reserved];
	return items.map((item) => {
		const xs = [...new Set([gutter, ...occupied.map((rect) => rect.x + rect.width + gutter)])].sort((a, b) => a - b);
		for (const x of xs) {
			const crossing = occupied.filter((rect) => x < rect.x + rect.width + gutter - 1e-6 && x + item.width + gutter > rect.x + 1e-6);
			const ys = [...new Set([gutter, ...crossing.map((rect) => rect.y + rect.height + gutter)])].sort((a, b) => a - b);
			for (const y of ys) {
				if (y + item.height > height - gutter + 1e-6) continue;
				if (crossing.some((rect) => y < rect.y + rect.height + gutter - 1e-6 && y + item.height + gutter > rect.y + 1e-6)) continue;
				const rect = { x, y, width: item.width, height: item.height };
				occupied.push(rect);
				return rect;
			}
		}
		throw new Error(`Masonry item ${item.key} is taller than the wall`);
	});
}
