"use client";

import { useState } from "react";
import { AgentLanyard } from "@/components/blocks/agent-lanyard";
import { InlineAgentSelector } from "@/components/blocks/agent-selector";
import { token } from "@/lib/tokens";
import { recommendationConceptNames, recommendationPickerAgents, recommendationSample as sample, type RecommendationConcept } from "@/app/sandbox/agent-selector-canvas/recommendation-data";
import { RecommendationRationale } from "@/app/sandbox/agent-selector-canvas/recommendation-rationale";

function RecommendationPreview({ concept }: Readonly<{ concept: RecommendationConcept }>) {
	const conceptName = recommendationConceptNames[concept];
	const [selection, setSelection] = useState("");
	return (
		<section aria-label={`Recommendation lanyard · ${conceptName}`} data-recommendation-concept={concept} className="text-text">
			<div className="mb-4">
				<p className="mb-1 text-xs font-medium text-text-subtlest">Sample work item · {sample.workItem}</p>
				<h2 className="text-sm font-semibold">{sample.title}</h2>
				<p className="mt-1 text-xs text-text-subtle">{sample.brief}</p>
				<p className="mt-1 text-xs leading-4 text-text-subtlest" data-sample-qualification>{sample.qualification}</p>
			</div>
			<div className="flex items-start gap-4">
				<div className="w-[252px] shrink-0">
					<p className="mb-2 text-xs text-text-subtle">Hover preview · held open to compare</p>
					<div className="rounded-xl" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<AgentLanyard
							agent={sample.agent}
							perspectiveTilt={false}
							animateGrid={false}
							showDescription
							footer={<RecommendationRationale concept={concept} />}
							// Canvas-only natural-height footer. Match Butter's borderless hover surface.
							className="rounded-xl [&_[data-slot=agent-lanyard-surface]]:min-h-0 [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none [&_[data-slot=agent-lanyard-surface]_p]:min-h-0 [&_[data-slot=agent-lanyard-appstack]]:h-auto [&_[data-slot=agent-lanyard-appstack]]:items-start"
						/>
					</div>
				</div>
				<div className="w-80 shrink-0">
					<p className="mb-2 text-xs text-text-subtle"><span aria-hidden="true">← </span>From the first Recommended row</p>
					<div className="rounded-xl" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<InlineAgentSelector
							agents={recommendationPickerAgents}
							softwareAgentIds={recommendationPickerAgents.map((agent) => agent.id)}
							recommendedAgentId={sample.agent.id}
							showFavorites={false}
							softwareHeading={`Other sample agents · ${conceptName}`}
							compact
							getActions={(agent) => [{ id: "preview", label: "Select in preview", icon: null, onSelect: () => setSelection(`Selected ${agent.name} · Local preview only`) }]}
							status={selection}
						/>
					</div>
					<p className="mt-3 text-xs leading-4 text-text-subtlest" data-preview-selection>{selection || "Local selection only. No sessions are started."}</p>
				</div>
			</div>
		</section>
	);
}

export function MarginNotePreview() { return <RecommendationPreview concept="margin-note" />; }
export function EvidenceLedgerPreview() { return <RecommendationPreview concept="evidence-ledger" />; }
export function ScopeMapPreview() { return <RecommendationPreview concept="scope-map" />; }
export function WorkPlanPreview() { return <RecommendationPreview concept="work-plan" />; }
