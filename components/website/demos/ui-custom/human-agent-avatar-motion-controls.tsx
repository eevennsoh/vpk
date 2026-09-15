"use client";

import { useId, useState } from "react";

import { GUI } from "@/components/utils/gui";
import {
	DEFAULT_HUMAN_AGENT_AVATAR_MOTION,
	type HumanAgentAvatarMotionOptions,
} from "@/components/ui-custom/human-agent-avatar-motion-config";

type NumericKey =
	| "durationMs"
	| "initialDelayMs"
	| "betweenTurnsMs"
	| "repeatDelayMs"
	| "curvature"
	| "scaleAmount"
	| "foregroundSwapAt";
interface NumberControl {
	key: NumericKey;
	label: string;
	min: number;
	max: number;
	step: number;
	unit?: string;
	factor?: number;
}

const TIMING_CONTROLS: readonly NumberControl[] = [
	{
		key: "durationMs",
		label: "Turn duration",
		min: 50,
		max: 2_000,
		step: 10,
		unit: "ms",
	},
	{
		key: "initialDelayMs",
		label: "Initial delay",
		min: 0,
		max: 5_000,
		step: 50,
		unit: "ms",
	},
	{
		key: "betweenTurnsMs",
		label: "Pause between turns",
		min: 0,
		max: 5_000,
		step: 10,
		unit: "ms",
	},
	{
		key: "repeatDelayMs",
		label: "Pause after returning",
		min: 0,
		max: 5_000,
		step: 50,
		unit: "ms",
	},
];
const ORBIT_CONTROLS: readonly NumberControl[] = [
	{ key: "curvature", label: "Orbit curvature", min: 2, max: 8, step: 0.25 },
	{
		key: "scaleAmount",
		label: "Size swap",
		min: 0,
		max: 100,
		step: 5,
		factor: 100,
		unit: "%",
	},
	{
		key: "foregroundSwapAt",
		label: "Foreground swap point",
		min: 0,
		max: 100,
		step: 5,
		factor: 100,
		unit: "%",
	},
];
const EASING_PRESETS = [
	{ value: "in-out", label: "Ease in out", curve: [0.4, 0, 0, 1] },
	{
		value: "out-practical",
		label: "Ease out practical",
		curve: [0.4, 1, 0.6, 1],
	},
	{ value: "out", label: "Ease out", curve: [0, 0.4, 0, 1] },
	{ value: "in", label: "Ease in", curve: [0.6, 0, 0.8, 0.6] },
	{ value: "linear", label: "Linear", curve: [0, 0, 1, 1] },
] as const;
type EasingChoice = (typeof EASING_PRESETS)[number]["value"] | "custom";
const BEZIER_LABELS = [
	"Bezier X1",
	"Bezier Y1",
	"Bezier X2",
	"Bezier Y2",
] as const;

export function HumanAgentAvatarMotionControls({
	config,
	onChange,
	onReplay,
}: Readonly<{
	config: HumanAgentAvatarMotionOptions;
	onChange: (patch: Partial<HumanAgentAvatarMotionOptions>) => void;
	onReplay: () => void;
}>) {
	const id = useId();
	const [easingChoice, setEasingChoice] = useState<EasingChoice>("in-out");
	const [lastRepeatCount, setLastRepeatCount] = useState(0);
	const repeatCount =
		typeof config.repeat === "number" ? config.repeat : lastRepeatCount;
	const numbers = (controls: readonly NumberControl[]) =>
		controls.map((control) => (
			<GUI.Control
				id={`${id}-${control.key}`}
				key={control.key}
				label={control.label}
				value={config[control.key] * (control.factor ?? 1)}
				defaultValue={
					DEFAULT_HUMAN_AGENT_AVATAR_MOTION[control.key] * (control.factor ?? 1)
				}
				min={control.min}
				max={control.max}
				step={control.step}
				unit={control.unit}
				onChange={(value) =>
					onChange({ [control.key]: value / (control.factor ?? 1) })
				}
				valueKeys={control.key}
			/>
		));

	return (
		<GUI.Panel
			title="Motion properties"
			values={{ ...config }}
			onPlay={onReplay}
			playLabel="Replay avatar animation"
		>
			<GUI.Section title="Timing" borderTop={false}>
				{numbers(TIMING_CONTROLS)}
			</GUI.Section>
			<GUI.Section title="Easing">
				<GUI.Select
					id={`${id}-easing`}
					label="Easing preset"
					value={easingChoice}
					defaultValue="in-out"
					options={[...EASING_PRESETS, { value: "custom", label: "Custom" }]}
					valueKeys="ease"
					onChange={(choice) => {
						setEasingChoice(choice);
						const preset = EASING_PRESETS.find(
							(option) => option.value === choice,
						);
						if (preset) onChange({ ease: preset.curve });
					}}
				/>
				{easingChoice === "custom"
					? BEZIER_LABELS.map((label, index) => (
							<GUI.Control
								id={`${id}-bezier-${index}`}
								key={label}
								label={label}
								value={config.ease[index]}
								defaultValue={DEFAULT_HUMAN_AGENT_AVATAR_MOTION.ease[index]}
								min={0}
								max={1}
								step={0.01}
								valueKeys="ease"
								onChange={(value) => {
									const ease: [number, number, number, number] = [
										...config.ease,
									];
									ease[index] = value;
									onChange({ ease });
								}}
							/>
						))
					: null}
			</GUI.Section>
			<GUI.Section title="Orbit">
				<GUI.Select
					id={`${id}-direction`}
					label="Rotation direction"
					value={config.direction}
					defaultValue="clockwise"
					options={[
						{ value: "clockwise", label: "Clockwise" },
						{ value: "counter-clockwise", label: "Counter-clockwise" },
					]}
					valueKeys="direction"
					onChange={(direction) => onChange({ direction })}
				/>
				{numbers(ORBIT_CONTROLS)}
			</GUI.Section>
			<GUI.Section title="Playback">
				<GUI.Toggle
					id={`${id}-loop`}
					label="Loop continuously"
					checked={config.repeat === "infinite"}
					valueKeys="repeat"
					onChange={(checked) =>
						onChange({ repeat: checked ? "infinite" : lastRepeatCount })
					}
				/>
				{config.repeat !== "infinite" ? (
					<GUI.Control
						id={`${id}-repeat`}
						label="Repeat count"
						value={repeatCount}
						defaultValue={0}
						min={0}
						max={12}
						step={1}
						valueKeys="repeat"
						onChange={(repeat) => {
							setLastRepeatCount(repeat);
							onChange({ repeat });
						}}
					/>
				) : null}
				<GUI.Toggle
					id={`${id}-offscreen`}
					label="Pause when offscreen"
					checked={config.pauseWhenOffscreen}
					valueKeys="pauseWhenOffscreen"
					onChange={(pauseWhenOffscreen) => onChange({ pauseWhenOffscreen })}
				/>
			</GUI.Section>
		</GUI.Panel>
	);
}
