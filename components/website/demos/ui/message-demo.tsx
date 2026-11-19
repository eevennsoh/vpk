"use client";

import { useState, type ReactElement } from "react";
import CopyIcon from "@atlaskit/icon/core/copy";
import DownloadIcon from "@atlaskit/icon/core/download";
import FileIcon from "@atlaskit/icon/core/file";
import EditIcon from "@atlaskit/icon/core/edit";
import FilesIcon from "@atlaskit/icon/core/files";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import Image from "next/image";

import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from "@/components/ui/attachment";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import { Bubble, BubbleContent, BubbleReactions } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	Marker,
	MarkerContent,
	MarkerIcon,
} from "@/components/ui/marker";
import {
	Message,
	MessageAvatar,
	MessageContent,
	MessageFooter,
	MessageGroup,
	MessageHeader,
} from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { UserMessageBubble } from "@/components/projects/shared/components/user-message-bubble";

const avatars = {
	olivia: "/avatar-human/olivia-yang.png",
	phoenix: "/avatar-human/bradley-phillips.png",
	lana: "/avatar-human/laila-ali.png",
};

const images = [
	{
		src: "/avatar-project/canvas.svg",
		alt: "Canvas project avatar",
		title: "workspace.png",
		description: "PNG · 820 KB",
	},
	{
		src: "/avatar-project/graph.svg",
		alt: "Graph project avatar",
		title: "desk-reference.jpg",
		description: "JPG · 1.1 MB",
	},
	{
		src: "/avatar-project/launch-ship.svg",
		alt: "Launch project avatar",
		title: "office-reference.jpg",
		description: "JPG · 940 KB",
	},
];

function PersonAvatar({
	alt,
	fallback,
	src,
}: Readonly<{
	alt: string;
	fallback: string;
	src: string;
}>) {
	return (
		<Avatar>
			<AvatarImage src={src} alt={alt} />
			<AvatarFallback>{fallback}</AvatarFallback>
		</Avatar>
	);
}

function DownloadAttachmentAction({
	label,
}: Readonly<{
	label: string;
}>) {
	return (
		<AttachmentActions>
			<AttachmentAction type="button" aria-label={label} title={label}>
				<Icon render={<DownloadIcon label="" size="small" />} label="" />
			</AttachmentAction>
		</AttachmentActions>
	);
}

function FileAttachment({
	description,
	icon = <FileIcon label="" size="small" />,
	title,
}: Readonly<{
	description: string;
	icon?: ReactElement;
	title: string;
}>) {
	return (
		<Attachment className="w-64">
			<AttachmentMedia>
				<Icon render={icon} label="" />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{title}</AttachmentTitle>
				<AttachmentDescription>{description}</AttachmentDescription>
			</AttachmentContent>
			<DownloadAttachmentAction label={`Download ${title}`} />
		</Attachment>
	);
}

function ImageAttachment({
	alt,
	description,
	src,
	title,
}: Readonly<{
	alt: string;
	description: string;
	src: string;
	title: string;
}>) {
	return (
		<Attachment orientation="vertical">
			<AttachmentMedia variant="image">
				<Image src={src} alt={alt} width={160} height={160} />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{title}</AttachmentTitle>
				<AttachmentDescription>{description}</AttachmentDescription>
			</AttachmentContent>
		</Attachment>
	);
}

export default function MessageDemo() {
	return <MessageDemoMessage />;
}

