"use client";

import { useRef, useState, type MouseEvent } from "react";
import { accentPair, EASINGS, PALETTES, type Direction, type EasingName, type PaletteName } from "glimm";
import Glimm, { GlimmSweep, type GlimmHandle, type GlimmSweepHandle, type GlimmRenderer, type GlimmScopeProps, type SweepOptions } from "@/components/visual/glimm";
import { Button } from "@/components/ui/button";
import { GUI } from "@/components/utils/gui";

const directions: readonly Direction[] = ["ltr", "rtl", "ttb", "btt"];
const renderers: readonly GlimmRenderer[] = ["sweep", "mesh", "namedrop"];
const labels = <T extends string,>(values: readonly T[]) => values.map((value) => ({ value, label: value }));
const palettes = Object.keys(PALETTES).filter((key): key is PaletteName => key in PALETTES);
const easings = Object.keys(EASINGS).filter((key): key is EasingName => key in EASINGS);

type Config = { mode: "scope" | "decorative"; curve: number; span: number; intensity: number; gatherMs: number; renderer: GlimmRenderer; palette: PaletteName | "custom"; colorA: string; colorB: string; direction: Direction; easing: EasingName; sweepMs: number; outroMs: number; midpoint: number; bandTight: number; peakAlpha: number; brightness: number; waveAmount: number; rippleAmount: number; waveSpeed: number; swellAmount: number; feather: number };
const defaults: Config = { mode: "scope", curve: 0.12, span: 1, intensity: 1, gatherMs: 500, renderer: "sweep", palette: "spectrum", colorA: "#ff3d7f", colorB: "#1fc8ff", direction: "ltr", easing: "ease", sweepMs: 1100, outroMs: 220, midpoint: 0.56, bandTight: 14, peakAlpha: 1, brightness: 1, waveAmount: 0, rippleAmount: 1, waveSpeed: 1, swellAmount: 0.55, feather: 24 };
const sliders: readonly { key: Exclude<keyof Config, "mode" | "curve" | "span" | "intensity" | "gatherMs" | "renderer" | "palette" | "colorA" | "colorB" | "direction" | "easing">; label: string; min: number; max: number; step: number; unit?: string }[] = [
	{ key: "sweepMs", label: "Sweep duration", min: 100, max: 4000, step: 50, unit: "ms" },
	{ key: "outroMs", label: "Outro duration", min: 0, max: 1500, step: 10, unit: "ms" },
	{ key: "midpoint", label: "Change point", min: 0, max: 1, step: 0.01 },
	{ key: "bandTight", label: "Band tightness", min: 1, max: 60, step: 1 },
	{ key: "peakAlpha", label: "Peak opacity", min: 0, max: 1.5, step: 0.05 },
	{ key: "brightness", label: "Brightness", min: 0, max: 1.5, step: 0.05 },
	{ key: "waveAmount", label: "Wave", min: 0, max: 2, step: 0.05 },
	{ key: "rippleAmount", label: "Ripple", min: 0, max: 2, step: 0.05 },
	{ key: "waveSpeed", label: "Wave speed", min: 0, max: 3, step: 0.05 },
	{ key: "swellAmount", label: "Swell", min: 0, max: 1, step: 0.05 },
	{ key: "feather", label: "Edge feather", min: 0, max: 100, step: 1, unit: "px" },
];

function SweepCard({ options, renderer, feather = "auto", title = "A little change", description = "A sweep makes the transition feel connected." }: Readonly<{ options?: SweepOptions; renderer?: GlimmRenderer; feather?: number | "auto"; title?: string; description?: string }>) {
	const ref = useRef<GlimmSweepHandle>(null);
	const [changed, setChanged] = useState(false);
	return <GlimmSweep ref={ref} options={options} renderer={renderer} feather={feather} className="flex min-h-64 w-full flex-col items-start justify-between gap-8 rounded-lg border border-border bg-surface-raised p-6">
		<div><p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{changed ? "After" : "Before"}</p><h3 className="mt-2 text-xl font-semibold text-text">{changed ? "Something new" : title}</h3><p className="mt-2 max-w-md text-sm text-text-subtle">{changed ? "The content changed as the band passed." : description}</p></div>
		<Button onClick={() => ref.current?.play(() => setChanged((previous) => !previous))}>Play transition</Button>
	</GlimmSweep>;
}

function ScopeCard({ options }: Readonly<{ options?: Omit<GlimmScopeProps, "children" | "style"> }>) {
	const ref = useRef<GlimmHandle>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	const [changed, setChanged] = useState(false);
	const play = (event: MouseEvent<HTMLButtonElement>) => {
		const button = event.currentTarget.getBoundingClientRect();
		const box = boxRef.current?.getBoundingClientRect();
		if (!box) return;
		ref.current?.play({
			at: [button.left + button.width / 2 - box.left, button.top + button.height / 2 - box.top],
			change: () => setChanged((previous) => !previous),
		});
	};
	return <div ref={boxRef} className="w-full">
		<Glimm ref={ref} {...options} style={{ height: 256, width: "100%" }}>
			<div className="flex h-full flex-col items-start justify-between rounded-lg border border-border bg-surface-raised p-6">
				<div><p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{changed ? "After" : "Before"}</p><h3 className="mt-2 text-xl font-semibold text-text">{changed ? "Something new" : "A little change"}</h3><p className="mt-2 max-w-md text-sm text-text-subtle">A sweep makes the transition feel connected.</p></div>
				<Button onClick={play}>Play transition</Button>
			</div>
		</Glimm>
	</div>;
}

