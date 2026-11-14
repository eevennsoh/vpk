"use client"

import SearchIcon from "@atlaskit/icon/core/search"
import FolderClosedIcon from "@atlaskit/icon/core/folder-closed"
import Image from "next/image"
import { ArrowUpRightIcon } from "@/components/ui/vpk-icons"
import { Button } from "@/components/ui/button"
import {
	Empty,
	EmptyBody,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty"
import { ControlledRovoIllustration } from "@/components/ui-custom/rovo-illustration"

export default function EmptyDemo() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No results found</EmptyTitle>
				<EmptyDescription>
					Try adjusting your search or filters to find what you&apos;re
					looking for.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}

export function EmptyDemoDefault() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No items</EmptyTitle>
				<EmptyDescription>
					Add items to get started.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}

export function EmptyDemoWithAction() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>Welcome to your dashboard</EmptyTitle>
				<EmptyDescription>
					Create your first project to get started with the platform.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>Create project</Button>
			</EmptyContent>
		</Empty>
	)
}

export function EmptyDemoWithActions() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No projects yet</EmptyTitle>
				<EmptyDescription>
					You haven&apos;t created any projects yet. Get started by
					creating your first project.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<div className="flex items-center gap-2">
					<Button>Create project</Button>
					<Button variant="outline">Import project</Button>
				</div>
			</EmptyContent>
		</Empty>
	)
}

export function EmptyDemoWithImage() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia>
					<Image
						src="/illustration-ai/chat/light.svg"
						alt=""
						role="presentation"
						width={160}
						height={160}
					/>
				</EmptyMedia>
				<EmptyTitle>No search results</EmptyTitle>
				<EmptyDescription>
					Try adjusting your search criteria or browse all items.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>Browse all</Button>
			</EmptyContent>
		</Empty>
	)
}

export function EmptyDemoWithImageHorizontal() {
	return (
		<Empty
			className="max-w-[800px] rounded-xl border border-dashed border-border bg-surface px-6 py-0"
			orientation="horizontal"
		>
			<EmptyMedia>
				<span aria-hidden="true">
					<ControlledRovoIllustration illusId="ai" size={96} />
				</span>
			</EmptyMedia>
			<EmptyBody>
				<EmptyHeader>
					<EmptyTitle headingSize="xsmall">No agents yet</EmptyTitle>
					<EmptyDescription>
						Browse templates or create a new agent from the prompt.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline">Browse templates</Button>
						<Button>Create agent</Button>
					</div>
				</EmptyContent>
			</EmptyBody>
		</Empty>
	)
}

export function EmptyDemoWithIcon() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FolderClosedIcon label="" />
				</EmptyMedia>
				<EmptyTitle>No projects</EmptyTitle>
				<EmptyDescription>
					Create a new project to get started.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>Create project</Button>
			</EmptyContent>
		</Empty>
	)
}

export function EmptyDemoNarrow() {
	return (
		<Empty width="narrow">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SearchIcon label="" />
				</EmptyMedia>
				<EmptyTitle>No results</EmptyTitle>
				<EmptyDescription>
					We couldn&apos;t find anything matching your search.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline" size="default">
					Clear search
				</Button>
			</EmptyContent>
		</Empty>
	)
}

export function EmptyDemoCompact() {
	return (
		<Empty width="narrow">
			<EmptyHeader>
				<EmptyTitle headingSize="xsmall">No results</EmptyTitle>
				<EmptyDescription>
					Try a different search term.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}

export function EmptyDemoWithTertiary() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>Welcome to your dashboard</EmptyTitle>
				<EmptyDescription>
					Create your first project to get started with the platform.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<div className="flex items-center gap-2">
					<Button>Create project</Button>
					<Button variant="outline">Import project</Button>
				</div>
				<Button
					variant="link"
					render={<a aria-label="Empty state link" href="#" />}
					nativeButton={false}
				>
					Learn more <ArrowUpRightIcon className="size-3.5" />
				</Button>
			</EmptyContent>
		</Empty>
	)
}
