"use client";

import Image from "next/image";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";

import { cn } from "@/lib/utils";

const GLYPH_FRAMES = [
	"Botanical",
	"Postage",
	"Spectral",
	"Map",
	"Patent",
	"Coastline",
	"Blueprint",
	"Cyanotype",
	"Root",
	"Dot Grid",
	"Cell",
	"X-ray",
	"Coin",
	"Music",
	"Specimen",
	"Proof",
	"Butterfly",
	"Manuscript",
] as const;

export default function RovoFable({
	className,
	...props
}: Readonly<React.ComponentProps<"main">>) {
	return (
		<main
			className={cn(
				"min-h-svh overflow-hidden bg-[#221b16] text-[#f1ead7]",
				className,
			)}
			{...props}
		>
			<section className="grid min-h-svh grid-rows-[auto_1fr_auto] gap-6 px-4 py-5 sm:px-8 lg:px-10">
				<header className="flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<Image
							alt=""
							className="size-10 rounded-tile bg-bg-neutral-bold object-contain p-1"
							height={96}
							priority
							src="/arts/rovo-fable/symbol.png"
							width={96}
						/>
						<div className="min-w-0">
							<h1 className="truncate font-serif text-2xl font-black tracking-normal sm:text-4xl">
								Rovo Fable
							</h1>
							<p className="mt-1 truncate font-mono text-xs uppercase text-[#c8bda2]">
								Archival glyph reel
							</p>
						</div>
					</div>
					<a
						className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#f1ead7]/20 px-4 font-mono text-xs uppercase text-[#f1ead7] transition duration-normal ease-out hover:border-[#f1ead7]/45 hover:bg-[#f1ead7]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1ead7]"
						href="/arts/rovo-fable/hyperframes/index.html"
						rel="noreferrer"
						target="_blank"
					>
						<LinkExternalIcon label="" size="small" />
						Open
					</a>
				</header>

				<div className="grid min-h-0 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_210px]">
					<div className="mx-auto aspect-square w-full max-w-[min(78svh,860px)] overflow-hidden rounded-lg border border-[#f1ead7]/18 bg-[#f1ead7] shadow-[0_32px_80px_rgba(0,0,0,0.36)]">
						<video
							autoPlay
							className="h-full w-full"
							controls
							loop
							muted
							playsInline
							src="/arts/rovo-fable/rovo-fable.mp4"
						/>
					</div>

					<ol className="hidden grid-cols-2 gap-2 lg:grid">
						{GLYPH_FRAMES.map((frame, index) => (
							<li
								className="border border-[#f1ead7]/14 bg-[#f1ead7]/7 px-3 py-2 font-mono text-[11px] uppercase text-[#d7ceb8]"
								key={frame}
							>
								<span className="block text-[#9f9277]">
									{String(index + 1).padStart(2, "0")}
								</span>
								{frame}
							</li>
						))}
					</ol>
				</div>

				<footer className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase text-[#a99d82]">
					<span>HyperFrames</span>
					<span>18 frames / 16s / 24 fps</span>
				</footer>
			</section>
		</main>
	);
}
