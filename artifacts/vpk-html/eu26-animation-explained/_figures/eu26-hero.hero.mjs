import { createWallField, lockCameraKeys, model, motionConfig } from './eu26-motion-model.mjs';
import { live } from './eu26-scene-live.mjs';
import { cardDetail, chromeDetail, tileDetail, titleDetail, wrapDetail } from './eu26-face-detail.mjs';
import { lanyardDetail, pieceInset, PIECES, stackCardDetail } from './eu26-face-wall.mjs';
import { pen } from './eu26-face-pen.mjs';

export { model, live };

export const hero = {
	id: "eu26-hero",
	tier: "hero",
	width: 1200,
	height: 760,
	label: "A quiet model of a board becomes a paper-card field, assembles six tiles, then opens into a continuous wall.",
	plate: {
		fig: "Fig 1",
		title: "From one Done card to a world of work",
		hint: "Choose Frames, or scrub the timeline",
		keys: [{ mark: "lit", label: "Agent Session Tracking — the card the camera follows" }, { mark: "raised", label: "The same paper pieces continue from board to wall" }],
		caption: "A 20-second schematic of the source choreography. People carry the orange subject, completion light traces its cards, and one masonry wall keeps receiving work after the guided sequence.",
	},
	stage: { role: "group", label: "Team ’26 choreography. Scrub the timeline or open Frames to choose among twelve states." },
};

const stories = [
	["TEU-1", "Rovo Desktop", "Context", "desktop"],
	["TEU-101", "Data Context", "Context", "network"],
	["TEU-2", "Code Context", "Context", "code"],
	["TEU-4", "Artifacts", "Context", "artifacts"],
	["TEU-102", "Code Search App", "Context", "search"],
	["TEU-3", "Rovo For Work", "Context", "chat"],
	["TEU-103", "People Context", "Context", "people"],
	["TEU-104", "Communications Context", "Context", "chat"],
	["TEU-105", "Atlassian MCP", "Collaboration", "network"],
	["TEU-5", "Loom Desktop", "Collaboration", "video"],
	["TEU-106", "Loom Record for Agent", "Collaboration", "record"],
	["TEU-7", "AI Planner", "Collaboration", "planner"],
	["TEU-8", "Loom Overlay", "Collaboration", "video"],
	["TEU-107", "ChatGPT Codex from Jira", "Collaboration", "code"],
	["TEU-9", "Loom PR Reviews", "Confidence", "code"],
	["TEU-10", "Agent Session Tracking", "Confidence", "sessions"],
	["TEU-11", "Agent Effectiveness", "Confidence", "chart"],
	["TEU-109", "Change Risk Assessment", "Confidence", "chart"],
	["TEU-111", "Incident Command Center", "Confidence", "planner"],
	["TEU-108", "EU AI Inference", "Confidence", "network"],
	["TEU-112", "Employee Onboarding", "Confidence", "people"],
	["TEU-12", "AI Capital Management", "Confidence", "cost"],
	["TEU-13", "Guard Scanning", "Confidence", "shield"],
];

