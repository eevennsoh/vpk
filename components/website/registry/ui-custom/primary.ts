import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_CUSTOM_PRIMARY_DEMOS: Record<string, ComponentType> = {
	"human-agent-avatar": dynamic(() => import("../../demos/ui-custom/human-agent-avatar-demo"), {
		ssr: false,
	}),
	"agent-loading": dynamic(() => import("../../demos/ui-custom/agent-loading-demo"), {
		ssr: false,
	}),
	footer: dynamic(() => import("../../demos/ui-custom/footer-demo"), { ssr: false }),
	"hover-reveal-row": dynamic(
		() => import("../../demos/ui-custom/hover-reveal-row-demo"),
		{ ssr: false },
	),
	"entity-card": dynamic(() => import("../../demos/ui-custom/entity-card-demo"), {
		ssr: false,
	}),
	"object-tile": dynamic(() => import("../../demos/ui-custom/object-tile-demo"), {
		ssr: false,
	}),
	"pixel-loader": dynamic(() => import("../../demos/ui-custom/pixel-loader-demo"), {
		ssr: false,
	}),
	"progress-circle": dynamic(() => import("../../demos/ui-custom/progress-circle-demo"), {
		ssr: false,
	}),
	"progress-rovo": dynamic(() => import("../../demos/ui-custom/progress-rovo-demo"), {
		ssr: false,
	}),
	"sidebar-nav-item": dynamic(() => import("../../demos/ui-custom/sidebar-nav-item-demo"), {
		ssr: false,
	}),
	"skill-tag": dynamic(() => import("../../demos/ui-custom/skill-tag-demo"), {
		ssr: false,
	}),
	knowledge: dynamic(() => import("../../demos/ui-custom/knowledge-demo"), {
		ssr: false,
	}),
	"animated-dots": dynamic(() => import("../../demos/ui-custom/animated-dots-demo"), {
		ssr: false,
	}),
	"animated-icon": dynamic(() => import("../../demos/ui-custom/animated-icon-demo"), {
		ssr: false,
	}),
	"artifact-list": dynamic(() => import("../../demos/ui-custom/artifact-list-demo"), {
		ssr: false,
	}),
	attachments: dynamic(() => import("../../demos/ui-custom/attachments-demo"), {
		ssr: false,
	}),
	"audio-player": dynamic(() => import("../../demos/ui-custom/audio-player-demo"), {
		ssr: false,
	}),
	canvas: dynamic(() => import("../../demos/ui-custom/canvas-demo"), { ssr: false }),
	"chain-of-thought": dynamic(
		() => import("../../demos/ui-custom/chain-of-thought-demo"),
		{ ssr: false },
	),
	checkpoint: dynamic(() => import("../../demos/ui-custom/checkpoint-demo"), {
		ssr: false,
	}),
	"code-block": dynamic(() => import("../../demos/ui-custom/code-block-demo"), {
		ssr: false,
	}),
	"code-list": dynamic(() => import("../../demos/ui-custom/code-list-demo"), {
		ssr: false,
	}),
	commit: dynamic(() => import("../../demos/ui-custom/commit-demo"), { ssr: false }),
	confirmation: dynamic(() => import("../../demos/ui-custom/confirmation-demo"), {
		ssr: false,
	}),
	connection: dynamic(() => import("../../demos/ui-custom/connection-demo"), {
		ssr: false,
	}),
	context: dynamic(() => import("../../demos/ui-custom/context-demo"), { ssr: false }),
	"context-bar": dynamic(() => import("../../demos/ui-custom/context-bar-demo"), {
		ssr: false,
	}),
	controls: dynamic(() => import("../../demos/ui-custom/controls-demo"), {
		ssr: false,
	}),
	conversation: dynamic(() => import("../../demos/ui-custom/conversation-demo"), {
		ssr: false,
	}),
	edge: dynamic(() => import("../../demos/ui-custom/edge-demo"), { ssr: false }),
	"environment-variables": dynamic(
		() => import("../../demos/ui-custom/environment-variables-demo"),
		{ ssr: false },
	),
	"file-tree": dynamic(() => import("../../demos/ui-custom/file-tree-demo"), {
		ssr: false,
	}),
	"file-tree-2": dynamic(() => import("../../demos/ui-custom/file-tree-2-demo"), {
		ssr: false,
	}),
	image: dynamic(() => import("../../demos/ui-custom/image-demo"), { ssr: false }),
	"inline-citation": dynamic(
		() => import("../../demos/ui-custom/inline-citation-demo"),
		{ ssr: false },
	),
	"jsx-preview": dynamic(() => import("../../demos/ui-custom/jsx-preview-demo"), {
		ssr: false,
	}),
	list: dynamic(() => import("../../demos/ui-custom/list-demo"), { ssr: false }),
	message: dynamic(() => import("../../demos/ui-custom/message-demo"), { ssr: false }),
	"mic-selector": dynamic(() => import("../../demos/ui-custom/mic-selector-demo"), {
		ssr: false,
	}),
	"model-selector": dynamic(() => import("../../demos/ui-custom/model-selector-demo"), {
		ssr: false,
	}),
	node: dynamic(() => import("../../demos/ui-custom/node-demo"), { ssr: false }),
	"open-in-chat": dynamic(() => import("../../demos/ui-custom/open-in-chat-demo"), {
		ssr: false,
	}),
	"package-info": dynamic(() => import("../../demos/ui-custom/package-info-demo"), {
		ssr: false,
	}),
	"flow-panel": dynamic(() => import("../../demos/ui-custom/flow-panel-demo"), { ssr: false }),
	persona: dynamic(() => import("../../demos/ui-custom/persona-demo"), { ssr: false }),
	plan: dynamic(() => import("../../demos/ui-custom/plan-demo"), { ssr: false }),
	"prompt-input": dynamic(() => import("../../demos/ui-custom/prompt-input-demo"), {
		ssr: false,
	}),
	queue: dynamic(() => import("../../demos/ui-custom/queue-demo"), { ssr: false }),
	reasoning: dynamic(() => import("../../demos/ui-custom/reasoning-demo"), {
		ssr: false,
	}),
	sandbox: dynamic(() => import("../../demos/ui-custom/sandbox-demo"), { ssr: false }),
	"schema-display": dynamic(() => import("../../demos/ui-custom/schema-display-demo"), {
		ssr: false,
	}),
	shimmer: dynamic(() => import("../../demos/ui-custom/shimmer-demo"), { ssr: false }),
	"shimmer-wave": dynamic(() => import("../../demos/ui-custom/shimmer-wave-demo"), {
		ssr: false,
	}),
	snippet: dynamic(() => import("../../demos/ui-custom/snippet-demo"), { ssr: false }),
	sources: dynamic(() => import("../../demos/ui-custom/sources-demo"), { ssr: false }),
	"speech-input": dynamic(() => import("../../demos/ui-custom/speech-input-demo"), {
		ssr: false,
	}),
	"stack-trace": dynamic(() => import("../../demos/ui-custom/stack-trace-demo"), {
		ssr: false,
	}),
	suggestion: dynamic(() => import("../../demos/ui-custom/suggestion-demo"), {
		ssr: false,
	}),
	task: dynamic(() => import("../../demos/ui-custom/task-demo"), { ssr: false }),
	terminal: dynamic(() => import("../../demos/ui-custom/terminal-demo"), {
		ssr: false,
	}),
	"test-results": dynamic(() => import("../../demos/ui-custom/test-results-demo"), {
		ssr: false,
	}),
	tool: dynamic(() => import("../../demos/ui-custom/tool-demo"), { ssr: false }),
	"twg-appstack": dynamic(() => import("../../demos/ui-custom/twg-appstack-demo"), {
		ssr: false,
	}),
	"twg-tool": dynamic(() => import("../../demos/ui-custom/twg-tool-demo"), {
		ssr: false,
	}),
	"twg-loader": dynamic(() => import("../../demos/ui-custom/twg-loader-demo"), {
		ssr: false,
	}),
	toolbar: dynamic(() => import("../../demos/ui-custom/toolbar-demo"), { ssr: false }),
	transcription: dynamic(() => import("../../demos/ui-custom/transcription-demo"), {
		ssr: false,
	}),
	"voice-selector": dynamic(() => import("../../demos/ui-custom/voice-selector-demo"), {
		ssr: false,
	}),
	"web-preview": dynamic(() => import("../../demos/ui-custom/web-preview-demo"), {
		ssr: false,
	}),
	"animated-rovo": dynamic(() => import("../../demos/ui-custom/animated-rovo-demo"), {
		ssr: false,
	}),
	"morphing-rovo": dynamic(() => import("../../demos/ui-custom/morphing-rovo-demo"), {
		ssr: false,
	}),
	"rovo-cursor": dynamic(() => import("../../demos/ui-custom/rovo-cursor-demo"), {
		ssr: false,
	}),
	"rovo-generation": dynamic(
		() => import("../../demos/ui-custom/rovo-generation-demo"),
		{ ssr: false },
	),
	"rovo-illustration": dynamic(
		() => import("../../demos/ui-custom/rovo-illustration-demo"),
		{ ssr: false },
	),
	"rovo-sparkle": dynamic(() => import("../../demos/ui-custom/rovo-sparkle-demo"), {
		ssr: false,
	}),
};
