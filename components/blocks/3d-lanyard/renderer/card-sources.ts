import type { LanyardAssets } from "./lanyard-renderer";
import type { AgentAssetKey, LanyardSurface } from "./types";

/** Immutable artwork shared by every renderer and card preview. */
export interface LoadedCardArt {
	lanyard: LanyardSurface;
	headerPattern: LanyardSurface;
	rovoMark: LanyardSurface;
	agentImages: Record<string, LanyardSurface>;
}

export const AGENT_KEYS: AgentAssetKey[] = ["claude", "codex", "cursor", "copilot", "rovo"];

export function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Could not load ${src}.`));
		img.src = src;
	});
}

const cache = new WeakMap<LanyardAssets, Promise<LoadedCardArt>>();

/** Loads images and the canvas fonts once per asset set; failures are not cached. */
export function loadCardArt(assets: LanyardAssets): Promise<LoadedCardArt> {
	let pending = cache.get(assets);
	if (!pending) {
		pending = (async () => {
			const [lanyard, headerPattern, rovoMark, ...agents] = await Promise.all([
				loadImage(assets.lanyard), loadImage(assets.headerPattern), loadImage(assets.rovoMark),
				...AGENT_KEYS.map((key) => loadImage(assets.agents[key])),
			]);
			await Promise.all([
				document.fonts.load('500 32px "Atlassian Sans"'),
				document.fonts.load('400 20px "Atlassian Sans"'),
				document.fonts.load('500 20px "Atlassian Mono"'),
			]);
			await document.fonts.ready;
			return { lanyard, headerPattern, rovoMark, agentImages: Object.fromEntries(AGENT_KEYS.map((key, i) => [key, agents[i]])) };
		})();
		pending.catch(() => cache.delete(assets));
		cache.set(assets, pending);
	}
	return pending;
}
