"use client";

import { Fragment, useRef, useState, type FormEvent } from "react";

import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorLogoGroup,
	ModelSelectorName,
	ModelSelectorSeparator,
	ModelSelectorTrigger,
} from "@/components/ui-custom/model-selector";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { ArrowUpIcon, ChevronDownIcon, PlusIcon } from "@/components/ui/vpk-icons";

// — Shared model data —

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

const LOGO_PROVIDERS = [
	{
		provider: "anthropic",
		name: "Anthropic",
		models: [
			{ id: "claude-4-sonnet", name: "Claude 4 Sonnet" },
			{ id: "claude-4-opus", name: "Claude 4 Opus" },
		],
	},
	{
		provider: "openai",
		name: "OpenAI",
		models: [
			{ id: "gpt-4o", name: "GPT-4o" },
			{ id: "o3", name: "o3" },
		],
	},
	{
		provider: "google",
		name: "Google",
		models: [
			{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
			{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
		],
	},
	{
		provider: "mistral",
		name: "Mistral",
		models: [
			{ id: "mistral-large", name: "Mistral Large" },
			{ id: "codestral", name: "Codestral" },
		],
	},
];

const LOGO_MODELS = LOGO_PROVIDERS.flatMap((group) =>
	group.models.map((model) => ({ ...model, provider: group.provider }))
);

const REASONING_MODE_SECTIONS = [
	{
		options: [{ id: "quick-auto", name: "Searching and simple Q&A" }],
		title: "Quick answer",
	},
	{
		options: [
			{ id: "deep-auto", name: "Recommended" },
			{ id: "gemini-flash-3", name: "Gemini Flash 3" },
			{ id: "gpt-5.4", name: "GPT 5.4" },
			{ id: "sonnet-5", name: "Sonnet 5" },
			{ id: "opus-4.6", name: "Opus 4.6" },
		],
		title: "Think deeper",
	},
];

// — Default: composer with a model menu and an effort menu —

export default function ModelSelectorDemo() {
	const [text, setText] = useState("");
	const [model, setModel] = useState(MODELS[0].id);
	const [effort, setEffort] = useState(EFFORTS[1].id);
	const formRef = useRef<HTMLFormElement>(null);
	const currentModel = MODELS.find((item) => item.id === model) ?? MODELS[0];
	const currentEffort = EFFORTS.find((item) => item.id === effort) ?? EFFORTS[1];
	const canSend = text.trim().length > 0;

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canSend) {
			return;
		}

		setText("");
	}

	return (
		<div className="mx-auto w-full max-w-lg py-6">
			<form ref={formRef} onSubmit={onSubmit}>
				<InputGroup>
					<InputGroupTextarea
						value={text}
						onChange={(event) => setText(event.target.value)}
						placeholder="Ask the agent to change your code..."
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								formRef.current?.requestSubmit();
							}
						}}
						className="p-3"
					/>
					<InputGroupAddon align="block-end">
						<InputGroupButton
							size="icon-sm"
							variant="outline"
							shape="circle"
							disabled={canSend}
							aria-label="Attach"
						>
							<PlusIcon />
						</InputGroupButton>
						<ModelSelector>
							<ModelSelectorTrigger
								render={
									<InputGroupButton
										size="sm"
										variant="outline"
										aria-label={`Model: ${currentModel.name}`}
										className="ml-auto"
									/>
								}
							>
								{currentModel.name}
								<ChevronDownIcon />
							</ModelSelectorTrigger>
							<ModelSelectorContent align="start" className="w-48" title="Model">
								<ModelSelectorList value={model} onValueChange={setModel}>
									{PROVIDERS.map((provider, index) => (
										<Fragment key={provider.name}>
											{index > 0 ? <ModelSelectorSeparator /> : null}
											<ModelSelectorGroup heading={provider.name}>
												{provider.models.map((item) => (
													<ModelSelectorItem key={item.id} value={item.id}>
														{item.name}
													</ModelSelectorItem>
												))}
											</ModelSelectorGroup>
										</Fragment>
									))}
								</ModelSelectorList>
							</ModelSelectorContent>
						</ModelSelector>
						<ModelSelector>
							<ModelSelectorTrigger
								render={
									<InputGroupButton
										size="sm"
										variant="outline"
										aria-label={`Effort: ${currentEffort.name}`}
									/>
								}
							>
								<span className="text-text-subtlest">Effort</span>
								{currentEffort.name}
								<ChevronDownIcon />
							</ModelSelectorTrigger>
							<ModelSelectorContent align="start" className="w-36" title="Effort">
								<ModelSelectorList value={effort} onValueChange={setEffort}>
									<ModelSelectorGroup heading="Effort">
										{EFFORTS.map((item) => (
											<ModelSelectorItem key={item.id} value={item.id}>
												{item.name}
											</ModelSelectorItem>
										))}
									</ModelSelectorGroup>
								</ModelSelectorList>
							</ModelSelectorContent>
						</ModelSelector>
						<InputGroupButton
							type="submit"
							size="icon-sm"
							variant="default"
							shape="circle"
							disabled={!canSend}
							aria-label="Send"
						>
							<ArrowUpIcon />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</form>
		</div>
	);
}

