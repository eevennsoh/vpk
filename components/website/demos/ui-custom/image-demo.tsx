import { Image, type ImageProps } from "@/components/ui-custom/image";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageUserBubble } from "@/components/ui-custom/message-user-bubble";

function createSampleImage(
	color: string,
	label: string,
	width = 400,
	height = 300,
): Omit<ImageProps, "alt" | "className"> {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="${color}" width="${width}" height="${height}" rx="8"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="white" font-size="16" font-family="system-ui" dy=".3em">${label}</text></svg>`;
	return {
		base64: btoa(svg),
		uint8Array: new Uint8Array(),
		mediaType: "image/svg+xml",
	};
}

const sampleLandscape = createSampleImage("#6366f1", "Futuristic cityscape at sunset");
const samplePortrait = createSampleImage("#ec4899", "Portrait illustration", 300, 400);
const sampleSquare = createSampleImage("#14b8a6", "Abstract pattern", 400, 400);
const sampleWide = createSampleImage("#f59e0b", "Panoramic mountain range", 600, 250);

export default function ImageDemo() {
	return (
		<Image
			{...sampleLandscape}
			alt="AI-generated futuristic cityscape at sunset"
		/>
	);
}

export function ImageDemoCustomStyling() {
	return (
		<Image
			{...sampleSquare}
			alt="AI-generated abstract pattern"
			className="h-[200px] aspect-square border shadow-md rounded-lg"
		/>
	);
}

export function ImageDemoGallery() {
	const images = [
		{ data: sampleLandscape, alt: "Futuristic cityscape" },
		{ data: samplePortrait, alt: "Portrait illustration" },
		{ data: sampleSquare, alt: "Abstract pattern" },
		{ data: sampleWide, alt: "Panoramic mountains" },
	];

	return (
		<div className="grid grid-cols-2 gap-3">
			{images.map((img) => (
				<Image
					key={img.alt}
					{...img.data}
					alt={img.alt}
					className="w-full h-auto rounded-lg border"
				/>
			))}
		</div>
	);
}

export function ImageDemoInMessage() {
	return (
		<div className="flex flex-col gap-4">
			<Message align="end">
				<MessageContent>
					<MessageUserBubble>
						<p>Generate an image of a futuristic cityscape at sunset</p>
					</MessageUserBubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent className="max-w-[80%]">
					<div className="flex flex-col gap-2">
						<p>Here is a futuristic cityscape at sunset:</p>
						<Image
							{...sampleLandscape}
							alt="AI-generated futuristic cityscape at sunset"
						/>
					</div>
				</MessageContent>
			</Message>
		</div>
	);
}
