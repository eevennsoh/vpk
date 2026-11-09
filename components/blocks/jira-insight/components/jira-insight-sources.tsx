"use client";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import type { JiraInsightSource } from "@/components/blocks/jira-insight/jira-insight-types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LogoThirdParty } from "@/components/ui/logo-third-party";

function SourceIcon({ source }: Readonly<{ source: JiraInsightSource }>) {
	if (source.brandName) {
		return <LogoThirdParty borderless label="" name={source.brandName} size="xxsmall" />;
	}
	const Glyph = source.kind === "work-item-section"
		? AlignTextLeftIcon
		: source.kind === "activity-entry"
			? ListBulletedIcon
			: source.kind === "agent-session"
				? AiAgentIcon
				: source.kind === "pull-request"
					? PullRequestIcon
					: LinkExternalIcon;
	return <Icon aria-hidden render={<Glyph label="" size="small" />} />;
}

export function JiraInsightSources({
	onSourceSelect,
	sources,
}: Readonly<{
	onSourceSelect?: (source: JiraInsightSource) => void;
	sources: readonly JiraInsightSource[];
}>) {
	if (sources.length === 0) return null;

	return (
		<div aria-label="Sources" className="flex flex-wrap gap-2" role="group">
			{sources.map((source) => source.kind === "external-link" ? (
				<Button
					key={source.id}
					nativeButton={false}
					render={<a aria-label={source.label} href={source.href} rel="noreferrer" target="_blank" />}
					size="compact"
					variant="outline"
				>
					<SourceIcon source={source} />
					{source.label}
				</Button>
			) : (
				<Button
					disabled={!onSourceSelect}
					key={source.id}
					onClick={() => onSourceSelect?.(source)}
					size="compact"
					variant="outline"
				>
					<SourceIcon source={source} />
					{source.label}
				</Button>
			))}
		</div>
	);
}
