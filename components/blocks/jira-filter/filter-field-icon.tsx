import type { ReactNode } from "react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import EpicIcon from "@atlaskit/icon/core/epic";
import FieldIcon from "@atlaskit/icon/core/field";
import LinkBrokenIcon from "@atlaskit/icon/core/link-broken";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import ProjectIcon from "@atlaskit/icon/core/project";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import ReleaseIcon from "@atlaskit/icon/core/release";
import SprintIcon from "@atlaskit/icon/core/sprint";
import TagIcon from "@atlaskit/icon/core/tag";
import WorkItemIcon from "@atlaskit/icon/core/work-item";
import PersonAssigneeIcon from "@atlaskit/icon-lab/core/person-assignee";
import TerminalIcon from "@atlaskit/icon-lab/core/terminal";
import { IconTile } from "@/components/ui/icon-tile";

const fieldIcons: Readonly<Record<string, ReactNode>> = {
	agent: <AiAgentIcon label="" />,
	agentStatus: <AiAgentIcon label="" />,
	assignee: <PersonAssigneeIcon label="" />,
	boardColumn: <SprintIcon label="" />,
	days: <ReleaseIcon label="" />,
	dueDate: <ReleaseIcon label="" />,
	epic: <EpicIcon label="" />,
	fixVersion: <ReleaseIcon label="" />,
	label: <TagIcon label="" />,
	priority: <PriorityHighestIcon label="" />,
	project: <ProjectIcon label="" />,
	prStatus: <PullRequestIcon label="" />,
	sessionType: <TerminalIcon label="" />,
	sprint: <SprintIcon label="" />,
	status: <CheckCircleIcon label="" />,
	type: <WorkItemIcon label="" />,
	untracked: <LinkBrokenIcon label="" />,
};

export function getJiraFilterFieldIcon(fieldId: string): ReactNode {
	const icon = (Object.hasOwn(fieldIcons, fieldId) ? fieldIcons[fieldId] : undefined) ?? <FieldIcon label="" />;
	return jiraFilterMenuIcon(icon);
}

export function jiraFilterMenuIcon(icon: ReactNode): ReactNode {
	return <IconTile aria-hidden as="span" icon={icon} iconSize="small" label="" size="xxsmall" variant="transparent" />;
}
