"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import { token } from "@/lib/tokens";
import { ROVO_COLOR_SWATCHES } from "@/lib/rovo-colors";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

function rgbToHex(rgb: string): string {
	const match = rgb.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)/);
	if (!match) return rgb;
	const [, r, g, b, a] = match;
	let hex = `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
	if (a !== undefined && Number(a) < 1) {
		hex += Math.round(Number(a) * 255).toString(16).padStart(2, "0");
	}
	return hex;
}

interface SwatchProps {
	label: string;
	className: string;
	type: "bg" | "text" | "border";
}

function Swatch({ label, className, type }: Readonly<SwatchProps>) {
	const colorRef = useRef<HTMLDivElement & HTMLSpanElement>(null);
	const [hex, setHex] = useState("");
	const [copied, setCopied] = useState(false);
	const [open, setOpen] = useState(false);
	const lockedRef = useRef(false);

	const resolveColor = useCallback(() => {
		const el = colorRef.current;
		if (!el) return;
		const style = getComputedStyle(el);
		const raw =
			type === "text"
				? style.color
				: type === "border"
					? style.borderTopColor
					: style.backgroundColor;
		setHex(rgbToHex(raw));
	}, [type]);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		if (lockedRef.current && !nextOpen) return;
		setOpen(nextOpen);
	}, []);

	const handlePointerDown = useCallback(() => {
		if (!hex) return;
		navigator.clipboard.writeText(hex);
		lockedRef.current = true;
		setCopied(true);
		setOpen(true);
		setTimeout(() => {
			lockedRef.current = false;
			setCopied(false);
			setOpen(false);
		}, 1500);
	}, [hex]);

	return (
		<Tooltip open={open} onOpenChange={handleOpenChange}>
			<TooltipTrigger
				render={<div />}
				className="flex flex-col items-center cursor-pointer"
				style={{ gap: token("space.100") }}
				onMouseEnter={resolveColor}
				onPointerDown={handlePointerDown}
			>
				{type === "bg" ? <div
						ref={colorRef}
						className={`w-12 h-12 rounded-lg border border-border ${className}`}
					/> : null}
				{type === "text" ? <div className="w-12 h-12 rounded-lg border border-border bg-surface flex items-center justify-center">
						<span ref={colorRef} className={`text-lg font-bold ${className}`}>Aa</span>
					</div> : null}
				{type === "border" ? <div
						ref={colorRef}
						className={`w-12 h-12 rounded-lg border-2 bg-surface ${className}`}
					/> : null}
				<code className="text-text-subtlest text-[10px] font-mono text-center leading-tight max-w-16 break-all">
					{label}
				</code>
			</TooltipTrigger>
			<TooltipContent>
				{copied ? "Copied!" : hex || label}
			</TooltipContent>
		</Tooltip>
	);
}

interface SectionProps {
	title: string;
	children: ReactNode;
}

function Section({ title, children }: Readonly<SectionProps>) {
	return (
		<section className="flex flex-col" style={{ gap: token("space.200") }}>
			<h3 className="text-text-subtle text-xs font-semibold uppercase tracking-wider">
				{title}
			</h3>
			<div className="flex flex-wrap" style={{ gap: token("space.200") }}>
				{children}
			</div>
		</section>
	);
}

const SCALE_STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
interface ScaleRowProps {
	title: string;
	swatches: string[];
}

function ScaleBlock({ bgClass, step }: Readonly<{ bgClass: string; step: string }>) {
	const ref = useRef<HTMLDivElement>(null);
	const [hex, setHex] = useState("");
	const [copied, setCopied] = useState(false);
	const [open, setOpen] = useState(false);
	const lockedRef = useRef(false);

	const resolveColor = useCallback(() => {
		if (!ref.current) return;
		setHex(rgbToHex(getComputedStyle(ref.current).backgroundColor));
	}, []);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		if (lockedRef.current && !nextOpen) return;
		setOpen(nextOpen);
	}, []);

	const handlePointerDown = useCallback(() => {
		if (!hex) return;
		navigator.clipboard.writeText(hex);
		lockedRef.current = true;
		setCopied(true);
		setOpen(true);
		setTimeout(() => {
			lockedRef.current = false;
			setCopied(false);
			setOpen(false);
		}, 1500);
	}, [hex]);

	return (
		<Tooltip open={open} onOpenChange={handleOpenChange}>
			<TooltipTrigger
				render={<div />}
				className="flex flex-col items-center cursor-pointer"
				style={{ gap: token("space.050") }}
				onMouseEnter={resolveColor}
				onPointerDown={handlePointerDown}
			>
				<div ref={ref} className={`w-10 h-10 rounded-md border border-border ${bgClass}`} />
				<code className="text-text-subtlest text-[10px] font-mono">
					{step}
				</code>
			</TooltipTrigger>
			<TooltipContent>
				{copied ? "Copied!" : hex || bgClass}
			</TooltipContent>
		</Tooltip>
	);
}

function ScaleRow({ title, swatches }: Readonly<ScaleRowProps>) {
	return (
		<div className="flex flex-col" style={{ gap: token("space.100") }}>
			<span className="text-text text-xs font-medium">{title}</span>
			<div className="flex flex-wrap" style={{ gap: token("space.100") }}>
				{swatches.map((bgClass, i) => (
					<ScaleBlock key={bgClass} bgClass={bgClass} step={SCALE_STEPS[i]} />
				))}
			</div>
		</div>
	);
}

export default function ColorDemo() {
	return (
		<TooltipProvider>
		<div className="flex flex-col w-full" style={{ gap: token("space.500") }}>
			{/* ── Semantic Colors (tailwind-theme.css + shadcn-theme.css) ── */}
			<div className="flex flex-col" style={{ gap: token("space.400") }}>
				<h2 className="text-text text-sm font-semibold" style={{ borderBottom: `1px solid ${token("color.border")}`, paddingBottom: token("space.100") }}>
					Semantic Colors
				</h2>

				<Section title="Primitives">
					<Swatch label="background" className="bg-background" type="bg" />
					<Swatch label="foreground" className="text-foreground" type="text" />
					<Swatch label="card" className="bg-card" type="bg" />
					<Swatch label="card-foreground" className="text-card-foreground" type="text" />
					<Swatch label="popover" className="bg-popover" type="bg" />
					<Swatch label="popover-foreground" className="text-popover-foreground" type="text" />
					<Swatch label="primary" className="bg-primary" type="bg" />
					<Swatch label="primary-foreground" className="text-primary-foreground" type="text" />
					<Swatch label="secondary" className="bg-secondary" type="bg" />
					<Swatch label="secondary-foreground" className="text-secondary-foreground" type="text" />
					<Swatch label="muted" className="bg-muted" type="bg" />
					<Swatch label="muted-foreground" className="text-muted-foreground" type="text" />
					<Swatch label="accent" className="bg-accent" type="bg" />
					<Swatch label="accent-foreground" className="text-accent-foreground" type="text" />
					<Swatch label="destructive" className="bg-destructive" type="bg" />
					<Swatch label="destructive-foreground" className="text-destructive-foreground" type="text" />
				</Section>

				<Section title="Status">
					<Swatch label="success" className="bg-success" type="bg" />
					<Swatch label="success-foreground" className="text-success-foreground" type="text" />
					<Swatch label="warning" className="bg-warning" type="bg" />
					<Swatch label="warning-foreground" className="text-warning-foreground" type="text" />
					<Swatch label="info" className="bg-info" type="bg" />
					<Swatch label="info-foreground" className="text-info-foreground" type="text" />
					<Swatch label="discovery" className="bg-discovery" type="bg" />
					<Swatch label="discovery-foreground" className="text-discovery-foreground" type="text" />
				</Section>

				<Section title="Text">
					<Swatch label="text" className="text-text" type="text" />
					<Swatch label="text-subtle" className="text-text-subtle" type="text" />
					<Swatch label="text-subtlest" className="text-text-subtlest" type="text" />
					<Swatch label="text-disabled" className="text-text-disabled" type="text" />
					<Swatch label="text-inverse" className="text-text-inverse" type="text" />
					<Swatch label="text-brand" className="text-text-brand" type="text" />
					<Swatch label="text-selected" className="text-text-selected" type="text" />
					<Swatch label="text-danger" className="text-text-danger" type="text" />
					<Swatch label="text-danger-bolder" className="text-text-danger-bolder" type="text" />
					<Swatch label="text-warning" className="text-text-warning" type="text" />
					<Swatch label="text-warning-bolder" className="text-text-warning-bolder" type="text" />
					<Swatch label="text-success" className="text-text-success" type="text" />
					<Swatch label="text-success-bolder" className="text-text-success-bolder" type="text" />
					<Swatch label="text-discovery" className="text-text-discovery" type="text" />
					<Swatch label="text-discovery-bolder" className="text-text-discovery-bolder" type="text" />
					<Swatch label="text-information" className="text-text-information" type="text" />
					<Swatch label="text-information-bolder" className="text-text-information-bolder" type="text" />
				</Section>

				<Section title="Icon">
					<Swatch label="icon" className="text-icon" type="text" />
					<Swatch label="icon-subtle" className="text-icon-subtle" type="text" />
					<Swatch label="icon-subtlest" className="text-icon-subtlest" type="text" />
					<Swatch label="icon-disabled" className="text-icon-disabled" type="text" />
					<Swatch label="icon-inverse" className="text-icon-inverse" type="text" />
					<Swatch label="icon-selected" className="text-icon-selected" type="text" />
					<Swatch label="icon-brand" className="text-icon-brand" type="text" />
					<Swatch label="icon-danger" className="text-icon-danger" type="text" />
					<Swatch label="icon-warning" className="text-icon-warning" type="text" />
					<Swatch label="icon-success" className="text-icon-success" type="text" />
					<Swatch label="icon-discovery" className="text-icon-discovery" type="text" />
					<Swatch label="icon-information" className="text-icon-information" type="text" />
				</Section>

				<Section title="Link">
					<Swatch label="link" className="text-link" type="text" />
					<Swatch label="link-pressed" className="text-link-pressed" type="text" />
					<Swatch label="link-visited" className="text-link-visited" type="text" />
				</Section>

				<Section title="Border">
					<Swatch label="border" className="border-border" type="border" />
					<Swatch label="border-bold" className="border-border-bold" type="border" />
					<Swatch label="border-disabled" className="border-border-disabled" type="border" />
					<Swatch label="border-inverse" className="border-border-inverse" type="border" />
					<Swatch label="border-selected" className="border-border-selected" type="border" />
					<Swatch label="border-brand" className="border-border-brand" type="border" />
					<Swatch label="border-danger" className="border-border-danger" type="border" />
					<Swatch label="border-warning" className="border-border-warning" type="border" />
					<Swatch label="border-success" className="border-border-success" type="border" />
					<Swatch label="border-discovery" className="border-border-discovery" type="border" />
					<Swatch label="border-information" className="border-border-information" type="border" />
				</Section>

				<Section title="Border — Subtle">
					<Swatch label="border-danger-subtle" className="border-border-danger-subtle" type="border" />
					<Swatch label="border-warning-subtle" className="border-border-warning-subtle" type="border" />
					<Swatch label="border-success-subtle" className="border-border-success-subtle" type="border" />
					<Swatch label="border-discovery-subtle" className="border-border-discovery-subtle" type="border" />
					<Swatch label="border-information-subtle" className="border-border-information-subtle" type="border" />
				</Section>

				<Section title="Border — Accent Subtle">
					<Swatch label="border-accent-red-subtle" className="border-border-accent-red-subtle" type="border" />
					<Swatch label="border-accent-orange-subtle" className="border-border-accent-orange-subtle" type="border" />
					<Swatch label="border-accent-yellow-subtle" className="border-border-accent-yellow-subtle" type="border" />
					<Swatch label="border-accent-lime-subtle" className="border-border-accent-lime-subtle" type="border" />
					<Swatch label="border-accent-green-subtle" className="border-border-accent-green-subtle" type="border" />
					<Swatch label="border-accent-teal-subtle" className="border-border-accent-teal-subtle" type="border" />
					<Swatch label="border-accent-blue-subtle" className="border-border-accent-blue-subtle" type="border" />
					<Swatch label="border-accent-purple-subtle" className="border-border-accent-purple-subtle" type="border" />
					<Swatch label="border-accent-magenta-subtle" className="border-border-accent-magenta-subtle" type="border" />
					<Swatch label="border-accent-gray-subtle" className="border-border-accent-gray-subtle" type="border" />
				</Section>

				<Section title="Surface">
					<Swatch label="surface" className="bg-surface" type="bg" />
					<Swatch label="surface-hovered" className="bg-surface-hovered" type="bg" />
					<Swatch label="surface-pressed" className="bg-surface-pressed" type="bg" />
					<Swatch label="surface-raised" className="bg-surface-raised" type="bg" />
					<Swatch label="surface-raised-hovered" className="bg-surface-raised-hovered" type="bg" />
					<Swatch label="surface-raised-pressed" className="bg-surface-raised-pressed" type="bg" />
					<Swatch label="surface-overlay" className="bg-surface-overlay" type="bg" />
					<Swatch label="surface-overlay-hovered" className="bg-surface-overlay-hovered" type="bg" />
					<Swatch label="surface-overlay-pressed" className="bg-surface-overlay-pressed" type="bg" />
					<Swatch label="surface-sunken" className="bg-surface-sunken" type="bg" />
				</Section>

				<Section title="Background — Status">
					<Swatch label="bg-danger" className="bg-bg-danger" type="bg" />
					<Swatch label="bg-danger-hovered" className="bg-bg-danger-hovered" type="bg" />
					<Swatch label="bg-danger-pressed" className="bg-bg-danger-pressed" type="bg" />
					<Swatch label="bg-warning" className="bg-bg-warning" type="bg" />
					<Swatch label="bg-warning-hovered" className="bg-bg-warning-hovered" type="bg" />
					<Swatch label="bg-warning-pressed" className="bg-bg-warning-pressed" type="bg" />
					<Swatch label="bg-success" className="bg-bg-success" type="bg" />
					<Swatch label="bg-success-hovered" className="bg-bg-success-hovered" type="bg" />
					<Swatch label="bg-success-pressed" className="bg-bg-success-pressed" type="bg" />
					<Swatch label="bg-discovery" className="bg-bg-discovery" type="bg" />
					<Swatch label="bg-discovery-hovered" className="bg-bg-discovery-hovered" type="bg" />
					<Swatch label="bg-discovery-pressed" className="bg-bg-discovery-pressed" type="bg" />
					<Swatch label="bg-information" className="bg-bg-information" type="bg" />
					<Swatch label="bg-information-hovered" className="bg-bg-information-hovered" type="bg" />
					<Swatch label="bg-information-pressed" className="bg-bg-information-pressed" type="bg" />
				</Section>

				<Section title="Background — Status Subtle">
					<Swatch label="bg-danger-subtle" className="bg-bg-danger-subtle" type="bg" />
					<Swatch label="bg-warning-subtle" className="bg-bg-warning-subtle" type="bg" />
					<Swatch label="bg-success-subtle" className="bg-bg-success-subtle" type="bg" />
					<Swatch label="bg-discovery-subtle" className="bg-bg-discovery-subtle" type="bg" />
					<Swatch label="bg-information-subtle" className="bg-bg-information-subtle" type="bg" />
				</Section>

				<Section title="Background — Accent Subtle">
					<Swatch label="bg-accent-red-subtle" className="bg-bg-accent-red-subtle" type="bg" />
					<Swatch label="bg-accent-orange-subtle" className="bg-bg-accent-orange-subtle" type="bg" />
					<Swatch label="bg-accent-yellow-subtle" className="bg-bg-accent-yellow-subtle" type="bg" />
					<Swatch label="bg-accent-lime-subtle" className="bg-bg-accent-lime-subtle" type="bg" />
					<Swatch label="bg-accent-green-subtle" className="bg-bg-accent-green-subtle" type="bg" />
					<Swatch label="bg-accent-teal-subtle" className="bg-bg-accent-teal-subtle" type="bg" />
					<Swatch label="bg-accent-blue-subtle" className="bg-bg-accent-blue-subtle" type="bg" />
					<Swatch label="bg-accent-purple-subtle" className="bg-bg-accent-purple-subtle" type="bg" />
					<Swatch label="bg-accent-magenta-subtle" className="bg-bg-accent-magenta-subtle" type="bg" />
					<Swatch label="bg-accent-gray-subtle" className="bg-bg-accent-gray-subtle" type="bg" />
				</Section>

				<Section title="Background — Status Subtler">
					<Swatch label="bg-danger-subtler" className="bg-bg-danger-subtler" type="bg" />
					<Swatch label="bg-danger-subtler-hovered" className="bg-bg-danger-subtler-hovered" type="bg" />
					<Swatch label="bg-danger-subtler-pressed" className="bg-bg-danger-subtler-pressed" type="bg" />
					<Swatch label="bg-warning-subtler" className="bg-bg-warning-subtler" type="bg" />
					<Swatch label="bg-warning-subtler-hovered" className="bg-bg-warning-subtler-hovered" type="bg" />
					<Swatch label="bg-warning-subtler-pressed" className="bg-bg-warning-subtler-pressed" type="bg" />
					<Swatch label="bg-success-subtler" className="bg-bg-success-subtler" type="bg" />
					<Swatch label="bg-success-subtler-hovered" className="bg-bg-success-subtler-hovered" type="bg" />
					<Swatch label="bg-success-subtler-pressed" className="bg-bg-success-subtler-pressed" type="bg" />
					<Swatch label="bg-discovery-subtler" className="bg-bg-discovery-subtler" type="bg" />
					<Swatch label="bg-discovery-subtler-hovered" className="bg-bg-discovery-subtler-hovered" type="bg" />
					<Swatch label="bg-discovery-subtler-pressed" className="bg-bg-discovery-subtler-pressed" type="bg" />
					<Swatch label="bg-information-subtler" className="bg-bg-information-subtler" type="bg" />
					<Swatch label="bg-information-subtler-hovered" className="bg-bg-information-subtler-hovered" type="bg" />
					<Swatch label="bg-information-subtler-pressed" className="bg-bg-information-subtler-pressed" type="bg" />
				</Section>

				<Section title="Background — Accent Subtler">
					<Swatch label="bg-accent-red-subtler" className="bg-bg-accent-red-subtler" type="bg" />
					<Swatch label="bg-accent-orange-subtler" className="bg-bg-accent-orange-subtler" type="bg" />
					<Swatch label="bg-accent-yellow-subtler" className="bg-bg-accent-yellow-subtler" type="bg" />
					<Swatch label="bg-accent-lime-subtler" className="bg-bg-accent-lime-subtler" type="bg" />
					<Swatch label="bg-accent-green-subtler" className="bg-bg-accent-green-subtler" type="bg" />
					<Swatch label="bg-accent-teal-subtler" className="bg-bg-accent-teal-subtler" type="bg" />
					<Swatch label="bg-accent-blue-subtler" className="bg-bg-accent-blue-subtler" type="bg" />
					<Swatch label="bg-accent-purple-subtler" className="bg-bg-accent-purple-subtler" type="bg" />
					<Swatch label="bg-accent-magenta-subtler" className="bg-bg-accent-magenta-subtler" type="bg" />
					<Swatch label="bg-accent-gray-subtler" className="bg-bg-accent-gray-subtler" type="bg" />
				</Section>

				<Section title="Background — Neutral">
					<Swatch label="bg-neutral" className="bg-bg-neutral" type="bg" />
					<Swatch label="bg-neutral-hovered" className="bg-bg-neutral-hovered" type="bg" />
					<Swatch label="bg-neutral-pressed" className="bg-bg-neutral-pressed" type="bg" />
					<Swatch label="bg-neutral-subtle" className="bg-bg-neutral-subtle" type="bg" />
					<Swatch label="bg-neutral-subtle-hovered" className="bg-bg-neutral-subtle-hovered" type="bg" />
					<Swatch label="bg-neutral-subtle-pressed" className="bg-bg-neutral-subtle-pressed" type="bg" />
					<Swatch label="bg-neutral-bold" className="bg-bg-neutral-bold" type="bg" />
					<Swatch label="bg-neutral-bold-hovered" className="bg-bg-neutral-bold-hovered" type="bg" />
					<Swatch label="bg-neutral-bold-pressed" className="bg-bg-neutral-bold-pressed" type="bg" />
				</Section>

				<Section title="Background — Selected & Brand">
					<Swatch label="bg-selected" className="bg-bg-selected" type="bg" />
					<Swatch label="bg-selected-hovered" className="bg-bg-selected-hovered" type="bg" />
					<Swatch label="bg-selected-pressed" className="bg-bg-selected-pressed" type="bg" />
					<Swatch label="bg-selected-bold" className="bg-bg-selected-bold" type="bg" />
					<Swatch label="bg-selected-bold-hovered" className="bg-bg-selected-bold-hovered" type="bg" />
					<Swatch label="bg-selected-bold-pressed" className="bg-bg-selected-bold-pressed" type="bg" />
					<Swatch label="bg-brand-subtlest" className="bg-bg-brand-subtlest" type="bg" />
					<Swatch label="bg-brand-subtlest-hovered" className="bg-bg-brand-subtlest-hovered" type="bg" />
					<Swatch label="bg-brand-subtlest-pressed" className="bg-bg-brand-subtlest-pressed" type="bg" />
					<Swatch label="bg-brand-boldest" className="bg-bg-brand-boldest" type="bg" />
					<Swatch label="bg-brand-boldest-hovered" className="bg-bg-brand-boldest-hovered" type="bg" />
					<Swatch label="bg-brand-boldest-pressed" className="bg-bg-brand-boldest-pressed" type="bg" />
				</Section>

				<Section title="Background — Utility">
					<Swatch label="bg-disabled" className="bg-bg-disabled" type="bg" />
					<Swatch label="bg-input" className="bg-bg-input" type="bg" />
					<Swatch label="bg-input-hovered" className="bg-bg-input-hovered" type="bg" />
					<Swatch label="bg-input-pressed" className="bg-bg-input-pressed" type="bg" />
					<Swatch label="bg-inverse-subtle" className="bg-bg-inverse-subtle" type="bg" />
				</Section>

				<Section title="Interactive States">
					<Swatch label="primary-hovered" className="bg-primary-hovered" type="bg" />
					<Swatch label="primary-pressed" className="bg-primary-pressed" type="bg" />
					<Swatch label="destructive-hovered" className="bg-destructive-hovered" type="bg" />
					<Swatch label="destructive-pressed" className="bg-destructive-pressed" type="bg" />
					<Swatch label="success-hovered" className="bg-success-hovered" type="bg" />
					<Swatch label="success-pressed" className="bg-success-pressed" type="bg" />
					<Swatch label="warning-hovered" className="bg-warning-hovered" type="bg" />
					<Swatch label="warning-pressed" className="bg-warning-pressed" type="bg" />
					<Swatch label="info-hovered" className="bg-info-hovered" type="bg" />
					<Swatch label="info-pressed" className="bg-info-pressed" type="bg" />
					<Swatch label="discovery-hovered" className="bg-discovery-hovered" type="bg" />
					<Swatch label="discovery-pressed" className="bg-discovery-pressed" type="bg" />
				</Section>

				<Section title="Chart">
					<Swatch label="chart-1" className="bg-chart-1" type="bg" />
					<Swatch label="chart-2" className="bg-chart-2" type="bg" />
					<Swatch label="chart-3" className="bg-chart-3" type="bg" />
					<Swatch label="chart-4" className="bg-chart-4" type="bg" />
					<Swatch label="chart-5" className="bg-chart-5" type="bg" />
					<Swatch label="chart-6" className="bg-chart-6" type="bg" />
					<Swatch label="chart-7" className="bg-chart-7" type="bg" />
					<Swatch label="chart-8" className="bg-chart-8" type="bg" />
				</Section>

				<Section title="Sidebar">
					<Swatch label="sidebar" className="bg-sidebar" type="bg" />
					<Swatch label="sidebar-foreground" className="text-sidebar-foreground" type="text" />
					<Swatch label="sidebar-primary" className="bg-sidebar-primary" type="bg" />
					<Swatch label="sidebar-primary-foreground" className="text-sidebar-primary-foreground" type="text" />
					<Swatch label="sidebar-accent" className="bg-sidebar-accent" type="bg" />
					<Swatch label="sidebar-accent-foreground" className="text-sidebar-accent-foreground" type="text" />
					<Swatch label="sidebar-border" className="border-sidebar-border" type="border" />
				</Section>

				<Section title="Blanket & Overlay">
					<Swatch label="blanket" className="bg-blanket" type="bg" />
					<Swatch label="blanket-selected" className="bg-blanket-selected" type="bg" />
					<Swatch label="blanket-danger" className="bg-blanket-danger" type="bg" />
					<Swatch label="interaction-hovered" className="bg-interaction-hovered" type="bg" />
					<Swatch label="interaction-pressed" className="bg-interaction-pressed" type="bg" />
					<Swatch label="skeleton" className="bg-skeleton" type="bg" />
					<Swatch label="skeleton-subtle" className="bg-skeleton-subtle" type="bg" />
				</Section>
			</div>

			{/* ── Accent Color Scales (tailwind-theme.css) ── */}
			<div className="flex flex-col" style={{ gap: token("space.400") }}>
				<h2 className="text-text text-sm font-semibold" style={{ borderBottom: `1px solid ${token("color.border")}`, paddingBottom: token("space.100") }}>
					Accent Color Scales
				</h2>

				<Section title="Rovo">
					{ROVO_COLOR_SWATCHES.map((swatch) => (
						<Swatch key={swatch.label} label={swatch.label} className={swatch.className} type="bg" />
					))}
				</Section>

				<ScaleRow title="Blue" swatches={[
					"bg-blue-50", "bg-blue-100", "bg-blue-200", "bg-blue-300", "bg-blue-400",
					"bg-blue-500", "bg-blue-600", "bg-blue-700", "bg-blue-800", "bg-blue-900", "bg-blue-950",
				]} />
				<ScaleRow title="Red" swatches={[
					"bg-red-50", "bg-red-100", "bg-red-200", "bg-red-300", "bg-red-400",
					"bg-red-500", "bg-red-600", "bg-red-700", "bg-red-800", "bg-red-900", "bg-red-950",
				]} />
				<ScaleRow title="Green" swatches={[
					"bg-green-50", "bg-green-100", "bg-green-200", "bg-green-300", "bg-green-400",
					"bg-green-500", "bg-green-600", "bg-green-700", "bg-green-800", "bg-green-900", "bg-green-950",
				]} />
				<ScaleRow title="Yellow" swatches={[
					"bg-yellow-50", "bg-yellow-100", "bg-yellow-200", "bg-yellow-300", "bg-yellow-400",
					"bg-yellow-500", "bg-yellow-600", "bg-yellow-700", "bg-yellow-800", "bg-yellow-900", "bg-yellow-950",
				]} />
				<ScaleRow title="Purple" swatches={[
					"bg-purple-50", "bg-purple-100", "bg-purple-200", "bg-purple-300", "bg-purple-400",
					"bg-purple-500", "bg-purple-600", "bg-purple-700", "bg-purple-800", "bg-purple-900", "bg-purple-950",
				]} />
				<ScaleRow title="Teal" swatches={[
					"bg-teal-50", "bg-teal-100", "bg-teal-200", "bg-teal-300", "bg-teal-400",
					"bg-teal-500", "bg-teal-600", "bg-teal-700", "bg-teal-800", "bg-teal-900", "bg-teal-950",
				]} />
				<ScaleRow title="Orange" swatches={[
					"bg-orange-50", "bg-orange-100", "bg-orange-200", "bg-orange-300", "bg-orange-400",
					"bg-orange-500", "bg-orange-600", "bg-orange-700", "bg-orange-800", "bg-orange-900", "bg-orange-950",
				]} />
				<ScaleRow title="Pink (Magenta)" swatches={[
					"bg-pink-50", "bg-pink-100", "bg-pink-200", "bg-pink-300", "bg-pink-400",
					"bg-pink-500", "bg-pink-600", "bg-pink-700", "bg-pink-800", "bg-pink-900", "bg-pink-950",
				]} />
				<ScaleRow title="Lime" swatches={[
					"bg-lime-50", "bg-lime-100", "bg-lime-200", "bg-lime-300", "bg-lime-400",
					"bg-lime-500", "bg-lime-600", "bg-lime-700", "bg-lime-800", "bg-lime-900", "bg-lime-950",
				]} />
				<ScaleRow title="Neutral" swatches={[
					"bg-neutral-50", "bg-neutral-100", "bg-neutral-200", "bg-neutral-300", "bg-neutral-400",
					"bg-neutral-500", "bg-neutral-600", "bg-neutral-700", "bg-neutral-800", "bg-neutral-900", "bg-neutral-950",
				]} />
			</div>

			{/* ── Extended Chart Colors ── */}
			<div className="flex flex-col" style={{ gap: token("space.400") }}>
				<h2 className="text-text text-sm font-semibold" style={{ borderBottom: `1px solid ${token("color.border")}`, paddingBottom: token("space.100") }}>
					Extended Chart Colors
				</h2>

				<Section title="Brand">
					<Swatch label="chart-brand" className="bg-chart-brand" type="bg" />
					<Swatch label="chart-brand-hovered" className="bg-chart-brand-hovered" type="bg" />
				</Section>

				<Section title="Danger">
					<Swatch label="chart-danger" className="bg-chart-danger" type="bg" />
					<Swatch label="chart-danger-hovered" className="bg-chart-danger-hovered" type="bg" />
					<Swatch label="chart-danger-bold" className="bg-chart-danger-bold" type="bg" />
					<Swatch label="chart-danger-bold-hovered" className="bg-chart-danger-bold-hovered" type="bg" />
				</Section>

				<Section title="Warning">
					<Swatch label="chart-warning" className="bg-chart-warning" type="bg" />
					<Swatch label="chart-warning-hovered" className="bg-chart-warning-hovered" type="bg" />
					<Swatch label="chart-warning-bold" className="bg-chart-warning-bold" type="bg" />
					<Swatch label="chart-warning-bold-hovered" className="bg-chart-warning-bold-hovered" type="bg" />
				</Section>

				<Section title="Success">
					<Swatch label="chart-success" className="bg-chart-success" type="bg" />
					<Swatch label="chart-success-hovered" className="bg-chart-success-hovered" type="bg" />
					<Swatch label="chart-success-bold" className="bg-chart-success-bold" type="bg" />
					<Swatch label="chart-success-bold-hovered" className="bg-chart-success-bold-hovered" type="bg" />
				</Section>

				<Section title="Discovery">
					<Swatch label="chart-discovery" className="bg-chart-discovery" type="bg" />
					<Swatch label="chart-discovery-hovered" className="bg-chart-discovery-hovered" type="bg" />
					<Swatch label="chart-discovery-bold" className="bg-chart-discovery-bold" type="bg" />
					<Swatch label="chart-discovery-bold-hovered" className="bg-chart-discovery-bold-hovered" type="bg" />
				</Section>

				<Section title="Information">
					<Swatch label="chart-information" className="bg-chart-information" type="bg" />
					<Swatch label="chart-information-hovered" className="bg-chart-information-hovered" type="bg" />
					<Swatch label="chart-information-bold" className="bg-chart-information-bold" type="bg" />
					<Swatch label="chart-information-bold-hovered" className="bg-chart-information-bold-hovered" type="bg" />
				</Section>

				<Section title="Neutral">
					<Swatch label="chart-neutral" className="bg-chart-neutral" type="bg" />
					<Swatch label="chart-neutral-hovered" className="bg-chart-neutral-hovered" type="bg" />
				</Section>
			</div>
		</div>
		</TooltipProvider>
	);
}
