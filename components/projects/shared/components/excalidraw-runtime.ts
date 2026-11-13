// Loaded only through a dynamic import from `excalidraw-preview.tsx`, so the Excalidraw
// runtime and its stylesheet arrive together when a scene first renders.
import "./excalidraw-runtime.css";

export { Excalidraw, restoreAppState, restoreElements } from "@excalidraw/excalidraw";
