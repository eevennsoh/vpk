"use client";

import type { CarouselApi } from "@/components/ui/carousel";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
} from "@/components/ui/carousel";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
} from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useState,
} from "react";

export type InlineCitationProps = ComponentProps<"span">;

export function InlineCitation({
	className,
	...props
}: Readonly<InlineCitationProps>) {
	return (
		<span
			className={cn("group inline items-center gap-1", className)}
			{...props}
		/>
	);
}

export type InlineCitationTextProps = ComponentProps<"span">;

export function InlineCitationText({
	className,
	...props
}: Readonly<InlineCitationTextProps>) {
	return (
		<span
			className={cn("transition-colors group-hover:bg-accent", className)}
			{...props}
		/>
	);
}

export type InlineCitationCardProps = ComponentProps<typeof HoverCard>;

export function InlineCitationCard(props: Readonly<InlineCitationCardProps>) {
	return <HoverCard {...props} />;
}

function getHostname(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

export interface InlineCitationCardTriggerProps
	extends ComponentProps<typeof Button> {
	sources: string[];
	delay?: number;
	closeDelay?: number;
}

export function InlineCitationCardTrigger({
	sources,
	delay = 10,
	closeDelay = 100,
	className,
	...props
}: Readonly<InlineCitationCardTriggerProps>) {
	return (
		<HoverCardTrigger
			closeDelay={closeDelay}
			delay={delay}
			render={
				<Button
					className={cn("ml-1 rounded-full px-2", className)}
					size="compact"
					variant="secondary"
					{...props}
				/>
			}
		>
			{sources[0] ? (
				<>
					{getHostname(sources[0])}
					{sources.length > 1 ? ` +${sources.length - 1}` : null}
				</>
			) : (
				"unknown"
			)}
		</HoverCardTrigger>
	);
}

export type InlineCitationCardBodyProps = ComponentProps<
	typeof HoverCardContent
>;

export function InlineCitationCardBody({
	className,
	...props
}: Readonly<InlineCitationCardBodyProps>) {
	return (
		<HoverCardContent
			className={cn("relative w-80 p-0", className)}
			{...props}
		/>
	);
}

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined);

function useCarouselApi() {
	return use(CarouselApiContext);
}

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export function InlineCitationCarousel({
	className,
	children,
	...props
}: Readonly<InlineCitationCarouselProps>) {
	const [api, setApi] = useState<CarouselApi>();

	return (
		<CarouselApiContext value={api}>
			<Carousel className={cn("w-full", className)} setApi={setApi} {...props}>
				{children}
			</Carousel>
		</CarouselApiContext>
	);
}

export type InlineCitationCarouselContentProps = ComponentProps<"div">;

export function InlineCitationCarouselContent(
	props: Readonly<InlineCitationCarouselContentProps>,
) {
	return <CarouselContent {...props} />;
}

export type InlineCitationCarouselItemProps = ComponentProps<"div">;

export function InlineCitationCarouselItem({
	className,
	...props
}: Readonly<InlineCitationCarouselItemProps>) {
	return (
		<CarouselItem
			className={cn("w-full space-y-2 p-4 pl-8", className)}
			{...props}
		/>
	);
}

export type InlineCitationCarouselHeaderProps = ComponentProps<"div">;

export function InlineCitationCarouselHeader({
	className,
	...props
}: Readonly<InlineCitationCarouselHeaderProps>) {
	return (
		<div
			className={cn("flex items-center justify-between p-2", className)}
			{...props}
		/>
	);
}

export type InlineCitationCarouselIndexProps = ComponentProps<"div">;

export function InlineCitationCarouselIndex({
	children,
	className,
	...props
}: Readonly<InlineCitationCarouselIndexProps>) {
	const api = useCarouselApi();
	const [current, setCurrent] = useState(0);
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!api) {
			return;
		}

		setCount(api.scrollSnapList().length);
		setCurrent(api.selectedScrollSnap() + 1);

		const handleSelect = () => {
			setCurrent(api.selectedScrollSnap() + 1);
		};

		api.on("select", handleSelect);

		return () => {
			api.off("select", handleSelect);
		};
	}, [api]);

	return (
		<div
			className={cn(
				"flex flex-1 items-center justify-end px-3 py-1 text-muted-foreground text-xs",
				className,
			)}
			{...props}
		>
			{children ?? `${current}/${count}`}
		</div>
	);
}

export type InlineCitationCarouselButtonsProps = ComponentProps<
	typeof ButtonGroup
>;

export function InlineCitationCarouselButtons({
	className,
	...props
}: Readonly<InlineCitationCarouselButtonsProps>) {
	return <ButtonGroup className={cn("shrink-0", className)} {...props} />;
}

export type InlineCitationCarouselPrevProps = ComponentProps<typeof Button>;

export function InlineCitationCarouselPrev({
	className,
	...props
}: Readonly<InlineCitationCarouselPrevProps>) {
	const api = useCarouselApi();

	const handleClick = useCallback(() => {
		api?.scrollPrev();
	}, [api]);

	return (
		<Button
			aria-label="Previous"
			className={cn("shrink-0", className)}
			onClick={handleClick}
			size="icon-compact"
			type="button"
			variant="ghost"
			{...props}
		>
			<ArrowLeftIcon />
		</Button>
	);
}

export type InlineCitationCarouselNextProps = ComponentProps<typeof Button>;

export function InlineCitationCarouselNext({
	className,
	...props
}: Readonly<InlineCitationCarouselNextProps>) {
	const api = useCarouselApi();

	const handleClick = useCallback(() => {
		api?.scrollNext();
	}, [api]);

	return (
		<Button
			aria-label="Next"
			className={cn("shrink-0", className)}
			onClick={handleClick}
			size="icon-compact"
			type="button"
			variant="ghost"
			{...props}
		>
			<ArrowRightIcon />
		</Button>
	);
}

export interface InlineCitationSourceProps extends ComponentProps<"div"> {
	title?: string;
	url?: string;
	description?: string;
}

export function InlineCitationSource({
	title,
	url,
	description,
	className,
	children,
	...props
}: Readonly<InlineCitationSourceProps>) {
	return (
		<div className={cn("flex flex-col gap-1", className)} {...props}>
			{title ? <div className="font-medium text-sm">{title}</div> : null}
			{description ? (
				<p className="line-clamp-3 text-muted-foreground text-sm">
					{description}
				</p>
			) : null}
			{url ? (
				<a
					className="w-fit max-w-full truncate text-muted-foreground text-xs underline-offset-4 hover:underline"
					href={url}
					rel="noreferrer"
					target="_blank"
				>
					{getHostname(url)}
					<span className="sr-only"> (opens in a new tab)</span>
				</a>
			) : null}
			{children}
		</div>
	);
}

export type InlineCitationQuoteProps = ComponentProps<"blockquote">;

export function InlineCitationQuote({
	children,
	className,
	...props
}: Readonly<InlineCitationQuoteProps>) {
	return (
		<blockquote
			className={cn(
				"border-muted border-l-2 pl-3 text-muted-foreground text-sm italic",
				className,
			)}
			{...props}
		>
			{children}
		</blockquote>
	);
}
