import assert from 'node:assert/strict';
import test from 'node:test';
import { data, model } from './eu26-hero.hero.mjs';

const at = (time, variant = 'paper') => model({ time, variant }, data);
const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));
const wallPieces = state => [...state.wall, ...state.wallCopies];

test('intro cards hold until the group drag, column 3 closes its gap, then every board card leaves for Done', () => {
	const initial = at(0);
	const pitch = data.cards[1].home[1] - data.cards[0].home[1];
	const moved = new Set([15]);
	const retained = initial.cards.flatMap((pose, index) => pose.alpha > .99 && !moved.has(index) ? [index] : []);
	const reflowed = new Set(retained.filter(index => index > 15));
	assert.ok(retained.length >= 6, 'the source columns keep the previous visible cards');
	for (const time of [0, .5, 1, 1.9, 2, 4]) {
		const state = at(time);
		for (const index of retained) {
			assert.equal(state.cards[index].alpha, 1, `story ${index} remains visible at ${time}s`);
			assert.notEqual(state.cards[index].clip, 'done', 'a source card is not clipped to Done before the group drag');
			assert.equal(state.cards[index].clip, data.cards[index].row === 3 || (reflowed.has(index) && data.cards[index].row === 4) ? `column${data.cards[index].column}` : false, `story ${index} is clipped only by its own column, and only in the row at its bottom edge`);
			if (!reflowed.has(index)) assert.deepEqual(state.cards[index].at, initial.cards[index].at, `story ${index} keeps its board position`);
			else if (time >= 1.4) assert.ok(Math.abs(state.cards[index].at[1] - (initial.cards[index].at[1] - pitch)) < 1e-6, `story ${index} moves up one row to close the gap`);
		}
		if (time < 2) {
			const cursor = state.cursors.find(cursor => cursor.id === 'main');
			assert.equal(cursor.heldTarget?.kind, 'story');
			assert.equal(cursor.heldTarget?.index, 15);
			assert.equal(cursor.alpha, 1);
			assert.equal(state.cards[15].clip, false, 'the card crosses the board edge without a Done-window clip');
			assert.ok(state.cards[15].at[2] >= data.cards[15].home[2], 'the card stays above the board');
		}
	}
	for (const time of [6.5, 10]) {
		const state = at(time);
		for (const index of retained) assert.ok(state.cards[index].alpha < .001 || state.cards[index].clip, `story ${index} has left the board for Done at ${time}s`);
	}
	const landed = at(2).cards[15];
	const firstRow = data.doneList.cards[0];
	assert.deepEqual(landed.at.slice(0, 2), [firstRow.x + firstRow.w / 2, firstRow.y + firstRow.d / 2]);
});

test('every story column shows a fourth card clipped at its bottom edge, released once the card is lifted', () => {
	const rowThree = column => data.cards.findIndex(card => card.column === column && card.row === 3);
	for (const column of [0, 1, 2]) {
		const index = rowThree(column), card = data.cards[index], viewport = data.columnViewports[column];
		const state = at(0).cards[index];
		assert.equal(state.alpha, 1, `column ${column} shows its row-3 card`);
		assert.equal(state.clip, `column${column}`, `column ${column} clips its row-3 card`);
		assert.ok(card.home[1] < viewport.y + viewport.d && card.home[1] + card.d > viewport.y + viewport.d, 'the row-3 card runs past the column window bottom');
		assert.ok(viewport.x >= -394 + column * 205 && viewport.x + viewport.w <= -394 + column * 205 + 193 && viewport.y + viewport.d <= 294, 'the window sits inside its column');
	}
	// Column 2 closes its gap as card 15 leaves: row 4 scrolls up into the clipped row-3 slot.
	const scrolled = data.cards.findIndex(card => card.column === 2 && card.row === 4);
	assert.equal(at(0).cards[scrolled].alpha, 0);
	assert.equal(at(2).cards[scrolled].alpha, 1);
	assert.equal(at(2).cards[scrolled].clip, 'column2');
	// Lifted into the group drag, every row-3 card leaves its column clip behind.
	for (const index of [rowThree(0), rowThree(1), scrolled]) {
		for (const time of [4.9, 5.2]) assert.equal(at(time).cards[index].clip, false, `story ${index} is not clipped while carried at ${time}s`);
		assert.ok(at(16).cards[index].alpha > .5 && at(16).cards[index].clip === false, `story ${index} joins the field unclipped`);
	}
	const rows = new Set([0, 1, 2].flatMap(column => at(0).cards.flatMap((pose, index) => data.cards[index].column === column && pose.alpha > .99 ? [data.cards[index].row] : [])).map(String));
	assert.deepEqual([...rows].sort(), ['0', '1', '2', '3']);
});

