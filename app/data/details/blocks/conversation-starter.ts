import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CONVERSATION_STARTER_DETAIL: ComponentDetail = {
		apiName: "ConversationStarterDialog",
		description: "Modal for editing an agent's conversation starters: a fixed set of up to maxStarters (default 3) rows you can reorder by dragging, give each its own icon, clear, or fill all at once with “Generate for me”.",
		importStatement: `import { ConversationStarterDialog } from "@/components/blocks/conversation-starter";`,
		usage: `import { ConversationStarterDialog } from "@/components/blocks/conversation-starter";
import type { ConversationStarter } from "@/components/blocks/conversation-starter";

const [open, setOpen] = useState(false);
const [starters, setStarters] = useState<readonly ConversationStarter[]>([
  { id: "s1", text: "Summarize this project's status", icon: "ai-sparkle" },
  { id: "s2", text: "What are the open risks?", icon: "question-circle" },
]);

<ConversationStarterDialog
  open={open}
  onOpenChange={setOpen}
  starters={starters}
  maxStarters={3}
  onSave={setStarters}
  onGenerate={async () => fetchSuggestedStarters()}
/>`,
		demoLayout: { previewHeight: "fixed" },
		props: [
			{
				name: "open",
				type: "boolean",
				required: true,
				description: "Controlled dialog open state.",
			},
			{
				name: "onOpenChange",
				type: "(open: boolean) => void",
				required: true,
				description: "Called when the dialog requests an open-state change (Cancel, close, or after Save).",
			},
			{
				name: "starters",
				type: "readonly ConversationStarter[]",
				description: "Controlled starter list. The dialog seeds an internal draft from this each time it opens.",
			},
			{
				name: "defaultStarters",
				type: "readonly ConversationStarter[]",
				description: "Initial uncontrolled starter list when `starters` is omitted.",
			},
			{
				name: "onSave",
				type: "(starters: readonly ConversationStarter[]) => void",
				description: "Called by the primary (Add) button with the trimmed, non-empty starters.",
			},
			{
				name: "onStartersChange",
				type: "(starters: readonly ConversationStarter[]) => void",
				description: "Called alongside save with the committed starters; use for uncontrolled persistence.",
			},
			{
				name: "onGenerate",
				type: "() => readonly ConversationStarter[] | Promise<readonly ConversationStarter[]>",
				description: "Backs the “Generate for me” button. When omitted, a built-in sample set is used. The button shows a loading state while awaiting an async result.",
			},
			{
				name: "maxStarters",
				type: "number",
				description: "Number of starter rows always shown. Defaults to 3.",
			},
			{
				name: "iconOptions",
				type: "readonly StarterIconOption[]",
				description: "Override the icon set shown in the per-starter picker. Defaults to STARTER_ICON_OPTIONS.",
			},
			{
				name: "title",
				type: "string",
				description: "Optional dialog title. Defaults to “Conversation starters”.",
			},
			{
				name: "saveLabel",
				type: "string",
				description: "Optional primary button label. Defaults to “Add”.",
			},
			{
				name: "placeholder",
				type: "string",
				description: "Optional input placeholder. Defaults to “Write a new conversation starter”.",
			},
		],
	};
