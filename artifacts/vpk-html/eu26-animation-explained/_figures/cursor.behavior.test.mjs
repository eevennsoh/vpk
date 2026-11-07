import assert from 'node:assert/strict';
import test from 'node:test';
import { data, model } from './eu26-hero.hero.mjs';

const variants = ['paper'];
// The guided sequence every quarter second, then the looping wall densely enough to meet every teammate's hold.
const times = [...Array.from({ length: 137 }, (_, index) => index / 4), ...Array.from({ length: 412 }, (_, index) => 34.25 + index / 4), 500, 1000];
const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));
const poseFor = (state, target) => target.kind === 'title' ? state.titlePose : state[{ story: 'cards', tile: 'tiles', wall: 'wall' }[target.kind]][target.index];
const sizeFor = target => target.kind === 'title' ? data.title : data[{ story: 'cards', tile: 'features', wall: 'wall' }[target.kind]][target.index];

function unturn(vector, [rx, ry, rz]) {
	const [x, y, z] = vector;
	const afterZ = [x * Math.cos(rz) + y * Math.sin(rz), -x * Math.sin(rz) + y * Math.cos(rz), z];
	const afterY = [afterZ[0] * Math.cos(ry) - afterZ[2] * Math.sin(ry), afterZ[1], afterZ[0] * Math.sin(ry) + afterZ[2] * Math.cos(ry)];
	return [afterY[0], afterY[1] * Math.cos(rx) + afterY[2] * Math.sin(rx), -afterY[1] * Math.sin(rx) + afterY[2] * Math.cos(rx)];
}

test('cursor grips contact the posed paper surfaces while dragging', () => {
	const heldStories = new Set();
	const visibleActors = new Set();
	let contacts = 0;
	for (const variant of variants) {
		for (const time of times) {
			const state = model({ time, variant }, data);
			assert.deepEqual(state.cursors.map(cursor => cursor.id).sort(), ['main', 'teammate-1', 'teammate-2', 'teammate-3']);
			const visible = state.cursors.filter(cursor => cursor.alpha > .15);
			for (let left = 0; left < visible.length; left++) {
				visibleActors.add(visible[left].id);
				for (let right = left + 1; right < visible.length; right++) assert.ok(distance(visible[left].at, visible[right].at) > .05, 'visible actors occupy different points');
			}
			for (const cursor of state.cursors) {
				assert.ok(cursor.alpha >= 0 && cursor.alpha <= 1);
				assert.ok(cursor.pressed >= 0 && cursor.pressed <= 1);
				if (!cursor.heldTarget || cursor.alpha <= .15) continue;
				assert.ok(['grab', 'carry'].includes(cursor.phase), 'a held target belongs to a grab or carry phase');
				assert.deepEqual(cursor.target, cursor.heldTarget);
				if (cursor.phase === 'carry') assert.ok(cursor.pressed >= .99, 'the mouse remains pressed while carrying');
				const pose = poseFor(state, cursor.heldTarget);
				const size = sizeFor(cursor.heldTarget);
				assert.ok(pose.alpha > .15, 'the carried object is visible');
				const local = unturn(cursor.at.map((value, index) => value - pose.at[index]), pose.rot);
				const expected = [(cursor.grip.u - .5) * size.w * pose.scale, (cursor.grip.v - .5) * size.d * (pose.scaleY ?? pose.scale), data.materialDepths[cursor.heldTarget.kind] * pose.scale];
				assert.ok(distance(local, expected) < .05, `${variant} ${cursor.id} contacts its actual grip at ${time} seconds`);
				if (cursor.heldTarget.kind === 'story') heldStories.add(cursor.heldTarget.index);
				contacts += 1;
			}
		}
	}
	assert.deepEqual([...visibleActors].sort(), ['main', 'teammate-1', 'teammate-2', 'teammate-3']);
	for (const story of [15, 0]) assert.ok(heldStories.has(story), `a cursor visibly drags story ${story}`);
	assert.ok(contacts > 0);
});

