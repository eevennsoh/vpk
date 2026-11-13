"use client";

import { useId, useState } from "react";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dropdownStyles, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { isSessionSample, sessionSamples, type SessionSample } from "@/app/sandbox/agent-selector-canvas/teammate-session-data";
import { TeammateSessionDisclosure, type TeammateApproach } from "@/app/sandbox/agent-selector-canvas/teammate-session-disclosure";

const cannotResume = () => false;

function SessionCards({ items, selected, onSelect }: Readonly<{
	items: readonly AgentSessionItem[];
	selected: string | null;
	onSelect: (item: AgentSessionItem) => void;
}>) {
	return (
		<ul className="flex w-full flex-col gap-0">
			{items.map((item) => (
				<AgentSessionCard
					key={item.id}
					item={item}
					density="long"
					hoverTone="menu"
					padding="compact"
					localSessionAction="view"
					isResumable={cannotResume}
					isSelected={selected === item.id}
					onView={item.role === "viewer" ? undefined : () => onSelect(item)}
					showLifecycleLabel={false}
					showMoreMenu={false}
					animateLayout={false}
				/>
			))}
		</ul>
	);
}

function SessionMenu({ approach, items }: Readonly<{ approach: TeammateApproach; items: readonly AgentSessionItem[] }>) {
	const [selected, setSelected] = useState<AgentSessionItem | null>(null);
	const personal = items.filter((item) => item.role !== "viewer");
	const teammates = items.filter((item) => item.role === "viewer");
	const cards = (sessions: readonly AgentSessionItem[]) => <SessionCards items={sessions} selected={selected?.id ?? null} onSelect={setSelected} />;

	return (
		<TooltipProvider>
			<div role="group" aria-label="Project Butter sessions" className={cn("rounded-lg bg-surface-overlay text-text", dropdownStyles.padding)} style={{ boxShadow: token("elevation.shadow.overlay") }}>
				{personal.length ? cards(personal) : null}
				{teammates.length ? (
					<>
						{personal.length ? <DropdownMenuSeparator /> : null}
						<TeammateSessionDisclosure approach={approach} items={teammates}>
							{cards(teammates)}
						</TeammateSessionDisclosure>
					</>
				) : null}
				{items.length === 0 ? <p className="px-3 py-3 text-sm text-text-subtle">No sessions yet.</p> : null}
			</div>
			<p role="status" aria-label="Preview selection" className="mt-3 text-xs text-text-subtle">{selected ? `Selected “${selected.title}” · Preview only` : ""}</p>
		</TooltipProvider>
	);
}

export function TeammateSessionsPreview({ approach }: Readonly<{ approach: TeammateApproach }>) {
	const [sample, setSample] = useState<SessionSample>("mixed");
	const sampleId = useId();
	return (
		<div>
			<SessionMenu key={sample} approach={approach} items={sessionSamples[sample].items} />
			<div className="mt-3 flex items-center gap-2 text-xs text-text-subtle">
				<label htmlFor={sampleId} className="shrink-0">Sample</label>
				<select id={sampleId} value={sample} onChange={(event) => { if (isSessionSample(event.target.value)) setSample(event.target.value); }} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
					{Object.entries(sessionSamples).map(([value, fixture]) => <option key={value} value={value}>{fixture.label}</option>)}
				</select>
			</div>
		</div>
	);
}

export function QuietDisclosurePreview() { return <TeammateSessionsPreview approach="quiet" />; }
export function PeopleFoldPreview() { return <TeammateSessionsPreview approach="people" />; }
export function ActivityDigestPreview() { return <TeammateSessionsPreview approach="activity" />; }
