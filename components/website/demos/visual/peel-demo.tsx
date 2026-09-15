"use client";

import { useMemo, useState } from "react";

import { GUI } from "@/components/utils/gui";
import {
	PEEL_TUNING_DEFAULTS,
	Peel,
	resolvePeelTuning,
	type PeelFinish,
	type PeelTuning,
} from "@/components/visual/peel";

/**
 * The reference stamp from jaksenc.com/about — `display-05`, "A Nice Bagel".
 *
 * Third-party artwork, kept because the point of this component is to match
 * that page exactly. Swap it for your own before anything ships.
 */
const STAMP_SRC = "/3p/stamps/jaksenc-bagel.webp";
const STAMP_ALT =
	"Engraved postage stamp reading A Nice Bagel. Click to lift it off the page, click again to set it down.";

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
		label: "Peel rock",
		description: "Grabbed corner up, far corner down. 0 makes a lifted sheet just float.",
		min: 0,
		max: 0.5,
		step: 0.005,
	},
	{
		key: "waveAmplitude",
		label: "Wave height",
		description: "Peak flex of the lift and landing ripples.",
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
		description: "The undulation that runs for as long as the sheet is up.",
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
	const [finish, setFinish] = useState<PeelFinish>("foil");
	const [overrides, setOverrides] = useState<Partial<PeelTuning>>({});

	// The panel edits a full tuning object so every slider shows the value the
	// selected finish actually resolves to, not the bare default.
	const tuning = useMemo(() => resolvePeelTuning(finish, overrides), [finish, overrides]);

	const set = (key: keyof PeelTuning) => (next: number) =>
		setOverrides((previous) => ({ ...previous, [key]: next }));

	return (
		<div className="flex w-full flex-col items-center gap-6">
			{/* The reference page is a near-white sheet, not pure white — the
			    stamp's contact shadow needs something to sit on. */}
			<div className="relative flex min-h-[420px] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#f9f9f9] p-10">
				<Peel
					key={finish}
					src={STAMP_SRC}
					alt={STAMP_ALT}
					finish={finish}
					// The reference stamp does not sit square: measured -5.87 deg
					// (counter-clockwise) across three disjoint quiet windows of
					// stamp.mov, which agree to 0.05 deg, and it returns to the
					// same angle after every put-down. The component's own
					// default stays 0 — a generic sheet should not ship one
					// stamp's placement.
					rotation={-5.9}
					tuning={overrides}
				/>
			</div>

			<div className="w-full">
				<GUI.Panel title="Peel" values={{ ...tuning, finish }}>
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
				</GUI.Panel>
			</div>
		</div>
	);
}
