"use client";

import Image from "next/image";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GUI } from "@/components/utils/gui";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
	CARD_GLOW_DEFAULT_CONFIG,
	type CardGlowConfig,
	type CardGlowTheme,
} from "./card-glow-config";

export { CARD_GLOW_DEFAULT_CONFIG, type CardGlowConfig } from "./card-glow-config";

type CardGlowCSSProperties = CSSProperties & Record<`--card-glow-${string}`, string | number>;
type CardGlowPreviewTextStyle = Partial<Record<"--ds-text" | "--ds-text-subtle", string>>;

interface CardGlowThemeStyles {
	borderClassName: string;
	cardClassName: string;
	previewClassName: string;
	previewTextStyle: CardGlowPreviewTextStyle;
}

interface CardGlowTile {
	accentColor: string;
	description: string;
	iconClassName?: string;
	iconHeight: number;
	iconSrc: string;
	iconWidth: number;
	layoutClassName: string;
	title: string;
}

const CARD_GLOW_TILES: readonly CardGlowTile[] = [
	{
		accentColor: "#1868DB",
		description: "Surface customer feedback themes from trusted sources.",
		iconHeight: 48,
		iconSrc: "/avatar-agent-new/blue/customer-insight.svg",
		iconWidth: 48,
		layoutClassName: "sm:col-span-2 lg:col-start-1 lg:col-span-1 lg:row-start-1",
		title: "Customer Insights",
	},
	{
		accentColor: "#6A9A23",
		description: "Group Jira work items into clear themes and epics.",
		iconHeight: 48,
		iconSrc: "/avatar-agent-new/lime/auto-review.svg",
		iconWidth: 48,
		layoutClassName: "sm:col-span-2 sm:row-span-2 lg:col-start-2 lg:row-start-1",
		title: "Jira Theme Analyzer",
	},
	{
		accentColor: "#FCA700",
		description: "Turn transcripts into insights and next actions.",
		iconHeight: 48,
		iconSrc: "/avatar-agent-new/orange/default.svg",
		iconWidth: 48,
		layoutClassName: "sm:row-span-2 lg:col-start-4 lg:row-start-1",
		title: "Transcript Insights Reporter",
	},
	{
		accentColor: "#AF59E1",
		description: "Find decisions, action items, and highlights in meetings.",
		iconHeight: 48,
		iconSrc: "/avatar-agent-new/purple/product-requirements.svg",
		iconWidth: 48,
		layoutClassName: "sm:row-span-2 lg:col-start-5 lg:row-start-1",
		title: "Meeting Insights",
	},
	{
		accentColor: "#FFC400",
		description: "Spot emerging trends across notes and feedback.",
		iconHeight: 48,
		iconSrc: "/avatar-agent-new/yellow/comms-drafter.svg",
		iconWidth: 48,
		layoutClassName: "lg:col-start-1 lg:row-start-2",
		title: "Trend Spotter",
	},
];