export function MessageDemoMessage() {
	const [prompt, setPrompt] = useState("Get Figma design context");
	const [isEditing, setIsEditing] = useState(false);
	return (
		<div className="mx-auto flex w-full max-w-md min-w-0 flex-col gap-6">
			<UserMessageBubble
				messageText={prompt}
				isEditing={isEditing}
				onStartEdit={() => setIsEditing(true)}
				onCancelEdit={() => setIsEditing(false)}
				onEdit={(text) => { setPrompt(text); setIsEditing(false); }}
				showPromptActions
			/>
			<Message align="start">
				<MessageContent>
					<Bubble variant="ghost">
						<BubbleContent className="leading-6">Please share the Figma design-file URL and, if relevant, the specific frame or page link so I can retrieve its context.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}

export function MessageDemoAvatar() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-10">
			<Message>
				<MessageAvatar>
					<PersonAvatar src={avatars.olivia} alt="Olivia Rhye" fallback="OR" />
				</MessageAvatar>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>Something went wrong. Any idea?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageAvatar>
					<PersonAvatar src={avatars.phoenix} alt="Phoenix Baker" fallback="PB" />
				</MessageAvatar>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>
							I checked the latest deployment and found the build failed during
							dependency installation.
						</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message align="end">
				<MessageAvatar>
					<PersonAvatar src={avatars.lana} alt="Lana Steiner" fallback="LS" />
				</MessageAvatar>
				<MessageContent>
					<Bubble>
						<BubbleContent>Something went wrong. Any idea?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageAvatar>
					<Avatar>
						<AvatarFallback>CN</AvatarFallback>
					</Avatar>
				</MessageAvatar>
				<MessageContent>
					<Bubble variant="destructive">
						<BubbleContent>Something went wrong. Any idea?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}

export function MessageDemoGroup() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-10">
			<MessageGroup>
				<Message>
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>I checked the registry addresses.</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
				<Message>
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>
								The component and example JSON now live under the UI registry.
							</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
			</MessageGroup>
			<MessageGroup>
				<Message align="end">
					<MessageContent>
						<Bubble>
							<BubbleContent>I checked the registry addresses.</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
				<Message align="end">
					<MessageContent>
						<Bubble>
							<BubbleContent>
								The component and example JSON now live under the UI registry.
							</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
			</MessageGroup>
			<MessageGroup>
				<Message>
					<MessageAvatar />
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>I checked the registry addresses.</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
				<Message>
					<MessageAvatar>
						<PersonAvatar src={avatars.olivia} alt="Olivia Rhye" fallback="OR" />
					</MessageAvatar>
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>
								The component and example JSON now live under the UI registry.
							</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
			</MessageGroup>
		</div>
	);
}

export function MessageDemoGroupChat() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-10">
			<Message align="end">
				<MessageContent>
					<Bubble variant="tinted">
						<BubbleContent>Why is the dashboard showing zero users?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<MessageGroup>
				<Message>
					<MessageAvatar />
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>Define &quot;zero.&quot;</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
				<Message>
					<MessageAvatar>
						<PersonAvatar src={avatars.phoenix} alt="Phoenix Baker" fallback="PB" />
					</MessageAvatar>
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>What do you mean?</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
			</MessageGroup>
			<Message align="end">
				<MessageContent>
					<Bubble variant="tinted">
						<BubbleContent>
							<span className="font-medium">@eve</span> can you check?
						</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<Marker role="status">
					<MarkerIcon>
						<Spinner />
					</MarkerIcon>
					<MarkerContent>Checking the logs...</MarkerContent>
				</Marker>
			</Message>
			<Message>
				<MessageContent>
					<MessageHeader>Eve</MessageHeader>
					<Bubble variant="ghost">
						<BubbleContent>
							<span className="whitespace-pre-wrap">
								{`I found the following error in the logs:

- Error: No users found
- Stack trace:
  - at src/users/services/user-service.ts:123
  - at src/users/services/get-user.ts:230

Can you check if the users are being created?`}
							</span>
						</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}

export function MessageDemoHeaderAndFooter() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-12">
			<Message align="end">
				<MessageContent>
					<MessageHeader className="justify-end">You</MessageHeader>
					<Bubble>
						<BubbleContent>
							Can we keep this style quiet and send the update today?
						</BubbleContent>
					</Bubble>
					<MessageFooter className="gap-2">
						<span>Delivered</span>
						<Button variant="ghost" size="compact">Undo</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
			<Message align="start">
				<MessageContent>
					<MessageHeader>
						<span>Olivia</span>
						<span className="ml-auto font-normal">1m ago</span>
					</MessageHeader>
					<Bubble variant="muted">
						<BubbleContent>
							I checked the logs. The retry finished and the missing invoices
							are included now.
						</BubbleContent>
						<BubbleReactions>
							<Button variant="ghost" size="compact">Thanks</Button>
						</BubbleReactions>
					</Bubble>
					<MessageFooter className="gap-2">
						<span>From Support queue</span>
						<Button variant="ghost" size="compact">Copy</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
			<Message align="end">
				<MessageContent>
					<MessageHeader className="justify-end">
						Automation warning
					</MessageHeader>
					<Bubble variant="destructive">
						<BubbleContent>
							The old export link expires in 10 minutes. Regenerate before
							sending this transcript externally.
						</BubbleContent>
					</Bubble>
					<MessageFooter className="gap-2">
						<span>Needs action</span>
						<Button variant="destructive" size="compact">Regenerate</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
		</div>
	);
}

