"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import type { RovoAppComposerResponseGradientPhase } from "@/components/projects/shared/lib/rovo-app-composer-response-gradient-state";
import {
	STATIC_ACTIVE_HANDOFF_DURATION_MS,
	getStaticProcessingBarValue,
	getWaveformEaseOutProgress,
	getWaveformSeriesValue,
} from "@/components/ui-custom/live-waveform-layout";
import { cn } from "@/lib/utils";

type RovoAppComposerResponseGradientProps = {
	active?: boolean;
	className?: string;
	phase?: RovoAppComposerResponseGradientPhase;
	signal?: readonly number[];
};

type RGB = {
	b: number;
	g: number;
	r: number;
};

type Palette = {
	colors: [string, string, string, string];
	shadow: string;
};

const PALETTE: Palette = {
	colors: ["#1868DB", "#AF59E1", "#FCA700", "#6A9A23"],
	shadow: "#F0F1F2",
};

const RELEASE_DURATION_MS = 640;
const LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE = 5;
const LIVE_SIGNAL_SMOOTHING_WEIGHT_TOTAL = LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE + 1;

function parseColor(value: string): RGB | null {
	const color = value.trim();
	if (color.startsWith("#")) {
		if (color.length === 4) {
			const r = Number.parseInt(color[1] + color[1], 16);
			const g = Number.parseInt(color[2] + color[2], 16);
			const b = Number.parseInt(color[3] + color[3], 16);

			return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)
				? null
				: { b, g, r };
		}

		if (color.length === 7) {
			const r = Number.parseInt(color.slice(1, 3), 16);
			const g = Number.parseInt(color.slice(3, 5), 16);
			const b = Number.parseInt(color.slice(5, 7), 16);

			return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)
				? null
				: { b, g, r };
		}
	}

	const rgbMatch = color.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i,
	);
	if (!rgbMatch) {
		return null;
	}

	const r = Number.parseFloat(rgbMatch[1]);
	const g = Number.parseFloat(rgbMatch[2]);
	const b = Number.parseFloat(rgbMatch[3]);
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
		return null;
	}

	return {
		b: Math.max(0, Math.min(255, Math.round(b))),
		g: Math.max(0, Math.min(255, Math.round(g))),
		r: Math.max(0, Math.min(255, Math.round(r))),
	};
}