// Source geometry snapshot: 8588b00; finale-wall-layout.ts, finale-wall-pieces.ts,
// pieces.json and the saved finale-studio.json. Intrinsic dimensions and studio order stay intact.
const WALL_PIECES = [
	["search",750,54,0.684,40,40,false],
	["bubbles",460,250,0.76,40,40,false],
	["twg",430,206,0.836,40,40,false],
	["voice",360,56,0.95,40,40,false],
	["picker",248,360,0.76,40,40,false],
	["hold",600,172,0.76,40,40,false],
	["glyphSearch",132,132,0.684,40,40,false],
	["appConfluence",96,96,0.684,40,40,true],
	["mosaic",560,350,0.76,40,40,false],
	["quizArtifact",800,450,0.456,40,40,false],
	["rovoDevCli",616,302,0.646,40,40,false],
	["agentPresence",604,471,0.608,40,40,true],
	["loomRecordBar",1178,249,0.304,40,40,false],
	["governance",396,302,0.608,40,40,false],
	["stampTyping",90.8,96.31,1.824,40,40,false],
	["agentIdentities",564,377,0.76,40,40,false],
	["searchDrop",750,366,0.608,40,40,false],
	["composer",650,110,0.684,40,40,false],
	["reasoning",358,144,0.95,40,40,false],
	["avatars",300,128,0.836,40,40,false],
	["compact",690,627,0.4712,40,40,false],
	["glyphChat",132,132,0.684,40,40,false],
	["appJira",96,96,0.684,40,40,true],
	["filmFacets",360,300,0.798,40,40,false],
	["dashboardArtifact",567,420,0.57,40,40,false],
	["codeCard",276,143,1.216,40,40,false],
	["mentions",603,414,0.57,40,40,false],
	["loomTeleprompter",606,694,0.456,40,40,false],
	["iso42001",573,293,0.608,40,40,false],
	["stampPhotos",226.32,241.69,0.874,40,40,false],
	["atlassianMcp",583,230,0.418,40,40,false],
	["filters",612,32,0.798,40,40,false],
	["starters",330,37,0.988,40,40,false],
	["workPill",128,36,1.216,40,40,false],
	["badgeRovo",229,282,0.798,40,40,false],
	["switch",170,46,1.52,40,40,false],
	["glyphForYou",132,132,0.684,40,40,false],
	["appSlack",96,96,0.684,40,40,true],
	["artifactsLogo",459,137,0.608,40,40,false],
	["codeSearchLogo",550,143,0.608,40,40,false],
	["attribution",366,220,0.76,40,40,false],
	["loomCameraBubble",358,458,0.57,40,40,false],
	["statTokens",520,320,0.608,40,40,false],
	["stampShapes",129.52,96.31,1.596,40,40,false],
	["redactedPrompt",539,354,0.38,40,40,false],
	["skills",650,256,0.646,40,40,false],
	["sources",300,340,0.836,40,40,false],
	["scheduledTask",455.732,588.455,0.456,40,40,false],
	["bloom",255,60,1.368,40,40,false],
	["glyphAuto",132,132,0.684,40,40,false],
	["appFigma",96,96,0.684,40,40,true],
	["codeSearchQuery",982,63,0.456,40,40,false],
	["shareSnapshot",516,294,0.684,40,40,false],
	["loomOverlays",1193,594,0.342,40,40,false],
	["stampShield",226.32,241.69,0.874,40,40,false],
	["needsInput",539,412.099,0.3952,40,40,false],
	["mobileChat",430.24,935.398,0.38,40,40,false],
	["sourcesPopover",604,478,0.494,40,40,false],
	["agentCard",544,610,0.494,40,40,false],
	["ringsTile",120,120,0.684,40,40,false],
	["appGithub",96,96,0.684,40,40,true],
	["twgSearchCli",615,167,0.76,40,40,false],
	["readiness",432,385,0.836,40,40,false],
	["stampRovoMark",226.32,241.69,0.874,40,40,false],
	["agentSessions",523,560,0.418,40,40,false],
	["appDrive",96,96,0.684,40,40,true],
	["highReadiness",294,85,0.532,40,40,false],
	["stampTangle",90.8,96.31,1.824,40,40,false],
	["requestResolver",946.5,402,0.57,40,40,false],
	["appLoom",96,96,0.684,40,40,true],
	["stampLoops",90.8,96.31,1.824,40,40,false],
	["jiraList",1000.141,294,0.57,40,40,false],
	["presenceFacepile",590,241,0.418,40,40,false],
	["stampRibbon",321.68,112.46,0.874,40,40,false],
	["riskStack",674,593,0.456,40,40,false],
	["rovoWithYou",396,302,0.608,40,40,false],
	["stampSignal",129.52,96.31,1.596,40,40,false],
	["costByModel",495,683,0.798,40,40,false],
	["workflowCard",603,433,0.57,40,40,false],
	["stampGrid",321.68,112.46,0.874,40,40,false],
	["spendCard",450,476,0.684,40,40,false],
	["conversation",603,348,0.532,40,40,false],
	["stampSparkle",90.8,96.31,1.824,40,40,false],
	["dimensions",634,362,0.684,40,40,false],
	["stampFields",321.68,225.54,0.798,40,40,false],
	["potentialSavings",742,162,0.57,40,40,false],
	["stampSquiggle",90.8,96.31,1.824,40,40,false],
	["sessionCard",1594.71,136.129,0.38,40,40,false],
	["stampSmile",129.52,96.31,1.596,40,40,false],
	["agentSessionStack",1174,674,0.38,40,40,false]
];

