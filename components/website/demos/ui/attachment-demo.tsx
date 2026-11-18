"use client";

import type { ReactElement } from "react";
import ArchiveBoxIcon from "@atlaskit/icon/core/archive-box";
import AttachmentIcon from "@atlaskit/icon/core/attachment";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ClockIcon from "@atlaskit/icon/core/clock";
import CopyIcon from "@atlaskit/icon/core/copy";
import CrossIcon from "@atlaskit/icon/core/cross";
import DownloadIcon from "@atlaskit/icon/core/download";
import FileIcon from "@atlaskit/icon/core/file";
import FilesIcon from "@atlaskit/icon/core/files";
import ImageIcon from "@atlaskit/icon/core/image";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import SearchIcon from "@atlaskit/icon/core/search";
import TableIcon from "@atlaskit/icon/core/table";
import WarningIcon from "@atlaskit/icon/core/warning";
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
	AttachmentTrigger,
} from "@/components/ui/attachment";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

const imageAttachments = [
	{
		name: "workspace.png",
		meta: "PNG · 820 KB",
		src: "/avatar-project/canvas.svg",
		alt: "Canvas project avatar",
	},
	{
		name: "desk-reference.jpg",
		meta: "JPG · 1.1 MB",
		src: "/avatar-project/graph.svg",
		alt: "Graph project avatar",
	},
	{
		name: "office-reference.jpg",
		meta: "JPG · 940 KB",
		src: "/avatar-project/launch-ship.svg",
		alt: "Launch project avatar",
	},
];

const imageStateAttachments = [
	{ ...imageAttachments[0], state: "idle", status: "Ready" },
	{ ...imageAttachments[1], state: "uploading", status: "Uploading" },
	{ ...imageAttachments[2], state: "processing", status: "Processing" },
	{ ...imageAttachments[0], state: "error", status: "Failed" },
	{ ...imageAttachments[1], state: "done", status: "Done" },
] as const;

function RemoveAction({ label }: Readonly<{ label: string }>) {
	return (
		<AttachmentAction aria-label={label}>
			<Icon render={<CrossIcon label="" size="small" />} label="" />
		</AttachmentAction>
	);
}

function FileAttachment({
	state = "done",
	title = "research-notes.pdf",
	description = "2.4 MB",
	icon = <FileIcon label="" size="medium" />,
	className,
}: Readonly<{
	state?: "idle" | "uploading" | "processing" | "error" | "done";
	title?: string;
	description?: string;
	icon?: ReactElement;
	className?: string;
}>) {
	return (
		<Attachment state={state} className={className}>
			<AttachmentMedia>
				{state === "uploading" ? (
					<Spinner />
				) : (
					<Icon render={icon} label="" />
				)}
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{title}</AttachmentTitle>
				<AttachmentDescription>{description}</AttachmentDescription>
			</AttachmentContent>
			<AttachmentActions>
				<RemoveAction label={`Remove ${title}`} />
			</AttachmentActions>
		</Attachment>
	);
}

function ImageAttachment({
	alt,
	description,
	name,
	src,
	state = "done",
}: Readonly<{
	alt: string;
	description: string;
	name: string;
	src: string;
	state?: "idle" | "uploading" | "processing" | "error" | "done";
}>) {
	return (
		<Attachment state={state} orientation="vertical">
			<AttachmentMedia variant="image">
				<Image src={src} alt={alt} width={160} height={160} />
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{name}</AttachmentTitle>
				<AttachmentDescription>{description}</AttachmentDescription>
			</AttachmentContent>
			<AttachmentActions>
				<RemoveAction label={`Remove ${name}`} />
			</AttachmentActions>
			<AttachmentTrigger
				render={
					<a
						href={src}
						target="_blank"
						rel="noreferrer"
						aria-label={`Open ${name}`}
					/>
				}
			/>
		</Attachment>
	);
}

export default function AttachmentDemo() {
	return <AttachmentDemoDefault />;
}

