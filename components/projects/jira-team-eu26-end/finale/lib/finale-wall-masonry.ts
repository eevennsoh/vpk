import type { FinaleRect } from "../data/finale-stories";

export interface MasonryItem {
	readonly key: string;
	readonly width: number;
	readonly height: number;
	readonly group?: string;
}

/** Free-size, horizontal masonry. Candidate edges come from placed items, never a column grid. */
export function packWallMasonry(items: readonly MasonryItem[], reserved: readonly FinaleRect[], height: number, gutter: number, gutterY: number = gutter, groupGap = 0): readonly FinaleRect[] {
	const occupied = [...reserved];
	const grouped: { readonly group: string; readonly centreX: number }[] = [];
	return items.map((item) => {
		const separationEdges = groupGap > 0 ? grouped.filter((placed) => placed.group === item.group).map((placed) => placed.centreX + groupGap - item.width / 2) : [];
		const xs = [...new Set([gutter, ...occupied.map((rect) => rect.x + rect.width + gutter), ...separationEdges])].sort((a, b) => a - b);
		for (const x of xs) {
			if (item.group && grouped.some((placed) => placed.group === item.group && Math.abs(x + item.width / 2 - placed.centreX) < groupGap - 1e-6)) continue;
			const crossing = occupied.filter((rect) => x < rect.x + rect.width + gutter - 1e-6 && x + item.width + gutter > rect.x + 1e-6);
			const ys = [...new Set([gutterY, ...crossing.map((rect) => rect.y + rect.height + gutterY)])].sort((a, b) => a - b);
			for (const y of ys) {
				if (y + item.height > height - gutterY + 1e-6) continue;
				if (crossing.some((rect) => y < rect.y + rect.height + gutterY - 1e-6 && y + item.height + gutterY > rect.y + 1e-6)) continue;
				const rect = { x, y, width: item.width, height: item.height };
				occupied.push(rect);
				if (item.group) grouped.push({ group: item.group, centreX: x + item.width / 2 });
				return rect;
			}
		}
		throw new Error(`Masonry item ${item.key} is taller than the wall`);
	});
}