// Port of the source's free-size horizontal masonry. Candidate edges come from placed items.
function packWallMasonry(items, reserved, height, gutter, gutterY = gutter) {
	const occupied = [...reserved];
	return items.map(item => {
		const xs = [...new Set([gutter, ...occupied.map(rect => rect.x + rect.width + gutter)])].sort((a, b) => a - b);
		for (const x of xs) {
			const crossing = occupied.filter(rect => x < rect.x + rect.width + gutter - 1e-6 && x + item.width + gutter > rect.x + 1e-6);
			const ys = [...new Set([gutterY, ...crossing.map(rect => rect.y + rect.height + gutterY)])].sort((a, b) => a - b);
			for (const y of ys) {
				if (y + item.height > height - gutterY + 1e-6) continue;
				if (crossing.some(rect => y < rect.y + rect.height + gutterY - 1e-6 && y + item.height + gutterY > rect.y + 1e-6)) continue;
				const rect = { x, y, width: item.width, height: item.height };
				occupied.push(rect);
				return rect;
			}
		}
		throw new Error('Source masonry item exceeds the wall height: ' + item.key);
	});
}

function sourceWall() {
	const pieceScale = 1080 * (2.64 / 900) * 0.25, gutter = 30 * pieceScale;
	const worldScale = 0.72, typeScale = 0.3 * pieceScale / (0.61 * 1.25);
	const col = (1920 - 80 - 80) / 3, tall = 480, short = 360;
	const sourceBento = [
		{ x: 40, y: 40, width: col, height: tall },
		{ x: 40 + (col + 40) * 2, y: 40, width: col, height: tall },
		{ x: 40 + col + 40, y: 40, width: col, height: short },
		{ x: 40, y: 560, width: col, height: tall },
		{ x: 40 + (col + 40) * 2, y: 560, width: col, height: tall },
		{ x: 40 + col + 40, y: 680, width: col, height: short },
		{ x: 40 + col + 40, y: 440, width: col, height: 200 },
	];
	const reserved = sourceBento.map((rect, order) => {
		const width = rect.width * 0.3, height = order === 6 ? width - 172 * typeScale : rect.height * 0.3;
		return { x: rect.x + (rect.width - width) / 2 - (order === 6 ? 1920 * 0.12 : 0), y: rect.y + (rect.height - height) / 2, width, height };
	});
	// wallPiecesLayout: natural piece width/height, plus the authored padding on both sides.
	const items = WALL_PIECES.map(([id, w, h, scale, px, py, bare]) => ({ key: 'library-' + id, id, width: (w * scale + px * 2) * pieceScale, height: (h * scale + py * 2) * pieceScale, bare }));
	const unhung = packWallMasonry(items, reserved, 1080, gutter);
	const lanyardWidth = 360 * typeScale / 0.3, lanyardHeight = 480 * typeScale / 0.3;
	const spacing = (Math.max(...[...reserved, ...unhung].map(rect => rect.x + rect.width)) + gutter + 3 * (lanyardWidth + gutter)) / 3;
	const lanyards = Array.from({ length: 3 }, (_, i) => ({ x: 1920 + gutter + i * spacing, y: -20, width: lanyardWidth, height: lanyardHeight }));
	const packed = packWallMasonry(items, [...reserved, ...lanyards], 1080, gutter);
	const slots = [...reserved.map((source, reserved) => ({ key: 'gap-' + reserved, source, reserved })), ...lanyards.map((source, i) => ({ key: 'lanyard-' + i, source })), ...items.map((item, i) => ({ key: item.key, source: packed[i], bare: item.bare }))];
	let parkingX = -900;
	return slots.map((slot, index) => {
		const w = slot.source.width * worldScale, d = slot.source.height * worldScale;
		const home = [parkingX, 2500, 0];
		parkingX += w + 32;
		return { ...slot, home, at: [(slot.source.x - 960) * worldScale, (slot.source.y - 540) * worldScale, 0], w, d, r: 20 * worldScale, seed: 211 + index * 37 };
	});
}
// The confetti's variety (finale-confetti.ts VARIETY, less the satin ribbons): a third are discs (sequins and round
// paper), the rest paper rectangles 9-14 long at 0.45-0.65 of their length wide. Parked off stage until thrown.
function confettiPieces(count = 140) {
	const hash = (i, channel) => { const v = Math.sin((i + 1) * 91.7 + channel * 47.3) * 24634.6345; return v - Math.floor(v); };
	let parkX = -700;
	return Array.from({ length: count }, (_, i) => {
		const disc = hash(i, 1) < 0.33, length = disc ? 6 + 3 * hash(i, 2) : 9 + 5 * hash(i, 2), width = disc ? length : length * (0.45 + 0.2 * hash(i, 3));
		const plan = { x: parkX, y: 4000, w: +width.toFixed(2), d: +length.toFixed(2), r: disc ? +(width / 2).toFixed(2) : 0.7 };
		parkX += 24;
		return { shape: disc ? "disc" : "rect", plan, home: [plan.x + plan.w / 2, plan.y + plan.d / 2, 0] };
	});
}
// Camera anchors: the Done column, the hero card's place in the field, and the Team ’26 title in the bento.
const CAMERA_ANCHORS = { done: [317.5, 55, 0], hero: [-15, -28, 96], title: [10, -16, 6] };
const doneOrder = [15, ...Array.from({ length: 23 }, (_, i) => i).filter(i => i !== 15)];
// Each column's list window reaches the column's inner bottom edge, so every list looks full and its last visible card
// (row 3) is clipped. Columns 0-2 hold the stories; column 3 is Done.
const listViewport = column => ({ x: -390 + column * 205, y: -158, w: 185, d: 448, r: 6 });
const doneViewport = listViewport(3);

