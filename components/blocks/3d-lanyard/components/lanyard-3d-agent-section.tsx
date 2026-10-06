"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CardTheme } from "../renderer/types";
import type { Lanyard3DAgent } from "../data";
import { Lanyard3DAgentBadge } from "./lanyard-3d-agent-badge";
import { Lanyard3DCardPreview } from "./lanyard-3d-card-preview";

interface Lanyard3DAgentSectionProps {
	readonly agents: readonly Lanyard3DAgent[];
	readonly agent: Lanyard3DAgent;
	readonly theme: CardTheme;
	readonly onSelect: (id: string) => void;
	readonly onChange: (patch: Partial<Omit<Lanyard3DAgent, "id" | "asset">>) => void;
	readonly onThemeChange: (theme: CardTheme) => void;
}

export function Lanyard3DAgentSection({ agents, agent, theme, onSelect, onChange, onThemeChange }: Readonly<Lanyard3DAgentSectionProps>) {
	const id = useId();

	return (
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3" data-slot="lanyard-3d-agent-section">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-semibold text-text" id={`${id}-heading`}>Agent</h3>
				<Label className="font-normal text-text-subtle">
					Dark card
					<Switch checked={theme === "dark"} label="Dark agent card" onCheckedChange={(checked) => onThemeChange(checked ? "dark" : "light")} />
				</Label>
			</div>
			<ToggleGroup
				aria-label="Choose an agent"
				className="w-full"
				onValueChange={(next) => { if (next[0]) onSelect(next[0]); }}
				spacing={2}
				value={[agent.id]}
				variant="outline"
			>
				{agents.map((item) => (
					<ToggleGroupItem aria-label={item.name} className="h-auto flex-1 flex-col gap-1 px-1 py-2" key={item.id} value={item.id}>
						<Lanyard3DAgentBadge agent={item} width={34} />
						<span className="max-w-full truncate text-xs">{item.name.split(" ").at(-1)}</span>
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<div className="flex items-center gap-3 rounded-lg bg-bg-neutral-subtle p-3">
				<Lanyard3DCardPreview agent={agent} theme={theme} />
				<p className="text-xs text-text-subtle">Back card. It swings out from behind the front card, then settles behind it.</p>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-name`}>Name</Label>
				<Input id={`${id}-name`} maxLength={40} onChange={(event) => onChange({ name: event.target.value })} spellCheck={false} value={agent.name} />
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-provider`}>Provider</Label>
				<Input id={`${id}-provider`} maxLength={40} onChange={(event) => onChange({ role: event.target.value })} spellCheck={false} value={agent.role} />
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-description`}>Description</Label>
				<Textarea id={`${id}-description`} maxLength={140} onChange={(event) => onChange({ description: event.target.value })} rows={3} spellCheck={false} value={agent.description} />
			</div>
		</section>
	);
}
