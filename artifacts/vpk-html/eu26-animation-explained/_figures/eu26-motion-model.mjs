export const motionConfig = {
	seed: 26031,
	// The source wall scrolls sideways only (finale-wall-motion.ts wallOffset), so the glide has no vertical component.
	wall: { start: 27, velocity: [-32, 0], repeatX: 3 },
	// The source's arrivals (finale-wall-motion.ts): a card waits in the air above its slot and comes down as its slot's
	// leading edge crosses its own line, DESCEND_FROM + DESCEND_SPAN * hash entry reaches in from the frame's right edge.
	// reachShare 0.3 (the source's 0.16 starved the portrait two-column figure to ~15 carried cards per 103 s; 0.3 gives ~34,
	// landscape ~49, with up to 3 teammates on screen at once).
	arrival: { from: 0.45, span: 0.7, reachShare: 0.3, edgeWidth: 300, descendS: 0.95, handoff: 0.6, faceUp: 0.072, dealS: 0.09 },
	// finale-wall-cursors.ts: a teammate's hand glides in over ENTER_S (--duration-slowest), rides at least RIDE_S, leaves over
	// LEAVE_S (--duration-slower) fading by --duration-medium, stays CURSOR_MARGIN inside the frame and rests LANE_REST_S.
	hand: { enter: 0.6, ride: 0.2, leave: 0.4, fade: 0.2, margin: 8, rest: 0.15, apart: 16, lift: 8, grow: 0.03, tilt: 0.03, swing: 0.3, bow: 0.2 },
	// Cursor scale against stageshow's 16px arrow and 19px name flag, matched to teu26.mp4: at 1080 px the arrow stands about
	// 36 px (a third of a small tile). The name pill stands at least as tall as the arrow there (19 x 1.8 = 34 flag units vs 15.5 x 2.3 = 36 arrow units); taller pills stop fitting the portrait frame while they ride.
	cursor: { arrow: 2.3, flag: 1.8 },
	// FINALE_WALL_CURSOR_NAMES: teammates set arriving cards down in this order, repeating after the last name.
	names: ["Venn", "Eduardo", "Jason", "Vohmann", "Charlie", "Carola", "Harry", "Sofia", "Jannis"],
};

// The wall is the source's packed masonry (sourceWall in eu26-hero.hero.mjs, ported from finale-wall-layout.ts), shown
// as one horizontal band that repeats every packed-wall width, the way the source loops its wall while scrolling.
export function createWallField(data) {
	const camera = data.cameraKeys[data.cameraKeys.length - 1], center = [...camera.at];
	const lefts = data.wall.map(card => card.at[0]), rights = data.wall.map(card => card.at[0] + card.w);
	const gutter = data.wallSource?.gutter * (data.wallSource?.worldScale ?? 0.72) || 17;
	const periodX = Math.max(...rights) - Math.min(...lefts) + gutter, periodY = 1e6;
	const positions = data.wall.map(card => [card.at[0] + card.w / 2, card.at[1] + card.d / 2, card.at[2]]);
	return { layout: "source-masonry", positions, periodX, periodY, center, gutter, sourceCount: data.wall.length };
}

// Anchor-locked camera moves (figure-motion.md, "Snap between camera poses"). A key with `lock: [x, y, z]` keeps that
// world point where the previous key showed it, as a share of the frame, while zoom, turn and tilt change together:
// lockCameraKeys solves the key's target once (through model's `aim` entry, so one solver serves build and runtime), and
// model() solves the target per frame through the move. A key with `hold: true` repeats the previous pose.
export function lockCameraKeys(keys) {
	const resolved = [];
	for (const key of keys) {
		const prev = resolved.at(-1);
		if (key.hold) {
			const { at, width, azimuth, elevation, cover, persp } = prev;
			resolved.push({ time: key.time, at: [...at], width, azimuth, elevation, ...(cover === undefined ? {} : { cover }), ...(persp === undefined ? {} : { persp }) });
		} else if (key.lock) {
			const base = { ...key, at: key.at ?? prev.at };
			resolved.push({ ...base, at: model({ aim: { camera: base, from: prev, point: key.lock } }) });
		} else resolved.push({ ...key });
	}
	return resolved;
}