export const data = {
	motion: motionConfig,
	duration: 34,
	playbackRate: 1.7,
	variants: [
		{ id: "paper", title: "Paper model", description: "Thin, opaque paper; orange marks completion before the field returns to quiet white." },
	],
	states: [
		{ id: "board", title: "The keynote board", phase: "board", time: 0, description: "Three chapters of work sit beside an empty Done column." },
		{ id: "drop", title: "One card lands", phase: "drop", time: 2, description: "A human cursor carries Agent Session Tracking into Done, then releases it." },
		{ id: "puff", title: "A local reward", phase: "puff", time: 4, description: "A small puff opens around the landed card, then clears." },
		{ id: "all-done", title: "The whole deck completes", phase: "allDone", time: 6, description: "The cursor drags the rest of the selected work into Done as one stack. All 23 stories are complete and Done fills to its edge." },
		{ id: "big-burst", title: "The celebration grows", phase: "bigBurst", time: 8, description: "A broad confetti burst changes the scale of the reward." },
		{ id: "vortex", title: "Particles find an orbit", phase: "vortex", time: 10, description: "The burst gathers into a rotating funnel above Done." },
		{ id: "column-flash", title: "Completion light", phase: "columnFlash", time: 13, description: "A light traces the three card borders, then a directional gradient passes across their faces." },
		{ id: "field", title: "The cards become a field", phase: "field", time: 16, description: "The deck separates into individually tilted paper cards; the camera recoils." },
		{ id: "hero-landing", title: "Find the hero card", phase: "heroLanding", time: 19, description: "The camera crosses the field and closes on Agent Session Tracking." },
		{ id: "bento", title: "Six features assemble", phase: "bento", time: 22, description: "Six product faces land around Team ’26 in the keynote bento." },
		{ id: "wall-throw", title: "Throw into a larger world", phase: "wallThrow", time: 25, description: "The main cursor carries the title into its moving wall gap while the six tiles tumble outward." },
		{ id: "wall-glide", title: "A wall that people keep moving", phase: "wallGlide", time: 34, description: "Teammates reach in from the leading edge, grip incoming work, lower it into separate slots, and let go as the wall glides." },
	],
	cards: stories.map(([code, title], index) => {
		const column = index < 8 ? 0 : index < 14 ? 1 : 2;
		const row = index - [0, 8, 14][column];
		return { code, title, column, row, home: [-387.5 + column * 205, -154 + row * 126, 4], w: 180, d: 114 };
	}),
	features: [
		{ card: 15, title: "Agent Sessions", kind: "sessions", at: [-345, -208, 6], w: 220, d: 180 },
		{ card: 3, title: "Artifacts", kind: "artifacts", at: [145, -208, 6], w: 220, d: 180 },
		{ card: 5, title: "Rovo Work Mode", kind: "chat", at: [-100, -208, 6], w: 220, d: 120 },
		{ card: 21, title: "AI Capital Management", kind: "cost", at: [-345, -4, 6], w: 220, d: 180 },
		{ card: 16, title: "Agent Effectiveness", kind: "chart", at: [145, -4, 6], w: 220, d: 180 },
		{ card: 10, title: "Record for Agent", kind: "record", at: [-100, 55, 6], w: 220, d: 121 },
	],
	confetti: confettiPieces(),
	wall: sourceWall(),
	wallSource: { commit: "8588b00ff81cb5e8341a462158c747c6d990667c", viewport: { width: 1920, height: 1080 }, zoom: 0.25, density: "dense", padding: { x: 40, y: 40 }, pieceScale: 0.792, gutter: 23.76, worldScale: 0.72 },
	// The board chassis plan; the finale confetti stays over it.
	board: { x: -430, y: -286, w: 860, d: 596, r: 10 },
	columnViewports: [0, 1, 2].map(listViewport),
	doneList: { viewport: doneViewport, padding: { x: 2.5, y: 4 }, gap: 12, order: doneOrder, cards: doneOrder.map((card, rank) => ({ card, rank, x: doneViewport.x + 2.5, y: doneViewport.y + 4 + rank * 126, w: 180, d: 114 })) },
	materialDepths: { story: 1.2, tile: 1.5, wall: 1.1, title: 1.2 },
	title: { w: 220, d: 96, at: [10, -16, 6], home: [10, 2002, 4], grip: { u: 0.88, v: 0.76 } },
	boardDrags: [
		{ card: 15, reach: 0, grab: 0, land: 2, leave: 2.65, grip: { u: 0.82, v: 0.24 }, entry: [350, -350, 0] },
		{ card: 0, reach: 4, grab: 4.3, land: 6, leave: 6.65, grip: { u: 0.82, v: 0.24 }, entry: [350, -350, 0] },
	],
	titleCarry: { reach: 22.5, grab: 23.1, land: 26.4, leave: 27, entry: [400, -360, 30] },
	actors: [
		{ id: "teammate-1", slotKey: "library-quizArtifact", reach: 26.5, grab: 27.15, land: 28.9, leave: 29.55, incoming: [170, -30, 170], entry: [900, -900, 0], grip: { u: 0.5, v: 0.5 } },
		{ id: "teammate-2", slotKey: "library-hold", reach: 28, grab: 28.65, land: 30.5, leave: 31.15, incoming: [180, 40, 180], entry: [900, -900, 0], grip: { u: 0.5, v: 0.5 } },
		{ id: "teammate-3", slotKey: "library-loomRecordBar", reach: 31, grab: 31.65, land: 34, leave: 34.65, incoming: [130, -20, 145], entry: [900, -900, 0], grip: { u: 0.5, v: 0.5 } },
	],
	// Held poses joined by snaps (figure-motion.md, "Snap between camera poses"): each move takes 0.6 model seconds, 0.35 s
	// at playbackRate 1.7, eased in and out by cameraEase, then holds. A move that zooms or turns is locked on its anchor
	// (`lock`, solved by lockCameraKeys), so the subject keeps its place on screen; recentring is its own pan snap.
	cameraKeys: lockCameraKeys([
		{ time: 0, at: [0, 0, 0], width: 1220, azimuth: 45, elevation: 30 },
		{ time: .5, hold: true },
		{ time: 1.1, lock: CAMERA_ANCHORS.done, width: 1000, azimuth: 55, elevation: 38 },
		{ time: 1.35, hold: true },
		{ time: 1.95, at: [248, -40, 40], width: 1000, azimuth: 55, elevation: 38 },
		{ time: 4, hold: true },
		{ time: 4.6, lock: CAMERA_ANCHORS.done, width: 1240, azimuth: 67, elevation: 43 },
		{ time: 11.2, hold: true },
		{ time: 11.8, lock: CAMERA_ANCHORS.done, width: 800, azimuth: 74, elevation: 50 },
		{ time: 13.1, hold: true },
		{ time: 13.7, lock: CAMERA_ANCHORS.done, width: 2050, azimuth: 84, elevation: 42, lens: 0.3 },
		{ time: 14.4, hold: true },
		{ time: 15, at: CAMERA_ANCHORS.hero, width: 2050, azimuth: 84, elevation: 42, lens: 0.3 },
		{ time: 15.6, hold: true },
		// The one held perspective pose, at the story's turn: once the field has formed, only the focal length opens, about
		// the hero card at the frame centre.
		{ time: 16.2, at: CAMERA_ANCHORS.hero, width: 2050, azimuth: 84, elevation: 42, persp: 0.65 },
		{ time: 17.4, hold: true },
		{ time: 18, lock: CAMERA_ANCHORS.hero, width: 540, azimuth: 125, elevation: 48 },
		{ time: 19.3, hold: true },
		{ time: 20, lock: CAMERA_ANCHORS.hero, width: 1040, azimuth: 90, elevation: 90 },
		{ time: 20.6, hold: true },
		{ time: 21.2, at: [10, -4, 5], width: 1040, azimuth: 90, elevation: 90 },
		{ time: 23, hold: true },
		// The wall is shown flat and frontal, like the source's screen: one band of the packed masonry, centred and filling the frame.
		{ time: 23.6, lock: CAMERA_ANCHORS.title, width: 1300, azimuth: 90, elevation: 90, cover: 1 },
		{ time: 34, hold: true },
	]),
};
data.wallField = createWallField(data);
// Stack slots hold cards of their own (the source's print slots): three rows inside the tile's card, each its own
// surface, which wait on the slot's stack in the air and peel off it top first as the slot comes down. The rows sit
// one row margin inside the card (the same margin the rows layout uses), so no row outline lands on the card's edge.
data.wallCards = data.wall.flatMap((slot, index) => {
	if (!['library-searchDrop', 'library-agentSessionStack', 'library-riskStack'].includes(slot.key)) return [];
	const [, pw, ph, scale, px, py] = WALL_PIECES.find(piece => 'library-' + piece[0] === slot.key);
	const unit = slot.w / (pw * scale + px * 2), margin = pieceInset(pw, ph) * scale * unit;
	const padX = px * unit + margin, padY = py * unit + margin, gap = 6, rows = 3;
	const w = slot.w - padX * 2, d = (slot.d - padY * 2 - gap * (rows - 1)) / rows;
	return Array.from({ length: rows }, (_, row) => ({ slot: index, index: row, w, d, dx: 0, dy: -slot.d / 2 + padY + d / 2 + row * (d + gap) }));
});
// Each dealt card parks on its own spot until the wall needs it, so no two overlap at rest.
let parkX = -900;
for (const child of data.wallCards) { child.home = [parkX, 3300, 0]; parkX += child.w + 32; }