export default function GlimmDemo() {
	const [config, setConfig] = useState<Config>(defaults);
	const set = <K extends keyof Config,>(key: K, value: Config[K]) => setConfig((previous) => ({ ...previous, [key]: value }));
	const palette = config.palette === "custom" ? accentPair(config.colorA, config.colorB) : config.palette;
	return <div className="flex w-full max-w-5xl flex-col gap-4">
		{config.mode === "scope" ? <ScopeCard options={{ palette, direction: config.direction, sweepMs: config.sweepMs, bandTight: config.bandTight, peakAlpha: config.peakAlpha, brightness: config.brightness, swellAmount: config.swellAmount, curve: config.curve, span: config.span, intensity: config.intensity, gatherMs: config.gatherMs }} /> : <SweepCard options={{ ...config, palette }} renderer={config.renderer} feather={config.feather} />}
		<GUI.Panel title="Glimm controls" values={config}>
			<GUI.Section title="Style" borderTop={false}>
				<GUI.Select id="glimm-mode" label="Effect" value={config.mode} options={[{ value: "scope", label: "Content distortion" }, { value: "decorative", label: "Decorative shader" }]} onChange={(value) => set("mode", value)} />
				{config.mode === "decorative" ? <GUI.Select id="glimm-renderer" label="Renderer" value={config.renderer} options={labels(renderers)} onChange={(value) => set("renderer", value)} /> : null}
				<GUI.Select id="glimm-palette" label="Palette" value={config.palette} options={labels<PaletteName | "custom">([...palettes, "custom"])} onChange={(value) => set("palette", value)} />
				{config.palette === "custom" ? <><GUI.ColorInput id="glimm-color-a" label="First accent" value={config.colorA} onChange={(value) => set("colorA", value)} /><GUI.ColorInput id="glimm-color-b" label="Second accent" value={config.colorB} onChange={(value) => set("colorB", value)} /></> : null}
				<GUI.Select id="glimm-direction" label="Direction" value={config.direction} options={labels(directions)} onChange={(value) => set("direction", value)} />
				{config.mode === "decorative" ? <GUI.Select id="glimm-easing" label="Easing" value={config.easing} options={labels(easings)} onChange={(value) => set("easing", value)} /> : null}
			</GUI.Section>
			<GUI.Section title="Timing and appearance">
				{config.mode === "scope" ? <>
					<GUI.Control id="glimm-curve" label="Curve" value={config.curve} min={0} max={1} step={0.01} defaultValue={defaults.curve} onChange={(value) => set("curve", value)} />
					<GUI.Control id="glimm-span" label="Span" value={config.span} min={0.05} max={1} step={0.01} defaultValue={defaults.span} onChange={(value) => set("span", value)} />
					<GUI.Control id="glimm-intensity" label="Content intensity" value={config.intensity} min={0} max={2} step={0.05} defaultValue={defaults.intensity} onChange={(value) => set("intensity", value)} />
					<GUI.Control id="glimm-gather" label="Gather duration" value={config.gatherMs} min={0} max={2000} step={50} unit="ms" defaultValue={defaults.gatherMs} onChange={(value) => set("gatherMs", value)} />
				</> : null}
				{sliders.filter(({ key }) => config.mode === "decorative" || ["sweepMs", "bandTight", "peakAlpha", "brightness", "swellAmount"].includes(key)).map(({ key, label, ...range }) => <GUI.Control key={key} id={`glimm-${key}`} label={label} {...range} value={config[key]} defaultValue={defaults[key]} onChange={(value) => set(key, value)} />)}</GUI.Section>
		</GUI.Panel>
	</div>;
}

export function GlimmPalettesDemo() { return <div className="grid w-full gap-3 md:grid-cols-2">{palettes.map((palette) => <SweepCard key={palette} title={palette} options={{ palette }} />)}</div>; }
export function GlimmDirectionsDemo() { return <div className="grid w-full gap-3 md:grid-cols-2">{directions.map((direction) => <SweepCard key={direction} title={direction.toUpperCase()} options={{ direction, palette: "lagoon" }} />)}</div>; }
export function GlimmRenderersDemo() { return <div className="grid w-full gap-3 md:grid-cols-3">{renderers.map((renderer) => <SweepCard key={renderer} title={renderer} renderer={renderer} options={{ palette: "prism", sweepMs: 1800 }} />)}</div>; }
export function GlimmCustomDemo() { return <SweepCard title="Custom palette" description="An accent pair creates a palette from two colors." options={{ palette: accentPair("#ff3d7f", "#1fc8ff"), waveAmount: 1, rippleAmount: 1.5, sweepMs: 1800 }} />; }

export function GlimmScopeDemo() {
	return <ScopeCard options={{ palette: "berry", direction: "ttb", curve: 0.12 }} />;
}
