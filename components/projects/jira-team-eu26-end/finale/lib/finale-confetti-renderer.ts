/**
 * The GL half of the finale confetti (`finale-confetti.ts` owns the motion).
 * DOM-free, so it runs unchanged in a worker on an OffscreenCanvas (the
 * default: the main thread is busy printing the column while the burst flies)
 * or on the main thread as a fallback.
 *
 * One pass per frame draws:
 * - pieces, instanced per burst: two-sided Rovo paper, thin-film sequins
 *   and satin ribbons, lit by one key light, defocused near the lens and
 *   stretched along their motion. (Depth comes from perspective, focus and
 *   blur; cast shadows read as grey ghosts over a white board and were cut.)
 *   The board's small bursts stack, each on its own clock, over the finale's.
 * - the Done column's border, lit by the bento tiles' own pulsing border: it
 *   pulses in on the top of both sides, then is traced down them as the burst
 *   is drawn in, meeting along the foot (see `FINALE_CONFETTI_GLOW_FRAGMENT`).
 */

import * as THREE from "three";

import { FLASH_COLOR_GLSL, FLASH_ROVO_COLORS } from "./finale-column-flash";
import { finaleStageFit } from "./finale-stage-fit";
import { TILE_GLOW, TILE_GLOW_FRAGMENT, TILE_GLOW_VERTEX, perimeterParam, tileGlowLook, tileGlowShape, tileGlowUniforms, type TileGlowShape } from "./finale-tile-glow";
import {
	FINALE_CONFETTI_FOV,
	FINALE_CONFETTI_MOTION_GLSL,
	FINALE_CONFETTI_SEED,
	FINALE_CONFETTI_TIMING,
	SMALL_CONFETTI_TIMING,
	createFinaleConfettiBurst,
	finaleConfettiCameraDistance,
	finaleConfettiCharge,
	finaleConfettiGlow,
	finaleConfettiRandom,
	finaleConfettiRealTime,
	finaleConfettiShowTime,
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
	/** How far down each side the glow pulses in, as a share of the column's height, before it is traced. */
	glowCrown: 0.12,
	/**
	 * Length of the glowing band as a share of the column's height, once it has
	 * stretched from the crown: from then its tail follows it down at its pace.
	 */
	glowBand: 0.35,
	/** The tail's pace, as a share of the lead's, while the band stretches from the crown. */
	glowStretch: 0.5,
	/**
	 * Share of the trace by which the two leads meet in the foot's middle, so
	 * the whole foot burns, joined, for the rest of the pull before the flash
	 * (a beat of the rush: `FINALE_CONFETTI_PACE`).
	 */
	glowMeet: 0.65,
	/**
	 * How much stronger the glow burns once it has rounded onto the foot, at
	 * full (`FinaleConfettiGlowMask.foot`), at its own width: its brightness
	 * gain grows by `gain` and the dim floor between its spots rises by
	 * `floor`, so the whole foot burns, a touch above the crown's glow.
	 */
	glowFoot: { gain: 0.35, floor: 0.15 },
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
	// Fresh out of the cannon, a long exposure streaks each piece back along its
	// own path to its corner, so the first frames read as a burst out of both
	// corners; it decays over the piece's first ~70ms of flight.
	float launch = exp(-max(uTime - aOrigin.w, 0.0) / 0.07);
	vec3 center = confettiCenter(uTime);
	vec3 trail = center - confettiCenter(uTime - uShutter * (1.0 + 2.0 * thread + 5.0 * launch));
	float span = aSize.x * pow(1.0 - pull, 0.35);
	float breadth = aSize.y * sqrt(1.0 - pull) * mix(1.0, 0.26, thread) * mix(1.0, 0.6, launch);
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
	// A streak spreads the same paint over more screen; launch rays and threads of light keep their presence.
	float physical = mix(clamp(size / (size + streak), 0.45, 1.0), 0.8, launch);
	float presence = mix(physical, 0.92, smoothstep(0.1, 0.4, s)) * (1.0 - uRelease);
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
 * The foot's colours: the flash's Rovo cycle from blue (0) through purple and
 * orange to green (0.75), the four once each, never cycling back to blue. Each
 * holds its own stretch; neighbours blend over the middle `FOOT_BLEND` of the
 * way between them, so no in-between hue (purple into orange reads red) lingers.
 */
/** A GLSL float literal. */
const f = (value: number) => value.toFixed(4);

const FOOT_HUES = 0.75;
const FOOT_BLEND = 0.5;

/**
 * How brightly the band burns evenly under its orbiting spots, as a share of
 * a spot's peak: down the sides, so the trace reads wherever the spots are,
 * and on the foot, a touch stronger.
 */
const SIDE_EVEN = 0.7;
const FOOT_EVEN = 0.5;

/**
 * The bento tiles' pulsing border (Paper's; `finale-tile-glow.ts`), unchanged,
 * run round the whole column with its `main` wrapped so only a stretch of its
 * stroke shows, traced down both sides (`finaleConfettiGlowMask`, mirrored by
 * `finaleConfettiGlowMaskAt`).
 */
export const FINALE_CONFETTI_GLOW_FRAGMENT = `${TILE_GLOW_FRAGMENT.replace(TILE_GLOW_MAIN, "void tileGlow() {")}
${FLASH_COLOR_GLSL}
// The band, px along the border from the top edge's centre, down either side:
// its tail (from, fade) and its lead (from, fade).
uniform vec4 uBand;
// How far it has rounded onto the foot (0 to 1), and how far round the border (px)
// either side of the foot's middle its colours span (finaleConfettiFootSpan).
uniform vec2 uFoot;

void main() {
	tileGlow();
	vec4 glow = gl_FragColor;
	vec2 l = vPoint - uRect.xy - 0.5 * uRect.zw;
	vec2 h = 0.5 * uRect.zw - uRadius;
	float s = perimeterParam(l, h, uRadius) * uLength;
	// Mirrored about the top edge's centre (s = h.x), so both sides trace together.
	float along = abs(s - h.x);
	along = min(along, uLength - along);
	float band = smoothstep(uBand.x, uBand.x + uBand.y, along) * (1.0 - smoothstep(uBand.z, uBand.z + uBand.w, along));
	// On the foot it takes the flash's four Rovo colours, once each, left to right
	// (finaleConfettiFootHue), at its own pulsing brightness; white-hot cores stay white.
	float fromMiddle = (0.5 * uLength - along) * sign(l.x);
	float k = 3.0 * clamp(0.5 + 0.5 * fromMiddle / uFoot.y, 0.0, 1.0);
	float seg = min(floor(k), 2.0);
	vec3 rovo = flashColor((seg + smoothstep(${f((1 - FOOT_BLEND) / 2)}, ${f((1 + FOOT_BLEND) / 2)}, k - seg)) * ${f(FOOT_HUES / 3)});
	vec3 rgb = glow.rgb / max(glow.a, 0.0001);
	float whiteHot = smoothstep(0.6, 0.95, min(rgb.r, min(rgb.g, rgb.b)));
	glow.rgb = mix(glow.rgb, mix(rovo, vec3(1.0), whiteHot) * glow.a, uFoot.x);
	// Under its orbiting spots the band also burns evenly, line and halo, beating with the
	// glow's heart, so the trace reads all the way down wherever the spots are, and the two
	// sides join with no dim gap. Down the sides it takes the foot's end colours.
	vec2 q = abs(l) - h;
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
	float across = d / (0.6 * uLook.x);
	float line = exp(-across * across);
	float halo = exp(-abs(d) / (uScale * 0.8 + 0.8 * uLook.y));
	halo *= mix(${f(TILE_GLOW.innerBloom)}, 1.0, smoothstep(-2.0 * uLook.x, 0.0, d));
	halo *= 1.0 - smoothstep(0.5, 0.9, abs(d) / (${f(TILE_GLOW.pad)} * uScale));
	float heart = mix(${f(SIDE_EVEN)}, ${f(FOOT_EVEN)}, uFoot.x) * (0.8 + 0.2 * beat(uLook3.z * uTime + uLook3.w));
	float even = uEnvelope * uLook2.w * heart * (line + ${f(TILE_GLOW.bloomOpacity)} * halo * (1.0 - line));
	glow += vec4(rovo, 1.0) * clamp(even, 0.0, 1.0) * (1.0 - glow.a);
	gl_FragColor = glow * band;
}
`;

export interface FinaleConfettiGlowMask {
	/** The band's tail: the stroke is gone before `from` and whole past `from + fade`. */
	readonly tail: { readonly from: number; readonly fade: number };
	/** The band's lead: whole before `from` and gone past `from + fade`. */
	readonly lead: { readonly from: number; readonly fade: number };
	/** How far the lead has rounded onto the foot (0 → 1): from the bottom corners to the two meeting. */
	readonly foot: number;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/**
 * How far along the border (px) `point` sits from the top edge's centre, down
 * either side: 0 there, `shape.length / 2` at the bottom edge's centre.
 * Mirrors `along` in `FINALE_CONFETTI_GLOW_FRAGMENT`.
 */
function alongBorder(shape: TileGlowShape, point: { readonly x: number; readonly y: number }): number {
	const offset = Math.abs(perimeterParam(point, shape) * shape.length - (shape.rect.width / 2 - shape.radius));
	return Math.min(offset, shape.length - offset);
}

/**
 * Which stretch of the column's border glows as it is traced down the column
 * (`trace` 0 → 1, `finaleConfettiTrace`), as if the pieces pulled the glow
 * down with them. It glows in on the top of both sides (`glowCrown`, rising
 * through the top corners, never onto the top edge), and the moment it sets
 * off both ends travel: the tail slower, until the band is `glowBand` long,
 * then at the lead's pace, so the top never lingers. It rounds the bottom
 * corners and runs in along the bottom edge, the two meeting in its middle
 * (`glowMeet`) before the last piece lands: the whole foot glows, strengthening as
 * the lead rounds onto it (`foot`), where the flash then floods up from.
 */
export function finaleConfettiGlowMask(shape: TileGlowShape, trace: number): FinaleConfettiGlowMask {
	const i = Math.min(1, Math.max(0, trace));
	const { glowBand, glowCrown, glowMeet, glowStretch } = FINALE_CONFETTI_LOOK;
	const { height } = shape.rect;
	const corner = (Math.PI * shape.radius) / 2;
	const fade = Math.max(1, Math.min(80, height * 0.15));
	// Distances along the border from the top edge's centre: the top of each side…
	const side = shape.rect.width / 2 - shape.radius + corner;
	// …and how far down it the glow pulses in.
	const crown = side + Math.max(28, height * glowCrown);
	const foot = side + height - 2 * shape.radius - 28;
	// The two leads meet in the foot's middle at `glowMeet`, then run on past it (it stays whole).
	const lead = crown + ((shape.length / 2 - crown) * i) / glowMeet;
	const trail = Math.min(foot, Math.max(side + (lead - crown) * glowStretch, lead - height * glowBand));
	const tail = trail + (foot - trail) * smoothstep(0.8, 1, i);
	// It fades in round the top corner; the fade lengthens as the tail leaves, so the top edge never lights.
	const tailFade = Math.max(1, Math.min(fade, corner + tail - side));
	// From the lead's fade meeting the bottom corners to the two leads meeting.
	const bottomCorner = side + height - 2 * shape.radius;
	return { tail: { from: tail - tailFade, fade: tailFade }, lead: { from: lead, fade }, foot: smoothstep(bottomCorner - fade, shape.length / 2, lead) };
}

/**
 * How far round the border (px), either side of the foot's middle, the foot
 * glows once the trace ends: its four colours span exactly that stretch.
 */
export function finaleConfettiFootSpan(shape: TileGlowShape): number {
	return Math.max(1, shape.length / 2 - finaleConfettiGlowMask(shape, 1).tail.from);
}

/**
 * Where `point` on the border falls in the flash's Rovo cycle on the foot
 * (`flashColor`): blue (0) up the left side of the foot's glow, purple (0.25)
 * and orange (0.5) along the bottom, green (0.75) up the right, each holding
 * its own stretch (`FOOT_BLEND`).
 * Mirrors `rovo` in `FINALE_CONFETTI_GLOW_FRAGMENT`.
 */
export function finaleConfettiFootHue(shape: TileGlowShape, point: { readonly x: number; readonly y: number }): number {
	const fromMiddle = (shape.length / 2 - alongBorder(shape, point)) * Math.sign(point.x - (shape.rect.x + shape.rect.width / 2));
	const k = 3 * Math.min(1, Math.max(0, 0.5 + (0.5 * fromMiddle) / finaleConfettiFootSpan(shape)));
	const seg = Math.min(Math.floor(k), 2);
	return (seg + smoothstep((1 - FOOT_BLEND) / 2, (1 + FOOT_BLEND) / 2, k - seg)) * (FOOT_HUES / 3);
}

/** The band's opacity at viewport `point` (px) on `shape`; mirrors `FINALE_CONFETTI_GLOW_FRAGMENT`. */
export function finaleConfettiGlowMaskAt(mask: FinaleConfettiGlowMask, shape: TileGlowShape, point: { readonly x: number; readonly y: number }): number {
	const along = alongBorder(shape, point);
	return smoothstep(mask.tail.from, mask.tail.from + mask.tail.fade, along) * (1 - smoothstep(mask.lead.from, mask.lead.from + mask.lead.fade, along));
}

function vector(hex: string): THREE.Vector3 {
	return new THREE.Vector3(...[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255));
}

export interface FinaleConfettiPlayOptions extends FinaleConfettiStage {
	readonly dpr: number;
}

/** Where one show is on this frame: `time` in its own seconds since launch, `release` 0 → 1 as it goes. */
export interface FinaleConfettiPose {
	readonly id: number;
	readonly time: number;
	readonly release: number;
}

type PiecesMesh = THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

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
		uFoot: { value: new THREE.Vector2() },
	};
	/** The finale's burst: one at a time, under its column glow. */
	private readonly pieces: PiecesMesh;
	/**
	 * The board's small bursts in flight, by show: each its own mesh and clock
	 * (sharing the camera and look), so a drop's burst joins the last one's
	 * pieces instead of replacing them. Spent meshes wait in `idleSprays`.
	 */
	private readonly sprays = new Map<number, PiecesMesh>();
	private readonly idleSprays: PiecesMesh[] = [];
	private readonly glow: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
	/** The glow's own look, which strengthens on the foot and blooms as it hands over to the flash. */
	private glowLook = { bloom: 0, floor: 0, gain: 0 };
	/** The column's border the glow is traced round. */
	private glowShape: TileGlowShape = tileGlowShape({ x: 0, y: 0, width: 1, height: 1 }, 0, 1, 0);
	private large: { readonly id: number; readonly burst: FinaleConfettiBurst } | null = null;
	private size = { width: 0, height: 0, dpr: 0 };

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas, onFailure: (reason: string) => void) {
		this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "high-performance" });
		this.renderer.setClearColor(0x000000, 0);
		(canvas as EventTarget).addEventListener("webglcontextlost", () => onFailure("context lost"));
		// A driver that rejects a shader would otherwise draw nothing, silently.
		this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
			onFailure([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join("\n"));
		};
		this.pieces = this.createPieces(this.uniforms);
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
		this.play({ id: 0, width: 1, height: 1, dpr: 1, column: { x: 0, y: 0, width: 1, height: 1, radius: 0 } });
		this.render([{ id: 0, time: 0, release: 0 }]);
		this.clear();
	}

	/** Instanced pieces on `uniforms`; every material shares one program, so a new spray compiles nothing. */
	private createPieces(uniforms: typeof this.uniforms): PiecesMesh {
		const mesh = new THREE.Mesh(new THREE.InstancedBufferGeometry(), new THREE.ShaderMaterial({
			uniforms,
			vertexShader: PIECE_VERTEX,
			fragmentShader: PIECE_FRAGMENT,
			transparent: true,
			premultipliedAlpha: true,
			depthTest: false,
			depthWrite: false,
			side: THREE.DoubleSide,
		}));
		// Motion lives in the shaders, so the CPU-side bounds mean nothing.
		mesh.frustumCulled = false;
		return mesh;
	}

	/** A pooled mesh for a small burst: the shared camera and look, its own clock. */
	private claimSpray(): PiecesMesh {
		const idle = this.idleSprays.pop();
		if (idle) return idle;
		const mesh = this.createPieces({ ...this.uniforms, uTime: { value: 0 }, uRelease: { value: 0 } });
		mesh.renderOrder = this.pieces.renderOrder;
		mesh.visible = false;
		this.scene.add(mesh);
		return mesh;
	}

	/**
	 * Size the drawing buffer, only when it changes: a resized OffscreenCanvas
	 * presents through a new compositor surface, which only a main-thread
	 * commit can embed, and the main thread is busiest just as a show begins.
	 */
	resize(width: number, height: number, dpr: number): void {
		const size = this.size;
		if (size.width === width && size.height === height && size.dpr === dpr) return;
		this.size = { width, height, dpr };
		this.renderer.setPixelRatio(dpr);
		this.renderer.setSize(width, height, false);
	}

	/** Launch show `id`: the finale's burst replaces any other of its own; a small one joins those in flight. */
	play(options: FinaleConfettiPlayOptions & { readonly id: number }): FinaleConfettiBurst {
		const { id, width, height, dpr, column } = options;
		const small = options.size === "small";
		this.resize(width, height, dpr);
		const distance = finaleConfettiCameraDistance(height);
		this.camera.aspect = width / height;
		this.camera.far = distance * 3;
		this.camera.position.set(width / 2, -height / 2, distance);
		this.camera.lookAt(width / 2, -height / 2, 0);
		this.camera.updateProjectionMatrix();
		this.uniforms.uCamera.value.set(width / 2, height / 2, distance);
		const L = FINALE_CONFETTI_LOOK;
		this.uniforms.uFocus.value.set(distance * L.focus, L.focusGain, distance * L.farFocus, L.farFocusGain);
		// Each small burst is drawn afresh, so one landing on another's tail never echoes it.
		const burst = small ? createFinaleConfettiBurst(options, finaleConfettiRandom(FINALE_CONFETTI_SEED + id)) : createFinaleConfettiBurst(options);
		const geometry = new THREE.InstancedBufferGeometry();
		geometry.index = this.strip.index;
		geometry.setAttribute("position", this.strip.getAttribute("position"));
		for (const [name, { array, itemSize }] of Object.entries(packFinaleConfettiBurst(burst))) {
			geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
		}
		geometry.instanceCount = burst.pieces.length;
		const mesh = small ? this.claimSpray() : this.pieces;
		mesh.geometry.dispose();
		mesh.geometry = geometry;
		mesh.visible = true;
		if (small) this.sprays.set(id, mesh);
		else {
			this.playGlow(width, height, column);
			this.glow.visible = true;
			this.large = { id, burst };
		}
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
		g.uFoot.value.set(0, finaleConfettiFootSpan(shape));
		const [, bloom, floor] = shared.look;
		const [, , gain] = shared.look2;
		this.glowLook = { bloom, floor, gain };
		this.glowShape = shape;
	}

	/** One frame of every show in flight, drawn in one pass. */
	render(poses: readonly FinaleConfettiPose[]): void {
		let drawn = false;
		for (const { id, time, release } of poses) {
			if (this.large?.id === id) this.poseLarge(this.large.burst, time, release);
			else {
				const spray = this.sprays.get(id);
				if (!spray) continue;
				spray.material.uniforms.uTime.value = time;
				spray.material.uniforms.uRelease.value = release;
			}
			drawn = true;
		}
		if (drawn) this.renderer.render(this.scene, this.camera);
	}

	/** The finale's burst at `time`; `release` 0 → 1 as the glow hands over to the flash. */
	private poseLarge(burst: FinaleConfettiBurst, time: number, release: number): void {
		this.uniforms.uTime.value = time;
		this.uniforms.uRelease.value = release;
		// The border pulses in as the vortex opens, is traced steadily down the column
		// through the pull, burns stronger on the foot as the pieces land, and blooms into the flash as it goes.
		const g = this.glowUniforms;
		g.uTime.value = time;
		const mask = finaleConfettiGlowMask(this.glowShape, finaleConfettiTrace(time));
		g.uBand.value.set(mask.tail.from, mask.tail.fade, mask.lead.from, mask.lead.fade);
		g.uEnvelope.value = finaleConfettiGlow(time, finaleConfettiCharge(burst, time)) * (1 - release) * (1 - release);
		const look = this.glowLook;
		const foot = FINALE_CONFETTI_LOOK.glowFoot;
		g.uLook.value.y = look.bloom * (1 + 3 * release);
		g.uLook.value.z = look.floor + foot.floor * mask.foot;
		g.uLook2.value.z = look.gain * (1 + foot.gain * mask.foot);
		g.uFoot.value.x = mask.foot;
	}

	/**
	 * Take show `id` off (every show without one). Once none is left, leave a
	 * transparent canvas at its size, so the next show draws straight into the
	 * surface the page already embeds (the parked buffer is the price).
	 */
	clear(id?: number): void {
		if (id === undefined || this.large?.id === id) {
			this.large = null;
			for (const mesh of [this.glow, this.pieces]) mesh.visible = false;
		}
		for (const [key, spray] of this.sprays) {
			if (id !== undefined && key !== id) continue;
			spray.visible = false;
			spray.geometry.dispose();
			this.sprays.delete(key);
			this.idleSprays.push(spray);
		}
		if (!this.large && this.sprays.size === 0) this.renderer.clear();
	}

	dispose(): void {
		this.clear();
		this.pieces.geometry.dispose();
		this.strip.dispose();
		this.glow.geometry.dispose();
		for (const mesh of [this.glow, this.pieces, ...this.idleSprays]) mesh.material.dispose();
		this.renderer.dispose();
	}
}

