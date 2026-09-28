"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { resolvePeelSurfaceTuning } from "@/components/visual/peel/data";
import { PEEL_DURATIONS } from "@/components/visual/peel/peel-model";

import { FINALE_COLORS } from "../data/finale-palette";
import type { FinaleRect } from "../data/finale-stories";
import { CUE } from "../data/finale-cues";
import { cameraBasis, finaleCameraRig, toView, type FinaleCameraBasis } from "../lib/finale-camera";
import { finaleCardSheetsShown } from "../lib/finale-column-flash";
import {
	FINALE_CAMERA_FOV,
	FINALE_LIGHT_DIRECTION,
	cameraDistance,
	cardPose,
	cardVelocity,
	chromaStrength,
	fogAtDepth,
	sphereWarp,
	lensFade,
	poseToWorld,
	restClipUv,
	landingShadow,
	heroShadowGround,
	slideShadowGround,
	tileHandoff,
	type FinaleCardPose,
	type FinaleCardInput,
	type FinaleViewport,
} from "../lib/finale-card-motion";
import { latePrintResolvers } from "../lib/finale-late-prints";
import { parseRgb, progress } from "../lib/finale-math";
import { useFinaleFrame } from "../hooks/use-finale-frame";

/** Speed (px/s) at which the cloth reaches full bend; faster only saturates. */
const CLOTH_SPEED = 1200;
const inverseRotation = new THREE.Quaternion();
const clothVelocity = new THREE.Vector3();

/** Peel's shared carry/landing tuning, so the finale's paper matches the component. */
const PEEL = resolvePeelSurfaceTuning();
/** Peel's landing impulse amplitude and grab point (see `releasePeel`). */
/** Exaggerated for the stage: the landing wave reads from the back of the room. */
const LANDING_AMPLITUDE = 1.7;
const FLUTTER_BOOST = 2;
const GRAB_POINT = new THREE.Vector2(0.25, 0.9);

function rgbUnit(colour: string): THREE.Vector3 {
	const [r, g, b] = parseRgb(colour);
	return new THREE.Vector3(r / 255, g / 255, b / 255);
}

