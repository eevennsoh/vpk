"use client";

import { useReducer, type ReactNode } from "react";
import {
	EasingVisualization,
	SpringVisualization,
	type EasingConfig,
	type SpringConfig,
} from "dialkit";
import {
	GUIControl,
	GUIResetButton,
	GUISelect,
	useGUIValueKeys,
	type GUIControlProps,
} from "@/components/utils/gui-components";
import { clampGUIValue } from "@/components/utils/gui-color";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "@/components/utils/gui-motion.css";

export type GUIEasingValue = Readonly<EasingConfig["ease"]>;
export type GUISpringValue = Readonly<Required<Pick<SpringConfig, "stiffness" | "damping" | "mass">>>;

type GUIMotionCommonProps = Pick<GUIControlProps, "id" | "label" | "description" | "disabled" | "valueKeys">;

export type GUIEasingProps = GUIMotionCommonProps & Readonly<{
	value: GUIEasingValue;
	defaultValue?: GUIEasingValue;
	onChange: (next: EasingConfig["ease"]) => void;
}>;

export type GUISpringProps = GUIMotionCommonProps & Readonly<{
	value: GUISpringValue;
	defaultValue?: GUISpringValue;
	onChange: (next: Required<Pick<SpringConfig, "stiffness" | "damping" | "mass">>) => void;
}>;

const easingPresets = [
	{ value: "linear", label: "Linear", ease: motionEase.linear },
	{ value: "in", label: "Ease in", ease: motionEase.in },
	{ value: "out", label: "Ease out", ease: motionEase.out },
	{ value: "outPractical", label: "Ease out practical", ease: motionEase.outPractical },
	{ value: "inOut", label: "Ease in out", ease: motionEase.inOut },
];

const easingCoordinates = [
	{ index: 0, label: "Bezier X1", min: 0, max: 1 },
	{ index: 1, label: "Bezier Y1", min: -2, max: 2 },
	{ index: 2, label: "Bezier X2", min: 0, max: 1 },
	{ index: 3, label: "Bezier Y2", min: -2, max: 2 },
] as const;

const springParameters = [
	{ key: "stiffness", label: "Stiffness", min: 1, max: 1000, step: 1 },
	{ key: "damping", label: "Damping", min: 0, max: 100, step: 1 },
	{ key: "mass", label: "Mass", min: 0.1, max: 10, step: 0.1 },
] as const;

type GUIMotionEditorProps = GUIMotionCommonProps & Readonly<{
	isDefault: boolean;
	onReset?: () => void;
	children: ReactNode;
}>;

function GUIMotionEditor({
	id,
	label,
	description,
	disabled,
	isDefault,
	onReset,
	children,
}: GUIMotionEditorProps) {
	return (
		<fieldset
			id={id}
			disabled={disabled}
			aria-labelledby={`${id}-label`}
			aria-describedby={description ? `${id}-description` : undefined}
			className="min-w-0 space-y-3"
		>
			<div className="flex items-center justify-between gap-2">
				<span
					id={`${id}-label`}
					className={cn("text-xs font-medium text-text", disabled ? "text-text-disabled" : null)}
				>
					{label}
				</span>
				{onReset ? (
					<GUIResetButton ariaLabel={`Reset ${label}`} disabled={Boolean(disabled) || isDefault} onClick={onReset} />
				) : null}
			</div>
			{description ? (
				<p id={`${id}-description`} className="text-xs leading-4 text-text-subtlest">
					{description}
				</p>
			) : null}
			{children}
		</fieldset>
	);
}

export function GUIEasing({
	value,
	defaultValue,
	onChange,
	valueKeys,
	disabled = false,
	...props
}: GUIEasingProps) {
	useGUIValueKeys(valueKeys);
	const [, refreshVisualization] = useReducer((revision: number) => revision + 1, 0);
	const controlledEase: EasingConfig["ease"] = [...value];
	const selectedPreset = easingPresets.find((preset) => preset.ease.every((coordinate, index) => coordinate === value[index]));
	const options = selectedPreset ? easingPresets : [{ value: "custom", label: "Custom" }, ...easingPresets];
	const emitChange = (next: EasingConfig["ease"]) => {
		if (!disabled) onChange(next);
	};

	return (
		<GUIMotionEditor
			{...props}
			disabled={disabled}
			isDefault={defaultValue !== undefined && defaultValue.every((coordinate, index) => coordinate === value[index])}
			onReset={defaultValue ? () => emitChange([...defaultValue]) : undefined}
		>
			<div inert={disabled}>
				<GUISelect
					key={disabled ? "disabled" : "editable"}
					id={`${props.id}-preset`}
					label={`${props.label} preset`}
					value={selectedPreset?.value ?? "custom"}
					options={options}
					stickyOptionValue="custom"
					onChange={(next) => {
						const preset = easingPresets.find((candidate) => candidate.value === next);
						if (preset) emitChange([...preset.ease]);
					}}
				/>
			</div>
			<div className="vpk-gui-motion-visualization">
				<EasingVisualization
					easing={{ type: "easing", duration: motionDuration.slower, ease: controlledEase }}
					onChange={disabled ? undefined : (next) => {
						emitChange(next);
						refreshVisualization();
					}}
				/>
			</div>
			<div className="space-y-3">
				{easingCoordinates.map(({ index, label, min, max }) => (
					<GUIControl
						key={index}
						id={`${props.id}-${index}`}
						label={label}
						value={value[index]}
						min={min}
						max={max}
						step={0.01}
						disabled={disabled}
						onChange={(coordinate) => {
							const next: EasingConfig["ease"] = [...value];
							next[index] = clampGUIValue(coordinate, min, max);
							emitChange(next);
						}}
					/>
				))}
			</div>
		</GUIMotionEditor>
	);
}

export function GUISpring({
	value,
	defaultValue,
	onChange,
	valueKeys,
	disabled = false,
	...props
}: GUISpringProps) {
	useGUIValueKeys(valueKeys);
	const emitChange = (next: GUISpringValue) => {
		if (!disabled) onChange(next);
	};

	return (
		<GUIMotionEditor
			{...props}
			disabled={disabled}
			isDefault={defaultValue !== undefined && springParameters.every(({ key }) => defaultValue[key] === value[key])}
			onReset={defaultValue ? () => emitChange({ ...defaultValue }) : undefined}
		>
			<div className="vpk-gui-motion-visualization" role="img" aria-label={`${props.label} response curve`}>
				<SpringVisualization spring={{ type: "spring", ...value }} isSimpleMode={false} />
			</div>
			<div className="space-y-3">
				{springParameters.map(({ key, label, min, max, step }) => (
					<GUIControl
						key={key}
						id={`${props.id}-${key}`}
						label={label}
						value={value[key]}
						min={min}
						max={max}
						step={step}
						disabled={disabled}
						onChange={(next) => emitChange({ ...value, [key]: clampGUIValue(next, min, max) })}
					/>
				))}
			</div>
		</GUIMotionEditor>
	);
}
