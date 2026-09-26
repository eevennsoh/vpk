import type { AgentLanyardCollection } from "./first-party-data";

export interface AgentLanyardFirstPartyBadge {
	glyphSrc: string;
	glyphWidth: number;
	glyphHeight: number;
	glyphX?: number;
	glyphY?: number;
	glyphScale?: number;
}

const ROOT = "/1p/agent-lanyard";

export function customFirstPartyBadge(collection: AgentLanyardCollection): AgentLanyardFirstPartyBadge {
	return {
		glyphSrc: `${ROOT}/glyph-custom-${collection === "teamwork" ? "white" : "black"}.svg`,
		glyphWidth: 36, glyphHeight: 36,
	};
}

// Original SVG dimensions and glyph offsets from Figma 3381:3537's 48px frames.
const GLYPHS = {
	"content-reviewer": { glyphWidth: 25.5, glyphHeight: 20.25, glyphX: 5.25, glyphY: 8.25 },
	"jira-admin": { glyphWidth: 36, glyphHeight: 36 },
	"jira-delivery": { glyphWidth: 36, glyphHeight: 36 },
	"jira-planner": { glyphWidth: 36, glyphHeight: 36 },
	"jira-triage": { glyphWidth: 23.5422, glyphHeight: 27.0535, glyphX: 6.75, glyphY: 4.464 },
	"code-reviewer": { glyphWidth: 24, glyphHeight: 24.3107, glyphX: 6, glyphY: 4.9392 },
	"jira-autodev": { glyphWidth: 36, glyphHeight: 36 },
	"jira-coding": { glyphWidth: 48, glyphHeight: 48, glyphScale: 37.895 / 48 },
	"ops-expert": { glyphWidth: 17.969, glyphHeight: 21.9137, glyphX: 9.7488, glyphY: 6.75 },
	"request-resolver": { glyphWidth: 36, glyphHeight: 36 },
} as const;

export type NamedFirstPartyAgentId = keyof typeof GLYPHS;

export function namedFirstPartyBadge(id: NamedFirstPartyAgentId): AgentLanyardFirstPartyBadge {
	return { glyphSrc: `${ROOT}/glyph-${id}.svg`, ...GLYPHS[id] };
}
