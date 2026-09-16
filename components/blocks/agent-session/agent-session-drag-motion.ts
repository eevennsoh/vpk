import type { Transition } from "motion/react";

import type { PointerDragPosition } from "@/components/ui-custom/hooks/use-pointer-drag";

/**
 * The travelling drag chip is popup family: small, pointer-anchored, and
 * triggered dozens of times a session, so `.agents/rules/motion-decisions.md`
 * gives it `duration-normal` + `ease-out-practical` on enter. Motion cannot
 * read `var()`, so the token values are resolved here once and annotated.
 */
export const SESSION_DRAG_CHIP_ENTER_TRANSITION = {
	duration: 0.15,
	ease: [0.4, 1, 0.6, 1],
} satisfies Transition; // duration-normal + ease-out-practical

/** Marks the row's identity mark so the chip can fly out of the grabbed avatar. */
export const SESSION_DRAG_IDENTITY_SELECTOR = "[data-session-drag-identity]";

/** The static paper print must match the visible avatar before replacing it. */
export function isSessionDragIdentitySettled(identity: HTMLElement, capturedIdentity: HTMLElement | null): boolean {
	const avatar = identity.querySelector<HTMLElement>('[data-slot="human-agent-avatar"]');
	if (!avatar) return true;
	const capturedAvatar = capturedIdentity?.querySelector<HTMLElement>('[data-slot="human-agent-avatar"]');
	if (!capturedAvatar || avatar.dataset.composition !== "group") return false;
	const pose = (frame: HTMLElement) => {
		const present = [...frame.children].find((element) => element.getAttribute("aria-hidden") !== "true");
		const origin = frame.getBoundingClientRect();
		return [...present?.querySelectorAll('[data-avatar-role]') ?? []].map((element) => {
			const box = element.getBoundingClientRect();
			return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
		});
	};
	const visible = pose(avatar);
	const captured = pose(capturedAvatar);
	return visible.length === 2 && captured.length === 2 && visible.every((box, index) =>
		(["x", "y", "width", "height"] as const).every((dimension) => Math.abs(box[dimension] - captured[index][dimension]) < 0.5),
	);
}

/** The narrow slice of `HTMLElement` the measurement needs, so it stays testable. */
interface SessionDragIdentityHost {
	querySelector: (selector: string) => { getBoundingClientRect: () => DOMRect } | null;
}

type SessionDragRect = Readonly<Pick<DOMRect, "left" | "top" | "width" | "height">>;

export interface SessionDragGeometry {
	readonly surface: SessionDragRect;
	readonly identity: SessionDragRect;
}

/** Read both boxes before the source dims or leaves flow. */
export function measureSessionDragGeometry(
	host: SessionDragIdentityHost & { getBoundingClientRect: () => DOMRect },
): SessionDragGeometry | null {
	const identity = host.querySelector(SESSION_DRAG_IDENTITY_SELECTOR)?.getBoundingClientRect();
	const surface = host.getBoundingClientRect();
	return identity && identity.width > 0 && identity.height > 0 && surface.width > 0 && surface.height > 0
		? { surface, identity }
		: null;
}

/** Both the source and portal measure in the pointer's coordinate space. */
export function sessionDragGeometryRelativeToPointer(
	geometry: SessionDragGeometry,
	pointer: PointerDragPosition,
): SessionDragGeometry {
	const relative = (rect: SessionDragRect): SessionDragRect => ({
		left: rect.left - pointer.x,
		top: rect.top - pointer.y,
		width: rect.width,
		height: rect.height,
	});
	return { surface: relative(geometry.surface), identity: relative(geometry.identity) };
}

/** Scale only the background; the shared avatar moves without deformation. */
export function resolveSessionDragMorph(source: SessionDragGeometry, target: SessionDragGeometry) {
	return {
		x: source.surface.left - target.surface.left,
		y: source.surface.top - target.surface.top,
		scaleX: source.surface.width / target.surface.width,
		scaleY: source.surface.height / target.surface.height,
		identityX: source.identity.left - source.surface.left - (target.identity.left - target.surface.left),
		identityY: source.identity.top - source.surface.top - (target.identity.top - target.surface.top),
	};
}
