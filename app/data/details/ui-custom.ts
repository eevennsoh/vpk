import type { ComponentDetail } from "@/app/data/component-detail-types";

import { HUMAN_AGENT_AVATAR_DETAIL } from "./ui-custom/human-agent-avatar";
import { AGENT_LOADING_DETAIL } from "./ui-custom/agent-loading";
import { HOVER_REVEAL_ROW_DETAIL } from "./ui-custom/hover-reveal-row";
import { FOOTER_DETAIL } from "./ui-custom/footer";
import { OBJECT_TILE_DETAIL } from "./ui-custom/object-tile";
import { PROGRESS_CIRCLE_DETAIL } from "./ui-custom/progress-circle";
import { PROGRESS_ROVO_DETAIL } from "./ui-custom/progress-rovo";
import { SIDEBAR_NAV_ITEM_DETAIL } from "./ui-custom/sidebar-nav-item";
import { ENTITY_CARD_DETAIL } from "./ui-custom/entity-card";
import { SKILL_TAG_DETAIL } from "./ui-custom/skill-tag";
import { AUDIO_PLAYER_DETAIL } from "./ui-custom/audio-player";
import { KNOWLEDGE_DETAIL } from "./ui-custom/knowledge";
import { ANIMATED_DOTS_DETAIL } from "./ui-custom/animated-dots";
import { ANIMATED_ICON_DETAIL } from "./ui-custom/animated-icon";
import { ANIMATED_ROVO_DETAIL } from "./ui-custom/animated-rovo";
import { MORPHING_ROVO_DETAIL } from "./ui-custom/morphing-rovo";
import { ROVO_CURSOR_DETAIL } from "./ui-custom/rovo-cursor";
import { ROVO_GENERATION_DETAIL } from "./ui-custom/rovo-generation";
import { ROVO_ILLUSTRATION_DETAIL } from "./ui-custom/rovo-illustration";
import { ROVO_SPARKLE_DETAIL } from "./ui-custom/rovo-sparkle";
import { ATTACHMENTS_DETAIL } from "./ui-custom/attachments";
import { CHECKPOINT_DETAIL } from "./ui-custom/checkpoint";
import { COMMIT_DETAIL } from "./ui-custom/commit";
import { CODE_BLOCK_DETAIL } from "./ui-custom/code-block";
import { CODE_LIST_DETAIL } from "./ui-custom/code-list";
import { CHAIN_OF_THOUGHT_DETAIL } from "./ui-custom/chain-of-thought";
import { CANVAS_DETAIL } from "./ui-custom/canvas";
import { LIST_DETAIL } from "./ui-custom/list";
import { MESSAGE_DETAIL } from "./ui-custom/message";
import { PERSONA_DETAIL } from "./ui-custom/persona";
import { PIXEL_LOADER_DETAIL } from "./ui-custom/pixel-loader";
import { PLAN_DETAIL } from "./ui-custom/plan";
import { PROMPT_INPUT_DETAIL } from "./ui-custom/prompt-input";
import { QUEUE_DETAIL } from "./ui-custom/queue";
import { ARTIFACT_LIST_DETAIL } from "./ui-custom/artifact-list";
import { CONFIRMATION_DETAIL } from "./ui-custom/confirmation";
import { CONNECTION_DETAIL } from "./ui-custom/connection";
import { CONTEXT_DETAIL } from "./ui-custom/context";
import { CONTEXT_BAR_DETAIL } from "./ui-custom/context-bar";
import { IMAGE_DETAIL } from "./ui-custom/image";
import { REASONING_DETAIL } from "./ui-custom/reasoning";
import { SANDBOX_DETAIL } from "./ui-custom/sandbox";
import { ENVIRONMENT_VARIABLES_DETAIL } from "./ui-custom/environment-variables";
import { FILE_TREE_DETAIL } from "./ui-custom/file-tree";
import { FILE_TREE_2_DETAIL } from "./ui-custom/file-tree-2";
import { CONTROLS_DETAIL } from "./ui-custom/controls";
import { CONVERSATION_DETAIL } from "./ui-custom/conversation";
import { EDGE_DETAIL } from "./ui-custom/edge";
import { JSX_PREVIEW_DETAIL } from "./ui-custom/jsx-preview";
import { MIC_SELECTOR_DETAIL } from "./ui-custom/mic-selector";
import { INLINE_CITATION_DETAIL } from "./ui-custom/inline-citation";
import { MODEL_SELECTOR_DETAIL } from "./ui-custom/model-selector";
import { PACKAGE_INFO_DETAIL } from "./ui-custom/package-info";
import { OPEN_IN_CHAT_DETAIL } from "./ui-custom/open-in-chat";
import { NODE_DETAIL } from "./ui-custom/node";
import { SCHEMA_DISPLAY_DETAIL } from "./ui-custom/schema-display";
import { SHIMMER_DETAIL } from "./ui-custom/shimmer";
import { SHIMMER_WAVE_DETAIL } from "./ui-custom/shimmer-wave";
import { SNIPPET_DETAIL } from "./ui-custom/snippet";
import { SPEECH_INPUT_DETAIL } from "./ui-custom/speech-input";
import { SOURCES_DETAIL } from "./ui-custom/sources";
import { STACK_TRACE_DETAIL } from "./ui-custom/stack-trace";
import { SUGGESTION_DETAIL } from "./ui-custom/suggestion";
import { TASK_DETAIL } from "./ui-custom/task";
import { TOOL_DETAIL } from "./ui-custom/tool";
import { TWG_LOADER_DETAIL } from "./ui-custom/twg-loader";
import { TWG_APPSTACK_DETAIL } from "./ui-custom/twg-appstack";
import { TWG_TOOL_DETAIL } from "./ui-custom/twg-tool";
import { TEST_RESULTS_DETAIL } from "./ui-custom/test-results";
import { TERMINAL_DETAIL } from "./ui-custom/terminal";
import { FLOW_PANEL_DETAIL } from "./ui-custom/flow-panel";
import { TOOLBAR_DETAIL } from "./ui-custom/toolbar";
import { TRANSCRIPTION_DETAIL } from "./ui-custom/transcription";
import { VOICE_SELECTOR_DETAIL } from "./ui-custom/voice-selector";
import { WEB_PREVIEW_DETAIL } from "./ui-custom/web-preview";

