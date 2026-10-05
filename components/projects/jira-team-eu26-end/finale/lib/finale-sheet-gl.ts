import * as THREE from "three";

import { resolvePeelSurfaceTuning } from "@/components/visual/peel/data";
import { PEEL_DURATIONS } from "@/components/visual/peel/peel-model";

import { CUE } from "../data/finale-cues";
import type { Vec3 } from "./finale-camera";
import { FINALE_LIGHT_DIRECTION, LANDING, landingSwell, type FinaleCardPose, type FinaleLandingShadow, type FinaleShadowGround, type FinaleViewport } from "./finale-card-motion";
import { parseRgb, progress } from "./finale-math";

/*
 * The finale's paper, shared by its two WebGL layers: the card field of the
 * burst and the bento, and the mega bento's sheets after it. One sheet shader
 * (Peel's paper wave, airborne cloth and flutter, the printed face and its
 * blank back, fog, and the key light modelling the folds), one landing
 * shadow, one lens (the spectral smear and sphere warp), and how a pose
 * drives them, so a card flies and lands on the wall exactly as it did over
 * the slide.
 */

/** Speed (px/s) at which the cloth reaches full bend; faster only saturates. */
const CLOTH_SPEED = 1200;
const inverseRotation = new THREE.Quaternion();
const clothVelocity = new THREE.Vector3();

/** Peel's shared carry/landing tuning, so the finale's paper matches the component. */
const PEEL = resolvePeelSurfaceTuning();
/**
 * Peel's landing impulse at touchdown and its grab point (see `releasePeel`),
 * exaggerated for the stage so the wave reads from the back of the room. The
 * swell into it (`landingSwell`) peaks lower, at about 1.1, just after touchdown.
 */
const LANDING_AMPLITUDE = 2;
const FLUTTER_BOOST = 2;
const GRAB_POINT = new THREE.Vector2(0.25, 0.9);

/** ADS shadow colour (#091E42): a cool, faintly blue shadow rather than grey. */
const SHADOW_TINT = new THREE.Vector3(9 / 255, 30 / 255, 66 / 255);
/** The sheets are lit from the camera's frame by the landing shadows' key light (so folds shade toward their shadow). */
const SHEET_LIGHT = new THREE.Vector3(FINALE_LIGHT_DIRECTION.x, FINALE_LIGHT_DIRECTION.y, FINALE_LIGHT_DIRECTION.z);
/** Airborne cloth is modelled more gently than the landing wave. */
const FLIGHT_LIGHT = 0.45;

export type SheetMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

export function rgbUnit(colour: string, target = new THREE.Vector3()): THREE.Vector3 {
	const [r, g, b] = parseRgb(colour);
	return target.set(r / 255, g / 255, b / 255);
}

