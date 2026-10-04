"use client"

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import {
	BotIcon,
	CheckCircleIcon,
	CircleIcon,
	ClockIcon,
} from "@/components/ui/vpk-icons"

import {
	Agent,
	AgentContent,
	AgentHeader,
	AgentInstructions,
} from "@/components/blocks/agent"
import {
	Plan,
	PlanAvatar,
	PlanContent,
	PlanDescription,
	PlanHeader,
	PlanTitle,
} from "@/components/ui-custom/plan"
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ui-custom/tool"
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity"
import {
	Conversation,
	ConversationContent,
} from "@/components/ui-custom/conversation"
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ui-custom/message"
import {
	Confirmation,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@/components/ui-custom/confirmation"
import {
	PromptInput,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@/components/ui-custom/prompt-input"
import { Badge } from "@/components/ui/badge"
import { MOCK_AGENT_CONFIG, MOCK_PLAN_STEPS, MOCK_WORKFLOW_MESSAGES } from "./data/mock-data"

const stepIcons = {
	completed: <CheckCircleIcon className="size-4 text-green-600" />,
	"in-progress": <ClockIcon className="size-4 animate-pulse text-blue-600" />,
	pending: <CircleIcon className="size-4 text-muted-foreground" />,
}

export default function AIWorkflowBlock() {
	return (
		<div className="flex h-[600px] overflow-hidden rounded-lg border bg-background">
			{/* Agent config sidebar */}
			<div className="flex w-72 flex-col border-r">
				<div className="border-b px-4 py-3">
					<h3 className="font-semibold text-sm">Agent Configuration</h3>
				</div>
				<div className="flex-1 overflow-auto p-3">
					<Agent>
						<AgentHeader name={MOCK_AGENT_CONFIG.name} model={MOCK_AGENT_CONFIG.model} />
						<AgentContent>
							<AgentInstructions>{MOCK_AGENT_CONFIG.instructions}</AgentInstructions>

							{/* Tools list */}
							<div className="space-y-2">
								<span className="font-medium text-muted-foreground text-sm">Tools</span>
								<div className="space-y-1">
									{MOCK_AGENT_CONFIG.tools.map((tool) => (
										<div
											key={tool.name}
											className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
										>
											<BotIcon className="size-3.5 text-muted-foreground" />
											<span className="font-mono text-xs">{tool.name}</span>
										</div>
									))}
								</div>
							</div>
						</AgentContent>
					</Agent>
				</div>
			</div>

			{/* Main conversation area */}
			<div className="flex flex-1 flex-col">
				<div className="border-b px-4 py-3">
					<div className="flex items-center gap-2">
						<h3 className="font-semibold text-sm">Workflow</h3>
						<Badge variant="neutral" className="text-xs">3 steps completed</Badge>
					</div>
				</div>

				<Conversation className="flex-1">
					<ConversationContent className="gap-6">
						{MOCK_WORKFLOW_MESSAGES.map((msg) => (
							<Message key={msg.id} from={msg.role}>
								<MessageContent>
									{/* Plan rendering */}
									{msg.plan ? <Plan defaultOpen className="mb-4">
											<PlanHeader
												leading={<PlanAvatar visualIdentity={resolvePlanVisualIdentity(msg.plan.title)} />}
												title={<PlanTitle>{msg.plan.title}</PlanTitle>}
												description={<PlanDescription>{msg.plan.description}</PlanDescription>}
											/>
											<PlanContent>
												<div className="space-y-2">
													{MOCK_PLAN_STEPS.steps.map((step) => (
														<div key={step.label} className="flex items-center gap-2 text-sm">
															{stepIcons[step.status]}
															<span className={step.status === "pending" ? "text-muted-foreground" : ""}>
																{step.label}
															</span>
														</div>
													))}
												</div>
											</PlanContent>
										</Plan> : null}

									{/* Tool call rendering */}
									{msg.toolCalls ? msg.toolCalls.map((tc, i) => (
										<Tool key={`${msg.id}-tool-${i}`} defaultOpen={false}>
											<ToolHeader
												title={tc.name}
												type="tool-invocation"
												state={tc.state}
											/>
											<ToolContent>
												<ToolInput input={tc.input} />
												<ToolOutput output={tc.output} errorText={undefined} />
											</ToolContent>
										</Tool>
									)) : null}

									{/* Message content */}
									{msg.content ? <MessageResponse>{msg.content}</MessageResponse> : null}

									{/* Confirmation rendering */}
									{msg.confirmation ? <Confirmation
											state={msg.confirmation.state}
											approval={{ id: msg.confirmation.id }}
										>
											<ConfirmationTitle>{msg.confirmation.message}</ConfirmationTitle>
											<ConfirmationRequest>
												<ConfirmationActions>
													<ConfirmationAction variant="outline">Deny</ConfirmationAction>
													<ConfirmationAction>Approve</ConfirmationAction>
												</ConfirmationActions>
											</ConfirmationRequest>
										</Confirmation> : null}
								</MessageContent>
							</Message>
						))}
					</ConversationContent>
				</Conversation>

				<div className="border-t p-4">
					<PromptInput
						onSubmit={() => {}}
						className="rounded-lg border bg-background shadow-sm"
					>
						<PromptInputTextarea placeholder="Give instructions to the agent..." />
						<PromptInputFooter>
							<div />
							<PromptInputSubmit />
						</PromptInputFooter>
					</PromptInput>
				</div>
			</div>
		</div>
	)
}