test('the first drop puffs confetti out from under every edge of the landed card, then it settles and fades', () => {
	const card = data.doneList.cards[0];
	// Distance outside the card's footprint (0 inside it).
	const outside = ([x, y]) => Math.hypot(Math.max(card.x - x, 0, x - card.x - card.w), Math.max(card.y - y, 0, y - card.y - card.d));
	const early = at(2.12).confetti, mid = at(2.4).confetti, late = at(3.4).confetti;
	const puff = early.map((piece, index) => [piece, index]).filter(([piece]) => piece.alpha > 0.5 && piece.act === 'puff');
	assert.ok(puff.length >= 40, `a ring of paper leaves the card (${puff.length})`);
	const sides = new Set(puff.map(([piece]) => piece.at[1] < card.y ? 'top' : piece.at[1] > card.y + card.d ? 'bottom' : piece.at[0] < card.x ? 'left' : 'right'));
	assert.deepEqual([...sides].sort(), ['bottom', 'left', 'right', 'top'], 'it leaves every edge at once');
	for (const [piece, index] of puff) {
		assert.ok(outside(piece.at) > 0, 'no piece crosses back over the card');
		assert.ok(outside(mid[index].at) >= outside(piece.at) - 3, 'each piece skids outward');
		const fast = distance(at(2.12).confetti[index].at, at(2.2).confetti[index].at), slow = distance(at(3.0).confetti[index].at, at(3.08).confetti[index].at);
		assert.ok(slow < fast * 0.5, 'drag spends the launch: the puff decelerates hard');
		assert.ok(late[index].at[2] < 30, 'the puff stays low on the page');
	}
	assert.ok(at(5).confetti.every(piece => piece.alpha === 0), 'the puff is gone before the next drag');
});

test('the finale fires two cannons, hangs, then a vortex drains every piece onto the Done column foot', () => {
	const viewport = data.doneList.viewport, footY = viewport.y + viewport.d, boardX = data.board.x + data.board.w / 2;
	const launch = at(6.3).confetti.filter(piece => piece.alpha > 0.5);
	assert.ok(launch.some(piece => piece.at[0] < boardX - 150) && launch.some(piece => piece.at[0] > boardX + 150), 'both cannons fire from opposite sides');
	const rise = at(6.3).confetti.map((piece, index) => [piece, at(6.6).confetti[index]]).filter(([piece]) => piece.alpha > 0.5);
	assert.ok(rise.filter(([a, b]) => b.at[2] > a.at[2]).length > rise.length * 0.8, 'the fan rises');
	assert.ok(rise.filter(([a, b]) => Math.abs(b.at[0] - boardX) < Math.abs(a.at[0] - boardX)).length > rise.length * 0.7, 'and closes inward');
	// Bullet time: the hang barely moves.
	const hang = Math.max(...at(8.5).confetti.map((piece, index) => distance(piece.at, at(8.6).confetti[index].at)));
	const pop = Math.max(...at(6.3).confetti.map((piece, index) => distance(piece.at, at(6.4).confetti[index].at)));
	assert.ok(hang < pop * 0.2, `the hang is slow motion (${hang.toFixed(1)} vs ${pop.toFixed(1)})`);
	const near = at(12.2).confetti.filter(piece => piece.alpha > 0.01);
	assert.ok(near.every(piece => Math.abs(piece.at[1] - footY) < 40 && piece.at[0] > viewport.x - 20 && piece.at[0] < viewport.x + viewport.w + 20 && piece.at[2] < 40), 'the last pieces land on the column foot');
	assert.ok(at(12.7).confetti.every(piece => piece.alpha === 0), 'every piece is gone before the column flash');
});