export function MessageDemoActions() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-10">
			<Message align="end">
				<MessageContent>
					<Bubble>
						<BubbleContent>What is the status of the deployment?</BubbleContent>
					</Bubble>
					<MessageFooter>
						<Button variant="ghost" size="icon-compact" aria-label="Copy" title="Copy">
							<Icon render={<CopyIcon label="" size="small" />} label="" />
						</Button>
						<Button variant="ghost" size="icon-compact" aria-label="Edit" title="Edit">
							<Icon render={<EditIcon label="" size="small" />} label="" />
						</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
			<Message>
				<MessageAvatar>
					<PersonAvatar src={avatars.phoenix} alt="Phoenix Baker" fallback="PB" />
				</MessageAvatar>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>
							The install failure is coming from the workspace package. I can
							open the exact log line or retry the deployment.
						</BubbleContent>
					</Bubble>
					<MessageFooter>
						<Button variant="ghost" size="icon-compact" aria-label="Copy" title="Copy">
							<Icon render={<CopyIcon label="" size="small" />} label="" />
						</Button>
						<Button variant="ghost" size="icon-compact" aria-label="Like: thumbs up" title="Like: thumbs up">
							<Icon render={<ThumbsUpIcon label="" size="small" />} label="" />
						</Button>
						<Button variant="ghost" size="icon-compact" aria-label="Like: thumbs down" title="Like: thumbs down">
							<Icon render={<ThumbsDownIcon label="" size="small" />} label="" />
						</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
			<Message align="end">
				<MessageContent>
					<Bubble>
						<BubbleContent>Okay drop me a link. I&apos;ll check it out.</BubbleContent>
					</Bubble>
					<MessageFooter className="gap-2">
						<span className="font-normal text-destructive">Failed to send</span>
						<Button variant="secondary" size="compact">Retry</Button>
					</MessageFooter>
				</MessageContent>
			</Message>
		</div>
	);
}

export function MessageDemoAttachment() {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-8">
			<Message align="end">
				<MessageContent>
					<Attachment orientation="vertical">
						<AttachmentMedia variant="image">
							<Image src={images[0].src} alt={images[0].alt} width={160} height={160} />
						</AttachmentMedia>
					</Attachment>
					<Bubble>
						<BubbleContent>
							Here&apos;s the image. Can you add it to the PDF? Use it for the
							cover page.
						</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>
							Done. Here&apos;s the PDF with the image added as the cover page.
						</BubbleContent>
					</Bubble>
					<FileAttachment title="sales-dashboard.pdf" description="PDF · 2.4 MB" />
				</MessageContent>
			</Message>
			<Message align="end">
				<MessageContent>
					<Bubble>
						<BubbleContent>Thanks. Looks good.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}

export function MessageDemoAttachmentGroup() {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-8">
			<Message align="end">
				<MessageContent>
					{/* The images overflow and have no actions, so the scroll region itself takes focus. */}
					<AttachmentGroup
						role="group"
						aria-label="Attached images"
						tabIndex={0}
						className="w-[80%] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{images.map((image) => (
							<ImageAttachment key={image.title} {...image} />
						))}
					</AttachmentGroup>
					<Bubble>
						<BubbleContent>
							Here are the brand photos. Can you add them to the deck?
						</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>
							Done. Here&apos;s the draft deck and the exported assets.
						</BubbleContent>
					</Bubble>
					<AttachmentGroup className="w-full">
						<FileAttachment title="brand-deck.pdf" description="PDF · 3.1 MB" />
						<FileAttachment
							title="brand-deck.key"
							description="Keynote · 9 MB"
							icon={<FilesIcon label="" size="small" />}
						/>
						<FileAttachment
							title="brand-assets.zip"
							description="ZIP · 4.2 MB"
							icon={<FilesIcon label="" size="small" />}
						/>
					</AttachmentGroup>
				</MessageContent>
			</Message>
		</div>
	);
}
