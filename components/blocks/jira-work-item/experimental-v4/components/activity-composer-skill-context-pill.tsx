"use client";

import SkillIcon from "@atlaskit/icon-lab/core/skill";
import { useState } from "react";

import type { SkillDirectorySkill } from "@/app/data/directory";
import { SkillSelector } from "@/components/blocks/skill-selector";
import {
	DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
	WORK_ITEM_SKILLS,
} from "@/components/blocks/jira-work-item/experimental-v4/lib/work-item-picker-options";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { ContextBarPill } from "@/components/ui-custom/context-bar";

interface ActivityComposerSkillContextPillProps {
	onInvokeSkill: (skill: SkillDirectorySkill) => void;
}

/** Opens the directory-backed Skill Selector and immediately invokes the chosen skill. */
export function ActivityComposerSkillContextPill({
	onInvokeSkill,
}: Readonly<ActivityComposerSkillContextPillProps>) {
	const [isOpen, setIsOpen] = useState(false);
	const [pinnedSkillIds, setPinnedSkillIds] = useState<readonly string[]>(DEFAULT_PINNED_WORK_ITEM_SKILL_IDS);
	const [query, setQuery] = useState("");

	const handleOpenChange = (nextOpen: boolean) => {
		setIsOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	};

	const handleSkillToggle = (skillId: string) => {
		const skill = WORK_ITEM_SKILLS.find((candidate) => candidate.id === skillId);
		if (!skill) {
			return;
		}
		onInvokeSkill(skill);
		setIsOpen(false);
		setQuery("");
	};

	const handleFooterAction = () => {
		setIsOpen(false);
		setQuery("");
	};

	return (
		<DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
			<DropdownMenuTrigger
				render={
					<ContextBarPill
						className="motion-reduce:transition-none"
						icon={<Icon aria-hidden render={<SkillIcon label="" size="small" />} />}
					/>
				}
			>
				Use skills
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="max-h-none w-[360px] overflow-hidden p-0"
				positionerClassName="z-[502]"
				sideOffset={8}
			>
				<SkillSelector
					onBrowseSkills={handleFooterAction}
					onCreateSkill={handleFooterAction}
					onPinnedSkillIdsChange={setPinnedSkillIds}
					onQueryChange={setQuery}
					onSkillToggle={handleSkillToggle}
					pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
					pinnedSkillIds={pinnedSkillIds}
					query={query}
					searchVariant="palette"
					selectionMode="single"
					skills={WORK_ITEM_SKILLS}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
