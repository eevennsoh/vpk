"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { WALL_CUE } from "../data/finale-cues";
import { FINALE_BRAND, FINALE_COLORS } from "../data/finale-palette";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import {
	FINALE_CAMERA_FOV,
	cameraDistance,
	fogAtDepth,
	landingShadowIn,
	lensFade,
	slideShadowGround,
	type FinaleFit,
	type FinaleShadowGround,
	type FinaleViewport,
} from "../lib/finale-card-motion";
import { FINALE_INK } from "../lib/finale-build-style";
import { clamp, lerp } from "../lib/finale-math";
import {
	createLensMaterial,
	createShadowMaterial,
	createSheetMaterial,
	lensShare,
	placeShadow,
	poseSheet,
	rgbUnit,
	setCloth,
	setLandingWave,
	textureFrom,
	type SheetMesh,
} from "../lib/finale-sheet-gl";
import { finaleFieldPixelRatio } from "../lib/finale-stage-fit";
import { paintWallPrint, type FinaleWall, type WallPrintShapes } from "../lib/finale-wall-layout";
import { wallActive, wallSheetsAt, type BentoDrop, type WallSheet } from "../lib/finale-wall-motion";
import { wallDrawOrder, wallSheetLifted, type WallDrawOrder } from "../lib/finale-wall-order";

type PrintLookup = (key: string) => HTMLCanvasElement | undefined;

/** Sheets made up front (and warmed) so the throw never builds one mid-act; the act peaks near 22. */
const POOL_START = 32;

/**
 * From the bento's final hold (its tiles are printed just before it), the
 * faces and the title's ink go up to the GPU one a frame, so the title's
 * flip and the throw never upload them all at once.
 */
const PREFETCH_FROM = WALL_CUE.start - 1;

/** "Team 26" as `FinaleTeamTitle` sets it: Atlassian Sans 400, 112 stage px, 1.1 line, −0.02em, 0.22em between the words. */
const TITLE_FONT = 112;
const TITLE_LINE = 1.1;
/** Its baseline in the 1.1em row, from the row's top (ascent 0.973em, descent 0.241em). */
const TITLE_BASELINE = 0.916;
const TITLE_GAP = 0.22;
const TITLE_TRACKING = -0.02;
/** Room round the ink so no glyph clips (descenders fall just below the row). */
const TITLE_BLEED = 0.1;

/** The smear at full chroma, as the field's burst and swoops filmed it. */
const LENS_SMEAR = 0.55;
/** A little of the field's sphere warp, only round the bento's cards while they fly. */
const LENS_BULGE = 0.12;
/** Room in the lens for this many smeared sheets (the act peaks near 20). */
const LENS_SPOTS = 32;
/** Past a sheet's rect, its share of the lens fades out over about as far as its trails reach (frame heights). */
const LENS_REACH = 0.14;
/** Slack round a sheet's flat corners for its cloth and flutter (frame heights). */
const SPOT_PAD = 0.03;
/**
 * How far from a pixel the lens reads (frame widths/heights): the taps run
 * a full reach toward the centre, the rim wave swims a little, the bulge
 * reads outward. The scene is drawn this much beyond the smeared region.
 */
const LENS_PULL = LENS_SMEAR * (0.2 + 0.018) + 0.01;
const BULGE_PULL = LENS_BULGE * 0.5;

/** One of a print slot's Done cards, its print on a canvas of its sheet's size, painted as its DOM card is (`paintWallPrint`). */
interface PrintedCard {
	readonly code: string;
	readonly canvas: HTMLCanvasElement;
	readonly texture: THREE.CanvasTexture;
	/** Its print is on the canvas: the sheet shows it (else it stays a blank tile). */
	painted: boolean;
}

/** A bento card's printed face, as the scene printed its DOM tile. */
interface FacePrint {
	readonly canvas: HTMLCanvasElement;
	readonly texture: THREE.CanvasTexture;
}

/** "Team 26" in one colour on a clear ground, laid on a face of the title's plate. */
interface TitleInk {
	readonly texture: THREE.CanvasTexture;
	/** Its canvas in em of its type: the lockup's box, centred on its row. */
	readonly width: number;
	readonly height: number;
}

/** The title card's two faces: white type on its black front, ink on the white back it formed as. */
interface TitleFaces<T> {
	readonly front: T;
	readonly back: T;
}

