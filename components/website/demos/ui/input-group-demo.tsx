"use client";

import { useState } from "react";
import AtlaskitSearchIcon from "@atlaskit/icon/core/search";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, CodeIcon, CopyIcon, ExternalLinkIcon, EyeOffIcon, InfoIcon, MailIcon, MicIcon, RadioIcon, RefreshCwIcon, SearchIcon, SparklesIcon, StarIcon, TrashIcon } from "@/components/ui/vpk-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupSearchAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SonnerToast, type SonnerToastAppearance } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function showInputGroupToast(title: string, appearance: SonnerToastAppearance = "neutral") {
	toast.custom((id) => (
		<SonnerToast
			appearance={appearance}
			title={title}
			dismissible
			onDismiss={() => toast.dismiss(id)}
		/>
	));
}

export function InputGroupDemoDefault() {
	return (
		<InputGroup className="w-48">
			<InputGroupSearchAddon>
				<SearchIcon />
			</InputGroupSearchAddon>
			<InputGroupInput placeholder="Search..." />
		</InputGroup>
	);
}

export default InputGroupDemoDefault;

export function InputGroupDemoBasic() {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="input-default-01">
					Default (No Input Group)
				</FieldLabel>
				<Input placeholder="Placeholder" id="input-default-01" />
			</Field>
			<Field>
				<FieldLabel htmlFor="input-group-02">Input Group</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-group-02" placeholder="Placeholder" />
				</InputGroup>
			</Field>
			<Field data-disabled="true">
				<FieldLabel htmlFor="input-disabled-03">Disabled</FieldLabel>
				<InputGroup>
					<InputGroupInput
						id="input-disabled-03"
						placeholder="This field is disabled"
						disabled
					/>
				</InputGroup>
			</Field>
			<Field data-invalid="true">
				<FieldLabel htmlFor="input-invalid-04">Invalid</FieldLabel>
				<InputGroup>
					<InputGroupInput
						id="input-invalid-04"
						placeholder="This field is invalid"
						aria-invalid="true"
					/>
				</InputGroup>
			</Field>
		</FieldGroup>
	);
}

export function InputGroupDemoButton() {
	return (
		<InputGroup>
			<InputGroupInput placeholder="Search..." />
			<InputGroupAddon align="inline-end">
				<InputGroupButton>
					<AtlaskitSearchIcon label="Search" />
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}

export function InputGroupDemoPrefix() {
	return (
		<InputGroup>
			<InputGroupAddon>
				<InputGroupText>https://</InputGroupText>
			</InputGroupAddon>
			<InputGroupInput placeholder="example.com" />
		</InputGroup>
	);
}

export function InputGroupDemoInCard() {
	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Card with Input Group</CardTitle>
				<CardDescription>This is a card with an input group.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="email-input">Email Address</FieldLabel>
						<InputGroup>
							<InputGroupInput
								id="email-input"
								type="email"
								placeholder="you@example.com"
							/>
							<InputGroupAddon align="inline-end">
								<MailIcon
								/>
							</InputGroupAddon>
						</InputGroup>
					</Field>
					<Field>
						<FieldLabel htmlFor="website-input">Website URL</FieldLabel>
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>https://</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput id="website-input" placeholder="example.com" />
							<InputGroupAddon align="inline-end">
								<ExternalLinkIcon
								/>
							</InputGroupAddon>
						</InputGroup>
					</Field>
					<Field>
						<FieldLabel htmlFor="feedback-textarea">
							Feedback & Comments
						</FieldLabel>
						<InputGroup>
							<InputGroupTextarea
								id="feedback-textarea"
								placeholder="Share your thoughts..."
								className="min-h-[100px]"
							/>
							<InputGroupAddon align="block-end">
								<InputGroupText>0/500 characters</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
					</Field>
				</FieldGroup>
			</CardContent>
			<CardFooter className="justify-end gap-2">
				<Button variant="outline">Cancel</Button>
				<Button>Submit</Button>
			</CardFooter>
		</Card>
	);
}

