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
import type { MotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import type { PeelTuning } from "./data";
import { createPeelMaterial } from "./peel-material";
import {
	PEEL_REST_TILT_Y,
	PEEL_TILT_REFERENCE_SPEED,
	isPeelIdle,
	peelImpulseEnergy,
	peelFlashEnergy,
	peelFlashProgress,
	peelPivotOffset,
	stepPeel,
	type PeelState,
} from "./peel-model";
import { deformPeelSheet, resolvePeelUv, type PeelBox, type PeelPointerSample } from "./peel-geometry";
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
	/** A captured live component, drawn full bleed with its original alpha. */
	print?: HTMLCanvasElement;
	/** The existing avatar accent, resolved to a literal CSS colour by the surface. */
	flashColor?: string;
	shape?: "stamp" | "surface";
	/** External drag follower; sampled once per frame, never during render. */
	pointerPosition?: { x: MotionValue<number>; y: MotionValue<number> };
	onReady?: () => void;
	/** After a frame draws, for a prepared preview's visibility handoff. */
	onRender?: () => void;
	/** Fires when the model settles or wakes, so the canvas can stop rendering. */
	onIdleChange?: (idle: boolean) => void;
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
	print,
	flashColor,
	shape = "stamp",
	pointerPosition,
	onReady,
	onRender,
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
	const originalPositions = useMemo(
		() => (sheetGeometry.attributes.position.array as Float32Array).slice(),
		[sheetGeometry],
	);
	const foldPoseRef = useRef({ progress: NaN, angle: NaN, curl: NaN, lift: NaN, geometry: sheetGeometry });
	const shadowGeometry = useMemo(
		() =>
			new THREE.PlaneGeometry(
				aspect * (1 + 2 * PEEL_SHADOW_PAD),
				1 + 2 * PEEL_SHADOW_PAD,
			),
		[aspect],
	);
	const sheetMaterial = useMemo(
		() => createPeelMaterial({ aspect, surfaceColor, shape }),
		[aspect, surfaceColor, shape],
	);
	const shadowMaterial = useMemo(
		() => createPeelShadowMaterial({ aspect }),
		[aspect],
	);

	// Redraw a parked canvas when its finish or motion preference changes.
	// The frame reports whether the updated model needs continuous rendering.
	useEffect(() => invalidate(), [tuning, invalidate]);

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
		if (print) {
			const texture = new THREE.CanvasTexture(print);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = capabilities.getMaxAnisotropy();
			sheetMaterial.uniforms.uArt.value?.dispose();
			sheetMaterial.uniforms.uArt.value = texture;
			sheetMaterial.uniforms.uArtReady.value = 1;
			invalidate();
			return;
		}
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
	}, [src, print, sheetMaterial, capabilities, invalidate]);
	useEffect(() => {
		if (flashColor) sheetMaterial.uniforms.uFlashColor.value.set(flashColor);
		invalidate();
	}, [flashColor, sheetMaterial, invalidate]);
	const readyRef = useRef(false);
	const handleAfterRender = useCallback(() => {
		if (sheetMaterial.uniforms.uArtReady.value !== 1) return;
		if (!readyRef.current) {
			readyRef.current = true;
			onReady?.();
		} else onRender?.();
	}, [sheetMaterial, onReady, onRender]);

	useFrame((_, delta) => {
		if (pointerPosition) {
			state.targetX = pointerPosition.x.get();
			state.targetY = pointerPosition.y.get();
		}
		readPointer(state, pointerRef.current, hitRef.current, box);
		stepPeel(state, delta);

		const pose = foldPoseRef.current;
		if (pose.geometry !== sheetGeometry || pose.progress !== state.fold || pose.angle !== state.foldAngle || pose.curl !== tuning.peelPivot || pose.lift !== tuning.liftHeight) {
			deformPeelSheet(
				originalPositions,
				sheetGeometry.attributes.position.array as Float32Array,
				sheetGeometry.attributes.normal.array as Float32Array,
				aspect,
				state.fold,
				state.foldAngle,
				state.reducedMotion ? 0 : tuning.peelPivot,
				tuning.liftHeight,
			);
			sheetGeometry.attributes.position.needsUpdate = true;
			sheetGeometry.attributes.normal.needsUpdate = true;
			pose.geometry = sheetGeometry;
			pose.progress = state.fold;
			pose.angle = state.foldAngle;
			pose.curl = tuning.peelPivot;
			pose.lift = tuning.liftHeight;
		}

		const sheet = sheetMaterial.uniforms;
		sheet.uLift.value = state.lift;
		sheet.uPointer.value.set(state.pointerU, state.pointerV);
		sheet.uSheen.value = state.sheen;
		sheet.uTime.value = state.time;
		sheet.uFlashGain.value = flashColor ? peelFlashEnergy(state) : 0;
		sheet.uFlashProgress.value = peelFlashProgress(state);
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
		shadow.uLift.value = state.fold;
		shadow.uStrength.value = tuning.shadowStrength;
		// The fold owns the paper's shape; the shadow follows its travel and
		// final rise without adding the previous corner-to-corner rock.
		shadow.uLiftHeight.value = tuning.liftHeight;
		shadow.uPivot.value = 0;
		shadow.uGrab.value.set(state.grabU, state.grabV);

		if (sheetRef.current) {
			// The sheet is never square to the camera, even lying flat — see
			// PEEL_REST_TILT_Y. Carrying it adds to that pose rather than
			// replacing it, so the keystone survives the drag.
			sheetRef.current.rotation.set(state.tiltX, state.tiltY + (shape === "stamp" ? PEEL_REST_TILT_Y : 0), 0);
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
		// A tuning change can wake an already-idle model. Report idle on that
		// first frame as well, so the canvas returns to demand rendering.
		if (idle || idle !== idleRef.current) {
			idleRef.current = idle;
			onIdleChange?.(idle);
		}
	});

	return (
		<>
			{shape === "stamp" ? <mesh
				geometry={shadowGeometry}
				material={shadowMaterial}
				position={[0, 0, -0.002]}
			/> : null}
			<mesh ref={sheetRef} geometry={sheetGeometry} material={sheetMaterial} onAfterRender={handleAfterRender} />
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