export type FinaleConfettiCommand =
	| { readonly type: "init"; readonly canvas: HTMLCanvasElement | OffscreenCanvas }
	/** Between shows: hold a transparent canvas at the viewport's size, ready to draw into. */
	| { readonly type: "park"; readonly width: number; readonly height: number; readonly dpr: number }
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
	readonly size: NonNullable<FinaleConfettiStage["size"]>;
	/** Set on the first delivered frame, so first-draw costs never eat into the launch. */
	startedAt: number | null;
	releasedAt: number | null;
	held: number | null;
	gathered: boolean;
}

/** What the player needs from a renderer (injectable, so the loop is testable without GL). */
export type FinaleConfettiSurface = Pick<FinaleConfettiRenderer, "resize" | "play" | "render" | "clear" | "dispose">;

interface FinaleConfettiPlayerOptions {
	readonly now?: () => number;
	readonly createRenderer?: (canvas: HTMLCanvasElement | OffscreenCanvas, onFailure: (reason: string) => void) => FinaleConfettiSurface;
}

/**
 * The shows' own frame loop, identical in a worker and on the main thread.
 * Small bursts stack, each on its own clock, over at most one finale burst.
 * Reports `gathered` once every piece of the finale's has landed on the
 * border, and `done` for each show once it is off the canvas (after a
 * release, a fade, a cancel or a failure).
 */
