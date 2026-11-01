import type { PieceStyle } from "@/public/1p/rovo-stage-kit/types/stage-file";
import { AGENT_LANYARD_STICKER_AGENTS } from "@/components/blocks/agent-lanyard/sticker-data";
import { GRID_WAVE_PATHS, GRID_WAVE_TIMES } from "@/components/blocks/agent-lanyard/grid-path";
import { FINALE_PIECES, type FinalePiece as KitPiece, type FinalePieceId as PieceId, type FinalePieceStyles as PieceStyles } from "../data/finale-piece-catalogue";

/*
 * The mega bento's product tiles are pieces of the Rovo Stage Kit: the
 * animated product pieces of Rovo Desktop's stage lab, drawn by the kit's own
 * code as the lab draws them. Host-owned players in `finale-pieces` add local
 * moments and replace Linked rings with the TWG microsite's spinner motion.
 * The wall places each player on its tile and holds it on the finale clock.
 *
 * The kit lives whole in `public/1p/rovo-stage-kit/` (its GUIDE.md is the
 * contract; `finale/VENDOR.md` records which build it is and why it lives
 * there). To update it, replace that folder with a newer kit. A new stage
 * arrives as a new `rovo-stage.json` exported from the Rovo stage lab (Lab
 * panel → Stage kit → Export stage JSON, or the composer's Export stage),
 * dropped over the one in the folder; the wall reads its piece styles.
 *
 * VPK sets its own Atlaskit theme and Tailwind's preflight styles bare
 * elements, so the kit runs in a same-origin frame of its own laid over the
 * wall (the guide's integration A): its pieces get the kit's tokens and none
 * of the page's CSS, and the page's theme is untouched.
 */

/** Where the kit is served from (`public/1p/rovo-stage-kit/`). */
export const ROVO_STAGE_KIT_ROOT = "/1p/rovo-stage-kit";
export const LOCAL_FINALE_PIECES_ROOT = "/1p/finale-pieces";

/** Events the kit's frame raises on its own `<iframe>` element in the page. */
export const ROVO_STAGE_KIT_READY = "rovo-stage-kit-ready";
export const ROVO_STAGE_KIT_FAILED = "rovo-stage-kit-failed";

/** What the frame holds once the kit is loaded and its stage file read. */
export interface RovoStageKit {
	readonly pieces: readonly KitPiece[];
	readonly pieceStyles: PieceStyles;
}

/** The frame's window, as the page reads it. */
export interface RovoStageKitWindow {
	rovoStageKit?: RovoStageKit;
}

/**
 * Shared by the wall and Studio frames: load the kit, local players and stage,
 * check the stage's format, then announce the complete catalogue on the frame.
 */
export function rovoStageKitBootScript(root: string = ROVO_STAGE_KIT_ROOT): string {
	return `
const say = (type, detail) => window.frameElement?.dispatchEvent(new parent.CustomEvent(type, { detail }));
Promise.all([
	import(${JSON.stringify(`${root}/dist/rovo-stage.js`)}),
	fetch(${JSON.stringify(`${root}/rovo-stage.json`)}).then((response) => {
		if (!response.ok) throw new Error("rovo-stage.json: HTTP " + response.status);
		return response.json();
	}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/multiplayer.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/agent-session-stack.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/twg-search-strip.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/linked-rings.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/agent-activity-feed.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/principle-flow.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/realtime-editing.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/agent-proliferation.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/human-agent-network.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/principle-sync.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/principle-vendor.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/agent-work-chart.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/activity-timeline.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/atlassian-connect.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/agent-lanyard.js`)}).then((player) => player.registerAgentLanyard(${JSON.stringify({ agents: AGENT_LANYARD_STICKER_AGENTS, paths: GRID_WAVE_PATHS, times: GRID_WAVE_TIMES })})),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/enterprise-capabilities.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/code-search-greeting.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/content-attribution.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/amp-mark.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/send-to-agent.js`)}),
	import(${JSON.stringify(`${LOCAL_FINALE_PIECES_ROOT}/answer-sources.js`)}),
]).then(([kit, stage]) => {
	if (kit.stageInfo(stage) === null) throw new Error("rovo-stage.json is not a stage this kit can read");
	window.rovoStageKit = { pieces: ${JSON.stringify(FINALE_PIECES)}, pieceStyles: stage.pieceStyles ?? {} };
	say(${JSON.stringify(ROVO_STAGE_KIT_READY)});
}).catch((error) => say(${JSON.stringify(ROVO_STAGE_KIT_FAILED)}, String(error)));`;
}

export function rovoStageKitSrcdoc(root: string = ROVO_STAGE_KIT_ROOT): string {
	// Light inline, over the kit's dark theme CSS: a frame whose scheme differs from its element's gets an opaque backdrop.
	return `<!doctype html><html lang="en" style="color-scheme:light"><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color-scheme:light}</style></head><body><script type="module">${rovoStageKitBootScript(root)}</script></body></html>`;
}

/** Between pieces sharing a tile, in kit points. */
const WALL_PIECE_GAP = 24;

export interface WallPieceBox {
	readonly id: PieceId;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly scale: number;
}

/**
 * Natural piece dimensions at one shared camera scale, with tile round them
 * (`padding` across and down, in kit points: room for their shadows and
 * entrances, and the tile's width and height). Nothing fits or snaps.
 */
export function wallPiecesLayout(pieces: readonly Pick<KitPiece, "id" | "w" | "h" | "scale">[], viewportScale: number, padding: { readonly x: number; readonly y: number }): { readonly width: number; readonly height: number; readonly boxes: readonly WallPieceBox[] } {
	if (pieces.length === 0) return { width: 0, height: 0, boxes: [] };
	const inset = padding.x * viewportScale;
	const insetY = padding.y * viewportScale;
	const gap = WALL_PIECE_GAP * viewportScale;
	const rowHeight = Math.max(...pieces.map((piece) => piece.h * piece.scale * viewportScale));
	let x = inset;
	const boxes = pieces.map((piece) => {
		const scale = piece.scale * viewportScale;
		const width = piece.w * scale;
		const height = piece.h * scale;
		const box = { id: piece.id, x, y: insetY + (rowHeight - height) / 2, width, height, scale };
		x += width + gap;
		return box;
	});
	return { width: x - gap + inset, height: rowHeight + insetY * 2, boxes };
}

/**
 * Seconds into its moment after which a piece's frame no longer changes, as
 * the kit plays it (its style's own play, else its default: `holds`, null
 * when it never stops of its own accord); null while it never settles.
 */
export function pieceStillAfter(piece: Pick<KitPiece, "holds">, style: PieceStyle | undefined): number | null {
	const play = style?.play ?? (piece.holds === null ? "live" : "once");
	if (play !== "once") return null;
	return style?.length ?? piece.holds;
}
