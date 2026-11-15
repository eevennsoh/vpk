// Dynamic imports for the chat surfaces (the sidebar chat panel and the floating chat). They bring
// the composer, the Tiptap editor runtime and the chat stack, so project routes load them only when
// a chat surface is about to show. One loader per surface keeps the cache in useDeferredModule
// shared between the hosts that render the same surface.

export const loadChatPanel = () => import("@/components/projects/sidebar-chat/page");

export const loadRovoFloatingChat = () => import("@/components/projects/rovo-floating-chat/components/rovo-floating-chat");
