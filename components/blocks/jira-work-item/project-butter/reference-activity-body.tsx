"use client";

import { useMemo, type ComponentProps } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { MessageResponse, streamdownComponents } from "@/components/ui-custom/message";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SmartLink } from "@/components/blocks/smart-link/components/smart-link";
import { toPullRequestSmartLink, type PullRequestSmartLinkStatus } from "@/components/blocks/smart-link/lib/pull-request-smart-link";
import { mentionSegmentForActor } from "@/components/blocks/jira-activity/jira-activity-actor-mention";
import { JiraActivitySegments } from "@/components/blocks/jira-activity/jira-activity-segments";
import type { JiraActivityActor } from "@/components/blocks/jira-activity";
import type { ProjectButterReferenceChange } from "@/components/blocks/jira-work-item/project-butter/reference-model";
import { PROJECT_BUTTER_JOURNEY_PULL_REQUEST } from "@/components/blocks/jira-work-item/project-butter/development-journey-model";
import { mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";

type MarkdownNode = { type: string; value?: string; url?: string; children?: MarkdownNode[] };
const AGENT_MENTION = /@\[(subagent:[A-Za-z0-9_./:-]+)\]/gu;
const MENTION_LINK = "#butter-agent-mention:";

function mentionMarkdown(agents: readonly AgentBrowserAgent[]) {
	const byId = new Map(agents.map((agent) => [mapAgentToMentionItem(agent).id, agent]));
	return () => (tree: MarkdownNode) => {
		function visit(node: MarkdownNode) {
			if (!node.children || node.type === "link") return;
			node.children = node.children.flatMap((child) => {
				if (child.type !== "text" || !child.value) { visit(child); return [child]; }
				const parts: MarkdownNode[] = [];
				let start = 0;
				for (const match of child.value.matchAll(AGENT_MENTION)) {
					const agent = byId.get(match[1]);
					if (!agent) continue;
					if (match.index > start) parts.push({ type: "text", value: child.value.slice(start, match.index) });
					parts.push({ type: "link", url: `${MENTION_LINK}${encodeURIComponent(match[1])}`, children: [{ type: "text", value: agent.name }] });
					start = match.index + match[0].length;
				}
				if (!parts.length) return [child];
				if (start < child.value.length) parts.push({ type: "text", value: child.value.slice(start) });
				return parts;
			});
		}
		visit(tree);
	};
}

export function ProjectButterHistoryChange({ actor, item, timestamp, defaultOpen = false }: Readonly<{ actor: JiraActivityActor; item: ProjectButterReferenceChange; timestamp: string; defaultOpen?: boolean }>) {
	return (
		<Collapsible className="min-w-0" defaultOpen={defaultOpen}>
			<CollapsibleTrigger className="group flex min-h-6 w-full min-w-0 items-center gap-1 rounded-sm text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"><JiraActivitySegments className="inline-flex shrink-0 items-center [&_[data-tag-text]]:[text-box:trim-both_cap_alphabetic]" segments={[mentionSegmentForActor(actor)]} /><span className="min-w-0 [text-box:trim-both_cap_alphabetic]">{item.action}</span><span className="ml-2 shrink-0 text-xs text-text-subtlest [text-box:trim-both_cap_alphabetic]">{timestamp}</span><ChevronRightIcon label="" size="small" /></CollapsibleTrigger>
			<CollapsibleContent>
				<div className="pt-2"><dl className="space-y-3 rounded-lg bg-surface-sunken p-3 text-sm text-text">{item.changes.map((change, index) => <div className="space-y-1" key={`${change.label}-${index}`}><dt className="font-medium text-text-subtle">{change.label}</dt><dd className="whitespace-pre-wrap">{change.before ? <span className="mr-2 line-through">{change.before}</span> : null}{change.after ? <span>{change.after}</span> : <span>Removed</span>}</dd></div>)}</dl></div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function ProjectButterReferenceCommentBody({ markdown, pullRequestStatus, agents = [] }: Readonly<{ markdown: string; pullRequestStatus?: PullRequestSmartLinkStatus; agents?: readonly AgentBrowserAgent[] }>) {
	const remarkPlugins = useMemo(() => [mentionMarkdown(agents)], [agents]);
	const components = useMemo(() => {
		const request = PROJECT_BUTTER_JOURNEY_PULL_REQUEST;
		const item = pullRequestStatus ? toPullRequestSmartLink({ id: "butter-pr-284", number: request.number, title: request.title, status: pullRequestStatus, additions: request.additions, deletions: request.deletions, files: request.filesChanged, branch: request.branch, targetBranch: request.targetBranch, repository: "payments-platform/payments", href: "#pull-request-284", author: { name: "Venn", src: "/avatar-user/venn/venn.png" } }) : undefined;
		const byId = new Map(agents.map((agent) => [encodeURIComponent(mapAgentToMentionItem(agent).id), agent]));
		const DefaultAnchor = streamdownComponents.a;
		return { ...streamdownComponents, a: ({ href, ...props }: ComponentProps<"a"> & { node?: unknown }) => {
			const agent = href?.startsWith(MENTION_LINK) ? byId.get(href.slice(MENTION_LINK.length)) : undefined;
			if (agent) return <JiraActivitySegments segments={[mentionSegmentForActor({ id: agent.id, name: agent.name, kind: "agent", avatarSrc: agent.avatarSrc, brandName: agent.brandName })]} />;
			return href === "#pull-request-284" && item ? <SmartLink className="text-[length:inherit] leading-[inherit] [&_[data-smart-link-text]]:[text-box:trim-both_cap_alphabetic]" item={item} positionerClassName="z-[700]" showStatus /> : <DefaultAnchor href={href} {...props} />;
		} };
	}, [agents, pullRequestStatus]);
	const body = pullRequestStatus ? markdown.replace(/\bPR #284\b/gu, "[PR #284](#pull-request-284)") : markdown;
	return <MessageResponse components={components} remarkPlugins={remarkPlugins}>{body}</MessageResponse>;
}
