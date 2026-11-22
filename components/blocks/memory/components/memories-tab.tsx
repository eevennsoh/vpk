"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty"
import {
	InputGroup,
	InputGroupSearchAddon,
	InputGroupInput,
} from "@/components/ui/input-group"
import { PlusIcon, SearchIcon } from "@/components/ui/vpk-icons"
import { List } from "@/components/ui-custom/list"

import { MEMORY_COLUMNS } from "../data/memory-data"
import { useMemories } from "../hooks/use-memories"
import { MemoryRow } from "./memory-row"

/** Tab 2: searchable list of memories the user has shared, with add/delete. */
export function MemoriesTab() {
	const {
		filteredMemories,
		query,
		setQuery,
		isAdding,
		draft,
		setDraft,
		confirmingId,
		startAdding,
		cancelAdding,
		addMemory,
		requestDelete,
		cancelDelete,
		confirmDelete,
	} = useMemories()

	const hasQuery = query.trim().length > 0
	const isEmpty = filteredMemories.length === 0

	return (
		<div className="flex flex-col gap-4 pt-4">
			<InputGroup>
				<InputGroupSearchAddon>
					<SearchIcon />
				</InputGroupSearchAddon>
				<InputGroupInput
					placeholder="Search memories"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</InputGroup>

			{isEmpty ? (
				hasQuery ? (
					<p className="py-8 text-center text-sm text-text-subtle">
						No memories match &ldquo;{query}&rdquo;.
					</p>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="default">
								<Image
									alt=""
									className="dark:hidden [[data-color-mode=dark]_&]:hidden"
									height={160}
									src="/illustration-ai/write/light.svg"
									width={160}
								/>
								<Image
									alt=""
									className="hidden dark:block [[data-color-mode=dark]_&]:block"
									height={160}
									src="/illustration-ai/write/dark.svg"
									width={160}
								/>
							</EmptyMedia>
							<EmptyTitle>Ready to remember!</EmptyTitle>
							<EmptyDescription>
								Rovo will automatically save details from your chats. You can also add them to remember things about you and how you like to work.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)
			) : (
				<List.Root>
					<List.Table columns={MEMORY_COLUMNS}>
						{filteredMemories.map((memory) => (
							<MemoryRow
								key={memory.id}
								memory={memory}
								isConfirming={confirmingId === memory.id}
								onRequestDelete={requestDelete}
								onConfirmDelete={confirmDelete}
								onCancelDelete={cancelDelete}
							/>
						))}
					</List.Table>
				</List.Root>
			)}

			{isAdding ? (
				<div className="flex flex-col gap-2">
					<InputGroup>
						<InputGroupInput
							autoFocus
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") addMemory()
								if (event.key === "Escape") cancelAdding()
							}}
							placeholder="e.g. role, my main responsibilities…"
							value={draft}
						/>
					</InputGroup>
					<p className="text-xs text-text-subtlest">
						Share a new detail with Rovo you want it to remember
					</p>
					<div className="flex justify-end gap-2">
						<Button onClick={cancelAdding} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={draft.trim().length === 0}
							onClick={addMemory}
							variant="default"
						>
							Save
						</Button>
					</div>
				</div>
			) : (
				<div className="flex justify-end">
					<Button onClick={startAdding} variant="default">
						<PlusIcon />
						Add new memory
					</Button>
				</div>
			)}
		</div>
	)
}
