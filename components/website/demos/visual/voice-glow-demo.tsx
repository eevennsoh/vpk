"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GUI } from "@/components/utils/gui";
import { useTheme } from "@/components/utils/theme-wrapper";
import VoiceGlow, { type MicrophoneState, type VoiceBeamProps, type VoiceBeamType } from "@/components/visual/voice-glow";
import { resolveVoiceGlowNumbers, VOICE_GLOW_DEFAULTS, type VoiceGlowConfig } from "@/components/visual/voice-glow/data";
import { VoiceGlowControls } from "@/components/website/demos/visual/voice-glow-controls";
import { VoiceGlowColors } from "@/components/website/demos/visual/voice-glow-colors";
import { useVoiceGlowMicrophone } from "@/components/website/demos/visual/use-voice-glow-microphone";
import { useVoiceGlowSimulation } from "@/components/website/demos/visual/use-voice-glow-simulation";
import { cn } from "@/lib/utils";

const SHAPES: Record<VoiceBeamType, string> = {
	default: "h-28 w-full max-w-[350px] rounded-2xl",
	pill: "h-11 w-full max-w-[150px] rounded-full",
	mobile: "h-96 w-full max-w-[280px] rounded-3xl",
};
const WRAPPERS: Record<VoiceBeamType, string> = {
	default: "w-full max-w-[350px]", pill: "w-full max-w-[150px]", mobile: "w-full max-w-[280px]",
};
const MICROPHONE_LABELS: Record<MicrophoneState, string> = {
	idle: "Use microphone", requesting: "Requesting microphone…", live: "Stop microphone",
	denied: "Use microphone", unsupported: "Use microphone", error: "Use microphone",
};

function VoiceGlowSurface({ type, theme }: Readonly<{ type: VoiceBeamType; theme: "dark" | "light" }>) {
	return <div aria-hidden className={cn("border border-border", SHAPES[type])} style={{ background: theme === "dark" ? "#1d1d1d" : "#ffffff" }} />;
}

export default function VoiceGlowDemo() {
	const [config, setConfig] = useState<VoiceGlowConfig>(VOICE_GLOW_DEFAULTS);
	const [colors, setColors] = useState<string[] | undefined>();
	const [bandColors, setBandColors] = useState<VoiceBeamProps["bandColors"]>();
	const [simulateVoice, setSimulateVoice] = useState(true);
	const { actualTheme } = useTheme();
	const theme = config.theme === "auto" ? actualTheme : config.theme;
	const defaults = resolveVoiceGlowNumbers(config, actualTheme);
	const mic = useVoiceGlowMicrophone();
	const microphoneError = mic.state === "denied" || mic.state === "error" ? mic.error : null;
	const simulation = useVoiceGlowSimulation(simulateVoice, config.level ?? 0.5);
	const changeSimulation = (enabled: boolean) => {
		mic.stop();
		simulation.reset();
		setSimulateVoice(enabled);
	};
	const update = <K extends keyof VoiceGlowConfig>(key: K, value: VoiceGlowConfig[K]) => {
		setConfig((current) => ({ ...current, [key]: value }));
	};
	const reset = () => {
		mic.stop();
		setConfig(VOICE_GLOW_DEFAULTS);
		setColors(undefined);
		setBandColors(undefined);
		simulation.reset();
		setSimulateVoice(true);
	};

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6" data-voice-glow-demo>
			<div className="flex min-h-72 items-center justify-center rounded-lg border border-border bg-surface p-8 sm:p-12">
				<VoiceGlow {...config} level={simulation.level} theme={theme} stream={mic.stream} colors={colors} bandColors={bandColors} className={WRAPPERS[config.type]}>
					<VoiceGlowSurface type={config.type} theme={theme} />
				</VoiceGlow>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="secondary" onClick={() => update("paused", !config.paused)} aria-pressed={config.paused}>{config.paused ? "Resume glow" : "Pause glow"}</Button>
				<Button variant="secondary" disabled={!mic.supported || mic.state === "requesting"} onClick={mic.state === "live" ? mic.stop : () => { setSimulateVoice(false); void mic.start(); }}>{MICROPHONE_LABELS[mic.state]}</Button>
				<Button variant="ghost" onClick={reset}>Reset</Button>
			</div>
			<p className="text-sm text-text-subtle" role="status">
				{microphoneError ? microphoneError.message : mic.state === "live" ? "Microphone active. Speak to drive the glow; manual intensity is ignored." : simulateVoice ? "Simulated voice input. The glow rises and settles with speech-like bursts." : "Adjust manual intensity to preview the glow, or enable simulated voice."}
			</p>
			<GUI.Panel title="Voice Glow controls" values={{ ...defaults, ...config, colors, bandColors }}>
				<VoiceGlowControls config={config} defaults={defaults} update={update} simulateVoice={simulateVoice} onSimulateVoiceChange={changeSimulation} />
				<VoiceGlowColors colors={colors} setColors={setColors} bandColors={bandColors} setBandColors={setBandColors} palette={config.colorVariant} theme={theme} />
			</GUI.Panel>
		</div>
	);
}

function VoiceGlowExample({ type, processing = false }: Readonly<{ type: VoiceBeamType; processing?: boolean }>) {
	const { actualTheme } = useTheme();
	const [paused, setPaused] = useState(false);
	const simulation = useVoiceGlowSimulation(!processing);
	return (
		<div className="flex w-full flex-col items-center gap-8 bg-surface p-8">
			<VoiceGlow type={type} processing={processing} paused={paused} theme={actualTheme} level={simulation.level} className={WRAPPERS[type]}>
				<VoiceGlowSurface type={type} theme={actualTheme} />
			</VoiceGlow>
			<Button variant="secondary" onClick={() => setPaused((current) => !current)} aria-pressed={paused}>{paused ? "Resume example" : "Pause example"}</Button>
		</div>
	);
}

export function VoiceGlowPillExample() { return <VoiceGlowExample type="pill" />; }
export function VoiceGlowMobileExample() { return <VoiceGlowExample type="mobile" />; }
export function VoiceGlowProcessingExample() { return <VoiceGlowExample type="default" processing />; }
