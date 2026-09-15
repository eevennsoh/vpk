"use client";

/**
 * Peel — scene graph and frame loop.
 *
 * One useFrame does everything: step the motion model, copy it into the two
 * materials, and write the drag translation straight onto the lift element
 * through a ref. Nothing here sets React state, so a drag costs zero renders.
 *
 * Pointer position arrives as raw client coordinates captured by the wrapper's
 * event handlers. Converting them (which needs a getBoundingClientRect) happens
 * here, once per frame, before any write — the house performance rule for
 * continuous pointer work.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import type { PeelTuning } from "./data";
import { createPeelMaterial } from "./peel-material";
import {
	PEEL_REST_TILT_Y,
	PEEL_TILT_REFERENCE_SPEED,
	isPeelIdle,
	peelImpulseEnergy,
	peelPivotOffset,
	stepPeel,
	type PeelState,
} from "./peel-model";
import { resolvePeelUv, type PeelBox, type PeelPointerSample } from "./peel-geometry";
import { PEEL_SHADOW_PAD, createPeelShadowMaterial } from "./shadow-material";

/**
 * Plane subdivision. The shortest wavelength the tuning allows spans about six
 * segments at 48, which is where the ripple stops showing facets; going higher
 * costs vertices without changing the picture.
 */
const SHEET_SEGMENTS = 48;

export interface PeelSceneProps {
	/** Stable model instance, shared with the wrapper's event handlers. */
	state: PeelState;
	tuning: PeelTuning;
	/** Element carrying the drag translation. */
	liftRef: RefObject<HTMLElement | null>;
	/** Element whose box defines the sheet, used to resolve pointer UV. */
	hitRef: RefObject<HTMLElement | null>;
	pointerRef: RefObject<PeelPointerSample>;
	/** Unrotated CSS size and resting angle of the sheet. */
	box: PeelBox;
	aspect: number;
	surfaceColor: string;
	/** Artwork printed on the sheet, edge to edge. */
	src?: string;
	/** Fires when the model settles or wakes, so the canvas can stop rendering. */
	onIdleChange: (idle: boolean) => void;
}

