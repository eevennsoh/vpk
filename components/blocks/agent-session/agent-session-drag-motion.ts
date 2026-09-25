import type { Transition } from "motion/react";

import type { PointerDragPosition } from "@/components/ui-custom/hooks/use-pointer-drag";

/** Standalone parity: duration-slower + ease-in-out, independent of pointer travel. */
export const SESSION_DRAG_CHIP_ENTER_TRANSITION = {
	duration: 0.4,
	ease: [0.4, 0, 0, 1],
} satisfies Transition;

/** Paper keeps its existing fast popup-family entrance. */
export const SESSION_PEEL_CHIP_ENTER_TRANSITION = {
	duration: 0.1,
	ease: [0.4, 1, 0.6, 1],
} satisfies Transition; // duration-fast + ease-out-practical

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
interface SessionDragMeasuredElement {
	getBoundingClientRect: () => DOMRect;
	querySelector?: (selector: string) => SessionDragMeasuredElement | null;
}

interface SessionDragIdentityHost {
	querySelector: (selector: string) => SessionDragMeasuredElement | null;
}

type SessionDragRect = Readonly<Pick<DOMRect, "left" | "top" | "width" | "height">>;

export type SessionDragAvatarRole = "human" | "agent";

export interface SessionDragGeometry {
	readonly surface: SessionDragRect;
	readonly identity: SessionDragRect;
	readonly avatars?: Partial<Record<SessionDragAvatarRole, SessionDragRect>>;
}

/** Read both boxes before the source dims or leaves flow. */
export function measureSessionDragGeometry(
	host: SessionDragIdentityHost & { getBoundingClientRect: () => DOMRect },
): SessionDragGeometry | null {
	const identityElement = host.querySelector(SESSION_DRAG_IDENTITY_SELECTOR);
	const identity = identityElement?.getBoundingClientRect();
	const surface = host.getBoundingClientRect();
	if (!identity || identity.width <= 0 || identity.height <= 0 || surface.width <= 0 || surface.height <= 0) return null;
	const avatars: Partial<Record<SessionDragAvatarRole, SessionDragRect>> = {};
	for (const role of ["human", "agent"] as const) {
		const element = identityElement?.querySelector?.(`[data-avatar-role="${role}"]`);
		const box = element?.getBoundingClientRect();
		if (box && box.width > 0 && box.height > 0) avatars[role] = box;
	}
	return { surface, identity, ...(Object.keys(avatars).length ? { avatars } : {}) };
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
	return {
		surface: relative(geometry.surface),
		identity: relative(geometry.identity),
		...(geometry.avatars ? { avatars: Object.fromEntries(Object.entries(geometry.avatars).map(([role, box]) => [role, relative(box)])) } : {}),
	};
}

/** Preserve the source avatar composition inside the pointer-anchored identity. */
export function resolveSessionDragAvatarMorph(
	source: SessionDragRect,
	target: SessionDragRect,
	sourceIdentity: SessionDragRect,
	targetIdentity: SessionDragRect,
) {
	return {
		x: source.left - sourceIdentity.left - (target.left - targetIdentity.left),
		y: source.top - sourceIdentity.top - (target.top - targetIdentity.top),
		scaleX: source.width / target.width,
		scaleY: source.height / target.height,
	};
}

/** Compact pickup stays at the pointer; paper retains its captured source pose. */
export function resolveSessionDragMorph(
	source: SessionDragGeometry,
	target: SessionDragGeometry,
	surfaceMode: "source" | "compact" = "source",
) {
	if (surfaceMode === "compact") {
		return {
			x: 0,
			y: 0,
			scaleX: Math.min(source.surface.width / target.surface.width, 1.4),
			scaleY: Math.min(source.surface.height / target.surface.height, 1.4),
			identityX: 0,
			identityY: 0,
		};
	}
	const surface = source.surface;
	// Center scaling grows on both sides. Compensate the paper's traveller
	// while its identity keeps the same captured position in viewport space.
	const surfaceOffsetX = (surface.width - target.surface.width) / 2;
	const surfaceOffsetY = (surface.height - target.surface.height) / 2;
	return {
		x: surface.left - target.surface.left + surfaceOffsetX,
		y: surface.top - target.surface.top + surfaceOffsetY,
		scaleX: surface.width / target.surface.width,
		scaleY: surface.height / target.surface.height,
		identityX: source.identity.left - surface.left - (target.identity.left - target.surface.left) - surfaceOffsetX,
		identityY: source.identity.top - surface.top - (target.identity.top - target.surface.top) - surfaceOffsetY,
	};
}

/** Pickup starts with corrected corners, then settles to the resting radius. */
export function resolveSessionDragSurfaceStart(scaleX: number, scaleY: number, radius: number) {
	return { transform: `scale(${scaleX}, ${scaleY})`, radiusX: radius / scaleX, radiusY: radius / scaleY };
}
