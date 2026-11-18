import { Suggestion, Suggestions } from "@/components/ui/suggestion";
import { cn } from "@/lib/utils";

interface AssistantSuggestionsSectionProps {
	className?: string;
	messageId: string;
	suggestedQuestions: ReadonlyArray<string>;
	onSuggestionClick?: (question: string) => void;
}

export function AssistantSuggestionsSection({
	className,
	messageId,
	suggestedQuestions,
	onSuggestionClick,
}: Readonly<AssistantSuggestionsSectionProps>): React.ReactElement {
	return (
		<Suggestions className={cn("py-4", className)} orientation="vertical">
			{suggestedQuestions.map((question, index) => (
				<Suggestion
					key={`${messageId}-suggestion-${question}-${index}`}
					onClick={onSuggestionClick}
					suggestion={question}
				/>
			))}
		</Suggestions>
	);
}
