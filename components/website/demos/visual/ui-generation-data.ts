export type Period = "1H" | "1D" | "1W" | "1M";

export const PERIODS: readonly Period[] = ["1H", "1D", "1W", "1M"];

export interface Candle {
	readonly open: number;
	readonly close: number;
	readonly high: number;
	readonly low: number;
}

interface PeriodSeries {
	readonly label: string;
	readonly change: number;
	readonly seed: number;
	readonly drift: number;
}

const SERIES: Record<Period, PeriodSeries> = {
	"1H": { label: "Past hour", change: 0.6, seed: 3, drift: 0.15 },
	"1D": { label: "Past day", change: 2.4, seed: 11, drift: 0.55 },
	"1W": { label: "Past week", change: -3.1, seed: 29, drift: -0.6 },
	"1M": { label: "Past month", change: 8.2, seed: 47, drift: 0.9 },
};

export const CANDLE_COUNT = 22;

/** Deterministic 0..1 noise, so the chart is identical on the server, the client and every replay. */
function noise(x: number): number {
	const v = Math.sin(x * 91.7 + 17.3) * 43758.5453;
	return v - Math.floor(v);
}

/** A random walk of candles for one period, normalised to 0..1 of the chart height. */
export function candlesFor(period: Period): Candle[] {
	const { seed, drift } = SERIES[period];
	const raw: Candle[] = [];
	let price = 0;
	for (let i = 0; i < CANDLE_COUNT; i++) {
		const open = price;
		const close = open + drift + (noise(seed + i) - 0.5) * 3;
		const high = Math.max(open, close) + noise(seed * 2 + i) * 1.2;
		const low = Math.min(open, close) - noise(seed * 3 + i) * 1.2;
		raw.push({ open, close, high, low });
		price = close;
	}
	const min = Math.min(...raw.map((c) => c.low));
	const max = Math.max(...raw.map((c) => c.high));
	const scale = (v: number) => (v - min) / (max - min || 1);
	return raw.map((c) => ({ open: scale(c.open), close: scale(c.close), high: scale(c.high), low: scale(c.low) }));
}

export function periodLabel(period: Period): string {
	return SERIES[period].label;
}

export function periodChange(period: Period): number {
	return SERIES[period].change;
}

export const PROFILE_STATS = [
	{ label: "Followers", value: 12480 },
	{ label: "Following", value: 318 },
	{ label: "Projects", value: 46 },
] as const;
