import AutomationIcon from "@atlaskit/icon/core/automation";

import { Icon } from "@/components/ui/icon";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { cn } from "@/lib/utils";

import { mentionSegmentForActor } from "./jira-activity-actor-mention";
import { JiraActivitySegments } from "./jira-activity-segments";
import { JiraActivityTimestamp } from "./jira-activity-timestamp";
import type { JiraActivityEventEntry, JiraActivitySegment } from "./jira-activity-types";

const AUTOMATION_TAG_TEXT = "Automation";

type PullRequestStatus = NonNullable<JiraActivityEventEntry["pullRequest"]>["status"];

function pullRequestStatusLozengeVariant(
	status: PullRequestStatus,
): NonNullable<LozengeProps["variant"]> {
	switch (status) {
		case "Open":
			return "success";
		case "Merged":
			return "discovery";
		default: {
			const _exhaustive: never = status;
			throw new Error(`Unhandled pull request status: ${_exhaustive}`);
		}
	}
}

function isAutomationSegment(segment: JiraActivitySegment): boolean {
	return segment.type === "tag" && segment.text === AUTOMATION_TAG_TEXT;
}

function visibleEventSegments(
	segments: readonly JiraActivitySegment[],
): JiraActivitySegment[] {
	const visible = segments.filter((segment) => !isAutomationSegment(segment));
	const last = visible.at(-1);
	if (last?.type !== "text") {
		return visible;
	}

	const trimmed = last.text.trimEnd();
	if (trimmed.length === 0) {
		return visible.slice(0, -1);
	}

	return [...visible.slice(0, -1), { type: "text", text: trimmed }];
}

export function JiraActivityEvent({
	entry,
	onOpenPullRequest,
	className,
}: Readonly<{
	entry: JiraActivityEventEntry;
	className?: string;
	/** Opens the in-app pull-request detail for this activity PR row. */
	onOpenPullRequest?: (entry: JiraActivityEventEntry) => void;
}>) {
	if (entry.pullRequest) {
		const { additions, deletions, number, status, title } = entry.pullRequest;
		const titleLabel = `#${number}: ${title}`;

		return (
			<div className="group/activity-timestamp flex min-h-6 min-w-0 items-center gap-2 py-0.5 text-xs leading-5">
				<Lozenge variant={pullRequestStatusLozengeVariant(status)}>{status}</Lozenge>
				<span className="flex min-w-0 items-center gap-1">
					{onOpenPullRequest ? (
						<button
							type="button"
							className={cn(
								"min-w-0 truncate rounded-xs text-left text-text",
								"no-underline decoration-current outline-none hover:underline focus-visible:underline",
								"focus-visible:ring-3 focus-visible:ring-ring/50",
							)}
							title={titleLabel}
							onClick={() => onOpenPullRequest(entry)}
						>
							{titleLabel}
						</button>
					) : (
						<span className="min-w-0 truncate text-text" title={titleLabel}>
							{titleLabel}
						</span>
					)}
					<span className="flex shrink-0 items-center gap-1">
						<span className="text-text-success">+{additions}</span>
						<span className="text-text-danger">-{deletions}</span>
					</span>
				</span>
				{entry.showTimestamp === false ? null : <JiraActivityTimestamp timestamp={entry.timestamp} />}
			</div>
		);
	}

	const isAutomated = entry.segments.some(isAutomationSegment);

	return (
		<p className={cn("group/activity-timestamp flex min-h-6 min-w-0 items-center py-0.5 text-xs leading-5 text-text-subtlest", className)}>
			<span className="min-w-0">
				{entry.showActor === false ? null : (
					<>
						<JiraActivitySegments
							appearance="plain"
							segments={[mentionSegmentForActor(entry.actor)]}
						/>{" "}
					</>
				)}
				<JiraActivitySegments
					appearance="plain"
					segments={visibleEventSegments(entry.segments)}
				/>
				{entry.showTimestamp === false ? null : (
					<>
						{isAutomated ? <span className="sr-only">Automation</span> : null}
						<JiraActivityTimestamp
							className="ms-1.5"
							icon={isAutomated ? (
								<Icon
									aria-hidden
									className="size-3 shrink-0 text-text-subtlest [&_svg]:size-3!"
									render={<AutomationIcon color="currentColor" label="" size="small" />}
								/>
							) : null}
							timestamp={entry.timestamp}
						/>
					</>
				)}
			</span>
		</p>
	);
}