export function AttachmentDemoDefault() {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-3">
			<AttachmentGroup>
				{imageAttachments.map((image) => (
					<ImageAttachment
						key={image.name}
						name={image.name}
						description={image.meta}
						src={image.src}
						alt={image.alt}
					/>
				))}
			</AttachmentGroup>
			<FileAttachment
				state="uploading"
				title="sales-dashboard.pdf"
				description="Uploading · 64%"
				icon={<AttachmentIcon label="" size="medium" />}
				className="w-full"
			/>
			<FileAttachment
				title="message-renderer.tsx"
				description="TypeScript · 12 KB"
				icon={<FilesIcon label="" size="medium" />}
				className="w-full"
			/>
		</div>
	);
}

export function AttachmentDemoFiles() {
	return (
		<div className="flex w-full flex-col gap-6">
			<div className="flex w-full flex-col gap-2">
				<div className="px-1 text-xs font-medium text-text-subtle">Horizontal</div>
				<div className="flex flex-col gap-3">
					<FileAttachment
						title="sales-dashboard.pdf"
						description="PDF · 2.4 MB"
						className="w-full"
					/>
					<FileAttachment
						title="customer-import.csv"
						description="CSV · 18 KB"
						icon={<TableIcon label="" size="medium" />}
						className="w-full"
					/>
					<FileAttachment
						title="message-renderer.tsx"
						description="TypeScript · 12 KB"
						icon={<FilesIcon label="" size="medium" />}
						className="w-full"
					/>
				</div>
			</div>
			<div className="flex w-full flex-col gap-2">
				<div className="px-1 text-xs font-medium text-text-subtle">Vertical</div>
				<AttachmentGroup className="w-full">
					<Attachment orientation="vertical">
						<AttachmentMedia>
							<Icon render={<FileIcon label="" size="medium" />} label="" />
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>sales-dashboard.pdf</AttachmentTitle>
							<AttachmentDescription>PDF · 2.4 MB</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove sales-dashboard.pdf" />
						</AttachmentActions>
					</Attachment>
					<Attachment orientation="vertical">
						<AttachmentMedia>
							<Icon render={<TableIcon label="" size="medium" />} label="" />
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>customer-import.csv</AttachmentTitle>
							<AttachmentDescription>CSV · 18 KB</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove customer-import.csv" />
						</AttachmentActions>
					</Attachment>
					<Attachment orientation="vertical">
						<AttachmentMedia>
							<Icon render={<FilesIcon label="" size="medium" />} label="" />
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>source-assets.zip</AttachmentTitle>
							<AttachmentDescription>ZIP · 4.2 MB</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove source-assets.zip" />
						</AttachmentActions>
					</Attachment>
					<Attachment orientation="vertical">
						<AttachmentMedia>
							<Icon render={<ArchiveBoxIcon label="" size="medium" />} label="" />
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle>quarterly-review.key</AttachmentTitle>
							<AttachmentDescription>Keynote · 9 MB</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove quarterly-review.key" />
						</AttachmentActions>
					</Attachment>
				</AttachmentGroup>
			</div>
		</div>
	);
}

