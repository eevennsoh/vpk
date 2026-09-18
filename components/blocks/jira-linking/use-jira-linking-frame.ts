"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { parseColor } from "@/components/ui-custom/lib/shimmer-colors";

import {
	resolveJiraLinkingFrame,
	type JiraLinkingFrame,
	type JiraLinkingMember,
} from "./field";
import {
	resolveJiraLinkingDropSettleMs,
	type JiraLinkingDrop,
	type JiraLinkingDropProfile,
} from "./drop";
import {
	advanceJiraLinkingVelocity,
	lerpJiraLinkingTarget,
	resolveJiraLinkingFuseNearness,
	resolveJiraLinkingFuseProgress,
	JIRA_LINKING_FUSE_DURATION_MS,
	type JiraLinkingTarget,
	type JiraLinkingVector,
} from "./lifecycle";

/**
 * Both blobs are the *link material* — one substance the two subjects are
 * becoming — rather than the source's own surface colour. The field's whole job
 * is to show them merging, and it can only do that in a colour that reads
 * against the surface it necks across: tinting the source blob the same white as
 * the card underneath made the goo invisible on exactly the surface it matters
 * on. Resolved from a theme variable so dark mode gets its own grey.
 */
export const JIRA_LINKING_DEFAULT_SURFACE_VARIABLE = "--color-bg-accent-gray-subtlest";

/** Light-theme `--ds-background-accent-gray-subtlest`; only reached when a variable cannot be parsed. */
const FALLBACK_SURFACE_TINT: readonly [number, number, number] = [
	0xf0 / 255,
	0xf1 / 255,
	0xf2 / 255,
];

function resolveSurfaceTint(variable: string): readonly [number, number, number] {
	if (typeof document === "undefined") {
		return FALLBACK_SURFACE_TINT;
	}

	const raw = getComputedStyle(document.documentElement).getPropertyValue(variable);
	const parsed = parseColor(raw.trim());
	if (!parsed) {
		return FALLBACK_SURFACE_TINT;
	}

	return [parsed.r / 255, parsed.g / 255, parsed.b / 255];
}

interface JiraLinkingSourceRect {
	height: number;
	left: number;
	top: number;
	width: number;
}

export interface JiraLinkingRenderState {
	frame: JiraLinkingFrame | null;
	/** Echoed alongside the frame so the shader can aim its chromatic split. */
	velocity: JiraLinkingVector;
}

/**
 * Snapshot handed over at release.
 *
 * Captured rather than read live because the travelling source usually unmounts
 * in the same commit as the drop: the fuse has to keep animating from geometry
 * that no longer has a DOM node behind it.
 */
export interface JiraLinkingRelease {
	/** Monotonic, so a second drop on the same target restarts the fuse. */
	id: number;
	target: JiraLinkingTarget | null;
	/** Live destination geometry after layout or scrolling moves the target. */
	resolveTarget?: () => JiraLinkingTarget | null;
	/**
	 * Shape the fuse starts from, when the landing shape differs from the one the
	 * approach grew into.
	 *
	 * A host can grow the field into a whole card on approach but land the
	 * subject in one row of it. Snapshotting the approach shape here lets the two
	 * be interpolated instead of swapped, which would pop on the release frame.
	 */
	fromTarget?: JiraLinkingTarget | null;
	/**
	 * When set, subjects fly into `target` as chips after drop — staggered
	 * like the create well, instead of only running the goo fuse. For a card
	 * attach, pass the agent session row as `target`, not the whole card.
	 */
	drop?: JiraLinkingDrop;
}

/**
 * How long a release needs before it reports settled, in ms.
 *
 * A host that hangs real work off `onFuseSettled` uses this as the deadline it
 * falls back to. Chip flights and the goo fuse are two different clocks, and
 * only this module knows which one a given release is on.
 */
export function resolveJiraLinkingReleaseSettleMs(
	release: Readonly<JiraLinkingRelease>,
	profile: JiraLinkingDropProfile,
): number {
	return release.drop
		? resolveJiraLinkingDropSettleMs(release.drop, profile)
		: JIRA_LINKING_FUSE_DURATION_MS;
}

export interface JiraLinkingFrameSource {
	members: readonly JiraLinkingMember[];
	nearness: number;
	onFuseSettled?: () => void;
	release: JiraLinkingRelease | null;
	/** Measured every frame; the source element may move, resize, or vanish. */
	sourceSelector: string;
	surfaceVariable?: string;
	target: JiraLinkingTarget | null;
}

const IDLE_RENDER_STATE: JiraLinkingRenderState = {
	frame: null,
	velocity: { x: 0, y: 0 },
};

function measureSourceRect(selector: string): JiraLinkingSourceRect | null {
	const node = document.querySelector<HTMLElement>(selector);
	if (!node) {
		return null;
	}

	const rect = node.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return null;
	}

	return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
}

