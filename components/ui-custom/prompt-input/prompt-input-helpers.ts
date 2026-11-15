import type { ChangeEvent } from "react";

export const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to read attachment: ${response.status}`);
    }
    const blob = await response.blob();
    // FileReader uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    return new Promise((resolve) => {
      const reader = new FileReader();
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      reader.onloadend = () => resolve(reader.result as string);
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const captureScreenshot = async (): Promise<File | null> => {
	if (
		typeof navigator === "undefined" ||
		!navigator.mediaDevices?.getDisplayMedia
	) {
		return null;
	}

	let stream: MediaStream | null = null;
	const video = document.createElement("video");
	video.muted = true;
	video.playsInline = true;

	try {
		stream = await navigator.mediaDevices.getDisplayMedia({
			audio: false,
			video: true,
		});

		video.srcObject = stream;

		await new Promise<void>((resolve, reject) => {
			video.onloadedmetadata = () => resolve();
			video.onerror = () => reject(new Error("Failed to load screen stream"));
		});

		await video.play();

		const width = video.videoWidth;
		const height = video.videoHeight;
		if (!width || !height) {
			return null;
		}

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			return null;
		}

		context.drawImage(video, 0, 0, width, height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/png");
		});
		if (!blob) {
			return null;
		}

		const timestamp = new Date()
			.toISOString()
			.replaceAll(/[:.]/g, "-")
			.replace("T", "_")
			.replace("Z", "");

		return new File([blob], `screenshot-${timestamp}.png`, {
			lastModified: Date.now(),
			type: "image/png",
		});
	} finally {
		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop();
			}
		}
		video.pause();
		video.srcObject = null;
	}
};

/**
 * Build a textarea-shaped synthetic change event so existing consumers that read
 * `event.currentTarget.value` / `event.target.value` keep working now that the
 * control is a contentEditable rather than a native <textarea>.
 */
export function createSyntheticChangeEvent(
  element: HTMLElement | null,
  value: string,
  name: string
): ChangeEvent<HTMLTextAreaElement> {
  // Consumers only read `.value` / `.name` off target/currentTarget. Build a
  // lightweight textarea-shaped target whose prototype is the real
  // contentEditable element, so identity checks still resolve to the DOM node
  // without mutating it.
  const target = Object.create(element, {
    name: { configurable: true, enumerable: true, value: name },
    value: { configurable: true, enumerable: true, value },
  }) as HTMLTextAreaElement & EventTarget;

  return {
    bubbles: true,
    cancelable: false,
    currentTarget: target,
    defaultPrevented: false,
    target,
    type: "change",
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as ChangeEvent<HTMLTextAreaElement>;
}