test('the title is carried into its reserved wall gap', () => {
	const gapIndex = data.wall.findIndex(slot => slot.reserved === 6);
	assert.ok(gapIndex >= 0);
	const gap = data.wall[gapIndex];
	for (const variant of variants) {
		const carried = Array.from({ length: 33 }, (_, index) => 22.5 + index / 8).map(time => model({ time, variant }, data)).filter(state => state.cursors.some(cursor => cursor.id === 'main' && cursor.heldTarget?.kind === 'title' && cursor.phase === 'carry'));
		assert.ok(carried.length >= 3, 'the title has a visible carry interval');
		assert.ok(carried.every(state => state.titlePose.alpha > .5));
		assert.ok(carried.some(state => distance(state.titlePose.at, carried[0].titlePose.at) > 120), 'the title itself moves with its cursor');
		const landed = model({ time: 26.5, variant }, data);
		assert.ok(Math.hypot(landed.titlePose.at[0] - landed.wall[gapIndex].at[0], landed.titlePose.at[1] - landed.wall[gapIndex].at[1]) < .05, 'the title arrives at the reserved gap');
		assert.ok(Math.abs(landed.titlePose.at[2] - landed.wall[gapIndex].at[2]) < 12);
		assert.ok(data.title.w * landed.titlePose.scale <= gap.w + 1);
		assert.ok(data.title.d * (landed.titlePose.scaleY ?? landed.titlePose.scale) <= gap.d + 1);
	}
});

test('teammates catch a card already coming down and ride it into its slot', () => {
	for (const variant of variants) {
		const rides = new Map();
		for (let time = 27; time <= 130; time += 0.05) {
			const state = model({ time, variant }, data);
			for (const cursor of state.cursors.filter(cursor => cursor.role === 'teammate' && cursor.heldTarget?.kind === 'wall' && cursor.alpha > .5)) {
				const pose = state.wall[cursor.heldTarget.index], key = `${cursor.id}:${cursor.heldTarget.key}`;
				const ride = rides.get(key) || { id: cursor.id, target: cursor.heldTarget.key, index: cursor.heldTarget.index, first: time, heights: [] };
				ride.heights.push(pose.at[2]);
				ride.last = time;
				rides.set(key, ride);
			}
		}
		assert.ok(rides.size >= 6, `teammates catch cards through the loop (${rides.size})`);
		assert.equal(new Set([...rides.values()].map(ride => ride.id)).size, 3, 'all three teammates take part');
		for (const ride of rides.values()) {
			if (ride.last > 129) continue; // a ride still in progress when the scan ends
			const before = model({ time: ride.first - 0.7, variant }, data).wall[ride.index];
			assert.ok(before.alpha > .05 && before.at[2] > 20, `${ride.target} was already waiting in the air before ${ride.id} reached it (not carried in from off the frame)`);
			assert.ok(ride.heights[0] > 5, `${ride.id} catches ${ride.target} above the wall`);
			for (let i = 1; i < ride.heights.length; i++) assert.ok(ride.heights[i] <= ride.heights[i - 1] + 1e-6, `${ride.target} only comes down while held`);
			const landed = model({ time: ride.last + 0.2, variant }, data).wall[ride.index];
			assert.ok(Math.abs(landed.at[2]) < 1e-6 && landed.rot.every(angle => Math.abs(angle) < 1e-6) && Math.abs(landed.scale - 1) < 1e-6, `${ride.target} rests flat in its slot after the ride`);
		}
	}
});

test('reverse scrubbing reproduces the same cursor, title and wall poses', () => {
	for (const variant of variants) {
		const forward = new Map(times.map(time => {
			const state = model({ time, variant }, data);
			return [time, { cursors: state.cursors, title: state.titlePose, wall: state.wall }];
		}));
		for (const time of [...times].reverse()) {
			const state = model({ time, variant }, data);
			assert.deepEqual({ cursors: state.cursors, title: state.titlePose, wall: state.wall }, forward.get(time), `${variant} poses are deterministic at ${time} seconds`);
		}
	}
});
