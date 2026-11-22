"use client";

import { useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	DistortionWave,
	type DistortionWaveHandle,
	type DistortionWaveProps,
	type WaveType,
} from "@/components/visual/distortion-waves";
import { cn } from "@/lib/utils";

export type DistortionWaveSceneWaveProps = Omit<
	DistortionWaveProps,
	"type" | "revealed" | "source" | "revealedContent" | "overlay" | "children" | "ref"
>;

const CART_ITEMS = [
	{ name: "Studio headphones", detail: "Graphite", price: "$249.00" },
	{ name: "Braided cable", detail: "2 m", price: "$19.00" },
	{ name: "Travel case", detail: "Hard shell", price: "$39.00" },
] as const;

const TRIGGER_LABELS: Readonly<Record<WaveType, readonly [string, string]>> = {
	vertical: ["Pay $307.00", "Back to cart"],
	horizontal: ["Next", "Back"],
	center: ["Complete profile", "Edit profile"],
};

function ViewShell({
	children,
	hidden,
	type,
}: Readonly<{ children: ReactNode; hidden: boolean; type: WaveType }>) {
	return (
		<div
			aria-hidden={hidden || undefined}
			className={cn(
				"flex size-full flex-col gap-4 bg-surface p-6 text-text",
				type === "horizontal" ? "pl-16" : null,
				type === "center" ? "items-center justify-center text-center" : null,
			)}
		>
			{children}
		</div>
	);
}

function ContentView({ hidden, type }: Readonly<{ hidden: boolean; type: WaveType }>) {
	if (type === "center") {
		return (
			<ViewShell hidden={hidden} type={type}>
				<div className="size-24" />
				<p className="text-sm font-semibold">Set up your profile</p>
				<p className="max-w-56 text-sm text-text-subtle">Tap your avatar to finish onboarding.</p>
			</ViewShell>
		);
	}

	return (
		<ViewShell hidden={hidden} type={type}>
			<div className="flex items-baseline justify-between">
				<p className="text-sm font-semibold">Your cart</p>
				<p className="text-xs text-text-subtlest">3 items</p>
			</div>
			<ul className="flex flex-col gap-3">
				{CART_ITEMS.map((item, index) => (
					<li key={item.name} className="flex items-center gap-3 rounded-xl bg-bg-neutral p-3">
						<div
							className={cn(
								"size-10 shrink-0 rounded-lg",
								index === 0 ? "bg-purple-200" : index === 1 ? "bg-teal-200" : "bg-orange-200",
							)}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">{item.name}</p>
							<p className="text-xs text-text-subtle">{item.detail}</p>
						</div>
						<p className="text-sm font-medium">{item.price}</p>
					</li>
				))}
			</ul>
			<div className="mt-auto flex justify-between border-t border-border pt-3 text-sm font-semibold">
				<span>Total</span>
				<span>$307.00</span>
			</div>
			{type === "vertical" ? <div className="h-10" /> : null}
		</ViewShell>
	);
}

function RevealedView({ hidden, type }: Readonly<{ hidden: boolean; type: WaveType }>) {
	return (
		<ViewShell hidden={hidden} type={type}>
			<div className={cn("flex flex-1 flex-col justify-center gap-3", type === "center" ? "items-center" : null)}>
				{type === "center" ? <div className="size-24" /> : (
					<Icon render={<CheckCircleIcon label="" size="medium" />} aria-hidden className="text-icon-success" />
				)}
				<p className="text-sm font-semibold">
					{type === "vertical" ? "Payment received" : type === "horizontal" ? "Step 2 of 3" : "Profile complete"}
				</p>
				<p className="max-w-64 text-sm text-text-subtle">
					{type === "vertical"
						? "Order #4821 is on its way. A receipt has been sent to your email."
						: type === "horizontal"
							? "Shipping details are saved. Choose a delivery window next."
							: "You're all set. Your teammates can now find you."}
				</p>
			</div>
		</ViewShell>
	);
}

