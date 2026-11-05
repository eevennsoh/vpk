import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeBlock, excerpt } from '../../../../.agents/skills/vpk-html/scripts/code/highlight.mjs';

const sourceRoot = 'https://bitbucket.org/atlassian/jira-team-eu26-motion/src/8588b00ff81cb5e8341a462158c747c6d990667c/components/projects/jira-team-eu26-end/finale/';
// Excerpts are read at build time from VPK's copy of the finale, so each code block quotes real source.
const localRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../components/projects/jira-team-eu26-end/finale');
const excerpts = [
	['jira-team-eu26-end-finale.tsx', 75, 83, 'Sets up the confetti and the drop puff, checks readiness, and records which cards are in Done.'],
	['lib/finale-confetti-target.ts', 70, 81, 'Trims each landed card’s box to the visible Done list and merges them into one footprint.'],
	['hooks/use-finale-drop-puff.ts', 27, 36, 'Waits for the dropped cards to settle, then plays a small burst from their landing box.'],
	['lib/finale-trigger.ts', 9, 18, 'Returns true only when every required keynote card is in the Done column.'],
	['lib/finale-confetti.ts', 521, 533, 'Gives each cannon piece a diagonal angle, a depth layer, a launch speed and drag.'],
	['lib/finale-confetti.ts', 792, 801, 'The GPU vortex turns each piece around its sink while pulling it in and down.'],
	['lib/finale-column-flash.ts', 226, 237, 'The flash ring grows quickly at first, then slows to a steady pace up the column.'],
	['lib/finale-card-motion.ts', 124, 137, 'Places each card on a golden-angle spiral, with depth from a seeded hash.'],
	['lib/finale-camera.ts', 88, 100, 'The camera keyframes: hold, recoil, reveal, sweep, zoom to the hero, and back to rest.'],
	['lib/finale-wall-motion.ts', 154, 164, 'After touchdown, the HTML face comes up first, then the GL sheet fades out.'],
	['lib/finale-wall-motion.ts', 427, 440, 'A thrown card flies through the air and blends into its gap, which moves with the wall.'],
	['lib/finale-wall-layout.ts', 315, 324, 'Copies one period’s bucket of slots a whole period along, so the wall repeats.'],
];
const codeFor = index => {
	const [file, from, to, caption] = excerpts[index];
	const source = fs.readFileSync(path.join(localRoot, file), 'utf8');
	return codeBlock({ code: excerpt(source, from, to), lang: file.endsWith('x') ? 'tsx' : 'ts', file: file.split('/').at(-1), href: sourceRoot + file, start: from, caption });
};
const notes = [
	['The board is the starting frame. Keep the work in view while one orange card becomes the subject. The study removes labels and cover art so the handoff is easier to follow.', 'jira-team-eu26-end-finale.tsx'],
	['The cursor stays attached to the same point on the card through its lift, travel and release. Once it lands, the full face fits inside the Done column’s clip window.', 'hooks/use-finale-drop-puff.ts'],
	['A landing rectangle seeds a small burst around the new arrival. This local reward clears before the next act. In production, it uses the shared WebGL confetti renderer and its own landing wait.', 'lib/finale-confetti.ts'],
	['The readiness check tracks the required keynote cards. When that set is complete, the finale begins. In the study, three spaced cards remain visible in Done while the rest of the board supplies context.', 'lib/finale-trigger.ts'],
	['Two cannons fire upward and inward from opposite sides. Different depths, spins and speeds make the paper feel like a volume. The production player is prewarmed and can render through an OffscreenCanvas worker.', 'lib/play-finale-confetti.ts'],
	['The broad burst gathers into a rotating sink near Done. This celebration has its own show clock; the production finale clock begins when gathering finishes.', 'lib/finale-confetti.ts'],
	['Three light paths trace the actual card borders, followed by a directional gradient clipped to their faces. This is the refined study treatment. The linked production pass instead samples an image of the column through a fragment shader.', 'lib/finale-column-flash.ts'],
	['The production app captures the card faces as textures on thin Three.js sheets. Seeded positions, rotations and depth spread them into a field. Its sheet shader adds paper flutter and bending; the study uses solid SVG faces.', 'lib/finale-card-motion.ts'],
	['The camera recoils, opens the field, then closes on Agent Session Tracking. Camera framing has its own authored path, separate from each card’s pose, so the subject remains clear as the space changes.', 'lib/finale-camera.ts'],
	['The hero lands first, then five other sheets assemble around it. In production, each animated sheet hands off to its matching HTML tile after touchdown. The shared pose makes that change read as one object.', 'lib/finale-sheet-gl.ts'],
	['The six tiles travel toward moving gaps in a larger wall. A staged cursor carries the title into its own slot. The cards keep their mixed proportions through the journey rather than becoming uniform tiles.', 'lib/finale-wall-motion.ts'],
	['One irregular field of wide, tall, square and small cards glides diagonally. The study recycles each card offscreen, with no duplicate wall rows. Teammate cursors keep placing work; Play lets this final state continue until paused.', 'lib/finale-wall-layout.ts'],
];
export function storySteps(data) {
	return data.states.map((state, index) => ({ ...state, seconds: state.time / data.playbackRate, body: notes[index][0], source: notes[index][1].split('/').at(-1), href: sourceRoot + notes[index][1], code: codeFor(index) }));
}
