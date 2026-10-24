"use client";

import { useMemo, useState } from "react";

import { UIGeneration, UI_GENERATION_DEFAULTS } from "@/components/visual/ui-generation";
import { GUI } from "@/components/utils/gui";

import { PriceCard, ProfileCard } from "./ui-generation-cards";

type Subject = "price" | "profile" | "both";

const SUBJECT_OPTIONS: readonly { value: Subject; label: string }[] = [
	{ value: "price", label: "Price card" },
	{ value: "profile", label: "Profile card" },
	{ value: "both", label: "Both" },
];

/** Stagger between items when several play at once, from the upstream skill. */
const STAGGER_MS = 260;

export default function UIGenerationDemo() {
	const [subject, setSubject] = useState<Subject>("price");
	const [duration, setDuration] = useState<number>(UI_GENERATION_DEFAULTS.duration);
	const [maxParts, setMaxParts] = useState<number>(UI_GENERATION_DEFAULTS.maxParts);
	const [keys, setKeys] = useState<number>(UI_GENERATION_DEFAULTS.keys);
	const [run, setRun] = useState(0);
	// The builds finished for the current playKey; a new key is a new set of builds, so stale entries drop out.
	const [finished, setFinished] = useState<{ readonly playKey: string; readonly count: number }>({ playKey: "", count: 0 });

	const values = useMemo(() => ({ subject, duration, maxParts, keys }), [subject, duration, maxParts, keys]);
	const replay = () => setRun((prev) => prev + 1);
	// Every build that changes its options plays again, so the panel doubles as a scrubber.
	const playKey = `${run}:${subject}:${duration}:${maxParts}:${keys}`;
	const shared = { playKey, duration, maxParts, keys };
	const builds = subject === "both" ? 2 : 1;
	const status = finished.playKey === playKey && finished.count >= builds ? "ready" : "generating";
	const onComplete = () =>
		setFinished((prev) => ({ playKey, count: prev.playKey === playKey ? prev.count + 1 : 1 }));

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
			<div
				data-testid="ui-generation-preview"
				data-status={status}
				className="flex min-h-[560px] flex-wrap items-center justify-center gap-24 rounded-xl border border-border bg-surface px-8 py-20"
			>
				{subject === "both" || subject === "price" ? (
					<UIGeneration {...shared} onComplete={onComplete}>
						<PriceCard />
					</UIGeneration>
				) : null}
				{subject === "both" || subject === "profile" ? (
					<UIGeneration
						{...shared}
						delay={subject === "both" ? STAGGER_MS : 0}
						onComplete={onComplete}
					>
						<ProfileCard />
					</UIGeneration>
				) : null}
			</div>
			<p className="sr-only" aria-live="polite">
				{status === "ready" ? "Generated UI is ready." : "Generating UI."}
			</p>

			<GUI.Panel title="UI Generation controls" values={values} onPlay={replay} playLabel="Generate">
				<GUI.Section title="Subject" borderTop={false}>
					<GUI.SegmentedControl
						id="ui-generation-subject"
						label="Generated UI"
						description="Both plays the two cards staggered, as for a grid of results."
						value={subject}
						options={SUBJECT_OPTIONS}
						onChange={setSubject}
					/>
				</GUI.Section>
				<GUI.Section title="Build">
					<GUI.Control
						id="ui-generation-duration"
						label="Duration"
						description="ms of drawing; every phase scales with it. Below 1600 the parts phase is too short to read."
						value={duration}
						defaultValue={UI_GENERATION_DEFAULTS.duration}
						min={1600}
						max={4800}
						step={100}
						unit="ms"
						onChange={setDuration}
					/>
					<GUI.Control
						id="ui-generation-max-parts"
						label="Max parts"
						description="Most parts traced; the largest are kept. Lower it for busy components."
						value={maxParts}
						defaultValue={UI_GENERATION_DEFAULTS.maxParts}
						min={10}
						max={80}
						step={1}
						onChange={setMaxParts}
					/>
					<GUI.Control
						id="ui-generation-keys"
						label="Key elements"
						description="Boxes that get their own guides, corner handles and size label."
						value={keys}
						defaultValue={UI_GENERATION_DEFAULTS.keys}
						min={0}
						max={10}
						step={1}
						onChange={setKeys}
					/>
				</GUI.Section>
			</GUI.Panel>
		</div>
	);
}
