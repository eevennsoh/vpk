"use client";

import {
	ShaderLabComposition,
	type ShaderLabBlendMode,
	type ShaderLabCompositeMode,
	type ShaderLabConfig,
	type ShaderLabLayerConfig,
	type ShaderLabParameterValue,
} from "@basementstudio/shader-lab";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { GUI } from "@/components/utils/gui";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	getShaderLabDefaultParams,
	getShaderLabLayerKind,
	getShaderLabPresetDefaults,
	getShaderLabRuntimeLayerType,
	isShaderLabParamVisible,
	optionLabel,
} from "./shader-lab/helpers";
import { SHADER_LAB_LAYER_DEFINITIONS } from "./shader-lab/index";
import {
	SHADER_LAB_BLEND_MODES,
	SHADER_LAB_COMPOSITE_MODES,
	SHADER_LAB_MASK_MODES,
	SHADER_LAB_MASK_SOURCES,
	type ShaderLabEffectParamDefinition,
	type ShaderLabRuntimeEffectType,
	type ShaderLabRuntimeLayerType,
} from "./shader-lab/types";

type ShaderLabMaskSource = (typeof SHADER_LAB_MASK_SOURCES)[number];
type ShaderLabMaskMode = (typeof SHADER_LAB_MASK_MODES)[number];

type ShaderLabEffectProps = Readonly<{
	effectType: ShaderLabRuntimeEffectType;
	className?: string;
	style?: CSSProperties;
}>;

type ShaderLabLayerProps = Readonly<{
	layerType: ShaderLabRuntimeLayerType;
	className?: string;
	style?: CSSProperties;
}>;

type ShaderLabDemoLayersOptions = Readonly<{
	blendMode: ShaderLabBlendMode;
	compositeMode: ShaderLabCompositeMode;
	definitionLabel: string;
	hue: number;
	layerKind: ShaderLabLayerConfig["kind"];
	layerType: ShaderLabRuntimeLayerType;
	maskInvert: boolean;
	maskMode: ShaderLabMaskMode;
	maskSource: ShaderLabMaskSource;
	opacity: number;
	params: Record<string, ShaderLabParameterValue>;
	runtimeLayerType: ShaderLabLayerConfig["type"];
	saturation: number;
	sourceImage: ShaderLabSourceImage;
	visible: boolean;
}>;

type ShaderLabSourceImage = Readonly<{
	fileName: string;
	src: string;
}>;

const SHADER_LAB_IMAGE_SOURCE_PARAMS: Record<string, ShaderLabParameterValue> = {
	fitMode: "cover",
	scale: 1,
	offset: [0, 0],
	svgRasterResolution: "2048",
};

const DEFAULT_SHADER_LAB_SOURCE_IMAGE: ShaderLabSourceImage = {
	fileName: "ambient-clouds-blue.png",
	src: "/ambient/atlassian/pictorial/clouds/primary/blue.png",
};

const BLEND_MODE_OPTIONS = SHADER_LAB_BLEND_MODES.map((mode) => ({
	value: mode,
	label: optionLabel(mode),
}));

const COMPOSITE_MODE_OPTIONS = SHADER_LAB_COMPOSITE_MODES.map((mode) => ({
	value: mode,
	label: optionLabel(mode),
}));

const MASK_SOURCE_OPTIONS = SHADER_LAB_MASK_SOURCES.map((source) => ({
	value: source,
	label: optionLabel(source),
}));

const MASK_MODE_OPTIONS = SHADER_LAB_MASK_MODES.map((mode) => ({
	value: mode,
	label: optionLabel(mode),
}));

function numericValue(value: ShaderLabParameterValue | undefined, fallback: ShaderLabParameterValue): number {
	return typeof value === "number" ? value : typeof fallback === "number" ? fallback : 0;
}

function stringValue(value: ShaderLabParameterValue | undefined, fallback: ShaderLabParameterValue): string {
	return typeof value === "string" ? value : typeof fallback === "string" ? fallback : "";
}

function booleanValue(value: ShaderLabParameterValue | undefined, fallback: ShaderLabParameterValue): boolean {
	return typeof value === "boolean" ? value : typeof fallback === "boolean" ? fallback : false;
}

function vectorValue(
	value: ShaderLabParameterValue | undefined,
	fallback: ShaderLabParameterValue,
	length: 2 | 3,
): [number, number] | [number, number, number] {
	const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
	const next = Array.from({ length }, (_, index) => {
		const entry = source[index];
		return typeof entry === "number" ? entry : 0;
	});
	return length === 2 ? [next[0] ?? 0, next[1] ?? 0] : [next[0] ?? 0, next[1] ?? 0, next[2] ?? 0];
}

