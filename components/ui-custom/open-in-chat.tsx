"use client";

// oxlint-disable react-doctor/jsx-no-constructed-context-values -- Context values in this file intentionally combine live state and setters; extracting them would not reduce meaningful consumer churn.

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ChevronDownIcon,
	ExternalLinkIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import { createContext, use } from "react";

import { providers } from "@/components/ui-custom/data/open-in-providers";

const OpenInContext = createContext<{ query: string } | undefined>(undefined);

function useOpenInContext() {
	const context = use(OpenInContext);
	if (!context) {
		throw new Error(
			"OpenIn components must be used within an OpenIn provider",
		);
	}
	return context;
}

export interface OpenInProps extends ComponentProps<typeof DropdownMenu> {
	query: string;
}

export function OpenIn({ query, ...props }: Readonly<OpenInProps>) {
	return (
		<OpenInContext value={{ query }}>
			<DropdownMenu {...props} />
		</OpenInContext>
	);
}

export type OpenInContentProps = ComponentProps<typeof DropdownMenuContent>;

export function OpenInContent({
	className,
	...props
}: Readonly<OpenInContentProps>) {
	return (
		<DropdownMenuContent
			align="start"
			className={cn("w-[240px]", className)}
			{...props}
		/>
	);
}

export type OpenInItemProps = ComponentProps<typeof DropdownMenuItem>;

export function OpenInItem(props: Readonly<OpenInItemProps>) {
	return <DropdownMenuItem {...props} />;
}

export type OpenInLabelProps = ComponentProps<typeof DropdownMenuLabel>;

export function OpenInLabel(props: Readonly<OpenInLabelProps>) {
	return (
		<DropdownMenuGroup>
			<DropdownMenuLabel {...props} />
		</DropdownMenuGroup>
	);
}

export type OpenInSeparatorProps = ComponentProps<
	typeof DropdownMenuSeparator
>;

export function OpenInSeparator(props: Readonly<OpenInSeparatorProps>) {
	return <DropdownMenuSeparator {...props} />;
}

export type OpenInTriggerProps = ComponentProps<typeof DropdownMenuTrigger>;

export function OpenInTrigger({
	children,
	...props
}: Readonly<OpenInTriggerProps>) {
	return (
		<DropdownMenuTrigger
			render={<Button type="button" variant="outline" />}
			{...props}
		>
			{children ?? (
				<>
					Open in chat
					<ChevronDownIcon className="text-icon-subtle" data-icon="inline-end" label="" size="small" />
				</>
			)}
		</DropdownMenuTrigger>
	);
}

interface OpenInProviderItemProps
	extends ComponentProps<typeof DropdownMenuItem> {
	providerKey: string;
}

function OpenInProviderItem({
	className,
	providerKey,
	...props
}: Readonly<OpenInProviderItemProps>) {
	const { query } = useOpenInContext();
	const provider = providers[providerKey];

	// A link row keeps the menu row's text colour instead of the global link blue and underline.
	return (
		<DropdownMenuItem
			className={cn("text-text no-underline hover:no-underline active:text-text", className)}
			elemAfter={<ExternalLinkIcon label="" size="small" />}
			elemBefore={<span aria-hidden="true" className="contents">{provider.icon}</span>}
			elemBeforeSize={16}
			nativeButton={false}
			render={<a href={provider.createUrl(query)} rel="noopener" target="_blank" />}
			{...props}
		>
			{provider.title}
		</DropdownMenuItem>
	);
}

export type OpenInChatGPTProps = ComponentProps<typeof DropdownMenuItem>;

export function OpenInChatGPT(props: Readonly<OpenInChatGPTProps>) {
	return <OpenInProviderItem providerKey="chatgpt" {...props} />;
}

export type OpenInClaudeProps = ComponentProps<typeof DropdownMenuItem>;

export function OpenInClaude(props: Readonly<OpenInClaudeProps>) {
	return <OpenInProviderItem providerKey="claude" {...props} />;
}

export type OpenInT3Props = ComponentProps<typeof DropdownMenuItem>;

export function OpenInT3(props: Readonly<OpenInT3Props>) {
	return <OpenInProviderItem providerKey="t3" {...props} />;
}

export type OpenInSciraProps = ComponentProps<typeof DropdownMenuItem>;

export function OpenInScira(props: Readonly<OpenInSciraProps>) {
	return <OpenInProviderItem providerKey="scira" {...props} />;
}

export type OpenInv0Props = ComponentProps<typeof DropdownMenuItem>;

export function OpenInv0(props: Readonly<OpenInv0Props>) {
	return <OpenInProviderItem providerKey="v0" {...props} />;
}

export type OpenInCursorProps = ComponentProps<typeof DropdownMenuItem>;

export function OpenInCursor(props: Readonly<OpenInCursorProps>) {
	return <OpenInProviderItem providerKey="cursor" {...props} />;
}
