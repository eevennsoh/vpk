/**
 * The deep field the river runs across.
 *
 * A single `THREE.Points` slab between `starDepthFar` and `starDepthNear`, all
 * of it behind the orb's focal plane. Points, not quads: a star is a point
 * source with nothing to orient, and one draw call carries all 1,400 of them.
 *
 * Two details do the heavy lifting. The slab is genuinely deep, so `x`/`y` have
 * to widen with distance or its far half would only fill the middle of the
 * frame. And `gl_PointSize` is driven by perspective, so a far star really is
 * smaller — which means most of them land under a pixel, where the fix is to
 * hold the sprite at ~1 px and pay the lost area back in brightness. Snapping
 * sub-pixel sprites up without that compensation is what turns a starfield into
 * a shimmering mess the moment anything moves.
 */

import * as THREE from "three";

import { mulberry32 } from "./flow-model";
import type { DropzoneLayout } from "./tuning";
import { STAR_SIZE_MAX, STAR_SIZE_MIN } from "./tuning";
import { lerp } from "@/lib/math";

/**
 * How far past the frame edge the field extends, at every depth. A quarter of a
 * viewport is enough that the corners stay populated without spending points
 * where they can never be seen.
 */
const VIEW_MARGIN = 1.25;

/**
 * Exponents on a uniform 0-1 draw. Both distributions are pulled hard toward
 * their floor: measured off the reference, the overwhelming majority of stars
 * are faint specks sitting around 15-35 % brightness, with only a handful of
 * bright ones carrying the composition.
 */
const SIZE_SKEW = 3.2;
const BRIGHTNESS_SKEW = 4.6;
/** Dimmest a star may be. Below this it is indistinguishable from the backdrop. */
const BRIGHTNESS_MIN = 0.12;

/** Faint warm white, and faint blue-white. `aHue` mixes between the two. */
const COLOR_WARM = new THREE.Color(1.0, 0.94, 0.86);
const COLOR_COOL = new THREE.Color(0.8, 0.88, 1.0);

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
/** Camera distance in px, so the size falloff matches the 1 unit = 1 px rig. */
uniform float uCameraDistance;

attribute float aSize;
attribute float aBrightness;
attribute float aTwinkle;
attribute float aHue;

varying float vIntensity;
varying float vHue;

void main() {
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * mvPosition;

	// True perspective size: at the focal plane this is aSize px exactly, and a
	// star twice as far away is drawn half as wide.
	float wanted = aSize * (uCameraDistance / max(-mvPosition.z, 1.0)) * uPixelRatio;
	float drawn = max(wanted, 0.8 * uPixelRatio);
	gl_PointSize = drawn;

	// Sub-pixel stars get rasterised larger than they should be, so hand the
	// surplus area back as lost intensity. Total flux is what the eye reads, and
	// preserving it here is what keeps the far slab from crawling with aliasing.
	float area = wanted / drawn;

	// Two slow, incommensurate sinusoids: never repeats, never syncs across the
	// field, and peaks at +-12 % so it reads as air rather than as blinking.
	float twinkle = 1.0
		+ 0.08 * sin(uTime * 0.62 + aTwinkle)
		+ 0.04 * sin(uTime * 0.97 + aTwinkle * 2.3);

	vIntensity = aBrightness * twinkle * area * area;
	vHue = aHue;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uWarm;
uniform vec3 uCool;

varying float vIntensity;
varying float vHue;

void main() {
	// 0 at the sprite centre, 1 at the inscribed circle.
	float d = length(gl_PointCoord - 0.5) * 2.0;

	// A tight core for the star itself, plus a wide, very faint skirt. Real
	// stars bloom, and without the skirt a 1 px point reads as a dead dot.
	float core = exp(-d * d * 9.0);
	float halo = exp(-d * d * 1.6) * 0.085;
	// The sprite is square; fade the skirt out before its corners can show.
	// Inverted rather than descending: GLSL leaves smoothstep undefined when
	// edge0 >= edge1.
	float shape = (core + halo) * (1.0 - smoothstep(0.72, 1.0, d));

	// Premultiplied at zero alpha, so the field composites additively over the
	// black backdrop instead of punching holes in whatever is behind it.
	gl_FragColor = vec4(mix(uWarm, uCool, vHue) * vIntensity * shape, 0.0);
}
`;

/** A built starfield, owned by the scene and driven once per frame. */
export interface Starfield {
	object: THREE.Points;
	/** Called each frame with absolute scene time in seconds. */
	update(time: number): void;
	/** Device pixel ratio, so point sizes stay correct on a retina drawing buffer. */
	setPixelRatio(ratio: number): void;
	dispose(): void;
}

/**
 * Builds the field for a resolved layout. `seed` is exposed so a scene replays
 * identically across reloads and in tests; only pass something else when two
 * fields must coexist without visibly repeating.
 */
export function createStarfield(layout: DropzoneLayout, seed = 1337): Starfield {
	const rng = mulberry32(seed);
	const count = layout.starCount;

	const positions = new Float32Array(count * 3);
	const sizes = new Float32Array(count);
	const brightness = new Float32Array(count);
	const twinkle = new Float32Array(count);
	const hue = new Float32Array(count);

	for (let i = 0; i < count; i += 1) {
		// Depth first: how wide this star's slice of the slab has to be is a
		// function of how far away it ends up.
		const z = lerp(layout.starDepthFar, layout.starDepthNear, rng());
		const spread = ((layout.cameraDistance - z) / layout.cameraDistance) * VIEW_MARGIN;

		positions[i * 3] = (rng() - 0.5) * layout.width * spread;
		positions[i * 3 + 1] = (rng() - 0.5) * layout.height * spread;
		positions[i * 3 + 2] = z;

		sizes[i] = STAR_SIZE_MIN + (STAR_SIZE_MAX - STAR_SIZE_MIN) * rng() ** SIZE_SKEW;
		brightness[i] = BRIGHTNESS_MIN + (1 - BRIGHTNESS_MIN) * rng() ** BRIGHTNESS_SKEW;
		twinkle[i] = rng() * Math.PI * 2;
		// Averaged draws bunch the hue around neutral, leaving only the tails
		// warm or blue. A field of evenly coloured stars looks synthetic.
		hue[i] = (rng() + rng() + rng()) / 3;
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
	geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
	geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkle, 1));
	geometry.setAttribute("aHue", new THREE.BufferAttribute(hue, 1));

	const uniforms = {
		uTime: { value: 0 },
		uPixelRatio: { value: 1 },
		uCameraDistance: { value: layout.cameraDistance },
		uWarm: { value: COLOR_WARM.clone() },
		uCool: { value: COLOR_COOL.clone() },
	};

	const material = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms,
		transparent: true,
		depthWrite: false,
		premultipliedAlpha: true,
		blending: THREE.NormalBlending,
	});

	const object = new THREE.Points(geometry, material);
	// The slab is far wider than the frustum and never moves; culling it would
	// only cost a bounding-sphere test that can never succeed.
	object.frustumCulled = false;

	return {
		object,
		update(time) {
			uniforms.uTime.value = time;
		},
		setPixelRatio(ratio) {
			uniforms.uPixelRatio.value = ratio;
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}