interface PooledSheet {
	readonly mesh: SheetMesh;
	readonly shadow: SheetMesh;
	key: string | null;
	/** The frame it was last claimed in. */
	seen: number;
	/** What it was last bound to, so a sheet rebinds only when that changes. */
	color: string | null;
	back: string | null;
	print: string | null;
	printed: PrintedCard | null;
}

interface WallGlState {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	readonly distance: number;
	readonly ground: FinaleShadowGround;
	readonly blank: THREE.CanvasTexture;
	readonly make: () => PooledSheet;
	readonly pool: PooledSheet[];
	readonly free: PooledSheet[];
	readonly byKey: Map<string, PooledSheet>;
	/** Done cards' prints by code and canvas size. */
	readonly printed: Map<string, PrintedCard>;
	readonly faces: Map<string, FacePrint>;
	/** The title's ink on each face, drawn over its plate with the plate's pose. */
	readonly inks: TitleFaces<SheetMesh>;
	readonly lens: {
		readonly target: THREE.WebGLRenderTarget;
		/** The same sheets in their own chroma and bulge (see `drawMask`). */
		readonly mask: THREE.WebGLRenderTarget;
		readonly scene: THREE.Scene;
		readonly camera: THREE.OrthographicCamera;
		readonly material: THREE.ShaderMaterial;
	};
	title: TitleFaces<TitleInk> | null;
	frame: number;
	/** What the bindings belong to: a resize lays out a new wall. */
	wall: FinaleWall | null;
	cardPrint: PrintLookup | null;
	facePrint: PrintLookup | null;
	/** The last frame drawn, so a held clock does not redraw it. */
	time: number;
	drops: readonly BentoDrop[] | null;
	/** The title card's bento box and its gap, which its lockup goes between. */
	titleDrop: BentoDrop | null;
	/** A drawn sheet still waits for its print. */
	pending: boolean;
	/** Unmounted: a font that loads late must not repaint into it. */
	disposed: boolean;
}

interface FrameInput {
	readonly time: number;
	readonly viewport: FinaleViewport;
	readonly wall: FinaleWall;
	readonly fit: FinaleFit;
	readonly cardPrint: PrintLookup;
	readonly facePrint: PrintLookup;
}

const NO_SHEETS: readonly WallSheet[] = [];
const world = { x: 0, y: 0, z: 0 };
const drawOrder: WallDrawOrder = { sheet: 0, shadow: 0, ink: 0 };
const corner = new THREE.Vector3();
/** The smeared region this frame, frame heights from the centre (y up): x0, y0, x1, y1. */
const smeared = { x0: 0, y0: 0, x1: 0, y1: 0, bulge: false };

function showCanvas(canvas: HTMLCanvasElement, shown: boolean): void {
	const visibility = shown ? "visible" : "hidden";
	if (canvas.style.visibility !== visibility) canvas.style.visibility = visibility;
}

function release(state: WallGlState, held: PooledSheet): void {
	if (held.key !== null) state.byKey.delete(held.key);
	held.key = null;
	held.mesh.visible = false;
	held.shadow.visible = false;
	state.free.push(held);
}

/** Forgets every binding, card print and face when the wall or its prints change. */
function rebind(state: WallGlState, input: FrameInput): void {
	for (const held of [...state.byKey.values()]) release(state, held);
	for (const held of state.pool) {
		held.print = null;
		held.printed = null;
	}
	for (const printed of state.printed.values()) printed.texture.dispose();
	state.printed.clear();
	for (const face of state.faces.values()) face.texture.dispose();
	state.faces.clear();
	state.wall = input.wall;
	state.cardPrint = input.cardPrint;
	state.facePrint = input.facePrint;
	state.time = Number.NaN;
}

function claim(state: WallGlState, sheet: WallSheet, frame: number): PooledSheet {
	const held = state.free.pop() ?? state.make();
	held.key = sheet.key;
	held.seen = frame;
	held.color = null;
	held.back = null;
	held.print = null;
	held.printed = null;
	state.byKey.set(sheet.key, held);
	return held;
}

