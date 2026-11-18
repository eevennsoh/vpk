import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PLAN_DETAIL: ComponentDetail = {
	description:
		"Displays the steps the agent plans to take. The default card variant is VPK's generative plan card: a collapsible card with a tile, shimmering title and description while streaming, a markdown summary or numbered task list capped with \"Show more\", and footer actions. variant=\"inline\" is shadcn's Plan: a collapsible Trace line (\"Plan: … · 2 of 4 done\") with one line per step, where the title and the running step shimmer while the plan streams.",
	usage: `import {
  Plan,
  PlanAvatar,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanIcon,
  PlanStep,
  PlanSteps,
  PlanTitle,
} from "@/components/ui/plan";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { PlanTabContent } from "@/components/projects/shared/lib/plan-card-utils";

// Card (default)
<Plan open={isOpen} onOpenChange={setIsOpen}>
  <PlanHeader
    leading={<PlanAvatar><IconTile icon={<DashboardIcon label="" />} label="Plan" variant="blue" /></PlanAvatar>}
    title={<PlanTitle>Implementation plan</PlanTitle>}
    description={<PlanDescription>4 tasks</PlanDescription>}
  />
  <PlanContent className="pb-0">
    <PlanTabContent description={planSummaryMarkdown} />
    <PlanFooter>
      <Button variant="outline">Open preview</Button>
      <Button>Build</Button>
    </PlanFooter>
  </PlanContent>
</Plan>

// Inline
<Plan variant="inline" defaultOpen isStreaming>
  <PlanHeader>
    <PlanIcon />
    <PlanTitle>Plan: migrate to Base UI</PlanTitle>
    <PlanDescription>2 of 5 done</PlanDescription>
  </PlanHeader>
  <PlanContent>
    <PlanSteps>
      <PlanStep status="done">Replace the Radix imports</PlanStep>
      <PlanStep status="running">Rename asChild to render</PlanStep>
      <PlanStep status="pending">Run the type checker</PlanStep>
    </PlanSteps>
  </PlanContent>
</Plan>`,
	props: [
		{
			name: "variant",
			type: '"card" | "inline"',
			default: '"card"',
			description: "Plan only. card is the generative plan card; inline renders the parts as shadcn's Trace line. Header, Avatar, Title, Description, Content, TaskList, TaskItem, Action, Trigger and Footer render in both; Summary and AgentBar are card-only; PlanIcon, PlanSteps and PlanStep are inline-only.",
		},
		{
			name: "isStreaming",
			type: "boolean",
			default: "false",
			description: "Plan only. Card: shimmers string titles and descriptions and animates the summary markdown. Inline: sets the header line to running and shimmers the running step.",
		},
		{
			name: "open / defaultOpen / onOpenChange",
			type: "boolean / boolean / (open: boolean) => void",
			description: "Plan only. Collapsible state; pass open and onOpenChange together.",
		},
		{
			name: "defaultContentExpanded",
			type: "boolean",
			default: "false",
			description: "Plan only, card. Starts the summary and task list without the collapsed \"Show more\" treatment.",
		},
		{
			name: "status",
			type: '"done" | "running" | "pending"',
			description: "PlanStep, and PlanTaskItem in the inline variant (default pending). Picks the step icon; pending dims the line.",
		},
	],
	subComponents: [
		{ name: "Plan", description: "Root. Card: a collapsible Card. Inline: a Trace with a TraceCollapsible." },
		{ name: "PlanHeader", description: "Card: generative header with `leading`, `title`, `description`, `action` and a built-in chevron toggle. Inline: the collapsible trigger line; pass parts as children (or `leading`/`title`/`description`)." },
		{ name: "PlanAvatar", description: "Card: a slot for the plan's tile, such as an IconTile or VisualIdentityTile. Inline: PlanIcon." },
		{ name: "PlanIcon", description: "Inline only. Trace icon slot; defaults to the route icon." },
		{ name: "PlanTitle", description: "Title; shimmers while streaming." },
		{ name: "PlanDescription", description: "Description or progress text, such as \"2 of 4 done\"; shimmers while streaming in the card." },
		{ name: "PlanAction", description: "Action slot. Inline: rendered next to the header, never inside the trigger." },
		{ name: "PlanContent", description: "Collapsible content. Inline: indented with Trace's left rule." },
		{ name: "PlanSummary", description: "Card only. Caps its children at 240px with a \"Show more\" button; expansion is shared with PlanTaskList. PlanTabContent (projects/shared) fills it with markdown." },
		{ name: "PlanAgentBar", description: "Card only. Agent count row with people icon. Accepts an `agents` string array." },
		{ name: "PlanTaskList", description: "Card: numbered list with overflow detection and \"Show more\". Inline: PlanSteps." },
		{ name: "PlanTaskItem", description: "Card: animated numbered task row with optional `blockedByLabels`, `blockedByText` and `agent` badge. Inline: PlanStep with `status`." },
		{ name: "PlanSteps", description: "Inline only. Trace column for the steps." },
		{ name: "PlanStep", description: "Inline only. One step line with a done, running or pending icon." },
		{ name: "PlanTrigger", description: "Card: ChevronsUpDown toggle button. Inline: renders only its children; the whole header line opens the plan." },
		{ name: "PlanChevronTrigger", description: "Card only. Chevron toggle button for custom plan headers." },
		{ name: "PlanFooter", description: "Actions row; accepts an optional `action`." },
	],
	examples: [
		{ title: "Summary", description: "Card with a markdown summary and footer actions.", demoSlug: "plan-demo-summary-and-tasks" },
		{ title: "Tasks only", description: "Card with a numbered task list.", demoSlug: "plan-demo-tasks-only" },
		{ title: "Inline", description: "variant=\"inline\" as an agent streams the plan step by step. Replay restarts the stream.", demoSlug: "plan-demo-inline" },
		{ title: "Inline details", description: "variant=\"inline\" with a description above the steps, inside PlanContent.", demoSlug: "plan-demo-description" },
	],
};
