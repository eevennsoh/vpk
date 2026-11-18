"use client";

import { createContext } from "react";
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

export type ModalFinalFocus = NonNullable<DialogPrimitive.Popup.Props["finalFocus"]>;

/** Where focus lands when the work-item modal closes; set by `ModalRoot`, read by `ModalContainer`'s popup. */
export const ModalFinalFocusContext = createContext<ModalFinalFocus>(true);
