import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { token } from "@/lib/tokens"
import { cn } from "@/lib/utils"

const emptyVariants = cva("flex min-w-0 flex-1", {
	variants: {
		width: {
			wide: "max-w-[464px]",
			narrow: "max-w-[304px]",
		},
		orientation: {
			// Stacked: media on top, centered text and actions (default).
			vertical: "flex-col items-center justify-center text-center text-balance",
			// Side-by-side: media on the leading edge, left-aligned text/actions.
			// Container-query driven: stays a wrapping row, and when the container
			// runs out of space the actions block (basis-full) drops below the
			// text as a single unit. Becomes a centered stack on very narrow
			// containers (< @sm).
			horizontal:
				"@container flex-row flex-wrap items-center justify-start gap-x-5 gap-y-3 text-left max-@sm:flex-col max-@sm:items-center max-@sm:text-center max-@sm:text-balance",
		},
	},
	defaultVariants: {
		width: "wide",
		orientation: "vertical",
	},
})

type EmptyOrientation = NonNullable<VariantProps<typeof emptyVariants>["orientation"]>

// Surfaces the chosen orientation to sub-components so EmptyHeader/EmptyContent
// can left-align in the horizontal layout without consumers prop-drilling.
const EmptyOrientationContext = React.createContext<EmptyOrientation>("vertical")

interface EmptyProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof emptyVariants> {}

function Empty({
	className,
	width = "wide",
	orientation,
	...props
}: Readonly<EmptyProps>) {
	const resolvedOrientation: EmptyOrientation = orientation ?? "vertical"
	const isHorizontal = resolvedOrientation === "horizontal"
	// Horizontal empties are about content, not max-width centering, so let them
	// fill the available row width instead of clamping to the narrow/wide token.
	const widthClass = isHorizontal ? undefined : emptyVariants({ width })
	return (
		<EmptyOrientationContext value={resolvedOrientation}>
			<div
				data-slot="empty"
				data-orientation={resolvedOrientation}
				className={cn(
					emptyVariants({ orientation: resolvedOrientation }),
					widthClass,
					"mx-auto py-12",
					isHorizontal ? "w-full py-8" : "gap-6",
					className
				)}
				{...props}
			/>
		</EmptyOrientationContext>
	)
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	const orientation = React.use(EmptyOrientationContext)
	return (
		<div
			data-slot="empty-header"
			className={cn(
				"flex flex-col items-center gap-2",
				// Take the remaining row width so the actions sit on the far edge;
				// recenters on very narrow containers where the layout stacks.
				orientation === "horizontal" &&
					"min-w-0 flex-1 items-start text-left max-@sm:flex-none max-@sm:items-center max-@sm:text-center",
				className
			)}
			{...props}
		/>
	)
}

// Groups the text (EmptyHeader) and actions (EmptyContent) into one block so,
// in the horizontal layout, the actions wrap directly under the text — aligned
// to the text's edge — rather than relative to the leading media.
function EmptyBody({ className, ...props }: React.ComponentProps<"div">) {
	const orientation = React.use(EmptyOrientationContext)
	if (orientation !== "horizontal") {
		return (
			<div
				data-slot="empty-body"
				className={cn("flex w-full flex-col items-center gap-2", className)}
				{...props}
			/>
		)
	}
	return (
		<div
			data-slot="empty-body"
			className={cn(
				"flex min-w-0 flex-1 flex-row flex-wrap items-center gap-x-5 gap-y-3 max-@sm:flex-col max-@sm:items-center",
				className
			)}
			{...props}
		/>
	)
}

const emptyMediaVariants = cva(
	"mb-1 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-transparent [&_img]:max-h-40 [&_img]:max-w-40 [&_img]:object-contain",
				icon: "bg-bg-neutral text-text flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-5",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
)

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant }), className)}
			{...props}
		/>
	)
}

const emptyTitleVariants = cva("text-text", {
	variants: {
		headingSize: {
			medium: "",
			xsmall: "text-sm font-medium",
		},
	},
	defaultVariants: {
		headingSize: "medium",
	},
})

function EmptyTitle({
	as: Component = "h4",
	className,
	headingSize = "medium",
	style,
	...props
}: React.ComponentProps<"h4"> &
	VariantProps<typeof emptyTitleVariants> & { as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }) {
	return (
		<Component
			data-slot="empty-title"
			className={cn(emptyTitleVariants({ headingSize }), className)}
			style={
				headingSize === "medium"
					? { font: token("font.heading.medium"), ...style }
					: style
			}
			{...props}
		/>
	)
}

function EmptyDescription({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="empty-description"
			className={cn(
				"text-sm/relaxed text-text-subtle [&>a:hover]:text-link-pressed [&>a]:text-link [&>a]:underline [&>a]:underline-offset-4",
				className
			)}
			{...props}
		/>
	)
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	const orientation = React.use(EmptyOrientationContext)
	return (
		<div
			data-slot="empty-content"
			className={cn(
				"flex w-full min-w-0 flex-col items-center gap-2 text-sm",
				// Sits beside the text while it fits; when the container is tight
				// the whole actions block wraps to a full-width row beneath the text.
				orientation === "horizontal" &&
					"w-auto flex-none items-end max-@md:basis-full max-@md:items-start max-@sm:items-center",
				className
			)}
			{...props}
		/>
	)
}

export {
	Empty,
	EmptyBody,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
	EmptyContent,
	EmptyMedia,
	// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
	emptyVariants,
	// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
	emptyMediaVariants,
	// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
	emptyTitleVariants,
	type EmptyProps,
}
