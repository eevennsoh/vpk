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
			assert.equal(state.cards[index].clip, false, 'a source card is not clipped to Done before the group drag');
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

test('paired confetti cannons rise inward from both outer edges', () => {
	const centerX = data.doneList.viewport.x + data.doneList.viewport.w / 2;
	for (const launch of [2, 6]) {
		const early = at(launch + .05).confetti;
		const later = at(launch + .2).confetti;
		assert.equal(early.filter(particle => particle.alpha > 0).length, 56);
		for (let index = 0; index < early.length; index += 2) {
			const left = early[index], right = early[index + 1];
			assert.ok(left.at[0] < centerX && right.at[0] > centerX, 'both emitters start at opposite outer edges');
			assert.ok(Math.abs(left.at[0] + right.at[0] - 2 * centerX) < .00001, 'paired trajectories are symmetric');
			assert.ok(Math.abs(left.at[2] - right.at[2]) < .00001, 'paired trajectories rise together');
			assert.ok(later[index].at[0] > left.at[0] && later[index + 1].at[0] < right.at[0], 'both cannons move inward');
			assert.ok(later[index].at[2] > left.at[2] && later[index + 1].at[2] > right.at[2], 'both cannons move upward');
		}
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

test('incoming wall cards keep arriving from the right after the original three helpers finish', () => {
	let arrivals = 0;
	const helpers = new Set();
	for (let time = 35.75; time < 72; time += .5) {
		const state = at(time), later = at(time + .2);
		const laterByKey = new Map(wallPieces(later).map(piece => [piece.key, piece]));
		const handled = new Set([...state.cursors, ...later.cursors].filter(cursor => cursor.alpha > .01).map(cursor => cursor.target?.key));
		for (const piece of wallPieces(state)) {
			if (piece.entryEdge !== 'right' || piece.alpha <= .5 || handled.has(piece.key)) continue;
			const next = laterByKey.get(piece.key);
			if (!next || next.alpha <= .5) continue;
			assert.ok(next.screen[0] < piece.screen[0], 'an incoming card travels left from the right edge');
			assert.ok(next.entryProgress >= piece.entryProgress, 'the right-fed card progresses into the wall');
			arrivals++;
		}
		for (const cursor of state.cursors) if (cursor.heldTarget && cursor.role === 'teammate') helpers.add(cursor.id);
	}
	assert.ok(arrivals >= 9, 'arrivals repeat beyond a one-shot entrance');
	assert.equal(helpers.size, 3, 'all three helpers participate in the repeating wall');
});
