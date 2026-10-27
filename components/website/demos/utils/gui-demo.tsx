"use client";

import Image from "next/image";
import { motion, type Transition } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";
import VideoStopIcon from "@atlaskit/icon/core/video-stop";

import { GUI, type GUIEasingValue, type GUISpringValue } from "@/components/utils/gui";
import {
	parseGUIColorToRgbHex,
	rgbaUnitToCss,
	rgbaUnitToRgbHex,
	type GUIRGBAColor,
} from "@/components/utils/gui-color";
import LiquidGradient from "@/components/visual/liquid-gradient";
import { motionDuration, motionEase } from "@/lib/motion";

const DEFAULT_MOTION_SPRING: GUISpringValue = {
	stiffness: 170,
	damping: 26,
	mass: 1,
};

const THEME_OPTIONS = [
	{
		value: "brand",
		label: "Brand",
		description: "High contrast blue surface.",
		meta: "color.icon.accent.blue",
		swatch: "var(--ds-icon-accent-blue)",
	},
	{
		value: "success",
		label: "Success",
		description: "Green confirmation state.",
		meta: "color.icon.accent.green",
		swatch: "var(--ds-icon-accent-green)",
	},
	{
		value: "warning",
		label: "Warning",
		description: "Orange attention state.",
		meta: "color.icon.accent.orange",
		swatch: "var(--ds-icon-accent-orange)",
	},
] as const;

type GUIThemeValue = (typeof THEME_OPTIONS)[number]["value"];

const THEME_PREVIEW: Record<
	GUIThemeValue,
	{
		accent: string;
		grid: string;
		seed: number;
		tint: string;
	}
> = {
	brand: {
		accent: "#357DE8",
		grid: "rgba(53, 125, 232, 0.34)",
		seed: 648,
		tint: "rgba(12, 102, 228, 0.16)",
	},
	success: {
		accent: "#22A06B",
		grid: "rgba(34, 160, 107, 0.32)",
		seed: 314,
		tint: "rgba(34, 160, 107, 0.16)",
	},
	warning: {
		accent: "#E06C00",
		grid: "rgba(224, 108, 0, 0.3)",
		seed: 912,
		tint: "rgba(224, 108, 0, 0.15)",
	},
};

const SWATCH_OPTIONS = [
	{ value: "#357DE8", label: "Blue", color: "#357DE8" },
	{ value: "#22A06B", label: "Green", color: "#22A06B" },
	{ value: "#E06C00", label: "Orange", color: "#E06C00" },
	{ value: "#AF59E1", label: "Purple", color: "#AF59E1" },
] as const;

const STYLE_SWATCH_OPTIONS = [
	{ value: "solid", label: "Solid", color: "#172B4D" },
	{ value: "soft", label: "Soft", color: "#8590A2" },
	{ value: "outline", label: "Outline", color: "#F1F2F4" },
] as const;

function toShaderHex(value: string, fallback: string): string {
	return parseGUIColorToRgbHex(value) ?? fallback;
}

function getShaderPalette(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const palette: string[] = [];

	for (const value of values) {
		const parsed = parseGUIColorToRgbHex(value);
		if (!parsed || seen.has(parsed)) continue;
		seen.add(parsed);
		palette.push(parsed);
	}

	return palette.length >= 3 ? palette.slice(0, 8) : ["#357DE8", "#22A06B", "#AF59E1"];
}

