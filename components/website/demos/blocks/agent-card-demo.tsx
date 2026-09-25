"use client";

import { AgentCard } from "@/components/blocks/agent-card";

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

const DEFAULT_EXPERIMENTAL_AGENT = {
	avatarSrc: "/avatar-agent/teamwork-agents/decision-director.svg",
	description: "Review DACI decisions, close context gaps, and suggest the next decision-ready resources.",
	label: "Teamwork",
	name: "Decision Director",
} as const;

const EXPERIMENTAL_AGENT_VARIANTS = [
	DEFAULT_EXPERIMENTAL_AGENT,
	{
		avatarSrc: "/avatar-agent/dev-agents/code-reviewer.svg",
		description: "Review code changes, surface blockers, and suggest the next implementation-ready fixes.",
		label: "Dev",
		name: "Code Reviewer",
	},
	{
		avatarSrc: "/avatar-agent/product-agents/feedback-analyzer.svg",
		description: "Cluster feedback, size opportunities, and identify the strongest product next steps.",
		label: "Product",
		name: "Feedback Analyzer",
	},
	{
		avatarSrc: "/avatar-agent/service-agents/service-triage.svg",
		description: "Triage requests, route urgent issues, and recommend the next support-ready action.",
		label: "Service",
		name: "Service Triage",
	},
	{
		avatarSrc: "/avatar-agent/strategy-agents/strategic-insight.svg",
		description: "Synthesize market context, compare options, and shape the next strategic recommendation.",
		label: "Strategy",
		name: "Strategic Insight",
	},
] as const;

function ExperimentalAgentCard({
	agent,
	variant = "experimental-template",
}: Readonly<{
	agent: (typeof EXPERIMENTAL_AGENT_VARIANTS)[number];
	variant?: "experimental-template" | "experimental-profile";
}>) {
	return (
		<AgentCard
			attributionKind="company"
			avatarSrc={agent.avatarSrc}
			capabilities={CAPABILITIES}
			className="max-h-[423px] w-full max-w-[376px]"
			collaborators={variant === "experimental-template" ? COLLABORATORS : undefined}
			description={agent.description}
			name={agent.name}
			onSelect={() => {}}
			onMoreActions={variant === "experimental-profile" ? () => {} : undefined}
			publisher="Atlassian"
			skills={SKILLS}
			sources={SOURCES}
			stats={[
				{ label: "Remix", value: "1.8K" },
				{ label: "Last update", value: "2 weeks ago" },
			]}
			variant={variant}
			verified
		/>
	);
}

/** Expanded variant — cover banner, byline, inline stats, and template detail sections. */
export function AgentCardDemoExpanded() {
	return (
		<div className="flex w-full justify-center p-6">
			<AgentCard
				attributionKind="company"
				avatarSrc="/avatar-agent/teamwork-agents/decision-director.svg"
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
		</div>
	);
}

/** Experimental template variant — banner-first layout with inline metrics and template-building sections. */
export function AgentCardDemoExperimentalTemplate() {
	return (
		<div className="grid w-full grid-cols-[repeat(auto-fit,minmax(320px,376px))] justify-center gap-6 p-6">
			{EXPERIMENTAL_AGENT_VARIANTS.map((agent) => (
				<div className="flex min-w-0 flex-col gap-3" key={agent.label}>
					<span className="text-xs font-medium text-text-subtlest">{agent.label}</span>
					<ExperimentalAgentCard agent={agent} />
				</div>
			))}
		</div>
	);
}

/** Experimental profile variant — built-agent profile summary without template-building sections. */
export function AgentCardDemoExperimentalProfile() {
	return (
		<div className="flex w-full justify-center p-6">
			<ExperimentalAgentCard agent={DEFAULT_EXPERIMENTAL_AGENT} variant="experimental-profile" />
		</div>
	);
}

/** Simple variant — flat icon + name header, description, "Works with", "Skills". */
export function AgentCardDemoSimple() {
	return (
		<div className="flex w-full justify-center p-6">
			<AgentCard
				className="w-[420px]"
				collaborators={COLLABORATORS}
				description="Review DACI decisions, close context gaps, and suggest the next decision-ready resources."
				iconSrc="/avatar-agent/teamwork-agents/decision-director.svg"
				name="Decision Director"
				onSelect={() => {}}
				publisher="Atlassian"
				skills={SKILLS}
				sources={SOURCES}
				variant="template"
			/>
		</div>
	);
}

/** Default preview — both variants side by side. */
export default function AgentCardDemo(): React.ReactElement {
	return (
		<div className="flex w-full flex-wrap items-start justify-center gap-10 p-6">
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium text-text-subtlest">Expanded</span>
				<AgentCardDemoExpanded />
			</div>
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium text-text-subtlest">Experimental (template)</span>
				<div className="flex w-full justify-center p-6">
					<ExperimentalAgentCard agent={DEFAULT_EXPERIMENTAL_AGENT} />
				</div>
			</div>
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium text-text-subtlest">Experimental (profile)</span>
				<AgentCardDemoExperimentalProfile />
			</div>
			<div className="flex flex-col gap-3">
				<span className="text-xs font-medium text-text-subtlest">Simple</span>
				<AgentCardDemoSimple />
			</div>
		</div>
	);
}
