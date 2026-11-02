import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimelineMotion } from '../_layout/timeline-motion.mjs';
import { resolveMagneticAxisOffset } from '../../../../components/ui-custom/hooks/magnetic-proximity-model.ts';

const motion = createTimelineMotion(resolveMagneticAxisOffset);

test('normal ticks are evenly spaced without intermediate subdivisions or chapter inserts', () => {
	const marks = motion.marks(20);
	assert.equal(marks.length, 21);
	assert.equal(marks[0].fraction, 0);
	assert.equal(marks.at(-1).fraction, 1);
	for (let index = 1; index < marks.length; index++) assert.ok(Math.abs(marks[index].fraction - marks[index - 1].fraction - .05) < 1e-12);
	for (let fraction = 0; fraction <= 1; fraction += .001) {
		const nearest = marks[motion.nearest(marks, fraction)];
		assert.equal(Math.abs(nearest.fraction - fraction), Math.min(...marks.map(mark => Math.abs(mark.fraction - fraction))));
	}
});

test('the magnetic approach strengthens before entry and remains bounded like the shared VPK magnet', () => {
	const rect = { left: 100, right: 144, top: 50, bottom: 650 };
	const far = motion.target({ x: 40, y: 300 }, rect);
	const near = motion.target({ x: 106, y: 300 }, rect);
	const inside = motion.target({ x: 130, y: 300 }, rect);
	assert.equal(far.amount, 0);
	assert.ok(near.amount > 0 && near.amount < inside.amount);
	assert.equal(inside.amount, 1);
	for (const x of [-1000, 99, 110, 144, 1000]) for (const y of [-1000, 50, 500, 650, 1000]) {
		const target = motion.target({ x, y }, rect);
		assert.equal(target.x, 0);
		assert.ok(Math.abs(target.y) <= 3);
	}
});

test('selected and neighboring ticks grow from their normal size with proximity', () => {
	for (const base of [8,14]) {
		const mark={fraction:.5};
		assert.equal(motion.pose(mark,.5,400,0,true,base).scale,1);
		assert.equal(motion.pose(mark,.5,400,0,false,base).scale,1);
		const approaching=motion.pose(mark,.5,400,.3,true,base);
		const hovered=motion.pose(mark,.5,400,1,true,base);
		const neighbor=motion.pose({fraction:.55},.5,400,1,false,base);
		const far=motion.pose({fraction:1},.5,400,1,false,base);
		assert.ok(approaching.scale>1 && hovered.scale>approaching.scale);
		assert.ok(neighbor.scale>1 && neighbor.scale<hovered.scale);
		assert.ok(far.scale<1.001);
		assert.ok(Math.abs(hovered.scale*base-32)<.001);
	}

	for (const fraction of [0, .25, .5, .75, 1]) {
		const mark = { fraction };
		const rest = motion.pose(mark, .5, 624, 0, false);
		const approaching = motion.pose(mark, .5, 624, .3, false);
		const engaged = motion.pose(mark, .5, 624, 1, false);
		assert.equal(rest.scale, 1);
		assert.ok(approaching.scale>=1);
		assert.ok(engaged.scale>=approaching.scale);
		assert.equal(Math.abs(rest.offsetY), 0);
		assert.ok(Math.abs(approaching.offsetY) <= Math.abs(engaged.offsetY));
		assert.equal(Math.sign(engaged.offsetY), Math.sign(fraction - .5));
	}
	const top = motion.pose({ fraction: 0 }, .5, 624, 1, false);
	const bottom = motion.pose({ fraction: 1 }, .5, 624, 1, false);
	assert.ok(top.offsetY < 0 && bottom.offsetY > 0);
});

test('magnetic motion reverses from its current position and returns to exact rest', () => {
	const spring = motion.spring();
	for (let frame = 0; frame < 12; frame++) motion.advance(spring, 8, 1 / 120);
	assert.ok(spring.value > 4 && spring.value < 8);
	const before = spring.value;
	motion.advance(spring, -8, 1 / 120);
	assert.ok(Math.abs(spring.value - before) < 1);
	for (let frame = 0; frame < 120; frame++) motion.advance(spring, -8, 1 / 120);
	assert.ok(Math.abs(spring.value + 8) < .001);
	for (let frame = 0; frame < 240; frame++) motion.advance(spring, 0, 1 / 120);
	assert.equal(spring.value, 0);
	assert.equal(spring.velocity, 0);
	assert.equal(motion.advance(spring, 0, 1 / 120), false);
});
