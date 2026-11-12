import type { ComponentDetail } from "@/app/data/component-detail-types";

export const OPEN_IN_DETAIL: ComponentDetail = {
	description: "A split button for choosing an app and repeating the action with the last selected app.",
	importStatement: 'import { OpenIn } from "@/components/ui-custom/open-in";',
	usage: `<OpenIn
  app={{ name: "Claude", icon: <ClaudeIcon /> }}
  contentLabel="Choose an app"
  open={open}
  onOpenChange={setOpen}
  onAppClick={openSelectedApp}
>
  {appPicker}
</OpenIn>`,
	props: [
		{ name: "app", type: "{ name: string; icon: ReactNode } | null", required: true, description: "Selected app shown as the repeat-action button." },
		{ name: "children", type: "ReactNode", required: true, description: "Picker content shown by the Open in button." },
		{ name: "contentLabel", type: "string", required: true, description: "Accessible name for the picker." },
		{ name: "open", type: "boolean", required: true, description: "Whether the picker is open." },
		{ name: "onOpenChange", type: "(open: boolean) => void", required: true, description: "Updates the picker state." },
		{ name: "onAppClick", type: "() => void", required: true, description: "Runs the selected app action." },
		{ name: "status", type: "string", description: "Optional feedback announced to screen readers." },
	],
};
