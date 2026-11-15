import type { ComponentType, ReactNode } from "react";

export const CHART_THEMES = {
	light: "",
	dark: ".dark",
} as const;

type ChartThemeName = keyof typeof CHART_THEMES;

export type ChartConfigItem = {
	label?: ReactNode;
	icon?: ComponentType;
	color?: string;
	theme?: Partial<Record<ChartThemeName, string>>;
};

export type ChartConfig = Record<string, ChartConfigItem>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeThemeRecord(
	value: unknown,
): Partial<Record<ChartThemeName, string>> | undefined {
	if (!isObjectRecord(value)) {
		return undefined;
	}

	const result: Partial<Record<ChartThemeName, string>> = {};
	for (const themeName of Object.keys(CHART_THEMES) as ChartThemeName[]) {
		const themeValue = value[themeName];
		if (typeof themeValue === "string" && themeValue.trim().length > 0) {
			result[themeName] = themeValue;
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Recharts' ResponsiveContainer logs a "width(0) and height(0)" warning and
 * fails to render when it is measured at zero size — which happens whenever a
 * chart is mounted inside a hidden container (e.g. an inactive `keepMounted`
 * tab panel, a collapsed accordion, an off-screen slide). Gate the
 * ResponsiveContainer render on this check so Recharts is only ever
 * initialized once the wrapper has a real layout box.
 */
export function hasRenderableChartSize(
	width: number | null | undefined,
	height: number | null | undefined,
): boolean {
	return (
		typeof width === "number" &&
		typeof height === "number" &&
		Number.isFinite(width) &&
		Number.isFinite(height) &&
		width > 0 &&
		height > 0
	);
}

export function getChartColorConfigEntries(
	config: unknown,
): Array<[string, ChartConfigItem]> {
	if (!isObjectRecord(config)) {
		return [];
	}

	const entries: Array<[string, ChartConfigItem]> = [];
	for (const [key, rawItem] of Object.entries(config)) {
		if (!isObjectRecord(rawItem)) {
			continue;
		}

		const color =
			typeof rawItem.color === "string" && rawItem.color.trim().length > 0
				? rawItem.color
				: undefined;
		const theme = normalizeThemeRecord(rawItem.theme);
		if (!color && !theme) {
			continue;
		}

		entries.push([
			key,
			{
				label: rawItem.label as ReactNode,
				icon: rawItem.icon as ComponentType | undefined,
				...(color ? { color } : {}),
				...(theme ? { theme } : {}),
			},
		]);
	}

	return entries;
}

/**
 * Recharts' default accessibility layer makes every chart surface a focusable
 * `role="application"` with no accessible name, so a page of charts reads as a
 * run of unnamed tab stops. Name the surface from an explicit label, or else
 * from the series labels in the chart config.
 */
export function getChartAccessibleLabel(
	config: ChartConfig | null | undefined,
	explicitLabel?: string,
): string {
	if (explicitLabel?.trim()) {
		return explicitLabel;
	}
	const labels = isObjectRecord(config)
		? Object.values(config)
				.map((item) => (isObjectRecord(item) && typeof item.label === "string" ? item.label.trim() : ""))
				.filter((label) => label.length > 0)
		: [];
	if (labels.length === 0) {
		return "Chart";
	}
	return `Chart: ${new Intl.ListFormat("en-US", { type: "conjunction" }).format(labels)}`;
}
