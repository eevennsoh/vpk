import { animate, type AnimationSequence } from "motion";

import {
	measureSessionDragGeometry,
	resolveSessionDragAvatarMorph,
	resolveSessionDragMorph,
	resolveSessionDragSurfaceStart,
	sessionDragGeometryRelativeToPointer,
	SESSION_DRAG_CHIP_ENTER_TRANSITION,
	type SessionDragGeometry,
} from "./agent-session-drag-motion";

/** One Motion timeline owns pickup; pointer travel and carry pose stay separate. */
export function startSessionDragMotionPickup(follower: HTMLElement, source: SessionDragGeometry | null, onComplete: () => void): () => void {
	const pill = follower.querySelector<HTMLElement>("[data-session-drag-pill]");
	const surface = pill?.querySelector<HTMLElement>("[data-session-drag-surface]");
	const identity = pill?.querySelector<HTMLElement>("[data-session-drag-identity]");
	const label = pill?.querySelector<HTMLElement>("[data-session-drag-label]");
	if (!pill || !surface || !identity || !label) return () => {};
	const geometry = measureSessionDragGeometry(pill);
	const pointer = follower.getBoundingClientRect();
	const target = geometry ? sessionDragGeometryRelativeToPointer(geometry, { x: pointer.left, y: pointer.top }) : null;
	const morph = source && target ? resolveSessionDragMorph(source, target, "compact") : null;
	const faces = [...follower.querySelectorAll<HTMLElement>("[data-session-drag-surface], [data-session-drag-flash-layer], [data-session-carry-light-surface]")];
	const radius = parseFloat(getComputedStyle(surface).borderTopLeftRadius);
	const pose = resolveSessionDragSurfaceStart(morph?.scaleX ?? 1, morph?.scaleY ?? 1, radius);
	const avatars = source && target ? (["human", "agent"] as const).flatMap((role) => {
		const from = source.avatars?.[role];
		const to = target.avatars?.[role];
		const element = identity.querySelector<HTMLElement>(`[data-avatar-role="${role}"]`);
		if (!from || !to || !element) return [];
		const avatar = resolveSessionDragAvatarMorph(from, to, source.identity, target.identity);
		return [{ element, transform: `translate(${avatar.x}px, ${avatar.y}px) scale(${avatar.scaleX}, ${avatar.scaleY})` }];
	}) : [];

	const moving = [...faces, ...avatars.map(({ element }) => element), label];
	const previous = moving.map((element) => ({ element, transform: element.style.transform, borderRadius: element.style.borderRadius,
		transformOrigin: element.style.transformOrigin, opacity: element.style.opacity, willChange: element.style.willChange }));
	const startRadius = `${pose.radiusX}px / ${pose.radiusY}px`;
	const endRadius = `${radius}px / ${radius}px`;
	// Install the first pose before paint. Every face, including both light
	// clips, receives the same precomputed keyframes at the timeline's origin.
	for (const face of faces) {
		face.style.transform = pose.transform;
		face.style.borderRadius = startRadius;
		face.style.transformOrigin = "center";
		face.style.willChange = "transform";
	}
	for (const { element, transform } of avatars) {
		element.style.transform = transform;
		element.style.transformOrigin = "0 0";
		element.style.willChange = "transform";
	}
	label.style.willChange = "opacity";
	label.style.opacity = "0";
	const sequence: AnimationSequence = [
		[faces, { transform: [pose.transform, "scale(1, 1)"], borderRadius: [startRadius, endRadius] }, { at: 0 }],
		...avatars.map(({ element, transform }): AnimationSequence[number] => [element, { transform: [transform, "translate(0px, 0px) scale(1, 1)"] }, { at: 0 }]),
		[label, { opacity: [0, 1] }, { at: 0 }],
	];
	const playback = animate(sequence, { defaultTransition: SESSION_DRAG_CHIP_ENTER_TRANSITION });
	let active = true;
	void playback.finished.then(() => {
		if (!active) return;
		for (const element of moving) element.style.willChange = "";
		onComplete();
	});
	return () => {
		active = false;
		playback.cancel();
		for (const { element, transform, borderRadius, transformOrigin, opacity, willChange } of previous) {
			element.style.transform = transform;
			element.style.borderRadius = borderRadius;
			element.style.transformOrigin = transformOrigin;
			element.style.opacity = opacity;
			element.style.willChange = willChange;
		}
	};
}
