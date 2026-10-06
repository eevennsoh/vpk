import { LANYARD_3D_ASSETS, LANYARD_3D_PROFILES } from "@/components/blocks/3d-lanyard/data";
import type { LanyardRenderer } from "@/components/blocks/3d-lanyard/renderer/lanyard-renderer";

import { WALL_LANYARD } from "./finale-wall-lanyard";

export type CreateWallLanyard = (canvas: HTMLCanvasElement) => LanyardRenderer;

let loading: Promise<CreateWallLanyard> | null = null;

/**
 * The 3D Lanyard renderer for the wall's lanyard tiles, loaded once, on first
 * ask: its module (kept out of the board's bundle), its artwork and fonts,
 * every presenter's portrait, and the physics of every swing a drop can have,
 * simulated in a worker (each is a long task, which would stall the glide).
 * The wall asks as the finale opens, so a tile that mounts mid-glide draws its
 * first drop at once. A failed load is forgotten, so the next tile tries again.
 */
export function loadFinaleWallLanyard(): Promise<CreateWallLanyard> {
	loading ??= (async () => {
		const [{ createLanyardRenderer }, { loadCardArt, loadImage }, { primeLanyardPhysics }] = await Promise.all([
			import("@/components/blocks/3d-lanyard/renderer/lanyard-renderer"),
			import("@/components/blocks/3d-lanyard/renderer/card-sources"),
			import("@/components/blocks/3d-lanyard/renderer/prime-lanyard-physics"),
		]);
		await Promise.all([
			loadCardArt(LANYARD_3D_ASSETS),
			primeLanyardPhysics(WALL_LANYARD.swings),
			// Warms the cache the renderer's `setPortrait` loads from; a missing face just draws initials.
			...LANYARD_3D_PROFILES.flatMap((profile) => (profile.photo ? [loadImage(profile.photo).catch(() => undefined)] : [])),
		]);
		return (canvas: HTMLCanvasElement) => createLanyardRenderer(canvas, LANYARD_3D_ASSETS, { supersampling: WALL_LANYARD.supersampling });
	})();
	loading.catch(() => {
		loading = null;
	});
	return loading;
}