// — With logos: provider logos on items and trigger —

export function ModelSelectorDemoWithLogos() {
	const [selected, setSelected] = useState("claude-4-sonnet");
	const current = LOGO_MODELS.find((model) => model.id === selected);

	return (
		<ModelSelector>
			<ModelSelectorTrigger render={<Button variant="outline" size="default" className="gap-2" />}>
				<ModelSelectorLogoGroup>
					<ModelSelectorLogo provider={current?.provider ?? "anthropic"} />
				</ModelSelectorLogoGroup>
				{current?.name ?? "Select model"}
			</ModelSelectorTrigger>
			<ModelSelectorContent className="w-64">
				<ModelSelectorInput />
				<ModelSelectorList value={selected} onValueChange={setSelected}>
					<ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
					{LOGO_PROVIDERS.map((group, index) => (
						<Fragment key={group.provider}>
							{index > 0 ? <ModelSelectorSeparator /> : null}
							<ModelSelectorGroup heading={group.name}>
								{group.models.map((model) => (
									<ModelSelectorItem key={model.id} value={model.id}>
										<ModelSelectorLogo provider={group.provider} />
										<ModelSelectorName>{model.name}</ModelSelectorName>
									</ModelSelectorItem>
								))}
							</ModelSelectorGroup>
						</Fragment>
					))}
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
}

// — Multi-provider trigger: logo group showing multiple provider logos —

export function ModelSelectorDemoMultiProvider() {
	const [selected, setSelected] = useState("claude-4-sonnet");
	const providers = LOGO_PROVIDERS.slice(0, 3);

	return (
		<ModelSelector>
			<ModelSelectorTrigger render={<Button variant="outline" size="default" className="gap-2" />}>
				<ModelSelectorLogoGroup>
					{providers.map((group) => (
						<ModelSelectorLogo key={group.provider} provider={group.provider} />
					))}
				</ModelSelectorLogoGroup>
				{LOGO_MODELS.find((model) => model.id === selected)?.name ?? selected}
			</ModelSelectorTrigger>
			<ModelSelectorContent className="w-64">
				<ModelSelectorInput />
				<ModelSelectorList value={selected} onValueChange={setSelected}>
					<ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
					{providers.map((group) => (
						<ModelSelectorGroup key={group.provider} heading={group.name}>
							{group.models.map((model) => (
								<ModelSelectorItem key={model.id} value={model.id}>
									<ModelSelectorLogo provider={group.provider} />
									<ModelSelectorName>{model.name}</ModelSelectorName>
								</ModelSelectorItem>
							))}
						</ModelSelectorGroup>
					))}
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
}

// — Reasoning modes: grouped mode options —

export function ModelSelectorDemoReasoningModes() {
	const [selected, setSelected] = useState("quick-auto");
	const current = REASONING_MODE_SECTIONS.flatMap((section) =>
		section.options.map((option) => ({
			...option,
			optionCount: section.options.length,
			section: section.title,
		}))
	).find((option) => option.id === selected);

	return (
		<ModelSelector>
			<ModelSelectorTrigger render={<Button variant="outline" size="default" />}>
				{current
					? current.optionCount === 1
						? current.section
						: `${current.section}: ${current.name}`
					: "Select mode"}
			</ModelSelectorTrigger>
			<ModelSelectorContent className="w-[360px] max-w-[calc(100vw-2rem)]" title="Reasoning mode">
				<ModelSelectorList value={selected} onValueChange={setSelected}>
					{REASONING_MODE_SECTIONS.map((section) => (
						<ModelSelectorGroup key={section.title} heading={section.title}>
							{section.options.map((option) => (
								<ModelSelectorItem key={option.id} value={option.id}>
									<ModelSelectorName>{option.name}</ModelSelectorName>
								</ModelSelectorItem>
							))}
						</ModelSelectorGroup>
					))}
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
}
