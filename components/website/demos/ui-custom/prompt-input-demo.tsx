"use client";

import type { ReactNode } from "react";
import { Fragment, useCallback, useState } from "react";
import CustomizeMenu from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { DEFAULT_REASONING_OPTION_ID } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import {
	composerPromptInputClassName,
	composerTextareaClassName,
	composerUpwardShadow,
	floatingComposerTextareaClassName,
	textareaCSS,
} from "@/components/projects/shared/components/rovo-composer-styles";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import {
	RovoComposerActionButton,
	RovoComposerSendControls,
} from "@/components/projects/shared/components/rovo-composer-send-controls";
import { usePromptInputDemoVoice } from "@/components/website/demos/ui-custom/prompt-input-demo-voice";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDownIcon, PlusIcon } from "@/components/ui/vpk-icons";
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionAddScreenshot,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	PromptInputHeader,
	PromptInputPreferencesButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputAttachments,
} from "@/components/ui-custom/prompt-input";
import { cn } from "@/lib/utils";
import AddIcon from "@atlaskit/icon/core/add";
import LinkIcon from "@atlaskit/icon/core/link";
import MentionIcon from "@atlaskit/icon/core/mention";
import PageIcon from "@atlaskit/icon/core/page";
import ScreenIcon from "@atlaskit/icon/core/screen";
import UploadIcon from "@atlaskit/icon/core/upload";

interface DemoFrameProps {
	children: ReactNode;
	className?: string;
}

function DemoFrame({ children, className }: Readonly<DemoFrameProps>) {
	return (
		<div className={cn("mx-auto w-[680px] max-w-full", className)}>
			{children}
		</div>
	);
}

function DemoVoiceStatus({ message }: Readonly<{ message: string | null }>) {
	return message ? (
		<p aria-live="polite" className="mt-2 text-xs text-text-danger">
			{message}
		</p>
	) : null;
}

export default function PromptInputDemo() {
	return <PromptInputDemoDefault />;
}

// — shadcn Prompt Input: attachments, model and effort menus, round send —

