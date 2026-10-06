import { DEG, FALL, GRAVITY, HOLE, LINKS, REAR_DEPTH, RELEASE, STEPS, STRANDS, clamp, distance, duration, physicsDuration, swingCycles, swingPeriod, swingStart } from "./constants";
import { basis, cross, rotate, subtract, transform } from "./math";
import type { Axes, Pose, Simulation, Vec3 } from "./types";

interface Particle extends Vec3 {
	ox: number;
	oy: number;
	oz: number;
	w: number;
}

interface Constraint {
	a: Particle;
	b: Particle;
	length: number;
}

export function pose(time: number, amount = 1): Pose {
	const frame = stateAt(time, amount), [hinge, left, right] = frame.body;
	const body = basis(left, right, hinge, false), collar = body;
	return { x: hinge.x - 210, y: hinge.y - 306, z: hinge.z,
		angle: Math.atan2(body[0].y, body[1].y) / DEG,
		yaw: Math.asin(clamp(-body[0].z, -1, 1)) / DEG,
		pitch: Math.atan2(body[1].z, body[2].z) / DEG,
		strapAngle: Math.atan2(collar[0].y, collar[1].y) / DEG,
		strapYaw: Math.asin(clamp(-collar[0].z, -1, 1)) / DEG,
		strapPitch: Math.atan2(collar[1].z, collar[2].z) / DEG,
		body, collar, ropes: frame.ropes };
}

/** Simulations kept, one per swing amount; each is about 0.85 MB. */
const SIMULATIONS_KEPT = 3;
const simulations = new Map<number, Simulation>();
const simulationKey = (amount: number) => Math.round(clamp(amount, 0, 1.6) * 100) / 100;

/**
 * Hands in a drop simulated elsewhere (`simulate` is a long task, hundreds of
 * milliseconds per swing amount), so drawing that amount never runs it here.
 * See `primeLanyardPhysics`.
 */
export function primeSimulation(amount: number, simulation: Simulation) {
	simulations.set(simulationKey(amount), simulation);
	if (simulations.size > SIMULATIONS_KEPT) simulations.delete(simulations.keys().next().value!);
}

