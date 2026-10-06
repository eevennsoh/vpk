import { DEG, STRANDS, clamp, duration, dimensions } from "./constants";
import { createCanvasFallback } from "./canvas-fallback";
import type { CardArtSources } from "./card-art";
import { makeGPU, type GpuRenderer } from "./gpu";
import { hardwareDetail, hardwareMesh } from "./hardware";
import { cardEdge, crimpMesh, holeWall, plane, strapMesh, wovenReturn } from "./mesh";
import { ambientSwing, attachment, inspectAttachment, inspectPhysics, pose } from "./physics";
import { loadCardArt, loadImage } from "./card-sources";
import { createTextureStore } from "./textures";
import type { AgentAssetKey, Axes, Face, LanyardConfig, LanyardSurface, Vec3 } from "./types";

export interface LanyardAssets {
	lanyard: string;
	headerPattern: string;
	rovoMark: string;
	agents: Record<AgentAssetKey, string>;
}

export interface LanyardRendererOptions {
	/**
	 * The most the WebGL path supersamples each way before resolving into the
	 * canvas (its anti-aliasing); 2 by default. Fill cost grows with its square,
	 * so a small canvas among other animation can trade a little edge softness
	 * for frame time: 1.5 is indistinguishable from 2 on a wall tile.
	 */
	supersampling?: number;
}

export interface LanyardRenderer {
	ready: Promise<void>;
	duration: number;
	dimensions: typeof dimensions;
	draw(time: number, config: LanyardConfig, width?: number, height?: number): void;
		setPortrait(src: string | null): Promise<void>;
	pose: typeof pose;
	inspectPhysics: typeof inspectPhysics;
	inspectAttachment: typeof inspectAttachment;
	dispose(): void;
}

/**
 * Draws the two-card lanyard into `canvas`. Geometry and motion are fully
 * deterministic in `time`, so any frame can be rendered without history.
 */
export function createLanyardRenderer(canvas: HTMLCanvasElement, assets: LanyardAssets, options: LanyardRendererOptions = {}): LanyardRenderer {
	const ctx = canvas.getContext("2d")!;
	const sources: CardArtSources & { lanyard: LanyardSurface } = {
		headerPattern: null as unknown as LanyardSurface, agentImages: {}, rovoMark: null as unknown as LanyardSurface,
		portrait: null, lanyard: null as unknown as LanyardSurface,
	};
	let loaded = false;
	let portraitSource: string | null = null;
	let portraitGeneration = 0;
	let textures: ReturnType<typeof createTextureStore>;

	const ready = loadCardArt(assets).then((art) => {
		Object.assign(sources, art);
		textures = createTextureStore(sources);
		loaded = true;
	});

	// undefined: not yet requested; null: WebGL2 unavailable, use the Canvas fallback.
	let gpu: GpuRenderer | null | undefined;
	const fallback = createCanvasFallback((face) => face.image.width === 2 || face.image === textures.fabric());

	function draw(time: number, config: LanyardConfig, width = canvas.width, height = canvas.height) {
		if (!loaded) return;
		time = clamp(time, 0, duration);
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = config.background || "#f4f4f4"; ctx.fillRect(0, 0, width, height);
		// Extra room for a large initial reveal eases away with the opening, so
		// the later swing and final composition are identical at every setting.
		const revealFraming = 10 + (clamp(Number(config.revealAngle ?? 10), 0, 45) - 10) * (1 - ambientSwing(time).envelope);
		const splitRadians = revealFraming * DEG;
		const splitWidth = 2 * (180 * Math.cos(splitRadians) + 455 * Math.sin(splitRadians)) + 210;
		const stageWidth = Math.max(890 + Math.max(0, Number(config.framingSwing ?? config.swing ?? 1) - 1) * 300, splitWidth);
		const scale = Math.min(width / stageWidth, height / 1000);
		const ox = (width - 420 * scale) / 2, oy = (height - 873 * scale) / 2 - 10 * scale;
		const swing = Number(config.swing ?? 1);
		const p = pose(time, swing);
		const material = textures.materials(config, { agent: config.backCard, theme: config.backCardTheme }, portraitGeneration);
		const cardFaces: Face[] = [], hardwareFaces: Face[] = [];
		const attach = attachment(time, swing, p, config.revealAngle);
		const { origin, frontOrigin, frontAxes, rearOrigin, rearAxes } = attach;
		const front = p.body[2].z >= 0;
		const cardShade = Math.min(.18, (1 - Math.abs(p.body[2].z)) * .17 + Math.max(0, p.body[2].x) * .055);
		if (gpu === undefined) gpu = makeGPU(options.supersampling);
		function card(image: LanyardSurface, edge: LanyardSurface, at: Vec3, axes: Axes) {
			cardEdge(cardFaces, edge, at, axes); holeWall(cardFaces, edge, at, axes);
			plane(cardFaces, image, { x: -220, y: 48, w: 440, h: 560, z: front ? 0 : -3.4 }, at, axes, gpu === null ? 5 : 1, gpu === null ? 7 : 1, cardShade);
		}
		card(material.rear, material.rearEdge, rearOrigin, rearAxes);
		const rearFaces = cardFaces.slice();
		card(front ? material.card : material.back, material.edge, frontOrigin, frontAxes);
		const frontFaces = cardFaces.slice(rearFaces.length);
		wovenReturn(hardwareFaces, material.fabric, origin, p.body);
		crimpMesh(hardwareFaces, sources.lanyard, origin, p.body);
		hardwareMesh(hardwareFaces, material.metal, origin, p.body, hardwareDetail(scale));
		const ribbons = STRANDS.map((strand, i) => {
			const faces: Face[] = [];
			strapMesh(faces, p.ropes[i], strand, time, p, material.fabric);
			// Depth-sort folds within each ribbon, preserving the collar's fixed
			// overlap between ribbons. A shared sort let yaw reverse that overlap.
			return faces.sort((a, b) => a.z - b.z);
		});
		const ribbonFaces = ribbons.flat();
		const list = [...ribbonFaces, ...cardFaces, ...hardwareFaces];
		if (gpu) {
			gpu.draw(list, width, height, ox, oy, scale, ribbonFaces.length);
			ctx.imageSmoothingQuality = "high"; ctx.drawImage(gpu.surface, 0, 0, width, height);
		} else {
			fallback.drawShadows(ctx, [...ribbons, rearFaces, frontFaces, hardwareFaces], width, height, ox, oy, scale);
			fallback.drawFaces(ctx, [...ribbonFaces, ...list.slice(ribbonFaces.length).sort((a, b) => a.z - b.z)], ox, oy, scale);
		}
	}

	async function setPortrait(src: string | null) {
		if (src === portraitSource) return;
		const generation = ++portraitGeneration;
		portraitSource = src; sources.portrait = null;
		if (!src) { textures?.invalidateCard(); return; }
		try {
			const image = await loadImage(src);
			if (generation === portraitGeneration) { sources.portrait = image; textures?.invalidateCard(); }
		} catch (error) {
			if (generation === portraitGeneration) portraitSource = null;
			throw error;
		}
	}

	return {
		ready, duration, dimensions, draw, setPortrait, pose, inspectPhysics, inspectAttachment,
		dispose() { gpu?.dispose(); },
	};
}

