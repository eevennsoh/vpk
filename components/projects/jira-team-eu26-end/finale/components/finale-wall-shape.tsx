"use client";

import { useId, useRef } from "react";

import { JIRA_TEAM_EU26_END_PRESENTERS } from "@/components/projects/jira-team-eu26-end/data/keynote-presenters";

import { CUE } from "../data/finale-cues";
import { FINALE_COLORS } from "../data/finale-palette";
import { FINALE_SHAPE_CYCLE, FINALE_SHAPES, type FinaleShapeKind } from "../data/finale-identity-shapes";
import type { FinalePresenterId } from "../data/finale-stories";
import { useFinaleFrame } from "../hooks/use-finale-frame";
import { SHAPE_HOLD_S, alignRing, blendRings, ringPath, shapeStepAt, svgPathSampler, type MorphRing } from "../lib/finale-shape-morph";
import { hash01, spring } from "../lib/finale-math";
import { buildAfter } from "../lib/finale-build-style";
import { FinaleBuildSpan } from "./finale-build-text";
import { FINALE_TILE_RADIUS } from "./finale-tile";

const RING_POINTS = 96;
const rings = new Map<string, MorphRing>();
let sample: ReturnType<typeof svgPathSampler> | null = null;

/** Each hop's pair of rings, sampled once and shared by every shape on the wall. */
function hop(from: FinaleShapeKind, to: FinaleShapeKind): readonly [MorphRing, MorphRing] {
	sample ??= svgPathSampler();
	const sampler = sample;
	const ring = (kind: FinaleShapeKind) => {
		const known = rings.get(kind);
		if (known) return known;
		const made = sampler(FINALE_SHAPES[kind], RING_POINTS);
		rings.set(kind, made);
		return made;
	};
	const key = `${from}>${to}`;
	const start = ring(from);
	const aligned = rings.get(key) ?? alignRing(start, ring(to));
	rings.set(key, aligned);
	return [start, aligned];
}

/** A sine of `period` seconds, as the mosaic's idle loops use. */
const wave = (t: number, period: number, phase = 0) => Math.sin((t * 2 * Math.PI) / period + phase);

/** A landed shape grows in on a spring that overshoots once; by then it has settled. */
const GROW_SETTLED_S = 1.6;

interface FinaleWallShapeProps {
	readonly shape: FinaleShapeKind;
	readonly fill: string;
	readonly portrait?: FinalePresenterId;
	/** Staggers each tile's cycle so neighbours never morph in step. */
	readonly seed: number;
	readonly width: number;
	readonly height: number;
	/** When it grows in (it landed blank); null: it was there all along. */
	readonly revealStart: number | null;
}

/**
 * One of the identity's bold shapes on a white tile, after `ShapeTile` in the
 * Rovo Chat desktop mosaic: it floats and tilts a little, rests, then morphs
 * on through the cycle. A presenter's tile fills the shape with their
 * portrait in grayscale, multiplied into the colour like a duotone. Landing
 * blank, the shape grows in from the tile's centre and starts its cycle as its
 * name builds; until then it has nothing to draw, so nothing runs.
 */
export function FinaleWallShape({ shape, fill, portrait, seed, width, height, revealStart }: Readonly<FinaleWallShapeProps>) {
	const clipId = `finale-shape-${useId().replace(/[^\w-]/gu, "")}`;
	const groupRef = useRef<SVGGElement>(null);
	const fillRef = useRef<SVGPathElement>(null);
	const clipRef = useRef<SVGPathElement>(null);
	const imageRef = useRef<SVGImageElement>(null);
	const lastRef = useRef("");
	const hiddenRef = useRef(false);
	const start = FINALE_SHAPE_CYCLE.indexOf(shape);
	const order = [...FINALE_SHAPE_CYCLE.slice(start), ...FINALE_SHAPE_CYCLE.slice(0, start)];
	const phase = hash01(seed * 0.37) * 3.3;
	const presenter = portrait ? JIRA_TEAM_EU26_END_PRESENTERS[portrait] : undefined;

	useFinaleFrame((time) => {
		const group = groupRef.current;
		if (!group) return;
		const grown = revealStart === null || time - revealStart >= GROW_SETTLED_S ? 1 : spring(time - revealStart);
		if (grown <= 0) {
			if (!hiddenRef.current) group.setAttribute("transform", "scale(0)");
			hiddenRef.current = true;
			return;
		}
		hiddenRef.current = false;
		const t = time + phase;
		const grow = grown === 1 ? "" : ` translate(50 50) scale(${grown.toFixed(4)}) translate(-50 -50)`;
		group.setAttribute("transform", `translate(0 ${(2.6 * wave(t, 5.4) + 0.8 * wave(t, 2.3, 0.7)).toFixed(2)}) rotate(${(2.4 * wave(t, 8.6, 1.1)).toFixed(2)} 50 50)${grow}`);
		const image = imageRef.current;
		if (image) {
			const zoom = 1.08 + 0.05 * wave(t, 11, 0.4);
			image.setAttribute("transform", `translate(${(50 + 3 * wave(t, 13.5)).toFixed(2)} ${(50 + 2.4 * wave(t, 9.7, 1.6)).toFixed(2)}) scale(${zoom.toFixed(3)}) translate(-50 -50)`);
		}
		// A landed shape holds its own form until its content has built, then morphs on.
		const cycle = revealStart === null ? t : time - revealStart - CUE.reveal + SHAPE_HOLD_S;
		const { index, progress } = shapeStepAt(cycle, order.length);
		const path = progress === 0 ? FINALE_SHAPES[order[index]] : ringPath(blendRings(...hop(order[index], order[(index + 1) % order.length]), progress));
		if (path === lastRef.current) return;
		lastRef.current = path;
		fillRef.current?.setAttribute("d", path);
		clipRef.current?.setAttribute("d", path);
	});

	const art = Math.min(height * 0.74, width * 0.8);
	return (
		<div className="absolute inset-0 overflow-hidden" style={{ background: FINALE_COLORS.tile, borderRadius: FINALE_TILE_RADIUS }}>
			<svg viewBox="0 0 100 100" aria-hidden className="absolute" style={{ width: art, height: art, left: (width - art) / 2, top: (height - art) / 2, overflow: "visible" }}>
				<defs>
					<clipPath id={clipId}>
						<path ref={clipRef} d={FINALE_SHAPES[shape]} />
					</clipPath>
				</defs>
				<g ref={groupRef} transform={revealStart === null ? undefined : "scale(0)"}>
					<path ref={fillRef} d={FINALE_SHAPES[shape]} fill={fill} />
					{presenter ? (
						// Clipped on the image itself (a clipped group would isolate it), so it blends into the fill.
						<image
							ref={imageRef}
							href={presenter.avatarSrc}
							x={0}
							y={0}
							width={100}
							height={100}
							clipPath={`url(#${clipId})`}
							preserveAspectRatio="xMidYMid slice"
							style={{ filter: "grayscale(1) contrast(1.15)", mixBlendMode: "luminosity" }}
						/>
					) : null}
				</g>
			</svg>
			{presenter ? (
				<FinaleBuildSpan
					text={presenter.name}
					start={buildAfter(revealStart, 0.35)}
					duration={CUE.reveal * 0.7}
					tracking="normal"
					className="absolute font-sans"
					style={{ left: 36, bottom: 30, fontSize: 34, lineHeight: 1 }}
				/>
			) : null}
		</div>
	);
}