export function InputGroupDemoTextarea() {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="textarea-header-footer-12">
					Default Textarea (No Input Group)
				</FieldLabel>
				<Textarea
					id="textarea-header-footer-12"
					placeholder="Enter your text here..."
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="textarea-header-footer-13">
					Input Group
				</FieldLabel>
				<InputGroup>
					<InputGroupTextarea
						id="textarea-header-footer-13"
						placeholder="Enter your text here..."
					/>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field data-invalid="true">
				<FieldLabel htmlFor="textarea-header-footer-14">Invalid</FieldLabel>
				<InputGroup>
					<InputGroupTextarea
						id="textarea-header-footer-14"
						placeholder="Enter your text here..."
						aria-invalid="true"
					/>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field data-disabled="true">
				<FieldLabel htmlFor="textarea-header-footer-15">Disabled</FieldLabel>
				<InputGroup>
					<InputGroupTextarea
						id="textarea-header-footer-15"
						placeholder="Enter your text here..."
						disabled
					/>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="prompt-31">Addon (block-start)</FieldLabel>
				<InputGroup>
					<InputGroupTextarea id="prompt-31" />
					<InputGroupAddon align="block-start">
						<InputGroupText>Ask, Search or Chat...</InputGroupText>
						<InfoIcon className="text-muted-foreground ml-auto" />
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="textarea-header-footer-30">
					Addon (block-end)
				</FieldLabel>
				<InputGroup>
					<InputGroupTextarea
						id="textarea-header-footer-30"
						placeholder="Enter your text here..."
					/>
					<InputGroupAddon align="block-end">
						<InputGroupText>0/280 characters</InputGroupText>
						<InputGroupButton
							variant="default"
							size="icon-xs"
							className="ml-auto rounded-full"
						>
							<ArrowUpIcon
							/>
							<span className="sr-only">Send</span>
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="textarea-comment-31">Addon (Buttons)</FieldLabel>
				<InputGroup>
					<InputGroupTextarea
						id="textarea-comment-31"
						placeholder="Share your thoughts..."
						className="min-h-[120px]"
					/>
					<InputGroupAddon align="block-end">
						<InputGroupButton variant="ghost" className="ml-auto" size="sm">
							Cancel
						</InputGroupButton>
						<InputGroupButton variant="default" size="sm">
							Post Comment
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="textarea-code-32">Code Editor</FieldLabel>
				<InputGroup>
					<InputGroupTextarea
						id="textarea-code-32"
						placeholder="console.log('Hello, world!');"
						className="min-h-[300px] py-3"
					/>
					<InputGroupAddon align="block-start" className="border-b">
						<InputGroupText className="font-mono font-medium">
							<CodeIcon
							/>
							script.js
						</InputGroupText>
						<InputGroupButton size="icon-xs" className="ml-auto">
							<RefreshCwIcon
							/>
						</InputGroupButton>
						<InputGroupButton size="icon-xs" variant="ghost">
							<CopyIcon
							/>
						</InputGroupButton>
					</InputGroupAddon>
					<InputGroupAddon align="block-end" className="border-t">
						<InputGroupText>Line 1, Column 1</InputGroupText>
						<InputGroupText className="ml-auto">JavaScript</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			</Field>
		</FieldGroup>
	);
}

