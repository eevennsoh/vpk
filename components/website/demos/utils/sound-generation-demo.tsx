"use client";

// oxlint-disable react-doctor/media-has-caption -- These media previews render generated or user-supplied media where no caption asset is available; transcript or metadata is rendered separately when provided.

import { type ReactElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface LogEntry {
	timestamp: string;
	type: "info" | "error" | "data";
	message: string;
}

interface AudioResult {
	url: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
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

function getFilenameFromContentDisposition(headerValue: string | null): string | null {
	if (!headerValue) {
		return null;
	}

	const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		return decodeURIComponent(utf8Match[1]);
	}

	const fallbackMatch = headerValue.match(/filename="?([^"]+)"?/i);
	return fallbackMatch?.[1] ?? null;
}

function formatBytes(value: number): string {
	if (!Number.isFinite(value) || value <= 0) {
		return "0 B";
	}

	if (value < 1024) {
		return `${value} B`;
	}

	const kbValue = value / 1024;
	if (kbValue < 1024) {
		return `${kbValue.toFixed(1)} KB`;
	}

	return `${(kbValue / 1024).toFixed(2)} MB`;
}

export default function SoundGenerationDemo(): ReactElement {
	const headingId = useId();
	const [input, setInput] = useState(
		"Read this in a friendly, clear voice: the deployment is complete and all systems are healthy."
	);
	const [audioResult, setAudioResult] = useState<AudioResult | null>(null);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [elapsedMs, setElapsedMs] = useState<number | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const audioUrlRef = useRef<string | null>(null);

	useEffect(() => {
		return () => {
			if (audioUrlRef.current) {
				URL.revokeObjectURL(audioUrlRef.current);
			}
		};
	}, []);

	const addLog = useCallback((type: LogEntry["type"], message: string) => {
		setLogs((prev) => [...prev, { timestamp: formatTimestamp(), type, message }]);
	}, []);

	const clearAudioResult = useCallback(() => {
		if (audioUrlRef.current) {
			URL.revokeObjectURL(audioUrlRef.current);
			audioUrlRef.current = null;
		}
		setAudioResult(null);
	}, []);

	const updateAudioResult = useCallback(
		(blob: Blob, filename: string) => {
			if (audioUrlRef.current) {
				URL.revokeObjectURL(audioUrlRef.current);
			}

			const objectUrl = URL.createObjectURL(blob);
			audioUrlRef.current = objectUrl;
			setAudioResult({
				url: objectUrl,
				filename,
				mimeType: blob.type || "audio/mpeg",
				sizeBytes: blob.size,
			});
		},
		[]
	);

	const handleGenerate = useCallback(async () => {
		if (!input.trim() || isLoading) {
			return;
		}

		clearAudioResult();
		setLogs([]);
		setElapsedMs(null);
		setIsLoading(true);

		const controller = new AbortController();
		abortRef.current = controller;
		const startTime = performance.now();

		addLog("info", `Sending input (${input.trim().length} chars)`);
		addLog(
			"info",
			"POST /api/sound-generation (provider: google, model: tts-latest → resolved from GOOGLE_TTS_MODEL)"
		);

		try {
			const response = await fetch("/api/sound-generation", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				signal: controller.signal,
				body: JSON.stringify({
					input: input.trim(),
					model: "tts-latest",
					provider: "google",
					responseFormat: "mp3",
				}),
			});

			addLog("info", `Response status: ${response.status} ${response.statusText}`);
			addLog(
				"info",
				`Content-Type: ${response.headers.get("content-type") ?? "unknown"}`
			);

			if (!response.ok) {
				const errorText = await response.text();
				addLog("error", errorText || "Failed to generate audio");
				return;
			}

			const generatedBlob = await response.blob();
			if (!generatedBlob.size) {
				addLog("error", "Received empty audio file");
				return;
			}

			const filename =
				getFilenameFromContentDisposition(
					response.headers.get("content-disposition")
				) ?? `speech-${Date.now()}.mp3`;
			updateAudioResult(generatedBlob, filename);

			addLog(
				"data",
				`Audio ready: ${filename} (${formatBytes(generatedBlob.size)})`
			);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				addLog("info", "Request aborted by user");
			} else {
				addLog(
					"error",
					error instanceof Error ? error.message : String(error)
				);
			}
		} finally {
			setElapsedMs(performance.now() - startTime);
			setIsLoading(false);
			abortRef.current = null;
		}
	}, [addLog, clearAudioResult, input, isLoading, updateAudioResult]);

	const handleAbort = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	return (
		<section aria-labelledby={headingId} className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
			<header className="flex flex-col gap-3">
				<h1 id={headingId} className="text-2xl font-semibold">Sound Generation</h1>
				<p className="text-sm text-muted-foreground">
					Converts text to speech using{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 text-xs">tts-latest</code>{" "}
					via <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/api/sound-generation</code>.
				</p>
			</header>

			<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
				<label
					className="text-sm font-medium text-muted-foreground"
					htmlFor="sound-generation-input"
				>
					Text Input
				</label>
				<textarea
					className="min-h-[100px] w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					id="sound-generation-input"
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
							handleGenerate();
						}
					}}
					placeholder="Enter text to synthesize..."
					value={input}
				/>

				<div className="flex flex-wrap items-end gap-3">
					<Button
						disabled={isLoading || !input.trim()}
						onClick={handleGenerate}
						type="button"
					>
						{isLoading ? "Generating..." : "Generate Voice"}
					</Button>
					{isLoading ? (
						<Button onClick={handleAbort} type="button" variant="outline">
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

			{audioResult ? (
				<section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
					<h2 className="text-sm font-medium text-muted-foreground">Generated Audio</h2>
					<audio
						className="w-full"
						controls
						preload="metadata"
						src={audioResult.url}
					/>
					<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						<span>{audioResult.filename}</span>
						<span>{audioResult.mimeType}</span>
						<span>{formatBytes(audioResult.sizeBytes)}</span>
					</div>
					<div>
						<a
							className="inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
							download={audioResult.filename}
							href={audioResult.url}
						>
							Download Audio
						</a>
					</div>
				</section>
			) : null}

			{logs.length > 0 ? (
				<section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-medium text-muted-foreground">Debug Log</h2>
						<Button
							onClick={() => setLogs([])}
							size="default"
							type="button"
							variant="ghost"
						>
							Clear
						</Button>
					</div>
					<div className="max-h-[360px] overflow-auto rounded-lg bg-background p-3 font-mono text-xs">
						{logs.map((entry, index) => (
							<div
								className={
									entry.type === "error"
										? "text-red-500"
										: entry.type === "data"
											? "text-blue-500"
											: "text-muted-foreground"
								}
								key={`${entry.timestamp}-${index}`}
							>
								<span className="opacity-60">[{entry.timestamp}]</span>{" "}
								<span className="font-semibold uppercase">{entry.type}</span>{" "}
								{entry.message}
							</div>
						))}
					</div>
				</section>
			) : null}
		</section>
	);
}