function SceneTrigger({
	onToggle,
	ref,
	revealed,
	type,
}: Readonly<{
	onToggle: () => void;
	ref: Ref<HTMLButtonElement>;
	revealed: boolean;
	type: WaveType;
}>) {
	const label = TRIGGER_LABELS[type][revealed ? 1 : 0];

	if (type === "center") {
		return (
			<button
				ref={ref}
				type="button"
				aria-label={label}
				aria-pressed={revealed}
				onClick={onToggle}
				className="absolute top-1/2 left-1/2 -mt-24 -translate-x-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focused"
			>
				<Avatar size="2xl">
					<AvatarFallback>EV</AvatarFallback>
				</Avatar>
			</button>
		);
	}

	if (type === "horizontal") {
		return (
			<button
				ref={ref}
				type="button"
				aria-pressed={revealed}
				onClick={onToggle}
				className="absolute inset-y-0 left-0 flex w-10 items-center justify-center bg-bg-neutral-bold text-text-inverse focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-border-focused"
			>
				<span className="-rotate-90 text-xs font-semibold whitespace-nowrap">{label}</span>
			</button>
		);
	}

	return (
		<Button
			ref={ref}
			aria-pressed={revealed}
			onClick={onToggle}
			className="absolute inset-x-6 bottom-6"
		>
			{label}
		</Button>
	);
}

export function DistortionWaveScene({
	className,
	onRevealedChange,
	revealed: controlledRevealed,
	type,
	waveProps,
}: Readonly<{
	className?: string;
	onRevealedChange?: (revealed: boolean) => void;
	revealed?: boolean;
	type: WaveType;
	waveProps?: DistortionWaveSceneWaveProps;
}>) {
	const [localRevealed, setLocalRevealed] = useState(false);
	const revealed = controlledRevealed ?? localRevealed;
	const sourceRef = useRef<HTMLButtonElement>(null);

	function toggle() {
		const next = !revealed;
		setLocalRevealed(next);
		onRevealedChange?.(next);
	}

	return (
		<DistortionWave
			{...waveProps}
			type={type}
			revealed={revealed}
			source={sourceRef}
			revealedContent={<RevealedView hidden={!revealed} type={type} />}
			overlay={<SceneTrigger ref={sourceRef} revealed={revealed} type={type} onToggle={toggle} />}
			className={cn("h-[480px] w-full max-w-sm overflow-hidden rounded-3xl border border-border shadow-sm", className)}
		>
			<ContentView hidden={revealed} type={type} />
		</DistortionWave>
	);
}

/** One view: the wave carries the card into itself, started imperatively. */
export function DistortionWaveSingleViewScene({ className }: Readonly<{ className?: string }>) {
	const waveRef = useRef<DistortionWaveHandle>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [saved, setSaved] = useState(false);
	const overlay = useMemo(() => (
		<Button
			ref={buttonRef}
			variant="secondary"
			onClick={() => {
				setSaved(false);
				waveRef.current?.play({ source: buttonRef });
			}}
			className="absolute inset-x-6 bottom-6"
		>
			{saved ? "Saved — save again" : "Save draft"}
		</Button>
	), [saved]);

	return (
		<DistortionWave
			ref={waveRef}
			overlay={overlay}
			onFinish={() => setSaved(true)}
			className={cn("h-80 w-full max-w-xs overflow-hidden rounded-3xl border border-border shadow-sm", className)}
		>
			<div className="flex size-full flex-col gap-3 bg-surface p-6 text-text">
				<p className="text-sm font-semibold">Release notes</p>
				<p className="text-sm text-text-subtle">
					Faster sync, a calmer notification digest and keyboard shortcuts for every board action.
				</p>
				<div className="h-2 w-3/4 rounded-full bg-bg-neutral" />
				<div className="h-2 w-1/2 rounded-full bg-bg-neutral" />
			</div>
		</DistortionWave>
	);
}
