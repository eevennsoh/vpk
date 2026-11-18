"use client";

import { useMemo, useState } from "react";

import { MorphingRovo } from "@/components/ui/morphing-rovo";
import { GUI } from "@/components/utils/gui";

const EASE_OPTIONS = [
	{ value: "easeInOut" as const, label: "easeInOut (default)" },
	{ value: "backOut" as const, label: "backOut" },
	{ value: "circOut" as const, label: "circOut" },
	{ value: "linear" as const, label: "linear" },
] as const;

export default function MorphingRovoDemo() {
	const [size, setSize] = useState(64);
	const [duration, setDuration] = useState(0.8);
	const [ease, setEase] = useState<(typeof EASE_OPTIONS)[number]["value"]>("easeInOut");
	const [rotationPerStep, setRotationPerStep] = useState(180);
	const [blur, setBlur] = useState(1.25);

	const config = useMemo(
		() => ({
			size,
			duration,
			ease,
			rotationPerStep,
			blur,
		}),
		[size, duration, ease, rotationPerStep, blur],
	);

	return (
		<div className="grid h-full w-full gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
			<div className="flex h-full min-h-[350px] w-full items-center justify-center rounded-lg bg-surface p-12">
				<MorphingRovo.Shape size={size} duration={duration} ease={ease} rotationPerStep={rotationPerStep} blur={blur} />
			</div>
			<div className="pt-6 pr-6">
			<GUI.Panel title="Morphing Rovo controls" values={config}>
				<GUI.Control
					id="morphing-size"
					label="Size"
					description="Width and height of the shape in pixels."
					value={size}
					defaultValue={64}
					min={16}
					max={192}
					step={1}
					unit="px"
					onChange={setSize}
				/>
				<GUI.Control
					id="morphing-duration"
					label="Duration"
					description="Duration of each morph step in seconds."
					value={duration}
					defaultValue={0.8}
					min={0.2}
					max={2}
					step={0.1}
					unit="s"
					onChange={setDuration}
				/>
				<GUI.Select
					id="morphing-ease"
					label="Ease"
					description="Easing function for each morph transition."
					value={ease}
					options={EASE_OPTIONS}
					onChange={setEase}
				/>
				<GUI.Control
					id="morphing-rotation"
					label="Rotation"
					description="Clockwise rotation applied during each morph step."
					value={rotationPerStep}
					defaultValue={180}
					min={0}
					max={360}
					step={15}
					unit="deg"
					onChange={setRotationPerStep}
				/>
				<GUI.Control
					id="morphing-blur"
					label="Blur"
					description="Max blur radius at transition midpoints. 0 disables."
					value={blur}
					defaultValue={1.25}
					min={0}
					max={8}
					step={0.25}
					unit="px"
					onChange={setBlur}
				/>
			</GUI.Panel>
			</div>
		</div>
	);
}