const sheetVertexShader = /* glsl */ `
precision highp float;
uniform float uAspect;
uniform float uSheetHeight;
uniform float uLift;
uniform float uTime;
uniform vec4 uImpulse;
uniform vec3 uWave;
uniform float uFlutter;
uniform float uShear;
/** Sheet-local velocity (x, y in plane, z along the normal), normalised; 0 = at rest. */
uniform vec3 uCloth;
/** How much the key light models the sheet's folds (0 = flat print, left exactly as printed). */
uniform float uLit;
varying vec2 vUv;
/** The bent sheet's normal and its flat normal, in view space (see the fragment shader). */
varying vec3 vNormal;
varying vec3 vFlatNormal;
const float TAU = 6.28318530718;
const float EPS = 0.0208333;

vec2 toSheet(vec2 uv) { return (uv - 0.5) * vec2(uAspect, 1.0); }

// Peel's paper height field: a decaying landing ripple from the grab point,
// plus two crossing undulations while the sheet is airborne.
float flex(vec2 uv) {
	vec2 p = toSheet(uv);
	float waveUnit = max(uWave.y * max(uAspect, 1.0), 0.05);
	float height = 0.0;
	if (uImpulse.w > 0.0) {
		// Rounded at the grab point: paper bows there, it cannot fold to a cone's tip
		// (whose facets would light as a hard dark spot). C1 with the true distance.
		float dist = distance(p, toSheet(uImpulse.xy));
		float core = waveUnit * 0.12;
		dist = dist < core ? (dist * dist / core + core) * 0.5 : dist;
		float spatial = exp(-dist * 1.3 / max(uAspect, 1.0));
		height += uWave.x * uImpulse.w * spatial * sin(TAU * (dist / waveUnit - uWave.z * uImpulse.z));
	}
	float k = TAU / waveUnit;
	vec2 dirA = normalize(vec2(0.85, 0.52));
	vec2 dirB = normalize(vec2(-0.42, 0.91));
	float undulation = sin(dot(p, dirA) * k - uTime * uWave.z * 1.55) * 0.62 + sin(dot(p, dirB) * k * 0.73 + uTime * uWave.z * 1.12) * 0.38;
	height += uFlutter * uLift * undulation;
	return height;
}

/**
 * Cloth: an airborne sheet answers its own motion through the air (after
 * Studio375's "Ten Years Away" carousel). It curls into a sail along the way
 * it travels, its middle leads while its sides trail (so the silhouette
 * arcs), motion along the normal billows it, and a ripple runs through it.
 * Returns a displacement in sheet px: xy in plane, z along the normal.
 */
vec3 cloth(vec2 p) {
	float speed = length(uCloth.xy);
	vec2 size = vec2(uAspect * uSheetHeight, uSheetHeight);
	vec2 local = p * size;
	float reach = max(size.x, size.y);
	vec3 offset = vec3(0.0);
	if (speed > 1e-4) {
		vec2 dir = uCloth.xy / speed;
		vec2 side = vec2(-dir.y, dir.x);
		float along = dot(local, dir) / reach;
		float across = dot(local, side) / reach;
		offset.z += speed * reach * 0.16 * along * along;
		offset.xy -= dir * speed * reach * 0.09 * across * across * 4.0;
		offset.z += speed * reach * 0.012 * sin(along * TAU * 1.4 - uTime * 7.0);
	}
	vec2 centred = local / (size * 0.5);
	offset.z -= uCloth.z * reach * 0.09 * (1.0 - min(1.0, dot(centred, centred) * 0.5));
	return offset;
}

/** A point of the bent sheet in its own px (x right, y up, z along the flat normal), gather aside. */
vec3 surface(vec2 uv) {
	vec2 size = vec2(uAspect * uSheetHeight, uSheetHeight);
	vec2 p = uv - 0.5;
	vec3 fabric = cloth(p);
	return vec3(p * size + fabric.xy, flex(uv) * uSheetHeight + fabric.z);
}

void main() {
	vUv = uv;
	float h = flex(uv);
	float hu = flex(uv + vec2(EPS, 0.0));
	float hv = flex(uv + vec2(0.0, EPS));
	// Paper does not stretch: bowing gathers the footprint toward the crests.
	vec2 gradient = vec2((hu - h) / (EPS * uAspect), (hv - h) / EPS);
	vec2 gather = clamp(gradient * abs(h) * uShear, -0.12, 0.12);
	vec3 fabric = cloth(position.xy);
	vec2 size = vec2(uAspect * uSheetHeight, uSheetHeight);
	vec3 displaced = position + vec3(gather.x / uAspect + fabric.x / size.x, gather.y + fabric.y / size.y, h * uSheetHeight + fabric.z);
	// The bent sheet's true surface normal (central differences over the landing wave,
	// the airborne undulation and the cloth), turned into view space with the sheet.
	vNormal = vec3(0.0, 0.0, 1.0);
	vFlatNormal = vNormal;
	if (uLit > 0.0) {
		vec3 right = surface(uv + vec2(EPS, 0.0));
		vec3 left = surface(uv - vec2(EPS, 0.0));
		vec3 up = surface(uv + vec2(0.0, EPS));
		vec3 down = surface(uv - vec2(0.0, EPS));
		mat3 turn = mat3(viewMatrix) * mat3(normalize(modelMatrix[0].xyz), normalize(modelMatrix[1].xyz), normalize(modelMatrix[2].xyz));
		vNormal = turn * cross(right - left, up - down);
		vFlatNormal = turn * vec3(0.0, 0.0, 1.0);
	}
	gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const sheetFragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uCard;
uniform vec2 uCardFit;
uniform float uFace;
uniform vec2 uSize;
uniform float uRadius;
uniform vec3 uTileColor;
/** The blank paper of its back. */
uniform vec3 uBackColor;
/**
 * The face its print is on: 0 the front, its back blank paper; 1 the front
 * alone; −1 the back alone, upright once the sheet has turned end over end
 * (v mirrored). A one-sided print leaves the other face clear.
 */
uniform float uPrintSide;
uniform vec3 uFogColor;
uniform float uFog;
uniform float uOpacity;
uniform float uLit;
/** Toward the key light, in view space (the landing shadows' light). */
uniform vec3 uLightDir;
uniform vec3 uShadowTint;
/** Done column scroll viewport in CSS px (x0, y0, x1, y1), and how hard it clips. */
uniform vec4 uClipRect;
uniform float uClip;
/** The part of this sheet the viewport showed at rest, in sheet uv (see restClipUv). */
uniform vec4 uClipUv;
uniform vec2 uViewport;
uniform float uPixelRatio;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vFlatNormal;
/** Wrap lighting: the terminator is soft, as light scatters through paper. */
const float WRAP = 0.4;
/** Darkening (and brightening) per unit of key light lost (or gained) against the flat sheet. */
const float DIFFUSE = 0.9;
/** The deepest a fold can darken (approached softly, never a plateau), and the most a crest brightens. */
const float MAX_DARK = 0.12;
const float MAX_BRIGHT = 0.03;

float roundedBox(vec2 p, vec2 halfSize, float radius) {
	vec2 q = abs(p) - halfSize + radius;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float wrapped(vec3 n) {
	return clamp((dot(n, uLightDir) + WRAP) / (1.0 + WRAP), 0.0, 1.0);
}

void main() {
	vec2 css = vec2(gl_FragCoord.x, uViewport.y * uPixelRatio - gl_FragCoord.y) / uPixelRatio;
	// At rest the viewport clips on screen, like the DOM. Once tossed, the hidden
	// part fades in on the sheet itself: a screen-fixed clip would cut the flying
	// cards along the column's edges (opaque inside it, ghosted outside).
	bool outside = uClip >= 1.0
		? css.x < uClipRect.x || css.x > uClipRect.z || css.y < uClipRect.y || css.y > uClipRect.w
		: vUv.x < uClipUv.x || vUv.y < uClipUv.y || vUv.x > uClipUv.z || vUv.y > uClipUv.w;
	float clipped = outside ? uClip : 0.0;
	if (gl_FrontFacing ? uPrintSide < -0.5 : uPrintSide > 0.5) discard;
	vec2 printed = uPrintSide < -0.5 ? vec2(vUv.x, 1.0 - vUv.y) : vUv;
	vec2 local = (printed - 0.5) / uCardFit + 0.5;
	bool off = local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0;
	// Sampled outside any branch: under one, the 2×2 quads along a fitted print's
	// edge lose their derivatives and read a far mip, a grey hairline round the print.
	vec4 card = texture2D(uCard, local);
	if (off) card = vec4(0.0);
	// The bento tile is an empty sheet: its logo and heading build on the DOM tile.
	float edge = roundedBox((vUv - 0.5) * uSize, uSize * 0.5, uRadius);
	vec4 tile = vec4(uTileColor, 1.0) * (1.0 - smoothstep(-0.75, 0.75, edge));
	vec4 colour = mix(card, tile, uFace);
	// Ink belongs to the front, unless printed on the back alone. Keep the same silhouette
	// and premultiplied edge coverage on the blank paper back, including the card-to-tile morph.
	if (!gl_FrontFacing && uPrintSide > -0.5) colour = vec4(uBackColor * colour.a, colour.a);
	// The key light models the folds, relative to the sheet lying flat: faces
	// turned from the light dim toward the ADS shadow blue, faces turned to it
	// lift a touch, so light and shade travel through the sheet with the wave.
	// No height- or curvature-based darkening: the wave's grab point is a round
	// bowl, and any such term paints it as a flat grey disc. A flat sheet is untouched.
	if (uLit > 0.0) {
		vec3 n = normalize(vNormal);
		vec3 rest = normalize(vFlatNormal);
		if (!gl_FrontFacing) {
			n = -n;
			rest = -rest;
		}
		float lit = wrapped(n) - wrapped(rest);
		float loss = max(-lit, 0.0) * DIFFUSE;
		float dark = uLit * MAX_DARK * loss / (MAX_DARK + loss);
		colour.rgb = mix(colour.rgb, uShadowTint * colour.a, dark);
		colour.rgb += (colour.a - colour.rgb) * (uLit * min(max(lit, 0.0) * DIFFUSE, MAX_BRIGHT));
	}
	// Last: at uFog 1 the sheet is its fog colour over exactly its coverage, which the wall's lens mask draws it as.
	colour.rgb = mix(colour.rgb, uFogColor * colour.a, uFog);
	gl_FragColor = colour * uOpacity * (1.0 - clipped);
}
`;

const shadowVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * A card's shadow on the ground, drawn on a quad lying in the ground plane (see
 * `landingShadow`). Each fragment is carried back into the card's own space
 * (through the key light for the cast layer, straight up for the contact
 * layer), where the card is exactly its rounded rect, and gets that rect
 * convolved with a Gaussian: erf across, a few Gaussian-weighted rows down
 * (Evan Wallace's rounded-box shadow). σ is the penumbra at that point's
 * height, mapped into card space through the projection's Jacobian, so the
 * shadow hardens where the card nearly touches and spreads where it is high.
 * Premultiplied, ADS shadow blue, with a sub-LSB dither so the faint tail
 * never bands.
 */
const shadowFragmentShader = /* glsl */ `
precision highp float;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform mat3 uCastToCard;
uniform mat3 uContactToCard;
uniform vec2 uHalf;
uniform float uRadius;
/** Height of each card point above the ground: dot(uHeight, vec3(u, 1)). */
uniform vec3 uHeight;
/** Cast layer: σ min, penumbra, light height, sky-fill height. */
uniform vec4 uCast;
uniform float uCastDensity;
/** Contact layer: density, fade height, σ, σ growth per px of height. */
uniform vec4 uContact;
uniform float uOpacity;
uniform vec3 uTint;
varying vec2 vUv;
const int ROWS = 8;

vec2 erf(vec2 x) {
	vec2 s = sign(x);
	vec2 a = abs(x);
	vec2 t = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
	t *= t;
	return s - s / (t * t);
}

float gaussian(float x, float sigma) {
	return exp(-(x * x) / (2.0 * sigma * sigma)) / (2.50662827 * sigma);
}

// One row of the rounded box, blurred across: the exact Gaussian integral of its span.
float boxRow(float x, float y, float sigma, float corner, vec2 halfSize) {
	float delta = min(halfSize.y - corner - abs(y), 0.0);
	float curved = halfSize.x - corner + sqrt(max(0.0, corner * corner - delta * delta));
	vec2 integral = 0.5 + 0.5 * erf((x + vec2(-curved, curved)) * (0.70710678 / sigma));
	return integral.y - integral.x;
}

// A rounded box convolved with an axis-aligned Gaussian (σ per axis), in its own space.
float blurredBox(vec2 p, vec2 halfSize, float corner, vec2 sigma) {
	float low = p.y - halfSize.y;
	float high = p.y + halfSize.y;
	float start = clamp(-3.0 * sigma.y, low, high);
	float end = clamp(3.0 * sigma.y, low, high);
	float stride = (end - start) / float(ROWS);
	float y = start + stride * 0.5;
	float value = 0.0;
	for (int row = 0; row < ROWS; row++) {
		value += boxRow(p.x, p.y - y, sigma.x, corner, halfSize) * gaussian(y, sigma.y) * stride;
		y += stride;
	}
	return clamp(value, 0.0, 1.0);
}

// Ground px → card px, plus how many card px one ground px spans along each card axis.
vec2 toCard(mat3 m, vec2 ground, out vec2 stretch) {
	vec3 q = m * vec3(ground, 1.0);
	float w = max(q.z, 1e-6);
	vec2 u = q.xy / w;
	vec2 alongX = (vec2(m[0][0], m[0][1]) - u * m[0][2]) / w;
	vec2 alongY = (vec2(m[1][0], m[1][1]) - u * m[1][2]) / w;
	stretch = sqrt(alongX * alongX + alongY * alongY);
	return u;
}

void main() {
	vec2 ground = uCenter + (vUv - 0.5) * uSize;
	float corner = min(uRadius, min(uHalf.x, uHalf.y));
	vec2 stretch;

	vec2 u = toCard(uCastToCard, ground, stretch);
	float h = max(dot(uHeight, vec3(u, 1.0)), 0.0);
	float sigma = uCast.x + uCast.y * h / max(uCast.z - h, 1.0);
	float castCover = blurredBox(u, uHalf, corner, max(sigma * stretch, vec2(0.3))) * uCastDensity / (1.0 + h / uCast.w);

	// Contact occlusion (off while the card is high: a uniform branch, so it costs nothing then).
	float contactCover = 0.0;
	if (uContact.x > 0.0) {
		u = toCard(uContactToCard, ground, stretch);
		h = max(dot(uHeight, vec3(u, 1.0)), 0.0);
		float contactSigma = uContact.z + uContact.w * h;
		contactCover = blurredBox(u, uHalf, corner, max(contactSigma * stretch, vec2(0.3))) * uContact.x * exp(-h / uContact.y);
	}

	float alpha = (1.0 - (1.0 - castCover) * (1.0 - contactCover)) * uOpacity;
	float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
	alpha = clamp(alpha + (noise - 0.5) * step(0.001, alpha) / 255.0, 0.0, 1.0);
	gl_FragColor = vec4(uTint * alpha, alpha);
}
`;

const postVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Taps along each pixel's ray to the centre. */
export const LENS_TAPS = 32;

/**
 * How the wall's lens keeps each sheet to its own smear. The field round the
 * smeared sheets sets each pixel's reach, but every tap is weighed by the
 * paper it finds (the lens's mask: its chroma, premultiplied by coverage): a
 * tap counts only while it lies within that paper's own share of the reach,
 * so a sheet beside one still in the air is smeared only as far as its own
 * chroma, and a landed one (chroma 0) not at all, whatever its neighbours. Its
 * trail shortens and fades with its chroma, and it never has a smear to drop
 * when it hands over to its DOM card. Bare slide between the taps goes with
 * the paper at the pixel itself (all of it, over bare slide); past a share,
 * the pixel as drawn stands in. At full shares, every tap is as it was.
 * Scalar GLSL, so its tests can run it as it is.
 */
export const LENS_SHARE_GLSL = /* glsl */ `
float ownShare(float chroma, float cover, float field) {
	return clamp(chroma / max(cover, 1.0 / 255.0) * 1.02 / max(field, 1e-4), 0.0, 1.0);
}

float bareShare(float chroma, float cover, float field) {
	return cover > 0.0 ? ownShare(chroma, cover, field) : 1.0;
}

float within(float share, float along) {
	return clamp(min(share * 0.8 - along, share * 0.2 + along) * float(TAPS) + 0.5, 0.0, 1.0) * clamp(share * float(TAPS), 0.0, 1.0);
}

float standIn(float paper, float bare, float cover) {
	return 1.0 - paper * cover - bare * (1.0 - cover);
}
`;

/**
 * A sheet's share of the wall's lens (its spot's weight and its mask's
 * chroma): its chroma, as far as it is shown, so a card the wall reveals
 * brings its smear (and its field) up with it rather than in one frame.
 */
export function lensShare(chroma: number, opacity: number): number {
	return chroma * Math.min(1, Math.max(0, opacity));
}

/**
 * Spectral radial dispersion, after the lens in Yousuf Soomro's liquid-glass
 * carousel (MIT, github.com/Yousuf-developer/liquid-glass-carousel): toward
 * the frame edge each pixel gathers taps along the ray to the centre, each
 * weighted by its own part of the spectrum (red near, green mid, blue far), so
 * shapes stretch outward and split into spectral trails on the light slide; a
 * tangential "fluid rim" wave makes the edge swim like liquid glass. The
 * centre of frame stays crisp.
 */
const postFragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
#ifdef CHROMA_FIELD
float uStrength;
#else
uniform float uStrength;
#endif
uniform float uAspect;
uniform float uTime;
#ifdef CHROMA_FIELD
float uWarp;
#else
uniform float uWarp;
#endif
uniform vec3 uBackground;
varying vec2 vUv;
const int TAPS = ${LENS_TAPS};

#ifdef CHROMA_FIELD
/** The smear and the bulge at full chroma: each pixel takes its share from the sheets near it. */
uniform float uSmear;
uniform float uBulge;
/** Each smeared sheet on screen: its rect (centre, half size; frame heights from the centre, y up)... */
uniform vec4 uSpots[CHROMA_SPOTS];
/** ...and how much smear and bulge film it. */
uniform vec2 uSpotWeights[CHROMA_SPOTS];
uniform int uSpotCount;
/** How far past a sheet's rect its share fades out (frame heights): as far as its trails reach. */
uniform float uSpotReach;

vec2 chromaField(vec2 uv) {
	vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
	vec2 field = vec2(0.0);
	for (int index = 0; index < CHROMA_SPOTS; index++) {
		if (index >= uSpotCount) break;
		vec4 spot = uSpots[index];
		vec2 q = abs(p - spot.xy) - spot.zw;
		float outside = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
		field = max(field, uSpotWeights[index] * (1.0 - smoothstep(0.0, uSpotReach, outside)));
	}
	return field;
}

/** The scene's sheets again, each as its own chroma (r) and bulge (g), premultiplied by its coverage (a). */
uniform sampler2D uMask;

vec4 sampleMask(vec2 uv) {
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
	return texture2D(uMask, uv);
}
${LENS_SHARE_GLSL}
#endif

// Barrel warp: the frame bulges as if painted on the inside of a sphere.
vec2 warped(vec2 uv) {
	vec2 centred = (uv - 0.5) * vec2(uAspect, 1.0);
	float r2 = dot(centred, centred) / dot(vec2(uAspect, 1.0) * 0.5, vec2(uAspect, 1.0) * 0.5);
	return 0.5 + (uv - 0.5) * (1.0 + uWarp * r2);
}

vec4 sampleScene(vec2 uv) {
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
	return texture2D(uScene, uv);
}

vec3 spectrum(float t) {
	vec3 offset = (vec3(t) - vec3(0.0, 0.5, 1.0)) / 0.38;
	return exp(-(offset * offset));
}

void main() {
#ifdef CHROMA_FIELD
	// Each sheet is filmed through as much of the lens as its own chroma: one
	// coming down sharpens on its own, and the field is 0 where the pass ends.
	vec2 field = chromaField(vUv);
	uStrength = uSmear * field.x;
	uWarp = uBulge * field.y;
#endif
	vec2 lensUv = warped(vUv);
	vec2 fromCentre = lensUv - 0.5;
	vec2 screen = (vUv - 0.5) * vec2(uAspect, 1.0);
	float radius = length(screen) / length(vec2(uAspect, 1.0) * 0.5);
	float edge = pow(smoothstep(0.18, 1.0, radius), 1.6);
	float reach = uStrength * edge * 0.2;
	// A soft light falloff toward the rim sells the curved lens.
	float vignette = uWarp * smoothstep(0.55, 1.25, radius) * 0.9;
	if (reach < 0.0004) {
		vec4 plain = sampleScene(lensUv);
		gl_FragColor = vec4(mix(plain.rgb, vec3(plain.a), vignette), plain.a);
		return;
	}
	vec2 inward = fromCentre / max(length(fromCentre), 1e-4);
	vec2 tangent = vec2(-inward.y, inward.x);
	float angle = atan(screen.y, screen.x);
	float fluid = sin(angle * 2.0 + uTime * 1.3) * 0.55 + sin(angle - uTime * 0.9) * 0.25;
	vec2 base = lensUv + tangent * fluid * uStrength * edge * 0.018;
#ifdef CHROMA_FIELD
	vec4 plain = sampleScene(lensUv);
	vec4 mask = sampleMask(lensUv);
	float here = bareShare(mask.r, mask.a, field.x);
#endif
	vec3 sum = vec3(0.0);
	vec3 alpha = vec3(0.0);
	vec3 weight = vec3(0.0);
	for (int index = 0; index < TAPS; index++) {
		float t = (float(index) + 0.5) / float(TAPS);
		// Mostly outward trails, with a little of the split running inward too.
		vec2 at = base - inward * reach * (t - 0.2);
		vec4 tap = sampleScene(at);
#ifdef CHROMA_FIELD
		// Each sheet is smeared only as far as its own chroma (see LENS_SHARE_GLSL).
		float along = t - 0.2;
		vec4 under = sampleMask(at);
		float paper = within(ownShare(under.r, under.a, field.x), along);
		float bare = within(here, along);
		tap = tap * paper + plain * standIn(paper, bare, tap.a);
#endif
		vec3 w = spectrum(t);
		sum += (tap.rgb + uBackground * (1.0 - tap.a)) * w;
		alpha += tap.a * w;
		weight += w;
	}
	vec3 dispersed = sum / weight;
	vec3 coverage = alpha / weight;
	float a = max(coverage.r, max(coverage.g, coverage.b));
	// Back to premultiplied colour over whatever sits beneath the canvas.
	vec3 colour = clamp(dispersed - uBackground * (1.0 - a), 0.0, a);
	gl_FragColor = vec4(mix(colour, vec3(a), vignette), a);
}
`;

/** Plain stand-in when a print is unavailable (rehearsal or capture failure). */
export function fallbackPrint(width: number, height: number, radius: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(2, Math.round(width * 2));
	canvas.height = Math.max(2, Math.round(height * 2));
	const context = canvas.getContext("2d");
	if (context) {
		context.scale(2, 2);
		context.fillStyle = "#FFFFFF";
		context.strokeStyle = "rgba(9, 30, 66, 0.14)";
		context.beginPath();
		context.roundRect(0.5, 0.5, width - 1, height - 1, radius);
		context.fill();
		context.stroke();
	}
	return canvas;
}

export function textureFrom(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	// Raw sRGB bytes in and out: the GL sheet must match the DOM pixel for pixel.
	texture.colorSpace = THREE.NoColorSpace;
	texture.premultiplyAlpha = true;
	texture.anisotropy = 4;
	texture.needsUpdate = true;
	return texture;
}

export interface SheetMaterialOptions {
	readonly texture: THREE.Texture;
	/** Blank tile corner radius, sheet px. */
	readonly radius: number;
	readonly tileColor: THREE.Vector3;
	readonly fogColor: THREE.Vector3;
	readonly viewport: FinaleViewport;
	readonly pixelRatio: number;
	/** The Done column's scroll viewport (CSS px: x0, y0, x1, y1) and the resting card's part of it (sheet uv); sheets that never clip leave them out. */
	readonly clipRect?: THREE.Vector4;
	readonly clipUv?: THREE.Vector4;
}

/** A sheet of printed paper: its own uniforms, one program for every sheet of a layer. */
export function createSheetMaterial(options: SheetMaterialOptions): THREE.ShaderMaterial {
	const { texture, radius, tileColor, fogColor, viewport, pixelRatio } = options;
	return new THREE.ShaderMaterial({
		vertexShader: sheetVertexShader,
		fragmentShader: sheetFragmentShader,
		transparent: true,
		premultipliedAlpha: true,
		depthTest: false,
		depthWrite: false,
		side: THREE.DoubleSide,
		uniforms: {
			uCard: { value: texture },
			uCardFit: { value: new THREE.Vector2(1, 1) },
			uFace: { value: 0 },
			uSize: { value: new THREE.Vector2(1, 1) },
			uRadius: { value: radius },
			uTileColor: { value: tileColor },
			// Its own copy: a sheet whose back differs sets it apart from its tile colour.
			uBackColor: { value: tileColor.clone() },
			uPrintSide: { value: 0 },
			uFogColor: { value: fogColor },
			uFog: { value: 0 },
			uOpacity: { value: 1 },
			uLit: { value: 0 },
			uLightDir: { value: SHEET_LIGHT },
			uShadowTint: { value: SHADOW_TINT },
			uClipRect: { value: options.clipRect ?? new THREE.Vector4(0, 0, 0, 0) },
			uClip: { value: 0 },
			uClipUv: { value: options.clipUv ?? new THREE.Vector4(0, 0, 1, 1) },
			uViewport: { value: new THREE.Vector2(viewport.width, viewport.height) },
			uPixelRatio: { value: pixelRatio },
			uAspect: { value: 1 },
			uSheetHeight: { value: 1 },
			uLift: { value: 0 },
			uTime: { value: 0 },
			uImpulse: { value: new THREE.Vector4(GRAB_POINT.x, GRAB_POINT.y, 0, 0) },
			uWave: { value: new THREE.Vector3(PEEL.waveAmplitude, PEEL.waveLength, PEEL.waveSpeed) },
			uFlutter: { value: PEEL.flutter * FLUTTER_BOOST },
			uShear: { value: PEEL.waveShear },
			uCloth: { value: new THREE.Vector3(0, 0, 0) },
		},
	});
}

export interface LensMaterialOptions {
	readonly scene: THREE.Texture;
	readonly aspect: number;
	/** What shows beneath the canvas (the slide): the smear mixes its taps over it. */
	readonly background: THREE.Vector3;
	/**
	 * Room for this many smeared sheets, each filmed through its own share of
	 * the lens (`uSmear`, `uBulge`, `uSpots`, `uSpotWeights`, `uSpotCount`,
	 * `uSpotReach`). Left out, one strength and warp film the whole frame
	 * (`uStrength`, `uWarp`), as the card field's camera does.
	 */
	readonly spots?: number;
	/**
	 * With `spots`: the same sheets as `scene`, each in its own chroma (r) and
	 * bulge (g), premultiplied by its coverage (a), so the field smears each
	 * sheet no further than its own chroma (`uMask`). A sheet drawn with
	 * `uFog` 1 and its mask colour as `uFogColor` (a shadow, as `uTint`) is
	 * exactly that over exactly its own coverage.
	 */
	readonly mask?: THREE.Texture;
}

/** The lens pass: the frame through the spectral dispersion and sphere warp. */
export function createLensMaterial({ scene, aspect, background, spots = 0, mask }: LensMaterialOptions): THREE.ShaderMaterial {
	const field: Record<string, THREE.IUniform> = spots > 0
		? {
				uSmear: { value: 0 },
				uBulge: { value: 0 },
				uSpots: { value: Array.from({ length: spots }, () => new THREE.Vector4()) },
				uSpotWeights: { value: Array.from({ length: spots }, () => new THREE.Vector2()) },
				uSpotCount: { value: 0 },
				uSpotReach: { value: 0 },
				uMask: { value: mask ?? null },
			}
		: { uStrength: { value: 0 }, uWarp: { value: 0 } };
	return new THREE.ShaderMaterial({
		vertexShader: postVertexShader,
		fragmentShader: postFragmentShader,
		...(spots > 0 ? { defines: { CHROMA_FIELD: 1, CHROMA_SPOTS: spots } } : {}),
		blending: THREE.NoBlending,
		depthTest: false,
		depthWrite: false,
		uniforms: {
			uScene: { value: scene },
			uAspect: { value: aspect },
			uTime: { value: 0 },
			uBackground: { value: background },
			...field,
		},
	});
}

/** A landing card's drop shadow (see `placeShadow`). */
export function createShadowMaterial(radius: number): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		vertexShader: shadowVertexShader,
		fragmentShader: shadowFragmentShader,
		transparent: true,
		premultipliedAlpha: true,
		depthTest: false,
		depthWrite: false,
		side: THREE.DoubleSide,
		uniforms: {
			uCenter: { value: new THREE.Vector2(0, 0) },
			uSize: { value: new THREE.Vector2(1, 1) },
			uCastToCard: { value: new THREE.Matrix3() },
			uContactToCard: { value: new THREE.Matrix3() },
			uHalf: { value: new THREE.Vector2(1, 1) },
			uRadius: { value: radius },
			uHeight: { value: new THREE.Vector3(0, 0, 0) },
			uCast: { value: new THREE.Vector4(1, 0, 1, 1) },
			uCastDensity: { value: 0 },
			uContact: { value: new THREE.Vector4(0, 1, 1, 0) },
			uOpacity: { value: 0 },
			uTint: { value: SHADOW_TINT },
		},
	});
}

/**
 * Places a sheet where its pose is (world: x right, y up, origin at the
 * slide's centre; the turn as `cardAxes` reads it) and sizes the shader's
 * sheet, fitting a print of `cardAspect` (width ÷ height) inside it.
 */
export function poseSheet(mesh: SheetMesh, pose: FinaleCardPose, world: Vec3, cardAspect: number): void {
	mesh.position.set(world.x, world.y, world.z);
	mesh.rotation.set(pose.rotateX, pose.rotateY, -pose.rotateZ, "XYZ");
	mesh.scale.set(pose.width, pose.height, 1);
	const uniforms = mesh.material.uniforms;
	const aspect = pose.width / pose.height;
	uniforms.uAspect.value = aspect;
	uniforms.uSheetHeight.value = pose.height;
	uniforms.uSize.value.set(pose.width, pose.height);
	uniforms.uCardFit.value.set(Math.min(1, cardAspect / aspect), Math.min(1, aspect / cardAspect));
	uniforms.uFace.value = pose.face;
	uniforms.uLift.value = pose.lift;
}

/**
 * Peel's landing wave `waveAge` s from touchdown: Peel's decay, swelling from
 * a flat sheet as it gathers (so the paper never bends in one frame) and
 * spent (exactly 0, at rest) by the hand-off to the DOM, so the swap never
 * pops. Smooth throughout: the sheet's bend never changes speed abruptly.
 */
export function landingWaveEnergy(waveAge: number): number {
	const swell = landingSwell(waveAge);
	if (swell <= 0) return 0;
	const settle = 1 - progress(waveAge, -LANDING.lead, CUE.handoff);
	return LANDING_AMPLITUDE * swell * Math.exp((-2.2 * waveAge) / PEEL_DURATIONS.wave) * settle * settle;
}

/** The landing wave from the grab point, and how much the key light models the sheet's folds. */
export function setLandingWave(uniforms: THREE.ShaderMaterial["uniforms"], pose: FinaleCardPose): void {
	const energy = landingWaveEnergy(pose.waveAge);
	// Light models the folds only while the sheet is bent (flat sheets stay exactly as printed),
	// turning up from the flight's gentler modelling as the wave swells.
	const flight = FLIGHT_LIGHT * pose.lift;
	uniforms.uLit.value = energy > 0 ? Math.max(flight, landingSwell(pose.waveAge)) : flight;
	// The ripple runs from when it began to gather, so it travels on without a hitch at touchdown.
	uniforms.uImpulse.value.set(GRAB_POINT.x, GRAB_POINT.y, Math.max(0, pose.waveAge + LANDING.lead), energy);
}

/** Motion (world px/s) into the sheet's own frame (`rotation`), saturating softly, scaled by `weight`. */
export function setCloth(uniform: THREE.Vector3, velocity: Vec3, weight: number, rotation: THREE.Euler): void {
	clothVelocity.set(velocity.x, velocity.y, velocity.z).divideScalar(CLOTH_SPEED);
	inverseRotation.setFromEuler(rotation).invert();
	clothVelocity.applyQuaternion(inverseRotation);
	const magnitude = clothVelocity.length();
	if (magnitude > 0) clothVelocity.multiplyScalar((Math.tanh(magnitude) / magnitude) * weight);
	uniform.copy(clothVelocity);
}

const shadowAxes = new THREE.Matrix4();
const shadowAxisX = new THREE.Vector3();
const shadowAxisY = new THREE.Vector3();
const shadowAxisZ = new THREE.Vector3();

function setHomography(target: THREE.Matrix3, m: readonly number[]): void {
	target.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
}

/**
 * Lays a landing card's shadow (`landingShadow`, `landingShadowIn`) on the
 * ground it was cast on, or hides it when there is none to see.
 */
export function placeShadow(shadow: SheetMesh, cast: FinaleLandingShadow | null, ground: FinaleShadowGround, cardOpacity: number): void {
	if (!cast || cast.opacity * cardOpacity <= 0.002) {
		shadow.visible = false;
		return;
	}
	const { bounds, falloff } = cast;
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	shadow.visible = true;
	shadow.position.set(
		ground.origin.x + ground.x.x * cx + ground.y.x * cy,
		ground.origin.y + ground.x.y * cx + ground.y.y * cy,
		ground.origin.z + ground.x.z * cx + ground.y.z * cy,
	);
	shadowAxes.makeBasis(
		shadowAxisX.set(ground.x.x, ground.x.y, ground.x.z),
		shadowAxisY.set(ground.y.x, ground.y.y, ground.y.z),
		shadowAxisZ.set(ground.z.x, ground.z.y, ground.z.z),
	);
	shadow.quaternion.setFromRotationMatrix(shadowAxes);
	shadow.scale.set(bounds.width, bounds.height, 1);
	const uniforms = shadow.material.uniforms;
	uniforms.uCenter.value.set(cx, cy);
	uniforms.uSize.value.set(bounds.width, bounds.height);
	setHomography(uniforms.uCastToCard.value, cast.cast.toCard);
	setHomography(uniforms.uContactToCard.value, cast.contact.toCard);
	uniforms.uHalf.value.set(cast.halfSize.x, cast.halfSize.y);
	uniforms.uRadius.value = cast.radius;
	uniforms.uHeight.value.set(cast.heightPlane[0], cast.heightPlane[1], cast.heightPlane[2]);
	uniforms.uCast.value.set(falloff.sigmaMin, falloff.penumbra, falloff.lightHeight, falloff.fillHeight);
	uniforms.uCastDensity.value = falloff.cast;
	uniforms.uContact.value.set(falloff.contact, falloff.contactFade, falloff.contactSigma, falloff.contactSpread);
	uniforms.uOpacity.value = cast.presence * cardOpacity;
}
