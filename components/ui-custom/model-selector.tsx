"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

import type { ComponentProps, ReactNode } from "react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ModelSelectorProps = ComponentProps<typeof DropdownMenu>;

export const ModelSelector = (props: Readonly<ModelSelectorProps>) => (
	<DropdownMenu {...props} />
);

export type ModelSelectorTriggerProps = ComponentProps<
	typeof DropdownMenuTrigger
>;

export const ModelSelectorTrigger = (props: Readonly<ModelSelectorTriggerProps>) => (
	<DropdownMenuTrigger {...props} />
);

export type ModelSelectorContentProps = ComponentProps<
	typeof DropdownMenuContent
> & {
	title?: ReactNode;
};

export const ModelSelectorContent = ({
	className,
	children,
	title = "Model Selector",
	...props
}: Readonly<ModelSelectorContentProps>) => (
	<DropdownMenuContent
		aria-label={typeof title === "string" ? title : undefined}
		className={cn("w-56", className)}
		{...props}
	>
		{title && typeof title !== "string" ? (
			<span className="sr-only">{title}</span>
		) : null}
		{children}
	</DropdownMenuContent>
);

export type ModelSelectorListProps = ComponentProps<
	typeof DropdownMenuRadioGroup
>;

/** Radio group whose `value` is the selected model id. */
export const ModelSelectorList = (props: Readonly<ModelSelectorListProps>) => (
	<DropdownMenuRadioGroup {...props} />
);

export type ModelSelectorGroupProps = ComponentProps<typeof DropdownMenuGroup> & {
	heading?: ReactNode;
};

export const ModelSelectorGroup = ({
	children,
	heading,
	...props
}: Readonly<ModelSelectorGroupProps>) => (
	<DropdownMenuGroup {...props}>
		{heading ? <DropdownMenuLabel>{heading}</DropdownMenuLabel> : null}
		{children}
	</DropdownMenuGroup>
);

export type ModelSelectorItemProps = Omit<
	ComponentProps<typeof DropdownMenuRadioItem>,
	"onSelect"
> & {
	/** Called with the item's model id when it is picked. */
	onSelect?: (value: string) => void;
	/** Close the menu after picking. Alias of `closeOnClick`; defaults to true. */
	closeOnSelect?: boolean;
};

export const ModelSelectorItem = ({
	closeOnClick,
	closeOnSelect = true,
	onClick,
	onSelect,
	value,
	...props
}: Readonly<ModelSelectorItemProps>) => (
	<DropdownMenuRadioItem
		closeOnClick={closeOnClick ?? closeOnSelect}
		onClick={(event) => {
			onClick?.(event);
			onSelect?.(String(value));
		}}
		value={value}
		{...props}
	/>
);

export type ModelSelectorShortcutProps = ComponentProps<
	typeof DropdownMenuShortcut
>;

export const ModelSelectorShortcut = (props: Readonly<ModelSelectorShortcutProps>) => (
	<DropdownMenuShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<
	typeof DropdownMenuSeparator
>;

export const ModelSelectorSeparator = (props: Readonly<ModelSelectorSeparatorProps>) => (
	<DropdownMenuSeparator {...props} />
);

export type ModelSelectorLogoProps = Omit<
	ComponentProps<"img">,
	"src" | "alt"
> & {
	provider:
		| "moonshotai-cn"
		| "lucidquery"
		| "moonshotai"
		| "zai-coding-plan"
		| "alibaba"
		| "xai"
		| "vultr"
		| "nvidia"
		| "upstage"
		| "groq"
		| "github-copilot"
		| "mistral"
		| "vercel"
		| "nebius"
		| "deepseek"
		| "alibaba-cn"
		| "google-vertex-anthropic"
		| "venice"
		| "chutes"
		| "cortecs"
		| "github-models"
		| "togetherai"
		| "azure"
		| "baseten"
		| "huggingface"
		| "opencode"
		| "fastrouter"
		| "google"
		| "google-vertex"
		| "cloudflare-workers-ai"
		| "inception"
		| "wandb"
		| "openai"
		| "zhipuai-coding-plan"
		| "perplexity"
		| "openrouter"
		| "zenmux"
		| "v0"
		| "iflowcn"
		| "synthetic"
		| "deepinfra"
		| "zhipuai"
		| "submodel"
		| "zai"
		| "inference"
		| "requesty"
		| "morph"
		| "lmstudio"
		| "anthropic"
		| "aihubmix"
		| "fireworks-ai"
		| "modelscope"
		| "llama"
		| "scaleway"
		| "amazon-bedrock"
		| "cerebras"
		// oxlint-disable-next-line typescript-eslint(ban-types) -- intentional pattern for autocomplete-friendly string union
		| (string & {});
};

export const ModelSelectorLogo = ({
	provider,
	className,
	...props
}: ModelSelectorLogoProps) => (
	<img
		{...props}
		alt={`${provider} logo`}
		className={cn("size-3 dark:invert", className)}
		height={12}
		src={`https://models.dev/logos/${provider}.svg`}
		width={12}
	/>
);

export type ModelSelectorLogoGroupProps = ComponentProps<"div">;

export const ModelSelectorLogoGroup = ({
	className,
	...props
}: ModelSelectorLogoGroupProps) => (
	<div
		className={cn(
			"flex shrink-0 items-center -space-x-1 [&>img]:rounded-full [&>img]:bg-background [&>img]:p-px [&>img]:ring-1 dark:[&>img]:bg-foreground",
			className
		)}
		{...props}
	/>
);

export type ModelSelectorNameProps = ComponentProps<"span">;

export const ModelSelectorName = ({
	className,
	...props
}: ModelSelectorNameProps) => (
	<span className={cn("flex-1 truncate text-left", className)} {...props} />
);