function getParamGroups(params: readonly ShaderLabEffectParamDefinition[]) {
	const groups = new Map<string, ShaderLabEffectParamDefinition[]>();

	for (const param of params) {
		const group = param.group ?? "Parameters";
		groups.set(group, [...(groups.get(group) ?? []), param]);
	}

	return Array.from(groups.entries());
}

function shaderLabLayerUsesSourceImage(layerKind: ShaderLabLayerConfig["kind"], layerType: ShaderLabRuntimeLayerType): boolean {
	return layerKind === "effect" || layerType === "pixel-trail" || layerType === "magnify-lens";
}

function sanitizeSourceFileName(fileName: string): string {
	const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
	return normalized.length > 0 ? normalized : "uploaded-source-image.png";
}

function createShaderLabSourceImageLayer(sourceImage: ShaderLabSourceImage): ShaderLabLayerConfig {
	return {
		asset: {
			fileName: sourceImage.fileName,
			kind: "image",
			src: sourceImage.src,
		},
		blendMode: "normal",
		compositeMode: "filter",
		hue: 0,
		id: "source-image",
		kind: "source",
		name: "Source image",
		opacity: 1,
		params: SHADER_LAB_IMAGE_SOURCE_PARAMS,
		saturation: 1,
		type: "image",
		visible: true,
	};
}

function getShaderLabDemoLayers({
	blendMode,
	compositeMode,
	definitionLabel,
	hue,
	layerKind,
	layerType,
	maskInvert,
	maskMode,
	maskSource,
	opacity,
	params,
	runtimeLayerType,
	saturation,
	sourceImage,
	visible,
}: ShaderLabDemoLayersOptions): ShaderLabLayerConfig[] {
	const activeLayer: ShaderLabLayerConfig = {
		blendMode,
		compositeMode,
		hue,
		id: `${layerType}-layer`,
		kind: layerKind,
		maskConfig: compositeMode === "mask"
			? {
				invert: maskInvert,
				mode: maskMode,
				source: maskSource,
			}
			: undefined,
		name: definitionLabel,
		opacity,
		params,
		saturation,
		type: runtimeLayerType,
		visible,
	};

	if (shaderLabLayerUsesSourceImage(layerKind, layerType)) {
		return [activeLayer, createShaderLabSourceImageLayer(sourceImage)];
	}

	return [activeLayer];
}