export function GUIFullConfigDemo() {
	const id = useId();
	const [size, setSize] = useState(144);
	const [radius, setRadius] = useState(18);
	const [opacity, setOpacity] = useState(0.92);
	const [enabled, setEnabled] = useState(true);
	const [theme, setTheme] = useState<(typeof THEME_OPTIONS)[number]["value"]>("brand");
	const [label, setLabel] = useState("Shared GUI");
	const [snapToGrid, setSnapToGrid] = useState(true);
	const [hexColor, setHexColor] = useState("#357DE8");
	const [cssColor, setCssColor] = useState("rgb(34, 160, 107)");
	const [colorStops, setColorStops] = useState(["#357DE8", "#22A06B", "#AF59E1"]);
	const [rgbaColor, setRgbaColor] = useState<GUIRGBAColor>([0.2, 0.49, 0.91, 0.82]);
	const [imageSrc, setImageSrc] = useState<string | undefined>();
	const [swatches, setSwatches] = useState<string[]>(["#357DE8", "#22A06B"]);
	const [styleSwatches, setStyleSwatches] = useState<string[]>(["solid"]);
	const [playback, setPlayback] = useState<"play" | "stop">("play");
	const [motionMode, setMotionMode] = useState<"easing" | "spring">("easing");
	const [motionEasing, setMotionEasing] = useState<[...GUIEasingValue]>([...motionEase.inOut]);
	const [motionSpring, setMotionSpring] = useState<GUISpringValue>(DEFAULT_MOTION_SPRING);
	const [motionSeconds, setMotionSeconds] = useState<number>(motionDuration.slowest);
	const [disabledAmount, setDisabledAmount] = useState(6);
	const [disabledToggle, setDisabledToggle] = useState(false);
	const [disabledColor, setDisabledColor] = useState("#C7D1DB");
	const [disabledStops, setDisabledStops] = useState(["#C7D1DB", "#F1F2F4"]);
	const [closedPanelNote, setClosedPanelNote] = useState("Open to mount this value key");
	const [actionCount, setActionCount] = useState(0);
	const imageObjectUrlRef = useRef<string | undefined>(undefined);

	const handleImageFile = useCallback((file: File) => {
		const nextUrl = URL.createObjectURL(file);
		if (imageObjectUrlRef.current) {
			URL.revokeObjectURL(imageObjectUrlRef.current);
		}
		imageObjectUrlRef.current = nextUrl;
		setImageSrc(nextUrl);
	}, []);

	const clearImage = useCallback(() => {
		if (imageObjectUrlRef.current) {
			URL.revokeObjectURL(imageObjectUrlRef.current);
			imageObjectUrlRef.current = undefined;
		}
		setImageSrc(undefined);
	}, []);

	useEffect(() => {
		return () => {
			if (imageObjectUrlRef.current) {
				URL.revokeObjectURL(imageObjectUrlRef.current);
			}
		};
	}, []);

	const selectedTheme = THEME_PREVIEW[theme];
	const selectedThemeOption = THEME_OPTIONS.find((option) => option.value === theme);
	const themeToken = selectedThemeOption?.meta;
	const shaderPalette = useMemo(
		() =>
			getShaderPalette([
				selectedTheme.accent,
				hexColor,
				cssColor,
				rgbaUnitToRgbHex(rgbaColor),
				...colorStops,
				...swatches,
			]),
		[colorStops, cssColor, hexColor, rgbaColor, selectedTheme.accent, swatches],
	);
	const previewBackground = useMemo(
		() => `linear-gradient(135deg, ${shaderPalette.join(", ")})`,
		[shaderPalette],
	);
	const hasSoftStyle = styleSwatches.includes("soft");
	const hasOutlineStyle = styleSwatches.includes("outline");
	const hasSolidStyle = styleSwatches.includes("solid");
	const isPlaying = playback === "play" && enabled;
	const previewAccent = toShaderHex(hexColor, selectedTheme.accent);
	const motionTransition: Transition = motionMode === "easing"
		? { duration: motionSeconds, ease: motionEasing }
		: { type: "spring", ...motionSpring };
	const motionPreviewKey = `${actionCount}-${isPlaying}-${motionMode}-${motionSeconds}-${motionEasing.join(",")}-${motionSpring.stiffness}-${motionSpring.damping}-${motionSpring.mass}`;

	const config = useMemo(
		() => ({
			size,
			radius,
			opacity,
			enabled,
			theme,
			themeToken,
			label,
			snapToGrid,
			hexColor,
			cssColor,
			colorStops,
			rgbaColor,
			imageSrc: imageSrc ? "[local-object-url]" : undefined,
			imageUploaded: Boolean(imageSrc),
			swatches,
			styleSwatches,
			playback,
			motionMode,
			motionEasing,
			motionSpring,
			motionSeconds,
			disabledAmount,
			disabledToggle,
			disabledColor,
			disabledStops,
			closedPanelNote,
			actionCount,
		}),
		[
			actionCount,
			closedPanelNote,
			colorStops,
			cssColor,
			disabledAmount,
			disabledColor,
			disabledStops,
			disabledToggle,
			enabled,
			hexColor,
			imageSrc,
			label,
			motionEasing,
			motionMode,
			motionSeconds,
			motionSpring,
			opacity,
			playback,
			radius,
			rgbaColor,
			size,
			snapToGrid,
			styleSwatches,
			swatches,
			theme,
			themeToken,
		],
	);

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
				<div
					className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-6"
					style={{
						background: `linear-gradient(135deg, ${selectedTheme.tint}, transparent 48%), var(--color-surface)`,
					}}
				>
					<style>{`
						@keyframes gui-demo-orbit {
							from { transform: rotate(0deg); }
							to { transform: rotate(360deg); }
						}

						@keyframes gui-demo-action-pulse {
							0% { opacity: 0.7; transform: scale(0.92); }
							100% { opacity: 0; transform: scale(1.22); }
						}
					`}</style>
					<div className="absolute inset-0 opacity-90">
						<LiquidGradient
							colors={shaderPalette}
							seed={selectedTheme.seed + actionCount * 17}
							speed={isPlaying ? 0.24 + opacity * 0.5 : 0}
							loop={snapToGrid ? 12 : 0}
							scale={snapToGrid ? 0.34 + size / 900 : 0.54 + size / 850}
							turbAmp={hasSoftStyle ? 0.86 : 0.62}
							turbFreq={snapToGrid ? 0.16 : 0.1}
							turbIter={hasOutlineStyle ? 10 : 7}
							waveFreq={hasSolidStyle ? 3.8 : 2.6}
							distBias={snapToGrid ? -0.08 : 0.18}
							jellify={!snapToGrid || hasSoftStyle}
							ditherMode={hasOutlineStyle ? 2 : 1}
							dither={hasOutlineStyle ? 0.06 : 0.02}
							exposure={enabled ? 1.08 : 0.74}
							contrast={hasOutlineStyle ? 1.32 : 1.08}
							saturation={enabled ? 1.08 : 0.35}
						/>
					</div>
					<div
						className="absolute inset-0"
						style={{
							backgroundImage: snapToGrid
								? `linear-gradient(${selectedTheme.grid} 1px, transparent 1px), linear-gradient(90deg, ${selectedTheme.grid} 1px, transparent 1px)`
								: `radial-gradient(circle at 30% 22%, ${selectedTheme.grid} 0 2px, transparent 2.5px)`,
							backgroundPosition: snapToGrid ? "center" : "0 0",
							backgroundSize: snapToGrid ? "32px 32px" : "28px 28px",
							opacity: snapToGrid ? 0.56 : 0.24,
						}}
					/>
					<div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2 text-[11px] font-medium text-text">
						<span className="rounded bg-surface-overlay px-2 py-1 shadow-sm">
							{selectedThemeOption?.label}
						</span>
						<span className="rounded bg-surface-overlay px-2 py-1 shadow-sm">
							{playback === "play" ? "Playing" : "Stopped"}
						</span>
						<span className="rounded bg-surface-overlay px-2 py-1 shadow-sm">
							{snapToGrid ? "Snapped" : "Free"}
						</span>
						<span className="rounded bg-surface-overlay px-2 py-1 shadow-sm">
							{motionMode === "easing" ? "Easing preview" : "Spring preview"}
						</span>
					</div>
					<div className="absolute bottom-4 left-4 flex gap-1.5">
						{swatches.map((swatch) => (
							<span
								key={swatch}
								className="size-3 rounded-full border border-border-inverse"
								style={{ backgroundColor: swatch }}
							/>
						))}
					</div>
					<div className="absolute bottom-4 right-4 rounded bg-surface-overlay px-2 py-1 text-[11px] font-medium text-text shadow-sm">
						Runs {actionCount}
					</div>
					<motion.div
						key={motionPreviewKey}
						data-gui-motion-preview={motionMode}
						initial={isPlaying ? { x: -48 } : false}
						animate={{ x: 0 }}
						transition={motionTransition}
						style={{ willChange: "transform" }}
					>
						<div
							className="relative flex items-center justify-center overflow-hidden border border-border-bold text-center font-semibold text-text-inverse shadow-lg"
							style={{
								width: size,
								height: size,
								borderRadius: radius,
								opacity: enabled ? opacity : 0.42,
								background: hasSolidStyle ? previewBackground : "color-mix(in srgb, var(--color-surface-overlay) 62%, transparent)",
								backdropFilter: hasSoftStyle ? "blur(18px) saturate(1.4)" : undefined,
								borderColor: hasOutlineStyle ? previewAccent : "var(--color-border-bold)",
								borderWidth: hasOutlineStyle ? 2 : 1,
								color: previewAccent,
								boxShadow: hasOutlineStyle ? `0 0 0 1px ${selectedTheme.grid}` : `0 18px 60px ${rgbaUnitToCss(rgbaColor)}`,
								filter: enabled ? "none" : "grayscale(0.65)",
								transform: snapToGrid ? "translate3d(0, 0, 0) rotate(0deg)" : "translate3d(18px, -12px, 0) rotate(-7deg)",
								transition: "all var(--duration-normal) var(--ease-out)",
								willChange: "transform, opacity, filter",
							}}
						>
							{actionCount > 0 ? (
								<span
									key={`gui-demo-action-${actionCount}`}
									className="pointer-events-none absolute -inset-5 rounded-[inherit] border-2"
									style={{
										animation: "gui-demo-action-pulse 700ms var(--ease-out) both",
										borderColor: selectedTheme.accent,
									}}
								/>
							) : null}
							{imageSrc ? (
								<Image
									src={imageSrc}
									alt=""
									width={400}
									height={400}
									unoptimized
									className="absolute inset-0 size-full object-cover opacity-35"
								/>
							) : null}
							<div
								className="absolute inset-3 rounded-[inherit] border border-current opacity-45"
								style={{
									animation: "gui-demo-orbit 8s linear infinite",
									animationPlayState: isPlaying ? "running" : "paused",
									borderStyle: hasOutlineStyle ? "solid" : "dashed",
								}}
							/>
							<span className="relative max-w-[80%] text-sm leading-5">{label}</span>
						</div>
					</motion.div>
				</div>

				<GUI.Panel
					title="Kitchen sink"
					values={config}
					onPlay={() => setActionCount((count) => count + 1)}
					playLabel="Replay motion preview"
				>
					<GUI.Section title="Motion" borderTop={false}>
						<GUI.Select
							id={`${id}-motion-type`}
							label="Motion type"
							value={motionMode}
							defaultValue="easing"
							options={[
								{ value: "easing", label: "Easing" },
								{ value: "spring", label: "Spring" },
							]}
							valueKeys="motionMode"
							onChange={setMotionMode}
						/>
						<GUI.Control
							id={`${id}-motion-duration`}
							label="Easing duration"
							value={motionSeconds}
							defaultValue={motionDuration.slowest}
							min={motionDuration.fast}
							max={2}
							step={motionDuration.xxshort}
							unit="s"
							disabled={motionMode !== "easing"}
							valueKeys="motionSeconds"
							onChange={setMotionSeconds}
						/>
						<GUI.Easing
							id={`${id}-motion-easing`}
							label="Easing curve"
							description="Edit the curve to replay the card with a timed transition."
							value={motionEasing}
							defaultValue={motionEase.inOut}
							disabled={motionMode !== "easing"}
							valueKeys="motionEasing"
							onChange={setMotionEasing}
						/>
						<GUI.Spring
							id={`${id}-motion-spring`}
							label="Spring physics"
							description="Edit stiffness, damping, and mass to replay a physics transition."
							value={motionSpring}
							defaultValue={DEFAULT_MOTION_SPRING}
							disabled={motionMode !== "spring"}
							valueKeys="motionSpring"
							onChange={setMotionSpring}
						/>
					</GUI.Section>
					<GUI.Section title="Numeric">
						<GUI.Control
							id="gui-size"
							label="Size"
							description="Pixel size with reset, clamping, unit label, and mounted value key."
							value={size}
							defaultValue={144}
							min={64}
							max={240}
							step={1}
							unit="px"
							valueKeys="size"
							onChange={setSize}
						/>
						<GUI.Control
							id="gui-radius"
							label="Radius"
							description="Rounded corner control using the same numeric row API."
							value={radius}
							defaultValue={18}
							min={0}
							max={120}
							step={1}
							unit="px"
							valueKeys="radius"
							onChange={setRadius}
						/>
						<GUI.PercentControl
							id="gui-opacity"
							label="Opacity"
							description="Normalized 0..1 value displayed as a percentage."
							value={opacity}
							defaultValue={0.92}
							min={0}
							max={1}
							step={0.01}
							valueKeys="opacity"
							onChange={setOpacity}
						/>
					</GUI.Section>

					<GUI.Section title="State">
						<GUI.Toggle
							id="gui-enabled"
							label="Enabled"
							description="Boolean switch with helper copy."
							checked={enabled}
							valueKeys="enabled"
							onChange={setEnabled}
						/>
						<GUI.Select
							id="gui-theme"
							label="Theme"
							description="Dropdown mode with swatch, description, meta, sticky option, and reset."
							value={theme}
							defaultValue="brand"
							options={THEME_OPTIONS}
							stickyOptionValue="brand"
							valueKeys="theme"
							onChange={setTheme}
						/>
						<GUI.SegmentedControl
							id="gui-playback"
							label="Playback"
							description="String segmented control with icons."
							value={playback}
							options={[
								{ value: "play", label: "Play", icon: VideoPlayIcon },
								{ value: "stop", label: "Stop", icon: VideoStopIcon },
							]}
							valueKeys="playback"
							onChange={setPlayback}
						/>
						<GUI.SegmentedControl
							id="gui-snap"
							label="Snap"
							description="Boolean segmented control path."
							value={snapToGrid}
							options={[
								{ value: true, label: "Snap" },
								{ value: false, label: "Free" },
							]}
							valueKeys="snapToGrid"
							onChange={setSnapToGrid}
						/>
					</GUI.Section>

					<GUI.Section title="Text">
						<GUI.TextInput
							id="gui-label"
							label="Label"
							description="Text input with placeholder and live preview binding."
							value={label}
							placeholder="Preview label"
							valueKeys="label"
							onChange={setLabel}
						/>
					</GUI.Section>

					<GUI.Section title="Colors">
						<GUI.ColorInput
							id="gui-hex-color"
							label="Hex"
							description="Hex string with draft buffering and default reset."
							value={hexColor}
							defaultValue="#357DE8"
							format="hex"
							valueKeys="hexColor"
							onChange={setHexColor}
						/>
						<GUI.ColorInput
							id="gui-css-color"
							label="CSS"
							description="CSS color string committed immediately."
							value={cssColor}
							defaultValue="rgb(34, 160, 107)"
							format="css"
							valueKeys="cssColor"
							onChange={setCssColor}
						/>
						<GUI.ColorList
							id="gui-color-stops"
							label="Stops"
							description="Editable color stop list with add, remove, max, and default reset."
							value={colorStops}
							defaultValue={["#357DE8", "#22A06B", "#AF59E1"]}
							allowAddRemove
							addColor="#FFAB00"
							maxColors={5}
							valueKeys="colorStops"
							onChange={setColorStops}
						/>
						<GUI.RgbaColorInput
							id="gui-rgba-color"
							label="Shadow"
							value={rgbaColor}
							defaultValue={[0.2, 0.49, 0.91, 0.82]}
							valueKeys="rgbaColor"
							onChange={setRgbaColor}
						/>
					</GUI.Section>

					<GUI.Section title="Media">
						<GUI.ImageInput
							id="gui-image"
							label="Image or SVG"
							description="Local file adapter with preview labels, clear action, and value callback."
							value={imageSrc}
							placeholder="No local image selected"
							accept="image/svg+xml,image/*"
							objectFit="cover"
							previewClassName="bg-surface"
							previewAlt="Uploaded preview"
							uploadLabel="Upload file"
							changeLabel="Replace"
							clearLabel="Clear image"
							showClear
							valueKeys={["imageSrc", "imageUploaded"]}
							onChange={setImageSrc}
							onFile={handleImageFile}
							onClear={clearImage}
						/>
					</GUI.Section>

					<GUI.Section title="Swatches">
						<GUI.SwatchGroup
							id="gui-swatches"
							label="Accents"
							description="Ordered multi-select circle swatches with minSelected."
							value={swatches}
							options={SWATCH_OPTIONS}
							minSelected={1}
							valueKeys="swatches"
							onChange={setSwatches}
						/>
						<GUI.SwatchGroup
							id="gui-style-swatches"
							label="Style"
							description="Square swatch shape variant."
							value={styleSwatches}
							options={STYLE_SWATCH_OPTIONS}
							shape="square"
							minSelected={1}
							valueKeys="styleSwatches"
							onChange={setStyleSwatches}
						/>
					</GUI.Section>

					<GUI.Section title="Disabled states" defaultOpen={false}>
						<GUI.Control
							id="gui-disabled-amount"
							label="Disabled number"
							description="Disabled numeric control still renders labels, unit, and range copy."
							value={disabledAmount}
							defaultValue={6}
							min={0}
							max={12}
							step={1}
							unit="px"
							disabled
							valueKeys="disabledAmount"
							onChange={setDisabledAmount}
						/>
						<GUI.Toggle
							id="gui-disabled-toggle"
							label="Disabled toggle"
							description="Disabled boolean switch path."
							checked={disabledToggle}
							disabled
							valueKeys="disabledToggle"
							onChange={setDisabledToggle}
						/>
						<GUI.ColorInput
							id="gui-disabled-color"
							label="Disabled color"
							description="Disabled color input path."
							value={disabledColor}
							defaultValue="#C7D1DB"
							disabled
							valueKeys="disabledColor"
							onChange={setDisabledColor}
						/>
						<GUI.ColorList
							id="gui-disabled-stops"
							label="Disabled stops"
							description="Disabled color list path with add/remove config present."
							value={disabledStops}
							defaultValue={["#C7D1DB", "#F1F2F4"]}
							allowAddRemove
							addColor="#B3B9C4"
							maxColors={4}
							disabled
							valueKeys="disabledStops"
							onChange={setDisabledStops}
						/>
					</GUI.Section>
				</GUI.Panel>
				<GUI.Panel title="Starts closed" values={config} defaultOpen={false}>
					<GUI.Section title="Mounted keys">
						<GUI.TextInput
							id="gui-closed-note"
							label="Note"
							description="Panel defaultOpen=false path for compact demos."
							value={closedPanelNote}
							valueKeys="closedPanelNote"
							onChange={setClosedPanelNote}
						/>
					</GUI.Section>
				</GUI.Panel>
			</div>
		</div>
	);
}

export default function GUIDemo() {
	return <GUIFullConfigDemo />;
}
