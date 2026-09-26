export interface TopNavigationCurrentUser {
	id: string;
	name: string;
	avatarSrc: string;
	initials?: string;
}

export const DEFAULT_TOP_NAVIGATION_CURRENT_USER: TopNavigationCurrentUser = {
	id: "venn",
	name: "Venn",
	avatarSrc: "/avatar-user/venn/venn.png",
	initials: "VN",
};
