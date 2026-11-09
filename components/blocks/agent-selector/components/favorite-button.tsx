"use client";

import StarFilledIcon from "@atlaskit/icon/core/star-starred";
import StarIcon from "@atlaskit/icon/core/star-unstarred";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function FavoriteButton({ id, name, favorite, className, onToggle }: Readonly<{
	id: string;
	name: string;
	favorite: boolean;
	className?: string;
	onToggle: (restoreFocus: boolean) => void;
}>) {
	return <Button data-favorite-id={id} type="button" aria-label={`${favorite ? "Remove" : "Add"} ${name} ${favorite ? "from" : "to"} favorites`} aria-pressed={favorite} selectedAppearance="icon-only" size="icon" variant="ghost" className={cn("size-6 shrink-0 text-icon-subtle aria-pressed:hover:bg-transparent! aria-pressed:active:bg-transparent! aria-pressed:[&_[data-slot=icon]]:text-icon-accent-orange! aria-pressed:[&_svg]:text-icon-accent-orange! focus-visible:opacity-100 group-hover/agent:opacity-100 group-has-[:focus-visible]/agent:opacity-100 [@media(hover:none)]:opacity-100", favorite ? "opacity-100" : "opacity-0", className)} onClick={(event) => onToggle(event.detail === 0)}>
		<Icon aria-hidden render={favorite ? <StarFilledIcon label="" size="small" /> : <StarIcon label="" size="small" />} />
	</Button>;
}
