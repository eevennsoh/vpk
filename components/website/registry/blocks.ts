import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { BLOCK_VARIANT_DEMO_ENTRIES } from "./blocks-variants";

export const BLOCK_DEMOS: Record<string, ComponentType> = {
	agent: dynamic(() => import("../demos/blocks/agent-demo"), { ssr: false }),
	"skill-config": dynamic(() => import("../demos/blocks/skill-config-demo"), {
		ssr: false,
	}),
	"trigger-config": dynamic(() => import("../demos/blocks/trigger-config-demo"), {
		ssr: false,
	}),
	"agent-bento": dynamic(() => import("../demos/blocks/agent-bento-demo"), {
		ssr: false,
	}),
	"agent-card": dynamic(() => import("../demos/blocks/agent-card-demo"), {
		ssr: false,
	}),
	"twg-agent-card": dynamic(() => import("../demos/blocks/twg-agent-card-demo"), {
		ssr: false,
	}),
	"agent-profile-card": dynamic(() => import("../demos/blocks/agent-profile-card-demo"), {
		ssr: false,
	}),
	"agent-directory": dynamic(
		() => import("../demos/blocks/agent-directory-demo"),
		{ ssr: false },
	),
	"agent-templates": dynamic(
		() => import("../demos/blocks/agent-templates-demo"),
		{ ssr: false },
	),
	"apps-directory": dynamic(
		() => import("../demos/blocks/apps-directory-demo"),
		{ ssr: false },
	),
	"apps-directory-demo-standard": dynamic(
		() =>
			import("../demos/blocks/apps-directory-demo").then((mod) => ({
				default: mod.AppsDirectoryDemoStandard,
			})),
		{ ssr: false },
	),
	"apps-directory-demo-experimental": dynamic(
		() =>
			import("../demos/blocks/apps-directory-demo").then((mod) => ({
				default: mod.AppsDirectoryDemoExperimental,
			})),
		{ ssr: false },
	),
	artifact: dynamic(() => import("../demos/blocks/artifact-demo"), {
		ssr: false,
	}),
	"artifact-pane": dynamic(
		() => import("../demos/blocks/artifact-pane-demo"),
		{ ssr: false },
	),
	"tools-directory": dynamic(
		() => import("../demos/blocks/tools-directory-demo"),
		{ ssr: false },
	),
	"skills-directory": dynamic(
		() => import("../demos/blocks/skills-directory-demo"),
		{ ssr: false },
	),
	"skills-directory-demo-standard": dynamic(
		() =>
			import("../demos/blocks/skills-directory-demo").then((mod) => ({
				default: mod.SkillsDirectoryDemoStandard,
			})),
		{ ssr: false },
	),
	"skills-directory-demo-experimental": dynamic(
		() =>
			import("../demos/blocks/skills-directory-demo").then((mod) => ({
				default: mod.SkillsDirectoryDemoExperimental,
			})),
		{ ssr: false },
	),
	"smart-link": dynamic(() => import("../demos/blocks/smart-link-demo"), {
		ssr: false,
	}),
	"pull-request": dynamic(() => import("../demos/blocks/pull-request-demo"), {
		ssr: false,
	}),
	"pull-request-header": dynamic(
		() => import("../demos/blocks/pull-request-header-demo"),
		{ ssr: false },
	),
	"pull-request-review": dynamic(
		() => import("../demos/blocks/pull-request-review-demo"),
		{ ssr: false },
	),
	"pull-request-fix": dynamic(
		() => import("../demos/blocks/pull-request-fix-demo"),
		{ ssr: false },
	),
	"emoji-picker": dynamic(() => import("../demos/blocks/emoji-picker-demo"), {
		ssr: false,
	}),
	"knowledge-directory": dynamic(
		() => import("../demos/blocks/knowledge-directory-demo"),
		{ ssr: false },
	),
	"conversation-starters": dynamic(
		() => import("../demos/blocks/conversation-starters-demo"),
		{ ssr: false },
	),
	"agent-users": dynamic(
		() => import("../demos/blocks/agent-users-demo"),
		{ ssr: false },
	),
	"agent-access": dynamic(() => import("../demos/blocks/agent-access-demo"), {
		ssr: false,
	}),
	"agent-evaluation": dynamic(
		() => import("../demos/blocks/agent-evaluation-demo"),
		{ ssr: false },
	),
	"agent-insights": dynamic(
		() => import("../demos/blocks/agent-insights-demo"),
		{ ssr: false },
	),
	"agent-test": dynamic(() => import("../demos/blocks/agent-test-demo"), {
		ssr: false,
	}),
	"agent-surfaces": dynamic(
		() => import("../demos/blocks/agent-surfaces-demo"),
		{ ssr: false },
	),
	"agent-progress": dynamic(
		() => import("../demos/blocks/agent-progress-demo"),
		{ ssr: false },
	),
	"agent-states": dynamic(
		() => import("../demos/blocks/agent-states-demo"),
		{ ssr: false },
	),
	"agent-assignment": dynamic(
		() => import("../demos/blocks/agent-assignment-demo"),
		{ ssr: false },
	),
	"agent-selector": dynamic(
		() => import("../demos/blocks/agent-selector-demo"),
		{ ssr: false },
	),
	"skill-selector": dynamic(
		() => import("../demos/blocks/skill-selector-demo"),
		{ ssr: false },
	),
	"jira-work-item": dynamic(
		() => import("../demos/blocks/jira-work-item-demo"),
		{ ssr: false },
	),
	"agent-session-flyout": dynamic(
		() => import("../demos/blocks/agent-session-flyout-demo"),
		{ ssr: false },
	),
	omnibar: dynamic(() => import("../demos/blocks/omnibar-demo"), {
		ssr: false,
	}),
	scrubber: dynamic(() => import("../demos/blocks/scrubber-demo"), {
		ssr: false,
	}),
	"jira-work-item-demo-standard": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoStandard,
			})),
		{ ssr: false },
	),
	"jira-work-item-demo-experimental": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoExperimental,
			})),
		{ ssr: false },
	),
	"jira-work-item-demo-experimental-v2": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoExperimentalV2,
			})),
		{ ssr: false },
	),
	"jira-work-item-demo-experimental-v3": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoExperimentalV3,
			})),
		{ ssr: false },
	),
	"jira-work-item-demo-experimental-v4": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoExperimentalV4,
			})),
		{ ssr: false },
	),
	"jira-work-item-demo-experimental-v5": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoExperimentalV5,
			})),
		{ ssr: false },
	),
	"jira-work-item-demo-team-eu26": dynamic(
		() =>
			import("../demos/blocks/jira-work-item-demo").then((mod) => ({
				default: mod.JiraWorkItemDemoTeamEu26,
			})),
		{ ssr: false },
	),
	"task-progress": dynamic(
		() => import("../demos/blocks/task-progress-demo"),
		{ ssr: false },
	),
	triggers: dynamic(() => import("../demos/blocks/triggers-demo"), {
		ssr: false,
	}),
	"answer-card": dynamic(() => import("../demos/blocks/answer-card-demo"), {
		ssr: false,
	}),
	spotlight: dynamic(() => import("../demos/blocks/spotlight-demo"), {
		ssr: false,
	}),
	"chat-timeline": dynamic(() => import("../demos/blocks/chat-timeline-demo"), {
		ssr: false,
	}),
	"chat-configuration": dynamic(
		() => import("../demos/blocks/chat-configuration-demo"),
		{ ssr: false },
	),
	subagents: dynamic(() => import("../demos/blocks/subagents-demo"), {
		ssr: false,
	}),
	"app-sidebar": dynamic(() => import("../demos/blocks/app-sidebar-demo"), {
		ssr: false,
	}),
	"mermaid-diagram": dynamic(() => import("../demos/blocks/mermaid-diagram-demo"), {
		ssr: false,
	}),
	video: dynamic(() => import("../demos/blocks/video-demo"), {
		ssr: false,
	}),
	"next-best-action": dynamic(() => import("../demos/blocks/next-best-action-demo"), {
		ssr: false,
	}),
	dashboard: dynamic(() => import("../demos/blocks/dashboard-demo"), {
		ssr: false,
	}),
	"sidebar-01": dynamic(() => import("../demos/blocks/sidebar-01-demo"), {
		ssr: false,
	}),
	"sidebar-02": dynamic(() => import("../demos/blocks/sidebar-02-demo"), {
		ssr: false,
	}),
	"sidebar-03": dynamic(() => import("../demos/blocks/sidebar-03-demo"), {
		ssr: false,
	}),
	"sidebar-04": dynamic(() => import("../demos/blocks/sidebar-04-demo"), {
		ssr: false,
	}),
	"sidebar-05": dynamic(() => import("../demos/blocks/sidebar-05-demo"), {
		ssr: false,
	}),
	"sidebar-06": dynamic(() => import("../demos/blocks/sidebar-06-demo"), {
		ssr: false,
	}),
	"sidebar-07": dynamic(() => import("../demos/blocks/sidebar-07-demo"), {
		ssr: false,
	}),
	"sidebar-08": dynamic(() => import("../demos/blocks/sidebar-08-demo"), {
		ssr: false,
	}),
	"sidebar-09": dynamic(() => import("../demos/blocks/sidebar-09-demo"), {
		ssr: false,
	}),
	"sidebar-10": dynamic(() => import("../demos/blocks/sidebar-10-demo"), {
		ssr: false,
	}),
	"sidebar-11": dynamic(() => import("../demos/blocks/sidebar-11-demo"), {
		ssr: false,
	}),
	"sidebar-12": dynamic(() => import("../demos/blocks/sidebar-12-demo"), {
		ssr: false,
	}),
	"sidebar-13": dynamic(() => import("../demos/blocks/sidebar-13-demo"), {
		ssr: false,
	}),
	"sidebar-14": dynamic(() => import("../demos/blocks/sidebar-14-demo"), {
		ssr: false,
	}),
	"sidebar-15": dynamic(() => import("../demos/blocks/sidebar-15-demo"), {
		ssr: false,
	}),
	"sidebar-16": dynamic(() => import("../demos/blocks/sidebar-16-demo"), {
		ssr: false,
	}),
	"login-01": dynamic(() => import("../demos/blocks/login-01-demo"), {
		ssr: false,
	}),
	"login-02": dynamic(() => import("../demos/blocks/login-02-demo"), {
		ssr: false,
	}),
	"login-03": dynamic(() => import("../demos/blocks/login-03-demo"), {
		ssr: false,
	}),
	"login-04": dynamic(() => import("../demos/blocks/login-04-demo"), {
		ssr: false,
	}),
	"login-05": dynamic(() => import("../demos/blocks/login-05-demo"), {
		ssr: false,
	}),
	chatgpt: dynamic(() => import("../demos/blocks/chatgpt-demo"), { ssr: false }),
	"code-review": dynamic(() => import("../demos/blocks/code-review-demo"), {
		ssr: false,
	}),
	"chat-gallery": dynamic(
		() => import("../demos/blocks/chat-gallery-demo"),
		{ ssr: false },
	),
	"data-table": dynamic(() => import("../demos/blocks/data-table-demo"), {
		ssr: false,
	}),
	"top-navigation": dynamic(
		() => import("../demos/blocks/top-navigation-demo"),
		{ ssr: false },
	),
	"prompt-gallery": dynamic(
		() => import("../demos/blocks/prompt-gallery-demo"),
		{ ssr: false },
	),
	"rovo-canvas": dynamic(
		() => import("../demos/blocks/rovo-canvas-direct-demo"),
		{ ssr: false },
	),
	memory: dynamic(() => import("../demos/blocks/memory-demo"), { ssr: false }),
	"settings-dialog": dynamic(
		() => import("../demos/blocks/settings-dialog-demo"),
		{ ssr: false },
	),
	"product-sidebar": dynamic(
		() => import("../demos/blocks/product-sidebar-demo"),
		{ ssr: false },
	),
	"sidebar-rail": dynamic(() => import("../demos/blocks/sidebar-rail-demo"), {
		ssr: false,
	}),
	"signup-01": dynamic(() => import("../demos/blocks/signup-01-demo"), {
		ssr: false,
	}),
	"signup-02": dynamic(() => import("../demos/blocks/signup-02-demo"), {
		ssr: false,
	}),
	"signup-03": dynamic(() => import("../demos/blocks/signup-03-demo"), {
		ssr: false,
	}),
	"signup-04": dynamic(() => import("../demos/blocks/signup-04-demo"), {
		ssr: false,
	}),
	"signup-05": dynamic(() => import("../demos/blocks/signup-05-demo"), {
		ssr: false,
	}),
	"question-card": dynamic(() => import("../demos/blocks/question-card-demo"), {
		ssr: false,
	}),
	"approval-card": dynamic(() => import("../demos/blocks/approval-card-demo"), {
		ssr: false,
	}),
	"tool-approval": dynamic(() => import("../demos/blocks/tool-approval-demo"), {
		ssr: false,
	}),
	"terminal-switch": dynamic(
		() => import("../demos/blocks/terminal-switch-demo"),
		{ ssr: false },
	),
	chatbot: dynamic(() => import("../demos/blocks/chatbot-demo"), { ssr: false }),
	cursor: dynamic(() => import("../demos/blocks/cursor-demo"), { ssr: false }),
	"generative-card": dynamic(
		() => import("../demos/blocks/generative-card-demo"),
		{ ssr: false },
	),
	generative: dynamic(() => import("../demos/blocks/generative-demo"), {
		ssr: false,
	}),
	gallery: dynamic(() => import("../demos/blocks/gallery-demo"), {
		ssr: false,
	}),
	"html-selector": dynamic(() => import("../demos/blocks/html-selector-demo"), {
		ssr: false,
	}),
	"jira-epic": dynamic(() => import("../demos/blocks/jira-epic-demo"), {
		ssr: false,
	}),
	"agent-list": dynamic(
		() => import("../demos/blocks/agent-list-demo"),
		{ ssr: false },
	),
	"agent-session": dynamic(
		() => import("../demos/blocks/agent-session-demo"),
		{ ssr: false },
	),
	"agent-session-column": dynamic(
		() => import("../demos/blocks/agent-session-column-demo"),
		{ ssr: false },
	),
	"jira-activity": dynamic(() => import("../demos/blocks/jira-activity-demo"), {
		ssr: false,
	}),
	"jira-insights": dynamic(() => import("../demos/blocks/jira-insights-demo"), {
		ssr: false,
	}),
	"jira-issue": dynamic(() => import("../demos/blocks/jira-issue-demo"), {
		ssr: false,
	}),
	"jira-linking": dynamic(() => import("../demos/blocks/jira-linking-demo"), {
		ssr: false,
	}),
	"jira-list": dynamic(() => import("../demos/blocks/jira-list-demo"), {
		ssr: false,
	}),
	"jira-kanban": dynamic(() => import("../demos/blocks/jira-kanban-demo"), {
		ssr: false,
	}),
	"jira-creating": dynamic(() => import("../demos/blocks/jira-creating-demo"), {
		ssr: false,
	}),
	"jira-dropzone": dynamic(() => import("../demos/blocks/jira-dropzone-demo"), {
		ssr: false,
	}),
	"jira-toolbar": dynamic(() => import("../demos/blocks/jira-toolbar-demo"), {
		ssr: false,
	}),
	"visual-waveform": dynamic(
		() => import("../demos/blocks/visual-waveform-demo"),
		{ ssr: false },
	),
	workflow: dynamic(() => import("../demos/blocks/workflow-demo"), {
		ssr: false,
	}),
	"editor-palette": dynamic(() => import("../demos/blocks/editor-palette-demo"), {
		ssr: false,
	}),
	"editor-toolbar": dynamic(() => import("../demos/blocks/editor-toolbar-demo"), {
		ssr: false,
	}),
};

export const BLOCK_VARIANT_DEMOS: Record<string, ComponentType> = {
	...BLOCK_VARIANT_DEMO_ENTRIES,
	"jira-linking-fuse": dynamic(
		() => import("../demos/blocks/jira-linking-demo").then((mod) => ({ default: mod.JiraLinkingFuseExample })),
		{ ssr: false },
	),
	"jira-linking-glow": dynamic(
		() => import("../demos/blocks/jira-linking-demo").then((mod) => ({ default: mod.JiraLinkingGlowExample })),
		{ ssr: false },
	),
};