export function present(state, data) {
	const frame = data.states[state.index];
	const rate = data.playbackRate ?? 1;
	if (state.time > data.duration) return { readout: `${frame.title} · wall ${((state.time - data.motion.wall.start) / rate).toFixed(1)} s`, valueText: `${frame.title}. The wall continues scrolling with incoming work. Pause or replay is available.` };
	return { readout: `${frame.title} · ${(state.time / rate).toFixed(1)} s`, valueText: `${frame.title}. ${frame.description} Replay time ${(state.time / rate).toFixed(1)} of ${data.duration / rate} seconds.` };
}

export function build(kit, { data }) {
	const { k, A, S, camera } = kit;
	const { board } = data;
	const P = camera.fit(k.boxCorners(board, -12, 35), hero.width, hero.height, { pad: 34 });
	const R = A.recorder(P);
	// Face details are drawn in plan units, so they stay out of the audited part markup; live() adopts each one into
	// its surface's own group at start-up and places it with that face's projection every frame.
	const details = [];
	const put = (name, plan, z, h, piece = name, hidden = false, focal = false, detail = "", clip = "") => {
		if (detail) details.push(detail.replace("<g data-eu26-detail", `<g data-eu26-detail="${name}"`));
		const kind = piece === "chrome" ? (name.split(".")[1] ?? "").replace(/\d/g, "") : piece.split(".")[0];
		const attrs = `data-eu26-piece="${piece}" data-part="${name}" data-eu26-kind="${kind}" data-eu26-plan='${JSON.stringify({ plan, z, h })}'${hidden ? ' style="display:none"' : ""}${clip ? ` clip-path="url(#eu26-${clip}-window)"` : ""}${focal ? ' data-focal="hero-card"' : ""}`;
		R.put({ name, at: [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], svg: `<g ${attrs}>${S(k.slabOf(plan, z, h, P, 4, Math.min(h * 0.16, 0.25)), { tone: focal ? "hi" : "mid", crease: "none", lit: focal })}</g>`, shapes: [R.solid(A.slab(plan, z, h, { name, ground: true }, 4))] });
	};
	put("board.chassis", board, -12, 10, "chrome", false, false, chromeDetail("board.chassis"));
	put("board.navigation", { x: -430, y: -286, w: 860, d: 42, r: 8 }, -2, 2, "chrome", false, false, chromeDetail("board.navigation"));
	put("board.title", { x: -430, y: -242, w: 860, d: 53, r: 2 }, -2, 2, "chrome", false, false, chromeDetail("board.title"));
	for (let i = 0; i < 4; i += 1) {
		const x = -394 + i * 205;
		put(`board.column${i}`, { x, y: -184, w: 193, d: 478, r: 6 }, -2, 1, "chrome", false, false, chromeDetail(`board.column${i}`));
	}
	data.cards.forEach((card, i) => {
		const plan = { x: card.home[0], y: card.home[1], w: card.w, d: card.d, r: 4.5 };
		put(`story.${i}`, plan, card.home[2], 1.2, `story.${i}`, card.row > 3, i === 15, cardDetail(card, stories[i]), card.row === 3 ? `column${card.column}` : "");
	});
	data.features.forEach((feature, i) => {
		const plan = { x: -700 + i * 260, y: 1600, w: feature.w, d: feature.d, r: 9 };
		put(`tile.${i}`, plan, 4, 1.5, `tile.${i}`, true, false, wrapDetail(tileDetail(feature)));
	});
	put("bento.title", { x: -100, y: 1954, w: 220, d: 96, r: 9 }, 4, 1.2, "title", true, false, wrapDetail(titleDetail()));
	data.wall.forEach((wall, i) => {
		const plan = { x: wall.home[0], y: wall.home[1], w: wall.w, d: wall.d, r: wall.r };
		put(`wall.${i}`, plan, 0, 1.1, `wall.${i}`, true, false, wrapDetail(wallDetail(wall, data)));
	});
	data.wallCards.forEach((child, j) => {
		const plan = { x: child.home[0], y: child.home[1], w: child.w, d: child.d, r: 8 };
		put(`wallcard.${j}`, plan, 0, 1.1, `wallcard.${j}`, true, false, wrapDetail(stackCardDetail(child)));
	});
	data.confetti.forEach((piece, i) => put(`confetti.${i}`, piece.plan, 0, 0.3, `confetti.${i}`, true));
	const windows = [...data.columnViewports.map((viewport, i) => [`column${i}`, viewport, `data-eu26-column-window="${i}"`]), ["done", data.doneList.viewport, "data-eu26-done-window"]]
		.map(([key, viewport, marker]) => `<clipPath id="eu26-${key}-window" clipPathUnits="userSpaceOnUse"><path ${marker} d="${k.planOutline(viewport, 5.2, P, 4)}"/></clipPath>`).join("");
	const cursorLayer = `<g data-eu26-cursor-layer aria-hidden="true" pointer-events="none">${["main", ...data.actors.map(actor => actor.id)].map(id => `<g data-eu26-cursor="${id}" style="display:none"><path data-eu26-cursor-halo d="M0 0Z" fill="none" stroke-linejoin="round"/><path data-eu26-cursor-tip d="M0 0Z" stroke-linejoin="round"/>${id === "main" ? "" : `<rect data-eu26-cursor-pill x="0" y="0" width="0" height="0" style="display:none"/><text data-eu26-cursor-name x="0" y="0" style="display:none"></text>`}</g>`).join("")}</g>`;
	return { P, R, before: [`<defs>${windows}</defs>`], after: [`<g data-eu26-details aria-hidden="true" style="display:none">${details.join("")}</g>`, cursorLayer] };
}

