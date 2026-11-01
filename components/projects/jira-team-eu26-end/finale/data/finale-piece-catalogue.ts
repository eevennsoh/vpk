import kitCatalogue from "@/public/1p/rovo-stage-kit/pieces.json";
import type { KitPiece, PieceId, PieceStyle } from "@/public/1p/rovo-stage-kit/types/stage-file";

/** Local players share the kit's contract without changing its compiled bundle. */
export type FinalePieceId = PieceId | "ampMark" | "agentLanyard" | "atlassianConnect" | "multiplayer" | "agentSessionStack" | "twgSearchStrip" | "agentActivityFeed" | "realtimeEditing" | "agentProliferation" | "principleFlow" | "humanAgentNetwork" | "principleSync" | "principleVendor" | "agentWorkChart" | "activityTimeline" | "enterpriseCapabilities" | "codeSearchGreeting" | "contentAttribution" | "sendToAgent";
export type FinalePiece = Omit<KitPiece, "id"> & { readonly id: FinalePieceId };
export interface AgentLanyardStickerSettings {
	readonly agentId?: string;
	readonly avatarId?: string;
	readonly agentName?: string;
	readonly animateGrid?: boolean;
	readonly pulseInterval?: number;
}
export type FinalePieceStyle = PieceStyle & AgentLanyardStickerSettings;
export type FinalePieceStyles = Partial<Record<FinalePieceId, FinalePieceStyle>>;

