import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SUGGESTION_DETAIL: ComponentDetail = {
	description:
		"A short prompt you can send to the agent in one click. Each Suggestion is a subtle Button with a curved-arrow icon; the row scrolls sideways when it overflows.",
	usage: `import { Suggestion, Suggestions } from "@/components/ui/suggestion";

<Suggestions>
  {suggestions.map((suggestion) => (
    <Suggestion
      key={suggestion}
      suggestion={suggestion}
      onClick={(text) => sendMessage({ text })}
    />
  ))}
</Suggestions>`,
	props: [
		{
			name: "suggestion",
			type: "string",
			required: true,
			description: "The prompt text, shown as the label and passed to onClick.",
		},
		{
			name: "onClick",
			type: "(suggestion: string) => void",
			description: "Called with the suggestion when clicked.",
		},
		{
			name: "orientation",
			type: '"horizontal" | "vertical"',
			default: '"horizontal"',
			description: "Suggestions only. Horizontal scrolls with an edge fade; vertical stacks follow-ups.",
		},
	],
	subComponents: [
		{ name: "Suggestions", description: "Row (or stack) of suggestions." },
		{ name: "Suggestion", description: "Subtle Button with a leading curved-arrow icon." },
	],
	examples: [
		{
			title: "Follow-up",
			description: "Vertical follow-up prompts under an agent reply.",
			demoSlug: "suggestion-demo-follow-up",
		},
	],
};
