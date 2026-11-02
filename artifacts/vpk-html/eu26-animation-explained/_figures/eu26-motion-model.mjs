export const motionConfig = {
	seed: 26031,
	wall: { start: 27, velocity: [-32, -8], repeatX: 3, helperStart: 35, helperPeriod: 12 },
};

export function createWallField(data) {
	const camera = data.cameraKeys[data.cameraKeys.length - 1], center = [...camera.at];
	const periodX = 3800, periodY = 3800, gutter = 22;
	const random = (i, channel) => {
		const value = Math.sin((i + 1) * 127.1 + channel * 311.7 + (data.motion?.seed ?? 26031) * 0.013) * 43758.5453;
		return value - Math.floor(value);
	};
	const delta = (a, b, period) => a - b - Math.round((a - b) / period) * period;
	const wrap = (value, axis, period) => value - Math.floor((value - center[axis] + period / 2) / period) * period;
	const pinned = new Set(data.actors.map(actor => actor.slotKey));
	const positions = data.wall.map(() => null), occupied = [];
	const place = (card, index, at) => {
		positions[index] = at;
		occupied.push({ at, w: card.w, d: card.d });
	};
	data.wall.forEach((card, index) => {
		if (card.reserved !== undefined || pinned.has(card.key)) place(card, index, [card.at[0] + card.w / 2, card.at[1] + card.d / 2, card.at[2]]);
	});
	data.wall.forEach((card, index) => {
		if (positions[index]) return;
		const gap = gutter + random(index, 22) * 24;
		const goal = [center[0] + (((index * 0.61803398875 + random(index, 23) * 0.07) % 1) - 0.5) * periodX, center[1] + (((index * 0.41421356237 + random(index, 24) * 0.07) % 1) - 0.5) * periodY];
		const candidates = [];
		const add = (x, y, edge = false) => {
			const at = [wrap(x, 0, periodX), wrap(y, 1, periodY), 0];
			const dx = delta(at[0], goal[0], periodX), dy = delta(at[1], goal[1], periodY);
			candidates.push({ at, score: dx * dx + dy * dy - (edge ? 320 * 320 : 0) });
		};
		add(goal[0], goal[1]);
		for (const rect of occupied) {
			for (const side of [-1, 1]) {
				const x = rect.at[0] + side * ((rect.w + card.w) / 2 + gap);
				const y = rect.at[1] + side * ((rect.d + card.d) / 2 + gap);
				for (const align of [-1, 0, 1]) {
					add(x, rect.at[1] + align * (rect.d - card.d) / 2, true);
					add(rect.at[0] + align * (rect.w - card.w) / 2, y, true);
				}
			}
		}
		for (let attempt = 0; attempt < 48; attempt += 1) add(center[0] + (random(index, 25 + attempt * 2) - 0.5) * periodX, center[1] + (random(index, 26 + attempt * 2) - 0.5) * periodY);
		candidates.sort((a, b) => a.score - b.score);
		const chosen = candidates.find(candidate => !occupied.some(rect => Math.abs(delta(candidate.at[0], rect.at[0], periodX)) < (card.w + rect.w) / 2 + gap && Math.abs(delta(candidate.at[1], rect.at[1], periodY)) < (card.d + rect.d) / 2 + gap));
		if (!chosen) throw new Error("No free native-size wall position for " + card.key);
		place(card, index, chosen.at);
	});
	return { layout: "single-masonry", positions, periodX, periodY, center, gutter, sourceCount: data.wall.length };
}

