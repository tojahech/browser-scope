/**
 * Every hotkey used by BrowserScope is defined in this file.
 *
 * The launch shortcut is registered through the manifest `commands` API and
 * can be changed by the user in the browser's shortcut settings or on the
 * extension options page. Everything else applies inside the popup.
 */

export interface KeyBinding {
	/** Compared against `KeyboardEvent.key`, case-insensitively. */
	key: string;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
}

export const KEYBINDINGS = {
	moveDown: [{ key: "j", ctrl: true }, { key: "ArrowDown" }],
	moveUp: [{ key: "k", ctrl: true }, { key: "ArrowUp" }],
	/** Action the selected result. */
	confirm: [{ key: "Enter" }],
	/** Search the raw query with the browser's default engine in a new tab. */
	webSearch: [{ key: "Enter", ctrl: true }],
	close: [{ key: "Escape" }],
} satisfies Record<string, KeyBinding[]>;

/** Default launch shortcut, in manifest `commands` syntax. */
export const LAUNCH_SHORTCUT_DEFAULT = "Ctrl+Space";
/** On macOS, `MacCtrl` is the literal Control key (plain `Ctrl` would mean Command). */
export const LAUNCH_SHORTCUT_DEFAULT_MAC = "MacCtrl+Space";

/** True when the event matches any of the given bindings exactly. */
export function matchesBinding(
	e: KeyboardEvent,
	bindings: KeyBinding[],
): boolean {
	return bindings.some(
		(b) =>
			e.key.toLowerCase() === b.key.toLowerCase() &&
			e.ctrlKey === Boolean(b.ctrl) &&
			e.altKey === Boolean(b.alt) &&
			e.shiftKey === Boolean(b.shift) &&
			e.metaKey === Boolean(b.meta),
	);
}

/** A manifest command shortcut resolved to `KeyboardEvent` terms. */
export interface ParsedShortcut {
	/** Compared against `KeyboardEvent.code`. */
	code: string;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
}

const KEY_TO_CODE: Record<string, string> = {
	Space: "Space",
	Comma: "Comma",
	Period: "Period",
	Home: "Home",
	End: "End",
	PageUp: "PageUp",
	PageDown: "PageDown",
	Insert: "Insert",
	Delete: "Delete",
	Up: "ArrowUp",
	Down: "ArrowDown",
	Left: "ArrowLeft",
	Right: "ArrowRight",
};

function keyToCode(key: string): string | null {
	if (/^[A-Za-z]$/.test(key)) return `Key${key.toUpperCase()}`;
	if (/^[0-9]$/.test(key)) return `Digit${key}`;
	if (/^F([1-9]|1[0-2])$/.test(key)) return key;
	return KEY_TO_CODE[key] ?? null;
}

/**
 * Parse a manifest command shortcut string (e.g. "Ctrl+Space") so the popup
 * can recognise a repeat press of the launch shortcut for the MRU quick-switch.
 */
export function parseCommandShortcut(
	shortcut: string,
	isMac: boolean,
): ParsedShortcut | null {
	const parts = shortcut.split("+").map((p) => p.trim());
	if (parts.length === 0 || parts.some((p) => p === "")) return null;
	const code = keyToCode(parts[parts.length - 1]);
	if (code === null) return null;
	const parsed: ParsedShortcut = {
		code,
		ctrl: false,
		alt: false,
		shift: false,
		meta: false,
	};
	for (const mod of parts.slice(0, -1)) {
		switch (mod) {
			case "Ctrl":
				// On macOS the browser maps "Ctrl" to the Command key.
				if (isMac) parsed.meta = true;
				else parsed.ctrl = true;
				break;
			case "MacCtrl":
				parsed.ctrl = true;
				break;
			case "Command":
				parsed.meta = true;
				break;
			case "Alt":
				parsed.alt = true;
				break;
			case "Shift":
				parsed.shift = true;
				break;
			default:
				return null;
		}
	}
	return parsed;
}

/** True when the event is the parsed launch shortcut. */
export function matchesShortcut(e: KeyboardEvent, s: ParsedShortcut): boolean {
	return (
		e.code === s.code &&
		e.ctrlKey === s.ctrl &&
		e.altKey === s.alt &&
		e.shiftKey === s.shift &&
		e.metaKey === s.meta
	);
}

const CODE_TO_KEY: Record<string, string> = Object.fromEntries(
	Object.entries(KEY_TO_CODE).map(([key, code]) => [code, key]),
);

/**
 * Convert a captured keydown into manifest command shortcut syntax, for the
 * options page rebind control. Returns null for combinations the commands
 * API would reject.
 */
export function shortcutFromEvent(
	e: KeyboardEvent,
	isMac: boolean,
): string | null {
	let key: string | null = null;
	if (/^Key([A-Z])$/.test(e.code)) key = e.code.slice(3);
	else if (/^Digit([0-9])$/.test(e.code)) key = e.code.slice(5);
	else if (/^F([1-9]|1[0-2])$/.test(e.code)) key = e.code;
	else key = CODE_TO_KEY[e.code] ?? null;
	if (key === null) return null;

	const mods: string[] = [];
	if (e.ctrlKey) mods.push(isMac ? "MacCtrl" : "Ctrl");
	if (e.metaKey && isMac) mods.push("Command");
	if (e.altKey) mods.push("Alt");
	if (e.shiftKey) mods.push("Shift");

	const isFunctionKey = /^F\d+$/.test(key);
	const hasPrimaryMod = mods.some((m) => m !== "Shift");
	if (!isFunctionKey && !hasPrimaryMod) return null;
	return [...mods, key].join("+");
}
