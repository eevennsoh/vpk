"use client";

import { AgentCard } from "@/components/blocks/agent-card/components/agent-card";

const SOURCES = [
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "jira-product-discovery", label: "Jira Product Discovery", provider: "jira-product-discovery" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "jira-service-management", label: "Jira Service Management", provider: "jira-service-management" },
	{ id: "teams", label: "Teams", provider: "teams" },
	{ id: "salesforce", label: "Salesforce", provider: "salesforce" },
	{ id: "loom", label: "Loom", provider: "loom" },
] as const;

const SKILLS = [
	{ color: "teamwork", label: "stakeholder-input" },
	{ color: "product", label: "opportunity-sizing" },
	{ color: "software", label: "option-mapping" },
	{ color: "service", label: "risk-spotting" },
	{ label: "context-gap-analysis" },
	{ label: "decision-logging" },
] as const;

const CAPABILITIES = [
	{ icon: "review", label: "Review DACI decisions, close context gaps, and suggest resources" },
	{ icon: "target", label: "Size opportunities against current priorities" },
	{ icon: "list", label: "Map options and trade-offs for each decision" },
	{ icon: "alert", label: "Spot risks before they block a decision" },
	{ icon: "people", label: "Pull the right stakeholders into the conversation" },
] as const;

const COLLABORATORS = [
	{ name: "Michael Chu", src: "/avatar-human/michael-chu.png" },
	{ name: "Melanie Lee", src: "/avatar-human/melanie-lee.png" },
	{ name: "David Hsieh", src: "/avatar-human/david-hsieh.png" },
	{ name: "Aoife Burke", src: "/avatar-human/aoife-burke.png" },
] as const;

function DemoSection({
	label,
	children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
	return (
		<div className="flex flex-col gap-3">
			<span className="text-xs font-medium text-text-subtlest">{label}</span>
			{children}
		</div>
	);
}

export default function AgentCardPage(): React.ReactElement {
	return (
		<div className="flex h-full w-full flex-wrap items-start justify-center gap-10 p-6">
			<DemoSection label="Expanded">
				<AgentCard
					attributionKind="company"
					avatarSrc="/avatar-agent-new/blue/decision-director.svg"
					capabilities={CAPABILITIES}
					className="w-full max-w-[376px]"
					collaborators={COLLABORATORS}
					description="Review DACI decisions, close context gaps, and suggest the next decision-ready resources."
					name="Decision Director"
					onSelect={() => {}}
					publisher="Atlassian"
					skills={SKILLS}
					sources={SOURCES}
					stats={[
						{ label: "Remix", value: "1.8K" },
						{ label: "Last update", value: "2 weeks ago" },
					]}
					variant="expanded"
					verified
				/>
			</DemoSection>

			<DemoSection label="Experimental (template)">
				<AgentCard
					attributionKind="company"
					avatarSrc="/avatar-agent-new/blue/decision-director.svg"
					capabilities={CAPABILITIES}
					className="max-h-[423px] w-[376px]"
					collaborators={COLLABORATORS}
					description="Review DACI decisions, close context gaps, and suggest the next decision-ready resources."
					name="Decision Director"
					onSelect={() => {}}
					publisher="Atlassian"
					skills={SKILLS}
					sources={SOURCES}
					stats={[
						{ label: "Users", value: "648" },
						{ label: "Reactions", value: "1.2K" },
					]}
					variant="experimental-template"
					verified
				/>
			</DemoSection>

			<DemoSection label="Experimental (profile)">
				<AgentCard
					attributionKind="company"
					avatarSrc="/avatar-agent-new/blue/decision-director.svg"
					className="w-[376px]"
					description="Review DACI decisions, close context gaps, and suggest the next decision-ready resources."
					name="Decision Director"
					onSelect={() => {}}
					publisher="Atlassian"
					stats={[
						{ label: "Users", value: "648" },
						{ label: "Reactions", value: "1.2K" },
					]}
					variant="experimental-profile"
					verified
				/>
			</DemoSection>

			<DemoSection label="Simple">
				<AgentCard
					className="w-[420px]"
					collaborators={COLLABORATORS}
					description="Review DACI decisions, close context gaps, and suggest the next decision-ready resources."
					iconSrc="/avatar-agent-new/blue/decision-director.svg"
					name="Decision Director"
					onSelect={() => {}}
					publisher="Atlassian"
					skills={SKILLS}
					sources={SOURCES}
					variant="template"
				/>
			</DemoSection>
		</div>
	);
}

export { AgentCard } from "@/components/blocks/agent-card/components/agent-card";
export type { AgentCardProps } from "@/components/blocks/agent-card/components/agent-card";
