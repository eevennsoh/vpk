import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PLAN_DETAIL: ComponentDetail = {
	description:
		"Displays the steps the agent plans to take, and how far it has got. A collapsible Trace line (\"Plan: … · 2 of 4 done\") with one line per step; the title and the running step shimmer while the plan streams. For VPK's generative plan card, use the ui-custom Plan; its variant=\"inline\" renders this component.",
	usage: `import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanIcon,
  PlanStep,
  PlanSteps,
  PlanTitle,
} from "@/components/ui/plan";

<Plan defaultOpen isStreaming>
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
			name: "isStreaming",
			type: "boolean",
			default: "false",
			description: "Plan only. Sets the header line to running (title shimmer) and shimmers the running step.",
		},
		{
			name: "open / defaultOpen / onOpenChange",
			type: "boolean / boolean / (open: boolean) => void",
			description: "Plan only. Collapsible state, passed to TraceCollapsible; pass open and onOpenChange together.",
		},
		{
			name: "status",
			type: '"done" | "running" | "pending"',
			description: "PlanStep only. Picks the step icon; pending dims the line.",
		},
	],
	subComponents: [
		{ name: "Plan", description: "Trace with a TraceCollapsible; provides isStreaming to the parts." },
		{ name: "PlanHeader", description: "Collapsible trigger wrapping a TraceLine, with Trace's chevron." },
		{ name: "PlanIcon", description: "Trace icon slot; defaults to the route icon." },
		{ name: "PlanTitle", description: "Truncating title (TraceTitle)." },
		{ name: "PlanDescription", description: "Progress text, such as \"2 of 4 done\" (TraceDescription)." },
		{ name: "PlanContent", description: "Indented collapsible content with Trace's left rule." },
		{ name: "PlanSteps", description: "Trace column for the steps." },
		{ name: "PlanStep", description: "One step line with a done, running or pending icon." },
		{ name: "PlanAction", description: "Action container rendered next to the header, never inside the trigger." },
		{ name: "PlanTrigger", description: "Renders only its children; the whole header line opens the plan." },
		{ name: "PlanFooter", description: "Plain container for actions under the steps." },
	],
	examples: [
		{ title: "Usage", description: "A streaming plan with done, running and pending steps.", demoSlug: "plan-demo-usage" },
		{ title: "Details", description: "A description above the steps, inside PlanContent.", demoSlug: "plan-demo-description" },
	],
};
