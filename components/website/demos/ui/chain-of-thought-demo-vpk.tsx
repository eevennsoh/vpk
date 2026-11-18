"use client";

import Image from "next/image";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ImageIcon from "@atlaskit/icon/core/image";
import SearchIcon from "@atlaskit/icon/core/search";

import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtImage,
	ChainOfThoughtScenario,
	ChainOfThoughtSearchResult,
	ChainOfThoughtSearchResults,
	ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ui/tool";
import { TwgTool, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { renderResolvedToolIcon, resolveToolIcon } from "@/components/projects/shared/lib/tool-icon-resolver";

import { ChainOfThoughtDemoFrame } from "./chain-of-thought-demo-frame";

const PROFILE_SOURCES = [
	"https://www.x.com/haydenbleasel",
	"https://www.instagram.com/haydenbleasel",
	"https://www.github.com/haydenbleasel",
] as const;

const RECENT_WORK_SOURCES = [
	"https://www.github.com/haydenbleasel",
	"https://www.dribbble.com/haydenbleasel",
] as const;

const TWG_TOOL_SOURCES = [
	{ id: "twg", label: "Teamwork Graph", provider: "twg" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "figma", label: "Figma", provider: "twg", name: "figma" },
] satisfies ReadonlyArray<TwgToolSource>;

const toHostname = (url: string) => new URL(url).hostname;

export function ChainOfThoughtDemoPreload() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought className="w-full max-w-2xl">
				<ChainOfThoughtHeader showChevron={false} state="preload" shimmer />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Searching the web"
						description="Searching public profiles for Hayden Bleasel"
						status="pending"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoThinking() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-2xl">
				<ChainOfThoughtHeader state="thinking" />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Searching the web"
						description="Searching public profiles for Hayden Bleasel"
						status="complete"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{PROFILE_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={ImageIcon}
						label="Selecting profile image"
						description="Found a likely profile image from the source set"
						status="complete"
						collapsible
					>
						<ChainOfThoughtImage caption="Public profile image selected from matched sources.">
							<Image
								alt="Profile image result"
								className="h-40 w-40 rounded-md border border-border object-cover"
								height={160}
								src="/avatar-human/anthony-chen.png"
								width={160}
							/>
						</ChainOfThoughtImage>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={AiSparkleIcon}
						label="Synthesizing summary"
						description="Synthesizing a short profile summary from validated signals"
						status="complete"
					/>

					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Checking work updates"
						description="Searching GitHub and Dribbble for recent work updates"
						status="active"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{RECENT_WORK_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoCompleted() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought className="w-full max-w-2xl">
				<ChainOfThoughtHeader state="completed" duration={5} />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Searching the web"
						description="Searching public profiles for Hayden Bleasel"
						status="complete"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{PROFILE_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={ImageIcon}
						label="Selecting profile image"
						description="Found a likely profile image from the source set"
						status="complete"
						collapsible
					>
						<ChainOfThoughtImage caption="Public profile image selected from matched sources.">
							<Image
								alt="Profile image result"
								className="h-40 w-40 rounded-md border border-border object-cover"
								height={160}
								src="/avatar-human/anthony-chen.png"
								width={160}
							/>
						</ChainOfThoughtImage>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={AiSparkleIcon}
						label="Synthesizing summary"
						description="Synthesizing a short profile summary from validated signals"
						status="complete"
					/>

					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Checking work updates"
						description="Checked recent work updates across matched sources"
						status="complete"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{RECENT_WORK_SOURCES.map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>

					<ChainOfThoughtStep
						icon={CheckCircleIcon}
						label="Done"
						description="Reasoning trace complete"
						status="complete"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoStatusVariants() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-xl">
				<ChainOfThoughtHeader>Status progression</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep label="Collecting sources" description="Collected source pages" status="complete" />
					<ChainOfThoughtStep label="Cross-checking dates" description="Cross-checking publication dates" status="active" />
					<ChainOfThoughtStep label="Drafting answer" description="Drafting the final answer" status="pending" />
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoSearchResults() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-xl">
				<ChainOfThoughtHeader>Search result chips</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Evaluating sources"
						description="Ranking sources by recency and authority"
						status="active"
						collapsible
					>
						<ChainOfThoughtSearchResults>
							{[
								"https://www.atlassian.com",
								"https://www.vercel.com",
								"https://www.github.com",
								"https://www.npmjs.com",
							].map((website) => (
								<ChainOfThoughtSearchResult key={website}>
									{toHostname(website)}
								</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoImageStep() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-xl">
				<ChainOfThoughtHeader>Image evidence</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={ImageIcon}
						label="Attaching image evidence"
						description="Attached visual evidence for reasoning context"
						status="complete"
						collapsible
					>
						<ChainOfThoughtImage caption="Image context included before summary generation.">
							<Image
								alt="Reasoning evidence image"
								className="h-40 w-40 rounded-md border border-border object-cover"
								height={160}
								src="/avatar-human/priya-hansra.png"
								width={160}
							/>
						</ChainOfThoughtImage>
					</ChainOfThoughtStep>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoStudioAgentGenerationFlow() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				state="thinking"
				steps={[
					{
						id: "brief",
						icon: SearchIcon,
						label: "Reading agent brief",
						description: "Identified the target Jira project, RFP workflow, and reusable response package outcome.",
						status: "complete",
					},
					{
						id: "clarification",
						icon: AiSparkleIcon,
						label: "Preparing clarification questions",
						description: "Checked whether the brief needs missing inputs before creating the agent.",
						status: "complete",
					},
					{
						id: "tools",
						icon: SearchIcon,
						label: "Selecting Jira and Confluence tools",
						description: "Mapped the agent to the apps, skills, and knowledge it needs for RFP work.",
						status: "complete",
						collapsible: true,
						children: (
							<ChainOfThoughtSearchResults>
								<ChainOfThoughtSearchResult>Jira</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Confluence</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Proposal library</ChainOfThoughtSearchResult>
							</ChainOfThoughtSearchResults>
						),
					},
					{
						id: "instructions",
						icon: AiSparkleIcon,
						label: "Drafting agent instructions",
						description: "Structuring role, workflow, evidence handling, reviewer plan, and guardrails.",
						status: "active",
					},
					{
						id: "save",
						icon: CheckCircleIcon,
						label: "Saving agent profile",
						description: "Queued until the generated instructions are ready.",
						status: "pending",
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoAutomationTriggerFlow() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				state="thinking"
				steps={[
					{
						id: "review",
						icon: SearchIcon,
						label: "Reviewing existing automations",
						description: "Keeping the Jira Drafting trigger unchanged before adding a separate Slack summary trigger.",
						status: "complete",
					},
					{
						id: "schedule",
						icon: AiSparkleIcon,
						label: "Configuring Friday schedule",
						description: "Setting the recurring cadence to every Friday at 9:00 AM.",
						status: "complete",
					},
					{
						id: "delivery",
						icon: AiSparkleIcon,
						label: "Setting Slack delivery",
						description: "Mapping the weekly RFP outcome summary to the leadership Slack channel.",
						status: "active",
						collapsible: true,
						defaultOpen: true,
						children: (
							<ChainOfThoughtSearchResults>
								<ChainOfThoughtSearchResult>Leadership Slack channel</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Weekly RFP outcomes</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Bid/no-bid decisions</ChainOfThoughtSearchResult>
							</ChainOfThoughtSearchResults>
						),
					},
					{
						id: "save",
						icon: CheckCircleIcon,
						label: "Saving automation trigger",
						description: "Queued until Slack delivery configuration is complete.",
						status: "pending",
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoResearchRetrievalFlow() {
	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				state="thinking"
				steps={[
					{
						id: "query",
						icon: SearchIcon,
						label: "Searching approved sources",
						description: "Looking across Confluence, Jira history, and proposal-library snippets.",
						status: "complete",
						collapsible: true,
						children: (
							<ChainOfThoughtSearchResults>
								<ChainOfThoughtSearchResult>Confluence</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Jira history</ChainOfThoughtSearchResult>
								<ChainOfThoughtSearchResult>Proposal library</ChainOfThoughtSearchResult>
							</ChainOfThoughtSearchResults>
						),
					},
					{
						id: "evaluate",
						icon: AiSparkleIcon,
						label: "Evaluating source fit",
						description: "Ranking snippets by approval status, freshness, and RFP relevance.",
						status: "active",
					},
					{
						id: "synthesize",
						icon: CheckCircleIcon,
						label: "Synthesizing recommendation",
						description: "Queued until the selected evidence has been checked.",
						status: "pending",
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoTwgToolCall() {
	const twgIcon = renderResolvedToolIcon(
		resolveToolIcon({ toolName: "twg.lookup_work_item_delivery_context" }),
		{ className: "size-4" },
	);

	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThought defaultOpen className="w-full max-w-2xl">
				<ChainOfThoughtHeader state="thinking" />
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						description="Reading the current work item"
						icon={SearchIcon}
						label="Reading the current work item"
						status="complete"
					/>
					<ChainOfThoughtStep
						collapsible
						defaultOpen
						description={null}
						iconRender={twgIcon}
						iconContainerStyle={{ marginTop: 6 }}
						label="Connecting work through Teamwork Graph"
						status="complete"
						headerRender={({ isOpen, toggleOpen }) => (
							<TwgTool
								chevronOpen={isOpen}
								description="Found 4 relevant delivery signals across Jira, Confluence, and Figma."
								onBannerClick={toggleOpen}
								showChevron
								showLoader={false}
								sources={TWG_TOOL_SOURCES}
								status="complete"
								title="Connecting work through Teamwork Graph"
							/>
						)}
					>
						<div className="space-y-1 text-xs leading-5 text-text-subtle">
							<p>Found a matching checkout-funnel research brief in Confluence.</p>
							<p>Linked the work item to the latest checkout flow in Figma.</p>
							<p>Resolved delivery ownership and implementation signals from Jira.</p>
						</div>
					</ChainOfThoughtStep>
					<ChainOfThoughtStep
						description="Checking product requirements"
						icon={SearchIcon}
						label="Checking product requirements"
						status="active"
					/>
					<ChainOfThoughtStep
						description="Queued until the connected delivery context is reviewed"
						icon={AiSparkleIcon}
						label="Drafting the improved description"
						status="pending"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</ChainOfThoughtDemoFrame>
	);
}

export function ChainOfThoughtDemoToolCallDetailsFlow() {
	const defineTriggerIcon = renderResolvedToolIcon(resolveToolIcon({ toolName: "agent.define_trigger" }), { className: "size-4 text-muted-foreground" });
	const saveProfileIcon = renderResolvedToolIcon(resolveToolIcon({ toolName: "studio.save_profile" }), { className: "size-4 text-muted-foreground" });

	return (
		<ChainOfThoughtDemoFrame>
			<ChainOfThoughtScenario
				className="w-full max-w-2xl"
				duration={7}
				state="completed"
				steps={[
					{
						id: "define-trigger",
						iconRender: defineTriggerIcon,
						label: "Defined scheduled trigger",
						description: null,
						status: "complete",
						collapsible: true,
						children: (
							<Tool>
								<ToolHeader
									leadingIcon={defineTriggerIcon}
									state="output-available"
									title="agent.define_trigger"
									toolName="agent.define_trigger"
									type="dynamic-tool"
								/>
								<ToolContent>
									<ToolInput
										codeBlockSize="sm"
										input={{
											automationName: "Send Weekly RFPs Summary",
											schedule: "Every Friday at 9:00 AM",
											scope: "All RFP outcomes",
										}}
									/>
									<ToolOutput
										codeBlockSize="sm"
										errorText={undefined}
										output={{
											status: "configured",
											triggerType: "scheduled",
										}}
									/>
								</ToolContent>
							</Tool>
						),
					},
					{
						id: "save-profile",
						iconRender: saveProfileIcon,
						label: "Saved automation trigger",
						description: null,
						status: "complete",
						collapsible: true,
						children: (
							<Tool>
								<ToolHeader
									leadingIcon={saveProfileIcon}
									state="output-available"
									title="studio.save_profile"
									toolName="studio.save_profile"
									type="dynamic-tool"
								/>
								<ToolContent>
									<ToolInput
										codeBlockSize="sm"
										input={{
											agent: "RFP Drafter",
											change: "append scheduled Slack trigger",
										}}
									/>
									<ToolOutput
										codeBlockSize="sm"
										errorText={undefined}
										output={undefined}
										outputPreview="Send Weekly RFPs Summary is ready to review in the config panel."
									/>
								</ToolContent>
							</Tool>
						),
					},
				]}
			/>
		</ChainOfThoughtDemoFrame>
	);
}
