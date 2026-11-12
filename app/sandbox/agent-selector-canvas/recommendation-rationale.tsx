import { recommendationParagraphs, type RecommendationConcept } from "@/app/sandbox/agent-selector-canvas/recommendation-data";

export function RecommendationRationale({ concept }: Readonly<{ concept: RecommendationConcept }>) {
	return (
		<div className="w-full" data-recommendation-rationale={concept}>
			<h4 className="mb-1 text-xs font-medium text-text">Why recommended</h4>
			<p className="text-xs leading-5 text-text-subtle">{recommendationParagraphs[concept]}</p>
		</div>
	);
}