export function AttachmentDemoContentOnly() {
	return (
		<div className="flex w-full flex-col gap-6">
			<div className="flex w-full flex-col gap-2">
				<div className="px-1 text-xs font-medium text-text-subtle">Title</div>
				<div className="flex flex-col gap-3">
					<Attachment className="w-full">
						<AttachmentContent>
							<AttachmentTitle>React Documentation</AttachmentTitle>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove React Documentation" />
						</AttachmentActions>
					</Attachment>
					<Attachment className="w-full">
						<AttachmentContent>
							<AttachmentTitle>Tailwind CSS</AttachmentTitle>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove Tailwind CSS" />
						</AttachmentActions>
					</Attachment>
				</div>
			</div>
			<div className="flex w-full flex-col gap-2">
				<div className="px-1 text-xs font-medium text-text-subtle">
					Title and description
				</div>
				<div className="flex flex-col gap-3">
					<Attachment className="w-full">
						<AttachmentContent>
							<AttachmentTitle>Building accessible components</AttachmentTitle>
							<AttachmentDescription>react.dev · 8 min read</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<RemoveAction label="Remove Building accessible components" />
						</AttachmentActions>
					</Attachment>
					<Attachment size="sm" className="w-full max-w-80">
						<AttachmentContent>
							<AttachmentTitle>Compound components in React</AttachmentTitle>
							<AttachmentDescription>ui.shadcn.com/docs</AttachmentDescription>
						</AttachmentContent>
						<AttachmentTrigger
							render={
								<a
									href="https://ui.shadcn.com/docs"
									target="_blank"
									rel="noopener noreferrer"
									aria-label="Open Compound components in React"
								/>
							}
						/>
					</Attachment>
				</div>
			</div>
		</div>
	);
}

export function AttachmentDemoStates() {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
			<FileAttachment
				state="idle"
				title="selected-file.pdf"
				description="Ready to upload"
				icon={<ClockIcon label="" size="medium" />}
				className="w-full"
			/>
			<FileAttachment
				state="uploading"
				title="design-system.zip"
				description="Uploading · 64%"
				icon={<AttachmentIcon label="" size="medium" />}
				className="w-full"
			/>
			<FileAttachment
				state="processing"
				title="market-research.pdf"
				description="Processing document"
				className="w-full"
			/>
			<Attachment state="error" className="w-full">
				<AttachmentMedia>
					<Icon render={<WarningIcon label="" size="medium" />} label="" />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>financial-model.xlsx</AttachmentTitle>
					<AttachmentDescription>Upload failed. Try again.</AttachmentDescription>
				</AttachmentContent>
				<AttachmentActions>
					<AttachmentAction aria-label="Retry upload">
						<Icon render={<RefreshIcon label="" size="small" />} label="" />
					</AttachmentAction>
					<RemoveAction label="Remove financial-model.xlsx" />
				</AttachmentActions>
			</Attachment>
			<FileAttachment
				state="done"
				title="uploaded-report.pdf"
				description="Uploaded · 1.8 MB"
				icon={<CheckMarkIcon label="" size="medium" />}
				className="w-full"
			/>
		</div>
	);
}

export function AttachmentDemoImages() {
	return (
		<AttachmentGroup className="mx-auto w-full max-w-sm">
			{imageAttachments.map((image) => (
				<ImageAttachment
					key={image.name}
					name={image.name}
					description={image.meta}
					src={image.src}
					alt={image.alt}
				/>
			))}
		</AttachmentGroup>
	);
}

export function AttachmentDemoImageStates() {
	return (
		<AttachmentGroup className="mx-auto w-fit max-w-full">
			{imageStateAttachments.map((image) => (
				<ImageAttachment
					key={`${image.name}-${image.state}`}
					name={image.name}
					description={image.status}
					src={image.src}
					alt={image.alt}
					state={image.state}
				/>
			))}
		</AttachmentGroup>
	);
}

export function AttachmentDemoSizes() {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-3">
			<Attachment size="default" className="w-full">
				<AttachmentMedia>
					<Icon render={<FileIcon label="" size="medium" />} label="" />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>Default attachment</AttachmentTitle>
					<AttachmentDescription>PDF · 2.4 MB</AttachmentDescription>
				</AttachmentContent>
			</Attachment>
			<Attachment size="sm" className="w-full">
				<AttachmentMedia>
					<Icon render={<FileIcon label="" size="medium" />} label="" />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>Small attachment</AttachmentTitle>
					<AttachmentDescription>PDF · 2.4 MB</AttachmentDescription>
				</AttachmentContent>
			</Attachment>
			<Attachment size="xs" className="w-full">
				<AttachmentMedia>
					<Icon render={<FileIcon label="" size="medium" />} label="" />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>Extra small attachment</AttachmentTitle>
				</AttachmentContent>
			</Attachment>
		</div>
	);
}

