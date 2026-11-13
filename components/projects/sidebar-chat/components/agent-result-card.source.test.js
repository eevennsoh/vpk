const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const AGENT_RESULT_CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "agent-result-card.tsx"),
	"utf8",
);
const MESSAGE_BUBBLE_SOURCE = fs.readFileSync(
	path.join(__dirname, "message-bubble.tsx"),
	"utf8",
);
const CHAT_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "../page.tsx"),
	"utf8",
);
const MESSAGE_TURNS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../shared/message-turns.tsx"),
	"utf8",
);
const APP_LAYOUT_SOURCE = fs.readFileSync(path.join(__dirname, "../../page.tsx"), "utf8");
const FLOATING_CHAT_SOURCE = fs.readFileSync(path.join(__dirname, "../../rovo-floating-chat/components/rovo-floating-chat.tsx"), "utf8");

test("route viewer identity attributes generated agents on both chat surfaces while defaulting to Venn", () => {
	assert.match(AGENT_RESULT_CARD_SOURCE, /creator\?: AgentResultCreator;/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /creator = DEFAULT_AGENT_CREATOR/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /const DEFAULT_AGENT_CREATOR: AgentResultCreator = \{\s*name: AGENT_CREATOR_NAME,\s*avatarSrc: AGENT_CREATOR_AVATAR_SRC,/u);
	assert.match(CHAT_PANEL_SOURCE, /agentCreator\?: AgentResultCreator;/u);
	assert.equal((CHAT_PANEL_SOURCE.match(/<AgentResultCard creator=\{agentCreator\}/gu) ?? []).length, 2);
	assert.equal((APP_LAYOUT_SOURCE.match(/agentCreator=\{currentUser\}/gu) ?? []).length, 2);
	assert.match(FLOATING_CHAT_SOURCE, /agentCreator\?: AgentResultCreator;/u);
	assert.match(FLOATING_CHAT_SOURCE, /<ChatPanel\s*agentCreator=\{agentCreator\}/u);
});

test("AgentResultCard renders created agent profile description", () => {
	assert.match(
		AGENT_RESULT_CARD_SOURCE,
		/import \{ AgentProfileCard \} from "@\/components\/blocks\/agent-profile-card";/u,
	);
	assert.match(AGENT_RESULT_CARD_SOURCE, /data-testid="rovo-agent-result-card"/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /export function isGeneratedAgentResult/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /return agent\?\.action === "create";/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /if \(!isGeneratedAgentResult\(agent\)\) \{[\s\S]*return null;[\s\S]*\}/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /function getAgentDescription\(agent: AgentResult\): string/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /RFP Drafter monitors Drafting work items, reads Jira context/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /getDeterministicAgentAvatarSrc\(agent\.agentId\?\.trim\(\) \|\| agent\.name\)/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /function getAgentDisplayName\(agent: AgentResult\): string/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /const RFP_DRAFTING_AGENT_ID = "rfp-drafting-agent";/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /agent\.agentId === RFP_DRAFTING_AGENT_ID \? "RFP Drafter" : agent\.name/u);
	// Generated agents are attributed to the studio owner (a person), not the
	// Atlassian company, and the card uses the "preview" footer variant.
	assert.match(AGENT_RESULT_CARD_SOURCE, /const AGENT_CREATOR_NAME = "Venn Soh";/u);
	assert.match(AGENT_RESULT_CARD_SOURCE, /const AGENT_CREATOR_AVATAR_SRC = "\/avatar-user\/venn\/venn\.png";/u);
	assert.match(
		AGENT_RESULT_CARD_SOURCE,
		/<AgentProfileCard[\s\S]*attributionKind="person"[\s\S]*avatarSrc=\{avatarSrc\}[\s\S]*coverSrc=\{avatarSrc\}[\s\S]*description=\{description\}[\s\S]*name=\{displayName\}[\s\S]*editActionLabel=\{`Edit \$\{displayName\}`\}[\s\S]*onEditAction=\{handleSelectAgent\}[\s\S]*onPreviewAction=\{handleSelectAgent\}[\s\S]*onSwapAction=\{handleSelectAgent\}[\s\S]*partnerLogoSrc=\{creator\.avatarSrc\}[\s\S]*partnerName=\{creator\.name\}[\s\S]*previewActionLabel=\{`View \$\{displayName\}`\}[\s\S]*swapActionLabel="Chat with agent"[\s\S]*variant="preview"[\s\S]*verified=\{false\}[\s\S]*\/>/u,
	);
	assert.doesNotMatch(AGENT_RESULT_CARD_SOURCE, /onInputAction/u);
	assert.doesNotMatch(AGENT_RESULT_CARD_SOURCE, /onVoiceInput/u);
	assert.doesNotMatch(AGENT_RESULT_CARD_SOURCE, /ArtifactCard/u);
	assert.doesNotMatch(AGENT_RESULT_CARD_SOURCE, /SkillTag/u);
});

test("AgentResultCard dispatches a generic select-agent event", () => {
	assert.match(
		AGENT_RESULT_CARD_SOURCE,
		/export const ROVO_AGENT_RESULT_SELECT_EVENT = "rovo:select-agent-result";/u,
	);
	assert.match(
		AGENT_RESULT_CARD_SOURCE,
		/onSelectAgent\?\.\(agent\);[\s\S]*window\.dispatchEvent\(new CustomEvent\(ROVO_AGENT_RESULT_SELECT_EVENT, \{[\s\S]*agentId: agent\.agentId,[\s\S]*source: "agent-result-card"/u,
	);
});

test("MessageBubble leaves generated result cards outside the assistant message", () => {
	assert.doesNotMatch(MESSAGE_BUBBLE_SOURCE, /getMessageAgentResult/u);
	assert.doesNotMatch(MESSAGE_BUBBLE_SOURCE, /AgentResultCard/u);
	assert.doesNotMatch(MESSAGE_BUBBLE_SOURCE, /ArtifactResultCard/u);
});

test("ChatPanel renders generated result cards after the turn container", () => {
	assert.match(MESSAGE_TURNS_SOURCE, /renderTurnAfter\?:/u);
	assert.match(
		MESSAGE_TURNS_SOURCE,
		/<\/div>[\s\S]*\{hasRenderedTurnAfter \? renderedTurnAfter : null\}/u,
	);
	assert.match(CHAT_PANEL_SOURCE, /getMessageAgentResult/u);
	assert.match(CHAT_PANEL_SOURCE, /getMessageArtifactResult/u);
	assert.match(CHAT_PANEL_SOURCE, /hasTurnCompleteSignal/u);
	assert.match(CHAT_PANEL_SOURCE, /import \{ ArtifactResultCard, type ArtifactResult \} from "\.\/components\/artifact-result-card";/u);
	assert.match(CHAT_PANEL_SOURCE, /import \{ AgentResultCard, isGeneratedAgentResult, type AgentResultCreator \} from "\.\/components\/agent-result-card";/u);
	assert.match(CHAT_PANEL_SOURCE, /const handleAgentResultSelect = useCallback\(\(agent: RovoDataParts\["agent-result"\]\) => \{[\s\S]*selectableAgents\.some\(\(selectableAgent\) => selectableAgent\.id === agent\.agentId\)[\s\S]*selectAgent\(agent\.agentId\);/u);
	assert.match(
		CHAT_PANEL_SOURCE,
		/renderTurnAfter=\{\(turn\) => \{[\s\S]*const shouldRenderGeneratedAgentResult = cards\?\.shouldRenderGeneratedAgentResult;[\s\S]*const generatedAgentResult =[\s\S]*isGeneratedAgentResult\(agentResult\) &&[\s\S]*hasTurnCompleteSignal\(message\) &&[\s\S]*\(shouldRenderGeneratedAgentResult\?\.\(\{ agent: agentResult, message \}\) \?\? true\)[\s\S]*if \(artifactResult && !generatedAgentResult\)[\s\S]*if \(generatedAgentResult\)[\s\S]*className="w-full space-y-2" data-testid="rovo-generated-result-group"[\s\S]*<ArtifactResultCard[\s\S]*<AgentResultCard[\s\S]*onSelectAgent=\{handleAgentResultSelect\}/u,
	);
});
