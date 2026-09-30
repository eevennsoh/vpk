"use client";

import {
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { useEffect, useMemo, useState, type JSX, type RefObject } from "react";

import LiquidGradient from "@/components/visual/liquid-gradient";

import {
	GALLERY_SELECTION_SHADER_EXIT_SECONDS,
	getGalleryItemSeed,
	type GallerySelectionVisual,
} from "../lib/gallery-selection";
import { DEFAULT_GALLERY_PALETTE, type GalleryPalette } from "../lib/gallery-palette";
import { GalleryTitleLines } from "./gallery-title-lines";
import { motionEase } from "@/lib/motion";

const ENTER_EASE = [0.45, 0, 0.55, 1] as const; // Deliberately even ink spread.
const EXIT_EASE = motionEase.out; // --ease-out; starts the shader exit immediately.
const DUR_ENTER = 0.8; // Brisk organic reveal; still outlasts the 0.6s exit.
const MASK_FEATHER_PX = 18;
const MASK_DIAMETER_SCALE = 2.6;

interface GalleryShaderParameters {
	seed: number;
	speed: number;
	scale: number;
	turbAmp: number;
	turbFreq: number;
	turbIter: number;
	waveFreq: number;
	distBias: number;
}

const GALLERY_SHADER_PARAMETER_RANGES = {
	speed: [0.15, 0.21],
	scale: [0.48, 0.56],
	turbAmp: [0.65, 0.79],
	turbFreq: [0.1, 0.14],
	turbIter: [6, 8],
	waveFreq: [2.8, 3.5],
	distBias: [0.03, 0.13],
} as const;

function randomBetween(
	range: readonly [number, number],
	random: () => number,
): number {
	return range[0] + random() * (range[1] - range[0]);
}

function randomInteger(
	range: readonly [number, number],
	random: () => number,
): number {
	return Math.floor(randomBetween([range[0], range[1] + 1], random));
}

function createGalleryShaderParameters(random: () => number = Math.random): GalleryShaderParameters {
	return {
		seed: Math.floor(random() * 10000),
		speed: randomBetween(GALLERY_SHADER_PARAMETER_RANGES.speed, random),
		scale: randomBetween(GALLERY_SHADER_PARAMETER_RANGES.scale, random),
		turbAmp: randomBetween(GALLERY_SHADER_PARAMETER_RANGES.turbAmp, random),
		turbFreq: randomBetween(GALLERY_SHADER_PARAMETER_RANGES.turbFreq, random),
		turbIter: randomInteger(GALLERY_SHADER_PARAMETER_RANGES.turbIter, random),
		waveFreq: randomBetween(GALLERY_SHADER_PARAMETER_RANGES.waveFreq, random),
		distBias: randomBetween(GALLERY_SHADER_PARAMETER_RANGES.distBias, random),
	};
}

function createSeededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function createInkMaskImage(seed: number): string {
	const random = createSeededRandom(seed);
	const turbulenceSeed = 1 + Math.floor(random() * 999);
	const frequencyX = 0.012 + random() * 0.014;
	const frequencyY = 0.016 + random() * 0.016;
	const displacement = 34 + random() * 22;
	const blur = 3.5 + random() * 2.5;
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
			<defs>
				<filter id="ink" x="-35%" y="-35%" width="170%" height="170%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="${frequencyX.toFixed(4)} ${frequencyY.toFixed(4)}"
						numOctaves="3"
						seed="${turbulenceSeed}"
						result="noise"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="noise"
						scale="${displacement.toFixed(2)}"
						xChannelSelector="R"
						yChannelSelector="G"
						result="displaced"
					/>
					<feGaussianBlur in="displaced" stdDeviation="${blur.toFixed(2)}" />
				</filter>
			</defs>
			<circle cx="128" cy="128" r="88" fill="white" filter="url(#ink)" />
		</svg>
	`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export interface GallerySelectedSurfaceProps {
	itemId: string;
	title: string;
	titleLines?: readonly string[];
	width: number;
	height: number;
	visual: GallerySelectionVisual;
	palette?: GalleryPalette;
	highlightTextRef: RefObject<HTMLSpanElement | null>;
}

export function GallerySelectedSurface({
	itemId,
	title,
	titleLines,
	width,
	height,
	visual,
	palette = DEFAULT_GALLERY_PALETTE,
	highlightTextRef,
}: Readonly<GallerySelectedSurfaceProps>): JSX.Element {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const revealRadius = Math.hypot(width, height) + MASK_FEATHER_PX;
	const seed = getGalleryItemSeed(itemId);
	const inkMaskSeed = seed + visual.key * 7919;
	const inkMaskImage = useMemo(() => createInkMaskImage(inkMaskSeed), [inkMaskSeed]);
	const [shaderParameters] = useState(createGalleryShaderParameters);
	const isExitPhase = visual.phase === "exit";
	const phaseDuration = isExitPhase ? GALLERY_SELECTION_SHADER_EXIT_SECONDS : DUR_ENTER;
	const phaseEase = isExitPhase ? EXIT_EASE : ENTER_EASE;
	const originX = (width * visual.origin.xPercent) / 100;
	const originY = (height * visual.origin.yPercent) / 100;
	const radius = useMotionValue(
		shouldReduceMotion || visual.phase !== "enter" ? revealRadius : 0,
	);
	const maskSize = useTransform(() => {
		const currentRadius = radius.get();
		const diameter = Math.max(1, currentRadius * MASK_DIAMETER_SCALE);
		return `${diameter}px ${diameter}px`;
	});
	const maskPosition = useTransform(() => {
		const currentRadius = radius.get();
		const offset = Math.max(0.5, (currentRadius * MASK_DIAMETER_SCALE) / 2);
		return `${originX - offset}px ${originY - offset}px`;
	});

	useEffect(() => {
		const targetRadius = isExitPhase ? 0 : revealRadius;
		if (shouldReduceMotion) {
			radius.set(targetRadius);
			return;
		}
		const animation = animate(radius, targetRadius, {
			duration: phaseDuration,
			ease: phaseEase,
		});
		return () => animation.stop();
	}, [
		isExitPhase,
		phaseDuration,
		phaseEase,
		radius,
		revealRadius,
		shouldReduceMotion,
		visual.key,
	]);

	return (
		<motion.div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
			style={{
				maskImage: inkMaskImage,
				WebkitMaskImage: inkMaskImage,
				maskMode: "alpha",
				maskPosition,
				WebkitMaskPosition: maskPosition,
				maskRepeat: "no-repeat",
				WebkitMaskRepeat: "no-repeat",
				maskSize,
				WebkitMaskSize: maskSize,
			}}
		>
			<div
				className="absolute inset-0"
				style={{
					backgroundImage: [
						`radial-gradient(circle at ${visual.origin.xPercent}% ${visual.origin.yPercent}%, ${palette[3]} 0%, transparent 52%)`,
						`linear-gradient(140deg, ${palette[0]} 0%, ${palette[1]} 52%, ${palette[2]} 100%)`,
					].join(", "),
				}}
			/>
			<LiquidGradient
				className="absolute inset-0 h-full w-full"
				colors={palette}
				seed={shaderParameters.seed}
				speed={shaderParameters.speed}
				loop={0}
				scale={shaderParameters.scale}
				turbAmp={shaderParameters.turbAmp}
				turbFreq={shaderParameters.turbFreq}
				turbIter={shaderParameters.turbIter}
				waveFreq={shaderParameters.waveFreq}
				distBias={shaderParameters.distBias}
				jellify
				ditherMode={1}
				dither={0.03}
				exposure={1.08}
				contrast={1.12}
				saturation={1.04}
			/>
			<div className="absolute inset-0 p-6">
				<div className="flex h-full w-full flex-col justify-end">
					<GalleryTitleLines
						title={title}
						lines={titleLines}
						textRef={highlightTextRef}
						className="text-text-inverse"
					/>
				</div>
			</div>
		</motion.div>
	);
}
