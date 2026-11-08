export type FinderAction =
	| "next"
	| "previous"
	| "activate"
	| "search"
	| "close";
export const KEYBINDINGS = [
	{ key: "ArrowDown", ctrl: false, action: "next" },
	{ key: "j", ctrl: true, action: "next" },
	{ key: "ArrowUp", ctrl: false, action: "previous" },
	{ key: "k", ctrl: true, action: "previous" },
	{ key: "Enter", ctrl: false, action: "activate" },
	{ key: "Enter", ctrl: true, action: "search" },
	{ key: "Escape", ctrl: false, action: "close" },
] as const;
export function keyAction(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
	>,
): FinderAction | undefined {
	if (event.isComposing || event.altKey || event.metaKey || event.shiftKey)
		return;
	return KEYBINDINGS.find(
		(binding) =>
			binding.key.toLowerCase() === event.key.toLowerCase() &&
			binding.ctrl === event.ctrlKey,
	)?.action;
}
export function moveSelection(current: number, delta: number, length: number) {
	return length ? (current + delta + length) % length : 0;
}
