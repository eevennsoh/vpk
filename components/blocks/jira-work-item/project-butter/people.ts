const PERSON_AVATAR_IDS: Readonly<Record<string, string>> = {
	"Sarah Lim": "laila-ali--color--teamwork-blue", "Olivia Yang": "olivia-yang--color--dev-lime",
	"Elena Rodriguez": "florence-garcia--color--dev-lime", "Marcus Kim": "issac-varghese--color--product-purple",
	"Annie Cook": "maia-ma--color--dev-lime", "John Vaughan": "louis-au--color--strategy-orange",
	"David Hsieh": "darius-pavri--color--dev-lime", "David Chen": "jordan--color--service-yellow",
	"Dev Rana": "raul-gonzalez--color--strategy-orange", "Roshini Malik": "luna-delacour--color--dev-lime",
	"Liam Estrada": "liam-estrada--color--strategy-orange",
};
const FALLBACKS = ["laila-ali--color--teamwork-blue", "issac-varghese--color--dev-lime", "louis-au--color--strategy-orange", "olivia-yang--color--dev-lime", "florence-garcia--color--dev-lime", "darius-pavri--color--dev-lime", "charles-rex--color--dev-lime", "maia-ma--color--dev-lime", "raul-gonzalez--color--strategy-orange", "jordan--color--service-yellow", "melanie-lee--color--dev-lime", "belle-adams--color--dev-lime", "luna-delacour--color--dev-lime"];

/** The source prototype's people-to-avatar mapping, using VPK's existing copies of those assets. */
export function projectButterPersonAvatar(name: string): string {
	const hash = [...name].reduce((value, character) => Math.imul(value ^ (character.codePointAt(0) ?? 0), 16777619) >>> 0, 2166136261);
	const avatar = PERSON_AVATAR_IDS[name] ?? FALLBACKS[hash % FALLBACKS.length];
	const [person, color] = avatar.split("--color--");
	return `/avatar-user/${person}/color/asow-${color}.png`;
}
