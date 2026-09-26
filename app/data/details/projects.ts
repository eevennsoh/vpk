import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PROJECT_DETAILS: Record<string, ComponentDetail> = {
	"admin": {
		description: "An Atlassian Administration surface with organization settings, users, billing, audit logs, Rovo settings, and security controls.",
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"confluence": {
		description: "A document editing interface inspired by Confluence with rich text editing, bubble menus, and collaboration features.",
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"html": {
		description: "The vpk-html reference index embedded as a project surface, pointing at the checked-in `.agents/skills/vpk-html/index.html` catalog and demos.",
		importStatement: `import HtmlDemo from "@/components/website/demos/projects/html-demo";`,
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"jira": {
		description: "A Jira RFP response board with embedded agents, generated report workflows, and detailed work item modals.",
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"jira-for-you": {
		description: "A personalized Jira workspace that combines assigned and recent work, agent sessions, work-item conversation, source and output details, and full Jira product chrome.",
		importStatement: `import { JiraForYouWorkspace } from "@/components/projects/jira-for-you";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v0": {
		description: "Jira Golden Journeys v0 — a gallery of agent-session design patterns. Each dock card is a pattern; selecting one reveals its design in the stage (the Kanban card shows the Jira Kanban board). New patterns are added as cards over time.",
		importStatement: `import JiraGoldenJourneysV0Page from "@/components/projects/jira-golden-journeys-v0";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v1": {
		description: "Jira Golden Journeys v1 — a gallery of agent-session design patterns. Each dock card is a pattern; selecting one reveals its design in the stage (the Kanban card shows the Jira Kanban board). New patterns are added as cards over time.",
		importStatement: `import JiraGoldenJourneysV1Page from "@/components/projects/jira-golden-journeys-v1";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v2": {
		description: "A Jira Golden Journeys v2 gallery with a Work Item stage for the software delivery story.",
		importStatement: `import JiraGoldenJourneysV2Page from "@/components/projects/jira-golden-journeys-v2";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v3": {
		description: "A Jira Golden Journeys v3 gallery with a Work Item stage for the software delivery story.",
		importStatement: `import JiraGoldenJourneysV3Page from "@/components/projects/jira-golden-journeys-v3";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v4": {
		description: "A Jira Golden Journeys v4 gallery with a Work Item stage for the software delivery story.",
		importStatement: `import JiraGoldenJourneysV4Page from "@/components/projects/jira-golden-journeys-v4";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-queue": {
		description: "A Jira agent-session queue — a project sidebar of running, awaiting, and completed agent sessions beside a conversation workspace with a detail panel of sources and outputs.",
		importStatement: `import JiraQueuePage from "@/components/projects/jira-queue";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-team-eu26": {
		description: "A Jira Team EU26 gallery with a Work Item stage for the software delivery story.",
		importStatement: `import JiraTeamEu26Page from "@/components/projects/jira-team-eu26";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-team-eu26-end": {
		description: "A Team ’26 EU keynote board with thirteen story cards organized into Context, Collaboration, and Confidence columns, a Done destination, and a retained agent-session rail.",
		importStatement: `import JiraTeamEu26EndPage from "@/components/projects/jira-team-eu26-end";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"rovo": {
		description: "A Vercel-style AI chat workspace with persistent thread history, local attachments, artifact editing, and Rovo-backed streaming.",
		importStatement: `import Rovo from "@/components/projects/rovo";`,
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"rovo-button": {
		description: "A floating action button that summons the Rovo chat panel from any product surface. Demonstrates hover scale, theme-aware surface color, and auto-hide behavior on the Rovo route.",
		importStatement: `import FloatingRovoButton from "@/components/projects/shared/components/floating-rovo-button";`,
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"search": {
		description: "A search results page with AI-powered summary panel, source cards carousel, and filterable result cards.",
		demoLayout: {
			previewHeight: "fixed",
		},
	},
	"sidebar-chat": {
		description: "A sliding chat panel with message bubbles, greeting view, and integrated composer for conversational AI interfaces.",
	},
	"skills": {
		description: "A skills workspace built on the Sidebar Chat interface that shows how skills are invoked and triggered inline, with deterministic skill-invocation cards.",
		importStatement: `import SkillsPanel from "@/components/projects/skills/page";`,
	},
	"studio": {
		description: "A Studio project template forked from the Rovo chat workspace for future template design customization.",
		importStatement: `import Studio from "@/components/projects/studio";`,
		demoLayout: {
			previewHeight: "fixed",
		},
	},
};
