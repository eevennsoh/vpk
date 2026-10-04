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
		description: "The original agent-session pattern gallery: each card (Terminal, Rovo, Queue, For you, Kanban, List, Work item) opens that pattern's design in the stage.",
		importStatement: `import JiraGoldenJourneysV0Page from "@/components/projects/jira-golden-journeys-v0";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v1": {
		description: "Two presenter-paced session walkthroughs, stepped screen by screen: Carl's local Claude Code session on JGP-247 and Sarah's global session delegating five Jira tasks to Cursor.",
		importStatement: `import JiraGoldenJourneysV1Page from "@/components/projects/jira-golden-journeys-v1";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v2": {
		description: "A guest-checkout work item moved through seven delivery chapters, Intake to Release, with a Details/Activity rail and a guided PR #1847 review.",
		importStatement: `import JiraGoldenJourneysV2Page from "@/components/projects/jira-golden-journeys-v2";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v3": {
		description: "Four delivery chapters, Track, Learn, Build and Terminal: a Payments SDK board, the PAY-101 work item with scroll-linked sections and PR #1839, and a terminal session.",
		importStatement: `import JiraGoldenJourneysV3Page from "@/components/projects/jira-golden-journeys-v3";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-golden-journeys-v4": {
		description: "The Payments SDK v2 migration board in full Jira chrome, with Board/List views and an Unlink sessions column, without a story gallery.",
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
		description: "The Team ’26 EU Payments SDK v2 migration board in Jira chrome, with Board/List views, session filters, an Unlink sessions column and drag-to-link agent sessions.",
		importStatement: `import JiraTeamEu26Page from "@/components/projects/jira-team-eu26";`,
		demoLayout: {
			previewHeight: "fixed",
			previewContentWidth: "full",
		},
	},
	"jira-team-eu26-end": {
		description: "The Team ’26 EU keynote closing board: thirteen announcement cards in Context, Collaboration and Confidence columns; moving them all into Done plays the recap finale.",
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
