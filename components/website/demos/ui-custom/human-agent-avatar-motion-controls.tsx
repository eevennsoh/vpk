"use client";

import { useId, useState } from "react";

import { GUI } from "@/components/utils/gui";
import {
	resolveHumanAgentAvatarMotion,
	resolveHumanAgentAvatarTargets,
	type HumanAgentAvatarMotionOptions,
} from "@/components/ui-custom/human-agent-avatar-motion-config";
import { humanAgentAvatarGeometry } from "@/components/ui-custom/human-agent-avatar-geometry";

type NumericKey =
	| "durationMs"
	| "initialDelayMs"
	| "betweenTurnsMs"
	| "repeatDelayMs"
	| "curvature"
	| "scaleAmount";
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
	{ key: "scaleAmount", label: "Size swap", min: 0, max: 100, step: 5, factor: 100, unit: "%" },
];
export function HumanAgentAvatarMotionControls({
	config,
	onChange,
	onReplay,
	sizePx,
}: Readonly<{
	config: HumanAgentAvatarMotionOptions;
	onChange: (patch: Partial<HumanAgentAvatarMotionOptions>) => void;
	onReplay: () => void;
	sizePx: 24 | 32;
}>) {
	const id = useId();
	const defaults = resolveHumanAgentAvatarMotion({ variant: config.variant });
	const geometry = humanAgentAvatarGeometry(sizePx);
	const targets = resolveHumanAgentAvatarTargets(geometry, config);
	const defaultTargets = resolveHumanAgentAvatarTargets(geometry);
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
					defaults[control.key] * (control.factor ?? 1)
				}
				min={control.min}
				max={control.max}
				step={control.step}
				unit={control.unit}
				onChange={(value) =>
					onChange({ [control.key]: value / (control.factor ?? 1) })
				}
				valueKeys={control.key}
				disabled={
					config.variant === "horizontal-group" &&
					ORBIT_CONTROLS.some((item) => item.key === control.key)
				}
			/>
		));

	return (
		<GUI.Panel
			title="Motion properties"
			values={{ ...config, agentTargetSizePx: targets.agentSize, humanTargetSizePx: targets.humanSize }}
			onPlay={onReplay}
			playLabel="Replay avatar animation"
		>
			<GUI.Select
				id={`${id}-variant`}
				label="Animation variation"
				value={config.variant}
				defaultValue="orbit"
				options={[
					{ value: "orbit", label: "Orbit" },
					{ value: "horizontal-group", label: "Horizontal group" },
				]}
				valueKeys="variant"
				onChange={(variant) => onChange({ variant })}
			/>
			<GUI.Section title="Timing" borderTop={false}>
				{numbers(TIMING_CONTROLS)}
			</GUI.Section>
			<GUI.Section title="Easing">
				<GUI.Easing
					id={`${id}-easing`}
					label="Easing curve"
					value={config.ease}
					defaultValue={defaults.ease}
					valueKeys="ease"
					onChange={(ease) => onChange({ ease })}
				/>
			</GUI.Section>
			{config.variant === "orbit" ? (
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
					{(["agent", "human"] as const).map((role) => {
						const key = role === "agent" ? "agentTargetSizePx" : "humanTargetSizePx";
						const sizeKey = role === "agent" ? "agentSize" : "humanSize";
						return (
							<GUI.Control key={key} id={`${id}-${key}`}
								label={role === "agent" ? "Agent target size" : "Human target size"}
								value={targets[sizeKey]} defaultValue={defaultTargets[sizeKey]}
								min={8} max={geometry.frameSize} step={1} unit="px"
								valueKeys={key} onChange={(value) => onChange({ [key]: value })}
							/>
						);
					})}
				</GUI.Section>
			) : null}
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
