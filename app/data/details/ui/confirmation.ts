import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CONFIRMATION_DETAIL: ComponentDetail = {
	description:
		"Asks the person for a yes or no before a tool runs. The question is an outline Item with Deny and Approve buttons; once the person answers, render the call as a Trace line. Sub-components show or hide themselves from the AI SDK tool approval state.",
	usage: `import { ItemMedia } from "@/components/ui/item";
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationTitle,
} from "@/components/ui/confirmation";

<Confirmation approval={part.approval} state={part.state}>
  <ItemMedia variant="icon">
    <TerminalIcon label="" />
  </ItemMedia>
  <ConfirmationTitle>Run {part.input.command}?</ConfirmationTitle>
  <ConfirmationActions>
    <ConfirmationAction variant="outline" onClick={deny}>Deny</ConfirmationAction>
    <ConfirmationAction onClick={approve}>Approve</ConfirmationAction>
  </ConfirmationActions>
</Confirmation>

// AI SDK: answer with the approval id while the part is approval-requested,
// and continue the chat once every approval has an answer.
addToolApprovalResponse({ id: part.approval.id, approved: true });

useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});`,
	props: [
		{
			name: "approval",
			type: "ToolUIPartApproval",
			required: true,
			description: "Approval object from the AI SDK ToolUIPart. Contains id, and optionally approved (boolean) and reason (string).",
		},
		{
			name: "state",
			type: "ToolUIPart[\"state\"]",
			required: true,
			description: "Current tool execution state: input-streaming, input-available, approval-requested, approval-responded, output-denied, or output-available.",
		},
		{
			name: "variant",
			type: '"default" | "outline" | "muted"',
			default: '"outline"',
			description: "Item variant for the Confirmation container.",
		},
		{
			name: "size",
			type: '"default" | "sm" | "xs"',
			default: '"sm"',
			description: "Item size for the Confirmation container.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the Item container.",
		},
	],
	subComponents: [
		{ name: "Confirmation", description: "Root Item (outline, sm) that provides approval context to children. Renders nothing without an approval or during input-streaming and input-available states." },
		{ name: "ConfirmationTitle", description: "ItemContent with an ItemTitle for the question or outcome text." },
		{ name: "ConfirmationRequest", description: "Content shown only during approval-requested state." },
		{ name: "ConfirmationAccepted", description: "Content shown when approval.approved is true and state is approval-responded, output-denied, or output-available." },
		{ name: "ConfirmationRejected", description: "Content shown when approval.approved is false and state is approval-responded, output-denied, or output-available." },
		{ name: "ConfirmationActions", description: "ItemActions container for the buttons, only visible during approval-requested state." },
		{ name: "ConfirmationAction", description: "Button at VPK's default size (h-8, shadcn's sm). Accepts all Button props including variant." },
	],
	examples: [
		{ title: "Approval request", description: "Pending approval with Deny and Approve buttons.", demoSlug: "confirmation-demo-request" },
		{ title: "Accepted", description: "Approved outcome shown through ConfirmationAccepted.", demoSlug: "confirmation-demo-accepted" },
		{ title: "Rejected", description: "Denied outcome shown through ConfirmationRejected.", demoSlug: "confirmation-demo-rejected" },
	],
};