/** A Done card's print, painted at its sheet's size once it exists (asked again every frame until then). */
function printFor(state: WallGlState, held: PooledSheet, code: string, sheet: WallSheet, input: FrameInput): PrintedCard {
	let printed = held.print === code ? held.printed : null;
	if (!printed) {
		// At the DOM's resolution, so its DOM card paints exactly these pixels; each copy of the wall shares it.
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		const width = Math.max(2, Math.round(sheet.pose.width * ratio));
		const height = Math.max(2, Math.round(sheet.pose.height * ratio));
		const key = `${code}@${width}x${height}`;
		printed = state.printed.get(key) ?? null;
		if (!printed) {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			printed = { code, canvas, texture: textureFrom(canvas), painted: false };
			state.printed.set(key, printed);
		}
		held.print = code;
		held.printed = printed;
	}
	if (!printed.painted) {
		const print = input.cardPrint(code);
		const context = print ? printed.canvas.getContext("2d") : null;
		if (print && context) {
			paintWallPrint(context, printed.canvas.width, printed.canvas.height, print);
			printed.painted = true;
			printed.texture.needsUpdate = true;
		} else {
			state.pending = true;
		}
	}
	return printed;
}

/** A bento card's face, once the scene has printed its tile (asked again every frame until then). */
function faceFor(state: WallGlState, key: string, facePrint: PrintLookup): THREE.Texture | null {
	const print = facePrint(key);
	const known = state.faces.get(key);
	if (!print) {
		state.pending = true;
		return known?.texture ?? null;
	}
	if (known?.canvas === print) return known.texture;
	known?.texture.dispose();
	const texture = textureFrom(print);
	state.faces.set(key, { canvas: print, texture });
	return texture;
}

/**
 * "Team 26" set as `FinaleTeamTitle` sets it, in `ink`, once, at the largest
 * it shows (the bento's title box) and the display's resolution. It is only
 * the ink: the plate is the sheet's own blank face, so its size and corners
 * follow the sheet, and the ink's share of it is set each frame (`drawInk`).
 */
function paintTitleInk(fit: FinaleFit, ink: string): TitleInk | null {
	const em = TITLE_FONT * fit.scale * Math.min(window.devicePixelRatio || 1, 2);
	const family = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim() || "\"Atlassian Sans\", sans-serif";
	const font = `400 ${em.toFixed(2)}px ${family}`;
	const canvas = document.createElement("canvas");
	const set = (context: CanvasRenderingContext2D) => {
		context.font = font;
		context.letterSpacing = `${(TITLE_TRACKING * em).toFixed(3)}px`;
		context.textBaseline = "alphabetic";
	};
	let context = canvas.getContext("2d");
	if (!context) return null;
	set(context);
	const team = context.measureText("Team").width;
	const year = context.measureText("26").width;
	const line = team + TITLE_GAP * em + year;
	canvas.width = Math.ceil(line + TITLE_BLEED * 2 * em);
	canvas.height = Math.ceil((TITLE_LINE + TITLE_BLEED * 2) * em);
	// Sizing the canvas resets its context.
	context = canvas.getContext("2d");
	if (!context) return null;
	set(context);
	context.fillStyle = ink;
	const x = (canvas.width - line) / 2;
	const baseline = (canvas.height - TITLE_LINE * em) / 2 + TITLE_BASELINE * em;
	context.fillText("Team", x, baseline);
	context.fillText("26", x + team + TITLE_GAP * em, baseline);
	return { texture: textureFrom(canvas), width: canvas.width / em, height: canvas.height / em };
}

function paintTitleFaces(fit: FinaleFit): TitleFaces<TitleInk> | null {
	const front = paintTitleInk(fit, FINALE_BRAND.white);
	const back = paintTitleInk(fit, FINALE_INK);
	if (front && back) return { front, back };
	front?.texture.dispose();
	back?.texture.dispose();
	return null;
}

function disposeTitle(title: TitleFaces<TitleInk> | null): void {
	title?.front.texture.dispose();
	title?.back.texture.dispose();
}

/** The title's ink, made on first use; repainted once Atlassian Sans has loaded if it had not. */
function titleInk(state: WallGlState, fit: FinaleFit): TitleFaces<TitleInk> | null {
	if (state.title) return state.title;
	state.title = paintTitleFaces(fit);
	const probe = `400 ${TITLE_FONT}px "Atlassian Sans"`;
	if (state.title && typeof document.fonts?.check === "function" && !document.fonts.check(probe)) {
		void document.fonts.load(probe).then(() => {
			if (state.disposed || !state.title) return;
			disposeTitle(state.title);
			state.title = paintTitleFaces(fit);
			state.time = Number.NaN;
		});
	}
	return state.title;
}

/** The plate's scalar uniforms the ink takes as they are (its vectors are copied). */
const INK_SHARES = ["uAspect", "uSheetHeight", "uLift", "uTime", "uFog", "uOpacity", "uLit", "uRadius"] as const;

