import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildScene } from '../../../../.agents/skills/vpk-html/scripts/iso/scene.mjs';
import { iso } from '../../../../.agents/skills/vpk-html/scripts/anatomy/vendor/kit/iso-kit.mjs';
import { shadowMove } from '../../../../.agents/skills/vpk-html/scripts/iso/solids.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const document = path.resolve(dir, '../eu26-animation-explained.html');
const ids = ['single-drop', 'big-burst', 'vortex-ignition', 'card-field', 'bento-assembly', 'infinite-wall'];
const definitions = [
	[4, [[0, 'Drag toward Done'], [1.2, 'Card touches down'], [1.6, 'Small confetti spreads'], [3.2, 'Confetti settles and fades']]],
	[5, [[0, 'Two corner cannons fire'], [1.6, 'Paper hangs in the air'], [2.7, 'Vortex gathers the pieces'], [4.6, 'Gather complete']]],
	[3.6, [[0, 'Vortex feeds the column foot'], [0.6, 'Bright ring sweeps upward'], [2.2, 'Ring clears the top'], [2.8, 'Cards burst into space']]],
	[5, [[0, 'Cards leave the Done column'], [1.5, 'Sheets spread into the field'], [3.4, 'Hero card comes forward'], [4.6, 'Field revealed']]],
	[5, [[0, 'Airborne sheets return'], [1.2, 'Hero lands first'], [2, 'Remaining tiles land in stagger'], [4.6, 'Six tiles form the bento']]],
	[6, [[0, 'Bento cards approach the wall'], [1.4, 'Wall begins to glide'], [2.8, 'Arrivals descend into moving gaps'], [5.5, 'Wall continues to glide']]],
];
const captions = [
	'The card lands first; the small puff then spreads out from its footprint and fades.',
	'Two corner bursts hang, then spiral into a shared sink at the foot of Done.',
	'The ring sweeps upward before the cards lift out. Playback is slowed to show the handoff.',
	'The sheets spread from the column into separate depths; the hero advances last.',
	'The hero lands first, then the remaining five sheets settle into the bento.',
	'The receiving wall moves while the incoming sheets descend into its gaps.',
];

for (const [index, id] of ids.entries()) {
	const file = path.join(dir, `${id}.iso.json`);
	const brief = JSON.parse(fs.readFileSync(file));
	brief.interact = null;
	delete brief.assemble;
	brief.labels = 'none';
	for (const part of brief.parts) delete part.label;
	brief.caption = captions[index];
	if (id === 'vortex-ignition') brief.label = 'An isometric Done tray: the completion ring expands from its foot, then four representative cards lift into the field.';
	fs.writeFileSync(file, JSON.stringify(brief, null, 2) + '\n');
}
execFileSync(process.execPath, ['.agents/skills/vpk-html/scripts/iso/build-figure.mjs', '--inject', document], { stdio: 'inherit' });