export const UI_CUSTOM_DETAILS: Record<string, ComponentDetail> = {
	"agent-loading": AGENT_LOADING_DETAIL,
	"human-agent-avatar": HUMAN_AGENT_AVATAR_DETAIL,
	"hover-reveal-row": HOVER_REVEAL_ROW_DETAIL,
	footer: FOOTER_DETAIL,
	"object-tile": OBJECT_TILE_DETAIL,
	"progress-circle": PROGRESS_CIRCLE_DETAIL,
	"progress-rovo": PROGRESS_ROVO_DETAIL,
	"sidebar-nav-item": SIDEBAR_NAV_ITEM_DETAIL,
	"entity-card": ENTITY_CARD_DETAIL,
	"skill-tag": SKILL_TAG_DETAIL,
	"audio-player": AUDIO_PLAYER_DETAIL,
	knowledge: KNOWLEDGE_DETAIL,
	"animated-dots": ANIMATED_DOTS_DETAIL,
	"animated-icon": ANIMATED_ICON_DETAIL,
	"animated-rovo": ANIMATED_ROVO_DETAIL,
	"morphing-rovo": MORPHING_ROVO_DETAIL,
	"rovo-cursor": ROVO_CURSOR_DETAIL,
	"rovo-generation": ROVO_GENERATION_DETAIL,
	"rovo-illustration": ROVO_ILLUSTRATION_DETAIL,
	"rovo-sparkle": ROVO_SPARKLE_DETAIL,
	attachments: ATTACHMENTS_DETAIL,
	checkpoint: CHECKPOINT_DETAIL,
	commit: COMMIT_DETAIL,
	"code-block": CODE_BLOCK_DETAIL,
	"code-list": CODE_LIST_DETAIL,
	"chain-of-thought": CHAIN_OF_THOUGHT_DETAIL,
	canvas: CANVAS_DETAIL,
	list: LIST_DETAIL,
	message: MESSAGE_DETAIL,
	persona: PERSONA_DETAIL,
	"pixel-loader": PIXEL_LOADER_DETAIL,
	plan: PLAN_DETAIL,
	"prompt-input": PROMPT_INPUT_DETAIL,
	queue: QUEUE_DETAIL,
	"artifact-list": ARTIFACT_LIST_DETAIL,
	confirmation: CONFIRMATION_DETAIL,
	connection: CONNECTION_DETAIL,
	context: CONTEXT_DETAIL,
	"context-bar": CONTEXT_BAR_DETAIL,
	image: IMAGE_DETAIL,
	reasoning: REASONING_DETAIL,
	sandbox: SANDBOX_DETAIL,
	"environment-variables": ENVIRONMENT_VARIABLES_DETAIL,
	"file-tree": FILE_TREE_DETAIL,
	"file-tree-2": FILE_TREE_2_DETAIL,
	controls: CONTROLS_DETAIL,
	conversation: CONVERSATION_DETAIL,
	edge: EDGE_DETAIL,
	"jsx-preview": JSX_PREVIEW_DETAIL,
	"mic-selector": MIC_SELECTOR_DETAIL,
	"inline-citation": INLINE_CITATION_DETAIL,
	"model-selector": MODEL_SELECTOR_DETAIL,
	"package-info": PACKAGE_INFO_DETAIL,
	"open-in-chat": OPEN_IN_CHAT_DETAIL,
	node: NODE_DETAIL,
	"schema-display": SCHEMA_DISPLAY_DETAIL,
	shimmer: SHIMMER_DETAIL,
	"shimmer-wave": SHIMMER_WAVE_DETAIL,
	snippet: SNIPPET_DETAIL,
	"speech-input": SPEECH_INPUT_DETAIL,
	sources: SOURCES_DETAIL,
	"stack-trace": STACK_TRACE_DETAIL,
	suggestion: SUGGESTION_DETAIL,
	task: TASK_DETAIL,
	tool: TOOL_DETAIL,
	"twg-loader": TWG_LOADER_DETAIL,
	"twg-appstack": TWG_APPSTACK_DETAIL,
	"twg-tool": TWG_TOOL_DETAIL,
	"test-results": TEST_RESULTS_DETAIL,
	terminal: TERMINAL_DETAIL,
	"flow-panel": FLOW_PANEL_DETAIL,
	toolbar: TOOLBAR_DETAIL,
	transcription: TRANSCRIPTION_DETAIL,
	"voice-selector": VOICE_SELECTOR_DETAIL,
	"web-preview": WEB_PREVIEW_DETAIL,
};
