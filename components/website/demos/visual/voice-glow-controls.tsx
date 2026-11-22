"use client";

import { GUI } from "@/components/utils/gui";
import {
	VOICE_GLOW_CONTROLS, VOICE_GLOW_LOOKS, VOICE_GLOW_PALETTES, VOICE_GLOW_THEMES, VOICE_GLOW_TYPES,
	type VoiceGlowConfig, type VoiceGlowNumbers,
} from "@/components/visual/voice-glow/data";

export function VoiceGlowControls({ config, defaults, update, simulateVoice, onSimulateVoiceChange }: Readonly<{
	config: VoiceGlowConfig;
	defaults: VoiceGlowNumbers;
	update: <K extends keyof VoiceGlowConfig>(key: K, value: VoiceGlowConfig[K]) => void;
	simulateVoice: boolean;
	onSimulateVoiceChange: (enabled: boolean) => void;
}>) {
	const surface = config.look === "dots" || config.look === "lines";

	return (
		<>
			<GUI.Section title="Appearance" borderTop={false}>
				<GUI.Select id="voice-glow-look" label="Look" value={config.look} options={VOICE_GLOW_LOOKS} onChange={(value) => update("look", value)} valueKeys="look" />
				<GUI.Select id="voice-glow-type" label="Shape" value={config.type} options={VOICE_GLOW_TYPES} onChange={(value) => update("type", value)} valueKeys="type" />
				{surface ? (
					<>
						<GUI.Toggle id="voice-glow-use-tint" label="Tint ink" checked={config.tint !== undefined} onChange={(value) => update("tint", value ? "#7e65e8" : undefined)} />
						{config.tint !== undefined ? <GUI.ColorInput id="voice-glow-tint" label="Ink color" value={config.tint} onChange={(value) => update("tint", value)} valueKeys="tint" /> : null}
					</>
				) : (
					<GUI.Select id="voice-glow-palette" label="Palette" value={config.colorVariant} options={VOICE_GLOW_PALETTES.map((value) => ({ value, label: value }))} onChange={(value) => update("colorVariant", value)} valueKeys="colorVariant" />
				)}
				{config.look === "dots" ? <GUI.Select id="voice-glow-dot-shape" label="Dot shape" value={config.dotShape} options={[{ value: "round", label: "Round" }, { value: "square", label: "Square" }]} onChange={(value) => update("dotShape", value)} valueKeys="dotShape" /> : null}
				{config.look === "lines" ? (
					<>
						<GUI.Select id="voice-glow-line-pattern" label="Line pattern" value={config.linePattern} options={[{ value: "rows", label: "Rows" }, { value: "columns", label: "Columns" }, { value: "grid", label: "Grid" }]} onChange={(value) => update("linePattern", value)} valueKeys="linePattern" />
						<GUI.Toggle id="voice-glow-see-through" label="See through ridges" checked={config.seeThrough} onChange={(value) => update("seeThrough", value)} valueKeys="seeThrough" />
					</>
				) : null}
				<GUI.Select id="voice-glow-theme" label="Theme" value={config.theme} options={VOICE_GLOW_THEMES} onChange={(value) => update("theme", value)} valueKeys="theme" />
				<GUI.Toggle id="voice-glow-simulate" label="Simulated voice" checked={simulateVoice} onChange={onSimulateVoiceChange} />
				<GUI.Toggle id="voice-glow-active" label="Active" checked={config.active} onChange={(value) => update("active", value)} valueKeys="active" />
				<GUI.Toggle id="voice-glow-bands" label="Frequency bands" checked={config.bands} onChange={(value) => update("bands", value)} valueKeys="bands" />
				{surface ? null : <GUI.Toggle id="voice-glow-static" label="Static colors" checked={config.staticColors} onChange={(value) => update("staticColors", value)} valueKeys="staticColors" />}
				<GUI.Toggle id="voice-glow-radius-auto" label="Auto radius" checked={config.borderRadius === undefined} onChange={(value) => update("borderRadius", value ? undefined : 16)} />
				{config.borderRadius !== undefined ? <GUI.Control id="voice-glow-radius" label="Border radius" value={config.borderRadius} defaultValue={16} min={0} max={200} step={1} unit="px" onChange={(value) => update("borderRadius", value)} valueKeys="borderRadius" /> : null}
			</GUI.Section>
			{VOICE_GLOW_CONTROLS.filter(({ looks }) => !looks || looks.includes(config.look)).map(({ title, controls }) => (
				<GUI.Section key={title} title={title} defaultOpen={title === "Audio response"}>
					{controls.filter(([key]) => key !== "tintAmount" || config.tint !== undefined).map(([key, label, min, max, step, ...units]) => (
						<GUI.Control key={key} id={`voice-glow-${key}`} label={label} value={config[key] ?? defaults[key]} defaultValue={defaults[key]} min={min} max={max} step={step} unit={units[0]} disabled={key === "level" && simulateVoice} onChange={(value) => update(key, value)} valueKeys={key} />
					))}
				</GUI.Section>
			))}
		</>
	);
}
