"use client";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tag, TagGroup } from "@/components/ui/tag";
import { useWorkItemModal, type WorkItemLabelTag } from "@/app/contexts/context-work-item-modal";
import { DetailRow } from "./detail-row";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";

function getFallback(name: string): string {
	const initials = name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return initials || "U";
}

export function DetailsAccordion() {
	const { state, actions, meta } = useWorkItemModal();
	const { workItem } = meta;
	const assignee = workItem.assignee ?? {
		name: "Unassigned",
	};
	const reporter = workItem.reporter ?? {
		name: "Jordan Lee",
		avatarUrl: "/avatar-user/andrew-park/color/asow-dev-lime.png",
	};
	const priority = workItem.priority ?? "Medium";
	const PriorityIcon = priority === "High" || priority === "Highest"
		? PriorityHighIcon
		: PriorityMediumIcon;
	const priorityColor = priority === "High" || priority === "Highest"
		? token("color.icon.danger")
		: token("color.icon.information");
	const labelTags: WorkItemLabelTag[] = workItem.labelTags?.length
		? workItem.labelTags
		: workItem.labels?.map((label) => ({ text: label })) ?? [];
	const detailsSummary = "Assignee, Reporter, Priority, Start date, Due date, Parent, Labels";

	return (
		<div className="min-w-0 overflow-hidden" style={{ border: `1px solid ${token("color.border")}`, borderRadius: token("radius.medium") }}>
			<div className="p-2">
				<div className="flex min-w-0 items-center gap-1">
					<Button
						aria-label={state.isDetailsOpen ? "Collapse" : "Expand"}
						aria-expanded={state.isDetailsOpen}
						size="icon-compact"
						variant="ghost"
						className="aria-expanded:!border-transparent aria-expanded:!bg-transparent aria-expanded:!text-text-subtle"
						onClick={actions.toggleDetails}
					>
						{state.isDetailsOpen ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />}
					</Button>
					<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
						<Heading size="small" className="shrink-0 whitespace-nowrap">Details</Heading>
						{state.isDetailsOpen ? null : (
							<span className="block min-w-0 flex-1 truncate text-xs text-text-subtlest" title={detailsSummary}>{detailsSummary}</span>
						)}
					</div>
				</div>
			</div>

			{state.isDetailsOpen ? <div>
					<div className="py-2 px-3">
						<DetailRow label="Assignee">
							<div className="flex items-center gap-2">
								<Avatar size="sm">
									{assignee.avatarUrl ? <AvatarImage src={assignee.avatarUrl} alt={assignee.name} /> : null}
									<AvatarFallback>{getFallback(assignee.name)}</AvatarFallback>
								</Avatar>
								<span className="text-sm font-medium">{assignee.name}</span>
							</div>
							<div className="pt-0.5 ps-2">
								<a href="#">Assign to me</a>
							</div>
						</DetailRow>

						<DetailRow label="Reporter">
							<div className="flex items-center gap-2">
								<Avatar size="sm">
									{reporter.avatarUrl ? <AvatarImage src={reporter.avatarUrl} alt={reporter.name} /> : null}
									<AvatarFallback>{getFallback(reporter.name)}</AvatarFallback>
								</Avatar>
								<span className="text-sm font-medium">{reporter.name}</span>
							</div>
						</DetailRow>

						<DetailRow label="Priority">
							<div className="flex items-center gap-2">
								<PriorityIcon label={`${priority} priority`} color={priorityColor} />
								<span className="text-sm font-medium">{priority}</span>
							</div>
						</DetailRow>

						<DetailRow label="Start date">
							<span className="text-sm">{workItem.startDate ?? "May 12, 2026"}</span>
						</DetailRow>

						{workItem.dueDate ? (
							<DetailRow label="Due date">
								<span className="text-sm">{workItem.dueDate}</span>
							</DetailRow>
						) : null}

						<DetailRow label="Parent">
							<a href="#">{workItem.parent?.code ?? "RFP-100"}</a>
						</DetailRow>

						<DetailRow label="Labels" noPadding>
							<TagGroup className="gap-1">
								{labelTags.map((label) => (
									<Tag key={label.text} color={label.color}>
										{label.text}
									</Tag>
								))}
							</TagGroup>
						</DetailRow>
					</div>
				</div> : null}
		</div>
	);
}