export function simulate(amount: number): Simulation {
	const key = simulationKey(amount);
	const cached = simulations.get(key);
	if (cached) return cached;
	const dt = 1 / STEPS, frames = physicsDuration * STEPS + 1;
	const particles: Particle[] = [], constraints: Constraint[] = [], chains: Particle[][] = [];
	function particle(v: Vec3, mass: number, velocity: Vec3 = { x: 0, y: 0, z: 0 }): Particle {
		const p = { ...v, ox: v.x - velocity.x * dt, oy: v.y - velocity.y * dt, oz: v.z - velocity.z * dt, w: mass ? 1 / mass : 0 };
		particles.push(p); return p;
	}
	function joint(a: Particle, b: Particle, length = distance(a, b)) { constraints.push({ a, b, length }); }
	const motion = key * .35;
	const initial = { x: 210 + 138 * motion, y: 306 - FALL, z: -95 * motion };
	const bodyRotation: [number, number, number] = [-31 * motion, -78 * motion, 21 * motion];
	const localBody = [{ x: 0, y: 0, z: 0 }, { x: -210, y: 567, z: 0 }, { x: 210, y: 567, z: 0 },
		{ x: -6, y: -133, z: 0 }, { x: 6, y: -133, z: 0 }];
	const body = localBody.map((v, i) => {
		const r = rotate(v, ...bodyRotation);
		// A small initial angular velocity becomes visible as the card clears the frame.
		const spin = cross({ x: -.12 * motion, y: .32 * motion, z: .5 * motion }, r);
		return particle({ x: initial.x + r.x, y: initial.y + r.y, z: initial.z + r.z }, i === 0 ? .24 : i < 3 ? .5 : .06,
			{ x: -135 * motion + spin.x, y: spin.y, z: 135 * motion + spin.z });
	});
	// The original ring and clasp are one connected object. Keep every hardware
	// anchor in the badge's rigid frame; the cloth above supplies the flexibility.
	for (let a = 0; a < body.length; a++) for (let b = a + 1; b < body.length; b++) joint(body[a], body[b]);
	STRANDS.forEach((strand, strandIndex) => {
		const start = strand.anchor, end = body[strand.rear ? 4 : 3], length = strand.length / LINKS;
		function folded(amplitude: number) {
			return Array.from({ length: LINKS + 1 }, (_, i) => {
				const q = i / LINKS, envelope = Math.sin(Math.PI * q);
				return { x: start.x + (end.x - start.x) * q + amplitude * envelope * Math.sin(q * Math.PI * 4 + strandIndex * .7),
					y: start.y + (end.y - start.y) * q,
					z: start.z + (end.z - start.z) * q + amplitude * envelope * Math.cos(q * Math.PI * 4 + strandIndex * .7) };
			});
		}
		let lo = 0, hi = 400;
		for (let j = 0; j < 24; j++) {
			const mid = (lo + hi) / 2, points = folded(mid);
			const len = points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
			if (len < strand.length) lo = mid; else hi = mid;
		}
		const chain = folded((lo + hi) / 2).map((v, i) => i === LINKS ? end : particle(v, i === 0 ? 0 : .014,
			{ x: -135 * motion * i / LINKS, y: 0, z: 135 * motion * i / LINKS }));
		for (let i = 0; i < LINKS; i++) joint(chain[i], chain[i + 1], length);
		chains.push(chain);
	});
	const data = new Float32Array(frames * particles.length * 3), count = particles.length;
	function solve(a: Particle, b: Particle, rest: number, maximum = false) {
		const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
		const length = Math.hypot(dx, dy, dz) || .0001;
		if (maximum && length <= rest) return;
		const c = (length - rest) / (length * (a.w + b.w));
		a.x += dx * c * a.w; a.y += dy * c * a.w; a.z += dz * c * a.w;
		b.x -= dx * c * b.w; b.y -= dy * c * b.w; b.z -= dz * c * b.w;
	}
	function constrain(iterations: number) {
		for (let j = 0; j < iterations; j++) {
			// Long-range unilateral limits carry the catch impulse through the light
			// cloth immediately, rather than allowing a stretched chain to converge.
			chains.forEach((chain, s) => {
				for (let i = LINKS; i > 1; i--) solve(chain[0], chain[i], STRANDS[s].length * i / LINKS, true);
			});
			for (let k = 0; k < constraints.length; k++) {
				const c = constraints[j % 2 ? constraints.length - 1 - k : k];
				solve(c.a, c.b, c.length);
			}
		}
	}
	const initialVelocities = particles.map(p => ({ x: p.x - p.ox, y: p.y - p.oy, z: p.z - p.oz }));
	constrain(100);
	particles.forEach((p, i) => { p.ox = p.x - initialVelocities[i].x; p.oy = p.y - initialVelocities[i].y; p.oz = p.z - initialVelocities[i].z; });
	for (let frame = 0; frame < frames; frame++) {
		const t = frame * dt;
		if (frame && t > RELEASE) {
			const axes = basis(body[1], body[2], body[0], false);
			const [oldLeft, oldRight, oldHinge] = [body[1], body[2], body[0]].map((p) => ({ x: p.ox, y: p.oy, z: p.oz }));
			const oldAxes = basis(oldLeft, oldRight, oldHinge, false);
			const yaw = Math.atan2(-axes[0].z, axes[0].x);
			const oldYaw = Math.atan2(-oldAxes[0].z, oldAxes[0].x);
			const yawVelocity = Math.atan2(Math.sin(yaw - oldYaw), Math.cos(yaw - oldYaw)) / dt;
			// The flat weave resists torsion. Gravity supplies pitch/roll torque;
			// only yaw needs a weak restoring moment to face the audience again.
			const tension = Math.max(...chains.map((chain, i) => clamp((distance(chain[0], chain[LINKS]) / STRANDS[i].length - .92) / .08, 0, 1)));
			const yawAcceleration = tension * (-11 * yaw - 2.8 * yawVelocity);
			const center = { x: (body[1].x + body[2].x) / 2, z: (body[1].z + body[2].z) / 2 };
			for (let i = 0; i < particles.length; i++) {
				const p = particles[i]; if (!p.w) continue;
				const damping = Math.exp(-(i < 5 ? (t < 1.0 ? .24 : 2.4) : 1.8) * dt);
				const vx = (p.x - p.ox) * damping, vy = (p.y - p.oy) * damping, vz = (p.z - p.oz) * damping;
				p.ox = p.x; p.oy = p.y; p.oz = p.z;
				const torsion = i < 3 ? yawAcceleration : 0;
				p.x += vx + torsion * (p.z - center.z) * dt * dt;
				p.y += vy + GRAVITY * dt * dt;
				p.z += vz - torsion * (p.ox - center.x) * dt * dt;
			}
			constrain(t < 1.25 ? 144 : 64);
		}
		particles.forEach((p, i) => { const n = (frame * count + i) * 3; data[n] = p.x; data[n + 1] = p.y; data[n + 2] = p.z; });
	}
	const result = { data, count, body: body.map(p => particles.indexOf(p)), chains: chains.map(c => c.map(p => particles.indexOf(p))) };
	primeSimulation(key, result);
	return result;
}
function stateAt(time: number, amount = 1) {
	const sim = simulate(amount), raw = clamp(time, 0, physicsDuration) * STEPS;
	const frame = Math.floor(raw), next = Math.min(physicsDuration * STEPS, frame + 1), mix = raw - frame;
	function read(i: number): Vec3 {
		const a = (frame * sim.count + i) * 3, b = (next * sim.count + i) * 3;
		return { x: sim.data[a] + (sim.data[b] - sim.data[a]) * mix,
			y: sim.data[a + 1] + (sim.data[b + 1] - sim.data[a + 1]) * mix,
			z: sim.data[a + 2] + (sim.data[b + 2] - sim.data[a + 2]) * mix };
	}
	return { body: sim.body.map(read), ropes: sim.chains.map(chain => chain.map(read)) };
}