export function ShaderLabLayer({ layerType, className, style }: ShaderLabLayerProps) {
	const definition = SHADER_LAB_LAYER_DEFINITIONS[layerType];
	const layerKind = getShaderLabLayerKind(definition);
	const runtimeLayerType = getShaderLabRuntimeLayerType(definition);
	const [visible, setVisible] = useState(true);
	const [opacity, setOpacity] = useState(1);
	const [blendMode, setBlendMode] = useState<ShaderLabBlendMode>("normal");
	const [compositeMode, setCompositeMode] = useState<ShaderLabCompositeMode>("filter");
	const [maskSource, setMaskSource] = useState<ShaderLabMaskSource>("luminance");
	const [maskMode, setMaskMode] = useState<ShaderLabMaskMode>("multiply");
	const [maskInvert, setMaskInvert] = useState(false);
	const [hue, setHue] = useState(0);
	const [saturation, setSaturation] = useState(1);
	const [sourceImage, setSourceImage] = useState<ShaderLabSourceImage>(DEFAULT_SHADER_LAB_SOURCE_IMAGE);
	const uploadedSourceUrlRef = useRef<string | null>(null);
	const [params, setParams] = useState<Record<string, ShaderLabParameterValue>>(() => (
		getShaderLabDefaultParams(definition)
	));

	const usesSourceImage = shaderLabLayerUsesSourceImage(layerKind, layerType);

	useEffect(() => () => {
		if (uploadedSourceUrlRef.current) {
			URL.revokeObjectURL(uploadedSourceUrlRef.current);
		}
	}, []);

	const resetSourceImage = useCallback(() => {
		if (uploadedSourceUrlRef.current) {
			URL.revokeObjectURL(uploadedSourceUrlRef.current);
			uploadedSourceUrlRef.current = null;
		}
		setSourceImage(DEFAULT_SHADER_LAB_SOURCE_IMAGE);
	}, []);

	const uploadSourceImage = useCallback((file: File) => {
		const nextUrl = URL.createObjectURL(file);
		if (uploadedSourceUrlRef.current) {
			URL.revokeObjectURL(uploadedSourceUrlRef.current);
		}
		uploadedSourceUrlRef.current = nextUrl;
		setSourceImage({
			fileName: sanitizeSourceFileName(file.name),
			src: nextUrl,
		});
	}, []);

	const updateParam = useCallback((key: string, value: ShaderLabParameterValue) => {
		setParams((current) => {
			const presetDefaults = getShaderLabPresetDefaults(definition, key, value);
			return {
				...current,
				[key]: value,
				...(presetDefaults ?? {}),
			};
		});
	}, [definition]);

	const config = useMemo<ShaderLabConfig>(() => ({
		composition: {
			width: 1280,
			height: 720,
		},
		layers: getShaderLabDemoLayers({
			blendMode,
			compositeMode,
			definitionLabel: definition.label,
			hue,
			layerKind,
			layerType,
			maskInvert,
			maskMode,
			maskSource,
			opacity,
			params,
			runtimeLayerType,
			saturation,
			sourceImage,
			visible,
		}),
		timeline: {
			duration: 8,
			loop: true,
			tracks: [],
		},
	}), [
		blendMode,
		compositeMode,
		definition.label,
		hue,
		layerKind,
		layerType,
		maskInvert,
		maskMode,
		maskSource,
		opacity,
		params,
		runtimeLayerType,
		saturation,
		sourceImage,
		visible,
	]);

	const values = useMemo(() => ({
		layerType,
		visible,
		opacity,
		blendMode,
		compositeMode,
		maskSource,
		maskMode,
		maskInvert,
		hue,
		saturation,
		...(usesSourceImage ? { sourceImage: sourceImage.fileName } : {}),
		...params,
	}), [
		blendMode,
		compositeMode,
		hue,
		layerType,
		maskInvert,
		maskMode,
		maskSource,
		opacity,
		params,
		saturation,
		sourceImage.fileName,
		usesSourceImage,
		visible,
	]);

	const renderParamControl = useCallback((param: ShaderLabEffectParamDefinition): ReactNode => {
		const value = params[param.key];
		const id = `${layerType}-${param.key}`;

		switch (param.type) {
			case "number":
				return (
					<GUI.Control
						key={param.key}
						id={id}
						label={param.label}
						value={numericValue(value, param.defaultValue)}
						defaultValue={numericValue(param.defaultValue, 0)}
						min={param.min ?? 0}
						max={param.max ?? 1}
						step={param.step ?? 0.01}
						onChange={(next) => updateParam(param.key, next)}
					/>
				);
			case "boolean":
				return (
					<GUI.Toggle
						key={param.key}
						id={id}
						label={param.label}
						checked={booleanValue(value, param.defaultValue)}
						onChange={(next) => updateParam(param.key, next)}
					/>
				);
			case "color":
				return (
					<GUI.ColorInput
						key={param.key}
						id={id}
						label={param.label}
						value={stringValue(value, param.defaultValue)}
						defaultValue={stringValue(param.defaultValue, "#000000")}
						onChange={(next) => updateParam(param.key, next)}
					/>
				);
			case "select":
				return (
					<GUI.Select
						key={param.key}
						id={id}
						label={param.label}
						value={stringValue(value, param.defaultValue)}
						options={(param.options ?? []).map((option) => ({
							value: option.value,
							label: option.label,
						}))}
						onChange={(next) => updateParam(param.key, next)}
					/>
				);
			case "vec2": {
				const current = vectorValue(value, param.defaultValue, 2) as [number, number];
				const initial = vectorValue(param.defaultValue, [0, 0], 2) as [number, number];
				return (
					<div key={param.key} className="space-y-3">
						<GUI.Control
							id={`${id}-x`}
							label={`${param.label} X`}
							value={current[0]}
							defaultValue={initial[0]}
							min={param.min ?? 0}
							max={param.max ?? 1}
							step={param.step ?? 0.01}
							onChange={(next) => updateParam(param.key, [next, current[1]])}
						/>
						<GUI.Control
							id={`${id}-y`}
							label={`${param.label} Y`}
							value={current[1]}
							defaultValue={initial[1]}
							min={param.min ?? 0}
							max={param.max ?? 1}
							step={param.step ?? 0.01}
							onChange={(next) => updateParam(param.key, [current[0], next])}
						/>
					</div>
				);
			}
			case "vec3": {
				const current = vectorValue(value, param.defaultValue, 3) as [number, number, number];
				const initial = vectorValue(param.defaultValue, [0, 0, 0], 3) as [number, number, number];
				return (
					<div key={param.key} className="space-y-3">
						{(["X", "Y", "Z"] as const).map((axis, index) => (
							<GUI.Control
								key={axis}
								id={`${id}-${axis.toLowerCase()}`}
								label={`${param.label} ${axis}`}
								value={current[index]}
								defaultValue={initial[index]}
								min={param.min ?? 0}
								max={param.max ?? 1}
								step={param.step ?? 0.01}
								onChange={(next) => {
									const updated: [number, number, number] = [...current];
									updated[index] = next;
									updateParam(param.key, updated);
								}}
							/>
						))}
					</div>
				);
			}
			case "text":
				return (
					<div key={param.key} className="space-y-2">
						<label htmlFor={id} className="block text-xs font-medium text-text">
							{param.label}
						</label>
						<textarea
							id={id}
							value={stringValue(value, param.defaultValue)}
							onChange={(event) => updateParam(param.key, event.target.value)}
							className="min-h-32 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text shadow-sm outline-none transition-colors focus:border-border-focused"
							spellCheck={false}
						/>
					</div>
				);
			default:
				return null;
		}
	}, [layerType, params, updateParam]);

	const paramGroups = useMemo(() => (
		getParamGroups(definition.params.filter((param) => isShaderLabParamVisible(param, params)))
	), [definition.params, params]);

	return (
		<div
			className={cn("flex w-full max-w-2xl flex-col", className)}
			style={{ gap: token("space.400"), ...style }}
		>
			<div
				className="aspect-video w-full overflow-hidden rounded-lg bg-surface-overlay border border-border"
			>
				<ShaderLabComposition
					config={config}
					className="h-full w-full"
					style={{ height: "100%" }}
				/>
			</div>

			<GUI.Panel title="Shader controls" values={values}>
				<div className="space-y-4">
					{usesSourceImage ? (
						<GUI.ImageInput
							id={`${layerType}-source-image`}
							label="Source image"
							value={sourceImage.src}
							accept="image/*"
							previewAlt="Shader source"
							changeLabel="Change"
							clearLabel="Reset to default source image"
							showClear={sourceImage.src !== DEFAULT_SHADER_LAB_SOURCE_IMAGE.src}
							onFile={uploadSourceImage}
							onClear={resetSourceImage}
						/>
					) : null}
					<GUI.Section title="Layer" borderTop={false}>
						<GUI.Toggle
							id={`${layerType}-visible`}
							label="Visible"
							checked={visible}
							onChange={setVisible}
						/>
						<GUI.Control
							id={`${layerType}-opacity`}
							label="Opacity"
							value={opacity}
							defaultValue={1}
							min={0}
							max={1}
							step={0.01}
							onChange={setOpacity}
						/>
						<GUI.Select
							id={`${layerType}-blendMode`}
							label="Blend"
							value={blendMode}
							options={BLEND_MODE_OPTIONS}
							onChange={setBlendMode}
						/>
						<GUI.Select
							id={`${layerType}-compositeMode`}
							label="Mode"
							value={compositeMode}
							options={COMPOSITE_MODE_OPTIONS}
							onChange={setCompositeMode}
						/>
						{compositeMode === "mask" ? (
							<>
								<GUI.Select
									id={`${layerType}-maskSource`}
									label="Mask Source"
									value={maskSource}
									options={MASK_SOURCE_OPTIONS}
									onChange={setMaskSource}
								/>
								<GUI.Select
									id={`${layerType}-maskMode`}
									label="Mask Mode"
									value={maskMode}
									options={MASK_MODE_OPTIONS}
									onChange={setMaskMode}
								/>
								<GUI.Toggle
									id={`${layerType}-maskInvert`}
									label="Invert Mask"
									checked={maskInvert}
									onChange={setMaskInvert}
								/>
							</>
						) : null}
						<GUI.Control
							id={`${layerType}-hue`}
							label="Hue"
							value={hue}
							defaultValue={0}
							min={-180}
							max={180}
							step={1}
							unit="deg"
							onChange={setHue}
						/>
						<GUI.Control
							id={`${layerType}-saturation`}
							label="Saturation"
							value={saturation}
							defaultValue={1}
							min={0}
							max={2}
							step={0.01}
							onChange={setSaturation}
						/>
					</GUI.Section>

					{paramGroups.map(([group, groupParams]) => (
						<GUI.Section key={group} title={group}>
							{groupParams.map((param) => renderParamControl(param))}
						</GUI.Section>
					))}
				</div>
			</GUI.Panel>
		</div>
	);
}

export function ShaderLabEffect({ effectType, className, style }: ShaderLabEffectProps) {
	return <ShaderLabLayer layerType={effectType} className={className} style={style} />;
}

export default function ShaderLabEffectDemo({ effectType }: ShaderLabEffectProps) {
	return <ShaderLabEffect effectType={effectType} />;
}
