"use client";

import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupSearchAddon, InputGroupInput } from "@/components/ui/input-group";
import Heading from "@/components/ui/heading";
import ExampleCard from "./example-card";
import { CheckboxFilterDropdown } from "./checkbox-filter-dropdown";
import { getExamplePrompt, CHAT_GALLERY_ROLE_OPTIONS, CHAT_GALLERY_USE_CASE_OPTIONS, type ChatGalleryExample } from "../data/examples";
import { useExampleFilters } from "../hooks/use-example-filters";
import animationStyles from "./discover-more-examples.module.css";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";
import SearchIcon from "@atlaskit/icon/core/search";

interface DiscoverMoreExamplesProps {
	onExampleClick: (prompt: string) => void;
	onExamplePreviewStart?: (prompt: string) => void;
	onExamplePreviewEnd?: () => void;
	onClose: () => void;
	examples?: readonly ChatGalleryExample[];
	isClosing?: boolean;
}

export default function DiscoverMoreExamples({ onExampleClick, onExamplePreviewStart, onExamplePreviewEnd, onClose, examples, isClosing = false }: Readonly<DiscoverMoreExamplesProps>) {
	const { searchTerm, setSearchTerm, selectedUseCases, selectedRoles, filteredExamples, toggleUseCase, toggleRole } = useExampleFilters(examples);

	return (
		<div className="flex w-full flex-col">
			<div className={cn("flex flex-col", isClosing ? animationStyles.animateOut : animationStyles.animateIn)} style={{ gap: token("space.200") }}>
				<DiscoverHeader onClose={onClose} />
				<SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
			<div className="flex items-center justify-between">
				<div className="flex gap-2">
					<CheckboxFilterDropdown label="Use cases" options={CHAT_GALLERY_USE_CASE_OPTIONS} selectedValues={selectedUseCases} onToggle={toggleUseCase} />
					<CheckboxFilterDropdown label="Roles" options={CHAT_GALLERY_ROLE_OPTIONS} selectedValues={selectedRoles} onToggle={toggleRole} />
				</div>
				<div className="text-sm font-medium text-text-subtle">
					{filteredExamples.length} {filteredExamples.length === 1 ? "result" : "results"}
				</div>
			</div>
				<ExamplesGrid examples={filteredExamples} onExampleClick={onExampleClick} onExamplePreviewStart={onExamplePreviewStart} onExamplePreviewEnd={onExamplePreviewEnd} />
			</div>
		</div>
	);
}

interface DiscoverHeaderProps {
	onClose: () => void;
}

function DiscoverHeader({ onClose }: Readonly<DiscoverHeaderProps>) {
	return (
		<div className="flex items-center justify-between">
			<Heading size="medium">Discover more examples</Heading>
			<Button className="gap-2" size="default" variant="ghost" onClick={onClose}>
				<ChevronUpIcon label="" size="small" />
				Less
			</Button>
		</div>
	);
}

interface SearchBarProps {
	searchTerm: string;
	onSearchChange: (value: string) => void;
}

function SearchBar({ searchTerm, onSearchChange }: Readonly<SearchBarProps>) {
	return (
		<div>
			<InputGroup>
				<InputGroupSearchAddon align="inline-start">
					<SearchIcon label="" size="small" />
				</InputGroupSearchAddon>
				<InputGroupInput placeholder="Search" value={searchTerm} onChange={(event) => onSearchChange(event.currentTarget.value)} />
			</InputGroup>
		</div>
	);
}

interface ExamplesGridProps {
	examples: readonly ChatGalleryExample[];
	onExampleClick: (prompt: string) => void;
	onExamplePreviewStart?: (prompt: string) => void;
	onExamplePreviewEnd?: () => void;
}

function ExamplesGrid({ examples, onExampleClick, onExamplePreviewStart, onExamplePreviewEnd }: Readonly<ExamplesGridProps>) {
	return (
		<div
			className="auto-rows-[146px] grid-cols-3 gap-4 pb-6 cv-auto"
			style={{ display: "grid", containIntrinsicSize: "146px 320px" }}
		>
			{examples.length > 0 ? (
				examples.map((example) => {
					const prompt = getExamplePrompt(example);

					return (
						<ExampleCard
							key={`${example.title}-${example.role}`}
							iconPath={example.iconPath}
							title={example.title}
							description={example.description}
							onClick={() => onExampleClick(prompt)}
							onPreviewStart={() => onExamplePreviewStart?.(prompt)}
							onPreviewEnd={onExamplePreviewEnd}
						/>
					);
				})
			) : (
				<div className="col-span-full flex items-center justify-center rounded-lg border border-border bg-surface text-text-subtle" style={{ font: token("font.body") }}>
					No examples matched your filters.
				</div>
			)}
		</div>
	);
}
