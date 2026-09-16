"use client";

import { lazy, Suspense, useMemo, useState } from "react";

import { GUI } from "@/components/utils/gui";
import { cn } from "@/lib/utils";
import {
	PEEL_TUNING_DEFAULTS,
	Peel,
	resolvePeelTuning,
	type PeelFinish,
	type PeelTuning,
} from "@/components/visual/peel";
const PeelSessionDemo = lazy(() => import("./peel-session-demo").then((module) => ({ default: module.PeelSessionDemo })));

const ILLUSTRATION_SRC = "/ambient/atlassian/pictorial/communication/primary/blue.svg";
const ILLUSTRATION_ALT =
	"Blue illustration of overlapping speech bubbles. Click to lift it off the page, click again to set it down.";

/** Only the parameters worth dialling live; the rest are better left at preset. */
const CONTROLS: readonly {
	key: keyof PeelTuning;
	label: string;
	description: string;
	min: number;
	max: number;
	step: number;
}[] = [
	{
		key: "filmScale",
		label: "Film thickness",
		description: "Interference orders across the light's sweep. Roughly, how many rainbows.",
		min: 0,
		max: 20,
		step: 0.1,
	},
	{
		key: "glossCoverage",
		label: "Gloss coverage",
		description: "0 varnishes only the printed ink; 1 floods the whole sheet.",
		min: 0,
		max: 1,
		step: 0.01,
	},
	{
		key: "sheenGain",
		label: "Sheen",
		description: "Specular intensity of the foil.",
		min: 0,
		max: 1.5,
		step: 0.01,
	},
	{
		key: "grain",
		label: "Grain",
		description: "Anisotropic brush structure in the film. Low reads as oil, high as metal.",
		min: 2,
		max: 80,
		step: 1,
	},
	{
		key: "peelPivot",
		label: "Peel curl",
		description: "How far the paper curls as the fold crosses the sheet. Radians.",
		min: 0,
		max: 0.5,
		step: 0.005,
	},
	{
		key: "waveAmplitude",
		label: "Wave height",
		description: "Optional small ripple accents during lift and landing.",
		min: 0,
		max: 0.25,
		step: 0.002,
	},
	{
		key: "waveLength",
		label: "Wavelength",
		description: "Measured against the long edge, so 1 is one wave across the sheet.",
		min: 0.3,
		max: 3,
		step: 0.05,
	},
	{
		key: "waveSpeed",
		label: "Wave speed",
		description: "How fast a ripple crosses the sheet.",
		min: 0.2,
		max: 5,
		step: 0.05,
	},
	{
		key: "waveShear",
		label: "Paper gather",
		description: "How hard bending pulls the surface in-plane. 0 leaves the outline rigid.",
		min: 0,
		max: 4,
		step: 0.05,
	},
	{
		key: "flutter",
		label: "Billow",
		description: "Optional continuous billow while lifted. 0 lets the paper settle flat.",
		min: 0,
		max: 0.12,
		step: 0.002,
	},
	{
		key: "shadowStrength",
		label: "Shadow",
		description: "Contact shadow opacity with the sheet flat on the page.",
		min: 0,
		max: 0.2,
		step: 0.002,
	},
];

const FINISH_OPTIONS: readonly { value: PeelFinish; label: string }[] = [
	{ value: "foil", label: "Foil" },
	{ value: "oil-slick", label: "Oil slick" },
	{ value: "pearl", label: "Pearl" },
	{ value: "uv-gloss", label: "UV gloss" },
];

export default function PeelDemo() {
	const [object, setObject] = useState("illustration");
	const [finish, setFinish] = useState<PeelFinish>("foil");
	const [overrides, setOverrides] = useState<Partial<PeelTuning>>({});

	// The panel edits a full tuning object so every slider shows the value the
	// selected finish actually resolves to, not the bare default.
	const tuning = useMemo(() => resolvePeelTuning(finish, overrides), [finish, overrides]);

	const set = (key: keyof PeelTuning) => (next: number) =>
		setOverrides((previous) => ({ ...previous, [key]: next }));

	return (
		<div className="flex w-full flex-col items-center gap-6">
			<div className={cn("relative flex min-h-[420px] w-full items-center justify-center rounded-2xl border border-border bg-surface p-6", object === "illustration" ? "overflow-hidden" : null)}>
				{object === "illustration" ? <Peel
					key={finish}
					src={ILLUSTRATION_SRC}
					alt={ILLUSTRATION_ALT}
					width={240}
					height={135}
					finish={finish}
					tuning={overrides}
				/> : null}
				<div data-peel-session-visibility={object === "illustration" ? "hidden" : "visible"} aria-hidden={object === "illustration" ? true : undefined} inert={object === "illustration" ? true : undefined} className={object === "illustration" ? "pointer-events-none absolute inset-6 opacity-0" : "w-full"}>
					<Suspense fallback={null}><PeelSessionDemo active={object === "agent-session"} /></Suspense>
				</div>
			</div>

			<div className="w-full">
				<GUI.Panel title="Peel" values={object === "illustration" ? { ...tuning, finish, object } : { object }}>
					<GUI.SegmentedControl id="peel-object" label="Object" value={object} options={[{ value: "illustration", label: "Illustration" }, { value: "agent-session", label: "Agent session" }]} onChange={setObject} />
					{object === "illustration" ? <>
					<GUI.SegmentedControl
						id="peel-finish"
						label="Finish"
						description="Print coating. Each preset retunes the film, gloss mask and grain."
						value={finish}
						options={FINISH_OPTIONS}
						onChange={(next) => {
							setFinish(next);
							// Overrides were dialled against the old preset, so
							// carrying them over would mask the new one.
							setOverrides({});
						}}
					/>
					{CONTROLS.map((control) => (
						<GUI.Control
							key={control.key}
							id={`peel-${control.key}`}
							label={control.label}
							description={control.description}
							value={tuning[control.key]}
							defaultValue={PEEL_TUNING_DEFAULTS[control.key]}
							min={control.min}
							max={control.max}
							step={control.step}
							onChange={set(control.key)}
						/>
					))}
					</> : null}
				</GUI.Panel>
			</div>
		</div>
	);
}
