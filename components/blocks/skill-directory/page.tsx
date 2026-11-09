"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	SkillDirectoryDialog,
	type SkillDirectorySelectionExperience,
	type SkillDirectorySkill,
	type SkillDirectoryVariant,
} from "@/components/blocks/skill-directory";

const DEMO_SESSION_SKILLS: readonly SkillDirectorySkill[] = [
	{
		id: "audit-accessibility",
		name: "Audit accessibility",
		description: "Review interface structure, keyboard paths, and assistive technology labels before a release.",
		icon: "search",
		collectionId: "software",
		collectionDescription: "Ship high-quality software faster with developer agents, source control, CI/CD, and delivery insights.",
		collectionProducts: ["Rovo Dev", "DX", "Pipelines", "Bitbucket"],
		collectionDocsUrl: "https://www.atlassian.com/collections/software",
		publisherName: "Atlassian",
		companyId: "atlassian",
		categoryId: "software-development",
		starCount: 18,
		teammateCount: 632,
		verified: true,
		tools: [{ id: "axe", name: "Axe", icon: "search" }],
		instructions: "Inspect labels, focus order, contrast, landmarks, and keyboard-only completion paths.",
	},
	{
		id: "demo-draft-release-notes",
		name: "Draft release notes",
		description: "Turn a list of merged changes into customer-ready release notes.",
		icon: "edit",
		collectionId: "teamwork",
		collectionDescription: "Supercharge teamwork across planning, documentation, async updates, and AI-assisted collaboration.",
		collectionProducts: ["Jira", "Confluence", "Loom", "Rovo"],
		collectionDocsUrl: "https://www.atlassian.com/collections/teamwork",
		publisherName: "Atlassian",
		companyId: "atlassian",
		categoryId: "content-and-communication",
		starCount: 12,
		teammateCount: 410,
		verified: true,
		tools: [{ id: "changelog", name: "Changelog", icon: "page" }],
		instructions: "Group shipped changes by customer outcome and write concise release-ready copy.",
	},
];

const DEMO_ADDED_USER_SKILL_IDS: readonly string[] = [
	"create-brand-identity",
	"design-landing-page",
	"develop-mobile-app-interface",
];

const DEMO_ADDED_CATALOG_SKILL_IDS: readonly string[] = [
	"access-review",
	"analyze-root-cause",
	"build-report",
	"review-pull-request",
];

const DEMO_ADDED_SKILL_IDS: readonly string[] = [
	...DEMO_ADDED_USER_SKILL_IDS,
	...DEMO_ADDED_CATALOG_SKILL_IDS,
];

export default function SkillDirectoryPage() {
	const [open, setOpen] = useState(false);
	const [selectionExperience, setSelectionExperience] = useState<SkillDirectorySelectionExperience>("studio-bulk-add");
	const [addedSkillIds, setAddedSkillIds] = useState<readonly string[]>(DEMO_ADDED_SKILL_IDS);

	function openDirectory(nextExperience: SkillDirectorySelectionExperience) {
		setSelectionExperience(nextExperience);
		setOpen(true);
	}

	function handleAddSkills(skillIds: readonly string[]) {
		if (selectionExperience === "chat-single-add") {
			return;
		}
		setAddedSkillIds((current) => [...new Set([...current, ...skillIds])]);
	}

	function handleRemoveSkills(skillIds: readonly string[]) {
		if (selectionExperience === "chat-single-add") {
			return;
		}
		const removedIds = new Set(skillIds);
		setAddedSkillIds((current) => current.filter((id) => !removedIds.has(id)));
	}

	return (
		<div className="flex h-full min-h-screen items-center justify-center gap-3 p-4">
			<Button onClick={() => openDirectory("chat-single-add")} variant="outline">
				Open Chat directory
			</Button>
			<Button onClick={() => openDirectory("studio-bulk-add")}>
				Open Studio directory
			</Button>
			<SkillDirectoryDialog
				addedSkillIds={selectionExperience === "chat-single-add" ? [] : addedSkillIds}
				onAddSkills={handleAddSkills}
				onRemoveSkills={handleRemoveSkills}
				open={open}
				onOpenChange={setOpen}
				selectionExperience={selectionExperience}
				sessionSkills={DEMO_SESSION_SKILLS}
				variant="experimental"
			/>
		</div>
	);
}

export function SkillDirectoryExperimentalPage() {
	const [open, setOpen] = useState(false);

	return (
		<SkillDirectoryPageShell open={open} onOpenChange={setOpen} variant="experimental" />
	);
}

function SkillDirectoryPageShell({
	open,
	onOpenChange,
	variant,
	selectionExperience = "studio-bulk-add",
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectionExperience?: SkillDirectorySelectionExperience;
	variant?: SkillDirectoryVariant;
}>) {
	const [addedSkillIds, setAddedSkillIds] = useState<readonly string[]>(DEMO_ADDED_SKILL_IDS);

	function handleAddSkills(skillIds: readonly string[]) {
		if (selectionExperience === "chat-single-add") {
			return;
		}
		setAddedSkillIds((current) => [...new Set([...current, ...skillIds])]);
	}

	function handleRemoveSkills(skillIds: readonly string[]) {
		if (selectionExperience === "chat-single-add") {
			return;
		}
		const removedIds = new Set(skillIds);
		setAddedSkillIds((current) => current.filter((id) => !removedIds.has(id)));
	}

	return (
		<div className="flex h-full min-h-screen items-center justify-center p-4">
			<Button onClick={() => onOpenChange(true)}>
				{variant === "experimental" ? "Open experimental directory" : "Open standard directory"}
			</Button>
			<SkillDirectoryDialog
				addedSkillIds={selectionExperience === "chat-single-add" ? [] : addedSkillIds}
				onAddSkills={handleAddSkills}
				open={open}
				onOpenChange={onOpenChange}
				onRemoveSkills={handleRemoveSkills}
				selectionExperience={selectionExperience}
				sessionSkills={DEMO_SESSION_SKILLS}
				variant={variant}
			/>
		</div>
	);
}