export function model(input, data) {
	const options = input !== null && typeof input === "object" ? input : { time: input };
	// screenOf is the flat projection in world units about the camera target. aimAt moves the target within the screen
	// plane (u maps to screen x, v to screen y, both square to the view) until the point projects at `goal`; depth along
	// the view is untouched, so the lens centre keeps its depth. lockGoal keeps the point's share of the frame.
	const screenOf = (camera, point) => {
		const a = camera.azimuth * Math.PI / 180, e = camera.elevation * Math.PI / 180;
		const [x, y, z] = point.map((value, axis) => value - camera.at[axis]);
		return [x * Math.sin(a) - y * Math.cos(a), (x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)];
	};
	const aimAt = (camera, point, goal) => {
		const a = camera.azimuth * Math.PI / 180, e = camera.elevation * Math.PI / 180, [sx, sy] = screenOf(camera, point);
		const u = [Math.sin(a), -Math.cos(a), 0], v = [Math.cos(a) * Math.sin(e), Math.sin(a) * Math.sin(e), -Math.cos(e)];
		return camera.at.map((value, axis) => value + (sx - goal[0]) * u[axis] + (sy - goal[1]) * v[axis]);
	};
	const lockGoal = (from, point, width) => screenOf(from, point).map(value => value * width / from.width);
	if (options.aim) return aimAt(options.aim.camera, options.aim.point, lockGoal(options.aim.from, options.aim.point, options.aim.camera.width));
	const time = Math.max(0, Number.isFinite(Number(options.time)) ? Number(options.time) : 0);
	const variant = data.variants.some(each => each.id === options.variant) ? options.variant : "paper";
	const clamp = x => Math.max(0, Math.min(1, x));
	const ease = x => { const u = clamp(x); return u * u * (3 - 2 * u); };
	const cameraEase = x => { const u = clamp(x); return u * u * u * (u * (u * 6 - 15) + 10); };
	const projectionScale = (options.projectionScale ?? data.motion?.projectionScale ?? 0.8692407110335721) * Math.sqrt(1.6);
	const mix = (a, b, s) => a + (b - a) * s;
	// Camera moves bend the parallel view into perspective and back, peaking mid-move (a dolly-zoom style lens bloom).
	// Bigger moves (more turn, tilt or zoom) bend further; holds and tiny reframes stay flat. A key's `lens` caps the bend
	// for a move into it, where tilted paper fans would otherwise overlap in a ring the depth sort cannot order.
	const lensBloom = (a, b, s) => {
		const turn = Math.abs(((b.azimuth - a.azimuth + 540) % 360) - 180) / 45, tilt = Math.abs(b.elevation - a.elevation) / 30;
		const zoom = Math.abs(Math.log(b.width / a.width)) / 0.7, travel = Math.hypot(...b.at.map((v, i) => v - a.at[i])) / 300;
		const size = turn + tilt + zoom + travel;
		return size < 0.05 ? 0 : Math.sin(Math.PI * clamp(s)) * Math.min(0.55, b.lens ?? 1, 0.2 + size * 0.25);
	};
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
		const offset = turn([(grip.u - 0.5) * w * posed.scale, (grip.v - 0.5) * d * (posed.scaleY ?? posed.scale), data.materialDepths[kind] * posed.scale], posed.rot);
		return posed.at.map((value, i) => value + offset[i]);
	};
	let index = 0;
	while (index < data.states.length - 1 && time >= data.states[index + 1].time) index += 1;
	let cameraIndex = 0;
	while (cameraIndex < data.cameraKeys.length - 2 && time > data.cameraKeys[cameraIndex + 1].time) cameraIndex += 1;
	const ca = data.cameraKeys[cameraIndex], cb = data.cameraKeys[cameraIndex + 1];
	const cs = cameraEase((time - ca.time) / (cb.time - ca.time));
	const width = ca.width === cb.width ? ca.width : Math.exp(mix(Math.log(ca.width), Math.log(cb.width), cs));
	const camera = { at: between(ca.at, cb.at, cs), width, height: width * 760 / 1200, azimuth: mix(ca.azimuth, cb.azimuth, cs), elevation: mix(ca.elevation, cb.elevation, cs), cover: mix(ca.cover ?? 0, cb.cover ?? 0, cs), persp: mix(ca.persp ?? 0, cb.persp ?? 0, cs) + lensBloom(ca, cb, cs) };
	if (cb.lock && cs > 0 && cs < 1) {
		// The lens spreads points about the target by depth, so aim the flat projection inside that spread.
		const a = camera.azimuth * Math.PI / 180, e = camera.elevation * Math.PI / 180, view = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
		const rel = cb.lock.reduce((sum, value, axis) => sum + (value - camera.at[axis]) * view[axis], 0);
		const spread = 1 / Math.max(0.35, 1 - rel * camera.persp * projectionScale / camera.height);
		camera.at = aimAt(camera, cb.lock, lockGoal(ca, cb.lock, camera.width).map(value => value / spread));
	}
	const fieldAt = i => {
		if (i === 15) return [-15, -28, 96];
		const angle = i * 2.39996 + (random(i, 1) - 0.5) * 0.7;
		const radius = 190 + Math.sqrt(i + 1) * 100 + (random(i, 2) - 0.5) * 150;
		return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66 - 25, 35 + random(i, 3) * 245];
	};
	const pitch = data.cards[1].home[1] - data.cards[0].home[1];
	// Done shows every row whose top edge falls inside its window; the last of them is clipped by the column's bottom edge.
	const windowBottom = data.doneList.viewport.y + data.doneList.viewport.d;
	const visibleRows = data.doneList.cards.filter(row => row.y < windowBottom).length;
	const stackSlot = data.doneList.cards.find(row => row.rank === visibleRows - 1);
	// The cursor's card in the group drag (card 0): the rest of the selection gathers under it as a deck.
	const leaderRow = data.doneList.cards.find(row => row.card === 0), leaderCard = data.cards[0];
	const leaderAt = atTime => {
		const s = ease((atTime - 4.3) / 1.2);
		const from = [leaderCard.home[0] + leaderCard.w / 2, leaderCard.home[1] + leaderCard.d / 2, leaderCard.home[2]];
		const to = [leaderRow.x + leaderRow.w / 2, leaderRow.y + leaderRow.d / 2, 4];
		const at = between(from, to, s);
		at[2] += Math.sin(s * Math.PI) * 75;
		return at;
	};
	const cards = data.cards.map((card, i) => {
		const column = card.home[0] === data.cards[0].home[0] ? 0 : card.home[0] === data.cards[8].home[0] ? 1 : 2;
		// Close the gap: as the first card (15) leaves its column, the cards below it slide up one row and the next hidden
		// card scrolls into view, as a real board reflows.
		const reflow = column === 2 && card.row > 1 ? ease((time - 0.7) / 0.7) : 0;
		const home = [card.home[0] + card.w / 2, card.home[1] + card.d / 2 - pitch * reflow, card.home[2]];
		const row = data.doneList.cards.find(row => row.card === i);
		const done = [row.x + row.w / 2, row.y + row.d / 2, 4], inWindow = row.rank < visibleRows;
		// Every other completed card joins the multi-select drag: it gathers under the cursor's card as a tidy deck, travels
		// with it, then sinks into Done's stack below the window once the deck lands, so no card flies off the board.
		const moved = i !== 15 && !inWindow;
		const stack = [stackSlot.x + stackSlot.w / 2, stackSlot.y + stackSlot.d / 2, 3];
		const deckIndex = row.rank - visibleRows + 2;
		const groupDelay = Math.min(0.3, 0.025 * deckIndex);
		const groupU = moved ? clamp((time - 4.3 - groupDelay) / 1.9) : 0;
		const shown = card.row < 3 || (column === 2 && card.row === 3) ? (card.row < 3 ? 1 : reflow) : 0;
		let at = home, rot = [0, 0, 0], alpha = shown;
		if (i === 15 && time > 0) {
			const s = ease(time / 2);
			at = between(home, done, s);
			at[2] += Math.sin(s * Math.PI) * 95;
			rot = [0, Math.sin(s * Math.PI) * 0.2, Math.sin(s * Math.PI) * -0.18];
		}
		if (time > 4.3 && inWindow) {
			if (row.rank >= 2) {
				// Later visible Done cards ride in the cursor's deck, then settle into their own rows.
				const deck = leaderAt(time).map((value, axis) => value + [-3, 4, -1.2][axis] * (row.rank - 1));
				const gather = ease((time - 4.3) / 0.55), settle = ease((time - 5.3) / 0.5);
				at = between(between(home, deck, gather), done, settle);
				at[2] += Math.sin(gather * Math.PI) * 30 * (1 - settle);
			} else {
				const s = ease((time - 4.3) / 1.2);
				at = between(i === 15 ? done : home, done, s);
				at[2] += Math.sin(s * Math.PI) * (i === 15 ? 0 : 75);
			}
			alpha = 1;
		}
		if (moved && groupU > 0) {
			// Deck slot under the leader: each card sits a little lower and behind the one above it.
			const deck = leaderAt(time).map((value, axis) => value + [-3, 4, -1.2][axis] * Math.min(deckIndex, 6));
			const gather = ease((time - 4.3 - groupDelay) / 0.55);
			const sink = ease((time - 5.2 - groupDelay * 0.25) / 0.5);
			at = between(between(home, deck, gather), stack, sink);
			at[2] += Math.sin(gather * Math.PI) * 30 * (1 - sink);
			alpha = shown > 0 ? 1 - ease((time - 5.45 - groupDelay * 0.25) / 0.35) : 0;
		}
		// Cards sunk below the window launch the field from their own (hidden) Done rows, so no two start from one pose.
		const rest = inWindow || moved ? done : home;
		if (time > 13) {
			const delay = i === 15 ? 0 : random(i, 4) * 0.18;
			const u = clamp((time - 13 - delay) / (2.88 - delay)), s = ease(u), impulse = u * (1 - u) ** 2 * 4;
			at = between(rest, fieldAt(i), s);
			const velocity = [(random(i, 5) - 0.5) * 520, (random(i, 6) - 0.5) * 420, 180 + random(i, 7) * 350];
			velocity[0] += i === 17 ? 160 : i === 20 ? 140 : 0;
			at = at.map((value, axis) => value + velocity[axis] * impulse * (i === 15 ? 0.28 : 1));
			const pitchAngle = (random(i, 8) - 0.5) * 1.05, yaw = (random(i, 9) - 0.5) * 1.1;
			rot = i === 15 ? [0, 0, 0] : [pitchAngle * s + Math.sin(u * Math.PI) * (random(i, 10) - 0.5) * 1.8, yaw * s + Math.sin(u * Math.PI) * (random(i, 11) - 0.5) * 2.1, (random(i, 12) - 0.5) * 0.9 * s];
			alpha = mix(inWindow ? 1 : 0, 1, ease(u / 0.32));
		}
		if (time > 19) alpha *= 1 - ease((time - 19) / 1.2);
		const highlight = i === 15 ? 1 : ease((time - 4.3) / 1.2) * (1 - ease((time - 13.2) / 2.5));
		const clip = time <= 13 && ((inWindow && ((i === 15 && time >= 2) || (i !== 15 && time >= 5.5))) || (moved && groupU > 0.6));
		return { ...pose(at, rot, 1, alpha, highlight), clip, listAt: done, rank: row.rank, listVisible: inWindow };
	});
	const field = data.wallField, periodX = field?.periodX ?? 3800, periodY = field?.periodY ?? 3800;
	const lastShot = data.cameraKeys[data.cameraKeys.length - 1], lastCamera = { ...lastShot, height: lastShot.width * 760 / 1200 };
	const wallStart = data.motion?.wall?.start ?? 27, velocityX = data.motion?.wall?.velocity?.[0] ?? -32;
	const wallPeriod = periodX / Math.abs(velocityX) * (data.motion?.wall?.repeatX ?? 3);
	const wallVelocity = [velocityX, data.motion?.wall?.velocity?.[1] ?? 0];
	const wallShift = atTime => {
		const initial = Math.max(0, Math.min(atTime, wallStart) - 24), tail = Math.max(0, atTime - wallStart);
		const blend = Math.min(tail, 3), integral = blend - blend ** 3 / 9 + blend ** 4 / 54;
		return [-20 * initial + wallVelocity[0] * tail + (-20 - wallVelocity[0]) * integral, wallVelocity[1] * tail, 0];
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
		// The hero tile hands the orange to the Team ’26 title as it lands (same 0.3s curve), so only one tile is orange.
		const highlight = i === 0 ? 1 - ease((time - 22.2) / 0.3) : 0;
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
	// Arrivals, as the source's teammates play them: a named cursor reaches in from off the frame holding the new card by its
	// middle, at its own size and nearly flat, and sets it down into its slot as the slot comes past, then lets go and leaves.
	// The card lands as a blank sheet with a landing ring, then its face comes up. A card no hand can bring in is simply
	// already in its slot when it scrolls into view: no card ever moves on its own. Pure in time and frame size.
	const A = data.motion?.arrival ?? {}, speed = Math.abs(velocityX) || 32;
	const HAND = { enter: 0.6, ride: 0.2, leave: 0.4, fade: 0.2, margin: 8, rest: 0.15, apart: 16, lift: 8, grow: 0.03, tilt: 0.03, swing: 0.3, bow: 0.2, ...(data.motion?.hand ?? {}) };
	// The wall is a cover shot: the frame shows its full height and as much width as the display allows (aspect).
	const aspect = options.aspect ?? lastCamera.width / lastCamera.height;
	const viewHalf = lastCamera.height * aspect / 2 / projectionScale, viewHalfY = lastCamera.height / 2 / projectionScale;
	// The source measures its arrival lines in reference-card reaches from the right edge; a reach is a share of the frame width.
	const reachLine = (A.reachShare ?? 0.3) * viewHalf * 2;
	const inOut = u => { const v = clamp(u); return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2; };
	const outPractical = u => 1 - (1 - clamp(u)) ** 3, easeIn = u => clamp(u) ** 3;
	// A slot's line (its own place across the frame) and fall time are constants of the slot and the frame size.
	const edgeOffset = card => Math.min(card.w, A.edgeWidth ?? 300) / 2 - card.w / 2;
	const lineOf = (card, i) => Math.min(viewHalf - reachLine * ((A.from ?? 0.45) + (A.span ?? 0.7) * random(i, 31)), viewHalf - card.w * 0.75 + Math.min(card.w, A.edgeWidth ?? 300) / 2);
	const fallOf = i => (A.descendS ?? 0.95) * mix(0.85, 1.25, random(i, 32));
	// The cursor's own box beside its tip (arrow and name flag), in world units. The name always rides below and right of the
	// tip, as stageshow's presence cursors do; a card in the frame's top third is still reached from above (its reach), but
	// the cursor is never turned over.
	// The cursor is drawn in screen pixels (arrow 16 x 16, name flag up to the longest roster name), so its box in world units
	// follows the display: one pixel covers lastCamera.height / displayHeight of the frame.
	const worldPerPx = lastCamera.height / (options.displayHeight ?? 828) / projectionScale, marginWorld = HAND.margin * worldPerPx;
	// Like the source (which sizes its cursors by the stage fit), teammate cursors shrink on small frames.
	const cursorFit = Math.max(0.55, Math.min(1, (options.displayHeight ?? 828) / 640)), fitPx = worldPerPx * cursorFit;
	const CURSOR = { arrow: 2.3, flag: 1.8, ...(data.motion?.cursor ?? {}) };
	// The flag sits at (11, 15) arrow units from the tip, always below-right, and holds the longest roster name (58 flag
	// units by 19). A hold whose flag would leave the frame is not planned.
	const pillBox = (_above, flagLeft = false) => {
		const reach = (11 * CURSOR.arrow + 63 * CURSOR.flag) * fitPx, top = -4 * CURSOR.arrow * fitPx, bottom = (15 * CURSOR.arrow + 22 * CURSOR.flag) * fitPx;
		return flagLeft ? { left: -(63 * CURSOR.flag + 2 * CURSOR.arrow) * fitPx, right: 16 * CURSOR.arrow * fitPx, top, bottom } : { left: -4 * CURSOR.arrow * fitPx, right: reach, top, bottom };
	};
	const bandOf = y => Math.min(2, Math.max(0, Math.floor((y + viewHalfY) / (viewHalfY * 2) * 3)));
	const BANDS = [{ reach: -Math.PI / 2 - 0.4, above: false }, { reach: 0.35, above: false }, { reach: Math.PI / 2 + 0.4, above: false }];
	const offFrame = (box, angle) => {
		const dx = Math.cos(angle), dy = Math.sin(angle);
		const across = dx > 1e-6 ? (viewHalf - box.left) / dx : dx < -1e-6 ? (box.right + viewHalf) / -dx : Infinity;
		const along = dy > 1e-6 ? (viewHalfY - box.top) / dy : dy < -1e-6 ? (box.bottom + viewHalfY) / -dy : Infinity;
		return Math.max(0, Math.min(across, along));
	};
	// Every slot's hold, planned once for this frame on the wall's steady loop (relative to the moment it crosses its line), so
	// each pass of the loop plays the same holds by the same teammates.
	const steady = wallShift(30)[0], loopSeconds = periodX / speed;
	const plan = pool.map(({ card }, i) => {
		if (card.reserved !== undefined || card.key.startsWith("lanyard-")) return null;
		const origin = field?.positions[i] ?? [card.at[0] + card.w / 2, card.at[1] + card.d / 2, card.at[2]];
		const line = lineOf(card, i), fall = fallOf(i), centreAtLine = line - edgeOffset(card);
		const y = wrap(origin[1] + shift[1], lastCamera.at[1], periodY) - lastCamera.at[1];
		const phase = (((30 + (line - (origin[0] - lastCamera.at[0] + edgeOffset(card)) - steady) / velocityX) % loopSeconds) + loopSeconds) % loopSeconds;
		const band = BANDS[bandOf(y)], reach = band.reach + (random(i, 43) - 0.5) * 2 * HAND.swing, bow = (random(i, 44) - 0.5) * 2 * HAND.bow;
		const fits = flagLeft => {
			for (let tau = 0; tau <= fall + 1e-9; tau += fall / 8) {
				const x = centreAtLine - speed * tau, p = pillBox(band.above, flagLeft);
				if (x + p.left < -viewHalf + marginWorld || x + p.right > viewHalf - marginWorld || y + p.top < -viewHalfY + marginWorld || y + p.bottom > viewHalfY - marginWorld) return false;
			}
			return true;
		};
		// The name always rides below-right of the tip; a hold whose flag would leave the frame is not taken.
		const flagLeft = fits(false) ? false : null;
		if (flagLeft === null) return null;
		const box = (tau, extra = 0) => {
			const x = centreAtLine - speed * tau, p = pillBox(band.above, flagLeft), grown = 1 + HAND.grow;
			return { left: Math.min(x - card.w * grown / 2, x + p.left) - extra, right: Math.max(x + card.w * grown / 2, x + p.right) + extra, top: Math.min(y - card.d * grown / 2, y + p.top) - extra, bottom: Math.max(y + card.d * grown / 2, y + p.bottom) + extra };
		};
		// While it is on the card (from crossing to touchdown, at least RIDE_S) the cursor and its pill stay inside the margin
		// (fits, above); the card it holds stays wholly in the frame too while it is set down.
		for (let tau = 0; tau <= fall + 1e-9; tau += fall / 8) {
			const x = centreAtLine - speed * tau;
			const halfW = card.w * (1 + HAND.grow) / 2, halfD = card.d * (1 + HAND.grow) / 2;
			if (x - halfW < -viewHalf || x + halfW > viewHalf || y - halfD < -viewHalfY || y + halfD > viewHalfY) return null;
		}
		if (fall < HAND.ride) return null;
		// In from wholly off the frame, card and all (the card is carried in, never seen on its own), and back off it after.
		const enterDistance = offFrame(box(-HAND.enter), reach) + HAND.apart;
		const leaveDistance = offFrame(box(fall + HAND.leave), reach) + HAND.apart;
		return { i, phase, fall, reach, bow, above: band.above, flagLeft, enterDistance, leaveDistance, landAt: [centreAtLine - speed * fall, y] };
	});
	// Lanes: the three teammates take holds in arrival order, each resting LANE_REST_S between holds, two cursors never near each
	// other. Planned over two passes so the loop's wrap is accounted for; the second pass is the one every loop plays.
	const lanes = data.actors.length, laneOfSlot = new Map(), rankOfSlot = new Map();
	{
		const events = plan.filter(Boolean).flatMap(hold => [0, 1].map(pass => ({ hold, pass, from: hold.phase + pass * loopSeconds - HAND.enter, to: hold.phase + pass * loopSeconds + hold.fall + HAND.leave })));
		events.sort((a, b) => a.from - b.from || a.hold.i - b.hold.i);
		const free = Array(lanes).fill(-Infinity), kept = [];
		let turn = 0;
		for (const event of events) {
			const clash = kept.some(other => other.from < event.to && event.from < other.to && Math.hypot(other.hold.landAt[0] - event.hold.landAt[0] + speed * (event.from - other.from), other.hold.landAt[1] - event.hold.landAt[1]) < 110);
			if (clash) continue;
			let lane = -1;
			for (let k = 0; k < lanes; k += 1) { const candidate = (turn + k) % lanes; if (free[candidate] + HAND.rest <= event.from) { lane = candidate; break; } }
			if (lane < 0) continue;
			free[lane] = event.to;
			turn = (lane + 1) % lanes;
			kept.push({ ...event, lane });
			if (event.pass === 1) laneOfSlot.set(event.hold.i, lane);
		}
		[...laneOfSlot.keys()].sort((a, b) => plan[a].phase - plan[b].phase).forEach((i, rank) => rankOfSlot.set(i, rank));
	}
	const names = data.motion?.names ?? ["Venn", "Eduardo", "Jason"];
	// This loop's hold on a slot, if a teammate brings its card in: crossing solved on the wall's actual travel (it ramps up after
	// the wall appears), and no hold before the title's cursor has left. Any other slot is already in place.
	const arrivalOf = (card, i) => {
		if (options.reduced || !laneOfSlot.has(i)) return null;
		const base = baseWallAt(card, i), hold = plan[i];
		const edge = base[0] - lastCamera.at[0] + edgeOffset(card);
		const delta = lineOf(card, i) - edge, target = shift[0] + delta;
		let lo = delta >= 0 ? 24 : time, hi = delta >= 0 ? time : time + -delta / 20 + 1;
		if (delta >= 0 && wallShift(lo)[0] < target) return null;
		for (let step = 0; step < 32; step += 1) {
			const mid = (lo + hi) / 2;
			if (wallShift(mid)[0] > target) lo = mid;
			else hi = mid;
		}
		const crossed = (lo + hi) / 2;
		if (crossed - HAND.enter < data.titleCarry.leave) return null;
		const pass = Math.round((crossed - hold.phase) / loopSeconds);
		const name = names[((pass * laneOfSlot.size + rankOfSlot.get(i)) % names.length + names.length) % names.length];
		return { base, hold, since: time - crossed, fall: hold.fall, touchdown: crossed + hold.fall, lane: laneOfSlot.get(i), name };
	};
	// Where the hand (and the card it holds) is, relative to the slot: in along its reach from off the frame, bowing slightly.
	const leg = (angle, distance, bow, amount) => {
		const x = Math.cos(angle) * distance, y = Math.sin(angle) * distance, along = 1 - amount, bend = bow * distance * Math.sin(Math.PI * along);
		return [x * along - y / Math.max(1, distance) * bend, y * along + x / Math.max(1, distance) * bend];
	};
	// The card while held: carried in at its own size, a touch lifted and nearly flat, then lowered steady into its slot.
	const heldPose = (arrival, i, extraLift = 0) => {
		const { hold, since, fall, base } = arrival, tilt = [(random(i, 45) - 0.5) * 2 * HAND.tilt, (random(i, 46) - 0.5) * 2 * HAND.tilt, (random(i, 47) - 0.5) * 2 * HAND.tilt * 0.7];
		if (since >= fall) return { at: base, rot: [0, 0, 0], scale: 1 };
		const coming = since < 0 ? leg(hold.reach, hold.enterDistance, hold.bow, outPractical((since + HAND.enter) / HAND.enter)) : [0, 0];
		const down = since <= 0 ? 0 : inOut(since / fall);
		return { at: [base[0] + coming[0], base[1] + coming[1], base[2] + (HAND.lift + extraLift) * (1 - down)], rot: tilt.map(angle => angle * (1 - down)), scale: 1 + HAND.grow * (1 - down) };
	};
	// Blank until the hand-over, then the face comes up; a ring swells from the edge from just before touchdown.
	const landing = (since, fall) => {
		const after = since - fall;
		return { face: clamp((after - (A.handoff ?? 0.6)) / (A.faceUp ?? 0.072)), ring: after >= -0.1 && after < 1 ? after : null };
	};
	const arrivals = pool.map(entry => arrivalOf(entry.card, entry.sourceIndex));
	const wallPoses = pool.map(entry => {
		const { card, sourceIndex: i } = entry;
		const fromCenter = Math.min(1.6, Math.abs(card.source.x - 960) / 2400 + Math.abs(card.source.y - 540) / 1600);
		const s = ease((time - 23 - fromCenter * 0.3) / 1.3);
		let at = baseWallAt(card, i), scale = 1, face = 1, ring = null, shown = 1;
		at[2] += (1 - s) * (170 + i % 4 * 45);
		let rot = [(1 - s) * 0.4, (1 - s) * -0.32, (1 - s) * (i % 2 ? 0.14 : -0.14)];
		const title = data.titleCarry.land + (A.handoff ?? 0.6);
		const handoff = card.reserved !== undefined && card.reserved < 6 ? ease((time - 25.9 - card.reserved * 0.05) / 0.7) : card.reserved === 6 ? ease((time - title) / 0.2) : 1;
		const arrival = arrivals[i];
		if (arrival && arrival.since < arrival.fall + 1.5) {
			// Nothing of it shows before its teammate sets off with it, from wholly off the frame.
			if (arrival.since < -HAND.enter) shown = 0;
			({ at, rot, scale } = heldPose(arrival, i));
			({ face, ring } = landing(arrival.since, arrival.fall));
		}
		const projected = screenAt(at);
		const azimuth = camera.azimuth * Math.PI / 180, elevation = camera.elevation * Math.PI / 180;
		const marginX = (card.w * Math.abs(Math.sin(azimuth)) + card.d * Math.abs(Math.cos(azimuth))) * scale * projectionScale / 2 + 12;
		const marginY = (card.w * Math.abs(Math.cos(azimuth)) + card.d * Math.abs(Math.sin(azimuth))) * Math.sin(elevation) * scale * projectionScale / 2 + 12;
		const visible = Math.abs(projected[0]) * projectionScale < camera.width / 2 + marginX && Math.abs(projected[1]) * projectionScale < camera.height / 2 + marginY;
		// The bento's first tile hands its orange to Team ’26 at 22.2 s, so its wall gap never re-lights: orange stays on the subject.
		const highlight = 0;
		const entryProgress = clamp((camera.width / 2 + marginX - projected[0] * projectionScale) / (marginX * 2));
		const enteringRight = time >= wallStart && visible && projected[0] * projectionScale > camera.width / 2 - marginX;
		const arriving = Boolean(arrival && arrival.since >= -HAND.enter && arrival.since < arrival.fall + 0.75);
		return { ...pose(at, rot, scale, visible ? s * handoff * shown : 0, highlight), sourceIndex: i, key: entry.key, index: entry.index, incoming: enteringRight || arriving, entryEdge: enteringRight ? "right" : null, entryProgress, visible, screen: projected, face, ring, arrival: arrival ? { since: arrival.since, touchdown: arrival.touchdown, held: true } : null };
	});
	// A stack slot carried in deals its own cards as it is set down: they ride in on it, then settle top first, a beat apart.
	// A stack no hand brings in is already dealt.
	const wallCards = (data.wallCards ?? []).map(child => {
		const i = child.slot, card = data.wall[i], parent = wallPoses[i], arrival = arrivals[i];
		let delay = 0;
		for (let step = 1; step <= child.index + 1; step += 1) delay += (A.dealS ?? 0.09) * mix(0.7, 1.3, random(i * 7 + step, 40));
		const base = baseWallAt(card, i);
		let at = [base[0] + child.dx, base[1] + child.dy, 1.1 + (1 - ease((time - 23) / 1.3)) * 170], rot = [0, 0, 0], scale = 1, face = 1, ring = null;
		if (arrival && arrival.since - delay < arrival.fall + 1.5) {
			const stackLift = (3 - child.index) * 2;
			if (arrival.since < 0) {
				// Riding in on the stack the hand carries: on its face, turned with it.
				const carried = heldPose(arrival, i), offset = turn([child.dx * carried.scale, child.dy * carried.scale, (1.1 + stackLift) * carried.scale], carried.rot);
				at = carried.at.map((value, axis) => value + offset[axis]);
				rot = carried.rot;
				scale = carried.scale;
			} else {
				// Peeling off: each card settles on its own clock, `delay` behind the slot, from where it rode in.
				const down = inOut((arrival.since - delay) / arrival.fall), tilt = heldPose({ ...arrival, since: 0 }, i).rot;
				at = [arrival.base[0] + child.dx, arrival.base[1] + child.dy, 1.1 + (HAND.lift + stackLift) * (1 - down)];
				rot = tilt.map(angle => angle * (1 - down));
				scale = 1 + HAND.grow * (1 - down);
			}
			({ face, ring } = landing(arrival.since - delay, arrival.fall));
		}
		return { ...pose(at, rot, scale, parent.alpha, 0), key: `${card.key}#${child.index}`, face, ring };
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
	let titlePose = pose([...data.title.at], [0, 0, 0], 1, ease((time - 22.2) / 0.3), ease((time - 22.2) / 0.3));
	if (time >= carry.grab) {
		const progress = clamp((time - carry.grab) / (carry.land - carry.grab)), along = ease((time - carry.grab - 0.22) / (carry.land - carry.grab - 0.47));
		const give = Math.sin(Math.PI * clamp((time - carry.grab) / 0.95)) ** 2;
		const target = [titleSlot.at[0] + titleSlot.w / 2 + shift[0], titleSlot.at[1] + titleSlot.d / 2 + shift[1], 0], at = between(data.title.at, target, along);
		const dx = target[0] - data.title.at[0], dy = target[1] - data.title.at[1], bow = Math.sin(Math.PI * along) * 0.12;
		at[0] += -dy * bow + 70 * give;
		at[1] += dx * bow - 40 * give;
		at[2] += ease((time - carry.grab) / 0.25) * (1 - ease(progress)) * 170;
		// Over the landing hand-over the tile stays opaque and turns from orange to its slot's grey, then hands over to the slot;
		// its corners ease from the bento's radius to the slot's, measured on screen through the morphing scale.
		const handover = data.titleCarry.land + (A.handoff ?? 0.6), scaleX = mix(1, titleSlot.w / data.title.w, ease(progress));
		const highlight = 1 - ease((time - carry.land) / (A.handoff ?? 0.6));
		titlePose = { ...pose(at, [-0.08 * Math.sin(progress * Math.PI), 0.12 * Math.sin(progress * Math.PI), -0.08 * Math.sin(progress * Math.PI)], scaleX, 1 - ease((time - handover) / 0.2), highlight), scaleY: mix(1, titleSlot.d / data.title.d, ease(progress)), radius: mix(9, titleSlot.r, ease(progress)) / scaleX };
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
	const cursors = [main, ...data.actors.map((actor, lane) => {
		const index = arrivals.findIndex(arrival => arrival && arrival.lane === lane && arrival.since >= -HAND.enter && arrival.since <= arrival.fall + HAND.leave);
		if (index < 0) return hiddenCursor(actor.id, "teammate");
		const arrival = arrivals[index], entry = pool[index], slot = entry.card, posed = wallPoses[index];
		const target = { kind: entry.kind, index: entry.index, key: entry.key, sourceIndex: entry.sourceIndex };
		const grip = { u: 0.5, v: 0.5 }, contact = surfacePoint(posed, slot.w, slot.d, "wall", grip), after = arrival.since - arrival.fall;
		const away = after > 0 ? leg(arrival.hold.reach, arrival.hold.leaveDistance, -arrival.hold.bow * 0.5, 1 - easeIn(after / HAND.leave)) : [0, 0];
		const held = after < 0, phase = held ? (arrival.since < -HAND.enter + 0.1 ? "grab" : "carry") : after <= 0.12 ? "release" : "leave";
		return {
			id: actor.id, role: "teammate", phase, target, heldTarget: held ? target : null, at: [contact[0] + away[0], contact[1] + away[1], contact[2]],
			// A hand is never shown on a card that is not drawn (still culled off the frame as it is carried in).
			pressed: held ? 1 : 1 - ease(after / 0.12), alpha: (held && posed.alpha <= 0.002 ? 0 : 1) * (1 - ease(after / HAND.fade)), grip, frameShare: held ? 1 : 0,
			name: arrival.name, pillAbove: arrival.hold.above, flagLeft: Boolean(arrival.hold.flagLeft), scale: posed.scale, entering: arrival.since < 0,
		};
	})];
		const doneEffect = { trace: ease((time - 10.8) / 1.1), sweep: ease((time - 11.9) / 1.1), alpha: ease((time - 10.8) / 0.14) * (1 - ease((time - 12.8) / 0.3)) };
	const elapsed = Math.max(0, time - wallStart), steadyElapsed = Math.max(0, elapsed - 3), period = wallPeriod;
	const wallLoop = { active: time >= wallStart, layout: "source-masonry", cycle: Math.floor(steadyElapsed / period), offset: steadyElapsed % period, period, elapsed, shift, velocity: wallVelocity, periodX, periodY, poolSize: pool.length, virtualPoolSize: pool.length, copyPoolLimit: 0, visibleCount: wallPoses.filter(each => each.alpha > 0.002).length, incomingCount: wallPoses.filter(each => each.incoming && each.alpha > 0.002).length, feedEdge: "right" };
	const state = { time, variant, index, phase: data.states[index].phase, camera, cards, tiles, wall, wallCards, wallCopies, wallLoop, confetti, cursors, titlePose, doneEffect, chrome: 1 - ease((time - 13.25) / 1.3), flash: 0, flashY: 0, title: titlePose.alpha };
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
		camera: { at: between(from.camera.at, camera.at, s), width: directWidth, height: directWidth * 760 / 1200, azimuth: from.camera.azimuth + angle * s, elevation: mix(from.camera.elevation, camera.elevation, s), cover: mix(from.camera.cover ?? 0, camera.cover ?? 0, s), persp: mix(from.camera.persp ?? 0, camera.persp ?? 0, s) + lensBloom(from.camera, camera, s) },
		...Object.fromEntries(["cards", "tiles", "wall", "wallCards", "confetti"].map(key => [key, state[key].map((posed, i) => blendPose(from[key][i], posed))])),
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
