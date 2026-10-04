/**
 * avatar.enter's first pose. Avatars that play it on mount mark their root with
 * `data-avatar-enter`, so a stand-in for a card that is about to mount (such as
 * a settled drag face) can show the pose the committed card starts from.
 */
export const AVATAR_ENTER_FROM = { scale: 0.8, opacity: 0 } as const;
