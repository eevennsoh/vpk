const sourceRoot = 'https://bitbucket.org/atlassian/jira-team-eu26-motion/src/8588b00ff81cb5e8341a462158c747c6d990667c/components/projects/jira-team-eu26-end/finale/';
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
	return data.states.map((state, index) => ({ ...state, seconds: state.time / data.playbackRate, body: notes[index][0], source: notes[index][1].split('/').at(-1), href: sourceRoot + notes[index][1] }));
}
