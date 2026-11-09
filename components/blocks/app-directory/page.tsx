"use client";

import { useState } from "react";

import {
	AppDirectoryDialog,
	type AppDirectoryTool,
	type AppDirectoryVariant,
} from "@/components/blocks/app-directory";
import { DIRECTORY_APPS } from "@/app/data/directory/apps";
import { Button } from "@/components/ui/button";

// Personal, self-built productivity apps a maker would wire into their Studio
// agent — deliberately NOT company integrations. They are session-scoped (kept
// out of the shared catalog) and seed the "My apps" sidebar entry. Avatars
// reuse the project-avatar art in public/avatar-project so each reads as a
// hand-made tool, not a brand.
const DEMO_PERSONAL_APPS: readonly AppDirectoryTool[] = [
	{
		id: "focus-flow",
		name: "Focus Flow",
		byline: "Focus timers & time-boxing by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/stopwatch.svg",
		description: "Runs focus sprints and guards deep-work blocks on your calendar.",
		categoryId: "project-management",
		lastUpdatedLabel: "Last updated 3d ago",
		promptSuggestion: "Start a 25-minute focus sprint",
		teammateCount: 1,
		toolCount: 4,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "standup-buddy",
		name: "Standup Buddy",
		byline: "Daily standup wrangling by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/service-bell.svg",
		description: "Collects yesterday/today/blockers and drafts your standup note.",
		categoryId: "project-management",
		lastUpdatedLabel: "Last updated 1w ago",
		promptSuggestion: "Draft my standup update for today",
		teammateCount: 3,
		toolCount: 3,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "quick-capture",
		name: "Quick Capture",
		byline: "Frictionless note capture by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/lightning.svg",
		description: "Drops stray thoughts, links, and snippets into a tidy inbox.",
		categoryId: "content-and-communication",
		lastUpdatedLabel: "Last updated 2d ago",
		promptSuggestion: "Capture this as a quick note",
		teammateCount: 1,
		toolCount: 2,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "sprint-pulse",
		name: "Sprint Pulse",
		byline: "Personal sprint tracking by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/graph.svg",
		description: "Summarises burndown and flags work likely to slip this sprint.",
		categoryId: "data-and-analytics",
		lastUpdatedLabel: "Last updated 5d ago",
		promptSuggestion: "How is my sprint tracking?",
		teammateCount: 2,
		toolCount: 5,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "meeting-notes",
		name: "Meeting Notes",
		byline: "Meeting recaps & actions by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/pencil.svg",
		description: "Turns rough meeting notes into summaries with assigned actions.",
		categoryId: "content-and-communication",
		lastUpdatedLabel: "Last updated 6d ago",
		promptSuggestion: "Summarise these meeting notes into action items",
		teammateCount: 4,
		toolCount: 3,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "task-inbox",
		name: "Task Inbox",
		byline: "Inbox-zero task triage by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/paper-airplane.svg",
		description: "Sorts incoming requests into a prioritised, do-it-next list.",
		categoryId: "project-management",
		lastUpdatedLabel: "Last updated 4d ago",
		promptSuggestion: "What should I work on next?",
		teammateCount: 1,
		toolCount: 4,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "habit-garden",
		name: "Habit Garden",
		byline: "Habit streaks & nudges by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/plant.svg",
		description: "Tracks daily habits and nudges you before a streak breaks.",
		categoryId: "hr-and-team-building",
		lastUpdatedLabel: "Last updated 1d ago",
		promptSuggestion: "Show my habit streaks for this week",
		teammateCount: 1,
		toolCount: 2,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
	{
		id: "brain-dump",
		name: "Brain Dump",
		byline: "Idea parking & sorting by You",
		attributionKind: "person",
		avatarSrc: "/avatar-project/light-bulb.svg",
		description: "Parks half-formed ideas and clusters them into themes later.",
		categoryId: "content-and-communication",
		lastUpdatedLabel: "Last updated 8d ago",
		promptSuggestion: "Cluster my parked ideas into themes",
		teammateCount: 1,
		toolCount: 3,
		hasToolFacet: true,
		hasKnowledgeFacet: false,
	},
];

const DEMO_ADDED_PERSONAL_APP_IDS: readonly string[] = [
	"focus-flow",
	"standup-buddy",
	"quick-capture",
];

const DEMO_ADDED_CATALOG_APP_IDS: readonly string[] = [
	"atlassian",
	"google-drive",
	"jira",
	"slack",
];

const DEMO_ADDED_APP_IDS: readonly string[] = [
	...DEMO_ADDED_PERSONAL_APP_IDS,
	...DEMO_ADDED_CATALOG_APP_IDS,
];

export default function AppDirectoryPage() {
	const [open, setOpen] = useState(false);
	const [variant, setVariant] = useState<AppDirectoryVariant>("default");

	function openDirectory(nextVariant: AppDirectoryVariant) {
		setVariant(nextVariant);
		setOpen(true);
	}

	return (
		<div className="flex h-full min-h-screen items-center justify-center gap-3 p-4">
			<Button onClick={() => openDirectory("default")} variant="outline">
				Open standard directory
			</Button>
			<Button onClick={() => openDirectory("experimental")}>
				Open experimental directory
			</Button>
			<AppDirectoryDialog
				defaultAddedToolIds={DEMO_ADDED_APP_IDS}
				open={open}
				onOpenChange={setOpen}
				tools={DIRECTORY_APPS}
				sessionTools={DEMO_PERSONAL_APPS}
				variant={variant}
			/>
		</div>
	);
}

export function AppDirectoryExperimentalPage() {
	const [open, setOpen] = useState(false);

	return (
		<AppDirectoryPageShell open={open} onOpenChange={setOpen} variant="experimental" />
	);
}

function AppDirectoryPageShell({
	open,
	onOpenChange,
	variant,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	variant?: AppDirectoryVariant;
}>) {
	return (
		<div className="flex h-full min-h-screen items-center justify-center p-4">
			<Button onClick={() => onOpenChange(true)}>
				{variant === "experimental" ? "Open experimental directory" : "Open standard directory"}
			</Button>
			<AppDirectoryDialog
				defaultAddedToolIds={DEMO_ADDED_APP_IDS}
				open={open}
				onOpenChange={onOpenChange}
				tools={DIRECTORY_APPS}
				sessionTools={DEMO_PERSONAL_APPS}
				variant={variant}
			/>
		</div>
	);
}