test('the finale cannons fire from the board\'s near corners and every piece stays over the board', () => {
	const board = data.board;
	// How far a plan point lies outside the board chassis (0 inside).
	const outside = ([x, y]) => Math.max(0, board.x - x, x - (board.x + board.w), board.y - y, y - (board.y + board.d));
	let samples = 0, near = 0, worst = 0;
	for (let step = 0; step <= 130; step += 1) {
		for (const piece of at(6 + step * 0.05).confetti) {
			if (piece.alpha <= 0) continue;
			const off = outside(piece.at);
			samples += 1;
			if (off <= 40) near += 1;
			worst = Math.max(worst, off);
		}
	}
	assert.ok(samples > 140 * 60, `the finale is sampled (${samples})`);
	assert.ok(near / samples >= 0.97, `pieces stay over the board (${(100 * near / samples).toFixed(1)}% within 40 units)`);
	assert.ok(worst <= 120, `no piece lands out on the ground (${worst.toFixed(1)} units past the edge)`);
	// Each cannon's pieces start at its corner: the board's near-left and near-right corners at the 6 s camera (+y faces the viewer).
	const corners = [[board.x, board.y + board.d], [board.x + board.w, board.y + board.d]];
	const view = at(6).camera, a = view.azimuth * Math.PI / 180, depth = ([x, y]) => x * Math.cos(a) + y * Math.sin(a);
	const chassis = [[board.x, board.y], [board.x + board.w, board.y], ...corners];
	assert.deepEqual([...chassis].sort((l, r) => depth(r) - depth(l)).slice(0, 2).sort((l, r) => l[0] - r[0]), corners, 'the cannon corners are the two nearest the viewer');
	const fine = Array.from({ length: 241 }, (_, step) => at(6 + step / 400));
	const count = data.confetti.length, starts = Array.from({ length: count }, (_, index) => fine.find(state => state.confetti[index].alpha > 0)?.confetti[index].at);
	for (const [index, start] of starts.entries()) {
		assert.ok(start, `piece ${index} fires in the first 0.6 s`);
		const corner = corners[index < count / 2 ? 0 : 1];
		assert.ok(Math.hypot(start[0] - corner[0], start[1] - corner[1]) < 60, `piece ${index} leaves its corner (${start[0].toFixed(0)}, ${start[1].toFixed(0)})`);
	}
	// The burst spreads across the board.
	for (const time of [7, 7.5, 9]) {
		const xs = at(time).confetti.filter(piece => piece.alpha > 0.5).map(piece => piece.at[0]);
		assert.ok(Math.max(...xs) - Math.min(...xs) > board.w * 0.6, `the burst spreads across the board at ${time}s`);
	}
});

test('placement camera tilts and zooms, then faces the assembled six-tile bento', () => {
	const placements = [3, 4.3, 5.8, 7].map(time => at(time).camera);
	for (const axis of ['azimuth', 'elevation', 'width']) assert.ok(new Set(placements.map(camera => camera[axis])).size >= 3, `${axis} changes during placement`);
	const front = at(22);
	assert.ok(Math.abs(front.camera.elevation - 90) < .01, 'the bento plane faces the viewer');
	assert.equal(front.tiles.length, 6);
	for (const tile of front.tiles) {
		assert.equal(tile.alpha, 1);
		assert.ok(tile.rot.every(value => Math.abs(value) < .001), 'assembled tiles have no residual tumble');
	}
});

test('composed camera shots hold through the action while orbiting between chapters', () => {
	for (const [start, end] of [[6.2, 10.3], [11.9, 12.9], [21.8, 22.2], [27.2, 40]]) {
		const shot = at(start).camera;
		for (let time = start; time <= end; time += .1) assert.deepEqual(at(time).camera, shot, `the shot holds at ${time}s`);
	}
	const orbit = [0, 3, 6, 12, 16, 19, 22, 28].map(time => at(time).camera);
	assert.ok(Math.max(...orbit.map(camera => camera.azimuth)) - Math.min(...orbit.map(camera => camera.azimuth)) >= 50, 'the camera still travels around the scene');
	for (let time = 4; time < 5.8; time += .02) {
		assert.ok(at(time + .01).camera.azimuth >= at(time).camera.azimuth - .00001, 'placement follows one orbit without rocking back');
	}
});

test('state navigation blends endpoint poses without traversing intermediate effects', () => {
	const from = at(0), to = at(34);
	const middle = model({ time: 34, transition: { from, progress: .5 } }, data);
	// A direct jump blends the two endpoint cameras; it never detours through intermediate shots (the bento orbit).
	assert.ok(Math.abs(middle.camera.azimuth - (from.camera.azimuth + to.camera.azimuth) / 2) < 1e-9, 'azimuth blends the endpoints directly');
	assert.ok(Math.abs(middle.camera.elevation - (from.camera.elevation + to.camera.elevation) / 2) < 1e-9, 'elevation blends the endpoints directly');
	assert.ok(middle.confetti.every(particle => particle.alpha === 0), 'a direct jump does not replay intervening confetti');
	assert.ok(distance(middle.cards[15].at, from.cards[15].at) > 1, 'the object moves directly between its endpoints');
	assert.ok(distance(middle.cards[15].at, to.cards[15].at) > 1);
	assert.deepEqual(model({ time: 34, transition: { from, progress: 1 } }, data), to, 'the transition lands on the exact seek pose');
});

