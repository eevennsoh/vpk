"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useInView } from "motion/react";
import { Button } from "@/components/ui/button";
import {
	ProgressCircle,
	type ProgressCircleSegment,
} from "@/components/ui-custom/progress-circle";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/** Sample Checks-style status groups: lime / danger / pending track. */
const CHECK_SEGMENTS: readonly ProgressCircleSegment[] = [
	{ status: "passed", weight: 5 },
	{ status: "failed", weight: 1 },
	{ status: "pending", weight: 2 },
];

export default function ProgressCircleDemo() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center gap-6">
				<ProgressCircle size="lg" />
				<ProgressCircle value={50} size="lg" />
				<ProgressCircle value={100} size="lg" />
			</div>
			<div className="flex items-center gap-6">
				<ProgressCircle variant="filled" size="lg" />
				<ProgressCircle variant="filled" value={50} size="lg" />
				<ProgressCircle variant="filled" value={100} size="lg" />
			</div>
			<div className="flex items-center gap-6">
				<ProgressCircle status="error" size="lg" />
				<ProgressCircle status="info" size="lg" />
			</div>
			<div className="flex items-center gap-6">
				<ProgressCircle
					animated={false}
					label="CI checks"
					segmented
					segments={CHECK_SEGMENTS}
					size="lg"
				/>
				<ProgressCircle
					animated={false}
					label="CI checks filled"
					segmented
					segments={CHECK_SEGMENTS}
					size="lg"
					variant="filled"
				/>
			</div>
		</div>
	);
}

export function ProgressCircleDemoDefault() {
	return <ProgressCircle value={65} size="lg" />;
}

export function ProgressCircleDemoIndeterminate() {
	return (
		<div className="flex items-center gap-6">
			<ProgressCircle size="sm" />
			<ProgressCircle />
			<ProgressCircle size="lg" />
		</div>
	);
}

export function ProgressCircleDemoValues() {
	return (
		<div className="flex items-center gap-6">
			<ProgressCircle value={0} size="sm" />
			<ProgressCircle value={25} size="sm" />
			<ProgressCircle value={50} size="sm" />
			<ProgressCircle value={75} size="sm" />
			<ProgressCircle value={100} size="sm" />
		</div>
	);
}

export function ProgressCircleDemoComplete() {
	return <ProgressCircle value={100} size="lg" />;
}

export function ProgressCircleDemoSizes() {
	return (
		<div className="flex items-center gap-6">
			<ProgressCircle value={65} size="sm" />
			<ProgressCircle value={65} />
			<ProgressCircle value={65} size="lg" />
		</div>
	);
}

export function ProgressCircleDemoControlled() {
	const [value, setValue] = useState(50);

	return (
		<div className="flex w-full max-w-xs items-center gap-4">
			<ProgressCircle value={value} size="lg" />
			<Slider value={value} onValueChange={(v) => setValue(v as number)} min={0} max={100} step={1} />
		</div>
	);
}

export function ProgressCircleDemoFilled() {
	return (
		<div className="flex items-center gap-6">
			<ProgressCircle variant="filled" value={0} size="lg" />
			<ProgressCircle variant="filled" value={25} size="lg" />
			<ProgressCircle variant="filled" value={50} size="lg" />
			<ProgressCircle variant="filled" value={75} size="lg" />
			<ProgressCircle variant="filled" value={100} size="lg" />
		</div>
	);
}

export function ProgressCircleDemoFilledControlled() {
	const [value, setValue] = useState(0);
	const [animateDashes, setAnimateDashes] = useState(true);
	const [colorByProgress, setColorByProgress] = useState(true);
	const [playing, setPlaying] = useState(false);
	const animationId = useId();
	const colorId = useId();
	const containerRef = useRef<HTMLDivElement>(null);
	const isVisible = useInView(containerRef);

	useEffect(() => {
		if (!playing || !isVisible || value >= 100) return;
		const timeout = window.setTimeout(() => setValue((current) => Math.min(100, current + 25)), 1500);
		return () => window.clearTimeout(timeout);
	}, [isVisible, playing, value]);

	function selectValue(next: number) {
		setPlaying(false);
		setValue(next);
	}

	return (
		<div ref={containerRef} className="flex w-full max-w-sm flex-col gap-6">
			<div className="flex items-center justify-center gap-4">
				<ProgressCircle variant="filled" dashed animateDashes={animateDashes} colorByProgress={colorByProgress} value={value} className="size-16" label="Filled progress" />
			</div>
			<div className="flex flex-col gap-3">
				<Slider aria-label="Filled progress percentage" value={value} onValueChange={(v) => selectValue(v as number)} min={0} max={100} step={25} />
				<div className="flex flex-wrap justify-center gap-1">
					{[0, 25, 50, 75, 100].map((step) => (
						<Button key={step} size="compact" variant={value === step ? "secondary" : "ghost"} aria-current={value === step ? "step" : undefined} onClick={() => selectValue(step)}>
							{step}%
						</Button>
					))}
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<Switch id={animationId} checked={animateDashes} onCheckedChange={setAnimateDashes} />
						<Label htmlFor={animationId}>Animate dashed border</Label>
					</div>
					<div className="flex items-center gap-2">
						<Switch id={colorId} checked={colorByProgress} onCheckedChange={setColorByProgress} />
						<Label htmlFor={colorId}>Color by progress</Label>
					</div>
				</div>
				<Button variant="outline" onClick={() => {
					if (playing && value < 100) {
						setPlaying(false);
					} else {
						setValue(0);
						setPlaying(true);
					}
				}}>
					{playing && value < 100 ? "Pause" : value === 100 ? "Replay" : "Play sequence"}
				</Button>
			</div>
		</div>
	);
}

export function ProgressCircleDemoStatus() {
	return (
		<div className="flex items-center gap-6">
			<ProgressCircle status="error" size="sm" />
			<ProgressCircle status="error" />
			<ProgressCircle status="error" size="lg" />
			<ProgressCircle status="info" size="sm" />
			<ProgressCircle status="info" />
			<ProgressCircle status="info" size="lg" />
		</div>
	);
}

export function ProgressCircleDemoSegmented() {
	const [segmented, setSegmented] = useState(true);

	return (
		<div className="flex w-full max-w-xs flex-col gap-4">
			<div className="flex items-center gap-2">
				<Switch
					checked={segmented}
					id="progress-circle-segmented"
					label="Segmented mode"
					onCheckedChange={setSegmented}
				/>
				<Label htmlFor="progress-circle-segmented">
					{segmented ? "Segmented" : "Continuous"}
				</Label>
			</div>
			<div className="flex items-center gap-6">
				<ProgressCircle
					animated={false}
					label={segmented ? "CI checks" : "Progress"}
					segmented={segmented}
					segments={CHECK_SEGMENTS}
					size="lg"
					value={segmented ? undefined : 75}
				/>
				<ProgressCircle
					animated={false}
					label={segmented ? "CI checks filled" : "Progress filled"}
					segmented={segmented}
					segments={CHECK_SEGMENTS}
					size="lg"
					value={segmented ? undefined : 75}
					variant="filled"
				/>
			</div>
		</div>
	);
}