export function InputGroupDemoWithAddons() {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="input-icon-left-05">
					Addon (inline-start)
				</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-icon-left-05" />
					<InputGroupSearchAddon>
						<SearchIcon />
					</InputGroupSearchAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-icon-right-07">
					Addon (inline-end)
				</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-icon-right-07" />
					<InputGroupAddon align="inline-end">
						<EyeOffIcon
						/>
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-icon-both-09">
					Addon (inline-start and inline-end)
				</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-icon-both-09" />
					<InputGroupAddon>
						<MicIcon className="text-muted-foreground" />
					</InputGroupAddon>
					<InputGroupAddon align="inline-end">
						<RadioIcon className="animate-pulse text-red-500" />
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-addon-20">Addon (block-start)</FieldLabel>
				<InputGroup className="h-auto">
					<InputGroupInput id="input-addon-20" />
					<InputGroupAddon align="block-start">
						<InputGroupText>First Name</InputGroupText>
						<InfoIcon className="text-muted-foreground ml-auto" />
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-addon-21">Addon (block-end)</FieldLabel>
				<InputGroup className="h-auto">
					<InputGroupInput id="input-addon-21" />
					<InputGroupAddon align="block-end">
						<InputGroupText>20/240 characters</InputGroupText>
						<InfoIcon className="text-muted-foreground ml-auto" />
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-icon-both-10">Multiple Icons</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-icon-both-10" />
					<InputGroupAddon align="inline-end">
						<StarIcon
						/>
						<InputGroupButton
							size="icon-xs"
							onClick={() => showInputGroupToast("Copied to clipboard", "success")}
						>
							<CopyIcon
							/>
						</InputGroupButton>
					</InputGroupAddon>
					<InputGroupAddon>
						<RadioIcon className="animate-pulse text-red-500" />
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-description-10">Description</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-description-10" />
					<InputGroupAddon align="inline-end">
						<InfoIcon
						/>
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-label-10">Label</FieldLabel>
				<InputGroup>
					<InputGroupAddon>
						<FieldLabel htmlFor="input-label-10">Label</FieldLabel>
					</InputGroupAddon>
					<InputGroupInput id="input-label-10" />
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-optional-12" aria-label="Optional" />
					<InputGroupAddon align="inline-end">
						<InputGroupText>(optional)</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			</Field>
		</FieldGroup>
	);
}

export function InputGroupDemoWithButtons() {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="input-button-13">Button</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-button-13" />
					<InputGroupAddon>
						<InputGroupButton>Default</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-button-14" />
					<InputGroupAddon>
						<InputGroupButton variant="outline">Outline</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-button-15" />
					<InputGroupAddon>
						<InputGroupButton variant="secondary">Secondary</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-button-16" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton variant="secondary">Button</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-button-17" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton size="icon-xs">
							<CopyIcon
							/>
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-button-18" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton variant="secondary" size="icon-xs">
							<TrashIcon
							/>
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</Field>
		</FieldGroup>
	);
}

export function InputGroupDemoWithKbd() {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="input-kbd-22">Input Group with Kbd</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-kbd-22" />
					<InputGroupAddon>
						<Kbd>⌘K</Kbd>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput id="input-kbd-23" />
					<InputGroupAddon align="inline-end">
						<Kbd>⌘K</Kbd>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput
						id="input-search-apps-24"
						placeholder="Search for Apps..."
					/>
					<InputGroupAddon align="inline-end">Ask AI</InputGroupAddon>
					<InputGroupAddon align="inline-end">
						<Kbd>Tab</Kbd>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup>
					<InputGroupInput
						id="input-search-type-25"
						placeholder="Type to search..."
					/>
					<InputGroupAddon align="inline-start">
						<SparklesIcon
						/>
					</InputGroupAddon>
					<InputGroupAddon align="inline-end">
						<KbdGroup>
							<Kbd>Ctrl</Kbd>
							<Kbd>C</Kbd>
						</KbdGroup>
					</InputGroupAddon>
				</InputGroup>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-username-26">Username</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-username-26" defaultValue="shadcn" />
					<InputGroupAddon align="inline-end">
						<div className="flex size-4 items-center justify-center rounded-full bg-green-500 dark:bg-green-800">
							<CheckIcon className="size-3 text-white" />
						</div>
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription className="text-green-700">
					This username is available.
				</FieldDescription>
			</Field>
			<InputGroup>
				<InputGroupInput
					id="input-search-docs-27"
					placeholder="Search documentation..."
				/>
				<InputGroupSearchAddon>
					<SearchIcon
					/>
				</InputGroupSearchAddon>
				<InputGroupAddon align="inline-end">12 results</InputGroupAddon>
			</InputGroup>
			<InputGroup data-disabled="true">
				<InputGroupInput
					id="input-search-disabled-28"
					placeholder="Search documentation..."
					disabled
				/>
				<InputGroupSearchAddon>
					<SearchIcon
					/>
				</InputGroupSearchAddon>
				<InputGroupAddon align="inline-end">Disabled</InputGroupAddon>
			</InputGroup>
			<FieldGroup className="grid grid-cols-2 gap-4">
				<Field>
					<FieldLabel htmlFor="input-group-11">First Name</FieldLabel>
					<InputGroup>
						<InputGroupInput id="input-group-11" placeholder="First Name" />
						<InputGroupAddon align="inline-end">
							<InfoIcon
							/>
						</InputGroupAddon>
					</InputGroup>
				</Field>
				<Field>
					<FieldLabel htmlFor="input-group-12">Last Name</FieldLabel>
					<InputGroup>
						<InputGroupInput id="input-group-12" placeholder="Last Name" />
						<InputGroupAddon align="inline-end">
							<InfoIcon
							/>
						</InputGroupAddon>
					</InputGroup>
				</Field>
			</FieldGroup>
			<Field data-disabled="true">
				<FieldLabel htmlFor="input-group-29">
					Loading (&quot;data-disabled=&quot;true&quot;)
				</FieldLabel>
				<InputGroup>
					<InputGroupInput
						id="input-group-29"
						disabled
						defaultValue="shadcn"
					/>
					<InputGroupAddon align="inline-end">
						<Spinner />
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
		</FieldGroup>
	);
}

