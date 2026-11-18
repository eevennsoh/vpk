import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CHECKPOINT_DETAIL: ComponentDetail = {
	description:
		"A point in the conversation you can return to. Checkpoint is a separator Marker after a turn, with a Restore button that keeps that turn and drops every message after it.",
	usage: `import { Checkpoint, CheckpointTrigger } from "@/components/ui/checkpoint";

<Checkpoint>
  {label}
  <CheckpointTrigger onClick={restore}>Restore</CheckpointTrigger>
</Checkpoint>`,
	props: [
		{
			name: "children",
			type: "ReactNode",
			required: true,
			description: "Checkpoint label, plus optional CheckpointIcon and CheckpointTrigger.",
		},
		{
			name: "tooltip",
			type: "string",
			description: "CheckpointTrigger only. Shows a tooltip on the Restore button.",
		},
	],
	subComponents: [
		{ name: "Checkpoint", description: "Separator Marker with centered content." },
		{ name: "CheckpointIcon", description: "MarkerIcon slot. Defaults to a bookmark icon." },
		{ name: "CheckpointTrigger", description: "Compact outline Button that restores the conversation." },
	],
};
