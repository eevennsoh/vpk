"use client";

import type { Dispatch, SetStateAction } from "react";
import { GUI } from "@/components/utils/gui";
import { voicePalettes, type VoiceBeamColorVariant, type VoiceBeamProps } from "@/components/visual/voice-glow";

type BandColors = NonNullable<VoiceBeamProps["bandColors"]>;
const BAND_COLORS = { core: "#c58bff", above: "#ff7ab6", mid: "#7ec4ff", below: "#2dffab" };

export function VoiceGlowColors({ colors, setColors, bandColors, setBandColors, palette, theme }: Readonly<{
	colors: string[] | undefined;
	setColors: Dispatch<SetStateAction<string[] | undefined>>;
	bandColors: BandColors | undefined;
	setBandColors: Dispatch<SetStateAction<BandColors | undefined>>;
	palette: VoiceBeamColorVariant;
	theme: "dark" | "light";
}>) {
	return (
		<GUI.Section title="Custom colors" defaultOpen={false}>
			<GUI.Toggle id="voice-glow-custom-colors" label="Custom lobe colors" checked={colors !== undefined} onChange={(enabled) => setColors(enabled ? [...voicePalettes[palette][theme]] : undefined)} />
			{colors ? <GUI.ColorList id="voice-glow-colors" label="Lobe colors" value={colors} onChange={setColors} allowAddRemove maxColors={7} valueKeys="colors" /> : null}
			<GUI.Toggle id="voice-glow-custom-band" label="Custom band colors" checked={bandColors !== undefined} onChange={(enabled) => setBandColors(enabled ? { ...BAND_COLORS } : undefined)} />
			{bandColors ? Object.entries(bandColors).map(([key, value]) => <GUI.ColorInput key={key} id={`voice-glow-band-${key}`} label={`Band ${key}`} value={value} onChange={(next) => setBandColors((current) => current ? { ...current, [key]: next } : undefined)} valueKeys="bandColors" />) : null}
		</GUI.Section>
	);
}
