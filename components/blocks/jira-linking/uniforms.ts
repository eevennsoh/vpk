/**
 * CPU-side packing for the session fusion shader's uniform arrays.
 *
 * `field.ts` emits balls in CLIENT coordinates; the shader works
 * in region-local CSS px. This module owns that translation plus the avatar
 * atlas UV maths, so the canvas file stays a thin WebGL harness and the maths
 * can be tested without a GL context.
 *
 * Buffers are allocated once and rewritten in place — the render loop runs at
 * 60fps during a drag, so it must not allocate.
 */

import {
	JIRA_LINKING_MAX_BALLS,
	type JiraLinkingFrame,
} from "./field.ts";

/**
 * Edge length of one avatar cell in the atlas, in device px.
 *
 * The atlas is a SINGLE HORIZONTAL ROW of `atlasCells` square cells, so its
 * intrinsic size is `atlasCells * JIRA_LINKING_ATLAS_CELL_PX` wide by
 * `JIRA_LINKING_ATLAS_CELL_PX` tall. Producers must match this layout.
 */
export const JIRA_LINKING_ATLAS_CELL_PX = 128;

/** Sentinel written into `atlas` for slots that must sample `tint` instead. */
export const JIRA_LINKING_NO_ATLAS_INDEX = -1;

export interface JiraLinkingUniformBuffers {
	/** float[8] — atlas cell index, or -1 to use `tint`. */
	atlas: Float32Array;
	/** vec2[8] — ball centre in region-local CSS px. */
	center: Float32Array;
	/** vec2[8] — half extents in CSS px. */
	half: Float32Array;
	/** float[8] — circle radius, or the pill corner radius. */
	radius: Float32Array;
	/** float[8] — 1 for a pill, 0 for a circle. */
	shape: Float32Array;
	/** vec3[8] — 0..1 sRGB fallback colour. */
	tint: Float32Array;
	/** vec4[8] — atlas sub-rect as (u, v, width, height). */
	uvRect: Float32Array;
}

export function createJiraLinkingUniformBuffers(): JiraLinkingUniformBuffers {
	return {
		atlas: new Float32Array(JIRA_LINKING_MAX_BALLS),
		center: new Float32Array(JIRA_LINKING_MAX_BALLS * 2),
		half: new Float32Array(JIRA_LINKING_MAX_BALLS * 2),
		radius: new Float32Array(JIRA_LINKING_MAX_BALLS),
		shape: new Float32Array(JIRA_LINKING_MAX_BALLS),
		tint: new Float32Array(JIRA_LINKING_MAX_BALLS * 3),
		uvRect: new Float32Array(JIRA_LINKING_MAX_BALLS * 4),
	};
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(Math.max(value, 0), 1);
}

/**
 * Sub-rect of the atlas for one cell, inset by half a texel so `LINEAR`
 * filtering cannot bleed a neighbouring agent's face across the seam.
 *
 * Returns a full-texture rect for out-of-range input; callers should already
 * have written `JIRA_LINKING_NO_ATLAS_INDEX` in that case.
 */
export function resolveJiraLinkingAtlasUvRect(
	atlasIndex: number,
	atlasCells: number,
): readonly [number, number, number, number] {
	if (!Number.isFinite(atlasIndex) || atlasIndex < 0 || atlasCells < 1) {
		return [0, 0, 1, 1];
	}

	const cells = Math.floor(atlasCells);
	const index = Math.min(Math.floor(atlasIndex), cells - 1);
	const cellWidth = 1 / cells;
	const insetU = 0.5 / (cells * JIRA_LINKING_ATLAS_CELL_PX);
	const insetV = 0.5 / JIRA_LINKING_ATLAS_CELL_PX;

	return [
		index * cellWidth + insetU,
		insetV,
		cellWidth - insetU * 2,
		1 - insetV * 2,
	];
}

