import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";

import { toCompactRelativeTimeLabel } from "@/lib/elapsed-time";

import type { JiraSidebarSessionItem } from "./jira";

const PULL_REQUEST_SUMMARY_PREFIX = /^#{1,6}\s*summary\s*[-–—:]\s*/iu;

function pullRequestTitle(session: JiraSidebarSessionItem): string {
	return session.pullRequestTitle?.trim() || `Pull request #${session.pullRequestNumber}`;
}

function pullRequestDescription(session: JiraSidebarSessionItem): string {
	const description = session.pullRequestDescription?.trim();
	if (description) {
		return description.replace(PULL_REQUEST_SUMMARY_PREFIX, "").trim();
	}

	return session.pullRequestTitle?.trim() || `Pull request #${session.pullRequestNumber}`;
}

/** Embedded PR summary used only by the untracked-work flyout. */
export function JiraSessionPullRequestSection({
	session,
	titleId,
}: Readonly<{
	session: JiraSidebarSessionItem;
	titleId: string;
}>) {
	if (session.pullRequestNumber === undefined) {
		return null;
	}

	return (
		<section aria-labelledby={titleId} className="flex flex-col gap-2">
			<div className="group/pull-request grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-1">
				<span
					aria-hidden="true"
					className="flex size-4 shrink-0 items-center justify-center text-icon-accent-purple"
				>
					<MergeSuccessIcon color="currentColor" label="" size="small" />
				</span>
				<div className="min-w-0 line-clamp-2 text-xs leading-4">
					<span className="text-text-subtlest">#{session.pullRequestNumber}</span>{" "}
					<h3
						className="inline text-xs leading-4 font-normal text-text no-underline underline-offset-2 group-hover/pull-request:underline"
						id={titleId}
					>
						{pullRequestTitle(session)}
					</h3>
				</div>
			</div>
			<p className="text-xs leading-4 text-text-subtlest">
				{pullRequestDescription(session)}
			</p>
			{session.pullRequestReviewerCount !== undefined || session.pullRequestUpdatedLabel !== undefined ? (
				<div className="flex min-w-0 items-center gap-1 text-xs leading-4 text-text-subtlest">
					{session.pullRequestReviewerCount !== undefined ? (
						<>
							<span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-icon-subtlest">
								<PeopleGroupIcon color="currentColor" label="" size="small" />
							</span>
							<span><span className="sr-only">Reviewers: </span>{session.pullRequestReviewerCount}</span>
						</>
					) : null}
					{session.pullRequestReviewerCount !== undefined && session.pullRequestUpdatedLabel !== undefined ? (
						<span aria-hidden="true">·</span>
					) : null}
					{session.pullRequestUpdatedLabel !== undefined ? (
						<span><span className="sr-only">Updated </span>{toCompactRelativeTimeLabel(session.pullRequestUpdatedLabel)}</span>
					) : null}
				</div>
			) : null}
		</section>
	);
}