const THEME_OPTIONS: ReadonlyArray<{ value: CardGlowTheme; label: string }> = [
	{ value: "system", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

const CARD_GLOW_THEME_STYLES: Record<CardGlowTheme, CardGlowThemeStyles> = {
	system: {
		borderClassName: "border-border",
		cardClassName: "bg-background text-text",
		previewClassName: "bg-background text-text",
		previewTextStyle: {},
	},
	light: {
		borderClassName: "border-black/10",
		cardClassName: "bg-white text-[#172B4D]",
		previewClassName: "bg-[#F7F8FA] text-[#172B4D]",
		previewTextStyle: {
			"--ds-text": "#172B4D",
			"--ds-text-subtle": "#44546F",
		},
	},
	dark: {
		borderClassName: "border-white/12",
		cardClassName: "bg-[#12151D] text-[#F7F8FA]",
		previewClassName: "bg-[#08090D] text-[#F7F8FA]",
		previewTextStyle: {
			"--ds-text": "#F7F8FA",
			"--ds-text-subtle": "rgb(255 255 255 / 62%)",
		},
	},
};

function getCardGlowFilter(config: CardGlowConfig, filterId: string): string {
	const colorFilters = [
		`saturate(var(--card-glow-icon-saturate))`,
		`brightness(var(--card-glow-icon-brightness))`,
		`contrast(var(--card-glow-icon-contrast))`,
	].join(" ");

	if (config.css) {
		return `blur(calc(var(--card-glow-icon-blur) * 1px)) ${colorFilters}`;
	}

	return `url(#${filterId}) ${colorFilters}`;
}

function resetTilePointer(tile: HTMLElement) {
	tile.style.setProperty("--card-glow-pointer-x", "-10");
	tile.style.setProperty("--card-glow-pointer-y", "-10");
}

export function CardGlowBento({ config }: Readonly<{ config: CardGlowConfig }>) {
	const rawFilterId = useId();
	const filterId = `card-glow-blur-${rawFilterId.replaceAll(":", "")}`;
	const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const themeStyles = CARD_GLOW_THEME_STYLES[config.theme];

	const effectStyle = useMemo<CardGlowCSSProperties>(() => ({
		"--card-glow-icon-blur": config.iconBlur,
		"--card-glow-icon-saturate": config.iconSaturate,
		"--card-glow-icon-brightness": config.iconBrightness,
		"--card-glow-icon-contrast": config.iconContrast,
		"--card-glow-icon-scale": config.iconScale,
		"--card-glow-icon-opacity": config.iconOpacity,
		"--card-glow-border-core": Math.max(1, config.borderSpread * 0.3),
		"--card-glow-border-spread": config.borderSpread,
		"--card-glow-border-width": config.borderWidth,
		"--card-glow-border-blur": config.borderBlur,
		"--card-glow-border-saturate": config.borderSaturate,
		"--card-glow-border-brightness": config.borderBrightness,
		"--card-glow-border-contrast": config.borderContrast,
	}), [config]);

	const glowFilter = getCardGlowFilter(config, filterId);
	const borderFilter = [
		`blur(calc(var(--card-glow-border-blur) * 1px))`,
		`saturate(var(--card-glow-border-saturate))`,
		`brightness(var(--card-glow-border-brightness))`,
		`contrast(var(--card-glow-border-contrast))`,
	].join(" ");

	const glowLayerStyle: CSSProperties = {
		filter: glowFilter,
		scale: "var(--card-glow-icon-scale)",
		translate: "calc(var(--card-glow-pointer-x, -10) * 50cqi) calc(var(--card-glow-pointer-y, -10) * 50cqh)",
		willChange: "translate, scale, filter, opacity",
	};

	const borderGlowStyle: CSSProperties = {
		backdropFilter: borderFilter,
		background: [
			"radial-gradient(",
			"circle at ",
			"calc((var(--card-glow-pointer-x, -10) + 1) * 50%) ",
			"calc((var(--card-glow-pointer-y, -10) + 1) * 50%), ",
			"var(--card-glow-tile-accent) 0 calc(var(--card-glow-border-core) * 1px), ",
			"transparent calc(var(--card-glow-border-spread) * 1px)",
			") border-box",
		].join(""),
		borderColor: "transparent",
		borderWidth: "calc(var(--card-glow-border-width) * 1px)",
		mask: "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
		maskComposite: "exclude",
		WebkitBackdropFilter: borderFilter,
		WebkitMask: "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
		WebkitMaskComposite: "xor",
	};

	const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
		for (const tile of tileRefs.current) {
			if (!tile) continue;
			const rect = tile.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;
			const relativeX = event.clientX - centerX;
			const relativeY = event.clientY - centerY;
			const normalizedX = relativeX / (rect.width / 2);
			const normalizedY = relativeY / (rect.height / 2);

			tile.style.setProperty("--card-glow-pointer-x", normalizedX.toFixed(3));
			tile.style.setProperty("--card-glow-pointer-y", normalizedY.toFixed(3));
		}
	}, []);

	const resetPointer = useCallback(() => {
		for (const tile of tileRefs.current) {
			if (tile) resetTilePointer(tile);
		}
	}, []);

	return (
		<div
			className={cn(
				"relative w-full overflow-hidden rounded-lg border border-border p-4 sm:p-6",
				themeStyles.previewClassName,
			)}
			data-card-glow-theme={config.theme}
			onPointerLeave={resetPointer}
			onPointerMove={handlePointerMove}
			style={{ ...effectStyle, ...themeStyles.previewTextStyle }}
		>
			<svg
				aria-hidden
				className="pointer-events-none absolute size-0 overflow-hidden"
				focusable="false"
			>
				<filter id={filterId} width="500%" height="500%">
					<feGaussianBlur in="SourceGraphic" stdDeviation={config.iconBlur} />
				</filter>
			</svg>
			<div className="grid grid-cols-1 gap-3 auto-rows-[144px] sm:grid-cols-2 lg:grid-cols-5">
				{CARD_GLOW_TILES.map((tile, index) => (
					<button
						aria-label={tile.title}
						className={cn(
							"group/card-glow relative isolate flex min-h-0 flex-col items-start gap-3 overflow-hidden rounded-lg p-4 text-left outline-none transition-[background-color,box-shadow,translate,scale] duration-fast ease-out focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px active:scale-[0.99]",
							themeStyles.cardClassName,
							tile.layoutClassName,
						)}
						key={tile.title}
						ref={(node) => {
							tileRefs.current[index] = node;
						}}
						style={{
							"--card-glow-tile-accent": tile.accentColor,
							containerType: "size",
						} as CardGlowCSSProperties}
						type="button"
					>
						<span
							aria-hidden
							className="pointer-events-none absolute inset-0 z-0 grid place-items-center transform-gpu"
							style={glowLayerStyle}
						>
							<Image
								alt=""
								className={cn(
									"size-12 object-contain",
									config.exclude
										? "opacity-[calc(var(--card-glow-icon-opacity)*0.25)] transition-opacity duration-200 ease-out group-hover/card-glow:opacity-[var(--card-glow-icon-opacity)] group-focus-within/card-glow:opacity-[var(--card-glow-icon-opacity)]"
										: "opacity-[var(--card-glow-icon-opacity)]",
									tile.iconClassName,
								)}
								height={tile.iconHeight}
								src={tile.iconSrc}
								width={tile.iconWidth}
							/>
						</span>
						<span
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-0 z-[1] rounded-[inherit] border",
								themeStyles.borderClassName,
							)}
						/>
						<span
							aria-hidden
							className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[inherit] border border-transparent"
							style={borderGlowStyle}
						/>
						<span className="relative z-[3] inline-flex size-8 shrink-0 items-center justify-center">
							<Avatar shape="hexagon" size="default">
								<AvatarImage
									src={tile.iconSrc}
									alt=""
									className={cn("object-contain", tile.iconClassName)}
								/>
								<AvatarFallback>{tile.title.slice(0, 2).toUpperCase()}</AvatarFallback>
							</Avatar>
						</span>
						<span className="relative z-[3] flex w-full min-w-0 flex-col gap-1">
							<span className="block w-full min-w-0 text-sm font-semibold leading-5 text-text">
								{tile.title}
							</span>
							<span className="line-clamp-2 w-full min-w-0 text-sm leading-5 text-text-subtle">
								{tile.description}
							</span>
						</span>
					</button>
				))}
			</div>
		</div>
	);
}