// Wall faces: bento holes repeat their tile's face at the slot's size, lanyards hang a badge, and every library piece
// draws its product UI in the source's natural pixels, scaled and inset exactly as wallPiecesLayout places it.
function wallDetail(slot, data) {
	if (slot.reserved !== undefined) {
		if (slot.reserved === 6) return titleDetail({ w: data.title.w, d: data.title.d, sx: slot.w / data.title.w, sy: slot.d / data.title.d });
		const feature = data.features[slot.reserved];
		return tileDetail(feature, { sx: slot.w / feature.w, sy: slot.d / feature.d });
	}
	if (slot.key.startsWith('lanyard-')) {
		const p = pen(0, 0, slot.w / 360, slot.d / 480);
		pen().rect(0, 0, slot.w, slot.d, slot.r, 'dp').out.forEach(item => p.out.push(item));
		lanyardDetail(p, 360, 480);
		return p.markup();
	}
	const [id, w, h, scale, px, py] = WALL_PIECES.find(piece => 'library-' + piece[0] === slot.key);
	const unit = slot.w / (w * scale + px * 2);
	const p = pen(px * unit, py * unit, scale * unit);
	p.out.push(...pen().rect(0, 0, slot.w, slot.d, slot.r, 'dp').out);
	PIECES[id](p, w, h);
	return p.markup();
}

