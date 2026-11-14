"use client";

import type { RefObject } from "react";
import { memo, useEffect, useRef } from "react";
import { clamp } from "@/lib/math";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const MASK_WIDTH = 128;
const MASK_HEIGHT = 256;
const DEFAULT_BAND_HEIGHT = 0.4;
const DEFAULT_EDGE_SAFE_X = 0;
const DEFAULT_HORIZONTAL_PROFILE_FLOOR = 0.45;

const cachedBandMaskUrls = new Map<string, string>();
const cachedTintTextureUrls = new Map<string, string>();

export type DistortionTintMode = "solid" | "rovo-gradient";

function clampByte(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function getDistortionStrength(progress: number): number {
	const attack = smoothstep(0.0, 0.04, progress);
	const release = 1.0 - smoothstep(0.94, 1.0, progress);
	const plateau = 0.85 + Math.sin(progress * Math.PI) * 0.15;
	return Math.max(0, attack * release * plateau);
}

type DistortionFilterHandle = {
	id: string;
	svg: SVGSVGElement;
	maskOffset: SVGFEOffsetElement;
	displacement: SVGFEDisplacementMapElement;
	blur: SVGFEGaussianBlurElement;
	sweepStart: number;
	sweepEnd: number;
};

function getBandMaskUrl(bandHeight: number, edgeSafeX: number): string | null {
	const cacheKey = `${bandHeight.toFixed(4)}:${edgeSafeX.toFixed(4)}`;
	const cached = cachedBandMaskUrls.get(cacheKey);
	if (cached) return cached;
	if (typeof document === "undefined") return null;

	const canvas = document.createElement("canvas");
	canvas.width = MASK_WIDTH;
	canvas.height = MASK_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;

	const imageData = ctx.createImageData(MASK_WIDTH, MASK_HEIGHT);
	const data = imageData.data;

	for (let y = 0; y < MASK_HEIGHT; y += 1) {
		const v = (y + 0.5) / MASK_HEIGHT;
		const bandDistance = Math.abs(v - 0.5) / (bandHeight * 0.5);
		const bandMask = 1 - smoothstep(0, 1, bandDistance);

		for (let x = 0; x < MASK_WIDTH; x += 1) {
			const u = (x + 0.5) / MASK_WIDTH;
			const edgeFeather = edgeSafeX <= 0
				? 1
				: smoothstep(0, edgeSafeX, u) * (1 - smoothstep(1 - edgeSafeX, 1, u));
			const distanceToCenter = Math.abs(u - 0.5) * 2;
			const centerBias = 1 - smoothstep(0.55, 1, distanceToCenter);
			const horizontalProfile = DEFAULT_HORIZONTAL_PROFILE_FLOOR
				+ (1 - DEFAULT_HORIZONTAL_PROFILE_FLOOR) * centerBias;
			const influence = Math.max(0, Math.min(1, bandMask * edgeFeather * horizontalProfile));
			const index = (y * MASK_WIDTH + x) * 4;
			data[index] = 255;
			data[index + 1] = 255;
			data[index + 2] = 255;
			data[index + 3] = clampByte(influence * 255);
		}
	}

	ctx.putImageData(imageData, 0, 0);
	const maskUrl = canvas.toDataURL("image/png");
	cachedBandMaskUrls.set(cacheKey, maskUrl);
	return maskUrl;
}

function getTintTextureUrl(
	width: number,
	height: number,
	tintMode: DistortionTintMode,
	tintColor: string,
): string {
	const normalizedWidth = Math.max(1, Math.round(width));
	const normalizedHeight = Math.max(1, Math.round(height));
	const safeTintColor = tintColor.trim().length > 0 ? tintColor : "#1868DB";
	const cacheKey = `${tintMode}:${safeTintColor}:${normalizedWidth}x${normalizedHeight}`;
	const cached = cachedTintTextureUrls.get(cacheKey);
	if (cached) return cached;

	let svgMarkup = "";
	if (tintMode === "rovo-gradient") {
		svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${normalizedWidth}" height="${normalizedHeight}" viewBox="0 0 ${normalizedWidth} ${normalizedHeight}" preserveAspectRatio="none">
			<defs>
				<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#1868DB" />
					<stop offset="33%" stop-color="#AF59E1" />
					<stop offset="66%" stop-color="#FCA700" />
					<stop offset="100%" stop-color="#6A9A23" />
				</linearGradient>
			</defs>
			<rect width="100%" height="100%" fill="url(#g)" />
		</svg>`;
	} else {
		svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${normalizedWidth}" height="${normalizedHeight}" viewBox="0 0 ${normalizedWidth} ${normalizedHeight}" preserveAspectRatio="none">
			<rect width="100%" height="100%" fill="${safeTintColor}" />
		</svg>`;
	}

	const url = `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;
	cachedTintTextureUrls.set(cacheKey, url);
	return url;
}

function createDistortionFilter(
	cardWidth: number,
	cardHeight: number,
	bandHeight: number,
	edgeSafeX: number,
	tintColor: string,
	tintStrength: number,
	tintMode: DistortionTintMode,
): DistortionFilterHandle | null {
	if (typeof document === "undefined") return null;
	const normalizedEdgeSafeX = clamp(edgeSafeX, 0, 0.08);
	const maskUrl = getBandMaskUrl(bandHeight, normalizedEdgeSafeX);
	if (!maskUrl) return null;

	const id = `gen-card-distortion-${Math.random().toString(36).slice(2)}`;
	const sweepMargin = cardHeight * 0.5 + cardHeight * bandHeight * 0.5;
	const sweepStart = -sweepMargin;
	const sweepEnd = sweepMargin;
	const normalizedTintStrength = clamp(tintStrength, 0, 1);
	const tintTextureUrl = getTintTextureUrl(cardWidth, cardHeight, tintMode, tintColor);

	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("width", "0");
	svg.setAttribute("height", "0");
	svg.style.position = "absolute";
	svg.style.pointerEvents = "none";

	const filter = document.createElementNS(SVG_NS, "filter");
	filter.setAttribute("id", id);
	filter.setAttribute("filterUnits", "userSpaceOnUse");
	filter.setAttribute("primitiveUnits", "userSpaceOnUse");
	filter.setAttribute("x", `${-cardWidth * 0.04}`);
	filter.setAttribute("y", `${-cardHeight * 0.04}`);
	filter.setAttribute("width", `${cardWidth * 1.08}`);
	filter.setAttribute("height", `${cardHeight * 1.08}`);
	filter.setAttribute("color-interpolation-filters", "sRGB");

	const neutralMap = document.createElementNS(SVG_NS, "feFlood");
	neutralMap.setAttribute("flood-color", "rgb(128,128,128)");
	neutralMap.setAttribute("flood-opacity", "1");
	neutralMap.setAttribute("result", "neutralMap");

	const turbulence = document.createElementNS(SVG_NS, "feTurbulence");
	turbulence.setAttribute("type", "fractalNoise");
	turbulence.setAttribute("baseFrequency", "0.016 0.036");
	turbulence.setAttribute("numOctaves", "1");
	turbulence.setAttribute("stitchTiles", "stitch");
	turbulence.setAttribute("seed", `${Math.floor(Math.random() * 9999) + 1}`);
	turbulence.setAttribute("result", "noiseRaw");

	const noiseBlur = document.createElementNS(SVG_NS, "feGaussianBlur");
	noiseBlur.setAttribute("in", "noiseRaw");
	noiseBlur.setAttribute("stdDeviation", "0.7");
	noiseBlur.setAttribute("result", "noiseSoft");

	const noiseCentered = document.createElementNS(SVG_NS, "feComponentTransfer");
	noiseCentered.setAttribute("in", "noiseSoft");
	noiseCentered.setAttribute("result", "noiseCentered");

	const noiseR = document.createElementNS(SVG_NS, "feFuncR");
	noiseR.setAttribute("type", "linear");
	noiseR.setAttribute("slope", "0.56");
	noiseR.setAttribute("intercept", "0.22");

	const noiseG = document.createElementNS(SVG_NS, "feFuncG");
	noiseG.setAttribute("type", "linear");
	noiseG.setAttribute("slope", "0.56");
	noiseG.setAttribute("intercept", "0.22");

	const noiseB = document.createElementNS(SVG_NS, "feFuncB");
	noiseB.setAttribute("type", "linear");
	noiseB.setAttribute("slope", "0");
	noiseB.setAttribute("intercept", "0.5");

	const noiseA = document.createElementNS(SVG_NS, "feFuncA");
	noiseA.setAttribute("type", "table");
	noiseA.setAttribute("tableValues", "1 1");

	noiseCentered.appendChild(noiseR);
	noiseCentered.appendChild(noiseG);
	noiseCentered.appendChild(noiseB);
	noiseCentered.appendChild(noiseA);

	const bandMask = document.createElementNS(SVG_NS, "feImage");
	bandMask.setAttribute("x", "0");
	bandMask.setAttribute("y", "0");
	bandMask.setAttribute("width", `${cardWidth}`);
	bandMask.setAttribute("height", `${cardHeight}`);
	bandMask.setAttribute("preserveAspectRatio", "none");
	bandMask.setAttribute("result", "bandMask");
	bandMask.setAttribute("href", maskUrl);
	bandMask.setAttributeNS(XLINK_NS, "href", maskUrl);

	const maskOffset = document.createElementNS(SVG_NS, "feOffset");
	maskOffset.setAttribute("in", "bandMask");
	maskOffset.setAttribute("dx", "0");
	maskOffset.setAttribute("dy", `${sweepStart}`);
	maskOffset.setAttribute("result", "bandMaskSweep");

	const bandNoise = document.createElementNS(SVG_NS, "feComposite");
	bandNoise.setAttribute("in", "noiseCentered");
	bandNoise.setAttribute("in2", "bandMaskSweep");
	bandNoise.setAttribute("operator", "in");
	bandNoise.setAttribute("result", "bandNoise");

	const neutralOutsideBand = document.createElementNS(SVG_NS, "feComposite");
	neutralOutsideBand.setAttribute("in", "neutralMap");
	neutralOutsideBand.setAttribute("in2", "bandMaskSweep");
	neutralOutsideBand.setAttribute("operator", "out");
	neutralOutsideBand.setAttribute("result", "neutralOutsideBand");

	const displacementMap = document.createElementNS(SVG_NS, "feMerge");
	displacementMap.setAttribute("result", "displacementMap");
	const displacementBandNode = document.createElementNS(SVG_NS, "feMergeNode");
	displacementBandNode.setAttribute("in", "bandNoise");
	const displacementNeutralNode = document.createElementNS(SVG_NS, "feMergeNode");
	displacementNeutralNode.setAttribute("in", "neutralOutsideBand");
	displacementMap.appendChild(displacementBandNode);
	displacementMap.appendChild(displacementNeutralNode);

	const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
	displacement.setAttribute("in", "SourceGraphic");
	displacement.setAttribute("in2", "displacementMap");
	displacement.setAttribute("scale", "0");
	displacement.setAttribute("xChannelSelector", "R");
	displacement.setAttribute("yChannelSelector", "G");
	displacement.setAttribute("edgeMode", "duplicate");
	displacement.setAttribute("result", "displacedOutput");

	const blur = document.createElementNS(SVG_NS, "feGaussianBlur");
	blur.setAttribute("in", "displacedOutput");
	blur.setAttribute("stdDeviation", "0");
	blur.setAttribute("result", "blurredOutput");

	const blurredBand = document.createElementNS(SVG_NS, "feComposite");
	blurredBand.setAttribute("in", "blurredOutput");
	blurredBand.setAttribute("in2", "bandMaskSweep");
	blurredBand.setAttribute("operator", "in");
	blurredBand.setAttribute("result", "blurredBand");

	const tintTexture = document.createElementNS(SVG_NS, "feImage");
	tintTexture.setAttribute("x", "0");
	tintTexture.setAttribute("y", "0");
	tintTexture.setAttribute("width", `${cardWidth}`);
	tintTexture.setAttribute("height", `${cardHeight}`);
	tintTexture.setAttribute("preserveAspectRatio", "none");
	tintTexture.setAttribute("result", "tintTexture");
	tintTexture.setAttribute("href", tintTextureUrl);
	tintTexture.setAttributeNS(XLINK_NS, "href", tintTextureUrl);

	const tintBand = document.createElementNS(SVG_NS, "feComposite");
	tintBand.setAttribute("in", "tintTexture");
	tintBand.setAttribute("in2", "bandMaskSweep");
	tintBand.setAttribute("operator", "in");
	tintBand.setAttribute("result", "tintBand");

	const tintBandStrength = document.createElementNS(SVG_NS, "feComponentTransfer");
	tintBandStrength.setAttribute("in", "tintBand");
	tintBandStrength.setAttribute("result", "tintBandStrength");
	const tintBandAlpha = document.createElementNS(SVG_NS, "feFuncA");
	tintBandAlpha.setAttribute("type", "linear");
	tintBandAlpha.setAttribute("slope", normalizedTintStrength.toFixed(3));
	tintBandStrength.appendChild(tintBandAlpha);

	const tintedBlurredBand = document.createElementNS(SVG_NS, "feBlend");
	tintedBlurredBand.setAttribute("in", "blurredBand");
	tintedBlurredBand.setAttribute("in2", "tintBandStrength");
	tintedBlurredBand.setAttribute("mode", "soft-light");
	tintedBlurredBand.setAttribute("result", "blurredBandTinted");

	const displacedOutsideBand = document.createElementNS(SVG_NS, "feComposite");
	displacedOutsideBand.setAttribute("in", "displacedOutput");
	displacedOutsideBand.setAttribute("in2", "bandMaskSweep");
	displacedOutsideBand.setAttribute("operator", "out");
	displacedOutsideBand.setAttribute("result", "displacedOutsideBand");

	const outputMerge = document.createElementNS(SVG_NS, "feMerge");
	const outputBlurredNode = document.createElementNS(SVG_NS, "feMergeNode");
	outputBlurredNode.setAttribute("in", "blurredBandTinted");
	const outputOutsideNode = document.createElementNS(SVG_NS, "feMergeNode");
	outputOutsideNode.setAttribute("in", "displacedOutsideBand");
	outputMerge.appendChild(outputBlurredNode);
	outputMerge.appendChild(outputOutsideNode);

	filter.appendChild(neutralMap);
	filter.appendChild(turbulence);
	filter.appendChild(noiseBlur);
	filter.appendChild(noiseCentered);
	filter.appendChild(bandMask);
	filter.appendChild(maskOffset);
	filter.appendChild(bandNoise);
	filter.appendChild(neutralOutsideBand);
	filter.appendChild(displacementMap);
	filter.appendChild(displacement);
	filter.appendChild(blur);
	filter.appendChild(blurredBand);
	filter.appendChild(tintTexture);
	filter.appendChild(tintBand);
	filter.appendChild(tintBandStrength);
	filter.appendChild(tintedBlurredBand);
	filter.appendChild(displacedOutsideBand);
	filter.appendChild(outputMerge);
	svg.appendChild(filter);
	document.body.appendChild(svg);

	return { id, svg, maskOffset, displacement, blur, sweepStart, sweepEnd };
}

function startAnimationLoop(
	duration: number,
	onFrame: (progress: number) => void,
	onComplete: () => void,
): () => void {
	const startTime = performance.now();
	let rafId = 0;
	let completed = false;

	function frame(now: number) {
		const elapsed = now - startTime;
		const progress = Math.min(elapsed / duration, 1.0);

		onFrame(progress);

		if (progress < 1.0) {
			rafId = requestAnimationFrame(frame);
		} else if (!completed) {
			completed = true;
			onComplete();
		}
	}

	rafId = requestAnimationFrame(frame);

	return () => {
		cancelAnimationFrame(rafId);
	};
}

const DEFAULT_DURATION = 2000;
const DEFAULT_MAX_DISPLACEMENT_SCALE = 100;
const DEFAULT_MAX_BLUR = 8;
const DEFAULT_SPEED = 1.35;
const DEFAULT_SCALE_SMOOTHING = 0.5;
const DEFAULT_SWEEP_SMOOTHING = 0.5;

export interface GenerativeCardBulgeCanvasProps {
	cardRef: RefObject<HTMLDivElement | null>;
	duration?: number;
	maxDisplacementScale?: number;
	maxBlur?: number;
	bandHeight?: number;
	edgeSafeX?: number;
	speed?: number;
	scaleSmoothing?: number;
	sweepSmoothing?: number;
	tintMode?: DistortionTintMode;
	tintColor?: string;
	tintStrength?: number;
	onComplete: () => void;
}

export const GenerativeCardBulgeCanvas = memo(function GenerativeCardBulgeCanvas({
	cardRef,
	duration = DEFAULT_DURATION,
	maxDisplacementScale = DEFAULT_MAX_DISPLACEMENT_SCALE,
	maxBlur = DEFAULT_MAX_BLUR,
	bandHeight = DEFAULT_BAND_HEIGHT,
	edgeSafeX = DEFAULT_EDGE_SAFE_X,
	speed = DEFAULT_SPEED,
	scaleSmoothing = DEFAULT_SCALE_SMOOTHING,
	sweepSmoothing = DEFAULT_SWEEP_SMOOTHING,
	tintMode = "solid",
	tintColor = "#1868DB",
	tintStrength = 0,
	onComplete,
}: Readonly<GenerativeCardBulgeCanvasProps>) {
	const onCompleteRef = useRef(onComplete);
	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);

	useEffect(() => {
		const card = cardRef.current;
		if (!card) return;

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			requestAnimationFrame(() => onCompleteRef.current());
			return;
		}

		const previousFilter = card.style.filter;
		const previousWillChange = card.style.willChange;
		const { width, height } = card.getBoundingClientRect();
		const normalizedBandHeight = clamp(bandHeight, 0.06, 0.6);
		const normalizedEdgeSafeX = clamp(edgeSafeX, 0, 0.08);
		const normalizedTintStrength = clamp(tintStrength, 0, 1);

		const distortionFilter = createDistortionFilter(
			width,
			height,
			normalizedBandHeight,
			normalizedEdgeSafeX,
			tintColor,
			normalizedTintStrength,
			tintMode,
		);
		if (distortionFilter) {
			const filterValue = `url(#${distortionFilter.id})`;
			card.style.filter = previousFilter.trim().length > 0
				? `${previousFilter} ${filterValue}`
				: filterValue;
			card.style.willChange = previousWillChange.trim().length > 0
				? `${previousWillChange}, filter`
				: "filter";
		}

		let smoothedScale = 0;
		let smoothedBlur = 0;
		let smoothedSweep = distortionFilter?.sweepStart ?? 0;
		const normalizedSpeed = clamp(speed, 0.1, 4);
		const normalizedScaleSmoothing = clamp(scaleSmoothing, 0.05, 1);
		const normalizedSweepSmoothing = clamp(sweepSmoothing, 0.05, 1);
		const normalizedDuration = Math.max(120, duration / normalizedSpeed);
		const normalizedMaxBlur = clamp(maxBlur, 0, 8);

		const stopLoop = startAnimationLoop(
			normalizedDuration,
			(progress) => {
				if (!distortionFilter) return;

				const easedProgress = smoothstep(0.0, 1.0, progress);
				const targetSweep = distortionFilter.sweepStart
					+ (distortionFilter.sweepEnd - distortionFilter.sweepStart) * easedProgress;
				const strength = getDistortionStrength(progress);
				const targetScale = strength * maxDisplacementScale;
				const targetBlur = strength * normalizedMaxBlur;

				smoothedSweep += (targetSweep - smoothedSweep) * normalizedSweepSmoothing;
				smoothedScale += (targetScale - smoothedScale) * normalizedScaleSmoothing;
				smoothedBlur += (targetBlur - smoothedBlur) * normalizedScaleSmoothing;
				if (progress > 0.985) {
					smoothedScale = 0;
					smoothedBlur = 0;
				}

				distortionFilter.maskOffset.setAttribute("dy", smoothedSweep.toFixed(2));
				distortionFilter.displacement.setAttribute("scale", smoothedScale.toFixed(2));
				distortionFilter.blur.setAttribute("stdDeviation", smoothedBlur.toFixed(2));
			},
			() => {
				onCompleteRef.current();
			},
		);

		return () => {
			stopLoop();
			card.style.filter = previousFilter;
			card.style.willChange = previousWillChange;
			distortionFilter?.svg.remove();
		};
	}, [cardRef, duration, maxDisplacementScale, maxBlur, bandHeight, edgeSafeX, speed, scaleSmoothing, sweepSmoothing, tintMode, tintColor, tintStrength]);

	return null;
});