export default function CardGlowDemo() {
	const [config, setConfig] = useState<CardGlowConfig>(CARD_GLOW_DEFAULT_CONFIG);
	const guiValues = useMemo<Record<string, unknown>>(() => ({ ...config }), [config]);

	const updateConfig = useCallback(<K extends keyof CardGlowConfig,>(
		key: K,
		value: CardGlowConfig[K],
	) => {
		setConfig((current) => ({ ...current, [key]: value }));
	}, []);

	return (
		<div className="flex w-full max-w-5xl flex-col" style={{ gap: token("space.400") }}>
			<CardGlowBento config={config} />

			<GUI.Panel title="Card glow controls" values={guiValues}>
				<GUI.Section title="Icon" borderTop={false}>
					<GUI.Control
						id="card-glow-icon-blur"
						label="blur"
						value={config.iconBlur}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.iconBlur}
						min={0}
						max={100}
						step={1}
						onChange={(next) => updateConfig("iconBlur", next)}
					/>
					<GUI.Control
						id="card-glow-icon-saturate"
						label="saturate"
						value={config.iconSaturate}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.iconSaturate}
						min={0}
						max={10}
						step={0.1}
						onChange={(next) => updateConfig("iconSaturate", next)}
					/>
					<GUI.Control
						id="card-glow-icon-brightness"
						label="brightness"
						value={config.iconBrightness}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.iconBrightness}
						min={0}
						max={4}
						step={0.1}
						onChange={(next) => updateConfig("iconBrightness", next)}
					/>
					<GUI.Control
						id="card-glow-icon-contrast"
						label="contrast"
						value={config.iconContrast}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.iconContrast}
						min={0}
						max={3}
						step={0.1}
						onChange={(next) => updateConfig("iconContrast", next)}
					/>
					<GUI.Control
						id="card-glow-icon-scale"
						label="scale"
						value={config.iconScale}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.iconScale}
						min={0}
						max={6}
						step={0.1}
						onChange={(next) => updateConfig("iconScale", next)}
					/>
					<GUI.Control
						id="card-glow-icon-opacity"
						label="opacity"
						value={config.iconOpacity}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.iconOpacity}
						min={0}
						max={1}
						step={0.01}
						onChange={(next) => updateConfig("iconOpacity", next)}
					/>
				</GUI.Section>

				<GUI.Section title="Border">
					<GUI.Control
						id="card-glow-border-spread"
						label="spread"
						value={config.borderSpread}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.borderSpread}
						min={24}
						max={240}
						step={1}
						onChange={(next) => updateConfig("borderSpread", next)}
					/>
					<GUI.Control
						id="card-glow-border-width"
						label="width"
						value={config.borderWidth}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.borderWidth}
						min={1}
						max={6}
						step={1}
						onChange={(next) => updateConfig("borderWidth", next)}
					/>
					<GUI.Control
						id="card-glow-border-blur"
						label="blur"
						value={config.borderBlur}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.borderBlur}
						min={0}
						max={100}
						step={1}
						onChange={(next) => updateConfig("borderBlur", next)}
					/>
					<GUI.Control
						id="card-glow-border-saturate"
						label="saturate"
						value={config.borderSaturate}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.borderSaturate}
						min={0}
						max={10}
						step={0.1}
						onChange={(next) => updateConfig("borderSaturate", next)}
					/>
					<GUI.Control
						id="card-glow-border-brightness"
						label="brightness"
						value={config.borderBrightness}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.borderBrightness}
						min={0}
						max={4}
						step={0.1}
						onChange={(next) => updateConfig("borderBrightness", next)}
					/>
					<GUI.Control
						id="card-glow-border-contrast"
						label="contrast"
						value={config.borderContrast}
						defaultValue={CARD_GLOW_DEFAULT_CONFIG.borderContrast}
						min={0}
						max={3}
						step={0.1}
						onChange={(next) => updateConfig("borderContrast", next)}
					/>
				</GUI.Section>

				<GUI.Section title="Render">
					<GUI.Toggle
						id="card-glow-exclude"
						label="exclude"
						checked={config.exclude}
						onChange={(next) => updateConfig("exclude", next)}
					/>
					<GUI.Toggle
						id="card-glow-css"
						label="css"
						checked={config.css}
						onChange={(next) => updateConfig("css", next)}
					/>
					<GUI.Select
						id="card-glow-theme"
						label="theme"
						value={config.theme}
						options={THEME_OPTIONS}
						onChange={(next) => updateConfig("theme", next)}
					/>
				</GUI.Section>
			</GUI.Panel>
		</div>
	);
}
