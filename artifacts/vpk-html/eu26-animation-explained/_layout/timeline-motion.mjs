export function createTimelineMotion(resolveMagneticAxisOffset) {
	const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
	const smooth = value => value * value * (3 - 2 * value);
	const marks = intervals => Array.from({ length: intervals + 1 }, (_, index) => ({ fraction: index / Math.max(1, intervals) }));
	const nearest = (items, fraction) => items.reduce((best, item, index) => Math.abs(item.fraction - fraction) < Math.abs(items[best].fraction - fraction) ? index : best, 0);
	const target = (point, rect) => {
		if (!point) return { x: 0, y: 0, amount: 0, center: 0 };
		const anchorX = rect.right - 8;
		const dx = Math.abs(point.x - anchorX);
		const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
		const amount = smooth(clamp(1 - (Math.hypot(dx, dy) - 20) / 26, 0, 1));
		return {
			x: 0,
			y: resolveMagneticAxisOffset(point.y - (rect.top + rect.bottom) / 2, (rect.bottom - rect.top) / 2, 3) * amount,
			amount,
			center: clamp((point.y - rect.top) / Math.max(1, rect.bottom - rect.top), 0, 1),
		};
	};
	const spring = () => ({ value: 0, velocity: 0 });
	const advance = (state, to, elapsed) => {
		let remaining = Math.min(0.05, elapsed);
		while (remaining > 0) {
			const dt = Math.min(1 / 240, remaining);
			state.velocity += (260 * (to - state.value) - 22 * state.velocity) / 0.55 * dt;
			state.value += state.velocity * dt;
			remaining -= dt;
		}
		const moving = Math.abs(state.value - to) > 0.001 || Math.abs(state.velocity) > 0.01;
		if (!moving) { state.value = to; state.velocity = 0; }
		return moving;
	};
	const pose = (mark, center, height, amount, active, baseLength = 14) => {
		const distance = Math.abs(mark.fraction - center) * height;
		const radius = clamp(height * 0.14, 56, 100);
		const glow = Math.exp(-((distance / radius) ** 2) / 0.65);
		const engagement = clamp(amount, 0, 1);
		const falloff = Math.max(0, 1 - distance / radius) ** 1.5;
		const length = baseLength + engagement * ((32 - baseLength) * falloff + 4 * (1 - falloff) * glow);
		return {
			scale: length / baseLength,
			offsetY: engagement ? (mark.fraction - 0.5) * 16 * engagement : 0,
			opacity: active ? 1 : 0.46 + 0.4 * engagement * glow,
		};
	};
	return { marks, nearest, target, spring, advance, pose };
}
