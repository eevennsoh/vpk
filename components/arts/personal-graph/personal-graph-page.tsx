"use client";

import { useEffect, useMemo, useState } from "react";
import { cjk } from "@streamdown/cjk";
import { code as baseCodePlugin } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";
import { streamdownComponents } from "@/components/ui-custom/message-markdown";
import { fetchPage, updatePage } from "./lib/personal-graph-api";
import type { PageBody, VaultNode } from "./lib/personal-graph-types";

interface PersonalGraphPageProps {
	node: VaultNode | null;
	slug: string | null;
}

const safeCodePlugin: typeof baseCodePlugin = {
	...baseCodePlugin,
	highlight(options, callback) {
		if (!baseCodePlugin.supportsLanguage(options.language)) {
			return null;
		}
		return baseCodePlugin.highlight(options, callback);
	},
};

const streamdownPlugins = { cjk, code: safeCodePlugin, math, mermaid };

const updatedAtFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeZone: "UTC",
	timeStyle: "short",
});

function formatUpdatedAt(value: string | null) {
	if (!value) {
		return "Not on disk";
	}

	return updatedAtFormatter.format(new Date(value));
}

export function PersonalGraphPage({
	node,
	slug,
}: Readonly<PersonalGraphPageProps>) {
	const [page, setPage] = useState<PageBody | null>(null);
	const [error, setError] = useState<Error | null>(null);
	const [draft, setDraft] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- slug changes start an abortable external page fetch.
	useEffect(() => {
		if (!slug) {
			setPage(null);
			setError(null);
			setIsLoading(false);
			return;
		}

		const controller = new AbortController();
		setIsLoading(true);
		void fetchPage(slug, { signal: controller.signal })
			.then((nextPage) => {
				setPage(nextPage);
				setDraft(nextPage.content);
				setIsEditing(false);
				setError(null);
			})
			.catch((nextError) => {
				if (nextError instanceof Error && nextError.name === "AbortError") {
					return;
				}
				setError(nextError instanceof Error ? nextError : new Error(String(nextError)));
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			});

		return () => {
			controller.abort();
		};
	}, [slug]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	const frontmatterRows = useMemo(() => {
		const entries = Object.entries(page?.frontmatter ?? node?.frontmatter ?? {});
		return entries.filter(([key]) => key !== "title");
	}, [node?.frontmatter, page?.frontmatter]);

	if (!node) {
		return (
			<div className="flex h-full items-center justify-center p-8 text-center text-sm text-text-subtle">
				Select a graph node to inspect its markdown.
			</div>
		);
	}

	if (!slug) {
		return (
			<div className="space-y-4 p-6">
				<div>
					<p className="text-xs font-medium uppercase tracking-normal text-text-subtle">{node.kind}</p>
					<h2 className="mt-1 text-base font-semibold text-text">{node.title}</h2>
					<p className="mt-2 text-sm text-text-subtle">
						{node.kind === "raw"
							? "Raw source files are linked into the graph but do not have wiki markdown pages yet."
							: "This wikilink target does not exist on disk yet."}
					</p>
				</div>
				<p className="rounded-md border border-border bg-bg-neutral p-3 text-xs text-text-subtle">
					{node.relativePath}
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-border px-6 py-4">
				<p className="text-xs font-medium uppercase tracking-normal text-text-subtle">{node.kind}</p>
				<h2 className="mt-1 text-base font-semibold text-text">{node.title}</h2>
				<p className="mt-1 text-xs text-text-subtle">
					{page?.relativePath ?? node.relativePath} · {formatUpdatedAt(page?.updatedAt ?? node.updatedAt)}
				</p>
				{page ? (
					<div className="mt-3 flex gap-2">
						{isEditing ? (
							<>
								<button
									className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
									disabled={isSaving}
									onClick={async () => {
										setIsSaving(true);
										try {
											const nextPage = await updatePage(page.slug, draft);
											setPage(nextPage);
											setDraft(nextPage.content);
											setIsEditing(false);
										} catch (nextError) {
											setError(nextError instanceof Error ? nextError : new Error(String(nextError)));
										} finally {
											setIsSaving(false);
										}
									}}
									type="button"
								>
									{isSaving ? "Saving..." : "Save"}
								</button>
								<button
									className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-subtle"
									onClick={() => {
										setDraft(page.content);
										setIsEditing(false);
									}}
									type="button"
								>
									Cancel
								</button>
							</>
						) : (
							<button
								className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-subtle"
								onClick={() => setIsEditing(true)}
								type="button"
							>
								Edit
							</button>
						)}
					</div>
				) : null}
			</div>
			<div className="min-h-0 flex-1 overflow-auto px-6 py-5">
				{isLoading ? (
					<p className="text-sm text-text-subtle">Loading markdown...</p>
				) : error ? (
					<p className="text-sm text-text-danger">{error.message}</p>
				) : isEditing ? (
					<textarea
						aria-label="Markdown content"
						className="min-h-[520px] w-full resize-none rounded-md border border-border bg-bg-neutral p-3 font-mono text-xs leading-5 text-text outline-none focus:border-border-selected focus:ring-2 focus:ring-ring/30"
						onChange={(event) => setDraft(event.target.value)}
						value={draft}
					/>
				) : (
					<div className="space-y-5">
						{frontmatterRows.length > 0 ? (
							<dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 rounded-md border border-border bg-bg-neutral p-3 text-xs">
								{frontmatterRows.map(([key, value]) => (
									<div className="contents" key={key}>
										<dt className="font-medium text-text-subtle">{key}</dt>
										<dd className="truncate text-text">{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
									</div>
								))}
							</dl>
						) : null}
						<Streamdown
							className="typeset typeset-docs max-w-none text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
							components={streamdownComponents}
							mode="static"
							plugins={streamdownPlugins}
						>
							{page?.body ?? node.bodyPreview}
						</Streamdown>
					</div>
				)}
			</div>
		</div>
	);
}
