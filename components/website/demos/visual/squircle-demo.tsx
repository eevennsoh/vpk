"use client";

import { useMemo, useState } from "react";

import { GUI } from "@/components/utils/gui";
import { token } from "@/lib/tokens";

import Squircle from "./shaders/squircle";
import { SQUIRCLE_DEFAULT_SMOOTHNESS } from "./shaders/squircle-shape";
import { clamp } from "@/lib/utils";

function withAlpha(color: string, alpha: number): string {
	const normalized = color.trim();
	const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

	if (!match) {
		return color;
	}

	const raw = match[1];
	const expanded =
		raw.length === 3
			? raw
				.split("")
				.map((char) => char + char)
				.join("")
			: raw;

	const [r, g, b] = [0, 2, 4].map((index) =>
		Number.parseInt(expanded.slice(index, index + 2), 16),
	);

	return `rgb(${r} ${g} ${b} / ${clamp(alpha, 0, 1)})`;
}

export default function SquircleDemo() {
	const [width, setWidth] = useState(280);
	const [height, setHeight] = useState(280);
	const [smoothness, setSmoothness] = useState(SQUIRCLE_DEFAULT_SMOOTHNESS);
	const [showStroke, setShowStroke] = useState(true);
	const [strokeColor, setStrokeColor] = useState("#FFFFFF");
	const [strokeOpacity, setStrokeOpacity] = useState(0.42);
	const [strokeWidth, setStrokeWidth] = useState(1.5);

	const previewProps = useMemo(
		() => ({
			width,
			height,
			smoothness,
			strokeWidth: showStroke ? strokeWidth : 0,
			strokeColor: withAlpha(strokeColor, strokeOpacity),
		}),
		[
			height,
			showStroke,
			smoothness,
			strokeColor,
			strokeOpacity,
			strokeWidth,
			width,
		],
	);

	const config = useMemo(
		() => ({
			width,
			height,
			smoothness,
			stroke: showStroke
				? { color: strokeColor, opacity: strokeOpacity, width: strokeWidth }
				: false,
		}),
		[
			height,
			showStroke,
			smoothness,
			strokeColor,
			strokeOpacity,
			strokeWidth,
			width,
		],
	);

	return (
		<div className="flex w-full max-w-2xl flex-col" style={{ gap: token("space.400") }}>
			<div
				className="relative overflow-hidden border border-border"
				style={{
					borderRadius: 28,
				}}
			>
				<div
					className="relative flex w-full items-center justify-center overflow-hidden px-6 py-8"
					style={{ minHeight: 460 }}
				>
					<Squircle {...previewProps} />
				</div>
			</div>

			<GUI.Panel title="Squircle controls" values={config}>
				<GUI.Section title="Shape" borderTop={false}>
					<GUI.Control
						id="sq-width"
						label="Width"
						description="Rendered width of the squircle preview."
						value={width}
						defaultValue={280}
						min={140}
						max={520}
						step={1}
						unit="px"
						onChange={setWidth}
					/>
					<GUI.Control
						id="sq-height"
						label="Height"
						description="Rendered height of the squircle preview."
						value={height}
						defaultValue={280}
						min={140}
						max={520}
						step={1}
						unit="px"
						onChange={setHeight}
					/>
					<GUI.Control
						id="sq-smoothness"
						label="Smoothness"
						description="Higher values match Framer's squircle more closely. Lower values become more rectangular."
						value={smoothness}
						defaultValue={SQUIRCLE_DEFAULT_SMOOTHNESS}
						min={0}
						max={100}
						step={1}
						onChange={setSmoothness}
					/>
				</GUI.Section>

				<GUI.Section title="Stroke">
					<GUI.Toggle
						id="sq-stroke-enabled"
						label="Stroke"
						checked={showStroke}
						onChange={setShowStroke}
					/>

					{showStroke ? (
						<>
							<GUI.ColorInput
								id="sq-stroke-color"
								label="Stroke Color"
								value={strokeColor}
								defaultValue="#FFFFFF"
								onChange={setStrokeColor}
							/>
							<GUI.Control
								id="sq-stroke-opacity"
								label="Stroke Opacity"
								value={strokeOpacity}
								defaultValue={0.42}
								min={0.05}
								max={1}
								step={0.01}
								onChange={setStrokeOpacity}
							/>
							<GUI.Control
								id="sq-stroke-width"
								label="Stroke Width"
								value={strokeWidth}
								defaultValue={1.5}
								min={0.5}
								max={10}
								step={0.1}
								unit="px"
								onChange={setStrokeWidth}
							/>
						</>
					) : null}
				</GUI.Section>
			</GUI.Panel>
		</div>
	);
}