export function createFinaleConfettiPlayer(emit: (event: FinaleConfettiEvent) => void, options: FinaleConfettiPlayerOptions = {}) {
	const { now = () => performance.now(), createRenderer = (canvas, onFailure) => new FinaleConfettiRenderer(canvas, onFailure) } = options;
	let renderer: FinaleConfettiSurface | null = null;
	/** Every show in flight, oldest first. */
	const shows = new Map<number, PlayerShow>();
	let frame: number | null = null;
	const schedule = (callback: () => void) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : setTimeout(callback, 16) as unknown as number;
	const unschedule = (handle: number) => typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(handle) : clearTimeout(handle);
	const stop = () => {
		if (frame !== null) unschedule(frame);
		frame = null;
	};
	const fail = (reason: string) => {
		stop();
		shows.clear();
		renderer = null;
		emit({ type: "failed", reason });
	};
	const finish = (show: PlayerShow) => {
		if (!shows.delete(show.id)) return;
		renderer?.clear(show.id);
		emit({ type: "done", id: show.id });
		if (shows.size === 0) stop();
	};
	const finishAll = () => {
		for (const show of [...shows.values()]) finish(show);
	};
	/** Where `show` is at `at`; one whose clock has not started is on frame 0. */
	const poseOf = (show: PlayerShow, at: number): FinaleConfettiPose => {
		const elapsed = show.startedAt === null ? 0 : (at - show.startedAt) / 1000;
		const time = show.held ?? (show.size === "small" ? elapsed : finaleConfettiShowTime(elapsed));
		const requested = show.releasedAt === null ? 0 : Math.min(1, (at - show.releasedAt) / 1000 / FINALE_CONFETTI_TIMING.release);
		const fade = show.size === "small" ? Math.max(0, Math.min(1, (time - SMALL_CONFETTI_TIMING.fadeStart) / SMALL_CONFETTI_TIMING.fade)) : 0;
		return { id: show.id, time, release: Math.max(requested, fade) };
	};
	const tick = () => {
		frame = null;
		if (shows.size === 0 || !renderer) return;
		const at = now();
		const poses = [...shows.values()].map((show) => {
			show.startedAt ??= at;
			const pose = poseOf(show, at);
			if (show.size === "large" && !show.gathered && pose.time >= FINALE_CONFETTI_TIMING.gathered) {
				show.gathered = true;
				emit({ type: "gathered", id: show.id });
			}
			return pose;
		});
		renderer.render(poses);
		for (const pose of poses) {
			const show = shows.get(pose.id);
			if (show && pose.release >= 1) finish(show);
		}
		if (shows.size > 0) frame = schedule(tick);
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
					finishAll();
					renderer?.dispose();
					renderer = null;
					return;
				}
				if (!renderer) {
					fail("no renderer");
					return;
				}
				if (command.type === "park") {
					// A live show keeps its canvas; the controller cancels it on a resize first.
					if (shows.size > 0) return;
					renderer.resize(command.width, command.height, command.dpr);
					renderer.clear();
					return;
				}
				if (command.type === "play") {
					const size = command.size ?? "large";
					// The finale's burst replaces any other of its own; a small one joins whatever is flying.
					if (size === "large") for (const show of [...shows.values()]) if (show.size === "large") finish(show);
					renderer.play(command);
					const show: PlayerShow = { id: command.id, size, startedAt: null, releasedAt: null, held: null, gathered: false };
					shows.set(show.id, show);
					// Draw its frame 0 (every piece still below the viewport) with the rest, to
					// upload the burst; its clock starts on the next frame.
					const at = now();
					renderer.render([...shows.values()].map((each) => poseOf(each, at)));
					frame ??= schedule(tick);
					return;
				}
				const show = shows.get(command.id);
				if (!show) return;
				if (command.type === "cancel") finish(show);
				else if (command.type === "release") show.releasedAt ??= now();
				else if (command.type === "hold") {
					if (command.time === null && show.held !== null) show.startedAt = now() - (show.size === "small" ? show.held : finaleConfettiRealTime(show.held)) * 1000;
					show.held = command.time;
					// Render now: a hidden page may never deliver the pending frame.
					stop();
					tick();
				}
			} catch (error) {
				// A missing or lost GL context must never hold the finale.
				fail(String(error));
			}
		},
	};
}
