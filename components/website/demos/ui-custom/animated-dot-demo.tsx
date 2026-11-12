import { AnimatedDot } from "@/components/ui-custom/animated-dot";

export default function AnimatedDotDemo() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<span className="text-xs text-text-subtlest">Neutral</span>
				<span className="inline-flex items-baseline text-sm text-text-subtlest">
					Thinking
					<AnimatedDot variant="neutral" />
				</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-xs text-text-subtlest">Color</span>
				<span className="inline-flex items-baseline text-sm text-text-subtlest">
					Thinking
					<AnimatedDot variant="color" />
				</span>
			</div>
		</div>
	);
}

export function AnimatedDotDemoVariants() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<span className="text-xs text-text-subtlest">Neutral — text subtlest</span>
				<span className="inline-flex items-baseline text-sm text-text-subtlest">
					Thinking
					<AnimatedDot variant="neutral" />
				</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-xs text-text-subtlest">Neutral — matching label color</span>
				<span className="inline-flex items-baseline text-sm text-text-subtle">
					Thinking
					<AnimatedDot variant="neutral" />
				</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-xs text-text-subtlest">Color — Rovo palette</span>
				<span className="inline-flex items-baseline text-sm text-text-subtlest">
					Thinking
					<AnimatedDot variant="color" />
				</span>
			</div>
		</div>
	);
}

export function AnimatedDotDemoCustomColors() {
	return (
		<div className="flex flex-col gap-4">
			<span className="inline-flex items-baseline text-sm text-text-subtle">
				Ocean palette
				<AnimatedDot variant="color" colors={["#0891b2", "#06b6d4", "#22d3ee"]} />
			</span>
			<span className="inline-flex items-baseline text-sm text-text-subtle">
				Warm palette
				<AnimatedDot variant="color" colors={["#ef4444", "#f97316", "#eab308"]} />
			</span>
			<span className="inline-flex items-baseline text-sm text-text-subtle">
				Mono
				<AnimatedDot variant="color" colors={["#6b7280", "#9ca3af", "#d1d5db"]} />
			</span>
		</div>
	);
}

export function AnimatedDotDemoTiming() {
	return (
		<div className="flex flex-col gap-4">
			<span className="inline-flex items-baseline text-sm text-text-subtlest">
				Fast (0.6s)
				<AnimatedDot duration={0.6} staggerDelay={0.1} />
			</span>
			<span className="inline-flex items-baseline text-sm text-text-subtlest">
				Default (1.2s)
				<AnimatedDot />
			</span>
			<span className="inline-flex items-baseline text-sm text-text-subtlest">
				Slow (2.4s)
				<AnimatedDot duration={2.4} staggerDelay={0.4} />
			</span>
		</div>
	);
}

export function AnimatedDotDemoSizes() {
	return (
		<div className="flex flex-col gap-4">
			<span className="inline-flex items-baseline text-xs text-text-subtlest">
				Extra small
				<AnimatedDot className="[&>span]:text-xs" />
			</span>
			<span className="inline-flex items-baseline text-sm text-text-subtlest">
				Small (default)
				<AnimatedDot />
			</span>
			<span className="inline-flex items-baseline text-base text-text-subtlest">
				Base
				<AnimatedDot className="[&>span]:text-base" />
			</span>
			<span className="inline-flex items-baseline text-lg text-text-subtlest">
				Large
				<AnimatedDot className="[&>span]:text-lg" />
			</span>
		</div>
	);
}
