"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ShimmerWave } from "@/components/ui-custom/shimmer-wave";
import { GUI } from "@/components/utils/gui";

function ShimmerWaveDemoPreview() {
	const [key, setKey] = useState(0);
	const [duration, setDuration] = useState(1.4);
	const [spread, setSpread] = useState(2);
	const [xDistance, setXDistance] = useState(3);
	const [yDistance, setYDistance] = useState(-2);
	const [zDistance, setZDistance] = useState(12);
	const [scaleDistance, setScaleDistance] = useState(1.12);
	const [rotateYDistance, setRotateYDistance] = useState(14);
	const [blurDistance, setBlurDistance] = useState(1.5);
	const [repeatDelay, setRepeatDelay] = useState(0.1);
	const hasHydratedRef = useRef(false);

	const waveConfig = useMemo(
		() => ({
			duration,
			spread,
			xDistance,
			yDistance,
			zDistance,
			scaleDistance,
			rotateYDistance,
			blurDistance,
			transition: { ease: "easeInOut", repeatDelay },
		}),
		[
			duration,
			spread,
			xDistance,
			yDistance,
			zDistance,
			scaleDistance,
			rotateYDistance,
			blurDistance,
			repeatDelay,
		]
	);

	const handleRetry = useCallback(() => {
		setKey((prev) => prev + 1);
	}, []);

	useEffect(() => {
		if (!hasHydratedRef.current) {
			hasHydratedRef.current = true;
			return;
		}

		const timeoutId = window.setTimeout(() => {
			handleRetry();
		}, 75);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [waveConfig, handleRetry]);

	return (
		<div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<div className="flex w-full items-center py-10">
				<ShimmerWave
					key={key}
					baseColor="var(--color-muted-foreground)"
					baseGradientColor={["#1868db", "#bf63f3", "#fca700"]}
					blurDistance={blurDistance}
					duration={duration}
					rotateYDistance={rotateYDistance}
					scaleDistance={scaleDistance}
					spread={spread}
					transition={{ ease: "easeInOut", repeatDelay }}
					xDistance={xDistance}
					yDistance={yDistance}
					zDistance={zDistance}
					className="text-sm"
				>
					Wave shimmer
				</ShimmerWave>
			</div>
			<GUI.Panel title="Gradient wave" values={waveConfig}>
				<GUI.Control
					id="wave-duration"
					label="Duration"
					description="How long one full wave cycle takes."
					value={duration}
					defaultValue={1.4}
					min={0.4}
					max={3}
					step={0.05}
					unit="s"
					onChange={setDuration}
				/>
				<GUI.Control
					id="wave-spread"
					label="Spread"
					description="How staggered the characters are across the wave."
					value={spread}
					defaultValue={2}
					min={0.5}
					max={4}
					step={0.1}
					onChange={setSpread}
				/>
				<GUI.Control
					id="wave-x-distance"
					label="X distance"
					description="How far each character moves left/right."
					value={xDistance}
					defaultValue={3}
					min={-6}
					max={6}
					step={0.1}
					unit="px"
					onChange={setXDistance}
				/>
				<GUI.Control
					id="wave-y-distance"
					label="Y distance"
					description="How far each character moves up/down."
					value={yDistance}
					defaultValue={-2}
					min={-6}
					max={6}
					step={0.1}
					unit="px"
					onChange={setYDistance}
				/>
				<GUI.Control
					id="wave-z-distance"
					label="Z distance"
					description="How much depth push/pull is applied toward the viewer."
					value={zDistance}
					defaultValue={12}
					min={-30}
					max={30}
					step={0.5}
					unit="px"
					onChange={setZDistance}
				/>
				<GUI.Control
					id="wave-scale-distance"
					label="Scale distance"
					description="How much each character grows at the wave peak."
					value={scaleDistance}
					defaultValue={1.12}
					min={0.5}
					max={2}
					step={0.01}
					unit="x"
					onChange={setScaleDistance}
				/>
				<GUI.Control
					id="wave-rotate-y-distance"
					label="Rotate Y distance"
					description="How much each character tilts around the vertical axis."
					value={rotateYDistance}
					defaultValue={14}
					min={-30}
					max={30}
					step={0.5}
					unit="deg"
					onChange={setRotateYDistance}
				/>
				<GUI.Control
					id="wave-blur-distance"
					label="Blur"
					description="How much each character blurs as the wave passes, before coming back into focus."
					value={blurDistance}
					defaultValue={1.5}
					min={0}
					max={8}
					step={0.1}
					unit="px"
					onChange={setBlurDistance}
				/>
				<GUI.Control
					id="wave-repeat-delay"
					label="Repeat delay"
					description="Pause time before the next wave cycle starts."
					value={repeatDelay}
					defaultValue={0.1}
					min={0}
					max={2}
					step={0.01}
					unit="s"
					onChange={setRepeatDelay}
				/>
			</GUI.Panel>
		</div>
	);
}

export default function ShimmerWaveDemo() {
	return (
		<div className="flex w-full flex-col gap-8">
			<ShimmerWaveDemoPreview />
		</div>
	);
}

export function ShimmerWaveDemoBasic() {
	return (
		<div className="flex flex-col gap-3">
			<ShimmerWave className="text-sm">Wave shimmer</ShimmerWave>
			<ShimmerWave duration={1.2} className="text-sm">Faster wave shimmer</ShimmerWave>
		</div>
	);
}

export function ShimmerWaveDemoColors() {
	return (
		<div className="flex flex-col gap-3">
			<ShimmerWave className="text-sm">Neutral wave shimmer</ShimmerWave>
			<ShimmerWave
				baseColor="var(--color-muted-foreground)"
				baseGradientColor={["#1868db", "#bf63f3", "#fca700"]}
				className="text-sm"
			>
				Dot-inspired gradient highlight
			</ShimmerWave>
		</div>
	);
}

export function ShimmerWaveDemoGeometry() {
	return (
		<div className="flex flex-col gap-3">
			<ShimmerWave xDistance={1} yDistance={-1} className="text-sm">
				Subtle geometry
			</ShimmerWave>
			<ShimmerWave xDistance={4} yDistance={-3} className="text-sm">
				Expressive geometry
			</ShimmerWave>
		</div>
	);
}

export function ShimmerWaveDemoDepth() {
	return (
		<div className="flex flex-col gap-3">
			<ShimmerWave zDistance={6} scaleDistance={1.04} rotateYDistance={6} className="text-sm">
				Soft depth
			</ShimmerWave>
			<ShimmerWave zDistance={16} scaleDistance={1.16} rotateYDistance={16} className="text-sm">
				Strong depth
			</ShimmerWave>
		</div>
	);
}

export function ShimmerWaveDemoTimingSpread() {
	return (
		<div className="flex flex-col gap-3">
			<ShimmerWave duration={0.9} spread={1} className="text-sm">
				Tight and fast
			</ShimmerWave>
			<ShimmerWave duration={1.8} spread={3} className="text-sm">
				Wide and relaxed
			</ShimmerWave>
		</div>
	);
}

export function ShimmerWaveDemoFullConfig() {
	return (
		<ShimmerWave
			baseColor="var(--color-muted-foreground)"
			baseGradientColor={["#1868db", "#bf63f3", "#fca700"]}
			blurDistance={1.5}
			duration={1.4}
			rotateYDistance={14}
			scaleDistance={1.12}
			spread={2}
			transition={{ ease: "easeInOut", repeatDelay: 0.1 }}
			xDistance={3}
			yDistance={-2}
			zDistance={12}
			className="text-sm"
		>
			Full wave configuration
		</ShimmerWave>
	);
}