function toRgba(color: string, alpha: number) {
	const parsed = parseColor(color);
	if (!parsed) {
		return `rgba(252, 167, 0, ${alpha})`;
	}

	return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function drawGlowBar({
	alpha,
	barHeight,
	barWidth,
	color,
	context,
	x,
	y,
}: {
	alpha: number;
	barHeight: number;
	barWidth: number;
	color: string;
	context: CanvasRenderingContext2D;
	x: number;
	y: number;
}) {
	const centerX = x + barWidth / 2;
	const centerY = y + barHeight / 2;
	const radiusX = barWidth * 0.82;
	const radiusY = Math.max(22, barHeight * 0.52);

	const paintLayer = ({
		alphaScale,
		blur,
		scaleX,
		scaleY,
	}: {
		alphaScale: number;
		blur: number;
		scaleX: number;
		scaleY: number;
	}) => {
		context.save();
		context.translate(centerX, centerY);
		context.scale(radiusX * scaleX, radiusY * scaleY);
		context.globalAlpha = alpha * alphaScale;
		context.filter = blur > 0 ? `blur(${blur}px)` : "none";
		const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
		gradient.addColorStop(0, toRgba(color, 1));
		gradient.addColorStop(0.42, toRgba(color, 0.72));
		gradient.addColorStop(0.76, toRgba(color, 0.16));
		gradient.addColorStop(1, toRgba(color, 0));
		context.fillStyle = gradient;
		context.beginPath();
		context.arc(0, 0, 1, 0, Math.PI * 2);
		context.fill();
		context.restore();
	};

	paintLayer({
		alphaScale: 0.15,
		blur: 54,
		scaleX: 5.5,
		scaleY: 2.5,
	});
	paintLayer({
		alphaScale: 0.25,
		blur: 34,
		scaleX: 4.0,
		scaleY: 1.8,
	});
	paintLayer({
		alphaScale: 0.35,
		blur: 16,
		scaleX: 2.5,
		scaleY: 1.2,
	});
}

function applyMask({
	context,
	height,
	width,
}: {
	context: CanvasRenderingContext2D;
	height: number;
	width: number;
}) {
	context.save();
	context.globalCompositeOperation = "destination-in";

	const radialMask = context.createRadialGradient(
		width * 0.5,
		height * 0.82,
		width * 0.08,
		width * 0.5,
		height * 0.82,
		width * 0.46,
	);
	radialMask.addColorStop(0, "rgba(0, 0, 0, 1)");
	radialMask.addColorStop(0.38, "rgba(0, 0, 0, 0.95)");
	radialMask.addColorStop(0.65, "rgba(0, 0, 0, 0.48)");
	radialMask.addColorStop(0.86, "rgba(0, 0, 0, 0.1)");
	radialMask.addColorStop(1, "rgba(0, 0, 0, 0)");
	context.fillStyle = radialMask;
	context.fillRect(0, 0, width, height);

	const verticalMask = context.createLinearGradient(0, 0, 0, height);
	verticalMask.addColorStop(0, "rgba(0, 0, 0, 0)");
	verticalMask.addColorStop(0.28, "rgba(0, 0, 0, 0.02)");
	verticalMask.addColorStop(0.54, "rgba(0, 0, 0, 0.22)");
	verticalMask.addColorStop(0.74, "rgba(0, 0, 0, 0.84)");
	verticalMask.addColorStop(1, "rgba(0, 0, 0, 1)");
	context.fillStyle = verticalMask;
	context.fillRect(0, 0, width, height);

	context.restore();
}

function resolveBarColor({
	index,
	palette,
	totalBars,
}: {
	index: number;
	palette: Palette;
	totalBars: number;
}) {
	const normalizedIndex = index / Math.max(1, totalBars - 1);
	const bucketIndex = Math.min(
		palette.colors.length - 1,
		Math.floor(normalizedIndex * palette.colors.length),
	);

	return palette.colors[bucketIndex] || palette.colors[0];
}

export function RovoAppComposerResponseGradient({
	active = false,
	className,
	phase = "warmup",
	signal = [],
}: Readonly<RovoAppComposerResponseGradientProps>) {
	const shouldReduceMotion = useReducedMotion();
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const activationTimeRef = useRef<number>(0);
	const activeRef = useRef(active);
	const phaseRef = useRef(phase);
	const signalRef = useRef(signal);
	const currentBarsRef = useRef<number[]>([]);
	const transitionSourceBarsRef = useRef<number[]>([]);
	const transitionStartTimeRef = useRef<number | null>(null);
	const previousPhaseRef = useRef(phase);
	const renderFrameRef = useRef<(time: number) => void>(() => {});
	const releaseStartTimeRef = useRef<number | null>(null);
	const releasingRef = useRef(false);

	useEffect(() => {
		const wasActive = activeRef.current;
		activeRef.current = active;

		if (active) {
			if (!wasActive) {
				activationTimeRef.current = performance.now();
			}
			releasingRef.current = false;
			releaseStartTimeRef.current = null;
			containerRef.current?.setAttribute("data-visible", "");
		} else if (wasActive && currentBarsRef.current.length > 0 && !shouldReduceMotion) {
			releaseStartTimeRef.current = performance.now();
			releasingRef.current = true;
		} else if (!releasingRef.current) {
			containerRef.current?.removeAttribute("data-visible");
		}
	}, [active, shouldReduceMotion]);

	useEffect(() => {
		signalRef.current = signal;
	}, [signal]);

	useEffect(() => {
		if (previousPhaseRef.current !== phase) {
			transitionSourceBarsRef.current = [...currentBarsRef.current];
			transitionStartTimeRef.current = performance.now();
			previousPhaseRef.current = phase;
		}

		phaseRef.current = phase;
	}, [phase]);

	useEffect(() => {
		renderFrameRef.current = (time: number) => {
			const canvas = canvasRef.current;
			const container = containerRef.current;
			if (!canvas || !container) {
				return;
			}

			const context = canvas.getContext("2d");
			if (!context) {
				return;
			}

			const width = container.clientWidth;
			const height = container.clientHeight;
			if (width === 0 || height === 0) {
				return;
			}

			const palette = PALETTE;
			const barCount = width < 560 ? 20 : 28;
			const barWidth = width < 560
				? phaseRef.current === "speaking" ? 68 : 60
				: phaseRef.current === "speaking" ? 96 : 84;
			const rawBarPitch = width < 560
				? phaseRef.current === "speaking" ? 12 : 10
				: phaseRef.current === "speaking" ? 16 : 14;

			let releaseProgress = 0;
			let releaseAlphaMultiplier = 1;
			let releaseHeightMultiplier = 1;
			let releaseFreqMultiplier = 1;
			let barPitch = rawBarPitch;

			if (releasingRef.current && releaseStartTimeRef.current != null) {
				const releaseElapsed = time - releaseStartTimeRef.current;
				const releaseRaw = Math.min(1, releaseElapsed / RELEASE_DURATION_MS);
				releaseProgress = 1 - (1 - releaseRaw) ** 2.5;
				releaseHeightMultiplier = Math.max(0, 1 - releaseProgress);
				releaseAlphaMultiplier = Math.max(0, 1 - releaseProgress * releaseProgress);
				releaseFreqMultiplier = 1 + releaseProgress * 2.5;
				barPitch = rawBarPitch * (1 - releaseProgress * 0.35);

				if (releaseRaw >= 1) {
					releasingRef.current = false;
					releaseStartTimeRef.current = null;
					context.clearRect(0, 0, width, height);
					return;
				}
			}

			const totalWidth = barWidth + Math.max(0, barCount - 1) * barPitch;
			const startX = (width - totalWidth) / 2;
			const normalizedTime = shouldReduceMotion
				? 1.2
				: (time - activationTimeRef.current) * 0.00008;
			const waveformCenterY = height * (phaseRef.current === "speaking" ? 0.7 : 0.76);
			const phaseSettings = phaseRef.current === "speaking"
				? {
					baseAlpha: 0.16,
					heightJitter: 0.04,
					minHeight: height * 0.2,
					scale: height * 0.4,
					smoothing: 0.005, // Much heavier frame lag for lazy transition
					xJitter: width < 560 ? 12.0 : 18.0,
					wobble: 0.2,
				}
				: {
					baseAlpha: 0.12,
					heightJitter: 0.02,
					minHeight: height * 0.15,
					scale: height * 0.25,
					smoothing: 0.003, // Much heavier frame lag for lazy transition
					xJitter: width < 560 ? 8.0 : 12.0,
					wobble: 0.15,
				};

			const targetBars: number[] = [];
			if (phaseRef.current === "speaking" && signalRef.current.length > 0) {
				const liveSignal = signalRef.current;
				const liveSignalSampleStartIndex = -LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE;
				const liveSignalSampleEndIndex = barCount - 1 + LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE;
				const liveSignalSampleCount = liveSignalSampleEndIndex - liveSignalSampleStartIndex + 1;
				const liveSignalSamples = new Array<number>(liveSignalSampleCount);

				for (let sampleOffset = 0; sampleOffset < liveSignalSampleCount; sampleOffset += 1) {
					const sampleIndex = liveSignalSampleStartIndex + sampleOffset;
					liveSignalSamples[sampleOffset] = getWaveformSeriesValue({
						bars: liveSignal,
						index: sampleIndex,
						totalCount: barCount,
					});
				}

				for (let index = 0; index < barCount; index += 1) {
					// We calculate a highly smoothed window of the surrounding bars
					// instead of matching 1:1 with the direct audio index.
					let smoothedSeriesValue = 0;
					for (
						let offset = -LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE;
						offset <= LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE;
						offset += 1
					) {
						const weight = 1 - (Math.abs(offset) / LIVE_SIGNAL_SMOOTHING_WEIGHT_TOTAL);
						smoothedSeriesValue +=
							liveSignalSamples[index + offset - liveSignalSampleStartIndex] * weight;
					}
					smoothedSeriesValue /= LIVE_SIGNAL_SMOOTHING_WEIGHT_TOTAL;

					const centerIndex = (barCount - 1) / 2;
					const normalizedDistance =
						Math.abs(index - centerIndex) / Math.max(1, centerIndex);
					const centerWeight = 0.84 + (1 - normalizedDistance) * 0.3;
					const wobble = shouldReduceMotion
						? 0
						: Math.sin(normalizedTime * 1.6 + index * 0.38) * phaseSettings.wobble
							+ Math.cos(normalizedTime * 0.95 - index * 0.17) * phaseSettings.wobble * 0.55;
					targetBars.push(
						Math.max(0.05, Math.min(1, smoothedSeriesValue * 0.25 * centerWeight + wobble + 0.15)),
					);
				}
			} else {
				const elapsedMs = time - activationTimeRef.current;
				for (let index = 0; index < barCount; index += 1) {
					const value = getStaticProcessingBarValue({
						barCount,
						elapsedMs,
						index,
						travelDurationMs: 4800, // Make the warmup sweeping motion extremely slow
					});
					targetBars.push(value);
				}
			}

			if (
				transitionStartTimeRef.current != null &&
				transitionSourceBarsRef.current.length > 0
			) {
				const progress = getWaveformEaseOutProgress({
					durationMs: STATIC_ACTIVE_HANDOFF_DURATION_MS * 1.75,
					elapsedMs: time - transitionStartTimeRef.current,
				});

				for (let index = 0; index < targetBars.length; index += 1) {
					const sourceValue = getWaveformSeriesValue({
						bars: transitionSourceBarsRef.current,
						index,
						totalCount: targetBars.length,
					});
					targetBars[index] =
						sourceValue * (1 - progress) + targetBars[index] * progress;
				}

				if (progress >= 1) {
					transitionSourceBarsRef.current = [];
					transitionStartTimeRef.current = null;
				}
			}

			if (currentBarsRef.current.length !== barCount) {
				currentBarsRef.current = [...targetBars];
			} else {
				for (let index = 0; index < barCount; index += 1) {
					const currentValue = currentBarsRef.current[index] ?? 0.05;
					currentBarsRef.current[index] =
						currentValue + (targetBars[index] - currentValue) * phaseSettings.smoothing;
				}
			}

			if (releaseHeightMultiplier < 1) {
				for (let index = 0; index < currentBarsRef.current.length; index += 1) {
					currentBarsRef.current[index] *= releaseHeightMultiplier;
				}
			}

			context.clearRect(0, 0, width, height);
			context.globalCompositeOperation = "source-over";
			context.fillStyle = toRgba(palette.shadow, 0.016);
			context.fillRect(0, height * 0.42, width, height * 0.58);

			context.globalCompositeOperation = "lighter";
			for (let index = 0; index < currentBarsRef.current.length; index += 1) {
				const value = currentBarsRef.current[index] ?? 0.05;
				const jitterX = shouldReduceMotion
					? 0
					: Math.sin(normalizedTime * 0.9 * releaseFreqMultiplier + index * 0.22) * phaseSettings.xJitter;
				const x = startX + index * barPitch + jitterX;
				const animatedValue = Math.max(
					0.05,
					value + (shouldReduceMotion ? 0 : Math.sin(normalizedTime * 1.3 * releaseFreqMultiplier + index * 0.31) * phaseSettings.heightJitter),
				);
				const barHeight = Math.max(
					phaseSettings.minHeight,
					animatedValue * phaseSettings.scale,
				);
				const y = waveformCenterY - barHeight / 2;
				const color = resolveBarColor({
					index,
					palette,
					totalBars: currentBarsRef.current.length,
				});

				drawGlowBar({
					alpha: (phaseSettings.baseAlpha + animatedValue * 0.12) * releaseAlphaMultiplier,
					barHeight,
					barWidth,
					color,
					context,
					x,
					y,
				});
			}

			context.globalCompositeOperation = "source-over";
			applyMask({
				context,
				height,
				width,
			});
		};
	}, [shouldReduceMotion]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) {
			return;
		}

		const resizeCanvas = () => {
			const width = container.clientWidth;
			const height = container.clientHeight;
			const dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.5);

			canvas.width = Math.max(1, Math.round(width * dpr));
			canvas.height = Math.max(1, Math.round(height * dpr));
			canvas.style.width = "100%";
			canvas.style.height = "100%";

			const context = canvas.getContext("2d");
			if (!context) {
				return;
			}

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.scale(dpr, dpr);

			if (activeRef.current || releasingRef.current) {
				renderFrameRef.current(performance.now());
			}
		};

		const observer = new ResizeObserver(resizeCanvas);
		observer.observe(container);
		resizeCanvas();

		return () => {
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!active) {
			if (releasingRef.current) {
				// Previous cleanup cancelled the loop; restart for release phase
				const releaseTick = (time: number) => {
					if (!releasingRef.current) {
						animationFrameRef.current = null;
						currentBarsRef.current = [];
						transitionSourceBarsRef.current = [];
						transitionStartTimeRef.current = null;
						releaseStartTimeRef.current = null;
						containerRef.current?.removeAttribute("data-visible");
						return;
					}

					renderFrameRef.current(time);
					animationFrameRef.current = window.requestAnimationFrame(releaseTick);
				};

				animationFrameRef.current = window.requestAnimationFrame(releaseTick);

				return () => {
					if (animationFrameRef.current !== null) {
						window.cancelAnimationFrame(animationFrameRef.current);
						animationFrameRef.current = null;
					}
				};
			}

			if (animationFrameRef.current !== null) {
				window.cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
			currentBarsRef.current = [];
			transitionSourceBarsRef.current = [];
			transitionStartTimeRef.current = null;
			return;
		}

		renderFrameRef.current(activationTimeRef.current);

		const tick = (time: number) => {
			if (!activeRef.current && !releasingRef.current) {
				animationFrameRef.current = null;
				return;
			}

			renderFrameRef.current(time);
			animationFrameRef.current = window.requestAnimationFrame(tick);
		};

		animationFrameRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (animationFrameRef.current !== null) {
				window.cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	}, [active]);

	useEffect(() => {
		if (active || releasingRef.current) {
			renderFrameRef.current(performance.now());
		}
	}, [active, phase, shouldReduceMotion, signal]);

	useEffect(() => {
		return () => {
			if (animationFrameRef.current !== null) {
				window.cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, []);

	return (
		<div
			className={cn(
				"pointer-events-none absolute bottom-[-8%] left-1/2 z-0 aspect-[4.2/1] w-[175%] -translate-x-1/2 overflow-visible opacity-0 transition-opacity duration-medium ease-out data-[visible]:opacity-100",
				className,
			)}
			data-slot="rovo-app-response-gradient"
			ref={containerRef}
		>
			<canvas
				className="absolute inset-0 h-full w-full pointer-events-none"
				data-slot="rovo-app-response-gradient-canvas"
				ref={canvasRef}
			/>
		</div>
	);
}