/** One face's ink on the plate, at `em` px to its type, drawn at `inkOrder` (`WallDrawOrder.ink`). */
function layInk(ink: SheetMesh, print: TitleInk, plate: SheetMesh, pose: WallSheet["pose"], em: number, inkOrder: number): void {
	ink.position.copy(plate.position);
	ink.quaternion.copy(plate.quaternion);
	ink.scale.copy(plate.scale);
	ink.renderOrder = inkOrder;
	ink.visible = true;
	const from = plate.material.uniforms;
	const to = ink.material.uniforms;
	for (const name of INK_SHARES) to[name].value = from[name].value;
	to.uSize.value.copy(from.uSize.value);
	to.uImpulse.value.copy(from.uImpulse.value);
	to.uCloth.value.copy(from.uCloth.value);
	to.uCard.value = print.texture;
	to.uFace.value = 0;
	to.uCardFit.value.set(Math.min(1, (print.width * em) / pose.width), Math.min(1, (print.height * em) / pose.height));
}

/**
 * The title's ink on both faces of its plate: the plate's pose, wave, cloth
 * and light, so it rides the paper exactly; its type sized as the bento set
 * it at the bento's box and as the wall sets it in the gap, and between the
 * two as the card shrinks from one to the other in flight.
 */
function drawInk(state: WallGlState, plate: SheetMesh, sheet: WallSheet, inkOrder: number, input: FrameInput): void {
	const title = titleInk(state, input.fit);
	const drop = state.titleDrop;
	if (!title || !drop) return;
	const { pose } = sheet;
	const span = drop.from.width - drop.slot.rect.width;
	const along = Math.abs(span) < 1e-3 ? 1 : clamp((drop.from.width - pose.width) / span);
	const em = lerp(TITLE_FONT * input.fit.scale, TITLE_FONT * input.wall.geometry.typeScale, along);
	layInk(state.inks.front, title.front, plate, pose, em, inkOrder);
	layInk(state.inks.back, title.back, plate, pose, em, inkOrder);
}

/** Uploads one face (or the title's ink) not yet on the GPU; false once all are. */
function prefetch(state: WallGlState, drops: readonly BentoDrop[], input: FrameInput): boolean {
	for (const drop of drops) {
		if (drop.kind !== "tile") continue;
		const key = `bento-${drop.order}`;
		const known = state.faces.get(key);
		const texture = faceFor(state, key, input.facePrint);
		if (texture && texture !== known?.texture) {
			state.renderer.initTexture(texture);
			return true;
		}
	}
	if (state.title) return false;
	const title = titleInk(state, input.fit);
	if (title) {
		state.renderer.initTexture(title.front.texture);
		state.renderer.initTexture(title.back.texture);
	}
	return true;
}

