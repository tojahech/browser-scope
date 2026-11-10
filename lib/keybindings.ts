/**
 * Every hotkey used by BrowserScope is defined in this file.
 *
 * The launch shortcut is a manifest command (see `LAUNCH_COMMAND` in config.ts); users can change it
 * on the options page or in the browser's shortcut settings. Everything else applies inside the
 * finder.
 */

export type Action =
	| "selectNext"
	| "selectPrev"
	| "activate"
	| "searchWeb"
	| "close";

export interface KeyBinding {
	/** Compared against `KeyboardEvent.key`, case-insensitively for single characters. */
	key: string;
	ctrl?: boolean;
	action: Action;
}

export const KEYBINDINGS: KeyBinding[] = [
	{ key: "j", ctrl: true, action: "selectNext" },
	{ key: "ArrowDown", action: "selectNext" },
	{ key: "k", ctrl: true, action: "selectPrev" },
	{ key: "ArrowUp", action: "selectPrev" },
	{ key: "Enter", action: "activate" },
	{ key: "Enter", ctrl: true, action: "searchWeb" },
	{ key: "Escape", action: "close" },
];

/** Descriptions shown in the options page key table. */
export const ACTION_LABELS: Record<Action, string> = {
	selectNext: "Move selection down",
	selectPrev: "Move selection up",
	activate: "Open the selected result",
	searchWeb: "Search the query with the default search engine",
	close: "Close the finder",
};

type KeyEventLike = Pick<
	KeyboardEvent,
	"key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey" | "isComposing"
>;

/** The finder action for a keydown, or undefined to let the input handle it. */
export function actionForKey(event: KeyEventLike): Action | undefined {
	// Keys pressed while an IME is composing belong to the IME.
	if (event.isComposing) return undefined;
	if (event.altKey || event.metaKey || event.shiftKey) return undefined;
	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
	return KEYBINDINGS.find(
		(b) => b.key === key && Boolean(b.ctrl) === event.ctrlKey,
	)?.action;
}

/** Move a selection index by `delta`, wrapping around; 0 for an empty list. */
export function moveSelection(
	current: number,
	delta: number,
	length: number,
): number {
	return length ? (current + delta + length) % length : 0;
}

/** Human-readable form of a binding, e.g. "Ctrl+J" or "↓". */
export function formatBinding(binding: KeyBinding): string {
	const key =
		{ ArrowDown: "↓", ArrowUp: "↑", Escape: "Esc" }[binding.key] ??
		(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key);
	return binding.ctrl ? `Ctrl+${key}` : key;
}

/** `KeyboardEvent.code` values for the named keys the commands API accepts. */
const CODE_TO_KEY: Record<string, string> = {
	Space: "Space",
	Comma: "Comma",
	Period: "Period",
	Home: "Home",
	End: "End",
	PageUp: "PageUp",
	PageDown: "PageDown",
	Insert: "Insert",
	Delete: "Delete",
	ArrowUp: "Up",
	ArrowDown: "Down",
	ArrowLeft: "Left",
	ArrowRight: "Right",
};

/**
 * Convert a captured keydown into manifest command shortcut syntax, for the options page rebind
 * control. Returns null for combinations the commands API would reject.
 */
export function shortcutFromEvent(
	event: Pick<
		KeyboardEvent,
		"code" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey"
	>,
	isMac: boolean,
): string | null {
	let key: string | null;
	if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
	else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
	else if (/^F([1-9]|1[0-2])$/.test(event.code)) key = event.code;
	else key = CODE_TO_KEY[event.code] ?? null;
	if (key === null) return null;

	const mods: string[] = [];
	// On macOS the commands API spells the Control key "MacCtrl"; "Ctrl" there means Command.
	if (event.ctrlKey) mods.push(isMac ? "MacCtrl" : "Ctrl");
	if (event.metaKey && isMac) mods.push("Command");
	if (event.altKey) mods.push("Alt");
	if (event.shiftKey) mods.push("Shift");

	const isFunctionKey = /^F\d+$/.test(key);
	const hasPrimaryMod = mods.some((m) => m !== "Shift");
	if (!isFunctionKey && !hasPrimaryMod) return null;
	return [...mods, key].join("+");
}
