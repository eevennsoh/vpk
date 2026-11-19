import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CONTEXT_CHIP_DETAIL: ComponentDetail = {
	description: "A removable reference in a composer. Open the chip to review its context, or remove it before sending.",
	usage: `import ReplyLeftIcon from "@atlaskit/icon-lab/core/reply-left"
import { ContextChip } from "@/components/ui-custom/context-chip"

<ContextChip
  countLabel="Replying to Summarize onboarding feedback"
  icon={<ReplyLeftIcon color="currentColor" label="" size="small" />}
  items={[{ id: "session-1", title: "Summarize onboarding feedback", body: "Replying in this activity thread" }]}
  onRemoveAll={() => setReplyTarget(null)}
  removeAllLabel="Remove reply target"
  testId="reply-target-chip"
/>`,
	props: [
		{ name: "items", type: "readonly ContextChipItem[]", required: true, description: "References shown in the popover, each with an id, title, optional subtitle, and body." },
		{ name: "icon", type: "ReactNode", required: true, description: "Visual shown before the label." },
		{ name: "countLabel", type: "string", required: true, description: "Visible label identifying the attached context." },
		{ name: "triggerLabel", type: "string", description: "Accessible name for the popover trigger; defaults to Review followed by the label." },
		{ name: "onRemoveAll", type: "() => void", required: true, description: "Removes the attached context." },
		{ name: "removeAllLabel", type: "string", required: true, description: "Accessible name for the remove button." },
		{ name: "testId", type: "string", required: true, description: "Identifier for the chip root." },
	],
	examples: [
		{ title: "Reply to a session", description: "A session reference in a composer. Open it to review the target or remove it.", demoSlug: "context-chip-demo-reply" },
		{ title: "Comments", description: "Several comments collected into one reference.", demoSlug: "context-chip-demo-comments" },
		{ title: "Failing checks", description: "Checks attached as context for a fix.", demoSlug: "context-chip-demo-checks" },
	],
};
