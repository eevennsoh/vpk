import type { ComponentDetail } from "@/app/data/component-detail-types";

export const MODEL_SELECTOR_DETAIL: ComponentDetail = {
	description:
		"Two menus built on Dropdown Menu: one picks the model the agent runs, the other picks how hard it thinks. Items are radio items grouped by provider, and picking one closes the menu. Provider logos come from models.dev.",
	usage: `import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorList,
  ModelSelectorGroup,
  ModelSelectorItem,
} from "@/components/ui-custom/model-selector";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ArrowUpIcon, ChevronDownIcon } from "@/components/ui/vpk-icons";

<InputGroup>
  <InputGroupTextarea placeholder="Ask the agent to change your code..." />
  <InputGroupAddon align="block-end">
    <ModelSelector>
      <ModelSelectorTrigger render={<InputGroupButton size="sm" />}>
        GPT-5
        <ChevronDownIcon />
      </ModelSelectorTrigger>
      <ModelSelectorContent align="start">
        <ModelSelectorList value={model} onValueChange={setModel}>
          <ModelSelectorGroup heading="OpenAI">
            <ModelSelectorItem value="gpt-5">GPT-5</ModelSelectorItem>
            <ModelSelectorItem value="gpt-5-mini">GPT-5 mini</ModelSelectorItem>
          </ModelSelectorGroup>
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
    <ModelSelector>
      <ModelSelectorTrigger render={<InputGroupButton size="sm" />}>
        Medium
        <ChevronDownIcon />
      </ModelSelectorTrigger>
      <ModelSelectorContent align="start" title="Effort">
        <ModelSelectorList value={effort} onValueChange={setEffort}>
          <ModelSelectorItem value="low">Low</ModelSelectorItem>
          <ModelSelectorItem value="medium">Medium</ModelSelectorItem>
          <ModelSelectorItem value="high">High</ModelSelectorItem>
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
    <InputGroupButton type="submit" variant="default" className="ml-auto">
      <ArrowUpIcon label="Send" />
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>`,
	props: [
		{
			name: "children",
			type: "ReactNode",
			required: true,
			description: "ModelSelectorTrigger and ModelSelectorContent sub-components.",
		},
		{
			name: "open",
			type: "boolean",
			description: "Controlled open state for the dropdown menu.",
		},
		{
			name: "modal",
			type: "boolean",
			default: "true",
			description: "Whether the dropdown menu traps outside interaction while open.",
		},
		{
			name: "onOpenChange",
			type: "(open: boolean) => void",
			description: "Callback when dropdown menu open state changes.",
		},
	],
	subComponents: [
		{ name: "ModelSelector", description: "Root DropdownMenu." },
		{ name: "ModelSelectorTrigger", description: "DropdownMenuTrigger. Pass render to use an InputGroupButton or Button." },
		{ name: "ModelSelectorContent", description: "DropdownMenuContent, labelled by title (default: 'Model Selector')." },
		{ name: "ModelSelectorList", description: "DropdownMenuRadioGroup whose value is the selected model id; onValueChange receives the picked id." },
		{ name: "ModelSelectorGroup", description: "DropdownMenuGroup with a DropdownMenuLabel for its heading." },
		{ name: "ModelSelectorItem", description: "DropdownMenuRadioItem with closeOnClick, so picking a model closes the menu. onSelect receives the item value; closeOnSelect={false} keeps the menu open." },
		{ name: "ModelSelectorName", description: "Truncated model name text." },
		{ name: "ModelSelectorLogo", description: "Provider logo fetched from models.dev/logos. Supports autocomplete-friendly provider union type." },
		{ name: "ModelSelectorLogoGroup", description: "Stacked logo container with overlapping ring styling." },
		{ name: "ModelSelectorShortcut", description: "DropdownMenuShortcut shown alongside an item." },
		{ name: "ModelSelectorSeparator", description: "DropdownMenuSeparator between groups." },
	],
	examples: [
		{ title: "With logos", description: "Provider logos on trigger and items with separators between groups.", demoSlug: "model-selector-demo-with-logos" },
		{ title: "Multi-provider trigger", description: "Trigger showing stacked logos from multiple providers.", demoSlug: "model-selector-demo-multi-provider" },
		{ title: "Reasoning modes", description: "Grouped mode selector with selected state.", demoSlug: "model-selector-demo-reasoning-modes" },
	],
};