export function PeelScene({
	state,
	tuning,
	liftRef,
	hitRef,
	pointerRef,
	box,
	aspect,
	surfaceColor,
	src,
	onIdleChange,
}: Readonly<PeelSceneProps>) {
	const invalidate = useThree((root) => root.invalidate);
	const capabilities = useThree((root) => root.gl.capabilities);
	const sheetRef = useRef<THREE.Mesh>(null);
	const idleRef = useRef(true);

	const sheetGeometry = useMemo(
		() => new THREE.PlaneGeometry(aspect, 1, SHEET_SEGMENTS, SHEET_SEGMENTS),
		[aspect],
	);
	const shadowGeometry = useMemo(
		() =>
			new THREE.PlaneGeometry(
				aspect * (1 + 2 * PEEL_SHADOW_PAD),
				1 + 2 * PEEL_SHADOW_PAD,
			),
		[aspect],
	);
	const sheetMaterial = useMemo(
		() => createPeelMaterial({ aspect, surfaceColor }),
		[aspect, surfaceColor],
	);
	const shadowMaterial = useMemo(
		() => createPeelShadowMaterial({ aspect }),
		[aspect],
	);

	useEffect(
		() => () => {
			sheetGeometry.dispose();
			shadowGeometry.dispose();
			sheetMaterial.uniforms.uArt.value?.dispose();
			sheetMaterial.dispose();
			shadowMaterial.dispose();
		},
		[sheetGeometry, shadowGeometry, sheetMaterial, shadowMaterial],
	);

	// Loaded imperatively rather than through a suspending hook, so a slow
	// image never unmounts the canvas: the sheet renders as bare stock and the
	// print appears when it arrives.
	useEffect(() => {
		if (!src) {
			sheetMaterial.uniforms.uArtReady.value = 0;
			invalidate();
			return;
		}

		let cancelled = false;
		new THREE.TextureLoader().load(
			src,
			(texture) => {
				if (cancelled) {
					texture.dispose();
					return;
				}
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.anisotropy = capabilities.getMaxAnisotropy();
				sheetMaterial.uniforms.uArt.value?.dispose();
				sheetMaterial.uniforms.uArt.value = texture;
				sheetMaterial.uniforms.uArtReady.value = 1;
				// The canvas may already be parked on the demand loop.
				invalidate();
			},
			undefined,
			() => {
				// A missing image is not a broken component: bare stock is a
				// legible state on its own.
				if (!cancelled) {
					sheetMaterial.uniforms.uArtReady.value = 0;
					invalidate();
				}
			},
		);

		return () => {
			cancelled = true;
		};
	}, [src, sheetMaterial, capabilities, invalidate]);

	useFrame((_, delta) => {
		readPointer(state, pointerRef.current, hitRef.current, box);
		stepPeel(state, delta);

		const sheet = sheetMaterial.uniforms;
		sheet.uLift.value = state.lift;
		sheet.uLiftHeight.value = tuning.liftHeight;
		sheet.uPivot.value = tuning.peelPivot;
		sheet.uGrab.value.set(state.grabU, state.grabV);
		sheet.uPointer.value.set(state.pointerU, state.pointerV);
		sheet.uSheen.value = state.sheen;
		sheet.uTime.value = state.time;
		sheet.uWave.value.set(tuning.waveAmplitude, tuning.waveLength, tuning.waveSpeed);
		sheet.uShear.value = tuning.waveShear;
		sheet.uFlutter.value = tuning.flutter;
		// Carrying the sheet faster flexes it more, which is most of what makes
		// a dragged sticker read as paper rather than as a sprite being moved.
		sheet.uSpeed.value = Math.min(
			Math.hypot(state.velocityX, state.velocityY) / PEEL_TILT_REFERENCE_SPEED,
			1,
		);
		sheet.uFilm.value = tuning.filmScale;
		sheet.uGloss.value = tuning.glossCoverage;
		sheet.uSheenGain.value = tuning.sheenGain;
		sheet.uGrain.value = tuning.grain;
		sheet.uRestSheen.value = tuning.restSheen;

		for (let index = 0; index < state.impulses.length; index += 1) {
			const impulse = state.impulses[index];
			const age = Number.isFinite(impulse.age) ? impulse.age : 0;
			sheet.uImpulses.value[index].set(
				impulse.originU,
				impulse.originV,
				age,
				peelImpulseEnergy(impulse),
			);
		}

		const shadow = shadowMaterial.uniforms;
		shadow.uLift.value = state.lift;
		shadow.uStrength.value = tuning.shadowStrength;
		// The same three the sheet's vertex displacement reads, so the shadow's
		// seam can be put under the sheet's projected outline instead of under a
		// sheet-wide average of it. A sheet held by one corner is magnified 1.079
		// there and 1.001 at the far end, and a single dilation is wrong at both.
		shadow.uLiftHeight.value = tuning.liftHeight;
		shadow.uPivot.value = tuning.peelPivot;
		shadow.uGrab.value.set(state.grabU, state.grabV);

		if (sheetRef.current) {
			// The sheet is never square to the camera, even lying flat — see
			// PEEL_REST_TILT_Y. Carrying it adds to that pose rather than
			// replacing it, so the keystone survives the drag.
			sheetRef.current.rotation.set(state.tiltX, state.tiltY + PEEL_REST_TILT_Y, 0);
		}

		const lift = liftRef.current;
		if (lift) {
			// The swing is applied here, in the CSS transform, and deliberately
			// not as a Z component on the mesh rotation above: rotating the
			// sheet inside a fixed canvas would shear its corners off against
			// the overscan, and it would desync `resolvePeelUv`, which
			// unrotates client coordinates by the same total angle.
			//
			// `rotate()` turns the element about its centre; the reference
			// stamp swings about the hand instead, so the offset below moves
			// the pivot to the measured point between the two. It leaves the
			// rotated sheet's centre where `resolvePeelUv` expects it, because
			// the element's own box moves with it.
			//
			// The landing shear is a skew and not a second rotation, and it is
			// written after the rotate so it applies in the sheet's own frame:
			// CSS composes left to right, so the point is sheared first and the
			// result rotated. It gets a pivot of its own from the same helper:
			// a bare skewX holds the element's horizontal centreline still and
			// swings both halves of the sheet in opposite directions, which is
			// the centro-symmetric landing a blind critique caught. The corner
			// that just planted is what should stay put.
			const degrees = ((box.rotation + state.swing) * 180) / Math.PI;
			const skew = (state.skew * 180) / Math.PI;
			const pivot = peelPivotOffset(state, box.width, box.height, box.rotation);
			const x = state.x + pivot.x;
			const y = state.y + pivot.y;
			lift.style.transform =
				`translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) ` +
				`rotate(${degrees.toFixed(3)}deg) skewX(${skew.toFixed(3)}deg)`;
		}

		const idle = isPeelIdle(state);
		if (idle !== idleRef.current) {
			idleRef.current = idle;
			onIdleChange(idle);
		}
	});

	return (
		<>
			<mesh
				geometry={shadowGeometry}
				material={shadowMaterial}
				position={[0, 0, -0.002]}
			/>
			<mesh ref={sheetRef} geometry={sheetGeometry} material={sheetMaterial} />
		</>
	);
}

/**
 * Resolves the latest raw pointer sample into sheet UV.
 *
 * Only done while the sheet is at rest under the cursor. Once it is held, the
 * cursor is pinned to the spot it grabbed — the sheet is following the pointer,
 * so re-deriving UV from a moving box would make the highlight crawl across a
 * surface the user is holding still relative to their hand.
 */
function readPointer(
	state: PeelState,
	sample: PeelPointerSample,
	element: HTMLElement | null,
	box: PeelBox,
): void {
	if (state.held || !sample.valid || !element) {
		return;
	}

	const uv = resolvePeelUv(element, box, sample.clientX, sample.clientY, state.swing);
	state.pointerTargetU = uv.u;
	state.pointerTargetV = uv.v;
}
