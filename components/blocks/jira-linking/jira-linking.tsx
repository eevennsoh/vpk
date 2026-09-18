"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

import { JiraLinkingDropFlights } from "./jira-linking-flight";
import { JiraLinkingGlow } from "./jira-linking-glow";
import { isJiraLinkingActive, type JiraLinkingTarget } from "./lifecycle";
import {
	useJiraLinkingAtlas,
	type JiraLinkingIdentity,
} from "./use-jira-linking-atlas";
import {
	useJiraLinkingFrame,
	type JiraLinkingRelease,
} from "./use-jira-linking-frame";

// Keeps the GLSL out of the host's initial bundle; it only loads once a subject
// actually approaches a target.
const JiraLinkingCanvas = dynamic(
	() => import("./jira-linking-canvas").then((module) => module.JiraLinkingCanvas),
	{ ssr: false },
);

/** Default portal stacking order: below a typical drag layer, above the page. */
const DEFAULT_Z_INDEX = 290;

export type JiraLinkingVariant = "fuse" | "glow";

export interface JiraLinkingProps {
	/** Fuse keeps the shader field; Glow uses the reference card-collapse motion. */
	variant?: JiraLinkingVariant;
	/**
	 * CSS selector for the travelling element, re-measured every frame. It is a
	 * selector rather than a ref because the element is usually a portal the host
	 * mounts and unmounts mid-gesture, so there is no stable node to hold.
	 *
	 * Resolved against the whole document, so it must be unique per instance.
	 * Two effects sharing one attribute both measure the first match and only one
	 * of them ever draws.
	 */
	sourceSelector: string;
	/** Where the source is being pulled, or null when nothing is targeted. */
	target: JiraLinkingTarget | null;
	/** 0-1 closeness of source to target. Drives the neck width and field alpha. */
	nearness: number;
	/**
	 * Subjects being linked. Fuse uses every identity in the field; Glow uses
	 * the lead identity's tint for its halo and backdrop pulse. Keep this
	 * referentially stable for the whole gesture.
	 */
	identities: readonly JiraLinkingIdentity[] | null;
	/** Set on release to run the fuse, or to fly subjects into the target. Bump `id` to restart. */
	release: JiraLinkingRelease | null;
	/** Called once the fuse has collapsed or the drop has landed. Glow's backdrop can finish afterward. */
	onFuseSettled?: () => void;
	/** Theme variable both blobs are tinted from. */
	surfaceVariable?: string;
	zIndex?: number;
}

/**
 * Fuse connects a travelling element with a metaball field. Glow collapses a
 * release chip when `drop` is set, then acknowledges the card with a halo and
 * backdrop pulse; a click-to-assign release omits `drop` and plays only that
 * acknowledgement.
 *
 * The effect is purely decorative: it draws behind the real drag element and
 * never intercepts a pointer, so the host's drop path commits whether or not
 * this ever paints. Keep the component mounted after clearing `release` so
 * Glow's backdrop can finish; unmounting cancels all remaining decoration.
 */
export function JiraLinking(props: Readonly<JiraLinkingProps>) {
	return props.variant === "glow" ? <JiraLinkingGlow {...props} /> : <JiraLinkingFuse {...props} />;
}

function JiraLinkingFuse(props: Readonly<JiraLinkingProps>) {
	const shouldReduceMotion = useReducedMotion();
	const active = isJiraLinkingActive({
		hasRelease: props.release !== null,
		nearness: props.nearness,
		shouldReduceMotion,
	});

	// Unmounted rather than hidden: no RAF loop, no WebGL context, no lazy chunk,
	// and no atlas work for a user who opted out of motion.
	if (!active) {
		return null;
	}

	// Chip flights replace the goo fuse: they don't need a GL context, and
	// mounting the field would keep its RAF loop alive behind them.
	if (props.release?.drop) {
		return (
			<JiraLinkingDropFlights
				drop={props.release.drop}
				key={props.release.id}
				onSettled={props.onFuseSettled}
				resolveTarget={props.release.resolveTarget}
				target={props.release.target}
			/>
		);
	}

	return <JiraLinkingField {...props} />;
}

function JiraLinkingField({
	identities,
	nearness,
	onFuseSettled,
	release,
	sourceSelector,
	surfaceVariable,
	target,
	zIndex = DEFAULT_Z_INDEX,
}: Readonly<JiraLinkingProps>) {
	const atlas = useJiraLinkingAtlas(identities);
	const { frame, velocity } = useJiraLinkingFrame({
		members: atlas.members,
		nearness,
		onFuseSettled,
		release,
		sourceSelector,
		surfaceVariable,
		target,
	});

	// `document` is read below for the portal target. The frame is null on the
	// server and on the hydration pass, so this already returns first — the
	// explicit guard states that contract instead of relying on it.
	if (!frame || typeof document === "undefined") {
		return null;
	}

	return createPortal(
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			data-slot="jira-linking"
			style={{ zIndex }}
		>
			<JiraLinkingCanvas
				atlas={atlas.atlas}
				atlasCells={atlas.atlasCells}
				frame={frame}
				velocity={velocity}
			/>
		</div>,
		document.body,
	);
}
