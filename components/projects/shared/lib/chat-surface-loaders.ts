// Dynamic imports for the chat surfaces (the sidebar chat panel and the floating chat). They bring
// the composer, the Tiptap editor runtime and the chat stack, so project routes load them only when
// a chat surface is about to show. One loader per surface keeps the cache in useDeferredModule
// shared between the hosts that render the same surface.

import { preloadDeferredModule } from "@/components/projects/shared/hooks/use-deferred-module";

export const loadChatPanel = () => import("@/components/projects/sidebar-chat/page");

export const loadRovoFloatingChat = () => import("@/components/projects/rovo-floating-chat/components/rovo-floating-chat");

// Launcher hover/focus handlers: start the import early so most opens find the surface loaded.
// A failure here is ignored; the open itself retries and reports it through useDeferredModule.
export const preloadChatPanel = () => {
	preloadDeferredModule(loadChatPanel).catch(() => {});
};

export const preloadRovoFloatingChat = () => {
	preloadDeferredModule(loadRovoFloatingChat).catch(() => {});
};