/**
 * Drive one field frame per animation frame.
 *
 * The loop owns three things the pure model cannot: measuring the travelling
 * source, differentiating that measurement into a velocity, and running the
 * post-release fuse clock. It never lists the gesture props as effect
 * dependencies — they change on every pointer move and the loop must not be torn
 * down and rebuilt each frame.
 */
export function useJiraLinkingFrame(
	source: Readonly<JiraLinkingFrameSource>,
): JiraLinkingRenderState {
	const [render, setRender] = useState<JiraLinkingRenderState>(IDLE_RENDER_STATE);
	const liveRef = useRef(source);
	// Changes at most once per gesture, so it is safe as an effect dependency
	// where the rest of `source` is not.
	const releaseKey = source.release?.id ?? null;

	useLayoutEffect(() => {
		liveRef.current = source;
	});

	useEffect(() => {
		let handle = 0;
		let cancelled = false;
		let sourceRect: JiraLinkingSourceRect | null = null;
		let previousCenter: JiraLinkingVector | null = null;
		let velocity: JiraLinkingVector = { x: 0, y: 0 };
		let lastNearness = 0;
		let fuseStartedAt = 0;
		let fusingReleaseId: number | null = null;
		let settledReleaseId: number | null = null;
		// Resolved once per mount, which is once per gesture.
		const surfaceTint = resolveSurfaceTint(
			liveRef.current.surfaceVariable ?? JIRA_LINKING_DEFAULT_SURFACE_VARIABLE,
		);

		const tick = (now: number) => {
			if (cancelled) return;
			const live = liveRef.current;
			// The source unmounts in the same commit as the drop, so an armed fuse
			// keeps animating from the last geometry the approach measured. The
			// approach itself gets no such licence: a source that legitimately
			// disappears mid-gesture would otherwise strand the field behind it.
			sourceRect = measureSourceRect(live.sourceSelector)
				?? (live.release ? sourceRect : null);

			const center = sourceRect
				? {
					x: sourceRect.left + sourceRect.width / 2,
					y: sourceRect.top + sourceRect.height / 2,
				}
				: null;
			velocity = advanceJiraLinkingVelocity(
				velocity,
				center && previousCenter
					? { x: center.x - previousCenter.x, y: center.y - previousCenter.y }
					: { x: 0, y: 0 },
			);
			previousCenter = center;

			const releaseId = live.release?.id ?? null;
			if (releaseId === null) {
				fusingReleaseId = null;
				lastNearness = live.nearness;
			} else if (fusingReleaseId !== releaseId) {
				fusingReleaseId = releaseId;
				fuseStartedAt = now;
			}
			const fuseProgress = releaseId === null
				? 0
				: resolveJiraLinkingFuseProgress(now - fuseStartedAt);
			// The release snapshot wins once it exists: by then the approach's own
			// target has already been cleared by the host. When that snapshot names
			// a different shape to start from, the fuse morphs between the two
			// rather than swapping them on its first frame.
			const target = live.release
				? lerpJiraLinkingTarget(
					live.release.fromTarget,
					live.release.target,
					fuseProgress,
				)
				: live.target;

			setRender({
				frame: resolveJiraLinkingFrame({
					sourceRect: sourceRect,
					sourceTint: surfaceTint,
					targetAnchor: target?.anchor ?? null,
					targetHeight: target?.height,
					targetRadius: target?.radius,
					targetTint: surfaceTint,
					targetWidth: target?.width ?? 0,
					fuseProgress,
					members: live.members,
					nearness: releaseId === null
						? lastNearness
						: resolveJiraLinkingFuseNearness(lastNearness, fuseProgress),
					pointer: center ?? { x: 0, y: 0 },
					velocity,
				}),
				velocity,
			});

			if (releaseId !== null && fuseProgress >= 1 && settledReleaseId !== releaseId) {
				settledReleaseId = releaseId;
				live.onFuseSettled?.();
			}

			// Park once the fuse has landed. `onFuseSettled` is optional, so a host
			// may legitimately leave `release` set — without this the loop would
			// keep resolving frames, and the canvas would keep its RAF and GL
			// context alive, for an effect that is finished and invisible. A new
			// release id re-runs this effect, which restarts the loop.
			if (releaseId !== null && settledReleaseId === releaseId) {
				return;
			}

			handle = requestAnimationFrame(tick);
		};

		handle = requestAnimationFrame(tick);
		return () => {
			cancelled = true;
			cancelAnimationFrame(handle);
		};
		// `release.id` is the only prop allowed to restart the loop. The rest
		// change on every pointer move and must not tear it down each frame.
	}, [releaseKey]);

	return render;
}
