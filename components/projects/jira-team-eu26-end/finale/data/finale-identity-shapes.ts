/**
 * The bold shapes of the Rovo visual identity (FY26), as the Rovo Chat
 * desktop welcome mosaic draws them (`mosaic/identityArt.ts`, the shapes
 * `ShapeTile` morphs through). Each is fitted to a centred 100 × 100 box, so
 * any two can morph into each other.
 */

export type FinaleShapeKind = "shield" | "circle" | "arch" | "banner" | "hexagon" | "star";

export const FINALE_SHAPES: Readonly<Record<FinaleShapeKind, string>> = {
	shield: "M12.69 18.25C27.02 18.25 40.1 12.86 50 4C59.91 12.86 72.98 18.25 87.31 18.25C88.36 18.25 89.39 18.22 90.42 18.17L90.42 34.28C90.42 53.59 81.45 71.8 66.15 83.58L50 96L33.85 83.58C18.54 71.81 9.58 53.59 9.58 34.28L9.58 18.17C10.61 18.22 11.64 18.25 12.69 18.25Z",
	circle: "M50 4C75.41 4 96 24.59 96 50C96 75.41 75.41 96 50 96C24.59 96 4 75.41 4 50C4 24.59 24.59 4 50 4Z",
	arch: "M40.11 71.55C42.74 68.05 45.82 66.57 49.73 66.57C53.99 66.57 57.31 68.3 59.66 71.55L96 71.55C91 43.32 74.08 28.45 50.22 28.45C28 28.45 12.93 39.74 4 71.55L40.11 71.55L40.11 71.55Z",
	banner: "M88.26 25.22C96 40.84 95.47 58.61 86.81 73.87L86.29 74.78L4 74.78L4.23 74.39C12.94 59.26 13.64 41.59 6.13 25.98L5.77 25.23L88.26 25.23L88.26 25.22Z",
	hexagon: "M42.67 7.23C47.56 4.41 52.44 4.41 57.33 7.23L83.38 22.27C88.26 25.09 90.7 29.32 90.7 34.96L90.7 65.04C90.7 70.68 88.26 74.91 83.38 77.73L57.33 92.77C52.44 95.59 47.56 95.59 42.67 92.77L16.62 77.73C11.74 74.91 9.3 70.68 9.3 65.04L9.3 34.96C9.3 29.32 11.74 25.09 16.62 22.27Z",
	star: "M88.07 46.36C76.34 41.31 70.47 38.78 66.12 34.31C61.78 29.85 59.43 23.92 54.69 12.05L51.48 4L48.52 4L45.31 12.05C40.59 23.92 38.22 29.87 33.88 34.33C29.53 38.8 23.66 41.33 11.93 46.38L6.97 48.52L6.97 51.48L11.93 53.62C23.68 58.67 29.53 61.2 33.88 65.67C38.22 70.13 40.57 76.06 45.31 87.95L48.52 96L51.48 96L54.69 87.95C59.41 76.08 61.78 70.13 66.12 65.67C70.47 61.2 76.34 58.67 88.07 53.62L93.03 51.48L93.03 48.52L88.07 46.38L88.07 46.36Z",
};

/** The order a cycling shape morphs through, as `ShapeTile`'s `SHAPE_CYCLE`. */
export const FINALE_SHAPE_CYCLE: readonly FinaleShapeKind[] = ["shield", "circle", "arch", "banner", "hexagon", "star"];