const cardMotions = new Map<number, Float32Array>();
export function ambientSwing(time: number) {
	const blend = clamp((time - .85) / 1.5, 0, 1);
	const envelope = blend * blend * (3 - 2 * blend);
	// Two complete cycles about vertical, with a smooth loss of amplitude.
	// Zero envelope and velocity at the end leave an exactly stationary card.
	const progress = clamp((time - swingStart) / (swingPeriod * swingCycles), 0, 1);
	const decay = 1 - progress * progress * (3 - 2 * progress);
	const phase = (time - swingStart) * Math.PI * 2 / swingPeriod;
	return { envelope, angle: time >= duration ? 0 : envelope * decay * Math.cos(phase) };
}
function rearAngle(time: number, amount: number, revealAngle?: number) {
	const key = Math.round(clamp(amount, 0, 1.6) * 100) / 100;
	let frames = cardMotions.get(key);
	if (!frames) {
		const angles = new Float32Array(physicsDuration * STEPS + 1);
		let angle = 20 - 12 * key, velocity = 0, lastRoll = null, lastVelocity = 0;
		for (let i = 0; i < angles.length; i++) {
			const b = stateAt(i / STEPS, key).body;
			const roll = Math.atan2(b[2].y - b[1].y, b[2].x - b[1].x) / DEG;
			const baseVelocity = lastRoll === null ? 0 : (roll - lastRoll) * STEPS;
			const acceleration = i < 2 ? 0 : clamp((baseVelocity - lastVelocity) * STEPS, -180, 180);
			// Torsional resistance of two cards resting against the closed hook.
			const release = clamp((i / STEPS - .62) / .2, 0, 1);
			const target = 20 - 12 * key * (1 - release * release * (3 - 2 * release));
			velocity += (-28 * (angle - target) - 7 * velocity - .55 * acceleration) / STEPS;
			angle += velocity / STEPS; angles[i] = angle;
			lastRoll = roll; lastVelocity = baseVelocity;
		}
		cardMotions.set(key, angles);
		if (cardMotions.size > 3) cardMotions.delete(cardMotions.keys().next().value!);
		frames = angles;
	}
	const raw = clamp(time, 0, physicsDuration) * STEPS, i = Math.floor(raw);
	const settled = frames[i] + (frames[Math.min(frames.length - 1, i + 1)] - frames[i]) * (raw - i);
	// Preserve the catch, then fade out its opening offset completely so the
	// diminishing pendulum stays centered on vertical as the cards swap sides.
	const sway = ambientSwing(time);
	// The reveal changes only the opening during the drop and catch. Its
	// influence fades out as the original two-cycle settling swing takes over.
	const degrees = revealAngle !== undefined && Number.isFinite(revealAngle) ? clamp(revealAngle, 0, 45) : 10;
	return settled / 2 * (1 - sway.envelope) * (degrees / 10) + sway.angle * 10 * key;
}
export function attachment(time: number, amount: number, p: Pose = pose(time, amount), revealAngle?: number) {
	const origin = { x: 210 + p.x, y: 306 + p.y, z: p.z };
	const angle = rearAngle(time, amount, revealAngle);
	const frontAngle = -angle;
	const axesFor = (a: number): Axes => [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]
		.map((v) => transform(rotate(v, a, 0, 0), p.body)) as unknown as Axes;
	const rearAxes = axesFor(angle), frontAxes = axesFor(frontAngle);
	const world = (v: Vec3, axes: Axes = p.body, at: Vec3 = origin): Vec3 => {
		const r = transform(v, axes); return { x: at.x + r.x, y: at.y + r.y, z: at.z + r.z };
	};
	const pivot = world(HOLE);
	const rearPivot = world({ ...HOLE, z: REAR_DEPTH });
	const offset = transform(HOLE, rearAxes), rearOrigin = subtract(rearPivot, offset);
	const frontOrigin = subtract(pivot, transform(HOLE, frontAxes));
	return { origin, frontOrigin, frontAxes, frontAngle, rearOrigin, rearAxes, pivot, rearPivot, angle, world };
}
export function inspectAttachment(time: number, amount = 1, revealAngle?: number) {
	const p = pose(time, amount), a = attachment(time, amount, p, revealAngle);
	const actualRear = a.world(HOLE, a.rearAxes, a.rearOrigin);
	const actualFront = a.world(HOLE, a.frontAxes, a.frontOrigin);
	return { frontHole: actualFront, rearHole: actualRear,
		sharedAxisError: Math.max(distance(actualRear, a.rearPivot), distance(actualFront, a.pivot)), cardClearance: -REAR_DEPTH - 3.4,
		fanAngle: a.angle, frontAngle: a.frontAngle, frontOrigin: a.frontOrigin, frontAxes: a.frontAxes,
		ribbonOrder: ['right-rear', 'left-front'] };
}

export function inspectPhysics(time: number, amount = 1) {
	const p = pose(time, amount);
	return STRANDS.map((strand, i) => {
		const points = p.ropes[i], rest = strand.length / LINKS;
		const segments = points.slice(1).map((v, j) => distance(points[j], v));
		return { restLength: strand.length, length: segments.reduce((a, b) => a + b, 0), maxSegmentStrain: Math.max(...segments.map(n => Math.abs(n - rest) / rest)) };
	});
}
