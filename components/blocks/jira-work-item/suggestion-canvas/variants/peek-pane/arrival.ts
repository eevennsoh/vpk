import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";

interface ArrivalRule {
	/** The field whose value let the agent find this suggestion. */
	after: SuggestionFieldId;
	afterLabel: string;
	/** What the re-run read. True whatever happened to the trigger field. */
	source: string;
}

const ARRIVAL: Readonly<Partial<Record<SuggestionFieldId, ArrivalRule>>> = {
	components: { after: "parent", afterLabel: "Parent", source: "from PAY-100 siblings" },
	fixVersion: { after: "dueDate", afterLabel: "Due date", source: "from the SDK v2.0 GA release" },
};

/**
 * Why a follow-up suggestion appeared on a later run. It credits the trigger field only once that field is really
 * set; while the field is pending or dismissed the line falls back to what the re-run read, which is always true.
 * First-run suggestions return undefined because they came from the empty work item itself.
 */
export function arrivalLine(id: SuggestionFieldId, decisionOf: (id: SuggestionFieldId) => SuggestionDecision): string | undefined {
	const rule = ARRIVAL[id];
	if (!rule) return undefined;
	return decisionOf(rule.after) === "accepted" ? `Found after ${rule.afterLabel} was set` : `Found on re-run · ${rule.source}`;
}
