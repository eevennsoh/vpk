"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { GUI } from "@/components/utils/gui";
import {
	DEFAULT_DISTORTION_WAVE_CONFIG,
	DISTORTION_WAVE_LIVE_OPTIONS,
	DISTORTION_WAVE_PALETTE_OPTIONS,
	DISTORTION_WAVE_REDUCED_MOTION_OPTIONS,
	DISTORTION_WAVE_STYLE_GROUPS,
	DISTORTION_WAVE_TYPE_OPTIONS,
	getDistortionWaveStyleDefaults,
	type DistortionWaveControlConfig,
	type DistortionWaveStyleKey,
	type WaveOptions,
	type WaveType,
} from "@/components/visual/distortion-waves";

import {
	DistortionWaveScene,
	DistortionWaveSingleViewScene,
	type DistortionWaveSceneWaveProps,
} from "./distortion-waves-demo-scenes";

type SetConfig = Dispatch<SetStateAction<DistortionWaveControlConfig>>;

const LIVE_VALUES: Readonly<Record<DistortionWaveControlConfig["live"], WaveOptions["live"]>> = {
	on: true,
	animations: "animations",
	off: false,
};

function toWaveProps(config: DistortionWaveControlConfig): DistortionWaveSceneWaveProps {
	const palette = config.palette === "type"
		? undefined
		: config.palette === "custom" ? config.customColor : config.palette;

	return {
		waveStyle: config.style,
		palette,
		scrub: config.scrubEnabled ? config.scrub : null,
		live: LIVE_VALUES[config.live],
		reducedMotion: config.reducedMotion,
	};
}

function setStyleValue(setConfig: SetConfig, key: DistortionWaveStyleKey, value: number) {
	setConfig((current) => ({ ...current, style: { ...current.style, [key]: value } }));
}

function DistortionWaveControls({
	config,
	onPlay,
	setConfig,
}: Readonly<{
	config: DistortionWaveControlConfig;
	onPlay: () => void;
	setConfig: SetConfig;
}>) {
	const typeDefaults = getDistortionWaveStyleDefaults(config.type);

	return (
		<GUI.Panel
			title="Distortion Wave controls"
			values={{ ...config, ...config.style }}
			onPlay={onPlay}
			playLabel="Run wave"
		>
			<GUI.Section title="Wave" borderTop={false}>
				<GUI.Select
					id="distortion-wave-type"
					label="Type"
					value={config.type}
					options={DISTORTION_WAVE_TYPE_OPTIONS}
					onChange={(type: WaveType) => setConfig((current) => ({
						...current,
						type,
						style: getDistortionWaveStyleDefaults(type),
					}))}
					valueKeys="type"
				/>
				<GUI.Select
					id="distortion-wave-palette"
					label="Palette"
					value={config.palette}
					options={DISTORTION_WAVE_PALETTE_OPTIONS}
					onChange={(palette) => setConfig((current) => ({ ...current, palette }))}
					valueKeys="palette"
				/>
				{config.palette === "custom" ? (
					<GUI.ColorInput
						id="distortion-wave-custom-color"
						label="Colour"
						value={config.customColor}
						defaultValue={DEFAULT_DISTORTION_WAVE_CONFIG.customColor}
						format="hex"
						onChange={(customColor) => setConfig((current) => ({ ...current, customColor }))}
						valueKeys="customColor"
					/>
				) : null}
			</GUI.Section>

			<GUI.Section title="Playback">
				<GUI.Toggle
					id="distortion-wave-scrub-enabled"
					label="Hold at progress"
					checked={config.scrubEnabled}
					onChange={(scrubEnabled) => setConfig((current) => ({ ...current, scrubEnabled }))}
					valueKeys="scrubEnabled"
				/>
				<GUI.Control
					id="distortion-wave-scrub"
					label="Progress"
					description="Dragging holds the wave at this point."
					value={config.scrub}
					defaultValue={DEFAULT_DISTORTION_WAVE_CONFIG.scrub}
					min={0}
					max={1}
					step={0.005}
					onChange={(scrub) => setConfig((current) => ({ ...current, scrub, scrubEnabled: true }))}
					valueKeys="scrub"
				/>
				<GUI.Select
					id="distortion-wave-live"
					label="Live picture"
					value={config.live}
					options={DISTORTION_WAVE_LIVE_OPTIONS}
					onChange={(live) => setConfig((current) => ({ ...current, live }))}
					valueKeys="live"
				/>
				<GUI.Select
					id="distortion-wave-reduced-motion"
					label="Reduced motion"
					value={config.reducedMotion}
					options={DISTORTION_WAVE_REDUCED_MOTION_OPTIONS}
					onChange={(reducedMotion) => setConfig((current) => ({ ...current, reducedMotion }))}
					valueKeys="reducedMotion"
				/>
			</GUI.Section>

			{DISTORTION_WAVE_STYLE_GROUPS.map((group) => (
				<GUI.Section key={group.title} title={group.title} defaultOpen={group.title === "Wave"}>
					{group.controls.map((control) => (
						<GUI.Control
							key={control.key}
							id={`distortion-wave-${control.key}`}
							label={control.label}
							value={config.style[control.key]}
							defaultValue={typeDefaults[control.key]}
							min={control.min}
							max={control.max}
							step={control.step}
							unit={control.unit}
							onChange={(value) => setStyleValue(setConfig, control.key, value)}
							valueKeys={control.key}
						/>
					))}
				</GUI.Section>
			))}
		</GUI.Panel>
	);
}

export function DistortionWavesDemoVertical() {
	return <DistortionWaveScene type="vertical" className="h-[420px] max-w-xs" />;
}

export function DistortionWavesDemoHorizontal() {
	return <DistortionWaveScene type="horizontal" className="h-[420px] max-w-xs" />;
}

export function DistortionWavesDemoCenter() {
	return <DistortionWaveScene type="center" className="h-[420px] max-w-xs" />;
}

export function DistortionWavesDemoSunset() {
	return <DistortionWaveScene type="vertical" waveProps={{ palette: "sunset" }} className="h-[420px] max-w-xs" />;
}

export function DistortionWavesDemoSingleView() {
	return <DistortionWaveSingleViewScene />;
}

export default function DistortionWavesDemo() {
	const [config, setConfig] = useState<DistortionWaveControlConfig>(DEFAULT_DISTORTION_WAVE_CONFIG);
	// Keyed by type so switching type always starts on the first view.
	const [revealedType, setRevealedType] = useState<WaveType | null>(null);
	const revealed = revealedType === config.type;
	const waveProps = useMemo(() => toWaveProps(config), [config]);

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
			<div className="flex min-h-[560px] w-full items-center justify-center rounded-3xl border border-border bg-surface-sunken px-6 py-8">
				<DistortionWaveScene
					// Re-key on type so the source element and layout swap cleanly.
					key={config.type}
					type={config.type}
					revealed={revealed}
					onRevealedChange={(next) => setRevealedType(next ? config.type : null)}
					waveProps={waveProps}
				/>
			</div>
			<DistortionWaveControls
				config={config}
				setConfig={setConfig}
				onPlay={() => setRevealedType((current) => (current === config.type ? null : config.type))}
			/>
		</div>
	);
}
