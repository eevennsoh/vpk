"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Shimmer } from "@/components/ui/shimmer";
import { Spinner } from "@/components/ui/spinner";
import { GUI } from "@/components/utils/gui";
import { token } from "@/lib/tokens";

function ShimmerCaption({ children }: Readonly<{ children: string }>) {
	return <p className="font-mono text-xs text-muted-foreground">{children}</p>;
}

function ShimmerComparison({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="mx-auto grid w-full max-w-lg gap-6 text-center text-sm sm:grid-cols-2">
			{children}
		</div>
	);
}

function ShimmerComparisonCell({ children }: Readonly<{ children: ReactNode }>) {
	return <div className="flex flex-col items-center gap-3">{children}</div>;
}

export default function ShimmerDemo() {
	return <Shimmer className="text-sm">Generating response…</Shimmer>;
}

export function ShimmerDemoMarker() {
	return (
		<div className="flex w-full max-w-sm flex-col gap-4">
			<Marker role="status">
				<MarkerIcon>
					<Spinner />
				</MarkerIcon>
				<MarkerContent className="shimmer">Thinking…</MarkerContent>
			</Marker>
			<Marker variant="separator" role="status">
				<MarkerContent className="shimmer">Reading 4 files</MarkerContent>
			</Marker>
		</div>
	);
}

export function ShimmerDemoColor() {
	return (
		<div className="flex flex-col items-center gap-2 text-sm">
			<Shimmer className="shimmer-color-blue-500/60">Generating response…</Shimmer>
			<Shimmer className="shimmer-color-[#378ADD]">Generating response…</Shimmer>
		</div>
	);
}

export function ShimmerDemoDuration() {
	return (
		<ShimmerComparison>
			<ShimmerComparisonCell>
				<Shimmer>Generating response…</Shimmer>
				<ShimmerCaption>default (2s)</ShimmerCaption>
			</ShimmerComparisonCell>
			<ShimmerComparisonCell>
				<Shimmer duration={1}>Generating response…</Shimmer>
				<ShimmerCaption>{"duration={1}"}</ShimmerCaption>
			</ShimmerComparisonCell>
		</ShimmerComparison>
	);
}

export function ShimmerDemoSpread() {
	return (
		<ShimmerComparison>
			<ShimmerComparisonCell>
				<Shimmer className="shimmer-spread-4">Generating response…</Shimmer>
				<ShimmerCaption>shimmer-spread-4</ShimmerCaption>
			</ShimmerComparisonCell>
			<ShimmerComparisonCell>
				<Shimmer className="shimmer-spread-24">Generating response…</Shimmer>
				<ShimmerCaption>shimmer-spread-24</ShimmerCaption>
			</ShimmerComparisonCell>
		</ShimmerComparison>
	);
}

export function ShimmerDemoSpreadMultiplier() {
	return (
		<div className="flex flex-col gap-3 text-sm">
			<Shimmer spread={1}>Narrow spread</Shimmer>
			<Shimmer spread={4}>Wide spread</Shimmer>
			<Shimmer spread={8}>Extra wide spread</Shimmer>
		</div>
	);
}

export function ShimmerDemoAngle() {
	return (
		<ShimmerComparison>
			<ShimmerComparisonCell>
				<Shimmer>Generating response…</Shimmer>
				<ShimmerCaption>shimmer</ShimmerCaption>
			</ShimmerComparisonCell>
			<ShimmerComparisonCell>
				<Shimmer className="shimmer-angle-45">Generating response…</Shimmer>
				<ShimmerCaption>shimmer-angle-45</ShimmerCaption>
			</ShimmerComparisonCell>
		</ShimmerComparison>
	);
}

export function ShimmerDemoReverse() {
	return (
		<ShimmerComparison>
			<ShimmerComparisonCell>
				<Shimmer>Generating response…</Shimmer>
				<ShimmerCaption>shimmer</ShimmerCaption>
			</ShimmerComparisonCell>
			<ShimmerComparisonCell>
				<Shimmer className="shimmer-reverse">Generating response…</Shimmer>
				<ShimmerCaption>shimmer-reverse</ShimmerCaption>
			</ShimmerComparisonCell>
		</ShimmerComparison>
	);
}

export function ShimmerDemoOnce() {
	const [key, setKey] = useState(0);

	return (
		<div className="flex flex-col items-center gap-4">
			<Shimmer key={key} duration={1.1} className="text-sm shimmer-once">
				Generating response…
			</Shimmer>
			<Button variant="outline" size="compact" onClick={() => setKey((value) => value + 1)}>
				Replay
			</Button>
		</div>
	);
}

export function ShimmerDemoDisabled() {
	return (
		<div className="flex flex-col items-center gap-3 text-sm">
			<Shimmer className="md:shimmer-none">Generating response…</Shimmer>
			<ShimmerCaption>shimmer md:shimmer-none</ShimmerCaption>
		</div>
	);
}

export function ShimmerDemoFallback() {
	// Shimmer always applies `shimmer`, so a conditional class needs a plain element.
	return (
		<p className="text-sm text-muted-foreground supports-[color:oklch(from_white_l_c_h)]:shimmer">
			Generating response…
		</p>
	);
}

export function ShimmerDemoRtl() {
	return (
		<ShimmerComparison>
			<ShimmerComparisonCell>
				<Shimmer dir="ltr">Generating response…</Shimmer>
				<ShimmerCaption>dir=&quot;ltr&quot;</ShimmerCaption>
			</ShimmerComparisonCell>
			<ShimmerComparisonCell>
				<Shimmer dir="rtl">جارٍ إنشاء الرد…</Shimmer>
				<ShimmerCaption>dir=&quot;rtl&quot;</ShimmerCaption>
			</ShimmerComparisonCell>
		</ShimmerComparison>
	);
}

export function ShimmerDemoPolymorphic() {
	return (
		<div className="flex flex-col gap-3">
			<Shimmer as="h2" style={{ font: token("font.heading.large") }}>
				Generating response
			</Shimmer>
			<Shimmer as="span" className="text-xs">
				Processing your request…
			</Shimmer>
		</div>
	);
}

export function ShimmerDemoPlayground() {
	const [key, setKey] = useState(0);
	const [duration, setDuration] = useState(2);
	const [spread, setSpread] = useState(2);
	const hasHydratedRef = useRef(false);

	const shimmerConfig = useMemo(() => ({ duration, spread }), [duration, spread]);

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
	}, [shimmerConfig, handleRetry]);

	return (
		<div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<div className="flex w-full items-center py-10">
				<Shimmer key={key} duration={duration} spread={spread} className="text-sm">
					Thinking
				</Shimmer>
			</div>
			<GUI.Panel title="Neutral shimmer" values={shimmerConfig}>
				<GUI.Control
					id="shimmer-duration"
					label="Duration"
					description="How long one full shimmer sweep takes."
					value={duration}
					defaultValue={2}
					min={0.5}
					max={6}
					step={0.1}
					unit="s"
					onChange={setDuration}
				/>
				<GUI.Control
					id="shimmer-spread"
					label="Spread"
					description="Width of the highlight band across the text."
					value={spread}
					defaultValue={2}
					min={0.1}
					max={10}
					step={0.1}
					onChange={setSpread}
				/>
			</GUI.Panel>
		</div>
	);
}
