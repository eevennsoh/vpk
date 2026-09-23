import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import QuestionCircleFilledIcon from "@atlaskit/icon-lab/core/question-circle-filled";

import { Spinner } from "@/components/ui/spinner";

import type { JiraSessionFlyoutState } from "./jira-session-flyout-data";

/** Decorative corner glyph; the adjacent metadata row owns the state text. */
export function JiraSessionStatusIndicator({
	state,
}: Readonly<{
	state: JiraSessionFlyoutState;
}>) {
	switch (state) {
		case "needs-input":
			return (
				<span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 self-start place-items-center text-icon-information">
					<QuestionCircleFilledIcon color="currentColor" label="" size="medium" />
				</span>
			);
		case "working":
			return (
				<span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 self-start place-items-center text-icon-subtlest">
					<Spinner label="" size="default" variant="experimental-avatar" />
				</span>
			);
		case "finished":
			return (
				<span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 self-start place-items-center text-icon-success">
					<StatusSuccessIcon color="currentColor" label="" size="medium" />
				</span>
			);
		default: {
			const exhaustiveState: never = state;
			return exhaustiveState;
		}
	}
}