// Every paper face's detail in its own plan units, for the overlap check: story cards, bento tiles, wall slots
// (a stack slot with its dealt rows laid in at rest) and the face outline each detail sits on.
export function surfaceDetails(source = data) {
	const faces = [];
	source.cards.forEach((card, i) => faces.push({ name: `story.${i}`, w: card.w, d: card.d, r: 4.5, markup: cardDetail(card, stories[i]) }));
	source.features.forEach((feature, i) => faces.push({ name: `tile.${i}`, w: feature.w, d: feature.d, r: 9, markup: tileDetail(feature) }));
	source.wall.forEach((slot, i) => {
		let markup = wallDetail(slot, source);
		for (const child of source.wallCards.filter(each => each.slot === i)) {
			const x = slot.w / 2 + child.dx - child.w / 2, y = slot.d / 2 + child.dy - child.d / 2;
			markup += pen().rect(x, y, child.w, child.d, 8, 'dw').markup() + stackCardDetail(child).replace(/(x|cx)="([\d.-]+)"/g, (m, k, v) => `${k}="${Number(v) + x}"`).replace(/(y|cy)="([\d.-]+)"/g, (m, k, v) => `${k}="${Number(v) + y}"`);
		}
		faces.push({ name: `wall.${i}:${slot.key}`, w: slot.w, d: slot.d, r: slot.r, markup });
	});
	return faces;
}

// Each paper surface is an intentionally suspended choreography prop; its slab is its true footprint.
export const auditOptions = { allow: [], crowd: [], cover: [] };