export function AttachmentDemoGroup() {
	const items = [
		{ name: "briefing-notes.pdf", meta: "PDF · 1.4 MB", icon: <FileIcon label="" size="medium" /> },
		{ name: "workspace.png", meta: "PNG · 820 KB", image: imageAttachments[0] },
		{ name: "customers.csv", meta: "CSV · 18 KB", icon: <TableIcon label="" size="medium" /> },
		{ name: "renderer.tsx", meta: "TSX · 12 KB", icon: <FilesIcon label="" size="medium" /> },
	] as const;

	return (
		<AttachmentGroup className="mx-auto w-full max-w-sm">
			{items.map((item) => (
				<Attachment key={item.name} className="w-64">
					{"image" in item ? (
						<AttachmentMedia variant="image">
							<Image
								src={item.image.src}
								alt={item.image.alt}
								width={160}
								height={160}
							/>
						</AttachmentMedia>
					) : (
						<AttachmentMedia>
							<Icon render={item.icon} label="" />
						</AttachmentMedia>
					)}
					<AttachmentContent>
						<AttachmentTitle>{item.name}</AttachmentTitle>
						<AttachmentDescription>{item.meta}</AttachmentDescription>
					</AttachmentContent>
					<AttachmentActions>
						<RemoveAction label={`Remove ${item.name}`} />
					</AttachmentActions>
				</Attachment>
			))}
		</AttachmentGroup>
	);
}

export function AttachmentDemoTrigger() {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-3">
			<Attachment className="w-full">
				<AttachmentMedia>
					<Icon render={<DownloadIcon label="" size="medium" />} label="" />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>contract-review.pdf</AttachmentTitle>
					<AttachmentDescription>PDF · 820 KB</AttachmentDescription>
				</AttachmentContent>
				<AttachmentActions>
					<AttachmentAction aria-label="Download contract-review.pdf">
						<Icon render={<DownloadIcon label="" size="small" />} label="" />
					</AttachmentAction>
					<RemoveAction label="Remove contract-review.pdf" />
				</AttachmentActions>
				<AttachmentTrigger
					render={
						<a
							href="/avatar-project/canvas.svg"
							target="_blank"
							rel="noreferrer"
							aria-label="Open contract-review.pdf"
						/>
					}
				/>
			</Attachment>
			<Dialog>
				<Attachment className="w-full">
					<AttachmentMedia>
						<Icon render={<SearchIcon label="" size="medium" />} label="" />
					</AttachmentMedia>
					<AttachmentContent>
						<AttachmentTitle>research-summary.pdf</AttachmentTitle>
						<AttachmentDescription>Open preview dialog</AttachmentDescription>
					</AttachmentContent>
					<AttachmentActions>
						<AttachmentAction aria-label="Copy link">
							<Icon render={<CopyIcon label="" size="small" />} label="" />
						</AttachmentAction>
						<RemoveAction label="Remove research-summary.pdf" />
					</AttachmentActions>
					<DialogTrigger
						render={<AttachmentTrigger aria-label="Preview research-summary.pdf" />}
					/>
				</Attachment>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>research-summary.pdf</DialogTitle>
						<DialogDescription>
							The attachment trigger fills the card and opens this dialog while
							the actions stay independently clickable above it.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export function AttachmentDemoOrientation() {
	return (
		<div className="flex flex-wrap items-start gap-3">
			<FileAttachment />
			<Attachment orientation="vertical">
				<AttachmentMedia>
					<Icon render={<ImageIcon label="" size="medium" />} label="" />
				</AttachmentMedia>
				<AttachmentContent>
					<AttachmentTitle>brief.txt</AttachmentTitle>
					<AttachmentDescription>16 KB</AttachmentDescription>
				</AttachmentContent>
			</Attachment>
		</div>
	);
}
