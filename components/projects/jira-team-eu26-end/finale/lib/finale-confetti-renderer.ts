/**
 * The GL half of the finale confetti (`finale-confetti.ts` owns the motion).
 * DOM-free, so it runs unchanged in a worker on an OffscreenCanvas (the
 * default: the main thread is busy printing the column while the burst flies)
 * or on the main thread as a fallback.
 *
 * Two draws per frame:
 * - pieces, instanced from one burst: two-sided Rovo paper, thin-film sequins
 *   and satin ribbons, lit by one key light, defocused near the lens and
 *   stretched along their motion. (Depth comes from perspective, focus and
 *   blur; cast shadows read as grey ghosts over a white board and were cut.)
 * - the Done column's border, lit by the bento tiles' own pulsing border: a
 *   band that grows from its foot and is pulled up the column as the burst is
 *   drawn in, ending round the top (see `FINALE_CONFETTI_GLOW_FRAGMENT`).
 */

import * as THREE from "three";

import { FLASH_ROVO_COLORS } from "./finale-column-flash";
import { finaleStageFit } from "./finale-stage-fit";
import { TILE_GLOW, TILE_GLOW_FRAGMENT, TILE_GLOW_VERTEX, tileGlowLook, tileGlowShape, tileGlowUniforms } from "./finale-tile-glow";
import {
	FINALE_CONFETTI_FOV,
	FINALE_CONFETTI_MOTION_GLSL,
	FINALE_CONFETTI_TIMING,
	createFinaleConfettiBurst,
	finaleConfettiCameraDistance,
	finaleConfettiCharge,
	finaleConfettiGlow,
	finaleConfettiTrace,
	packFinaleConfettiBurst,
	type FinaleConfettiBurst,
	type FinaleConfettiColumn,
	type FinaleConfettiStage,
} from "./finale-confetti";

export const FINALE_CONFETTI_LOOK = {
	/** Toward the key light (top left, in front of the page), CSS space. */
	light: [-0.35, -0.55, 1] as const,
	/** Exposure (s) for motion blur: a 180° shutter at ~60fps. */
	shutter: 0.012,
	/** Defocus starts this share of the way to the lens, then grows (px per px of depth)… */
	focus: 0.22,
	focusGain: 0.022,
	/** …and this share of the camera distance behind the page, more gently (far pieces are drawn smaller). */
	farFocus: 0.15,
	farFocusGain: 0.01,
	/** The bento tile whose glow the column's border borrows, at its own weight: the hero's bright one. */
	glowTile: 0,
	/**
	 * Length of the glowing band as a share of the column's height, once it has
	 * grown from the foot: past that its bottom lets go and follows it up.
	 */
	glowBand: 0.35,
} as const;

const ROVO_GLSL = /* glsl */ `
uniform vec3 uRovo[4];

/** The cyclic Rovo gradient: blue → purple → orange → green → blue. */
vec3 rovoFilm(float t) {
	float x = fract(t) * 4.0;
	int i = int(x);
	return mix(uRovo[i], uRovo[(i + 1) % 4], smoothstep(0.0, 1.0, x - float(i)));
}
`;

const PIECE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uRelease;
uniform vec3 uCamera;
uniform float uShutter;
uniform vec4 uFocus;
${FINALE_CONFETTI_MOTION_GLSL}
varying vec2 vLocal;
varying vec2 vExtent;
varying vec3 vNormal;
varying vec3 vView;
varying float vSoft;
varying float vAlpha;
varying float vHeat;
varying vec2 vLook;
varying vec3 vFront;
varying vec3 vBack;
varying float vSeed;

