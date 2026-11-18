"use client"

import { useState } from "react"
import {
	CodeIcon,
	CopyIcon,
	DownloadIcon,
	EyeIcon,
	ShareIcon,
} from "@/components/ui/vpk-icons"

import {
	Artifact,
	ArtifactAction,
	ArtifactActions,
	ArtifactContent,
	ArtifactHeader,
	ArtifactTitle,
} from "@/components/blocks/artifact"
import {
	CodeBlock,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockTitle,
	CodeBlockFilename,
	CodeBlockActions,
} from "@/components/ui/code-block"
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content"
import {
	PromptInput,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
	PromptInputButton,
} from "@/components/ui-custom/prompt-input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MOCK_GENERATED_CODE, MOCK_PREVIEW_HTML } from "./data/mock-data"

export default function AIGenerativeBlock() {
	const [activeTab, setActiveTab] = useState("preview")
	const [hasGenerated, setHasGenerated] = useState(true)

	return (
		<div className="flex h-[600px] flex-col bg-background">
			{hasGenerated ? (
				<>
					{/* Artifact container */}
					<Artifact className="flex-1 rounded-none border-0 border-b">
						<ArtifactHeader>
							<div className="flex items-center gap-3">
								<ArtifactTitle>Todo App</ArtifactTitle>
								<Tabs value={activeTab} onValueChange={setActiveTab}>
									<TabsList className="h-8">
										<TabsTrigger value="preview" className="gap-1.5 px-3 text-xs">
											<EyeIcon className="size-3.5" />
											Preview
										</TabsTrigger>
										<TabsTrigger value="code" className="gap-1.5 px-3 text-xs">
											<CodeIcon className="size-3.5" />
											Code
										</TabsTrigger>
									</TabsList>
								</Tabs>
							</div>
							<ArtifactActions>
								<ArtifactAction tooltip="Copy code" icon={CopyIcon} />
								<ArtifactAction tooltip="Download" icon={DownloadIcon} />
								<ArtifactAction tooltip="Share" icon={ShareIcon} />
							</ArtifactActions>
						</ArtifactHeader>
						<ArtifactContent className="p-0">
							{activeTab === "preview" ? (
								<div className="flex h-full items-start justify-center overflow-auto bg-white p-6">
									<div
										className="w-full max-w-md"
										dangerouslySetInnerHTML={{ __html: MOCK_PREVIEW_HTML }}
									/>
								</div>
							) : (
								<CodeBlock className="rounded-none ring-0">
									<CodeBlockHeader>
										<CodeBlockTitle>
											<CodeBlockFilename>todo-app.tsx</CodeBlockFilename>
										</CodeBlockTitle>
										<CodeBlockActions>
											<CodeBlockCopyButton value={MOCK_GENERATED_CODE} />
										</CodeBlockActions>
									</CodeBlockHeader>
									<HighlightedCodeContent code={MOCK_GENERATED_CODE} language="tsx" lineNumbers />
								</CodeBlock>
							)}
						</ArtifactContent>
					</Artifact>

					{/* Bottom prompt */}
					<div className="p-4">
						<PromptInput
							onSubmit={() => {}}
							className="rounded-lg border bg-background shadow-sm"
						>
							<PromptInputTextarea placeholder="Make changes to your app..." />
							<PromptInputFooter>
								<PromptInputTools>
									<PromptInputButton tooltip="Attach files">
										<svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
										</svg>
									</PromptInputButton>
								</PromptInputTools>
								<PromptInputSubmit />
							</PromptInputFooter>
						</PromptInput>
					</div>
				</>
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
					<div className="text-center">
						<h2 className="mb-2 text-xl font-semibold">What do you want to build?</h2>
						<p className="text-muted-foreground text-sm">
							Describe your app and I&apos;ll generate it for you.
						</p>
					</div>
					<div className="w-full max-w-lg">
						<PromptInput
							onSubmit={() => setHasGenerated(true)}
							className="rounded-lg border bg-background shadow-sm"
						>
							<PromptInputTextarea placeholder="Build a todo app with..." />
							<PromptInputFooter>
								<div />
								<PromptInputSubmit />
							</PromptInputFooter>
						</PromptInput>
					</div>
				</div>
			)}
		</div>
	)
}