test('Done completes its border trace before the directional sweep', () => {
	const samples = Array.from({ length: 161 }, (_, index) => at(9 + index / 40));
	const tracing = samples.filter(state => state.doneEffect.trace > 0 && state.doneEffect.trace < 1);
	const sweeping = samples.filter(state => state.doneEffect.sweep > 0 && state.doneEffect.sweep < 1);
	assert.ok(tracing.length > 20 && sweeping.length > 20, 'both effects occupy smooth intervals');
	for (const state of tracing) {
		assert.equal(state.doneEffect.sweep, 0, 'the fill remains still until the perimeter trace completes');
		assert.ok(state.doneEffect.alpha > 0);
	}
	for (const state of sweeping) assert.equal(state.doneEffect.trace, 1, 'the gradient follows a completed trace');
	assert.ok(sweeping[0].time - tracing.at(-1).time < .08, 'the sweep follows the trace immediately');
	assert.equal(at(14).doneEffect.alpha, 0, 'the effect clears before the field sequence');
});

test('seeded explosion varies velocity and pitch/yaw while orange blends continuously to white', () => {
	assert.deepEqual(at(14.4), at(14.4), 'seeking a frame is deterministic');
	const otherSeed = model({ time: 14.4 }, { ...data, motion: { ...data.motion, seed: (data.motion?.seed ?? 26031) + 1 } });
	assert.ok(at(14.4).cards.some((card, index) => distance(card.at, otherSeed.cards[index].at) > 1), 'the explosion responds to its seed');
	const scattered = at(14.4).cards.filter((_, index) => index !== 15);
	assert.ok(new Set(scattered.map(card => card.rot[0].toFixed(3))).size > 12, 'cards have varied pitch');
	assert.ok(new Set(scattered.map(card => card.rot[1].toFixed(3))).size > 12, 'cards have varied yaw');
	assert.ok(new Set(scattered.map(card => card.at[2].toFixed(1))).size > 12, 'cards disperse into varying depths');
	for (const variant of data.variants.map(variant => variant.id)) {
		let previous = at(13.2, variant);
		let partial = 0;
		for (let frame = 1; frame <= 180; frame++) {
			const time = 13.2 + frame / 60, state = at(time, variant);
			assert.equal(state.cards[15].highlight, 1, 'the active card keeps its orange highlight');
			for (let index = 0; index < state.cards.length; index++) {
				const card = state.cards[index];
				assert.ok(distance(card.at, previous.cards[index].at) < 35, 'the explosion has no positional pop');
				if (index === 15) continue;
				assert.ok(card.highlight <= previous.cards[index].highlight + .00001, 'white conversion moves in one direction');
				assert.ok(Math.abs(card.highlight - previous.cards[index].highlight) < .015, 'orange changes continuously across adjacent frames');
				if (card.highlight > .05 && card.highlight < .95) partial++;
			}
			previous = state;
		}
		assert.ok(partial > 100, 'intermediate blends are visible');
		assert.equal(at(16.2, variant).cards.filter(card => card.highlight > .001).length, 1, 'only the active story remains orange');
	}
});

test('the source masonry wall keeps scrolling sideways through distant times with one card per source item', () => {
	const beginning = at(40), capacity = data.wall.length;
	assert.equal(beginning.wallLoop.layout, 'source-masonry');
	assert.equal(beginning.wallLoop.copyPoolLimit, 0, 'one source field replaces duplicate wall layouts');
	const period = beginning.wallLoop.period;
	const boundaries = [1, 3, 7].map(cycle => 30 + period * cycle);
	for (const time of [40, 100, 500, 10000, ...boundaries]) {
		const before = at(time - .001), after = at(time + .001);
		assert.equal(after.time, time + .001, 'model time continues beyond the guided timeline');
		assert.equal(after.wallLoop.poolSize, capacity, 'each source item has exactly one reusable card');
		assert.equal(after.wallLoop.virtualPoolSize, capacity, 'the source pool never multiplies');
		assert.deepEqual(after.wallCopies, [], 'the scene contains no repeated wall copies');
		assert.equal(new Set(after.wall.map(piece => piece.key)).size, capacity, 'wall keys stay unique');
		assert.equal(new Set(after.wall.map(piece => piece.sourceIndex)).size, capacity, 'each source appears once');
		assert.equal(after.wallLoop.active, true);
		assert.equal(after.wallLoop.feedEdge, 'right');
		assert.ok(after.wallLoop.visibleCount > 10, 'the wall still fills the scene');
		const afterByKey = new Map(wallPieces(after).map(piece => [piece.key, piece]));
		let moving = 0;
		for (const piece of wallPieces(before)) {
			const next = afterByKey.get(piece.key);
			if (!next || piece.alpha <= .5 || next.alpha <= .5 || piece.incoming || next.incoming) continue;
			const change = distance(piece.at, next.at);
			assert.ok(change < .1, 'recycling never teleports a visible tile');
			if (change > .001) moving++;
		}
		assert.ok(moving > 10, 'visible cards keep moving sideways');
	}
});

