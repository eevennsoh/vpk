"use client";

import { useState } from "react";
import { AgentLanyard } from "@/components/blocks/agent-lanyard";
import { InlineAgentSelector } from "@/components/blocks/agent-selector";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { recommendationParagraphs, recommendationPickerAgents, recommendationSample as sample } from "@/app/sandbox/agent-selector-canvas/recommendation-data";

const layouts = {
	stack: { name: "Inset divider", className: "w-full border-t border-border pt-3" },
	inset: { name: "Inset panel", className: "w-full rounded-lg bg-bg-discovery p-3" },
	footer: { name: "Full-width footer", className: "-mx-4 -mb-4 w-[calc(100%+2rem)] shrink-0 rounded-b-xl border-t border-border bg-surface-sunken px-4 py-3" },
	perforated: { name: "Perforated seam", className: "" },
} as const;

type RecommendationLayout = keyof typeof layouts;

function RecommendationLayoutPreview({ layout }: Readonly<{ layout: RecommendationLayout }>) {
	const [selection, setSelection] = useState("");
	const treatment = layouts[layout];
	return (
		<section aria-label={`Recommendation layout · ${treatment.name}`} data-recommendation-layout-preview={layout} className="text-text">
			<div className="mb-3 text-xs leading-4">
				<h2 className="font-medium">{sample.workItem} · {sample.title}</h2>
				<p className="mt-1 text-text-subtlest" data-sample-qualification>{sample.qualification}</p>
			</div>
			<div className="flex items-start gap-4">
				<div className="w-[252px] shrink-0">
					<p className="mb-2 text-xs text-text-subtle">Hover preview · held open</p>
					{layout === "perforated" ? <AgentLanyard variant="recommended" agent={sample.agent} recommendationReason={recommendationParagraphs["margin-note"]} perspectiveTilt={false} animateGrid={false} /> : <div className="rounded-xl" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<AgentLanyard
							agent={sample.agent}
							showDescription
							perspectiveTilt={false}
							animateGrid={false}
							footer={
								<div className={cn(treatment.className)} data-recommendation-layout={layout}>
									<h4 className="mb-1 text-xs font-medium">Why recommended</h4>
									<p className="text-xs leading-5 text-text-subtle">{recommendationParagraphs["margin-note"]}</p>
								</div>
							}
							className="rounded-xl [&_[data-slot=agent-lanyard-surface]]:min-h-0 [&_[data-slot=agent-lanyard-surface]]:border-0 [&_[data-slot=agent-lanyard-surface]]:shadow-none [&_[data-slot=agent-lanyard-surface]_p]:min-h-0 [&_[data-slot=agent-lanyard-appstack]]:mt-0 [&_[data-slot=agent-lanyard-appstack]]:h-auto [&_[data-slot=agent-lanyard-appstack]]:items-start"
						/>
					</div>}
				</div>
				<div className="w-80 shrink-0">
					<p className="mb-2 text-xs text-text-subtle"><span aria-hidden="true">← </span>Claude (Recommended)</p>
					<div className="rounded-xl" style={{ boxShadow: token("elevation.shadow.overlay") }}>
						<InlineAgentSelector
							agents={recommendationPickerAgents}
							softwareAgentIds={recommendationPickerAgents.map((agent) => agent.id)}
							recommendedAgentId={sample.agent.id}
							showFavorites={false}
							softwareHeading={`Other sample agents · ${treatment.name}`}
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

export function InsetDividerLayoutPreview() { return <RecommendationLayoutPreview layout="stack" />; }
export function InsetPanelLayoutPreview() { return <RecommendationLayoutPreview layout="inset" />; }
export function FullWidthFooterLayoutPreview() { return <RecommendationLayoutPreview layout="footer" />; }
export function PerforatedSeamLayoutPreview() { return <RecommendationLayoutPreview layout="perforated" />; }
