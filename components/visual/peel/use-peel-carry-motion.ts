"use client";

import { useEffect, type RefObject } from "react";

import { PEEL_CAMERA_DISTANCE, resolvePeelSurfaceTuning } from "./data";
import { peelSurfaceEdgeGlow, peelSurfacePointer, peelSurfaceRoll, peelSurfaceTilt } from "./peel-geometry";
import { createPeelState, grabPeel, stepPeel } from "./peel-model";
import type { PeelSurfaceProps } from "./peel-surface";

type CarryMotionProps = Pick<PeelSurfaceProps, "active" | "pointerX" | "pointerY" | "pointerDirection" | "pointerOriginX" | "tuning"> & {
	reducedMotion: boolean;
	frameRef: RefObject<HTMLDivElement | null>;
	paintRef: RefObject<HTMLDivElement | null>;
	leftLightRef: RefObject<HTMLSpanElement | null>;
	rightLightRef: RefObject<HTMLSpanElement | null>;
};

/** Reuse paper's pose springs without delaying the host's pointer translation. */
export function usePeelCarryMotion({ active, reducedMotion, pointerX, pointerY, pointerDirection, pointerOriginX, tuning, frameRef, paintRef, leftLightRef, rightLightRef }: Readonly<CarryMotionProps>) {
	useEffect(() => {
		const frame = frameRef.current;
		const paint = paintRef.current;
		const leftLight = leftLightRef.current;
		const rightLight = rightLightRef.current;
		if (!active || reducedMotion || !frame || !paint) return;
		const resolved = resolvePeelSurfaceTuning(tuning);
		const state = createPeelState(resolved);
		let carryOriginX = pointerX.get();
		let unsubscribe: Array<() => void> = [];
		let pendingFrame = 0;
		let previousTime = performance.now();
		const draw = (time: number) => {
			pendingFrame = 0;
			state.targetX = pointerX.get();
			state.targetY = pointerY.get();
			state.pointerTargetU = peelSurfacePointer(state.targetX - carryOriginX);
			state.pointerTargetV = 0.5;
			stepPeel(state, (time - previousTime) / 1000);
			previousTime = time;
			const tilt = peelSurfaceTilt(state.tiltY, state.pointerU, resolved.tilt);
			const roll = peelSurfaceRoll(state.swing, resolved.swing);
			const light = peelSurfaceEdgeGlow(tilt, roll, resolved.tilt, resolved.swing, pointerDirection.get());
			paint.style.transform = `rotateY(${tilt}rad) rotateZ(${roll}rad)`;
			if (leftLight) leftLight.style.opacity = String(Math.max(-light, 0) * 0.24);
			if (rightLight) rightLight.style.opacity = String(Math.max(light, 0) * 0.24);
			// Wave/flutter are not rendered by this face. Park once the carry pose
			// settles; subscribed input wakes it without a React update.
			const settled = Math.abs(state.x - state.targetX) < 0.05 && Math.abs(state.y - state.targetY) < 0.05
				&& Math.abs(state.velocityX) < 0.05 && Math.abs(state.velocityY) < 0.05
				&& Math.abs(state.tiltY) < 1e-4 && Math.abs(state.tiltVelocityY) < 1e-3
				&& Math.abs(state.swing) < 1e-4 && Math.abs(state.swingVelocity) < 1e-3
				&& Math.abs(state.pointerU - state.pointerTargetU) < 1e-4;
			if (!settled) pendingFrame = requestAnimationFrame(draw);
			else paint.style.willChange = "";
		};
		const wake = () => {
			if (pendingFrame) return;
			previousTime = performance.now();
			paint.style.willChange = "transform";
			pendingFrame = requestAnimationFrame(draw);
		};
		const beginCarry = () => {
			// Pickup stays level. Motion accumulated while the shape contracts
			// must not become a delayed rotation impulse when carry begins.
			carryOriginX = pointerX.get();
			state.x = state.targetX = carryOriginX;
			state.y = state.targetY = pointerY.get();
			grabPeel(state, 0.25, 0.1);
			state.pointerU = state.pointerTargetU = 0.5;
			// Match the captured paper's 24px frame padding and camera distance.
			frame.style.perspective = `${(paint.offsetHeight + 48) * PEEL_CAMERA_DISTANCE}px`;
			frame.dataset.sessionCarryReady = "true";
			unsubscribe = [pointerX, pointerY, pointerDirection, pointerOriginX].map((value) => value.on("change", wake));
			wake();
		};
		// The host enables this effect only once its complete pickup timeline
		// settles. Do not infer readiness from animation implementation types.
		beginCarry();
		return () => {
			for (const stop of unsubscribe) stop();
			cancelAnimationFrame(pendingFrame);
			paint.style.transform = "rotateY(0rad) rotateZ(0rad)";
			paint.style.willChange = "";
			frame.style.perspective = "";
			delete frame.dataset.sessionCarryReady;
			if (leftLight) leftLight.style.opacity = "0";
			if (rightLight) rightLight.style.opacity = "0";
		};
	}, [active, reducedMotion, pointerX, pointerY, pointerDirection, pointerOriginX, tuning, frameRef, paintRef, leftLightRef, rightLightRef]);
}