const vertexShader = /* glsl */ `
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
	vec2 local = (vUv - 0.5) / uCardFit + 0.5;
	bool off = local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0;
	vec4 card = off ? vec4(0.0) : texture2D(uCard, local);
	// The bento tile is an empty sheet: its logo and heading build on the DOM tile.
	float edge = roundedBox((vUv - 0.5) * uSize, uSize * 0.5, uRadius);
	vec4 tile = vec4(uTileColor, 1.0) * (1.0 - smoothstep(-0.75, 0.75, edge));
	vec4 colour = mix(card, tile, uFace);
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
uniform float uStrength;
uniform float uAspect;
uniform float uTime;
uniform float uWarp;
uniform vec3 uBackground;
varying vec2 vUv;
const int TAPS = 32;

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
	vec3 sum = vec3(0.0);
	vec3 alpha = vec3(0.0);
	vec3 weight = vec3(0.0);
	for (int index = 0; index < TAPS; index++) {
		float t = (float(index) + 0.5) / float(TAPS);
		// Mostly outward trails, with a little of the split running inward too.
		vec4 tap = sampleScene(base - inward * reach * (t - 0.2));
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

export interface FinaleGlCard {
	readonly key: string;
	readonly input: FinaleCardInput;
	/** Print of the card; echoes share their donor's print. */
	readonly printKey: string;
	readonly print?: HTMLCanvasElement;
	/** Late lookup: a print that finishes after the finale starts replaces the stand-in sheet. */
	readonly resolvePrint?: () => HTMLCanvasElement | undefined;
	/** Landing order for tiles (hero = 0), used for the DOM hand-off. */
	readonly tileOrder?: number;
}

/** Plain stand-in when a print is unavailable (rehearsal or capture failure). */
function fallbackPrint(width: number, height: number, radius: number): HTMLCanvasElement {
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

function textureFrom(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	// Raw sRGB bytes in and out: the GL sheet must match the DOM pixel for pixel.
	texture.colorSpace = THREE.NoColorSpace;
	texture.premultiplyAlpha = true;
	texture.anisotropy = 4;
	texture.needsUpdate = true;
	return texture;
}

/** ADS shadow colour (#091E42): a cool, faintly blue shadow rather than grey. */
const SHADOW_TINT = new THREE.Vector3(9 / 255, 30 / 255, 66 / 255);
/** The sheets are lit from the camera's frame by the landing shadows' key light (so folds shade toward their shadow). */
const SHEET_LIGHT = new THREE.Vector3(FINALE_LIGHT_DIRECTION.x, FINALE_LIGHT_DIRECTION.y, FINALE_LIGHT_DIRECTION.z);
/** Airborne cloth is modelled more gently than the landing wave. */
const FLIGHT_LIGHT = 0.45;
const shadowAxes = new THREE.Matrix4();
const shadowAxisX = new THREE.Vector3();
const shadowAxisY = new THREE.Vector3();
const shadowAxisZ = new THREE.Vector3();

function setHomography(target: THREE.Matrix3, m: readonly number[]): void {
	target.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
}

/**
 * Lays a landing tile's shadow (see `landingShadow`) on its ground: the slide
 * for the tiles, and for the hero (which lands while the camera returns) a
 * plane square to the lens just behind it that becomes the slide as it lands.
 */
function placeShadow(
	shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>,
	card: FinaleGlCard,
	pose: FinaleCardPose,
	world: { x: number; y: number; z: number },
	basis: FinaleCameraBasis,
	depth: number,
	cardOpacity: number,
	time: number,
	radius: number,
	viewport: FinaleViewport,
): void {
	const order = card.tileOrder ?? 0;
	const ground = order === 0 ? heroShadowGround(world, basis, depth, pose.lift) : slideShadowGround(viewport);
	const cast = landingShadow(time, order, pose, viewport, ground, radius);
	if (!cast || cast.opacity * cardOpacity <= 0.002) return;
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

interface FinaleCardSpaceGlProps {
	readonly cards: readonly FinaleGlCard[];
	/** Done column scroll viewport (DOM px) that clips resting cards. */
	readonly clip: FinaleRect;
	/** What the camera frames for the long zoom (the hero card's rect). */
	readonly subject: FinaleRect;
	readonly viewport: FinaleViewport;
	/** Bento tile corner radius in viewport px. */
	readonly tileRadius: number;
}

interface GlState {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	readonly sheets: readonly {
		mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
		/** Landing tiles cast a drop shadow on the slide. */
		shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
		printKey: string;
		cardAspect: number;
	}[];
	/** Prints still showing a stand-in, and how to fetch the real one. */
	readonly pending: Map<string, { texture: THREE.CanvasTexture; resolve: () => HTMLCanvasElement | undefined }>;
	readonly target: THREE.WebGLRenderTarget;
	readonly post: { scene: THREE.Scene; camera: THREE.OrthographicCamera; material: THREE.ShaderMaterial };
}

/**
 * The finale's 3D layer: every Done card as a sheet of printed paper in one
 * WebGL scene, plus the spectral dispersion pass. Rendered from the finale
 * clock (not its own loop) so every frame is deterministic and scrubbable.
 */
export function FinaleCardSpaceGl({ cards, clip, subject, viewport, tileRadius }: Readonly<FinaleCardSpaceGlProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<GlState | null>(null);

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
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(ratio);
		renderer.setSize(viewport.width, viewport.height, false);
		renderer.setClearColor(0x000000, 0);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(FINALE_CAMERA_FOV, viewport.width / viewport.height, 10, 20000);
		camera.position.set(0, 0, cameraDistance(viewport));
		camera.lookAt(0, 0, 0);
		const geometry = new THREE.PlaneGeometry(1, 1, 48, 32);
		const shadowGeometry = new THREE.PlaneGeometry(1, 1);
		const tileColor = rgbUnit(FINALE_COLORS.tile);
		const fogColor = rgbUnit(FINALE_COLORS.slide);
		const textures = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>();
		const pending: GlState["pending"] = new Map();
		const lateResolvers = latePrintResolvers(cards);
		const sheets = cards.map((card) => {
			let entry = textures.get(card.printKey);
			if (!entry) {
				const source = card.print ?? fallbackPrint(card.input.rect.width, card.input.rect.height, 8);
				entry = { texture: textureFrom(source), aspect: source.width / source.height };
				textures.set(card.printKey, entry);
				const resolve = card.print ? undefined : lateResolvers.get(card.printKey);
				if (resolve) pending.set(card.printKey, { texture: entry.texture, resolve });
			}
			const material = new THREE.ShaderMaterial({
				vertexShader,
				fragmentShader: sheetFragmentShader,
				transparent: true,
				premultipliedAlpha: true,
				depthTest: false,
				depthWrite: false,
				side: THREE.DoubleSide,
				uniforms: {
					uCard: { value: entry.texture },
					uCardFit: { value: new THREE.Vector2(1, 1) },
					uFace: { value: 0 },
					uSize: { value: new THREE.Vector2(1, 1) },
					uRadius: { value: tileRadius },
					uTileColor: { value: tileColor },
					uFogColor: { value: fogColor },
					uFog: { value: 0 },
					uOpacity: { value: 1 },
					uLit: { value: 0 },
					uLightDir: { value: SHEET_LIGHT },
					uShadowTint: { value: SHADOW_TINT },
					uClipRect: { value: new THREE.Vector4(clip.x, clip.y, clip.x + clip.width, clip.y + clip.height) },
					uClip: { value: 0 },
					uClipUv: { value: new THREE.Vector4(...restClipUv(card.input.rect, clip)) },
					uViewport: { value: new THREE.Vector2(viewport.width, viewport.height) },
					uPixelRatio: { value: ratio },
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
			const mesh = new THREE.Mesh(geometry, material);
			scene.add(mesh);
			let shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
			if (card.tileOrder !== undefined) {
				shadow = new THREE.Mesh(shadowGeometry, new THREE.ShaderMaterial({
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
						uRadius: { value: tileRadius },
						uHeight: { value: new THREE.Vector3(0, 0, 0) },
						uCast: { value: new THREE.Vector4(1, 0, 1, 1) },
						uCastDensity: { value: 0 },
						uContact: { value: new THREE.Vector4(0, 1, 1, 0) },
						uOpacity: { value: 0 },
						uTint: { value: SHADOW_TINT },
					},
				}));
				shadow.visible = false;
				scene.add(shadow);
			}
			return { mesh, shadow, printKey: card.printKey, cardAspect: entry.aspect };
		});

		const target = new THREE.WebGLRenderTarget(Math.round(viewport.width * ratio), Math.round(viewport.height * ratio), { samples: 4 });
		const postMaterial = new THREE.ShaderMaterial({
			vertexShader: postVertexShader,
			fragmentShader: postFragmentShader,
			blending: THREE.NoBlending,
			depthTest: false,
			depthWrite: false,
			uniforms: {
				uScene: { value: target.texture },
				uStrength: { value: 0 },
				uAspect: { value: viewport.width / viewport.height },
				uTime: { value: 0 },
				uWarp: { value: 0 },
				uBackground: { value: fogColor },
			},
		});
		const postGeometry = new THREE.PlaneGeometry(2, 2);
		const postScene = new THREE.Scene();
		postScene.add(new THREE.Mesh(postGeometry, postMaterial));
		const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		stateRef.current = { renderer, scene, camera, sheets, pending, target, post: { scene: postScene, camera: postCamera, material: postMaterial } };
		return () => {
			stateRef.current = null;
			for (const { mesh, shadow } of sheets) {
				shadow?.material.dispose();
				mesh.material.uniforms.uCard.value.dispose();
				mesh.material.dispose();
			}
			for (const { texture } of textures.values()) texture.dispose();
			geometry.dispose();
			shadowGeometry.dispose();
			postGeometry.dispose();
			postMaterial.dispose();
			target.dispose();
			renderer.dispose();
		};
	}, [cards, clip, tileRadius, viewport]);

	useFinaleFrame((time) => {
		const state = stateRef.current;
		if (!state) return;
		// A card printed after the finale started swaps its stand-in for the real print.
		for (const [printKey, entry] of state.pending) {
			const print = entry.resolve();
			if (!print) continue;
			const texture = textureFrom(print);
			for (const sheet of state.sheets) {
				if (sheet.printKey !== printKey) continue;
				sheet.mesh.material.uniforms.uCard.value = texture;
				sheet.cardAspect = print.width / print.height;
			}
			entry.texture.dispose();
			state.pending.delete(printKey);
		}
		// Until the toss the live DOM cards are what shows: prints rasterise text a
		// hair differently on real displays, so the sheets take over only at the
		// hand-off, as they start to move (the board's own cards leave then too).
		if (!finaleCardSheetsShown(time)) {
			if (canvasRef.current && canvasRef.current.style.visibility !== "hidden") canvasRef.current.style.visibility = "hidden";
			return;
		}
		// Film the world through the shot's camera.
		const rig = finaleCameraRig(time, viewport, subject);
		const basis = cameraBasis(rig);
		state.camera.position.set(rig.position.x, rig.position.y, rig.position.z);
		state.camera.up.set(0, 1, 0);
		state.camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
		state.camera.rotateZ(rig.roll);
		let anyVisible = false;
		cards.forEach((card, index) => {
			const sheet = state.sheets[index];
			if (!sheet) return;
			const pose = cardPose(time, card.input, viewport);
			const world = poseToWorld(pose, viewport);
			const depth = toView(world, rig, basis).z;
			const handoff = card.tileOrder === undefined ? 0 : tileHandoff(time, card.tileOrder);
			const opacity = pose.opacity * (1 - handoff) * lensFade(depth, viewport);
			const { mesh } = sheet;
			mesh.visible = opacity > 0.002;
			if (sheet.shadow) sheet.shadow.visible = false;
			if (!mesh.visible) return;
			anyVisible = true;
			mesh.position.set(world.x, world.y, world.z);
			mesh.rotation.set(pose.rotateX, pose.rotateY, -pose.rotateZ, "XYZ");
			mesh.scale.set(pose.width, pose.height, 1);
			// Far to near from the lens; the tie-break keeps overlapping sheets stable.
			mesh.renderOrder = -Math.round(depth) * 64 + index;
			if (sheet.shadow) sheet.shadow.renderOrder = mesh.renderOrder - 32;
			const uniforms = mesh.material.uniforms;
			const aspect = pose.width / pose.height;
			uniforms.uAspect.value = aspect;
			uniforms.uSheetHeight.value = pose.height;
			uniforms.uSize.value.set(pose.width, pose.height);
			uniforms.uCardFit.value.set(Math.min(1, sheet.cardAspect / aspect), Math.min(1, aspect / sheet.cardAspect));
			uniforms.uFace.value = pose.face;
			uniforms.uFog.value = fogAtDepth(depth, viewport);
			uniforms.uOpacity.value = opacity;
			uniforms.uClip.value = pose.clip;
			uniforms.uLift.value = pose.lift;
			uniforms.uTime.value = time;
			// The wave is spent (exactly 0) by the hand-off to the DOM tile, so the swap never pops.
			const settle = 1 - progress(pose.waveAge, 0, CUE.handoff);
			const energy = pose.waveAge >= 0 ? LANDING_AMPLITUDE * Math.exp((-2.2 * pose.waveAge) / PEEL_DURATIONS.wave) * settle * settle : 0;
			// Light models the folds only while the sheet is bent; flat sheets stay exactly as printed.
			uniforms.uLit.value = energy > 0 ? 1 : FLIGHT_LIGHT * pose.lift;
			uniforms.uImpulse.value.set(GRAB_POINT.x, GRAB_POINT.y, Math.max(0, pose.waveAge), energy);
			if (sheet.shadow) placeShadow(sheet.shadow, card, pose, world, basis, depth, opacity, time, tileRadius, viewport);
			// Motion as the camera sees it, into the sheet's own frame, saturating softly.
			const velocity = cardVelocity(time, card.input, viewport, subject);
			clothVelocity.set(velocity.x, velocity.y, velocity.z).divideScalar(CLOTH_SPEED);
			inverseRotation.setFromEuler(mesh.rotation).invert();
			clothVelocity.applyQuaternion(inverseRotation);
			const magnitude = clothVelocity.length();
			if (magnitude > 0) clothVelocity.multiplyScalar((Math.tanh(magnitude) / magnitude) * velocity.weight);
			uniforms.uCloth.value.copy(clothVelocity);
		});
		const strength = chromaStrength(time, viewport, subject);
		const warp = sphereWarp(time);
		if ((strength > 0.001 || warp > 0.001) && anyVisible) {
			state.post.material.uniforms.uStrength.value = strength;
			state.post.material.uniforms.uWarp.value = warp;
			state.post.material.uniforms.uTime.value = time;
			state.renderer.setRenderTarget(state.target);
			state.renderer.render(state.scene, state.camera);
			state.renderer.setRenderTarget(null);
			state.renderer.render(state.post.scene, state.post.camera);
		} else {
			state.renderer.render(state.scene, state.camera);
		}
		if (canvasRef.current) canvasRef.current.style.visibility = anyVisible ? "visible" : "hidden";
	});

	return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
