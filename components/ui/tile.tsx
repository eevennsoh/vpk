import { cva, type VariantProps } from "class-variance-authority"

import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const tileVariants = cva(
	"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-tile leading-none",
	{
		variants: {
			size: {
				xxsmall: "size-4 [font-size:10px]",
				xsmall: "size-5 [font-size:12px]",
				small: "size-6 [font-size:14px]",
				medium: "size-8 [font-size:16px]",
				large: "size-10 [font-size:20px]",
				xlarge: "size-12 [font-size:24px]",
			},
			variant: {
				// Semantic
				neutral: "bg-bg-neutral",
				brand: "bg-bg-brand-bold text-text-inverse",
				danger: "bg-bg-danger text-text-danger",
				warning: "bg-bg-warning text-text-warning",
				success: "bg-bg-success text-text-success",
				discovery: "bg-bg-discovery text-text-discovery",
				information: "bg-bg-information text-text-information",
				transparent: "bg-transparent",
				// Accent subtle
				blueSubtle: "bg-blue-50 text-blue-600",
				redSubtle: "bg-red-50 text-red-600",
				greenSubtle: "bg-green-50 text-green-600",
				yellowSubtle: "bg-yellow-50 text-yellow-600",
				purpleSubtle: "bg-purple-50 text-purple-600",
				tealSubtle: "bg-teal-50 text-teal-600",
				orangeSubtle: "bg-orange-50 text-orange-600",
				magentaSubtle: "bg-pink-50 text-pink-600",
				limeSubtle: "bg-lime-50 text-lime-600",
				graySubtle: "bg-neutral-50 text-neutral-600",
				// Accent bold
				blueBold: "bg-blue-600 text-text-inverse",
				redBold: "bg-red-600 text-text-inverse",
				greenBold: "bg-green-600 text-text-inverse",
				yellowBold: "bg-yellow-600 text-text-inverse",
				purpleBold: "bg-purple-600 text-text-inverse",
				tealBold: "bg-teal-600 text-text-inverse",
				orangeBold: "bg-orange-600 text-text-inverse",
				magentaBold: "bg-pink-600 text-text-inverse",
				limeBold: "bg-lime-600 text-text-inverse",
				grayBold: "bg-neutral-600 text-text-inverse",
			},
		},
		defaultVariants: {
			size: "medium",
			variant: "neutral",
		},
	}
)

// Content (child) sizes per tile size. `span`/`img`/`svg` are boxed to the
// target dimensions; emoji and other text nodes are scaled to fit the same
// box via a matching font-size + line-height so they render centered.
const INSET_CHILD_SIZES = {
	xxsmall: "[&_span]:size-2.5! [&_img]:size-2.5! [&_svg]:size-2.5! text-[10px]/[10px]",
	xsmall: "[&_span]:size-3! [&_img]:size-3! [&_svg]:size-3! text-[12px]/[12px]",
	small: "[&_span]:size-3.5! [&_img]:size-3.5! [&_svg]:size-3.5! text-[14px]/[14px]",
	medium: "[&_span]:size-4! [&_img]:size-4! [&_svg]:size-4! text-[16px]/[16px]",
	large: "[&_span]:size-5! [&_img]:size-5! [&_svg]:size-5! text-[20px]/[20px]",
	xlarge: "[&_span]:size-6! [&_img]:size-6! [&_svg]:size-6! text-[24px]/[24px]",
} as const satisfies Record<string, string>

// Snug-inset children stretch to fill the box left after a 2px pad. `!` is
// required because ADS marks (@atlaskit/icon, @atlaskit/logo) set width/height
// via unlayered CSS that beats plain layered utilities. The data-slot selector
// makes the contract explicit for shared `Avatar` wrappers used by project marks.
const SNUG_CHILD_CLASSES =
	"[&_span]:flex [&_span]:size-full! [&_span]:items-center [&_span]:justify-center [&_img]:size-full! [&_svg]:size-full! [&_[data-slot=avatar]]:size-full!"

export interface TileProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof tileVariants> {
	label: string
	isInset?: boolean
	/**
	 * Snug 2px inset: a fixed 2px pad on every side while the content fills the
	 * rest of the box (e.g. a 24px `small` tile yields 20px of content). Takes
	 * precedence over `isInset`. Pair with `variant="transparent"` for a bare
	 * container around logos, avatars, or icons.
	 */
	isSnug?: boolean
	hasBorder?: boolean
}

export interface TileAvatarProps
	extends Omit<React.ComponentProps<typeof Avatar>, "children" | "shape" | "size"> {
	alt?: string
	shape: "square" | "hexagon"
	src: string
}

function Tile({
	label,
	size = "medium",
	variant = "neutral",
	isInset = true,
	isSnug = false,
	hasBorder = false,
	className,
	children,
	...props
}: Readonly<TileProps>) {
	const isDecorative = props["aria-hidden"] === true

	return (
		<div
			data-slot="tile"
			aria-label={isDecorative ? undefined : label}
			className={cn(
				tileVariants({ size, variant }),
				isSnug
					? cn("p-0.5", SNUG_CHILD_CLASSES)
					: isInset
						? cn("p-0.5", INSET_CHILD_SIZES[size ?? "medium"])
						: "[&_span]:flex [&_span]:size-full [&_span]:items-center [&_span]:justify-center [&_img]:size-full [&_svg]:size-full!",
				hasBorder && "border border-border",
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}

function TileAvatar({
	alt = "",
	className,
	shape,
	src,
	...props
}: Readonly<TileAvatarProps>) {
	return (
		<Avatar
			{...props}
			className={cn("bg-transparent", className)}
			shape={shape}
			size="sm"
		>
			<AvatarImage alt={alt} src={src} />
		</Avatar>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export { Tile, TileAvatar, tileVariants }
