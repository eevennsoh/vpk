"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

import {
	createContext,
	use,
	useCallback,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
	type RefObject,
} from "react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
	CommandPrimitiveInput,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSearchField,
	DropdownMenuTrigger,
	dropdownStyles,
} from "@/components/ui/dropdown-menu";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { cn } from "@/lib/utils";

// The menu shell is a Dropdown Menu; inside it, search, filtering and arrow-key
// highlighting belong to cmdk, as in the agent selector.

const ModelSelectorCloseContext = createContext<() => void>(() => {});

interface ModelSelectorValueContextValue {
	value?: string;
	onValueChange?: (value: string) => void;
}

const ModelSelectorValueContext = createContext<ModelSelectorValueContextValue>({});

export type ModelSelectorProps = ComponentProps<typeof DropdownMenu>;

type ModelSelectorActions =
	NonNullable<ModelSelectorProps["actionsRef"]> extends RefObject<infer Actions> ? Actions : never;

export const ModelSelector = ({
	actionsRef,
	modal = false,
	...props
}: Readonly<ModelSelectorProps>) => {
	const fallbackActionsRef = useRef<ModelSelectorActions>(null);
	const resolvedActionsRef = actionsRef ?? fallbackActionsRef;
	const close = useCallback(() => {
		resolvedActionsRef.current?.close();
	}, [resolvedActionsRef]);

	return (
		<ModelSelectorCloseContext value={close}>
			<DropdownMenu actionsRef={resolvedActionsRef} modal={modal} {...props} />
		</ModelSelectorCloseContext>
	);
};

export type ModelSelectorTriggerProps = ComponentProps<typeof DropdownMenuTrigger>;

export const ModelSelectorTrigger = (props: Readonly<ModelSelectorTriggerProps>) => (
	<DropdownMenuTrigger {...props} />
);

export type ModelSelectorContentProps = ComponentProps<typeof DropdownMenuContent> & {
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
		className={cn("flex w-56 flex-col overflow-hidden p-0", className)}
		{...props}
	>
		{title && typeof title !== "string" ? <span className="sr-only">{title}</span> : null}
		<Command
			className={cn("min-h-0 flex-1 rounded-lg bg-transparent", dropdownStyles.padding)}
			label={typeof title === "string" ? title : undefined}
		>
			{children}
		</Command>
	</DropdownMenuContent>
);

export type ModelSelectorInputProps = {
	placeholder?: string;
	/** Controlled query; omit to let the input own it. */
	value?: string;
	onValueChange?: (value: string) => void;
};

/** The shared menu search field, flush with the menu's top edge like the agent selector's. */
export const ModelSelectorInput = ({
	placeholder = "Search models",
	value,
	onValueChange,
}: Readonly<ModelSelectorInputProps>) => {
	const [internalValue, setInternalValue] = useState("");
	const query = value ?? internalValue;
	const setQuery = (next: string) => {
		setInternalValue(next);
		onValueChange?.(next);
	};

	return (
		<div className="-mx-(--menu-inset) -mt-(--menu-inset) mb-0.5 shrink-0 overflow-hidden rounded-t-lg">
			<DropdownMenuSearchField
				autoFocus
				hostOwnsKeyNavigation
				icon={<SearchIcon className="size-4 text-icon-subtle" />}
				label={placeholder}
				onClear={() => setQuery("")}
				onValueChange={setQuery}
				placeholder={placeholder}
				renderInput={(input) => <CommandPrimitiveInput asChild value={query}>{input}</CommandPrimitiveInput>}
				value={query}
			/>
		</div>
	);
};

export type ModelSelectorListProps = Omit<ComponentProps<typeof CommandList>, "onChange"> & {
	/** The selected model id. */
	value?: string;
	onValueChange?: (value: string) => void;
};

/** Scrollable list of models; fades its top edge once it scrolls, like the agent selector. */
export const ModelSelectorList = ({
	className,
	onValueChange,
	style,
	value,
	...props
}: Readonly<ModelSelectorListProps>) => {
	const { ref: listRef, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const maskStyle = {
		...buildScrollMaskStyle({ fadeBottom: false, fadeSize: "3rem", fadeTop: showTopScrollMask }),
		"--scroll-mask-top-fade-size": "3rem",
	};
	const valueContext = useMemo(() => ({ onValueChange, value }), [onValueChange, value]);

	return (
		<ModelSelectorValueContext value={valueContext}>
			<CommandList
				label="Models"
				className={cn("max-h-72 min-h-0 flex-1 overscroll-contain p-0", className)}
				ref={listRef}
				showScrollbar
				style={{ ...maskStyle, ...style }}
				{...props}
			/>
		</ModelSelectorValueContext>
	);
};

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const ModelSelectorEmpty = ({ className, ...props }: Readonly<ModelSelectorEmptyProps>) => (
	<CommandEmpty className={cn("py-4 text-text-subtle", className)} {...props} />
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

/**
 * Dropdown menu groups have no padding: a subheading takes a 6px top margin when content sits above it,
 * and none after a separator, whose own 6px margins space it.
 */
export const ModelSelectorGroup = ({ className, ...props }: Readonly<ModelSelectorGroupProps>) => (
	<CommandGroup
		className={cn(
			"!p-0 **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:!leading-4 **:[[cmdk-group-heading]]:!text-text-subtlest not-first:**:[[cmdk-group-heading]]:mt-1.5 [[cmdk-separator]+&]:**:[[cmdk-group-heading]]:mt-0",
			className
		)}
		{...props}
	/>
);

export type ModelSelectorItemProps = Omit<ComponentProps<typeof CommandItem>, "onSelect" | "value"> & {
	/** The model id this item selects. */
	value: string;
	/** Called with the item's model id when it is picked. */
	onSelect?: (value: string) => void;
	/** Close the menu after picking; defaults to true. */
	closeOnSelect?: boolean;
};

export const ModelSelectorItem = ({
	className,
	closeOnSelect = true,
	onSelect,
	value,
	...props
}: Readonly<ModelSelectorItemProps>) => {
	const close = use(ModelSelectorCloseContext);
	const selection = use(ModelSelectorValueContext);
	const isChecked = selection.value === value;

	return (
		<CommandItem
			aria-checked={isChecked}
			className={cn(
				"h-8 pr-3 data-selected:bg-bg-neutral-subtle-hovered! data-selected:text-text! data-selected:active:bg-bg-neutral-subtle-pressed! data-[checked=true]:text-text data-[checked=true]:*:[svg]:text-text-selected data-[checked=true]:[&_[data-slot=icon]]:text-text-selected",
				className
			)}
			data-checked={isChecked ? true : undefined}
			onSelect={() => {
				selection.onValueChange?.(value);
				onSelect?.(value);
				if (closeOnSelect) {
					close();
				}
			}}
			value={value}
			{...props}
		/>
	);
};

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const ModelSelectorShortcut = (props: Readonly<ModelSelectorShortcutProps>) => (
	<CommandShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<typeof CommandSeparator>;

export const ModelSelectorSeparator = ({ className, ...props }: Readonly<ModelSelectorSeparatorProps>) => (
	<CommandSeparator className={cn("-mx-(--menu-inset) my-(--menu-inset)", className)} {...props} />
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