export function InputGroupDemoWithTooltipDropdownPopover() {
	const [country, setCountry] = useState("+1");

	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="input-tooltip-20">Tooltip</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-tooltip-20" />
					<InputGroupAddon align="inline-end">
						<Tooltip>
							<TooltipTrigger
								render={
									<InputGroupButton className="rounded-full" size="icon-xs" />
								}
							>
								<InfoIcon
								/>
							</TooltipTrigger>
							<TooltipContent>This is content in a tooltip.</TooltipContent>
						</Tooltip>
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-dropdown-21">Dropdown</FieldLabel>
				<InputGroup>
					<InputGroupInput id="input-dropdown-21" />
					<InputGroupAddon>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<InputGroupButton className="text-muted-foreground tabular-nums" />
								}
							>
								{country}{" "}
								<ChevronDownIcon
								/>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								className="min-w-16"
								sideOffset={10}
								alignOffset={-8}
							>
								<DropdownMenuItem onClick={() => setCountry("+1")}>
									+1
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setCountry("+44")}>
									+44
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setCountry("+46")}>
									+46
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="input-secure-19">Popover</FieldLabel>
				<InputGroup>
					<Popover>
						<PopoverTrigger render={<InputGroupAddon />} nativeButton={false}>
							<InputGroupButton variant="secondary" size="icon-xs">
								<InfoIcon
								/>
							</InputGroupButton>
						</PopoverTrigger>
						<PopoverContent align="start">
							<PopoverHeader>
								<PopoverTitle>Your connection is not secure.</PopoverTitle>
								<PopoverDescription>
									You should not enter any sensitive information on this site.
								</PopoverDescription>
							</PopoverHeader>
						</PopoverContent>
					</Popover>
					<InputGroupAddon className="text-muted-foreground pl-1">
						https://
					</InputGroupAddon>
					<InputGroupInput id="input-secure-19" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							size="icon-xs"
							onClick={() => showInputGroupToast("Added to favorites", "success")}
						>
							<StarIcon
							/>
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="url">Button Group</FieldLabel>
				<ButtonGroup>
					<ButtonGroupText>https://</ButtonGroupText>
					<InputGroup>
						<InputGroupInput id="url" />
						<InputGroupAddon align="inline-end">
							<InfoIcon
							/>
						</InputGroupAddon>
					</InputGroup>
					<ButtonGroupText>.com</ButtonGroupText>
				</ButtonGroup>
				<FieldDescription>
					This is a description of the input group.
				</FieldDescription>
			</Field>
		</FieldGroup>
	);
}