export const LOCAL_FINALE_PIECES: readonly FinalePiece[] = [{
	id: "ampMark",
	name: "AMP",
	moment: "The outer hexagon draws clockwise, followed by six inner circles fading in 120 ms apart in clockwise order. The AMP lettering fades in as the hexagon finishes, and the completed mark holds.",
	group: "agents",
	groupLabel: "Agents",
	w: 302,
	h: 102.9037,
	scale: 1.3,
	holds: 2.6,
	bare: true,
	card: false,
}, {
	id: "sendToAgent",
	name: "Send to agent",
	moment: "The dropdown fades in and slides down 10 px over 360 ms. Its items then fade in from top to bottom over 480 ms each, just 35 ms apart, before the finished menu holds.",
	group: "agents",
	groupLabel: "Agents",
	w: 604,
	h: 765,
	scale: 0.65,
	holds: 2.2,
	bare: false,
	card: true,
}, {
	id: "contentAttribution",
	name: "Content attribution",
	moment: "The first line highlights from left to right. A blue attribution bar rises from behind the highlight, followed by the agent and avatar, then the attribution text fades in. The finished card holds.",
	group: "collab",
	groupLabel: "Working together",
	w: 811,
	h: 293,
	scale: 0.8,
	holds: 2.6,
	bare: false,
	card: true,
}, {
	id: "codeSearchGreeting",
	name: "Search all your code, fast",
	moment: "The code-search icon fades in with a small scale-up. After a 240 ms lead, characters fade and slide in from the left, just 12 ms apart with overlapping 440 ms easing, then the finished card holds.",
	group: "reasoning",
	groupLabel: "Reasoning and sources",
	w: 627,
	h: 146,
	scale: 1,
	holds: 1.6,
	bare: false,
	card: true,
}, {
	id: "enterpriseCapabilities",
	name: "New enterprise capabilities",
	moment: "Two number reels ease into 50, followed by a soft plus-sign reveal. The label settles beside them, then the finished 50+ holds. Reduced motion shows the final stat immediately.",
	group: "agents",
	groupLabel: "Agents",
	w: 583,
	h: 230,
	scale: 0.8,
	holds: 2.2,
	bare: false,
	card: true,
}, {
	id: "agentLanyard",
	name: "Agent lanyard",
	moment: "The agent badge sits over a dotted grid that pulses at intervals. Swap the agent preset, avatar and name.",
	group: "agents",
	groupLabel: "Agents",
	w: 252,
	h: 280,
	scale: 1,
	holds: null,
	bare: false,
	card: true,
}, {
	id: "atlassianConnect",
	name: "@Atlassian · Apps and agents",
	moment: "Five logos settle in, the incoming connector draws, @Atlassian types in, then the return connector draws back to the agents. Hover a logo for a small lift; click to replay. Reduced motion shows the finished tile.",
	group: "collab",
	groupLabel: "Working together",
	w: 604,
	h: 442,
	scale: 0.8,
	holds: 3.2,
	bare: false,
	card: true,
}, {
	id: "multiplayer",
	name: "Multiplayer",
	moment: "The rounded hexagon and six dotted circles draw in sequence, followed by a green accented circle. Agent and Human cursors move a few pixels, pause, and ease back. Reduced motion shows the complete Figma pose.",
	group: "collab",
	groupLabel: "Working together",
	w: 328.607,
	h: 274,
	scale: 1.3,
	holds: null,
	bare: false,
	card: true,
}, {
	id: "activityTimeline",
	name: "Activity timeline",
	moment: "The pointer explores the dotted timeline, pausing as the avatar and time change. Session cards and activity stay still.",
	group: "collab",
	groupLabel: "Working together",
	w: 480,
	h: 426,
	scale: 0.85,
	holds: 6.8,
	bare: false,
	card: true,
}, {
	id: "agentWorkChart",
	name: "Agent work by session",
	moment: "Five stacked bars grow from their baseline, 70 ms apart. The session totals count up as their legend rows settle in. Hover a bar or row for a quiet highlight; reduced motion shows the finished chart.",
	group: "agents",
	groupLabel: "Agents",
	w: 587,
	h: 445,
	scale: 0.8,
	holds: 2.4,
	bare: false,
	card: true,
}, {
	id: "agentSessionStack",
	name: "Agent sessions · Working",
	moment: "Working shimmers while the six-dot spinner blooms. Mike, Sherif and Tamar’s session rows stay still.",
	group: "agents",
	groupLabel: "Agents",
	w: 1174,
	h: 674,
	scale: 0.5,
	holds: null,
	bare: false,
	card: true,
}, {
	id: "twgSearchStrip",
	name: "Searching Teamwork Graph",
	moment: "The graph's rings pop in, then their diagonal link draws. The text shimmers continuously. Confluence, Drive, Jira and Teams fade and slide in from the left, one after another.",
	group: "reasoning",
	groupLabel: "Reasoning and sources",
	w: 1008,
	h: 156,
	scale: 0.75,
	holds: null,
	bare: false,
	card: true,
}, {
	id: "agentActivityFeed",
	name: "Agent activity",
	moment: "Activity rows enter 240 ms apart. Each agent icon leads its text by 120 ms; the text fades in and slides from the left.",
	group: "collab",
	groupLabel: "Working together",
	w: 804,
	h: 469,
	scale: 0.75,
	holds: 3,
	bare: false,
	card: true,
}, {
	id: "realtimeEditing",
	name: "Real-time editing",
	moment: "Planner, Liam and ChatGPT select existing text word by word, then replace it in 1 → 3 → 2 order. Each edit has its own pace and a soft light sweep.",
	group: "collab",
	groupLabel: "Working together",
	w: 604,
	h: 472,
	scale: 0.8,
	holds: 4.4,
	bare: false,
	card: true,
}, {
	id: "principleFlow",
	name: "Principle flow",
	moment: "The curved line draws, then five fixed boxes appear 180 ms apart: outline, white fill, and a quick hexagon fade. The finished diagram holds still.",
	group: "agents",
	groupLabel: "Agents",
	w: 236,
	h: 145,
	scale: 1.8,
	holds: 2.6,
	bare: false,
	card: true,
}, {
	id: "agentProliferation",
	name: "Agent proliferation",
	moment: "Each line, dot and row of hexagons starts moving together, easing into a steady continuous pace. Hexagons fade in with a quick stagger, keep their spacing and recycle outside the card; dots pass underneath and leave the frame.",
	group: "agents",
	groupLabel: "Agents",
	w: 236,
	h: 145,
	scale: 1.8,
	holds: null,
	bare: false,
	card: true,
}, {
	id: "humanAgentNetwork",
	name: "Human and agents",
	moment: "A circle appears, then its green dot scales in. Three fixed branches grow 180 ms apart; each hexagon draws its outline after its branch finishes, then fills white.",
	group: "collab",
	groupLabel: "Working together",
	w: 236,
	h: 145,
	scale: 1.8,
	holds: 3,
	bare: false,
	card: true,
}, {
	id: "principleVendor",
	name: "Principle vendor",
	moment: "Two hexagons and two circles draw their outlines, starting 180 ms apart, then fill white. Dotted connections start drawing during the shape intro, 140 ms apart. A single purple trail then travels between the shapes at 144 px/s. Once/Loop playback ends after the trail fully clears the final connection.",
	group: "agents",
	groupLabel: "Agents",
	w: 236,
	h: 145,
	scale: 1.8,
	holds: null,
	bare: false,
	card: true,
}, {
	id: "principleSync",
	name: "Principle sync",
	moment: "A gradient dotted circle draws clockwise, then a hexagon draws and fills white. The centre dot fades in, followed by two hands drawing outwards. The ring rotates every 90 seconds and the purple hand every 45 seconds; the green hand stays fixed.",
	group: "agents",
	groupLabel: "Agents",
	w: 236,
	h: 145,
	scale: 1.8,
	holds: null,
	bare: false,
	card: true,
}];

