import type { KitPiece, PieceId, PieceStyle, PieceStyles } from "@/public/1p/rovo-stage-kit/types/stage-file";

/*
 * The mega bento's product tiles are pieces of the Rovo Stage Kit: the
 * animated product pieces of Rovo Desktop's stage lab, drawn by the kit's own
 * code exactly as the lab draws them. Nothing here redraws, restyles or
 * retimes a piece; the wall only places each `<rovo-piece>` on its tile and
 * holds it on the finale clock.
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
 * The kit frame's document. Standards mode, light only (one appearance per
 * page), transparent over the wall. It loads the kit as a module and the
 * stage file as data, checks the file is one the kit can read (`stageInfo`),
 * and says whether it is ready on its own element.
 */
export function rovoStageKitSrcdoc(root: string = ROVO_STAGE_KIT_ROOT): string {
	const script = `
const say = (type, detail) => window.frameElement?.dispatchEvent(new parent.CustomEvent(type, { detail }));
Promise.all([
	import(${JSON.stringify(`${root}/dist/rovo-stage.js`)}),
	fetch(${JSON.stringify(`${root}/rovo-stage.json`)}).then((response) => {
		if (!response.ok) throw new Error("rovo-stage.json: HTTP " + response.status);
		return response.json();
	}),
]).then(([kit, stage]) => {
	if (kit.stageInfo(stage) === null) throw new Error("rovo-stage.json is not a stage this kit can read");
	window.rovoStageKit = { pieces: kit.PIECES, pieceStyles: stage.pieceStyles ?? {} };
	say(${JSON.stringify(ROVO_STAGE_KIT_READY)});
}).catch((error) => say(${JSON.stringify(ROVO_STAGE_KIT_FAILED)}, String(error)));`;
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color-scheme:light}</style></head><body><script type="module">${script}</script></body></html>`;
}

/** Room round a tile's pieces at the 1920 stage: about the kit's 40pt for shadows and entrances. */
const WALL_PIECE_INSET = 40;
/** Between the pieces of one tile (a row of app logos) at the 1920 stage. */
const WALL_PIECE_GAP = 24;

/** A piece placed on its tile: px from the tile's top left, and the scale the kit draws it at. */
export interface WallPieceBox {
	readonly id: PieceId;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly scale: number;
}

/**
 * A tile's pieces, as the kit sizes them (its box in points, times its
 * scale), laid out in one centred row at the one scale that fits them all
 * inside the tile with room round them: never stretched, never clipped.
 * `size` is the tile in viewport px; `typeScale` the wall's stage-to-viewport
 * scale, which the inset and gap take.
 */
export function fitWallPieces(size: { readonly width: number; readonly height: number }, pieces: readonly Pick<KitPiece, "id" | "w" | "h">[], typeScale: number): readonly WallPieceBox[] {
	if (pieces.length === 0) return [];
	const inset = WALL_PIECE_INSET * typeScale;
	const gap = WALL_PIECE_GAP * typeScale;
	const gaps = gap * (pieces.length - 1);
	const rowWidth = pieces.reduce((sum, piece) => sum + piece.w, 0);
	const rowHeight = Math.max(...pieces.map((piece) => piece.h));
	const scale = Math.max(0, Math.min((size.width - inset * 2 - gaps) / rowWidth, (size.height - inset * 2) / rowHeight));
	let x = (size.width - rowWidth * scale - gaps) / 2;
	return pieces.map((piece) => {
		const width = piece.w * scale;
		const height = piece.h * scale;
		const box = { id: piece.id, x, y: (size.height - height) / 2, width, height, scale };
		x += width + gap;
		return box;
	});
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