void main() {
	float s = confettiGather(uTime);
	float pull = s * s;
	// Well into the vortex, a piece slims into a thread of light and the exposure
	// lengthens, so the stream reads as light painting; early on it is still confetti.
	float thread = smoothstep(0.25, 0.8, s);
	vec3 center = confettiCenter(uTime);
	vec3 trail = center - confettiCenter(uTime - uShutter * (1.0 + 2.0 * thread));
	float span = aSize.x * pow(1.0 - pull, 0.35);
	float breadth = aSize.y * sqrt(1.0 - pull) * mix(1.0, 0.26, thread);
	// Depth of field: soft near the lens, and (more gently) far behind the page.
	float soft = max(center.z - uFocus.x, 0.0) * uFocus.y + max(-center.z - uFocus.z, 0.0) * uFocus.w;
	float pad = 1.5 + soft;
	float along = position.x * (span + 2.0 * pad);
	float across = position.y * (breadth + 2.0 * pad);
	mat3 turn = confettiTurn(uTime);
	vec3 surfaceNormal;
	vec3 offset = turn * confettiSurface(along, across, span, surfaceNormal);
	// Motion blur: the trailing half is swept back over the exposure.
	float streak = length(trail);
	float behind = streak > 0.5 ? smoothstep(0.3, -0.3, dot(normalize(offset + vec3(0.0001)), trail / streak)) : 0.0;
	vec3 p = center + offset - trail * behind;
	float size = max(span, breadth) + soft;
	// A streak spreads the same paint over more screen; a thread of light keeps its presence.
	float presence = mix(clamp(size / (size + streak), 0.45, 1.0), 0.92, smoothstep(0.1, 0.4, s)) * (1.0 - uRelease);
	// Defocused pieces spread thinner, and distant ones fade a little into the air.
	float distant = smoothstep(uFocus.z, uFocus.z * 5.0, -center.z);
	vAlpha = presence * mix(1.0, 0.65, clamp(soft / 12.0, 0.0, 1.0)) * mix(1.0, 0.7, distant);
	vLocal = vec2(along, across);
	vExtent = vec2(span, breadth) * 0.5;
	vNormal = turn * surfaceNormal;
	vView = uCamera - p;
	vSoft = soft;
	vHeat = smoothstep(0.2, 0.7, s);
	vLook = aLook;
	vFront = aFront;
	vBack = aBack;
	vSeed = aGather.w;
	gl_Position = projectionMatrix * viewMatrix * vec4(p.x, -p.y, p.z, 1.0);
}
`;

const PIECE_FRAGMENT = /* glsl */ `
uniform vec3 uLight;
${ROVO_GLSL}
varying vec2 vLocal;
varying vec2 vExtent;
varying vec3 vNormal;
varying vec3 vView;
varying float vSoft;
varying float vAlpha;
varying float vHeat;
varying vec2 vLook;
varying vec3 vFront;
varying vec3 vBack;
varying float vSeed;

float roundBox(vec2 p, vec2 extent, float radius) {
	vec2 q = abs(p) - extent + radius;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
	bool disc = vLook.x > 0.5 && vLook.x < 1.5;
	// Discs stay elliptical as they slim into threads.
	float d = disc ? (length(vLocal / max(vExtent, vec2(0.001))) - 1.0) * min(vExtent.x, vExtent.y) : roundBox(vLocal, vExtent, min(vExtent.x, vExtent.y) * 0.3);
	float edge = fwidth(d) * 0.75 + vSoft;
	float alpha = (1.0 - smoothstep(-edge, edge, d)) * vAlpha;
	if (alpha < 0.002) discard;
	vec3 n = normalize(vNormal);
	vec3 v = normalize(vView);
	float facing = dot(n, v);
	bool front = facing >= 0.0;
	n *= front ? 1.0 : -1.0;
	vec3 l = normalize(uLight);
	float diffuse = max(dot(n, l), 0.0);
	float gloss = max(dot(n, normalize(l + v)), 0.0);
	vec3 lit;
	vec3 glow = vFront;
	if (vLook.y < 0.5) {
		// Paper: a Rovo hue on each face, matte, so a tumble flickers between them.
		lit = (front ? vFront : vBack * 0.86) * (0.62 + 0.5 * diffuse) + vec3(0.1 * pow(gloss, 20.0));
	} else if (vLook.y < 1.5) {
		// Sequin: a thin film that runs through the Rovo gradient with the view
		// angle, a hard glint, and a darker rim that keeps it legible on white.
		vec3 film = rovoFilm(1.4 * (1.0 - abs(facing)) + 0.25 * dot(n, l) + vSeed);
		lit = film * (0.42 + 0.5 * diffuse) * mix(0.78, 1.0, smoothstep(-2.4, -0.8, d)) + vec3(1.1 * pow(gloss, 56.0));
		glow = film;
	} else {
		// Satin ribbon: a broad sheen along the curl.
		lit = vFront * (0.55 + 0.55 * diffuse) + vec3(0.28 * pow(gloss, 28.0));
	}
	// In the vortex, shading falls away to pure hue: paper turning into light.
	vec3 colour = clamp(mix(lit, glow, vHeat), 0.0, 1.0);
	gl_FragColor = vec4(colour * alpha, alpha);
}
`;

const TILE_GLOW_MAIN = "void main() {";

/**
 * The bento tiles' pulsing border (Paper's; `finale-tile-glow.ts`), unchanged,
 * run round the whole column with its `main` wrapped so only a band of its
 * stroke shows, pulled up the column (`finaleConfettiGlowMask`, mirrored by
 * `finaleConfettiGlowMaskAt`).
 */
export const FINALE_CONFETTI_GLOW_FRAGMENT = `${TILE_GLOW_FRAGMENT.replace(TILE_GLOW_MAIN, "void tileGlow() {")}
// The band, y px (down): its rising top edge (from, fade) and its trailing bottom edge (from, fade).
uniform vec4 uBand;

