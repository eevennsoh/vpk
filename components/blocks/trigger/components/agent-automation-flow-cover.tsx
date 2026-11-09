import type { ReactElement } from "react";

import { AgentTriggerProviderCompactTileIcon, AgentTriggerProviderTileIcon, type AgentTriggerValue } from "@/components/blocks/trigger/page";
import { IconTile } from "@/components/ui/icon-tile";
import { Tile } from "@/components/ui/tile";
import AutomationIcon from "@atlaskit/icon/core/automation";
import GenerativeIndicatorIcon from "@atlaskit/icon-lab/core/generative-indicator";

interface AgentAutomationFlowCoverProps {
	"aria-label"?: string;
	"aria-hidden"?: boolean;
	rootElement?: "div" | "span";
	triggers: readonly AgentTriggerValue[];
	// "compact" renders trigger providers as 16px bordered tiles for dense
	// surfaces like the agent test greeting flow rows; the target keeps the
	// compact IconTile treatment. "default" keeps the 32px treatment used by
	// trigger config and the picker cover.
	size?: "default" | "compact";
}

function CompactFlowTile({
	icon,
	label,
}: Readonly<{
	icon: ReactElement;
	label: string;
}>): ReactElement {
	return (
		<Tile aria-hidden={true} className="bg-surface" hasBorder label={label} size="xxsmall" variant="transparent">
			{icon}
		</Tile>
	);
}

export function AgentAutomationFlowCover({
	"aria-label": ariaLabel,
	"aria-hidden": ariaHidden = true,
	rootElement = "div",
	triggers,
	size = "default",
}: Readonly<AgentAutomationFlowCoverProps>): ReactElement {
	const Root = rootElement;
	const visibleTriggers = triggers.slice(0, 5);
	const overflowCount = Math.max(0, triggers.length - visibleTriggers.length);

	if (size === "compact") {
		return (
			<Root
				aria-hidden={ariaHidden || undefined}
				aria-label={ariaHidden ? undefined : ariaLabel}
				className="flex items-center gap-1.5"
			>
				<span className="flex min-w-0 items-center gap-1">
					{visibleTriggers.length > 0 ? (
						visibleTriggers.map((trigger) => (
							<span
								key={trigger.id}
								className="inline-flex size-4 shrink-0 items-center justify-center"
							>
								<AgentTriggerProviderCompactTileIcon
									fallback={<CompactFlowTile icon={<AutomationIcon label="" size="small" />} label="Trigger" />}
									trigger={trigger}
								/>
							</span>
						))
					) : (
						<CompactFlowTile
							icon={<AutomationIcon label="" size="small" />}
							label="Trigger"
						/>
					)}
					{overflowCount > 0 ? (
						<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-bg-input px-1 text-[10px] font-medium leading-3 text-text-subtle">
							+{overflowCount}
						</span>
					) : null}
				</span>
				<span className="h-px w-4 shrink-0 bg-border" />
				<IconTile
					aria-hidden={true}
					icon={<GenerativeIndicatorIcon label="" size="small" />}
					label="Agent instructions"
					size="xxsmall"
					variant="gray"
				/>
			</Root>
		);
	}

	return (
		<Root
			aria-hidden={ariaHidden || undefined}
			aria-label={ariaHidden ? undefined : ariaLabel}
			className="flex items-center gap-2"
		>
			<span className="flex min-w-0 items-center gap-1">
				{visibleTriggers.length > 0 ? (
					visibleTriggers.map((trigger) => (
						<span key={trigger.id} className="rich-text-command-menu-avatar inline-flex size-8 shrink-0 items-center justify-center">
							<AgentTriggerProviderTileIcon
								fallback={<AutomationIcon label="" size="small" />}
								trigger={trigger}
							/>
						</span>
					))
				) : (
					<IconTile
						aria-hidden={true}
						icon={<AutomationIcon label="" size="small" />}
						label="Trigger"
						size="medium"
						variant="blue"
					/>
				)}
				{overflowCount > 0 ? (
					<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-bg-input px-1.5 text-xs font-medium leading-4 text-text-subtle">
						+{overflowCount}
					</span>
				) : null}
			</span>
			<span className="h-px w-6 shrink-0 bg-border" />
			<IconTile
				aria-hidden={true}
				icon={<GenerativeIndicatorIcon label="" size="small" />}
				label="Agent instructions"
				size="small"
				variant="gray"
			/>
		</Root>
	);
}