test('no card ever moves on its own: every visible card not yet landed is held by a visible teammate cursor', () => {
	for (const aspect of [undefined, 0.83]) {
		let held = 0;
		for (let time = 27; time <= 120 + 1e-9; time += .05) {
			const state = model({ time, variant: 'paper', aspect }, data);
			const holders = new Set(state.cursors.filter(cursor => cursor.role === 'teammate' && cursor.heldTarget && cursor.alpha > .5).map(cursor => cursor.heldTarget.key));
			for (const pose of state.wall) {
				if (pose.alpha < .02 || !pose.arrival || time >= pose.arrival.touchdown) continue;
				assert.ok(holders.has(pose.key), `${pose.key} moves without a cursor at ${time.toFixed(2)} s (aspect ${aspect ?? 'default'})`);
				assert.ok(pose.scale <= 1.04 && pose.rot.every(angle => Math.abs(angle) <= .04) && pose.at[2] <= 10, 'a carried card is at its own size, a touch lifted and nearly flat');
				held++;
			}
		}
		assert.ok(held > 200, `cards are carried in through the loop (${held} samples)`);
	}
});

test('a carried card lands blank, then its ring plays and its face comes up; reduced motion shows the wall landed', () => {
	const seen = new Map();
	for (let time = 35; time < 130; time += .1) {
		at(time).wall.forEach((pose, index) => {
			if (pose.arrival && pose.alpha > .05) seen.set(`${pose.key}@${pose.arrival.touchdown.toFixed(3)}`, { index, touchdown: pose.arrival.touchdown });
		});
	}
	assert.ok(seen.size >= 9, `arrivals repeat through the loop (${seen.size})`);
	for (const { index, touchdown } of seen.values()) {
		const before = at(touchdown - .05).wall[index], landed = at(touchdown + .2).wall[index], settled = at(touchdown + 1.2).wall[index];
		assert.equal(before.face, 0, 'a carried card is a blank sheet');
		assert.ok(Math.abs(landed.at[2]) < 1e-6 && Math.abs(landed.scale - 1) < 1e-6, 'it rests flat at its own size once set down');
		assert.ok(landed.face < 1 && landed.ring !== null, 'the ring plays before the face comes up');
		assert.equal(settled.face, 1);
		assert.equal(settled.ring, null);
	}
	const reduced = model({ time: 60, variant: 'paper', reduced: true }, data);
	assert.ok(reduced.wall.every(pose => pose.arrival === null && pose.face === 1 && Math.abs(pose.at[2]) < 1e-6), 'reduced motion shows the wall landed');
	assert.ok(reduced.cursors.filter(cursor => cursor.role === 'teammate').every(cursor => cursor.alpha === 0), 'and no teammate cursor moves');
});

test('a stack carried in deals its own cards top first, a beat apart; a stack no hand brings is already dealt', () => {
	const slots = [...new Set(data.wallCards.map(card => card.slot))];
	let dealt = 0;
	for (const slot of slots) {
		const children = data.wallCards.map((card, index) => ({ card, index })).filter(each => each.card.slot === slot);
		let touchdown = null;
		for (let time = 30; time < 240 && touchdown === null; time += .25) {
			const pose = at(time).wall[slot];
			if (pose.arrival && pose.alpha > .05) touchdown = pose.arrival.touchdown;
		}
		if (touchdown === null) {
			for (const time of [40, 90, 150]) for (const { index } of children) assert.ok(Math.abs(at(time).wallCards[index].at[2] - 1.1) < 1e-6, 'an uncarried stack is already dealt');
			continue;
		}
		const landedAt = children.map(({ index }) => {
			for (let time = touchdown - 1; time < touchdown + 2; time += .01) if (Math.abs(at(time).wallCards[index].at[2] - 1.1) < 1e-3) return time;
			return Infinity;
		});
		for (let i = 1; i < landedAt.length; i++) assert.ok(landedAt[i] - landedAt[i - 1] > .04 && landedAt[i] - landedAt[i - 1] < .2, 'each card lands a beat after the one above it');
		dealt++;
	}
	assert.ok(dealt >= 1, 'at least one stack is carried in and dealt');
});
