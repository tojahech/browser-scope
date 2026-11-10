import { describe, expect, it } from "vitest";
import {
	actionForKey,
	formatBinding,
	moveSelection,
	shortcutFromEvent,
} from "./keybindings";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({
	key: k,
	ctrlKey: false,
	altKey: false,
	metaKey: false,
	shiftKey: false,
	isComposing: false,
	...mods,
});

const code = (c: string, mods: Partial<KeyboardEvent> = {}) => ({
	code: c,
	ctrlKey: false,
	altKey: false,
	metaKey: false,
	shiftKey: false,
	...mods,
});

describe("actionForKey", () => {
	it("maps navigation keys", () => {
		expect(actionForKey(key("j", { ctrlKey: true }))).toBe("selectNext");
		expect(actionForKey(key("ArrowDown"))).toBe("selectNext");
		expect(actionForKey(key("k", { ctrlKey: true }))).toBe("selectPrev");
		expect(actionForKey(key("ArrowUp"))).toBe("selectPrev");
	});

	it("distinguishes Enter from Ctrl+Enter", () => {
		expect(actionForKey(key("Enter"))).toBe("activate");
		expect(actionForKey(key("Enter", { ctrlKey: true }))).toBe("searchWeb");
	});

	it("maps Escape to close", () => {
		expect(actionForKey(key("Escape"))).toBe("close");
	});

	it("leaves typing, other shortcuts and IME composition alone", () => {
		expect(actionForKey(key("j"))).toBeUndefined();
		expect(
			actionForKey(key("J", { ctrlKey: true, shiftKey: true })),
		).toBeUndefined();
		expect(actionForKey(key("Enter", { altKey: true }))).toBeUndefined();
		expect(actionForKey(key("Enter", { isComposing: true }))).toBeUndefined();
	});
});

describe("moveSelection", () => {
	it("wraps around and handles empty lists", () => {
		expect(moveSelection(0, -1, 3)).toBe(2);
		expect(moveSelection(2, 1, 3)).toBe(0);
		expect(moveSelection(0, -1, 0)).toBe(0);
	});
});

describe("formatBinding", () => {
	it("formats bindings for display", () => {
		expect(formatBinding({ key: "j", ctrl: true, action: "selectNext" })).toBe(
			"Ctrl+J",
		);
		expect(formatBinding({ key: "ArrowDown", action: "selectNext" })).toBe("↓");
		expect(formatBinding({ key: "Escape", action: "close" })).toBe("Esc");
	});
});

describe("shortcutFromEvent", () => {
	it("builds command syntax from a keydown", () => {
		expect(
			shortcutFromEvent(code("KeyP", { ctrlKey: true, shiftKey: true }), false),
		).toBe("Ctrl+Shift+P");
		expect(shortcutFromEvent(code("Space", { ctrlKey: true }), false)).toBe(
			"Ctrl+Space",
		);
		expect(shortcutFromEvent(code("ArrowUp", { altKey: true }), false)).toBe(
			"Alt+Up",
		);
	});

	it("uses MacCtrl and Command on macOS", () => {
		expect(shortcutFromEvent(code("Space", { ctrlKey: true }), true)).toBe(
			"MacCtrl+Space",
		);
		expect(shortcutFromEvent(code("Space", { metaKey: true }), true)).toBe(
			"Command+Space",
		);
	});

	it("rejects combinations without a primary modifier", () => {
		expect(shortcutFromEvent(code("KeyP"), false)).toBeNull();
		expect(
			shortcutFromEvent(code("KeyP", { shiftKey: true }), false),
		).toBeNull();
		expect(
			shortcutFromEvent(code("Backquote", { ctrlKey: true }), false),
		).toBeNull();
	});

	it("allows bare function keys", () => {
		expect(shortcutFromEvent(code("F6"), false)).toBe("F6");
	});
});
