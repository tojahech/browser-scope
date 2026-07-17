/**
 * Commands are declared in the manifest and can be changed in the browser's
 * extension-shortcuts UI. Popup bindings intentionally live here so they are
 * discoverable in one place.
 */
export const COMMANDS = {
	LAUNCH: "launch-browser-scope",
} as const;

export const LAUNCH_SHORTCUT = {
	default: "Ctrl+Space",
	mac: "MacCtrl+Space",
} as const;

export const POPUP_KEYBINDINGS = {
	CLOSE: "Escape",
	CONFIRM: "Enter",
	MOVE_DOWN: ["ArrowDown", "j"],
	MOVE_UP: ["ArrowUp", "k"],
} as const;

export function isMoveDown(event: KeyboardEvent) {
	return (
		event.key === POPUP_KEYBINDINGS.MOVE_DOWN[0] ||
		(event.ctrlKey &&
			event.key.toLowerCase() === POPUP_KEYBINDINGS.MOVE_DOWN[1])
	);
}

export function isMoveUp(event: KeyboardEvent) {
	return (
		event.key === POPUP_KEYBINDINGS.MOVE_UP[0] ||
		(event.ctrlKey && event.key.toLowerCase() === POPUP_KEYBINDINGS.MOVE_UP[1])
	);
}
