"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { JiraIssueParticipant } from "./index";

export function ProjectButterAssignee({
	issueKey,
	assignee,
	options,
	onAssign,
}: Readonly<{
	issueKey: string;
	assignee?: JiraIssueParticipant;
	options: readonly JiraIssueParticipant[];
	onAssign?: (person: JiraIssueParticipant) => void;
}>) {
	const [open, setOpen] = useState(false);
	if (assignee)
		return (
			<Avatar label={assignee.name} size="sm">
				<AvatarImage src={assignee.avatarSrc} alt="" />
				<AvatarFallback>{assignee.name.slice(0, 1)}</AvatarFallback>
			</Avatar>
		);
	if (!onAssign || options.length === 0) return <AvatarUnassigned kind="person" size="sm" />;
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						aria-label={`Assign ${issueKey}`}
						size="icon-compact"
						variant="ghost"
						onClick={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
					/>
				}
			>
				<AvatarUnassigned kind="person" size="sm" />
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="right"
				className="w-[240px]"
				onClick={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
			>
				<PopoverTitle className="px-1.5 text-xs font-normal text-text-subtlest">Team</PopoverTitle>
				{options.map((person) => (
					<button
						type="button"
						aria-label={person.name}
						key={person.id}
						className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-3 focus-visible:ring-ring/50"
						onClick={() => {
							onAssign(person);
							setOpen(false);
						}}
					>
						<Avatar label={person.name} size="sm">
							<AvatarImage src={person.avatarSrc} alt="" />
							<AvatarFallback>{person.name.slice(0, 1)}</AvatarFallback>
						</Avatar>
						{person.name}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