const PROVIDERS = [
	{
		name: "OpenAI",
		models: [
			{ id: "gpt-5", name: "GPT-5" },
			{ id: "gpt-5-mini", name: "GPT-5 mini" },
		],
	},
	{
		name: "Anthropic",
		models: [
			{ id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
			{ id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
		],
	},
];

const MODELS = PROVIDERS.flatMap((provider) => provider.models);

const EFFORTS = [
	{ id: "low", name: "Low" },
	{ id: "medium", name: "Medium" },
	{ id: "high", name: "High" },
];

function AttachFilesButton() {
	const attachments = usePromptInputAttachments();
	return (
		<PromptInputButton
			aria-label="Attach files"
			className="rounded-full"
			onClick={attachments.openFileDialog}
			size="icon-sm"
			variant="outline"
		>
			<PlusIcon label="" />
		</PromptInputButton>
	);
}

export function PromptInputDemoDefault() {
	const [text, setText] = useState("");
	const [model, setModel] = useState(MODELS[0].id);
	const [effort, setEffort] = useState(EFFORTS[1].id);
	const currentModel = MODELS.find((item) => item.id === model) ?? MODELS[0];
	const currentEffort = EFFORTS.find((item) => item.id === effort) ?? EFFORTS[1];
	const canSend = text.trim().length > 0;

	return (
		<div className="mx-auto w-full max-w-lg py-6">
			<div className="rounded-lg border border-input p-3 transition-colors has-[[contenteditable]:focus-visible]:border-ring has-[[contenteditable]:focus-visible]:ring-3 has-[[contenteditable]:focus-visible]:ring-ring/50">
				<PromptInput multiple onSubmit={() => setText("")}>
					<PromptInputHeader className="px-0 pt-0 pb-3" />
					<PromptInputBody>
						<PromptInputTextarea
							value={text}
							onChange={(event) => setText(event.currentTarget.value)}
							placeholder="Ask the agent to change your code..."
						/>
					</PromptInputBody>
					<PromptInputFooter className="justify-start px-0 pt-3 pb-0">
						<AttachFilesButton />
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<PromptInputButton
										aria-label={`Model: ${currentModel.name}`}
										className="ml-auto"
										size="sm"
										variant="outline"
									/>
								}
							>
								{currentModel.name}
								<ChevronDownIcon label="" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-48">
								<DropdownMenuRadioGroup value={model} onValueChange={setModel}>
									{PROVIDERS.map((provider, index) => (
										<Fragment key={provider.name}>
											{index > 0 ? <DropdownMenuSeparator /> : null}
											<DropdownMenuGroup>
												<DropdownMenuLabel>{provider.name}</DropdownMenuLabel>
												{provider.models.map((item) => (
													<DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
														{item.name}
													</DropdownMenuRadioItem>
												))}
											</DropdownMenuGroup>
										</Fragment>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<PromptInputButton
										aria-label={`Effort: ${currentEffort.name}`}
										size="sm"
										variant="outline"
									/>
								}
							>
								<span className="text-text-subtlest">Effort</span>
								{currentEffort.name}
								<ChevronDownIcon label="" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-36">
								<DropdownMenuGroup>
									<DropdownMenuLabel>Effort</DropdownMenuLabel>
									<DropdownMenuRadioGroup value={effort} onValueChange={setEffort}>
										{EFFORTS.map((item) => (
											<DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
												{item.name}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
						<PromptInputSubmit aria-label="Send" disabled={!canSend} />
					</PromptInputFooter>
				</PromptInput>
			</div>
		</div>
	);
}

interface ChatComposerDemoProps {
	liveVoiceEnabled?: boolean;
}

function ChatComposerDemo({
	liveVoiceEnabled = false,
}: Readonly<ChatComposerDemoProps>) {
	const [prompt, setPrompt] = useState("");
	const [selectedReasoning, setSelectedReasoning] = useState(DEFAULT_REASONING_OPTION_ID);
	const [webResultsEnabled, setWebResultsEnabled] = useState(false);
	const [companyKnowledgeEnabled, setCompanyKnowledgeEnabled] = useState(true);
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);
	const [isAutoMenuOpen, setIsAutoMenuOpen] = useState(false);
	const voice = usePromptInputDemoVoice({ prompt, onPromptChange: setPrompt });

	const handleCustomizeMenuOpenChange = useCallback((open: boolean) => {
		setIsCustomizeMenuOpen(open);
		if (open) setIsAutoMenuOpen(false);
	}, []);

	const handleAutoMenuOpenChange = useCallback((open: boolean) => {
		setIsAutoMenuOpen(open);
		if (open) setIsCustomizeMenuOpen(false);
	}, []);

	const canSubmit = prompt.trim().length > 0;

	return (
		<DemoFrame>
			<div className="px-1">
				<div
					className="relative z-10 rounded-xl border border-border bg-surface p-3"
					style={{ boxShadow: composerUpwardShadow }}
				>
					<PromptInput
						allowOverflow
						onSubmit={() => setPrompt("")}
						className={cn(composerPromptInputClassName, "relative z-10")}
					>
						<PromptInputBody>
							<PromptInputTextarea
								value={prompt}
								onChange={(event) => setPrompt(event.currentTarget.value)}
								placeholder="Ask, @mention, or / for skills"
								aria-label="Chat message input"
								rows={1}
								className={composerTextareaClassName}
							/>
						</PromptInputBody>

						<PromptInputFooter className="mt-3 justify-between px-0 pb-0">
							<PromptInputTools>
								<PromptInputActionMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
									<PromptInputActionMenuTrigger aria-label="Add" className="rounded-md" size="icon-sm" variant="ghost">
										<AddIcon label="" />
									</PromptInputActionMenuTrigger>
									<PromptInputActionMenuContent>
										<PromptInputActionAddAttachments
											elemBefore={<UploadIcon label="" />}
											onSelect={() => setIsAddMenuOpen(false)}
										>
											Upload file
										</PromptInputActionAddAttachments>
										<PromptInputActionAddScreenshot
											elemBefore={<ScreenIcon label="" />}
											onSelect={() => setIsAddMenuOpen(false)}
										>
											Take screenshot
										</PromptInputActionAddScreenshot>
										<PromptInputActionMenuItem
											onSelect={() => setIsAddMenuOpen(false)}
											elemBefore={<LinkIcon label="" />}
										>
											Add a link
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem
											onSelect={() => setIsAddMenuOpen(false)}
											elemBefore={<MentionIcon label="" />}
										>
											Mention someone
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem
											onSelect={() => setIsAddMenuOpen(false)}
											elemBefore={<AddIcon label="" />}
										>
											More formatting
										</PromptInputActionMenuItem>
										<PromptInputActionMenuItem
											onSelect={() => setIsAddMenuOpen(false)}
											elemBefore={<PageIcon label="" />}
										>
											Add current page as context
										</PromptInputActionMenuItem>
									</PromptInputActionMenuContent>
								</PromptInputActionMenu>

								<Popover open={isCustomizeMenuOpen} onOpenChange={handleCustomizeMenuOpenChange}>
									<PopoverTrigger
										render={<PromptInputPreferencesButton aria-label="Customize" />}
									/>
									<PopoverContent side="top" align="start" sideOffset={8} className="w-auto p-1">
										<PopoverTitle className="sr-only">Customize sources</PopoverTitle>
										<CustomizeMenu
											selectedReasoning={selectedReasoning}
											onReasoningChange={setSelectedReasoning}
											showReasoning={false}
											webResultsEnabled={webResultsEnabled}
											onWebResultsChange={setWebResultsEnabled}
											companyKnowledgeEnabled={companyKnowledgeEnabled}
											onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
											onClose={() => setIsCustomizeMenuOpen(false)}
										/>
									</PopoverContent>
								</Popover>
							</PromptInputTools>

							<RovoComposerSendControls
								canSubmit={canSubmit}
								className="flex-1"
								companyKnowledgeEnabled={companyKnowledgeEnabled}
								composerStatus="ready"
								clickyActive={voice.clickyActive}
								dictationState={voice.dictationState}
								dictationTranscriptPreview={voice.dictationTranscriptPreview}
								liveVoiceEnabled={liveVoiceEnabled}
								micStream={voice.micStream}
								onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
								onOpenChange={handleAutoMenuOpenChange}
								onReasoningChange={setSelectedReasoning}
								onStartDictation={voice.handleStartDictation}
								onStop={voice.handleStop}
								onStopDictation={voice.handleStopDictation}
								onToggleClicky={voice.handleToggleClicky}
								onToggleRealtimeVoice={voice.handleToggleRealtimeVoice}
								onWebResultsChange={setWebResultsEnabled}
								open={isAutoMenuOpen}
								realtimeVoiceActive={voice.realtimeVoiceActive}
								realtimeVoiceState={voice.realtimeVoiceState}
								selectedReasoning={selectedReasoning}
								showSubmitWhenEmpty={!liveVoiceEnabled}
								webResultsEnabled={webResultsEnabled}
							/>
						</PromptInputFooter>
					</PromptInput>

					<style>{textareaCSS}</style>
				</div>
				<DemoVoiceStatus message={voice.statusMessage} />
			</div>
		</DemoFrame>
	);
}

export function PromptInputDemoChatComposer() {
	return <ChatComposerDemo />;
}

export function PromptInputDemoChatComposerLiveVoice() {
	return <ChatComposerDemo liveVoiceEnabled />;
}

function FloatingBarDemo() {
	const [prompt, setPrompt] = useState("");
	const voice = usePromptInputDemoVoice({ prompt, onPromptChange: setPrompt });

	const canSubmit = Boolean(prompt.trim());

	return (
		<DemoFrame>
			<FloatingComposer
				allowOverflow
				onSubmit={() => setPrompt("")}
				addButton={
					<PromptInputButton size="icon-sm" variant="ghost" aria-label="Add">
						<AddIcon label="" />
					</PromptInputButton>
				}
				actions={
					<RovoComposerActionButton
						canSubmit={canSubmit}
						composerStatus="ready"
						dictationState={voice.dictationState}
						dictationTranscriptPreview={voice.dictationTranscriptPreview}
						liveVoiceEnabled
						clickyActive={voice.clickyActive}
						micStream={voice.micStream}
						onStartDictation={voice.handleStartDictation}
						onStop={voice.handleStop}
						onStopDictation={voice.handleStopDictation}
						onToggleClicky={voice.handleToggleClicky}
						onToggleRealtimeVoice={voice.handleToggleRealtimeVoice}
						realtimeVoiceActive={voice.realtimeVoiceActive}
						realtimeVoiceState={voice.realtimeVoiceState}
					/>
				}
			>
				<PromptInputTextarea
					value={prompt}
					onChange={(e) => setPrompt(e.currentTarget.value)}
					placeholder="Ask, @mention, or / for actions"
					autoResize
					rows={1}
					className={cn(composerTextareaClassName, floatingComposerTextareaClassName)}
				/>
			</FloatingComposer>

			<style>{textareaCSS}</style>
			<DemoVoiceStatus message={voice.statusMessage} />
		</DemoFrame>
	);
}

export function PromptInputDemoFloatingBar() {
	return <FloatingBarDemo />;
}

interface FloatingBarTextSendDemoProps {
	size?: "icon-sm" | "icon-xs";
}

function FloatingBarTextSendDemo({
	size = "icon-sm",
}: Readonly<FloatingBarTextSendDemoProps>) {
	const [prompt, setPrompt] = useState("");
	const voice = usePromptInputDemoVoice({ prompt, onPromptChange: setPrompt });
	const canSubmit = prompt.trim().length > 0;

	return (
		<DemoFrame>
			<FloatingComposer
				actions={
					<RovoComposerActionButton
						canSubmit={canSubmit}
						composerStatus="ready"
						dictationState={voice.dictationState}
						dictationTranscriptPreview={voice.dictationTranscriptPreview}
						micStream={voice.micStream}
						onStartDictation={voice.handleStartDictation}
						onStop={voice.handleStop}
						onStopDictation={voice.handleStopDictation}
						showSubmitWhenEmpty
						size={size}
					/>
				}
				addButton={
					<PromptInputButton aria-label="Add" size={size} variant="ghost">
						<AddIcon label="" size={size === "icon-xs" ? "small" : undefined} />
					</PromptInputButton>
				}
				onSubmit={() => setPrompt("")}
			>
				<PromptInputTextarea
					autoResize
					className={cn(composerTextareaClassName, floatingComposerTextareaClassName)}
					enableDirectoryAutocomplete={false}
					onChange={(event) => setPrompt(event.currentTarget.value)}
					placeholder="Comment, @mention an agent, or / for skills"
					rows={1}
					value={prompt}
				/>
			</FloatingComposer>

			<style>{textareaCSS}</style>
			<DemoVoiceStatus message={voice.statusMessage} />
		</DemoFrame>
	);
}

export function PromptInputDemoFloatingBarTextSend() {
	return <FloatingBarTextSendDemo size="icon-sm" />;
}

export function PromptInputDemoFloatingBarTextSendIconXs() {
	return <FloatingBarTextSendDemo size="icon-xs" />;
}