/** Host-owned Linked rings animation follows the TWG microsite spinner. */
export const FINALE_KIT_OVERRIDES: Partial<Record<PieceId, Partial<Pick<KitPiece, "moment" | "holds" | "w" | "h" | "scale" | "bare" | "card">>>> = {
	sourcesPopover: {
		moment: "The dropdown slides down and fades in over 360 ms, then its source rows fade in over 480 ms each, 35 ms apart. The completed menu holds inside a padded card.",
		w: 604, h: 478, scale: 0.65, holds: 2.2, bare: false, card: true,
	},
	ringsTile: {
		moment: "Four rings burst out from the centre. A connection draws and retracts between them, then the rings turn 45° and trace the next pattern continuously.",
		holds: null,
	},
};

// Keep retired pieces out of the finale catalogue; loomRecordBar covers the recorder.
export const STAGE_KIT_PIECES: readonly KitPiece[] = (kitCatalogue as readonly KitPiece[])
	.filter((piece) => piece.id !== "recordForAgent" && piece.id !== "cursorActivity")
	.map((piece) => ({ ...piece, ...FINALE_KIT_OVERRIDES[piece.id] }));
export const FINALE_PIECES: readonly FinalePiece[] = [...STAGE_KIT_PIECES, ...LOCAL_FINALE_PIECES];

export function finalePieceTag(id: string): "answer-sources" | "amp-mark" | "send-to-agent" | "content-attribution" | "code-search-greeting" | "enterprise-capabilities" | "agent-lanyard-sticker" | "atlassian-connect" | "multiplayer-collaboration" | "linked-rings" | "agent-work-chart" | "agent-session-stack" | "twg-search-strip" | "agent-activity-feed" | "realtime-editing" | "agent-proliferation" | "principle-flow" | "human-agent-network" | "principle-sync" | "principle-vendor" | "activity-timeline-piece" | "rovo-piece" {
	if (id === "sourcesPopover") return "answer-sources";
	if (id === "sendToAgent") return "send-to-agent";
	if (id === "ampMark") return "amp-mark";
	if (id === "contentAttribution") return "content-attribution";
	if (id === "codeSearchGreeting") return "code-search-greeting";
	if (id === "enterpriseCapabilities") return "enterprise-capabilities";
	if (id === "agentLanyard") return "agent-lanyard-sticker";
	if (id === "atlassianConnect") return "atlassian-connect";
	if (id === "multiplayer") return "multiplayer-collaboration";
	if (id === "activityTimeline") return "activity-timeline-piece";
	if (id === "ringsTile") return "linked-rings";
	if (id === "agentWorkChart") return "agent-work-chart";
	if (id === "agentSessionStack") return "agent-session-stack";
	if (id === "principleVendor") return "principle-vendor";
	if (id === "principleSync") return "principle-sync";
	if (id === "humanAgentNetwork") return "human-agent-network";
	if (id === "principleFlow") return "principle-flow";
	if (id === "agentProliferation") return "agent-proliferation";
	if (id === "realtimeEditing") return "realtime-editing";
	if (id === "agentActivityFeed") return "agent-activity-feed";
	return id === "twgSearchStrip" ? "twg-search-strip" : "rovo-piece";
}
