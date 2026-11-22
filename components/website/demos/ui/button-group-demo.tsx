import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, AudioLinesIcon, CheckIcon, ChevronDownIcon, CopyIcon, FlipHorizontalIcon, FlipVerticalIcon, HeartIcon, MinusIcon, PlusIcon, RotateCwIcon, SearchIcon, ShareIcon, TrashIcon, UserRoundXIcon, VolumeXIcon as VolumeX } from "@/components/ui/vpk-icons";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupSearchAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ButtonGroupDemo() {
	return (
		<ButtonGroup>
			<Button variant="outline" size="default">Left</Button>
			<Button variant="outline" size="default">Center</Button>
			<Button variant="outline" size="default">Right</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoBasic() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup>
				<Button variant="outline">Button</Button>
				<Button variant="outline">Another Button</Button>
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoDefault() {
	return (
		<ButtonGroup>
			<Button variant="outline">Left</Button>
			<Button variant="outline">Center</Button>
			<Button variant="outline">Right</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoNavigation() {
	return (
		<ButtonGroup>
			<ButtonGroup>
				<Button variant="outline">
					<ArrowLeftIcon />
				</Button>
				<Button variant="outline">
					<ArrowRightIcon />
				</Button>
			</ButtonGroup>
			<ButtonGroup aria-label="Single navigation button">
				<Button variant="outline" size="icon">
					<ArrowLeftIcon />
				</Button>
			</ButtonGroup>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoNested() {
	return (
		<ButtonGroup>
			<ButtonGroup>
				<Button variant="outline" size="icon">
					<PlusIcon />
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<InputGroup>
					<InputGroupInput placeholder="Send a message..." />
					<Tooltip>
						<TooltipTrigger render={<InputGroupAddon align="inline-end" />}>
							<AudioLinesIcon />
						</TooltipTrigger>
						<TooltipContent>Voice Mode</TooltipContent>
					</Tooltip>
				</InputGroup>
			</ButtonGroup>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoPaginationSplit() {
	return (
		<ButtonGroup>
			<ButtonGroup>
				<Button variant="outline" size="default">
					1
				</Button>
				<Button variant="outline" size="default">
					2
				</Button>
				<Button variant="outline" size="default">
					3
				</Button>
				<Button variant="outline" size="default">
					4
				</Button>
				<Button variant="outline" size="default">
					5
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<Button variant="outline" size="icon-compact">
					<ArrowLeftIcon />
				</Button>
				<Button variant="outline" size="icon-compact">
					<ArrowRightIcon />
				</Button>
			</ButtonGroup>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoPagination() {
	return (
		<ButtonGroup>
			<Button variant="outline" size="default">
				<ArrowLeftIcon data-icon="inline-start" />
				Previous
			</Button>
			<Button variant="outline" size="default">
				1
			</Button>
			<Button variant="outline" size="default">
				2
			</Button>
			<Button variant="outline" size="default">
				3
			</Button>
			<Button variant="outline" size="default">
				4
			</Button>
			<Button variant="outline" size="default">
				5
			</Button>
			<Button variant="outline" size="default">
				Next
				<ArrowRightIcon data-icon="inline-end" />
			</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoTextAlignment() {
	return (
		<Field>
			<Label id="alignment-label">Text Alignment</Label>
			<ButtonGroup aria-labelledby="alignment-label">
				<Button variant="outline" size="default">
					Left
				</Button>
				<Button variant="outline" size="default">
					Center
				</Button>
				<Button variant="outline" size="default">
					Right
				</Button>
				<Button variant="outline" size="default">
					Justify
				</Button>
			</ButtonGroup>
		</Field>
	);
}

export function ButtonGroupDemoVerticalIcons() {
	return (
		<div className="flex gap-6">
			<ButtonGroup
				orientation="vertical"
				aria-label="Media controls"
				className="h-fit"
			>
				<Button variant="outline" size="icon">
					<PlusIcon />
				</Button>
				<Button variant="outline" size="icon">
					<MinusIcon />
				</Button>
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoVerticalNested() {
	return (
		<ButtonGroup orientation="vertical" aria-label="Design tools palette">
			<ButtonGroup orientation="vertical">
				<Button variant="outline" size="icon">
					<SearchIcon />
				</Button>
				<Button variant="outline" size="icon">
					<CopyIcon />
				</Button>
				<Button variant="outline" size="icon">
					<ShareIcon />
				</Button>
			</ButtonGroup>
			<ButtonGroup orientation="vertical">
				<Button variant="outline" size="icon">
					<FlipHorizontalIcon />
				</Button>
				<Button variant="outline" size="icon">
					<FlipVerticalIcon />
				</Button>
				<Button variant="outline" size="icon">
					<RotateCwIcon />
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<Button variant="outline" size="icon">
					<TrashIcon />
				</Button>
			</ButtonGroup>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoVertical() {
	return (
		<ButtonGroup orientation="vertical">
			<Button variant="outline">Top</Button>
			<Button variant="outline">Middle</Button>
			<Button variant="outline">Bottom</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoWithDropdown() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup>
				<Button variant="outline">Update</Button>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="outline" size="icon" />}
					>
						<ChevronDownIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>Disable</DropdownMenuItem>
						<DropdownMenuItem variant="destructive">
							Uninstall
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
			<ButtonGroup>
				<Button variant="outline">Follow</Button>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="outline" size="icon" />}
					>
						<ChevronDownIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-50">
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<VolumeX />
								Mute Conversation
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CheckIcon />
								Mark as Read
							</DropdownMenuItem>
							<DropdownMenuItem>
								<AlertTriangleIcon />
								Report Conversation
							</DropdownMenuItem>
							<DropdownMenuItem>
								<UserRoundXIcon />
								Block User
							</DropdownMenuItem>
							<DropdownMenuItem>
								<ShareIcon />
								Share Conversation
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CopyIcon />
								Copy Conversation
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem variant="destructive">
								<TrashIcon />
								Delete Conversation
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoWithFields() {
	return (
		<FieldGroup className="grid grid-cols-3 gap-4">
			<Field className="col-span-2">
				<Label htmlFor="width">Width</Label>
				<ButtonGroup>
					<InputGroup>
						<InputGroupInput id="width" />
						<InputGroupAddon className="text-muted-foreground">
							W
						</InputGroupAddon>
						<InputGroupAddon
							align="inline-end"
							className="text-muted-foreground"
						>
							px
						</InputGroupAddon>
					</InputGroup>
					<Button variant="outline" size="icon">
						<MinusIcon />
					</Button>
					<Button variant="outline" size="icon">
						<PlusIcon />
					</Button>
				</ButtonGroup>
			</Field>
		</FieldGroup>
	);
}

export function ButtonGroupDemoWithIcons() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup>
				<Button variant="outline">
					<FlipHorizontalIcon />
				</Button>
				<Button variant="outline">
					<FlipVerticalIcon />
				</Button>
				<Button variant="outline">
					<RotateCwIcon />
				</Button>
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoWithInputGroup() {
	return (
		<div className="flex flex-col gap-4">
			<InputGroup>
				<InputGroupInput placeholder="Type to search..." />
				<InputGroupSearchAddon
					align="inline-start"
				>
					<SearchIcon />
				</InputGroupSearchAddon>
			</InputGroup>
		</div>
	);
}

export function ButtonGroupDemoWithInput() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup>
				<Button variant="outline">Button</Button>
				<Input placeholder="Type something here..." />
			</ButtonGroup>
			<ButtonGroup>
				<Input placeholder="Type something here..." />
				<Button variant="outline">Button</Button>
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoWithLike() {
	return (
		<ButtonGroup>
			<Button variant="outline">
				<HeartIcon data-icon="inline-start" />{" "}
				Like
			</Button>
			<Button
				variant="outline"
				size="icon"
				className="w-12"
				render={<span />}
				nativeButton={false}
			>
				1.2K
			</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoWithSelectAndInput() {
	const durationItems = [
		{ value: "hours", label: "Hours" },
		{ value: "days", label: "Days" },
		{ value: "weeks", label: "Weeks" },
		{ value: "months", label: "Months" },
	];

	return (
		<ButtonGroup>
			<Select items={durationItems} defaultValue={durationItems[0]}>
				<SelectTrigger id="duration">
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="start">
					<SelectGroup>
						{durationItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<Input />
		</ButtonGroup>
	);
}

export function ButtonGroupDemoWithSelect() {
	const currencyItems = [
		{ value: "usd", label: "USD" },
		{ value: "eur", label: "EUR" },
		{ value: "gbp", label: "GBP" },
		{ value: "jpy", label: "JPY" },
	];

	return (
		<Field>
			<Label htmlFor="amount">Amount</Label>
			<ButtonGroup>
				<Select items={currencyItems} defaultValue={currencyItems[0]}>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{currencyItems.map((item) => (
								<SelectItem key={item.value} value={item}>
									{item.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<Input placeholder="Enter amount to send" />
				<Button variant="outline">
					<ArrowRightIcon />
				</Button>
			</ButtonGroup>
		</Field>
	);
}

export function ButtonGroupDemoWithSeparator() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<ButtonGroup variant="split">
				<Button variant="outline">Link work item</Button>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button aria-label="More link actions" size="icon" variant="outline" />}
					>
						<ChevronDownIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>Option one</DropdownMenuItem>
						<DropdownMenuItem>Option two</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
			<ButtonGroup variant="split">
				<Button>Update</Button>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button aria-label="More update actions" size="icon" />}
					>
						<ChevronDownIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>Option one</DropdownMenuItem>
						<DropdownMenuItem>Option two</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoWithText() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup>
				<ButtonGroupText>Text</ButtonGroupText>
				<Button variant="outline">Another Button</Button>
			</ButtonGroup>
			<ButtonGroup>
				<ButtonGroupText render={<Label htmlFor="input-text" />}>
					GPU Size
				</ButtonGroupText>
				<Input id="input-text" placeholder="Type something here..." />
			</ButtonGroup>
		</div>
	);
}

export function ButtonGroupDemoSeparated() {
	return (
		<ButtonGroup variant="separated">
			<Button>Save</Button>
			<Button variant="destructive">Delete</Button>
			<Button variant="ghost">Cancel</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoSeparatedOutline() {
	return (
		<ButtonGroup variant="separated">
			<Button variant="outline">First</Button>
			<Button variant="outline">Second</Button>
			<Button variant="outline">Third</Button>
		</ButtonGroup>
	);
}

export function ButtonGroupDemoVariants() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup>
				<Button variant="outline">Connected (default)</Button>
				<Button variant="outline">Buttons</Button>
				<Button variant="outline">Merge borders</Button>
			</ButtonGroup>
			<ButtonGroup variant="separated">
				<Button variant="outline">Separated</Button>
				<Button variant="outline">Buttons</Button>
				<Button variant="outline">Keep gaps</Button>
			</ButtonGroup>
		</div>
	);
}
