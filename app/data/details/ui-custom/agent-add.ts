import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_ADD_DETAIL: ComponentDetail = {
	description: "A hexagonal add-agent trigger that opens an agent picker. The example pairs it with Butter's live agent preview.",
	usage: `import { AgentAdd } from "@/components/ui-custom/agent-add";
import { PopoverContent } from "@/components/ui/popover";

<AgentAdd open={open} onOpenChange={setOpen}>
  <PopoverContent aria-label="Agents">{picker}</PopoverContent>
</AgentAdd>`,
	props: [
		{ name: "open", type: "boolean", required: true, description: "Whether the picker is open." },
		{ name: "onOpenChange", type: "(open: boolean) => void", required: true, description: "Updates the picker state." },
		{ name: "children", type: "ReactNode", required: true, description: "Popover content containing the host's agent picker." },
		{ name: "label", type: "string", default: '"Add agent"', description: "Accessible name for the trigger." },
		{ name: "disabled", type: "boolean", default: "false", description: "Disables the trigger." },
		{ name: "triggerRef", type: "RefObject<HTMLButtonElement | null>", description: "Optional trigger ref for focus management." },
	],
};
