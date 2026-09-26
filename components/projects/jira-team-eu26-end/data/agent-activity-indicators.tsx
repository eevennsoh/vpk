import QuestionCircleFilledIcon from "@atlaskit/icon-lab/core/question-circle-filled";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import type { JiraIssueAgentActivityIndicatorRenderer } from "@/components/blocks/jira-issue";
import { Spinner } from "@/components/ui/spinner";
import { token } from "@/lib/tokens";

/**
 * Team EU's working chin uses the explicit experimental six-dot iconic orb
 * from the Jira prototype. The two departures are the outcome glyphs.
 * Awaiting-input: a question circle says the agent is blocked on an answer,
 * which a neutral status dot does not. Finished: the filled success status
 * names the outcome and pairs with the filled error status a failed run
 * already shows, where the block's neutral dot only said "this row ended".
 *
 * The renderer prop is all-or-nothing — one function covers every state — so
 * the working case names that opt-in treatment directly while the shared
 * spinner's neutral default remains unchanged.
 *
 * The filled question circle lives in `@atlaskit/icon-lab`, not `@atlaskit/icon`
 * — it is the design system's only filled question glyph, and it first ships in
 * icon-lab 7.8.0. It takes the information color the block's awaiting-input
 * default uses. ADS icons need the `color` prop rather than a Tailwind class:
 * `@atlaskit/icon` ships Compiled CSS unlayered, and unlayered rules outrank
 * anything in `@layer utilities` regardless of specificity. That applies to the
 * success green here too.
 */
export const renderJiraTeamEu26AgentActivityIndicator: JiraIssueAgentActivityIndicatorRenderer = (
	state,
) => {
	if (state === "finished") {
		return <StatusSuccessIcon color={token("color.icon.success")} label="" size="medium" />;
	}
	return state === "awaiting-input" ? (
		<QuestionCircleFilledIcon color={token("color.icon.information")} label="" size="medium" />
	) : (
		<Spinner label="" pulse size="xl" variant="experimental-avatar" />
	);
};
