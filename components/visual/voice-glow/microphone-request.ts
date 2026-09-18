/** Stop late permission results after a demo reset or unmount. */
export async function requestVoiceGlowMicrophone(
	start: () => Promise<MediaStream | null>,
	isCurrent: () => boolean,
): Promise<MediaStream | null> {
	const stream = await start();
	if (!isCurrent()) {
		stream?.getTracks().forEach((track) => track.stop());
		return null;
	}
	return stream;
}
