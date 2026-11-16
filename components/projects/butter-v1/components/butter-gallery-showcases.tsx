"use client";

import dynamic from "next/dynamic";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const AgentSessionPage = dynamic(() => import("@/components/blocks/agent-session/page"));
const JiraIssuePage = dynamic(() => import("@/components/blocks/jira-issue/page"));

export const BUTTER_AGENT_SESSION_FORMS = [
	{ value: "local-short", label: "Local · Short", host: "local", density: "short" },
	{ value: "local-long", label: "Local · Long", host: "local", density: "long" },
	{ value: "cloud-short", label: "Cloud · Short", host: "cloud", density: "short" },
	{ value: "cloud-long", label: "Cloud · Long", host: "cloud", density: "long" },
] as const;

export type ButterAgentSessionForm = (typeof BUTTER_AGENT_SESSION_FORMS)[number];

export const DEFAULT_BUTTER_AGENT_SESSION_FORM: ButterAgentSessionForm = BUTTER_AGENT_SESSION_FORMS[0];

export function ButterAgentSessionFormControls({ form, onFormChange }: Readonly<{
	form: ButterAgentSessionForm;
	onFormChange: (form: ButterAgentSessionForm) => void;
}>) {
	return (
		<ToggleGroup aria-label="Agent session form" onValueChange={(values) => { const next = BUTTER_AGENT_SESSION_FORMS.find((candidate) => candidate.value === values[0]); if (next) onFormChange(next); }} size="sm" value={[form.value]} variant="outline">
			{BUTTER_AGENT_SESSION_FORMS.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
		</ToggleGroup>
	);
}

export function ButterGalleryAgentSessions({ form, galleryOpen }: Readonly<{ form: ButterAgentSessionForm; galleryOpen: boolean }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex flex-col overflow-y-auto", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div key={form.value} className="pointer-events-auto my-auto flex w-full [&>div]:h-auto [&>div]:bg-transparent">
				<h1 className="sr-only">Agent sessions</h1>
				<AgentSessionPage density={form.density} host={form.host} />
			</div>
		</div>
	);
}

export function ButterGalleryBoardCard({ galleryOpen }: Readonly<{ galleryOpen: boolean }>) {
	return (
		<div className={cn("pointer-events-none absolute inset-x-0 top-12 flex justify-center overflow-y-auto px-4", galleryOpen ? "bottom-56" : "bottom-0")}>
			<div className="pointer-events-auto my-auto flex w-full max-w-3xl justify-center">
				<h1 className="sr-only">Board card</h1>
				<JiraIssuePage variant="project-butter" />
			</div>
		</div>
	);
}