const models = ids.map((id, index) => {
	const brief = JSON.parse(fs.readFileSync(path.join(dir, `${id}.iso.json`)));
	const scene = buildScene(brief);
	const zero = iso([0, 0, 0], scene.P);
	const vector = delta => iso(delta, scene.P).map((v, i) => Math.round((v - zero[i]) * 100) / 100);
	const tracks = [];
	const bounds = [...scene.hull];
	const frame = (offset, delta = [0, 0, 0], opacity = 1, rotation = 0, scale = 1) => {
		const [x, y] = vector(delta);
		const shadow = vector(shadowMove(delta));
		return { offset, transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`, opacity, shadow: `translate(${shadow[0]}px, ${shadow[1]}px)`, move: [x, y], rotation, scale };
	};
	const track = (part, frames, shadowFrames = frames) => {
		const at = part.at || [0, 0, 0];
		const size = part.kind === 'ring' ? [0, 0] : part.size || [0, 0];
		const centre = iso([at[0] + size[0] / 2, at[1] + size[1] / 2, at[2]], scene.P);
		const origin = centre.map(x => `${x}px`).join(' ');
		const clean = frame => ({ offset: frame.offset, transform: frame.transform, opacity: frame.opacity, ...(frame.easing ? { easing: frame.easing } : {}) });
		tracks.push({ selector: `[data-vpk-iso-part="${part.id}"]`, frames: frames.map(clean), origin });
		tracks.push({ selector: `[data-vpk-iso-shadow-for="${part.id}"]`, frames: shadowFrames.map(frame => clean({ ...frame, transform: frame.shadow })), origin });
		if (part.kind !== 'ring') {
			const points = scene.pieces.filter(piece => piece.partId === part.id).flatMap(piece => piece.hit || []);
			for (const frame of frames) {
				if (frame.opacity < .05) continue;
				for (const [x, y] of points) {
					const radius = Math.hypot(x - centre[0], y - centre[1]) * frame.scale;
				if (frame.rotation) bounds.push([centre[0] + frame.move[0] - radius, centre[1] + frame.move[1] - radius], [centre[0] + frame.move[0] + radius, centre[1] + frame.move[1] + radius]);
				else bounds.push([centre[0] + (x - centre[0]) * frame.scale + frame.move[0], centre[1] + (y - centre[1]) * frame.scale + frame.move[1]]);
			}
			}
		}
	};
	for (const part of brief.parts) {
		if (id === 'single-drop') {
			if (part.id === 'landed-card') track(part, [frame(0, [-55, 0, 23]), frame(.3), frame(1)]);
			if (part.id.startsWith('paper-')) {
				const delta = [97 - part.at[0], 27 - part.at[1], 7 - part.at[2]];
				track(part, [frame(0, delta, 0), frame(.3, delta, 0), frame(.42, delta), frame(.72), frame(1, [0, 0, 0], 0)]);
			}
		}
		if (id === 'big-burst' && part.id.startsWith('paper-')) {
			const i = Number(part.id.split('-')[1]);
			const launch = [(i % 2 ? 140 : 8) - part.at[0], 85 - part.at[1], 2 - part.at[2]];
			const sink = [122 - part.at[0], 77 - part.at[1], 5 - part.at[2]];
			const middle = sink.map((v, k) => v * .58 + (k === 0 ? Math.sin(i) * 9 : k === 1 ? Math.cos(i) * 9 : 6));
			track(part, [frame(0, launch, 0), frame(.08, launch), frame(.32), frame(.52), frame(.76, middle, 1, 160), frame(.94, sink, 0, 320, .9), frame(1, sink, 0, 320, .9)]);
		}
		if (id === 'vortex-ignition') {
			if (part.id === 'flash-ring') track(part, [frame(0, [0, 0, 0], 0, 0, .06), frame(.17, [0, 0, 0], 1, 0, .12), frame(.62), frame(.77, [0, 0, 0], 0), frame(1, [0, 0, 0], 0)]);
			if (part.id.startsWith('card-')) {
				const i = Number(part.id.split('-')[1]);
				track(part, [frame(0), frame(.7), frame(1, [(i - 2) * 8, 0, 14 + i * 8])]);
			}
		}
		if (id === 'card-field' && part.id.startsWith('field-card-')) {
			const i = Number(part.id.split('-').at(-1));
			const delta = [112 - part.at[0], 55 - part.at[1], 5 - part.at[2]];
			track(part, [frame(0, delta, 0), frame(.08, delta), frame(.66), frame(1, i === 4 ? [0, 0, 5] : [0, 0, 0])]);
		}
		if (id === 'bento-assembly' && part.id.startsWith('tile-')) {
			const i = Number(part.id.split('-')[1]);
			const airborne = [(i % 2 ? -1 : 1) * (10 + i * 4), -i * 4, 18 + i * 8];
			const start = .06 + i * .075;
			track(part, [frame(0, airborne), frame(start, airborne), frame(start + .25), frame(1)]);
		}
		if (id === 'infinite-wall') {
			if (part.id.startsWith('wall-') && part.id !== 'wall-base') track(part, [frame(0), frame(.23), { ...frame(1, [-7, 0, 0]), easing: 'linear' }]);
			if (part.id.startsWith('arrival-')) track(part, [frame(0, [8, -10, 18], 0), frame(.16, [8, -10, 18]), frame(.45), frame(.8, [-5, 0, -25]), frame(1, [-7, 0, -25])]);
		}
	}
	const minX = Math.min(0, ...bounds.map(point => point[0] - 24));
	const minY = Math.min(0, ...bounds.map(point => point[1] - 24));
	const maxX = Math.max(scene.viewBox[0], ...bounds.map(point => point[0] + 24));
	const maxY = Math.max(scene.viewBox[1], ...bounds.map(point => point[1] + 24));
	return { id, title: brief.title, viewBox: [minX, minY, maxX - minX, maxY - minY], duration: definitions[index][0], beats: definitions[index][1].map(([at, text]) => ({ at, text })), tracks };
});

let source = fs.readFileSync(document, 'utf8');
source = source.replace(/<!-- eu26-playback:(?:controls|runtime):begin -->[\s\S]*?<!-- eu26-playback:(?:controls|runtime):end -->/g, '');
for (const model of models) {
	const end = `<!-- vpk-figure:end id="${model.id}" -->`;
	const control = `<!-- eu26-playback:controls:begin --><div class="playback-controls" data-eu26-controls="${model.id}" data-vpkh-no-lightbox><div class="playback-transport"><button type="button" aria-label="Play ${model.title}">Play</button><label class="playback-progress"><span>Progress</span><input type="range" min="0" max="${model.duration}" step="0.01" value="0" aria-label="${model.title} animation progress"></label><output>0:00.0 / 0:0${model.duration}.0</output></div><p data-playback-status>${model.beats[0].text}</p></div><!-- eu26-playback:controls:end -->`;
	source = source.replace(end, end + control);
}
const css = `.playback-controls{margin:-12px 0 28px;padding:16px 0;border-bottom:1px solid var(--rule)}.playback-transport{display:flex;gap:16px;align-items:center}.playback-controls button{min-height:44px;min-width:80px;padding:8px 12px;border:1px solid var(--rule-strong);border-radius:4px;background:var(--paper);color:var(--ink);font:14px var(--sans);cursor:pointer}.playback-progress{display:flex;flex:1;gap:12px;align-items:center;min-width:0;font-size:12px;color:var(--muted-text)}.playback-progress input{width:100%;min-width:32px;min-height:44px;accent-color:var(--ink);cursor:pointer}.playback-controls output{font:12px var(--mono);white-space:nowrap;color:var(--muted-text);min-width:112px;text-align:right}.playback-controls p{font:12px var(--mono);color:var(--muted-text);margin:10px 0 0}.vpk-iso-stage{animation:none!important}.vpk-iso-plate{margin-bottom:16px}@media(max-width:560px){.playback-transport{flex-wrap:wrap;gap:8px 12px}.playback-progress{flex-basis:calc(100% - 100px)}.playback-controls output{margin-left:auto}.playback-progress span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}}@media print{.playback-controls{display:none}}`;
const runtime = fs.readFileSync(path.join(dir, 'playback.js'), 'utf8');
source = source.replace('</body>', `<!-- eu26-playback:runtime:begin --><style data-eu26-playback-css>${css}</style><script type="application/json" data-eu26-playback-model>${JSON.stringify(models).replaceAll('<', '\\u003c')}</script><script data-eu26-playback-runtime>${runtime}</script><!-- eu26-playback:runtime:end --></body>`);
source = source.replace(/Using the diagrams:[\s\S]*?production renderer\./, 'Using the diagrams: each clip plays when you scroll it into view and pauses off screen. Use Play or Pause, or scrub Progress to inspect any moment. Replay restarts a completed clip. Reduced motion opens a still final frame; you can still scrub or choose Play. These slowed schematic clips explain the mechanics rather than reproduce the production renderer.');
fs.writeFileSync(document, source);
const contractFile = path.resolve(dir, '../eu26-animation-explained.content.json');
const contract = JSON.parse(fs.readFileSync(contractFile));
contract.brief.figures.forEach((figure, i) => { figure.job = captions[i]; });
contract.brief.acceptance_checks = [...new Set([...contract.brief.acceptance_checks, 'scroll entry, play, pause, scrub, replay, offscreen suspension and reduced-motion playback'])];
contract.brief.explicit_deviations = ['User-requested finite playback replaces hover and Gap interactions for all six diagrams. Native paused Web Animations render the existing iso-kit parts, driven by the shared vpkFrameLoop and a video-style scrub control.'];
fs.writeFileSync(contractFile, JSON.stringify(contract, null, 2) + '\n');
execFileSync(process.execPath, ['.agents/skills/vpk-html/scripts/iso/build-figure.mjs', '--inject', document], { stdio: 'inherit' });
console.log('Embedded six timed diagram players.');
