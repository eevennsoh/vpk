import { FLASH_ROVO_COLORS } from "./finale-column-flash";

/** Motion's React confetti example, adapted to two viewport corner cannons.
 * https://motion.dev/examples/react-confetti
 * Physics derived from canvas-confetti, Copyright (c) 2020 Kiril Vatev, ISC.
 * Precomputed transform/opacity keyframes keep the burst off React's frame loop.
 */
// Motion accepts seconds, so use the resolved VPK duration values. The token
// contract test checks these against app/tailwind-theme.css to prevent drift.
const MOTION_DURATION = {
	slower: 0.4, // --duration-slower (motion.duration.xlong)
	slowest: 0.6, // --duration-slowest (motion.duration.xxlong)
} as const;
export const FINALE_CONFETTI_DURATION = MOTION_DURATION.slowest * 2;
const FADE_DURATION = MOTION_DURATION.slower * 2;
const PARTICLES_PER_CORNER = 180;
const STEPS = 40;
const SHAPES = ["circle", "rect", "rect", "strip", "strip"] as const;

export interface FinaleConfettiParticle {
	readonly corner: "left" | "right";
	readonly color: string;
	readonly width: number;
	readonly height: number;
	readonly radius: number;
	readonly keyframes: { transform: string[]; opacity: number[] };
}

export function createFinaleConfettiBurst(viewportHeight: number, random = Math.random): FinaleConfettiParticle[] {
	const velocityScale = viewportHeight / 900;
	return Array.from({ length: PARTICLES_PER_CORNER * 2 }, (_, index) => {
		const corner = index < PARTICLES_PER_CORNER ? "left" : "right";
		// A forceful broad diagonal fan that fills more of the screen.
		const angle = ((corner === "left" ? -60 : -120) + (0.5 - random()) * 70) * Math.PI / 180;
		// One third travels gently and falls more slowly, keeping a visible
		// trail near each origin while the stronger pieces spread across the page.
		const gentle = index % 3 === 2;
		let velocity = 36 * velocityScale * (gentle ? 0.16 + random() * 0.3 : 0.5 + random());
		const gravity = (gentle ? 0.65 : 1.95) * velocityScale;
		const wobbleSpeed = Math.min(0.11, random() * 0.1 + 0.05);
		let wobble = random() * 10;
		const size = 6 + random() * 6;
		const tiltRotations = 2 + random() * 4;
		const rotation = random() * 360;
		const shape = SHAPES[Math.floor(random() * SHAPES.length)];
		const transform: string[] = [];
		const opacity: number[] = [];
		let x = 0;
		let y = 0;
		let tick = 0;
		for (let step = 0; step <= STEPS; step++) {
			const t = step / STEPS;
			const targetTick = Math.round(t * FINALE_CONFETTI_DURATION * 60);
			while (tick < targetTick) {
				x += Math.cos(angle) * velocity;
				y += Math.sin(angle) * velocity + gravity;
				velocity *= 0.96;
				wobble += wobbleSpeed;
				tick++;
			}
			const wx = step === 0 ? 0 : x + Math.cos(wobble) * 15;
			const scale = t < 0.048 ? t / 0.048 * 1.15 : t < 0.08 ? 1.15 - (t - 0.048) / 0.032 * 0.15 : 1;
			transform.push(`translate(${wx}px, ${y}px) scale(${scale}) rotateY(${tiltRotations * 360 * t}deg) rotate(${rotation}deg)`);
			// Begin fading during the flight, with a long tail and no abrupt cut.
			opacity.push(Math.min(1, (1 - t) * FINALE_CONFETTI_DURATION / FADE_DURATION));
		}
		return {
			corner,
			color: FLASH_ROVO_COLORS[index % FLASH_ROVO_COLORS.length],
			width: shape === "strip" ? size * 0.3 : shape === "rect" ? size * 0.7 : size,
			height: shape === "strip" ? size * 2 : size,
			radius: shape === "circle" ? size / 2 : shape === "strip" ? size * 0.12 : 2,
			keyframes: { transform, opacity },
		};
	});
}