/**
 * Axis the chromatic split smears along, in client px (magnitude is ignored —
 * the shader normalises it).
 *
 * `JiraLinkingFrame` folds velocity into `dispersion` and does not echo the
 * vector, so the renderer needs the caller's velocity to know which way the
 * field is travelling. When none is supplied, the chip-to-dock axis is the
 * honest stand-in: it is the direction the whole field is collapsing along.
 * Returns `[0, 0]` when neither is available, which the shader reads as no
 * split at all.
 */
export function resolveJiraLinkingSplitAxis(
	frame: Readonly<JiraLinkingFrame>,
	velocity?: Readonly<{ x: number; y: number }> | null,
): readonly [number, number] {
	const x = Number.isFinite(velocity?.x) ? Number(velocity?.x) : 0;
	const y = Number.isFinite(velocity?.y) ? Number(velocity?.y) : 0;
	if (x !== 0 || y !== 0) {
		return [x, y];
	}

	const chip = frame.balls[0];
	const dock = frame.balls[frame.balls.length - 1];
	if (!chip || !dock || dock === chip) {
		return [0, 0];
	}

	return [dock.cx - chip.cx, dock.cy - chip.cy];
}

/**
 * Rewrite `buffers` from `frame` and return how many ball slots are live.
 *
 * Slots past the live count are zeroed and flagged `-1` so a shorter frame can
 * never inherit the previous frame's geometry through the shared buffers.
 */
export function packJiraLinkingUniforms(
	buffers: JiraLinkingUniformBuffers,
	frame: Readonly<JiraLinkingFrame>,
	atlasCells: number,
): number {
	const { left, top } = frame.region;
	const cells = Number.isFinite(atlasCells) ? Math.max(0, Math.floor(atlasCells)) : 0;
	const count = Math.min(frame.balls.length, JIRA_LINKING_MAX_BALLS);

	for (let index = 0; index < JIRA_LINKING_MAX_BALLS; index += 1) {
		const ball = index < count ? frame.balls[index] : undefined;
		const pair = index * 2;
		const triple = index * 3;
		const quad = index * 4;

		if (!ball) {
			buffers.atlas[index] = JIRA_LINKING_NO_ATLAS_INDEX;
			buffers.center[pair] = 0;
			buffers.center[pair + 1] = 0;
			buffers.half[pair] = 0;
			buffers.half[pair + 1] = 0;
			buffers.radius[index] = 0;
			buffers.shape[index] = 0;
			buffers.tint[triple] = 0;
			buffers.tint[triple + 1] = 0;
			buffers.tint[triple + 2] = 0;
			buffers.uvRect[quad] = 0;
			buffers.uvRect[quad + 1] = 0;
			buffers.uvRect[quad + 2] = 1;
			buffers.uvRect[quad + 3] = 1;
			continue;
		}

		const isTextured = cells > 0 && ball.atlasIndex >= 0 && ball.atlasIndex < cells;
		const [u, v, uvWidth, uvHeight] = resolveJiraLinkingAtlasUvRect(
			isTextured ? ball.atlasIndex : JIRA_LINKING_NO_ATLAS_INDEX,
			cells,
		);

		buffers.atlas[index] = isTextured
			? Math.floor(ball.atlasIndex)
			: JIRA_LINKING_NO_ATLAS_INDEX;
		buffers.center[pair] = ball.cx - left;
		buffers.center[pair + 1] = ball.cy - top;
		buffers.half[pair] = Math.max(0, ball.halfWidth);
		buffers.half[pair + 1] = Math.max(0, ball.halfHeight);
		buffers.radius[index] = Math.max(0, ball.radius);
		buffers.shape[index] = ball.shape === "pill" ? 1 : 0;
		buffers.tint[triple] = clamp01(ball.tint[0]);
		buffers.tint[triple + 1] = clamp01(ball.tint[1]);
		buffers.tint[triple + 2] = clamp01(ball.tint[2]);
		buffers.uvRect[quad] = u;
		buffers.uvRect[quad + 1] = v;
		buffers.uvRect[quad + 2] = uvWidth;
		buffers.uvRect[quad + 3] = uvHeight;
	}

	return count;
}
