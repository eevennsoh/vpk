import TaskInProgressIcon from "@atlaskit/icon/core/task-in-progress";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import StatusWarningIcon from "@atlaskit/icon/core/status-warning";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { AGENT_SESSION_STATUS_LABEL } from "@/components/blocks/agent-session/agent-session-long-metadata";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { summarizeTeammateActivity } from "@/app/sandbox/agent-selector-canvas/teammate-session-model";

// Exhaustive so a new lifecycle state cannot silently disappear from the digest.
const statusPresentation = {
	running: { Glyph: TaskInProgressIcon, tone: "text-icon-subtle" },
	complete: { Glyph: StatusSuccessIcon, tone: "text-icon-success" },
	"needs-input": { Glyph: StatusInformationIcon, tone: "text-icon-information" },
	attention: { Glyph: StatusWarningIcon, tone: "text-icon-warning" },
} satisfies Record<AgentSessionItem["state"], { Glyph: typeof TaskInProgressIcon; tone: string }>;

export function activitySummaryLabel(items: readonly AgentSessionItem[]) {
	return summarizeTeammateActivity(items).map(({ state, count }) => `${count} ${AGENT_SESSION_STATUS_LABEL[state].toLowerCase()}`).join(", ");
}

export function TeammateActivitySummary({ items }: Readonly<{ items: readonly AgentSessionItem[] }>) {
	return (
		<span aria-hidden="true" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
			{summarizeTeammateActivity(items).map(({ state, count }) => {
				const { Glyph, tone } = statusPresentation[state];
				return <span key={state} className="flex items-center gap-1"><Icon className={cn("size-3", tone)} render={<Glyph label="" size="small" />} />{count} {AGENT_SESSION_STATUS_LABEL[state].toLowerCase()}</span>;
			})}
		</span>
	);
}
