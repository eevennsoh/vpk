"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { LanyardFormat } from "../renderer/types";
import { LANYARD_3D_BACKGROUNDS, LANYARD_3D_FORMATS, type Lanyard3DScene } from "../data";

interface Lanyard3DSceneSectionProps {
	readonly scene: Lanyard3DScene;
	readonly onChange: (patch: Partial<Lanyard3DScene>) => void;
}

function single(value: number | readonly number[]) {
	return typeof value === "number" ? value : (value[0] ?? 0);
}

export function Lanyard3DSceneSection({ scene, onChange }: Readonly<Lanyard3DSceneSectionProps>) {
	const id = useId();

	return (
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3" data-slot="lanyard-3d-scene-section">
			<h3 className="text-sm font-semibold text-text" id={`${id}-heading`}>Scene</h3>
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm text-text" id={`${id}-background`}>Background</span>
				<div aria-labelledby={`${id}-background`} className="flex items-center gap-1.5" role="group">
					{LANYARD_3D_BACKGROUNDS.map((swatch) => (
						<button
							aria-label={swatch.label}
							aria-pressed={scene.background === swatch.value}
							className={cn("size-6 rounded-full border border-border-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50", scene.background === swatch.value ? "ring-2 ring-border-focused ring-offset-2 ring-offset-surface" : null)}
							key={swatch.value}
							onClick={() => onChange({ background: swatch.value })}
							style={{ backgroundColor: swatch.value }}
							type="button"
						/>
					))}
					<input
						aria-label="Custom background color"
						className="size-6 cursor-pointer rounded-full border border-border-bold bg-transparent p-0"
						onChange={(event) => onChange({ background: event.target.value })}
						type="color"
						value={scene.background}
					/>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3">
				<Label htmlFor={`${id}-format`}>Format</Label>
				<NativeSelect id={`${id}-format`} onChange={(event) => onChange({ format: event.target.value as LanyardFormat })} size="sm" value={scene.format}>
					{LANYARD_3D_FORMATS.map((format) => <NativeSelectOption key={format.value} value={format.value}>{format.label}</NativeSelectOption>)}
				</NativeSelect>
			</div>
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm text-text" id={`${id}-swing`}>Swing</span>
				<div className="flex w-44 items-center gap-2">
					<Slider aria-labelledby={`${id}-swing`} max={1.6} min={0} onValueChange={(next) => onChange({ swing: single(next) })} step={0.05} value={scene.swing} />
					<output className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-text-subtle">{Math.round(scene.swing * 100)}%</output>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm text-text" id={`${id}-reveal`}>Initial reveal</span>
				<div className="flex w-44 items-center gap-2">
					<Slider aria-labelledby={`${id}-reveal`} max={45} min={0} onValueChange={(next) => onChange({ revealAngle: single(next) })} step={1} value={scene.revealAngle} />
					<output className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-text-subtle">±{scene.revealAngle}°</output>
				</div>
			</div>
		</section>
	);
}
