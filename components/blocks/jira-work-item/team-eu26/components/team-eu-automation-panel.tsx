"use client";

import AddIcon from "@atlaskit/icon/core/add";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import AutomationIcon from "@atlaskit/icon/core/automation";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import PersonIcon from "@atlaskit/icon/core/person";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import type { WorkItemAutomationRule } from "@/components/blocks/jira-work-item/team-eu26/components/automation-tab";
import { SetToRecurRow } from "@/components/blocks/jira-work-item/team-eu26/components/set-to-recur-popover";
import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";

const REFERENCE_RECENT_ORDER = [
	"sprint-board",
	"slack",
	"reminder",
	"daily-digest",
] as const;
const ACTION_ROW_CLASS =
	"flex min-h-10 w-full min-w-0 items-center gap-2 px-4 text-left text-sm text-text";

function recentRules(rules: readonly WorkItemAutomationRule[]) {
	const order = new Map<string, number>(
		REFERENCE_RECENT_ORDER.map((id, index) => [id, index]),
	);
	return rules
		.filter((rule) => rule.lastRunAt)
		.toSorted(
			(left, right) =>
				(order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
				(order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
		);
}

function AutomationEmptyIllustration() {
	return (
		<div className="flex flex-col items-center gap-3 px-4 pb-3 pt-1 text-center">
			<div aria-hidden className="flex flex-col items-center">
				<IconTile
					aria-hidden
					as="span"
					className="relative z-30"
					icon={<AutomationIcon color="currentColor" label="" size="small" />}
					label=""
					size="medium"
					variant="blueBold"
				/>
				<IconTile
					aria-hidden
					as="span"
					className="relative z-20 -mt-2"
					icon={<PersonIcon color="currentColor" label="" size="small" />}
					label=""
					size="medium"
					variant="purpleBold"
				/>
				<IconTile
					aria-hidden
					as="span"
					className="relative z-10 -mt-2"
					icon={<StatusSuccessIcon color="currentColor" label="" size="small" />}
					label=""
					size="medium"
					variant="greenBold"
				/>
			</div>
			<p className="text-sm leading-5 text-text-subtle">
				Create an automation to perform tasks with the click of a button. Once created, manually triggered
				automations will appear here.
			</p>
			<Button className="h-auto px-0" disabled type="button" variant="link">
				Add manually triggered automation
			</Button>
			<a
				className="text-sm font-medium text-link hover:underline"
				href="#"
				onClick={(event) => event.preventDefault()}
			>
				See templates
			</a>
		</div>
	);
}

export function AutomationRuleList({ rules }: Readonly<{ rules: readonly WorkItemAutomationRule[] }>) {
	return (
		<ul aria-label="Available automations" className="-mx-2 pb-2">
			{rules.map((rule) => (
				<li key={rule.id}>
					<div className="flex min-h-10 min-w-0 items-center gap-2 rounded-md px-2 text-sm text-text hover:bg-bg-neutral-subtle-hovered">
						<IconTile aria-hidden as="span" icon={<AutomationIcon label="" size="small" />} label="" size="small" variant={rule.iconVariant} />
						<span className="min-w-0 truncate">{rule.title}</span>
					</div>
				</li>
			))}
		</ul>
	);
}

export function TeamEuAutomationPanel({
	empty = false,
	onShowRecentRuns,
	rules,
}: Readonly<{
	empty?: boolean;
	onShowRecentRuns: () => void;
	rules: readonly WorkItemAutomationRule[];
}>) {
	return (
		<TeamEuRailPanel defaultOpen={empty} title="Automation">
			<div className="pb-3">
				{rules.length > 0 ? (
					<div className="px-4"><AutomationRuleList rules={rules} /></div>
				) : (
					<AutomationEmptyIllustration />
				)}
				<button
					className={`${ACTION_ROW_CLASS} border-y border-border outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none`}
					onClick={onShowRecentRuns}
					type="button"
				>
					<span className="min-w-0 flex-1 font-medium">Recent run rules</span>
					<ChevronRightIcon label="" size="small" />
				</button>
				<div className="px-4">
					<SetToRecurRow />
				</div>
				<div className={ACTION_ROW_CLASS}>
					<AddIcon label="" size="small" />
					<span>Create automation</span>
				</div>
			</div>
		</TeamEuRailPanel>
	);
}

export function TeamEuRecentAutomationRuns({
	backLabel = "Back to work item details",
	onBack,
	rules,
}: Readonly<{ backLabel?: string; onBack: () => void; rules: readonly WorkItemAutomationRule[] }>) {
	const runs = recentRules(rules);
	return (
		<section aria-labelledby="team-eu-recent-runs-heading" className="pt-1">
			<div className="flex h-8 items-center gap-2 px-2">
				<Button
					aria-label={backLabel}
					onClick={onBack}
					size="icon-compact"
					type="button"
					variant="ghost"
				>
					<ArrowLeftIcon label="" size="small" />
				</Button>
				<h2
					className="text-sm font-semibold text-text"
					id="team-eu-recent-runs-heading"
				>
					Recent run rules
				</h2>
			</div>
			{runs.length > 0 ? (
				<ul aria-label="Recent automation runs">
					{runs.map((rule) => (
						<li
							className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-sm hover:bg-bg-neutral-subtle-hovered"
							key={rule.id}
						>
							<span className="flex w-6 shrink-0 justify-center">
								<Icon
									aria-hidden
									className="text-icon-success"
									render={<StatusSuccessIcon label="" size="small" />}
								/>
							</span>
							<span className="min-w-0 flex-1 truncate">{rule.title}</span>
							<time className="shrink-0 text-text-subtlest">
								{rule.lastRunAt}
							</time>
						</li>
					))}
				</ul>
			) : (
				<p className="px-4 py-2 text-sm text-text-subtle">
					No recent rule runs.
				</p>
			)}
		</section>
	);
}
