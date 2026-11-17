import { motionDuration } from "@/lib/motion";

type FlightRect = Readonly<{ left: number; top: number; width: number; height: number }>;
type Viewport = Readonly<{ width: number; height: number }>;
type Frame = Readonly<{ offset: number; x: number; y: number; scale: number; scaleX: number; scaleY: number; width: number; height: number; transform: string }>;
type FlightGeometry = Readonly<{ source: FlightRect; destination: FlightRect; viewport: Viewport }>;

const MARGIN = 8;
const SCALE_PEAK = 0.52;
const OVERSHOOT_PEAK = 0.82;
// Lead the shared trace's SVG setup/envelope so its first visible stroke meets the approach.
const TRACE_START = 0.46;
// The reference's lift and return are one gesture, slightly longer than the largest ADS token.
const DURATION_MS = motionDuration.slowest * 1.2 * 1_000;

const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const smooth = (value: number) => value ** 3 * (value * (value * 6 - 15) + 10);

function frameAt({ source, destination }: FlightGeometry, offset: number, direction: number, strength: number): Frame {
	const dx = destination.left + destination.width / 2 - source.left - source.width / 2;
	const dy = destination.top + destination.height / 2 - source.top - source.height / 2;
	const distance = Math.hypot(dx, dy);
	const travel = Math.min(offset / OVERSHOOT_PEAK, 1);
	const progress = smooth(travel ** 0.85);
	const returnProgress = Math.max(0, (offset - OVERSHOOT_PEAK) / (1 - OVERSHOOT_PEAK));
	const overshoot = Math.min(14, distance * 0.1) * (offset < OVERSHOOT_PEAK ? smooth(travel) : 1 - smooth(returnProgress)) * strength;
	const bend = Math.min(96, distance * 0.16) * Math.sin(Math.PI * travel) ** 2 * direction * strength;
	const scale = 1 + 0.15 * (offset < SCALE_PEAK ? smooth(offset / SCALE_PEAK) : 1 - smooth((offset - SCALE_PEAK) / (1 - SCALE_PEAK))) * strength;
	const width = mix(source.width, destination.width, progress) * scale;
	const height = mix(source.height, destination.height, progress) * scale;
	const x = mix(source.left + source.width / 2, destination.left + destination.width / 2, progress) + (dx * overshoot - dy * bend) / (distance || 1) - width / 2;
	const y = mix(source.top + source.height / 2, destination.top + destination.height / 2, progress) + (dy * overshoot + dx * bend) / (distance || 1) - height / 2;
	const scaleX = width / source.width;
	const scaleY = height / source.height;
	return { offset, x, y, scale, scaleX, scaleY, width, height, transform: `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})` };
}

function allowedStrength(geometry: FlightGeometry, offsets: readonly number[], direction: number) {
	let strength = 1;
	for (const offset of offsets) {
		const base = frameAt(geometry, offset, direction, 0);
		const full = frameAt(geometry, offset, direction, 1);
		for (const [start, end, limit] of [
			[base.x, full.x, MARGIN],
			[base.y, full.y, MARGIN],
			[geometry.viewport.width - base.x - base.width, geometry.viewport.width - full.x - full.width, MARGIN],
			[geometry.viewport.height - base.y - base.height, geometry.viewport.height - full.y - full.height, MARGIN],
		]) {
			if (end < limit) strength = Math.min(strength, Math.max(0, (start - limit) / (start - end)));
		}
	}
	return strength;
}

export function planSessionMentionFlight(geometry: FlightGeometry) {
	const { source, destination, viewport } = geometry;
	if ([source, destination].some((rect) => rect.width <= 0 || rect.height <= 0 || rect.left < MARGIN || rect.top < MARGIN || rect.left + rect.width > viewport.width - MARGIN || rect.top + rect.height > viewport.height - MARGIN)) return null;
	if (Math.hypot(source.left - destination.left, source.top - destination.top) < 2) return null;
	const steps = Math.ceil(DURATION_MS / 8);
	const offsets = [...new Set([0, SCALE_PEAK, OVERSHOOT_PEAK, TRACE_START, 1, ...Array.from({ length: steps }, (_, index) => index / steps)])].sort((a, b) => a - b);
	const clockwise = allowedStrength(geometry, offsets, -1);
	const counterclockwise = allowedStrength(geometry, offsets, 1);
	const direction = counterclockwise >= clockwise ? 1 : -1;
	const strength = Math.max(clockwise, counterclockwise);
	return {
		durationMs: DURATION_MS,
		settleOffset: OVERSHOOT_PEAK,
		traceOffset: TRACE_START,
		frames: offsets.map((offset) => frameAt(geometry, offset, direction, strength)),
	};
}
