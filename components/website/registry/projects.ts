import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const PROJECT_DEMOS: Record<string, ComponentType> = {
	admin: dynamic(() => import("../demos/projects/admin-demo"), { ssr: false }),
	confluence: dynamic(() => import("../demos/projects/confluence-demo"), {
		ssr: false,
	}),
	html: dynamic(() => import("../demos/projects/html-demo"), { ssr: false }),
	jira: dynamic(() => import("../demos/projects/jira-demo"), { ssr: false }),
	"jira-for-you": dynamic(() => import("../demos/projects/jira-for-you-demo"), {
		ssr: false,
	}),
	"jira-golden-journeys-v0": dynamic(
		() => import("../demos/projects/jira-golden-journeys-v0-demo"),
		{ ssr: false },
	),
	"jira-golden-journeys-v1": dynamic(
		() => import("../demos/projects/jira-golden-journeys-v1-demo"),
		{ ssr: false },
	),
	"jira-golden-journeys-v2": dynamic(
		() => import("../demos/projects/jira-golden-journeys-v2-demo"),
		{ ssr: false },
	),
	"jira-golden-journeys-v3": dynamic(
		() => import("../demos/projects/jira-golden-journeys-v3-demo"),
		{ ssr: false },
	),
	"jira-golden-journeys-v4": dynamic(
		() => import("../demos/projects/jira-golden-journeys-v4-demo"),
		{ ssr: false },
	),
	"jira-queue": dynamic(() => import("../demos/projects/jira-queue-demo"), {
		ssr: false,
	}),
	"jira-team-eu26": dynamic(
		() => import("../demos/projects/jira-team-eu26-demo"),
		{ ssr: false },
	),
	"jira-team-eu26-end": dynamic(
		() => import("../demos/projects/jira-team-eu26-end-demo"),
		{ ssr: false },
	),
	rovo: dynamic(() => import("../demos/projects/rovo-demo"), {
		ssr: false,
	}),
	"rovo-button": dynamic(() => import("../demos/projects/rovo-button-demo"), {
		ssr: false,
	}),
	search: dynamic(() => import("../demos/projects/search-demo"), { ssr: false }),
	"sidebar-chat": dynamic(() => import("../demos/projects/sidebar-chat-demo"), {
		ssr: false,
	}),
	skills: dynamic(() => import("../demos/projects/skills-demo"), {
		ssr: false,
	}),
	studio: dynamic(() => import("../demos/projects/studio-demo"), {
		ssr: false,
	}),
};
