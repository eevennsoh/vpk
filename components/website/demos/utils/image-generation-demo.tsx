"use client";

import { type ReactElement, useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface LogEntry {
	timestamp: string;
	type: "info" | "error" | "data" | "stream";
	message: string;
}

interface ImageEntry {
	id: string;
	url: string;
	mimeType: string;
}

function formatTimestamp(): string {
	return new Date().toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	});
}

export default function ImageGenerationDemo(): ReactElement {
	const headingId = useId();
	const [prompt, setPrompt] = useState("generate me an image with a red box");
	const [response, setResponse] = useState("");
	const [images, setImages] = useState<ImageEntry[]>([]);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [elapsedMs, setElapsedMs] = useState<number | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const addLog = useCallback((type: LogEntry["type"], message: string) => {
		setLogs((prev) => [...prev, { timestamp: formatTimestamp(), type, message }]);
	}, []);

	const handleSend = useCallback(async () => {
		if (!prompt.trim() || isLoading) return;

		// Reset state
		setResponse("");
		setImages([]);
		setLogs([]);
		setElapsedMs(null);
		setIsLoading(true);

		const controller = new AbortController();
		abortRef.current = controller;
		const startTime = performance.now();

		addLog("info", `Sending prompt: "${prompt.trim()}"`);
		addLog("info", "POST /api/chat-sdk (chatMode: pure)");

		try {
			const res = await fetch("/api/chat-sdk", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
				body: JSON.stringify({
					messages: [
						{
							role: "user",
							parts: [{ type: "text", text: prompt.trim() }],
						},
					],
					chatMode: "ask",
					provider: "google",
				}),
			});

			addLog("info", `Response status: ${res.status} ${res.statusText}`);
			addLog(
				"info",
				`Content-Type: ${res.headers.get("content-type") ?? "unknown"}`
			);

			if (!res.ok) {
				const errorText = await res.text();
				addLog("error", `Error ${res.status}: ${errorText}`);
				setIsLoading(false);
				return;
			}

			const contentType = res.headers.get("content-type") ?? "";

			// Handle SSE streaming response
			if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
				addLog("info", "Streaming response (SSE)...");
				const reader = res.body?.getReader();
				if (!reader) {
					addLog("error", "No readable stream in response body");
					setIsLoading(false);
					return;
				}

				const decoder = new TextDecoder();
				let accumulated = "";
				let chunkCount = 0;
				let sseBuffer = "";

				const processCompleteLine = (trimmed: string) => {
					// Extract text content from UI message stream format
					if (trimmed.startsWith("g:")) {
						try {
							const payload = JSON.parse(trimmed.slice(2));
							if (
								payload.type === "text-delta" &&
								typeof payload.delta === "string"
							) {
								accumulated += payload.delta;
								setResponse(accumulated);
							}
							if (
								payload.type === "file" &&
								payload.url
							) {
								const imageEntry: ImageEntry = {
									id: `img-${Date.now()}`,
									url: payload.url,
									mimeType: payload.mediaType || "image/png",
								};
								setImages((prev) => [...prev, imageEntry]);
								addLog(
									"info",
									`Image received: ${imageEntry.mimeType} (${imageEntry.id})`
								);
							}
						} catch {
							// Not valid JSON, skip
						}
						return;
					}
					// Handle standard SSE data format
					if (trimmed.startsWith("data:")) {
						const data = trimmed.slice(5).trim();
						if (data === "[DONE]") {
							addLog("info", "Stream complete ([DONE])");
							return;
						}
						try {
							const parsed = JSON.parse(data);

							// UI message stream format (wrapped in data: SSE)
							if (
								parsed?.type === "text-delta" &&
								typeof parsed.delta === "string"
							) {
								accumulated += parsed.delta;
								setResponse(accumulated);
								return;
							}
							if (
								parsed?.type === "file" &&
								parsed.url
							) {
								const imageEntry: ImageEntry = {
									id: `img-${Date.now()}`,
									url: parsed.url,
									mimeType: parsed.mediaType || "image/png",
								};
								setImages((prev) => [...prev, imageEntry]);
								addLog(
									"info",
									`Image received: ${imageEntry.mimeType} (${imageEntry.id})`
								);
								return;
							}

							// Standard OpenAI SSE format
							const delta =
								parsed?.choices?.[0]?.delta?.content ??
								parsed?.delta?.text ??
								null;
							if (typeof delta === "string" && delta.length > 0) {
								accumulated += delta;
								setResponse(accumulated);
							}
						} catch {
							// Not valid JSON SSE data, skip
						}
					}
				};

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					sseBuffer += decoder.decode(value, { stream: true });
					chunkCount++;

					// Process only complete lines (delimited by \n\n or \n)
					// SSE events are separated by blank lines (\n\n)
					let newlineIndex = sseBuffer.indexOf("\n");
					while (newlineIndex !== -1) {
						const line = sseBuffer.slice(0, newlineIndex).trim();
						sseBuffer = sseBuffer.slice(newlineIndex + 1);

						if (line) {
							// Log SSE lines (first 10, then every 20th)
							if (chunkCount <= 10 || chunkCount % 20 === 0) {
								addLog(
									"stream",
									`chunk #${chunkCount}: ${line.slice(0, 120)}${line.length > 120 ? "..." : ""}`
								);
							}
							processCompleteLine(line);
						}

						newlineIndex = sseBuffer.indexOf("\n");
					}
				}

				// Process any remaining buffered data
				if (sseBuffer.trim()) {
					processCompleteLine(sseBuffer.trim());
				}

				addLog("info", `Stream finished. Total chunks: ${chunkCount}`);
				addLog("info", `Total response length: ${accumulated.length} chars`);
			} else {
				// Handle JSON response
				addLog("info", "Non-streaming JSON response");
				const data = await res.json();
				addLog("data", JSON.stringify(data, null, 2));
				setResponse(JSON.stringify(data, null, 2));
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				addLog("info", "Request aborted by user");
			} else {
				addLog(
					"error",
					err instanceof Error ? err.message : String(err)
				);
			}
		} finally {
			setElapsedMs(performance.now() - startTime);
			setIsLoading(false);
			abortRef.current = null;
		}
	}, [prompt, isLoading, addLog]);

	const handleAbort = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	return (
		<section aria-labelledby={headingId} className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
				<header className="flex flex-col gap-3">
					<h1 id={headingId} className="text-2xl font-semibold">Image Generation</h1>
					<p className="text-sm text-muted-foreground">
						Sends a message to <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/api/chat-sdk</code> in
						pure chat mode with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">provider: &quot;google&quot;</code>.
						Configure <code className="rounded bg-muted px-1.5 py-0.5 text-xs">AI_GATEWAY_URL_GOOGLE</code> in{" "}
						<code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.local</code> (preferred), or point{" "}
						<code className="rounded bg-muted px-1.5 py-0.5 text-xs">AI_GATEWAY_URL</code> to a Google/Gemini endpoint,
						to enable native image generation alongside text responses.
					</p>
				</header>

			{/* Input */}
			<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
				<label
					className="text-sm font-medium text-muted-foreground"
					htmlFor="gemini-prompt-input"
				>
					Prompt
				</label>
				<textarea
					className="min-h-[80px] w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					id="gemini-prompt-input"
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							handleSend();
						}
					}}
					placeholder="Enter a prompt..."
					value={prompt}
				/>
				<div className="flex items-center gap-3">
					<Button
						disabled={isLoading || !prompt.trim()}
						onClick={handleSend}
						type="button"
					>
						{isLoading ? "Sending..." : "Send"}
					</Button>
					{isLoading ? (
						<Button
							onClick={handleAbort}
							type="button"
							variant="outline"
						>
							Abort
						</Button>
					) : null}
					{elapsedMs !== null ? (
						<span className="text-xs text-muted-foreground">
							{Math.round(elapsedMs)}ms
						</span>
					) : null}
				</div>
			</section>

			{/* Response */}
			{response || images.length > 0 ? (
				<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
					<h2 className="text-sm font-medium text-muted-foreground">
						Response
					</h2>
					{response ? (
						<div className="whitespace-pre-wrap text-sm">
							{response}
						</div>
					) : null}
					{images.length > 0 ? (
						<div className="flex flex-col gap-3">
							{images.map((image) => {
								const extension = image.mimeType.split("/")[1] || "png";
								const filename = `generated-image-${image.id}.${extension}`;
								return (
									<div
										className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3"
										key={image.id}
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											alt="Generated preview"
											className="h-12 w-12 shrink-0 rounded border object-cover"
											src={image.url}
										/>
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="truncate text-sm font-medium">
												{filename}
											</span>
											<span className="text-xs text-muted-foreground">
												{image.mimeType}
											</span>
										</div>
										<a
											className="ml-auto shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
											download={filename}
											href={image.url}
										>
											Download
										</a>
									</div>
								);
							})}
						</div>
					) : null}
				</section>
			) : null}

			{/* Debug Logs */}
			{logs.length > 0 ? (
				<section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-medium text-muted-foreground">
							Debug Log
						</h2>
						<Button
							onClick={() => setLogs([])}
							size="default"
							type="button"
							variant="ghost"
						>
							Clear
						</Button>
					</div>
					<div className="max-h-[400px] overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
						{logs.map((entry, i) => (
							<div
								className={
									entry.type === "error"
										? "text-red-500"
										: entry.type === "data"
											? "text-blue-500"
											: entry.type === "stream"
												? "text-green-600 dark:text-green-400"
												: "text-muted-foreground"
								}
								key={`${entry.timestamp}-${i}`}
							>
								<span className="opacity-60">
									[{entry.timestamp}]
								</span>{" "}
								<span className="font-semibold uppercase">
									{entry.type}
								</span>{" "}
								{entry.message}
							</div>
						))}
					</div>
				</section>
			) : null}
		</section>
	);
}