void main() {
	tileGlow();
	gl_FragColor *= smoothstep(uBand.x, uBand.x + uBand.y, vPoint.y) * (1.0 - smoothstep(uBand.z, uBand.z + uBand.w, vPoint.y));
}
`;

export interface FinaleConfettiGlowMask {
	/** The rising top edge: the stroke is gone above `from` and whole below `from + fade`. */
	readonly lead: { readonly from: number; readonly fade: number };
	/** The trailing bottom edge: whole above `from` and gone below `from + fade`. */
	readonly tail: { readonly from: number; readonly fade: number };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/**
 * Which band of the column's border glows as it is traced up the column
 * (`trace` 0 → 1, `finaleConfettiTrace`), as if the glow were pulled up it. It lights on the foot (the
 * bottom edge, its corners and the start of each side) and grows up both
 * sides; once it is `glowBand` long its bottom lets go and follows, and in the
 * last stretch it is drawn up into the top edge, where it ends round the top
 * corners as the last piece lands.
 */
export function finaleConfettiGlowMask(column: FinaleConfettiColumn, trace: number): FinaleConfettiGlowMask {
	const i = Math.min(1, Math.max(0, trace));
	const fade = Math.min(80, column.height * 0.15);
	const bottom = column.y + column.height;
	const foot = column.radius + 28;
	// Clear of an edge and its bloom.
	const over = fade + 24;
	// Heights above the bottom border.
	const lead = foot + (column.height + over - foot) * i;
	const crown = column.height - foot;
	const trail = Math.min(crown, Math.max(-over, lead - column.height * FINALE_CONFETTI_LOOK.glowBand));
	const tail = trail + (crown - trail) * smoothstep(0.8, 1, i);
	return { lead: { from: bottom - lead - fade, fade }, tail: { from: bottom - tail, fade } };
}

/** The band's opacity at viewport `y` (px, down); mirrors `FINALE_CONFETTI_GLOW_FRAGMENT`. */
export function finaleConfettiGlowMaskAt(mask: FinaleConfettiGlowMask, y: number): number {
	return smoothstep(mask.lead.from, mask.lead.from + mask.lead.fade, y) * (1 - smoothstep(mask.tail.from, mask.tail.from + mask.tail.fade, y));
}

function vector(hex: string): THREE.Vector3 {
	return new THREE.Vector3(...[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255));
}

export interface FinaleConfettiPlayOptions extends FinaleConfettiStage {
	readonly dpr: number;
}

export class FinaleConfettiRenderer {
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera(FINALE_CONFETTI_FOV, 1, 1, 10000);
	private readonly strip = new THREE.PlaneGeometry(1, 1, 12, 1);
	private readonly uniforms = {
		uTime: { value: 0 },
		uRelease: { value: 0 },
		uCamera: { value: new THREE.Vector3() },
		uShutter: { value: FINALE_CONFETTI_LOOK.shutter },
		uFocus: { value: new THREE.Vector4() },
		uLight: { value: new THREE.Vector3(...FINALE_CONFETTI_LOOK.light).normalize() },
		uRovo: { value: FLASH_ROVO_COLORS.map(vector) },
	};
	/** The tile glow's own uniforms (`finale-tile-glow.ts`), plus the band mask. */
	private readonly glowUniforms = {
		uQuad: { value: new THREE.Vector4() },
		uViewport: { value: new THREE.Vector2(1, 1) },
		uRect: { value: new THREE.Vector4() },
		uRadius: { value: 0 },
		uLength: { value: 1 },
		uSpotA: { value: new Float32Array(0) as Float32Array },
		uSpotB: { value: new Float32Array(0) as Float32Array },
		uSpotC: { value: new Float32Array(0) as Float32Array },
		uSpotD: { value: new Float32Array(0) as Float32Array },
		uLook: { value: new THREE.Vector4() },
		uLook2: { value: new THREE.Vector4() },
		uLook3: { value: new THREE.Vector4() },
		uLook4: { value: new THREE.Vector4() },
		uEnvelope: { value: 0 },
		uTime: { value: 0 },
		uScale: { value: 1 },
		uBand: { value: new THREE.Vector4() },
	};
	private readonly pieces: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
	private readonly glow: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
	/** The glow look's bloom length (px), which swells as it hands over to the flash. */
	private glowBloom = 0;
	/** The column the glow climbs. */
	private glowColumn: FinaleConfettiColumn = { x: 0, y: 0, width: 1, height: 1, radius: 0 };
	private burst: FinaleConfettiBurst | null = null;

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas, onFailure: (reason: string) => void) {
		this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "high-performance" });
		this.renderer.setClearColor(0x000000, 0);
		(canvas as EventTarget).addEventListener("webglcontextlost", () => onFailure("context lost"));
		// A driver that rejects a shader would otherwise draw nothing, silently.
		this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
			onFailure([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join("\n"));
		};
		const material = (vertexShader: string, fragmentShader: string) => new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader,
			fragmentShader,
			transparent: true,
			premultipliedAlpha: true,
			depthTest: false,
			depthWrite: false,
			side: THREE.DoubleSide,
		});
		this.pieces = new THREE.Mesh(new THREE.InstancedBufferGeometry(), material(PIECE_VERTEX, PIECE_FRAGMENT));
		// The tile glow's own screen-space quad: its vertex shader maps `aCorner` over `uQuad`.
		const quad = new THREE.BufferGeometry();
		quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
		quad.setAttribute("aCorner", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
		quad.setIndex([0, 1, 2, 2, 1, 3]);
		this.glow = new THREE.Mesh(quad, new THREE.RawShaderMaterial({
			uniforms: this.glowUniforms,
			vertexShader: TILE_GLOW_VERTEX,
			fragmentShader: FINALE_CONFETTI_GLOW_FRAGMENT,
			transparent: true,
			premultipliedAlpha: true,
			depthTest: false,
			depthWrite: false,
			// Its vertex shader flips y into clip space, which winds the quad clockwise.
			side: THREE.DoubleSide,
		}));
		// The border glows on the page, under the pieces landing on it.
		[this.glow, this.pieces].forEach((mesh, order) => {
			// Motion lives in the shaders, so the CPU-side bounds mean nothing.
			mesh.frustumCulled = false;
			mesh.renderOrder = order;
			this.scene.add(mesh);
		});
		// Warm up with one real draw (program link, buffers, attribute layout) so
		// the show never opens on that cost; then leave the canvas transparent.
		this.play({ width: 1, height: 1, dpr: 1, column: { x: 0, y: 0, width: 1, height: 1, radius: 0 } });
		this.render(0, 0);
		this.clear();
	}

	play(options: FinaleConfettiPlayOptions): FinaleConfettiBurst {
		const { width, height, dpr, column } = options;
		this.renderer.setPixelRatio(dpr);
		this.renderer.setSize(width, height, false);
		const distance = finaleConfettiCameraDistance(height);
		this.camera.aspect = width / height;
		this.camera.far = distance * 3;
		this.camera.position.set(width / 2, -height / 2, distance);
		this.camera.lookAt(width / 2, -height / 2, 0);
		this.camera.updateProjectionMatrix();
		this.uniforms.uCamera.value.set(width / 2, height / 2, distance);
		const L = FINALE_CONFETTI_LOOK;
		this.uniforms.uFocus.value.set(distance * L.focus, L.focusGain, distance * L.farFocus, L.farFocusGain);
		this.playGlow(width, height, column);
		const burst = createFinaleConfettiBurst({ width, height, column });
		const geometry = new THREE.InstancedBufferGeometry();
		geometry.index = this.strip.index;
		geometry.setAttribute("position", this.strip.getAttribute("position"));
		for (const [name, { array, itemSize }] of Object.entries(packFinaleConfettiBurst(burst))) {
			geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
		}
		geometry.instanceCount = burst.pieces.length;
		this.pieces.geometry.dispose();
		this.pieces.geometry = geometry;
		for (const mesh of [this.glow, this.pieces]) mesh.visible = true;
		this.burst = burst;
		return burst;
	}

	/** Lay the bento glow round the whole column, at the bento's own stage scale and bright look. */
	private playGlow(width: number, height: number, column: FinaleConfettiColumn): void {
		// The bento's own stage scale: the same hairline stroke, bloom and smoke.
		const scale = finaleStageFit(width, height).scale;
		const look = tileGlowLook(FINALE_CONFETTI_LOOK.glowTile);
		const shared = tileGlowUniforms(look, scale);
		// One stable shape, so the spots orbit it naturally while the mask reveals it.
		const shape = tileGlowShape(column, Math.min(column.radius, column.width / 2, column.height / 2), scale, look.lineWidth);
		const pad = TILE_GLOW.pad * scale;
		const g = this.glowUniforms;
		g.uQuad.value.set(column.x - pad, column.y - pad, column.width + pad * 2, column.height + pad * 2);
		g.uViewport.value.set(width, height);
		g.uRect.value.set(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
		g.uRadius.value = shape.radius;
		g.uLength.value = shape.length;
		g.uSpotA.value = shared.spotA;
		g.uSpotB.value = shared.spotB;
		g.uSpotC.value = shared.spotC;
		g.uSpotD.value = shared.spotD;
		g.uLook.value.set(...shared.look);
		g.uLook2.value.set(...shared.look2);
		g.uLook3.value.set(...shared.look3);
		g.uLook4.value.set(...shared.look4);
		g.uScale.value = scale;
		this.glowBloom = shared.look[1];
		this.glowColumn = column;
	}

	/** One frame: `time` in seconds since launch; `release` 0 → 1 as the glow hands over to the flash. */
	render(time: number, release: number): void {
		if (!this.burst) return;
		this.uniforms.uTime.value = time;
		this.uniforms.uRelease.value = release;
		// The border lights as the vortex opens, is pulled steadily up the column
		// through the pull, brightens as the pieces land, and blooms into the flash as it goes.
		const g = this.glowUniforms;
		g.uTime.value = time;
		const mask = finaleConfettiGlowMask(this.glowColumn, finaleConfettiTrace(time));
		g.uBand.value.set(mask.lead.from, mask.lead.fade, mask.tail.from, mask.tail.fade);
		g.uEnvelope.value = finaleConfettiGlow(time, finaleConfettiCharge(this.burst, time)) * (1 - release) * (1 - release);
		g.uLook.value.y = this.glowBloom * (1 + 3 * release);
		this.renderer.render(this.scene, this.camera);
	}

	/** Leave a transparent canvas and give its buffers back until the next show. */
	clear(): void {
		this.burst = null;
		for (const mesh of [this.glow, this.pieces]) mesh.visible = false;
		this.renderer.setSize(1, 1, false);
		this.renderer.clear();
	}

	dispose(): void {
		this.clear();
		this.pieces.geometry.dispose();
		this.strip.dispose();
		this.glow.geometry.dispose();
		for (const mesh of [this.glow, this.pieces]) mesh.material.dispose();
		this.renderer.dispose();
	}
}

export type FinaleConfettiCommand =
	| { readonly type: "init"; readonly canvas: HTMLCanvasElement | OffscreenCanvas }
	| ({ readonly type: "play"; readonly id: number } & FinaleConfettiPlayOptions)
	| { readonly type: "release" | "cancel"; readonly id: number }
	/** Rehearsal: freeze on an exact second of the show, or resume from it with `null`. */
	| { readonly type: "hold"; readonly id: number; readonly time: number | null }
	| { readonly type: "dispose" };

export type FinaleConfettiEvent =
	| { readonly type: "gathered" | "done"; readonly id: number }
	| { readonly type: "failed"; readonly reason: string };

interface PlayerShow {
	readonly id: number;
	/** Set on the first delivered frame, so first-draw costs never eat into the launch. */
	startedAt: number | null;
	releasedAt: number | null;
	held: number | null;
	gathered: boolean;
}

/**
 * The show's own frame loop, identical in a worker and on the main thread.
 * Reports `gathered` once every piece has landed on the border and `done` once the
 * canvas is transparent again (after a release, a cancel or a failure).
 */
/** What the player needs from a renderer (injectable, so the loop is testable without GL). */
export type FinaleConfettiSurface = Pick<FinaleConfettiRenderer, "play" | "render" | "clear" | "dispose">;

interface FinaleConfettiPlayerOptions {
	readonly now?: () => number;
	readonly createRenderer?: (canvas: HTMLCanvasElement | OffscreenCanvas, onFailure: (reason: string) => void) => FinaleConfettiSurface;
}

export function createFinaleConfettiPlayer(emit: (event: FinaleConfettiEvent) => void, options: FinaleConfettiPlayerOptions = {}) {
	const { now = () => performance.now(), createRenderer = (canvas, onFailure) => new FinaleConfettiRenderer(canvas, onFailure) } = options;
	let renderer: FinaleConfettiSurface | null = null;
	let show: PlayerShow | null = null;
	let frame: number | null = null;
	const schedule = (callback: () => void) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : setTimeout(callback, 16) as unknown as number;
	const unschedule = (handle: number) => typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(handle) : clearTimeout(handle);
	const fail = (reason: string) => {
		if (frame !== null) unschedule(frame);
		frame = null;
		show = null;
		renderer = null;
		emit({ type: "failed", reason });
	};
	const finish = () => {
		if (frame !== null) unschedule(frame);
		frame = null;
		if (!show) return;
		// Only a live show has a canvas to clear; clearing an idle one would
		// reallocate its buffers twice on the way into the next play.
		renderer?.clear();
		emit({ type: "done", id: show.id });
		show = null;
	};
	const tick = () => {
		frame = null;
		if (!show || !renderer) return;
		const at = now();
		show.startedAt ??= at;
		const time = show.held ?? (at - show.startedAt) / 1000;
		if (!show.gathered && time >= FINALE_CONFETTI_TIMING.gathered) {
			show.gathered = true;
			emit({ type: "gathered", id: show.id });
		}
		const release = show.releasedAt === null ? 0 : Math.min(1, (at - show.releasedAt) / 1000 / FINALE_CONFETTI_TIMING.release);
		renderer.render(time, release);
		if (release >= 1) finish();
		else frame = schedule(tick);
	};
	return {
		handle(command: FinaleConfettiCommand): void {
			try {
				if (command.type === "init") {
					// A failure during construction (its warm-up draw) must not be undone by the assignment.
					let failed = false;
					const created = createRenderer(command.canvas, (reason) => {
						failed = true;
						fail(reason);
					});
					if (!failed) renderer = created;
					return;
				}
				if (command.type === "dispose") {
					finish();
					renderer?.dispose();
					renderer = null;
					return;
				}
				if (!renderer) {
					fail("no renderer");
					return;
				}
				if (command.type === "play") {
					finish();
					renderer.play(command);
					// Draw frame 0 (every piece still below the viewport) to size the
					// canvas and upload the burst; the clock starts on the next frame.
					renderer.render(0, 0);
					show = { id: command.id, startedAt: null, releasedAt: null, held: null, gathered: false };
					frame = schedule(tick);
					return;
				}
				if (!show || show.id !== command.id) return;
				if (command.type === "cancel") finish();
				else if (command.type === "release") show.releasedAt ??= now();
				else if (command.type === "hold") {
					if (command.time === null && show.held !== null) show.startedAt = now() - show.held * 1000;
					show.held = command.time;
					// Render now: a hidden page may never deliver the pending frame.
					if (frame !== null) unschedule(frame);
					tick();
				}
			} catch (error) {
				// A missing or lost GL context must never hold the finale.
				fail(String(error));
			}
		},
	};
}