/** Where a smeared sheet is on screen (frame heights from the centre, y up), for its share of the lens. */
function spotOf(mesh: SheetMesh, camera: THREE.Camera, aspect: number, target: THREE.Vector4): void {
	mesh.updateMatrix();
	let x0 = Number.POSITIVE_INFINITY;
	let y0 = Number.POSITIVE_INFINITY;
	let x1 = Number.NEGATIVE_INFINITY;
	let y1 = Number.NEGATIVE_INFINITY;
	for (let index = 0; index < 4; index += 1) {
		corner.set(index & 1 ? 0.5 : -0.5, index & 2 ? 0.5 : -0.5, 0).applyMatrix4(mesh.matrix).project(camera);
		const x = corner.x * aspect * 0.5;
		const y = corner.y * 0.5;
		x0 = Math.min(x0, x);
		y0 = Math.min(y0, y);
		x1 = Math.max(x1, x);
		y1 = Math.max(y1, y);
	}
	target.set((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + SPOT_PAD, (y1 - y0) / 2 + SPOT_PAD);
	smeared.x0 = Math.min(smeared.x0, target.x - target.z);
	smeared.y0 = Math.min(smeared.y0, target.y - target.w);
	smeared.x1 = Math.max(smeared.x1, target.x + target.z);
	smeared.y1 = Math.max(smeared.y1, target.y + target.w);
}

/**
 * Draws one sheet exactly as the card field draws a landing tile: posed by
 * its pose, its face, the landing wave from its age, cloth from its motion,
 * its cast shadow on the wall. False when there is nothing to see.
 */
function drawSheet(state: WallGlState, held: PooledSheet, sheet: WallSheet, input: FrameInput): boolean {
	const { time, viewport } = input;
	const { pose } = sheet;
	const { mesh, shadow } = held;
	const depth = state.distance - pose.z;
	const opacity = pose.opacity * lensFade(depth, viewport);
	mesh.visible = opacity > 0.002;
	shadow.visible = false;
	if (!mesh.visible) return false;
	const uniforms = mesh.material.uniforms;
	// The face: a bento card's print, the title's plate (its ink is laid on it),
	// one of a print slot's Done cards; blank until a print exists.
	let texture: THREE.Texture | null = null;
	if (sheet.texture === "title") texture = null;
	else if (sheet.texture) texture = faceFor(state, sheet.texture, input.facePrint);
	else if (sheet.print) {
		const printed = printFor(state, held, sheet.print, sheet, input);
		texture = printed.painted ? printed.texture : null;
	}
	const bound = texture ?? state.blank;
	if (uniforms.uCard.value !== bound) uniforms.uCard.value = bound;
	world.x = pose.x - viewport.width / 2;
	world.y = viewport.height / 2 - pose.y;
	world.z = pose.z;
	// A face fills its sheet, as the DOM card it hands over to fills its slot.
	poseSheet(mesh, pose, world, pose.width / pose.height);
	if (!texture && (sheet.texture || sheet.print)) uniforms.uFace.value = 1;
	if (held.color !== sheet.color || held.back !== sheet.back) {
		held.color = sheet.color;
		held.back = sheet.back;
		rgbUnit(sheet.color, uniforms.uTileColor.value);
		rgbUnit(sheet.back, uniforms.uBackColor.value);
	}
	uniforms.uRadius.value = sheet.radius;
	uniforms.uFog.value = fogAtDepth(depth, viewport);
	uniforms.uOpacity.value = opacity;
	uniforms.uTime.value = time;
	setLandingWave(uniforms, pose);
	setCloth(uniforms.uCloth.value, sheet.velocity, pose.lift * pose.opacity, mesh.rotation);
	if (sheet.shadow) {
		const cast = landingShadowIn(sheet.shadow, time, sheet.shadow.pose, viewport, state.ground, sheet.radius);
		placeShadow(shadow, cast, state.ground, opacity);
	}
	return true;
}

/** A sheet's colour in the lens's mask, by its mesh: its own chroma and bulge (r, g). */
const maskTints = new WeakMap<SheetMesh, THREE.Vector3>();
const maskSaved: { fog: number; fogColor: THREE.Vector3; tint: THREE.Vector3 }[] = [];

function maskTint(mesh: SheetMesh): THREE.Vector3 {
	let tint = maskTints.get(mesh);
	if (!tint) {
		tint = new THREE.Vector3();
		maskTints.set(mesh, tint);
	}
	return tint;
}

/**
 * The scene again into the lens's mask (bound to the target's scissor), each
 * sheet and its shadow in its own chroma and bulge: the sheet's fog at full
 * strength, or the shadow's tint, paints it one colour over exactly its own
 * coverage. So the lens smears each sheet only as far as its own chroma,
 * whatever the sheets in the air beside it, and a landed one not at all: its
 * hand-over to the DOM has no smear to drop. The ink lies on the title's
 * plate, which stands for it.
 */
function drawMask(state: WallGlState): void {
	const { renderer, inks, byKey } = state;
	const front = inks.front.visible;
	const back = inks.back.visible;
	inks.front.visible = false;
	inks.back.visible = false;
	let index = 0;
	for (const { mesh, shadow } of byKey.values()) {
		const sheet = mesh.material.uniforms;
		const cast = shadow.material.uniforms;
		const saved = (maskSaved[index] ??= { fog: 0, fogColor: sheet.uFogColor.value, tint: cast.uTint.value });
		saved.fog = sheet.uFog.value;
		saved.fogColor = sheet.uFogColor.value;
		saved.tint = cast.uTint.value;
		const tint = maskTint(mesh);
		sheet.uFog.value = 1;
		sheet.uFogColor.value = tint;
		cast.uTint.value = tint;
		index += 1;
	}
	renderer.setRenderTarget(state.lens.mask);
	renderer.render(state.scene, state.camera);
	index = 0;
	for (const { mesh, shadow } of byKey.values()) {
		const saved = maskSaved[index];
		mesh.material.uniforms.uFog.value = saved.fog;
		mesh.material.uniforms.uFogColor.value = saved.fogColor;
		shadow.material.uniforms.uTint.value = saved.tint;
		index += 1;
	}
	inks.front.visible = front;
	inks.back.visible = back;
}

/**
 * The smeared sheets through the lens, back over the canvas: the scene again
 * into the lens's target and its mask, only as far round the smeared region
 * as the lens reads, then the lens over that region alone. Its field is 0 at
 * the region's edge, where it gives back exactly what was drawn, so the pass
 * has no seam; nothing runs when no sheet is smeared.
 */
function drawLens(state: WallGlState, spots: number, viewport: FinaleViewport, time: number): void {
	const { renderer, lens } = state;
	const uniforms = lens.material.uniforms;
	uniforms.uSpotCount.value = spots;
	uniforms.uTime.value = time;
	const { width, height } = viewport;
	// Frame heights from the centre (y up) → CSS px from the bottom left, as GL's scissor counts.
	const toX = (x: number) => width / 2 + x * height;
	const toY = (y: number) => height / 2 + y * height;
	const reach = LENS_REACH + 2 / height;
	const x0 = clamp(toX(smeared.x0 - reach), 0, width);
	const y0 = clamp(toY(smeared.y0 - reach), 0, height);
	const x1 = clamp(toX(smeared.x1 + reach), 0, width);
	const y1 = clamp(toY(smeared.y1 + reach), 0, height);
	if (x1 - x0 < 1 || y1 - y0 < 1) return;
	const pull = LENS_PULL + (smeared.bulge ? BULGE_PULL : 0);
	const ratio = renderer.getPixelRatio();
	const { target, mask } = lens;
	const sx0 = Math.floor(Math.max(0, x0 - pull * width) * ratio);
	const sy0 = Math.floor(Math.max(0, y0 - pull * height) * ratio);
	const sx1 = Math.ceil(Math.min(width, x1 + pull * width) * ratio);
	const sy1 = Math.ceil(Math.min(height, y1 + pull * height) * ratio);
	target.scissor.set(sx0, sy0, Math.min(sx1, target.width) - sx0, Math.min(sy1, target.height) - sy0);
	mask.scissor.copy(target.scissor);
	renderer.setRenderTarget(target);
	renderer.render(state.scene, state.camera);
	drawMask(state);
	renderer.setRenderTarget(null);
	renderer.setScissorTest(true);
	renderer.setScissor(Math.floor(x0), Math.floor(y0), Math.ceil(x1) - Math.floor(x0), Math.ceil(y1) - Math.floor(y0));
	renderer.render(lens.scene, lens.camera);
	renderer.setScissorTest(false);
}

interface FinaleWallGlProps {
	readonly wall: FinaleWall;
	readonly drops: readonly BentoDrop[];
	readonly viewport: FinaleViewport;
	readonly fit: FinaleFit;
	/** A Done card's print, by code: the wall's print slots. */
	readonly cardPrint: PrintLookup;
	/** Those prints' shapes: each of a print slot's cards is a sheet of its own, on its print's rect. */
	readonly prints: WallPrintShapes;
	/** A bento tile's print, by key (`bento-<order>`): the faces its cards fly with. */
	readonly facePrint: PrintLookup;
}

/**
 * Act III's paper, in one WebGL layer over the mega bento: the title card
 * from its flip and the bento's tiles from the throw, faces and all, until
 * their DOM faces take over, and each card waiting in the air at the leading
 * edge until it has come down.
 * Sheets are claimed from a warmed pool by key as they come and recycled as
 * they go, so nothing is built mid-act. Filmed by the resting camera, so it
 * shares the DOM's pixel grid; the sheets in the air are filmed through the
 * field's lens. Nothing draws before the curtain call, or while no sheet is out.
 */
export function FinaleWallGl({ wall, drops, viewport, fit, cardPrint, prints, facePrint }: Readonly<FinaleWallGlProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<WallGlState | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
		} catch {
			return undefined;
		}
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
		const ratio = finaleFieldPixelRatio(viewport.width, viewport.height, window.devicePixelRatio);
		renderer.setPixelRatio(ratio);
		renderer.setSize(viewport.width, viewport.height, false);
		renderer.setClearColor(0x000000, 0);
		const scene = new THREE.Scene();
		const distance = cameraDistance(viewport);
		const camera = new THREE.PerspectiveCamera(FINALE_CAMERA_FOV, viewport.width / viewport.height, 10, 20000);
		camera.position.set(0, 0, distance);
		camera.lookAt(0, 0, 0);
		camera.updateMatrixWorld();
		const sheetGeometry = new THREE.PlaneGeometry(1, 1, 48, 32);
		const shadowGeometry = new THREE.PlaneGeometry(1, 1);
		const fogColor = rgbUnit(FINALE_COLORS.slide);
		const blankCanvas = document.createElement("canvas");
		blankCanvas.width = 2;
		blankCanvas.height = 2;
		const blank = textureFrom(blankCanvas);
		const sheetMaterial = () => createSheetMaterial({ texture: blank, radius: 0, tileColor: rgbUnit(FINALE_COLORS.tile), fogColor, viewport, pixelRatio: ratio });
		const pool: PooledSheet[] = [];
		const make = (): PooledSheet => {
			const mesh = new THREE.Mesh(sheetGeometry, sheetMaterial());
			mesh.visible = false;
			const shadow = new THREE.Mesh(shadowGeometry, createShadowMaterial(0));
			shadow.visible = false;
			scene.add(mesh, shadow);
			const held: PooledSheet = { mesh, shadow, key: null, seen: 0, color: null, back: null, print: null, printed: null };
			pool.push(held);
			return held;
		};
		for (let index = 0; index < POOL_START; index += 1) make();
		// Each face's ink prints on that face alone, so neither shows through the other.
		const inkOn = (side: 1 | -1): SheetMesh => {
			const ink = new THREE.Mesh(sheetGeometry, sheetMaterial());
			ink.material.uniforms.uPrintSide.value = side;
			ink.visible = false;
			scene.add(ink);
			return ink;
		};
		const inks: TitleFaces<SheetMesh> = { front: inkOn(1), back: inkOn(-1) };

		const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
		const target = new THREE.WebGLRenderTarget(buffer.x, buffer.y, { samples: 4 });
		// Multisampled as the scene's target, so each sheet's mask has exactly its coverage.
		const mask = new THREE.WebGLRenderTarget(buffer.x, buffer.y, { samples: 4 });
		const lensMaterial = createLensMaterial({ scene: target.texture, mask: mask.texture, aspect: viewport.width / viewport.height, background: fogColor, spots: LENS_SPOTS });
		lensMaterial.uniforms.uSmear.value = LENS_SMEAR;
		lensMaterial.uniforms.uBulge.value = LENS_BULGE;
		lensMaterial.uniforms.uSpotReach.value = LENS_REACH;
		const lensGeometry = new THREE.PlaneGeometry(2, 2);
		const lensScene = new THREE.Scene();
		lensScene.add(new THREE.Mesh(lensGeometry, lensMaterial));
		const lensCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		// Nothing draws until the throw, so without this the throw would pay for
		// the program links, the multisampled target and (ANGLE building a
		// program's pipeline only at its first draw into a target) a blocking
		// first draw of every material on both of the lens's paths. Draw the whole
		// pool once now, a pixel each at the origin, straight to the canvas and
		// through the lens, then clear before this task presents anything.
		for (const held of pool) {
			held.mesh.visible = true;
			held.shadow.visible = true;
		}
		inks.front.visible = true;
		inks.back.visible = true;
		renderer.compile(scene, camera);
		renderer.setRenderTarget(target);
		renderer.compile(scene, camera);
		renderer.setRenderTarget(null);
		renderer.compile(lensScene, lensCamera);
		renderer.initTexture(blank);
		renderer.initRenderTarget(target);
		renderer.initRenderTarget(mask);
		renderer.setRenderTarget(target);
		renderer.render(scene, camera);
		renderer.setRenderTarget(mask);
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		renderer.render(lensScene, lensCamera);
		renderer.render(scene, camera);
		renderer.clear();
		for (const held of pool) {
			held.mesh.visible = false;
			held.shadow.visible = false;
		}
		inks.front.visible = false;
		inks.back.visible = false;
		target.scissorTest = true;
		mask.scissorTest = true;

		const state: WallGlState = {
			renderer,
			scene,
			camera,
			distance,
			ground: slideShadowGround(viewport),
			blank,
			make,
			pool,
			free: [...pool].reverse(),
			byKey: new Map(),
			printed: new Map(),
			faces: new Map(),
			inks,
			lens: { target, mask, scene: lensScene, camera: lensCamera, material: lensMaterial },
			title: null,
			frame: 0,
			wall: null,
			cardPrint: null,
			facePrint: null,
			time: Number.NaN,
			drops: null,
			titleDrop: null,
			pending: false,
			disposed: false,
		};
		stateRef.current = state;
		return () => {
			stateRef.current = null;
			for (const held of pool) {
				held.mesh.material.dispose();
				held.shadow.material.dispose();
			}
			inks.front.material.dispose();
			inks.back.material.dispose();
			for (const printed of state.printed.values()) printed.texture.dispose();
			for (const face of state.faces.values()) face.texture.dispose();
			state.disposed = true;
			disposeTitle(state.title);
			blank.dispose();
			sheetGeometry.dispose();
			shadowGeometry.dispose();
			lensGeometry.dispose();
			lensMaterial.dispose();
			target.dispose();
			mask.dispose();
			renderer.dispose();
		};
	}, [viewport]);

	useFinaleFrame((time) => {
		const state = stateRef.current;
		const canvas = canvasRef.current;
		if (!state || !canvas) return;
		const input: FrameInput = { time, viewport, wall, fit, cardPrint, facePrint };
		if (state.wall !== wall || state.cardPrint !== cardPrint || state.facePrint !== facePrint) rebind(state, input);
		// Before the act only: reduced motion holds its very start, where nothing of it is wanted.
		if (time >= PREFETCH_FROM && time < WALL_CUE.start) prefetch(state, drops, input);
		// A held clock re-emits its frame: it is already on the canvas.
		if (time === state.time && drops === state.drops && !state.pending) return;
		state.time = time;
		if (state.drops !== drops) {
			state.drops = drops;
			state.titleDrop = drops.find((drop) => drop.kind === "title") ?? null;
		}
		state.pending = false;
		// Nothing draws before the curtain call (reduced motion holds the bento's final frame, so it never does).
		const sheets = wallActive(time) ? wallSheetsAt(time, wall, drops, viewport, prints) : NO_SHEETS;

		// Sheets keep their pooled mesh for their whole flight; the ones that have gone are recycled.
		state.frame += 1;
		const frame = state.frame;
		for (const sheet of sheets) {
			const held = state.byKey.get(sheet.key);
			if (held) held.seen = frame;
		}
		for (const held of state.byKey.values()) if (held.seen !== frame) release(state, held);
		state.inks.front.visible = false;
		state.inks.back.visible = false;
		if (sheets.length === 0) {
			showCanvas(canvas, false);
			return;
		}

		const lens = state.lens.material.uniforms;
		const aspect = viewport.width / viewport.height;
		let spots = 0;
		smeared.x0 = Number.POSITIVE_INFINITY;
		smeared.y0 = Number.POSITIVE_INFINITY;
		smeared.x1 = Number.NEGATIVE_INFINITY;
		smeared.y1 = Number.NEGATIVE_INFINITY;
		smeared.bulge = false;
		let anyVisible = false;
		for (let index = 0; index < sheets.length; index += 1) {
			const sheet = sheets[index];
			const held = state.byKey.get(sheet.key) ?? claim(state, sheet, frame);
			if (!drawSheet(state, held, sheet, input)) continue;
			anyVisible = true;
			// Far to near from the lens, each shadow just under its own sheet and over everything farther, as the card field;
			// the title card over them all while it is in the air.
			wallDrawOrder(state.distance - sheet.pose.z, index, wallSheetLifted(sheet, time, drops), drawOrder);
			held.mesh.renderOrder = drawOrder.sheet;
			held.shadow.renderOrder = drawOrder.shadow;
			if (sheet.texture === "title") drawInk(state, held.mesh, sheet, drawOrder.ink, input);
			const smear = lensShare(sheet.chroma, held.mesh.material.uniforms.uOpacity.value);
			// The bulge only films the bento's cards in flight, so the waiting cards hold still.
			const bulge = sheet.kind === "bento" ? smear : 0;
			maskTint(held.mesh).set(smear, bulge, 0);
			if (smear > 0.001 && spots < LENS_SPOTS) {
				spotOf(held.mesh, state.camera, aspect, lens.uSpots.value[spots]);
				lens.uSpotWeights.value[spots].set(smear, bulge);
				if (bulge > 0) smeared.bulge = true;
				spots += 1;
			}
		}
		if (anyVisible) {
			state.renderer.render(state.scene, state.camera);
			if (spots > 0) drawLens(state, spots, viewport, time);
		}
		showCanvas(canvas, anyVisible);
	});

	// Hidden from assistive tech on a wrapper: lint reads a canvas itself as a widget.
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0">
			<canvas ref={canvasRef} className="absolute inset-0 size-full" style={{ visibility: "hidden" }} />
		</div>
	);
}