export function model(input, data) {
	const options = input !== null && typeof input === "object" ? input : { time: input };
	const time = Math.max(0, Number.isFinite(Number(options.time)) ? Number(options.time) : 0);
	const variant = data.variants.some(each => each.id === options.variant) ? options.variant : "paper";
	const clamp = x => Math.max(0, Math.min(1, x));
	const ease = x => { const u = clamp(x); return u * u * (3 - 2 * u); };
	const cameraEase = x => { const u = clamp(x); return u * u * u * (u * (u * 6 - 15) + 10); };
	const projectionScale = (options.projectionScale ?? data.motion?.projectionScale ?? 0.8692407110335721) * Math.sqrt(1.6);
	const mix = (a, b, s) => a + (b - a) * s;
	const between = (a, b, s) => a.map((v, i) => mix(v, b[i], s));
	const pose = (at, rot = [0, 0, 0], scale = 1, alpha = 1, highlight = 0) => ({ at, rot, scale, alpha, highlight });
	const random = (i, channel = 0) => {
		const value = Math.sin((i + 1) * 127.1 + channel * 311.7 + (data.motion?.seed ?? 26031) * 0.013) * 43758.5453;
		return value - Math.floor(value);
	};
	const turn = (vector, angles) => {
		let [x, y, z] = vector;
		const [rx, ry, rz] = angles;
		[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
		[x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
		return [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz), z];
	};
	const surfacePoint = (posed, w, d, kind, grip) => {
		const offset = turn([(grip.u - 0.5) * w * posed.scale, (grip.v - 0.5) * d * (posed.scaleY ?? posed.scale), data.materialDepths[variant][kind] * posed.scale], posed.rot);
		return posed.at.map((value, i) => value + offset[i]);
	};
	let index = 0;
	while (index < data.states.length - 1 && time >= data.states[index + 1].time) index += 1;
	let cameraIndex = 0;
	while (cameraIndex < data.cameraKeys.length - 2 && time > data.cameraKeys[cameraIndex + 1].time) cameraIndex += 1;
	const ca = data.cameraKeys[cameraIndex], cb = data.cameraKeys[cameraIndex + 1];
	const cs = cameraEase((time - ca.time) / (cb.time - ca.time));
	const width = ca.width === cb.width ? ca.width : Math.exp(mix(Math.log(ca.width), Math.log(cb.width), cs));
	const camera = { at: between(ca.at, cb.at, cs), width, height: width * 760 / 1200, azimuth: mix(ca.azimuth, cb.azimuth, cs), elevation: mix(ca.elevation, cb.elevation, cs) };
	const fieldAt = i => {
		if (i === 15) return [-15, -28, 96];
		const angle = i * 2.39996 + (random(i, 1) - 0.5) * 0.7;
		const radius = 190 + Math.sqrt(i + 1) * 100 + (random(i, 2) - 0.5) * 150;
		return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66 - 25, 35 + random(i, 3) * 245];
	};
	const cards = data.cards.map((card, i) => {
		const home = [card.home[0] + card.w / 2, card.home[1] + card.d / 2, card.home[2]];
		const row = data.doneList.cards.find(row => row.card === i);
		const done = [row.x + row.w / 2, row.y + row.d / 2, 4], inWindow = row.rank < 3;
		let at = home, rot = [0, 0, 0], alpha = card.row < 3 ? 1 : 0;
		if (i === 15 && time > 0) {
			const s = ease(time / 2);
			at = between(home, done, s);
			at[2] += Math.sin(s * Math.PI) * 95;
			rot = [0, Math.sin(s * Math.PI) * 0.2, Math.sin(s * Math.PI) * -0.18];
		}
		if (time > 4.3 && inWindow) {
			const s = ease((time - 4.3 - (row.rank === 2 ? 0.14 : 0)) / 1.2);
			at = between(i === 15 ? done : home, done, s);
			at[2] += Math.sin(s * Math.PI) * (i === 15 ? 0 : 75);
			alpha = 1;
		}
		if (time > 13) {
			const delay = i === 15 ? 0 : random(i, 4) * 0.18;
			const u = clamp((time - 13 - delay) / (2.88 - delay)), s = ease(u), impulse = u * (1 - u) ** 2 * 4;
			at = between(inWindow ? done : home, fieldAt(i), s);
			const velocity = [(random(i, 5) - 0.5) * 520, (random(i, 6) - 0.5) * 420, 180 + random(i, 7) * 350];
			velocity[0] += i === 17 ? 160 : i === 20 ? 140 : 0;
			at = at.map((value, axis) => value + velocity[axis] * impulse * (i === 15 ? 0.28 : 1));
			const pitch = (random(i, 8) - 0.5) * 1.05, yaw = (random(i, 9) - 0.5) * 1.1;
			rot = i === 15 ? [0, 0, 0] : [pitch * s + Math.sin(u * Math.PI) * (random(i, 10) - 0.5) * 1.8, yaw * s + Math.sin(u * Math.PI) * (random(i, 11) - 0.5) * 2.1, (random(i, 12) - 0.5) * 0.9 * s];
			alpha = mix(inWindow || card.row < 3 ? 1 : 0, 1, ease(u / 0.32));
		}
		if (time > 19) alpha *= 1 - ease((time - 19) / 1.2);
		const highlight = i === 15 ? 1 : ease((time - 4.3) / 1.2) * (1 - ease((time - 13.2) / 2.5));
		return { ...pose(at, rot, 1, alpha, highlight), clip: time <= 13 && inWindow && ((i === 15 && time >= 2) || (i !== 15 && time >= 5.5)), listAt: done, rank: row.rank, listVisible: inWindow };
	});
	const field = data.wallField, periodX = field?.periodX ?? 3800, periodY = field?.periodY ?? 3800;
	const lastShot = data.cameraKeys[data.cameraKeys.length - 1], lastCamera = { ...lastShot, height: lastShot.width * 760 / 1200 };
	const wallStart = data.motion?.wall?.start ?? 27, velocityX = data.motion?.wall?.velocity?.[0] ?? -32;
	const wallPeriod = periodX / Math.abs(velocityX) * (data.motion?.wall?.repeatX ?? 3);
	const wallVelocity = [velocityX, -periodY / wallPeriod];
	const wallShift = atTime => {
		const initial = Math.max(0, Math.min(atTime, wallStart) - 24), tail = Math.max(0, atTime - wallStart);
		const blend = Math.min(tail, 3), integral = blend - blend ** 3 / 9 + blend ** 4 / 54;
		return [-20 * initial + wallVelocity[0] * tail + (-20 - wallVelocity[0]) * integral, 5.6 * initial + wallVelocity[1] * tail + (5.6 - wallVelocity[1]) * integral, 0];
	};
	const shift = wallShift(time);
	const tiles = data.features.map((feature, i) => {
		const target = [feature.at[0] + feature.w / 2, feature.at[1] + feature.d / 2, feature.at[2]];
		const s = ease((time - 19 - i * 0.24) / 1.55), from = i === 0 ? [-15, -28, 96] : fieldAt(feature.card);
		let at = between(from, target, s);
		at[2] += Math.sin(s * Math.PI) * 150;
		let rot = [(1 - s) * (i % 2 ? -0.5 : 0.5), (1 - s) * -0.45, (1 - s) * (i % 2 ? -0.5 : 0.5)];
		let scale = mix(0.82, 1, s), scaleY = scale, alpha = ease((time - 19 - i * 0.2) / 0.5);
		if (time > 22.4) {
			const toss = ease((time - 22.4 - i * 0.07) / 3.7), wall = data.wall.find(slot => slot.reserved === i);
			const destination = [wall.at[0] + wall.w / 2 + shift[0], wall.at[1] + wall.d / 2 + shift[1], wall.at[2] + 3];
			at = between(target, destination, toss);
			at[2] += Math.sin(toss * Math.PI) * (480 + i * 30);
			rot = [Math.sin(toss * Math.PI) * (i % 2 ? 1.2 : -1.1), Math.sin(toss * Math.PI) * 0.9, Math.sin(toss * Math.PI) * (i % 2 ? -0.7 : 0.7)];
			scale = mix(1, wall.w / feature.w, toss);
			scaleY = mix(1, wall.d / feature.d, toss);
			alpha *= 1 - ease((time - 26) / 0.7);
		}
		const highlight = i === 0 ? 1 : variant === "sculpted" ? ease((time - 22.4) / 0.8) * (1 - ease((time - 25.8) / 1)) : 0;
		return { ...pose(at, rot, scale, alpha, highlight), scaleY };
	});
	const wrap = (value, center, period) => value - Math.floor((value - center + period / 2) / period) * period;
	const screenAt = (point, atTime = time) => {
		const center = atTime >= data.duration ? lastCamera.at : camera.at;
		const a = (atTime >= data.duration ? lastCamera.azimuth : camera.azimuth) * Math.PI / 180, e = (atTime >= data.duration ? lastCamera.elevation : camera.elevation) * Math.PI / 180;
		const [x, y, z] = point.map((value, axis) => value - center[axis]);
		return [x * Math.sin(a) - y * Math.cos(a), (x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)];
	};
	const baseWallAt = (card, sourceIndex, atTime = time) => {
		const movement = atTime === time ? shift : wallShift(atTime);
		const origin = field?.positions[sourceIndex] ?? [card.at[0] + card.w / 2, card.at[1] + card.d / 2, card.at[2]];
		return [wrap(origin[0] + movement[0], lastCamera.at[0], periodX), wrap(origin[1] + movement[1], lastCamera.at[1], periodY), origin[2]];
	};
	const pool = data.wall.map((card, sourceIndex) => ({ card, sourceIndex, kind: "wall", index: sourceIndex, key: card.key }));
	const originalActions = data.actors.map((actor, i) => ({ ...actor, incoming: [360 + i * 20, 420 + i * 15, 160], entry: [950, 1050, 0], target: pool.find(entry => entry.card.key === actor.slotKey) }));
	const helperStart = data.motion?.wall?.helperStart ?? 35, helperPeriod = data.motion?.wall?.helperPeriod ?? 12;
	const helperCycle = Math.max(0, Math.floor((time - helperStart) / helperPeriod));
	const recurringTargets = new Set();
	const repeatingActions = time < helperStart ? [] : data.actors.map((actor, i) => {
		const reach = helperStart + helperCycle * helperPeriod + i * helperPeriod / data.actors.length, grab = reach + 0.65;
		const candidates = pool.filter(entry => entry.card.reserved === undefined && !recurringTargets.has(entry.key)).map(entry => {
			const projected = screenAt(baseWallAt(entry.card, entry.sourceIndex, grab), grab);
			const x = projected[0] * projectionScale, y = projected[1] * projectionScale;
			return { entry, safe: Math.abs(x) < lastCamera.width / 2 - 360 && Math.abs(y) < lastCamera.height / 2 - 360, score: Math.abs(x) * 0.45 + Math.abs(y - (lastCamera.height / 2 - 360)) };
		});
		candidates.sort((a, b) => Number(b.safe) - Number(a.safe) || a.score - b.score || a.entry.sourceIndex - b.entry.sourceIndex);
		recurringTargets.add(candidates[0].entry.key);
		return { ...actor, reach, grab, land: grab + 1.8, leave: grab + 2.45, recurring: true, incoming: [40, 55, 20], entry: [950, 1050, 0], target: candidates[0].entry };
	});
	const actions = [...originalActions, ...repeatingActions];
	const wallPoses = pool.map(entry => {
		const { card, sourceIndex: i } = entry;
		const fromCenter = Math.min(1.6, Math.abs(card.source.x - 960) / 2400 + Math.abs(card.source.y - 540) / 1600);
		const s = ease((time - 23 - fromCenter * 0.3) / 1.3), at = baseWallAt(card, i);
		at[2] += (1 - s) * (170 + i % 4 * 45);
		let rot = [(1 - s) * 0.4, (1 - s) * -0.32, (1 - s) * (i % 2 ? 0.14 : -0.14)];
		const handoff = card.reserved !== undefined && card.reserved < 6 ? ease((time - 25.9 - card.reserved * 0.05) / 0.7) : card.reserved === 6 ? ease((time - data.titleCarry.land) / 0.3) : 1;
		let alpha = s * handoff;
		const action = actions.find(action => action.target?.key === entry.key && time <= action.leave && (time >= action.reach || action.reach < helperStart));
		if (action) {
			const lowered = ease((time - action.grab) / (action.land - action.grab));
			const base = baseWallAt(card, i);
			const incoming = (1 - lowered) * (action.recurring ? ease((time - action.reach) / 0.45) : 1);
			for (let axis = 0; axis < 3; axis += 1) at[axis] = base[axis] + action.incoming[axis] * incoming;
			rot = [incoming * 0.08, incoming * -0.1, incoming * 0.04];
			alpha = action.recurring ? 1 : ease((time - action.reach + 0.25) / 0.35);
		}
		const projected = screenAt(at);
		const azimuth = camera.azimuth * Math.PI / 180, elevation = camera.elevation * Math.PI / 180;
		const marginX = (card.w * Math.abs(Math.sin(azimuth)) + card.d * Math.abs(Math.cos(azimuth))) * projectionScale / 2 + 12;
		const marginY = (card.w * Math.abs(Math.cos(azimuth)) + card.d * Math.abs(Math.sin(azimuth))) * Math.sin(elevation) * projectionScale / 2 + 12;
		const visible = Math.abs(projected[0]) * projectionScale < camera.width / 2 + marginX && Math.abs(projected[1]) * projectionScale < camera.height / 2 + marginY;
		if (!visible) alpha = 0;
		const highlight = card.reserved === 0 ? 1 : 0;
		const entryProgress = clamp((camera.height / 2 + marginY - projected[1] * projectionScale) / (marginY * 2));
		const enteringBottom = time >= wallStart && visible && projected[1] * projectionScale > camera.height / 2 - marginY;
		return { ...pose(at, rot, 1, alpha, highlight), sourceIndex: i, key: entry.key, index: entry.index, incoming: enteringBottom || Boolean(action && time < action.land), entryEdge: enteringBottom ? "bottom" : null, entryProgress, visible, screen: projected };
	});
	const wall = wallPoses, wallCopies = [];
	const confetti = Array.from({ length: 56 }, (_, i) => {
		const pair = Math.floor(i / 2), side = i % 2 ? 1 : -1, centerX = data.doneList.viewport.x + data.doneList.viewport.w / 2;
		const origin = [centerX + side * data.doneList.viewport.w / 2, data.doneList.viewport.y + data.doneList.viewport.d * 0.82, 18];
		let at = origin, rot = [0, 0, side * random(pair, 15) * Math.PI], alpha = 0;
		const launch = (elapsed, large) => {
			const speed = (large ? 150 : 90) + random(pair, 16) * (large ? 120 : 55), up = (large ? 240 : 150) + random(pair, 17) * 100;
			return [origin[0] - side * speed * elapsed, origin[1] - (35 + random(pair, 18) * 80) * elapsed, origin[2] + up * elapsed - (large ? 110 : 120) * elapsed ** 2];
		};
		if (time > 2 && time < 5) {
			const elapsed = time - 2, s = clamp(elapsed / 2.7);
			at = launch(elapsed, false);
			alpha = ease(elapsed / 0.14) * (1 - ease((elapsed - 1.5) / 1.2));
			rot = [Math.sin(elapsed * 4 + pair) * 0.8, side * elapsed * (1 + random(pair, 19)), side * (random(pair, 20) + s * 5)];
		}
		if (time >= 6 && time < 12.5) {
			const elapsed = time - 6, vortex = ease((time - 8) / 2), angle = pair * 2.39996 + side * Math.PI / 2 + (time - 8) * 1.5;
			const radius = 55 + pair % 8 * 11, orbit = [centerX + Math.cos(angle) * radius, -50 + Math.sin(angle) * radius * 0.66, 35 + pair / 28 * 290];
			at = between(launch(Math.min(elapsed, 2.4), true), orbit, vortex);
			alpha = ease(elapsed / 0.25) * (1 - ease((time - 11) / 1.5));
			rot = [Math.sin(elapsed * 3 + pair) * 0.8, side * Math.cos(elapsed * 2 + pair) * 0.7, angle];
		}
		return { ...pose(at, rot, 1, alpha, 1), emitter: side < 0 ? "left" : "right", pair, velocity: [-side * (150 + random(pair, 16) * 120), -(35 + random(pair, 18) * 80), 240 + random(pair, 17) * 100] };
	});
	const titleSlot = data.wall.find(slot => slot.reserved === 6), carry = data.titleCarry;
	let titlePose = pose([...data.title.at], [0, 0, 0], 1, ease((time - 22.2) / 0.3), ease((time - carry.grab) / 0.25));
	if (time >= carry.grab) {
		const progress = clamp((time - carry.grab) / (carry.land - carry.grab)), along = ease((time - carry.grab - 0.22) / (carry.land - carry.grab - 0.47));
		const give = Math.sin(Math.PI * clamp((time - carry.grab) / 0.95)) ** 2;
		const target = [titleSlot.at[0] + titleSlot.w / 2 + shift[0], titleSlot.at[1] + titleSlot.d / 2 + shift[1], 0], at = between(data.title.at, target, along);
		const dx = target[0] - data.title.at[0], dy = target[1] - data.title.at[1], bow = Math.sin(Math.PI * along) * 0.12;
		at[0] += -dy * bow + 70 * give;
		at[1] += dx * bow - 40 * give;
		at[2] += ease((time - carry.grab) / 0.25) * (1 - ease(progress)) * 170;
		titlePose = { ...pose(at, [-0.08 * Math.sin(progress * Math.PI), 0.12 * Math.sin(progress * Math.PI), -0.08 * Math.sin(progress * Math.PI)], mix(1, titleSlot.w / data.title.w, ease(progress)), 1 - ease((time - carry.land) / 0.3), 1), scaleY: mix(1, titleSlot.d / data.title.d, ease(progress)) };
	}
	const hiddenCursor = (id, role) => ({ id, role, phase: "hidden", target: null, heldTarget: null, at: [0, 0, 0], pressed: 0, alpha: 0, grip: { u: 0.5, v: 0.5 }, frameShare: 0 });
	const cursorOn = (id, role, action, target, posed, w, d, kind) => {
		if (time < action.reach || time > action.leave) return hiddenCursor(id, role);
		const grip = action.grip, contact = surfacePoint(posed, w, d, kind, grip);
		const arriving = action.grab === action.reach ? 1 : ease((time - action.reach) / (action.grab - action.reach));
		const leaving = ease((time - action.land - 0.12) / (action.leave - action.land - 0.12));
		const held = time >= action.grab && time < action.land, attached = time >= action.grab && time <= action.land + 0.12;
		const phase = time < action.grab ? "approach" : time < action.grab + 0.1 ? "grab" : time < action.land ? "carry" : time <= action.land + 0.12 ? "release" : "leave";
		const at = contact.map((value, axis) => value + action.entry[axis] * ((1 - arriving) + leaving * 0.6));
		const pressed = ease((time - action.grab + 0.1) / 0.1) * (1 - ease((time - action.land) / 0.12));
		const alpha = (action.reach === action.grab ? 1 : ease((time - action.reach) / 0.18)) * (1 - leaving);
		return { id, role, phase, target, heldTarget: held ? target : null, at, pressed, alpha, grip, frameShare: attached ? 1 : phase === "approach" ? arriving : 0 };
	};
	let main = hiddenCursor("main", "presenter");
	const boardDrag = data.boardDrags.find(action => time >= action.reach && time <= action.leave);
	if (boardDrag) {
		const card = data.cards[boardDrag.card];
		main = cursorOn("main", "presenter", boardDrag, { kind: "story", index: boardDrag.card, key: card.code }, cards[boardDrag.card], card.w, card.d, "story");
	} else if (time >= carry.reach && time <= carry.leave) {
		main = cursorOn("main", "presenter", { ...carry, grip: data.title.grip }, { kind: "title", index: 6, key: "title" }, titlePose, data.title.w, data.title.d, "title");
	}
	const cursors = [main, ...data.actors.map(actor => {
		const action = actions.find(action => action.id === actor.id && time >= action.reach && time <= action.leave);
		if (!action) return hiddenCursor(actor.id, "teammate");
		const entry = action.target, slot = entry.card, target = { kind: entry.kind, index: entry.index, key: entry.key, sourceIndex: entry.sourceIndex };
		const posed = wallPoses[entry.index];
		return cursorOn(actor.id, "teammate", action, target, posed, slot.w, slot.d, "wall");
	})];
	const doneEffect = { trace: ease((time - 10.8) / 1.1), sweep: ease((time - 11.9) / 1.1), alpha: ease((time - 10.8) / 0.14) * (1 - ease((time - 12.8) / 0.3)) };
	const elapsed = Math.max(0, time - wallStart), steadyElapsed = Math.max(0, elapsed - 3), period = wallPeriod;
	const wallLoop = { active: time >= wallStart, layout: "single-masonry", cycle: Math.floor(steadyElapsed / period), offset: steadyElapsed % period, period, elapsed, shift, velocity: wallVelocity, periodX, periodY, poolSize: pool.length, virtualPoolSize: pool.length, copyPoolLimit: 0, visibleCount: wallPoses.filter(each => each.alpha > 0.002).length, incomingCount: wallPoses.filter(each => each.incoming && each.alpha > 0.002).length, feedEdge: "bottom" };
	const state = { time, variant, index, phase: data.states[index].phase, camera, cards, tiles, wall, wallCopies, wallLoop, confetti, cursors, titlePose, doneEffect, chrome: 1 - ease((time - 13.25) / 1.3), flash: 0, flashY: 0, title: titlePose.alpha };
	if (!options.transition) return state;
	const { from, progress } = options.transition, s = clamp(progress);
	if (s <= 0) return from;
	if (s >= 1) return state;
	const blendPose = (a, b) => ({
		...b,
		at: between(a.at, b.at, s),
		rot: between(a.rot ?? [0, 0, 0], b.rot ?? [0, 0, 0], s),
		scale: mix(a.scale ?? 1, b.scale ?? 1, s),
		scaleY: mix(a.scaleY ?? a.scale ?? 1, b.scaleY ?? b.scale ?? 1, s),
		alpha: mix(a.alpha, b.alpha, s),
		highlight: mix(a.highlight ?? 0, b.highlight ?? 0, s),
		clip: Boolean(a.clip && b.clip),
	});
	const directWidth = Math.exp(mix(Math.log(from.camera.width), Math.log(camera.width), s));
	const angle = ((camera.azimuth - from.camera.azimuth + 540) % 360) - 180;
	return {
		...state,
		time: mix(from.time, time, s),
		camera: { at: between(from.camera.at, camera.at, s), width: directWidth, height: directWidth * 760 / 1200, azimuth: from.camera.azimuth + angle * s, elevation: mix(from.camera.elevation, camera.elevation, s) },
		...Object.fromEntries(["cards", "tiles", "wall", "confetti"].map(key => [key, state[key].map((posed, i) => blendPose(from[key][i], posed))])),
		wallCopies: [],
		titlePose: blendPose(from.titlePose, titlePose),
		cursors: cursors.map((cursor, i) => {
			const previous = from.cursors[i], posed = blendPose(previous, cursor);
			posed.alpha = previous.alpha * Math.max(0, 1 - s * 2) + cursor.alpha * Math.max(0, s * 2 - 1);
			return posed;
		}),
		doneEffect: Object.fromEntries(Object.keys(doneEffect).map(key => [key, mix(from.doneEffect[key], doneEffect[key], s)])),
		chrome: mix(from.chrome, state.chrome, s),
		title: mix(from.title, state.title, s),
	};
}
