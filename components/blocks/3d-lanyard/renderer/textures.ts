import { CARD, HOLE_R } from "./constants";
import { cardPalettes, drawCard, type CardArtSources } from "./card-art";
import type { AgentCardArt, CardContent, CardTheme, LanyardSurface } from "./types";

export interface MaterialSet {
	card: HTMLCanvasElement;
	back: HTMLCanvasElement;
	edge: HTMLCanvasElement;
	rear: HTMLCanvasElement;
	rearEdge: HTMLCanvasElement;
	metal: HTMLCanvasElement;
	fabric: HTMLCanvasElement;
}

export interface TextureStore {
	/** Fabric texture, exposed so the Canvas fallback can recognise ribbon faces. */
	fabric(): HTMLCanvasElement;
	agentTexture(agent: AgentCardArt, theme: CardTheme): HTMLCanvasElement;
	materials(config: CardContent, rear: { agent: AgentCardArt; theme: CardTheme }, portraitGeneration: number): MaterialSet;
	/** Presenter edits replace the front texture on the next draw. */
	invalidateCard(): void;
}

const TEXTURE_WIDTH = (CARD.width + 80) * 2;
const TEXTURE_HEIGHT = 1120;

function solid(color: string) {
	const tile = document.createElement("canvas");
	tile.width = tile.height = 2;
	const t = tile.getContext("2d")!;
	t.fillStyle = color;
	t.fillRect(0, 0, 2, 2);
	return tile;
}

/** Paints a card face at 2x into a padded canvas, off the shared visible context. */
function paintCard(sources: CardArtSources, config: CardContent, agent: AgentCardArt | null, theme: CardTheme) {
	const card = document.createElement("canvas");
	card.width = TEXTURE_WIDTH;
	card.height = TEXTURE_HEIGHT;
	const ctx = card.getContext("2d")!;
	ctx.setTransform(2, 0, 0, 2, (40 - CARD.x) * 2, (40 - CARD.y) * 2);
	drawCard(ctx, sources, config, 0, agent, theme);
	return card;
}

export function createTextureStore(sources: CardArtSources & { lanyard: LanyardSurface }): TextureStore {
	const agentTextures = new Map<string, HTMLCanvasElement>();
	let cardCache: { key: string; image: HTMLCanvasElement } | null = null;
	let fabricCache: HTMLCanvasElement | undefined;
	let backCache: HTMLCanvasElement | undefined;
	let edgeCache: HTMLCanvasElement, darkEdgeCache: HTMLCanvasElement, metalCache: HTMLCanvasElement;

	function agentTexture(agent: AgentCardArt, theme: CardTheme) {
		const mode = theme === "dark" ? "dark" : "light", key = JSON.stringify([agent.id, agent.name, agent.role, agent.description, agent.asset, mode]);
		let texture = agentTextures.get(key);
		if (!texture) {
			texture = paintCard(sources, { ...agent, photo: null }, agent, mode);
			// Edited details mint a new key per keystroke; keep only recent faces.
			if (agentTextures.size >= 12) agentTextures.delete(agentTextures.keys().next().value!);
			agentTextures.set(key, texture);
		}
		return texture;
	}

	function buildFabric() {
		const tile = document.createElement("canvas");
		tile.width = tile.height = 32;
		const tc = tile.getContext("2d")!;
		tc.imageSmoothingQuality = "high";
		tc.drawImage(sources.lanyard, 220, 240, 160, 160, 0, 0, 32, 32);
		const material = document.createElement("canvas");
		material.width = 96;
		material.height = 2688;
		const mc = material.getContext("2d")!;
		mc.fillStyle = mc.createPattern(tile, "repeat")!;
		mc.fillRect(0, 0, 96, 2688);
		const g = mc.createLinearGradient(0, 0, 96, 0);
		g.addColorStop(0, "rgba(0,0,0,.24)"); g.addColorStop(.08, "rgba(255,255,255,.06)");
		g.addColorStop(.85, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.20)");
		mc.fillStyle = g;
		mc.fillRect(0, 0, 96, 2688);
		return material;
	}

	function buildBack() {
		const back = document.createElement("canvas");
		back.width = TEXTURE_WIDTH;
		back.height = TEXTURE_HEIGHT;
		const c = back.getContext("2d")!;
		c.scale(2, 2);
		c.fillStyle = "#f8f8f8"; c.beginPath(); c.roundRect(40, 40, CARD.width, CARD.height, CARD.radius); c.fill();
		c.strokeStyle = "#dddddd"; c.lineWidth = .5; c.stroke();
		c.globalCompositeOperation = "destination-out";
		c.beginPath(); c.arc(40 + CARD.width / 2, 65, HOLE_R, 0, Math.PI * 2); c.fill();
		edgeCache = solid("#cbd0d0"); darkEdgeCache = solid(cardPalettes.dark.edge); metalCache = solid("#d4d9d7");
		return back;
	}

	return {
		fabric() {
			fabricCache ??= buildFabric();
			return fabricCache;
		},
		agentTexture,
		materials(config, rear, portraitGeneration) {
			const key = `${config.name}|${config.role}|${portraitGeneration}|${config.photo === null}`;
			if (!cardCache || cardCache.key !== key) cardCache = { key, image: paintCard(sources, config, null, "light") };
			fabricCache ??= buildFabric();
			backCache ??= buildBack();
			return { card: cardCache.image, back: backCache, edge: edgeCache, rear: agentTexture(rear.agent, rear.theme),
				rearEdge: rear.theme === "dark" ? darkEdgeCache : edgeCache, metal: metalCache, fabric: fabricCache };
		},
		invalidateCard() { cardCache = null; },
	};
}
