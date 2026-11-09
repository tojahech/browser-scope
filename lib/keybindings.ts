/** Keybindings used inside the finder UI. The global launch shortcut is a manifest command (see config.ts). */

export type Action =
	| "selectNext"
	| "selectPrev"
	| "activate"
	| "searchWeb"
	| "close";

interface KeyBinding {
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

type KeyEventLike = Pick<
	KeyboardEvent,
	"key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey"
>;

export function actionForKey(event: KeyEventLike): Action | undefined {
	if (event.altKey || event.metaKey || event.shiftKey) return undefined;
	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
	return KEYBINDINGS.find(
		(b) => b.key === key && Boolean(b.ctrl) === event.ctrlKey,
	)?.action;
}
