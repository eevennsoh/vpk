"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

import {
	createContext,
	use,
	useCallback,
	useMemo,
	useRef,
	type ComponentProps,
	type ReactNode,
	type RefObject,
} from "react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ModelSelectorContextValue {
	close: () => void;
}

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
	null
);

export type ModelSelectorProps = ComponentProps<typeof DropdownMenu>;

type ModelSelectorActions =
	NonNullable<ModelSelectorProps["actionsRef"]> extends RefObject<
		infer Actions
	>
		? Actions
		: never;

export const ModelSelector = ({
	actionsRef,
	children,
	modal = false,
	...props
}: Readonly<ModelSelectorProps>) => {
	const fallbackActionsRef = useRef<ModelSelectorActions>(null);
	const resolvedActionsRef = actionsRef ?? fallbackActionsRef;
	const close = useCallback(() => {
		resolvedActionsRef.current?.close();
	}, [resolvedActionsRef]);
	const contextValue = useMemo(() => ({ close }), [close]);

	return (
		<ModelSelectorContext value={contextValue}>
			<DropdownMenu actionsRef={resolvedActionsRef} modal={modal} {...props}>
				{children}
			</DropdownMenu>
		</ModelSelectorContext>
	);
};

export type ModelSelectorTriggerProps = ComponentProps<
	typeof DropdownMenuTrigger
>;

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
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
	portalled = false,
	title = "Model Selector",
	...props
}: ModelSelectorContentProps) => (
	<DropdownMenuContent
		aria-label={typeof title === "string" ? title : undefined}
		className={cn("w-80 p-0", className)}
		portalled={portalled}
		{...props}
	>
		{title ? <span className="sr-only">{title}</span> : null}
		<Command
			className="rounded-lg! **:data-[slot=command-input-wrapper]:h-auto"
			label={typeof title === "string" ? title : undefined}
		>
			{children}
		</Command>
	</DropdownMenuContent>
);

export type ModelSelectorDialogProps = ModelSelectorProps;

export const ModelSelectorDialog = (props: ModelSelectorDialogProps) => (
	<ModelSelector {...props} />
);

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>;

export const ModelSelectorInput = ({
	className,
	...props
}: ModelSelectorInputProps) => (
	<CommandInput className={cn(className)} {...props} />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

export const ModelSelectorList = (props: ModelSelectorListProps) => (
	<CommandList {...props} />
);

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => (
	<CommandEmpty {...props} />
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
	<CommandGroup {...props} />
);

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem> & {
	closeOnSelect?: boolean;
};

export const ModelSelectorItem = ({
	className,
	closeOnSelect = true,
	onSelect,
	showCheckIcon = false,
	...props
}: ModelSelectorItemProps) => {
	const context = use(ModelSelectorContext);

	return (
		<CommandItem
			className={cn(
				"h-8 pr-3 data-selected:bg-bg-neutral-subtle-hovered! data-selected:text-text! data-selected:active:bg-bg-neutral-subtle-pressed! data-[checked=true]:text-text data-[checked=true]:*:[svg]:text-text-selected data-[checked=true]:[&_[data-slot=icon]]:text-text-selected",
				className
			)}
			showCheckIcon={showCheckIcon}
			onSelect={(value) => {
				onSelect?.(value);

				if (closeOnSelect) {
					context?.close();
				}
			}}
			{...props}
		/>
	);
};

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
	<CommandShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<
	typeof CommandSeparator
>;

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
	<CommandSeparator {...props} />
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
