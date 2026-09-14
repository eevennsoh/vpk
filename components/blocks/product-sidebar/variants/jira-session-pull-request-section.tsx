import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";

import type { JiraSidebarSessionItem } from "./jira";

const PULL_REQUEST_SUMMARY_PREFIX = /^#{1,6}\s*summary\s*[-–—:]\s*/iu;

function pullRequestDescription(session: JiraSidebarSessionItem): string {
	const description = session.pullRequestDescription?.trim();
	if (description) {
		return description.replace(PULL_REQUEST_SUMMARY_PREFIX, "").trim();
	}

	return session.pullRequestTitle?.trim() || `Pull request #${session.pullRequestNumber}`;
}

/** Embedded PR summary used only by the untracked-work flyout. */
export function JiraSessionPullRequestSection({
	confidenceLabel,
	session,
	titleId,
}: Readonly<{
	confidenceLabel: string;
	session: JiraSidebarSessionItem;
	titleId: string;
}>) {
	if (session.pullRequestNumber === undefined) {
		return null;
	}

	return (
		<section aria-labelledby={titleId} className="flex flex-col gap-2">
			<div className="flex min-w-0 items-center gap-1">
				<span
					aria-hidden="true"
					className="flex size-4 shrink-0 items-center justify-center text-icon-accent-purple"
				>
					<MergeSuccessIcon color="currentColor" label="" size="small" />
				</span>
				<span className="shrink-0 text-xs leading-4 text-text-subtlest">
					#{session.pullRequestNumber}
				</span>
				<h3 className="min-w-0 text-xs leading-4 font-normal text-text" id={titleId}>
					{confidenceLabel}
				</h3>
			</div>
			<p className="text-xs leading-4 text-text-subtlest">
				{pullRequestDescription(session)}
			</p>
		</section>
	);
}
