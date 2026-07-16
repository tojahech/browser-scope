import { describe, expect, it } from "vitest";
import {
	KEYBINDINGS,
	matchesBinding,
	matchesShortcut,
	parseCommandShortcut,
	shortcutFromEvent,
} from "./keybindings";

function keyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
	return {
		key: "",
		code: "",
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		metaKey: false,
		repeat: false,
		...overrides,
	} as KeyboardEvent;
}

describe("matchesBinding", () => {
	it("matches Ctrl+j for moveDown but not plain j", () => {
		expect(
			matchesBinding(
				keyEvent({ key: "j", ctrlKey: true }),
				KEYBINDINGS.moveDown,
			),
		).toBe(true);
		expect(matchesBinding(keyEvent({ key: "j" }), KEYBINDINGS.moveDown)).toBe(
			false,
		);
	});

	it("matches arrow keys as an alternative", () => {
		expect(
			matchesBinding(keyEvent({ key: "ArrowDown" }), KEYBINDINGS.moveDown),
		).toBe(true);
		expect(
			matchesBinding(keyEvent({ key: "ArrowUp" }), KEYBINDINGS.moveUp),
		).toBe(true);
	});

	it("keeps Enter and Ctrl+Enter distinct", () => {
		const enter = keyEvent({ key: "Enter" });
		const ctrlEnter = keyEvent({ key: "Enter", ctrlKey: true });
		expect(matchesBinding(enter, KEYBINDINGS.confirm)).toBe(true);
		expect(matchesBinding(enter, KEYBINDINGS.webSearch)).toBe(false);
		expect(matchesBinding(ctrlEnter, KEYBINDINGS.webSearch)).toBe(true);
		expect(matchesBinding(ctrlEnter, KEYBINDINGS.confirm)).toBe(false);
	});
});

describe("parseCommandShortcut", () => {
	it("parses the default shortcut", () => {
		expect(parseCommandShortcut("Ctrl+Space", false)).toEqual({
			code: "Space",
			ctrl: true,
			alt: false,
			shift: false,
			meta: false,
		});
	});

	it("maps Ctrl to the Command key on macOS", () => {
		expect(parseCommandShortcut("Ctrl+Space", true)).toMatchObject({
			ctrl: false,
			meta: true,
		});
		expect(parseCommandShortcut("MacCtrl+Space", true)).toMatchObject({
			ctrl: true,
			meta: false,
		});
	});

	it("parses letters and multiple modifiers", () => {
		expect(parseCommandShortcut("Alt+Shift+K", false)).toEqual({
			code: "KeyK",
			ctrl: false,
			alt: true,
			shift: true,
			meta: false,
		});
	});

	it("rejects unknown parts", () => {
		expect(parseCommandShortcut("Hyper+K", false)).toBeNull();
		expect(parseCommandShortcut("Ctrl+Banana", false)).toBeNull();
		expect(parseCommandShortcut("", false)).toBeNull();
	});

	it("round-trips through a keyboard event", () => {
		const parsed = parseCommandShortcut("Ctrl+Space", false);
		expect(parsed).not.toBeNull();
		if (parsed === null) return;
		expect(
			matchesShortcut(keyEvent({ code: "Space", ctrlKey: true }), parsed),
		).toBe(true);
		expect(matchesShortcut(keyEvent({ code: "Space" }), parsed)).toBe(false);
		expect(
			matchesShortcut(keyEvent({ code: "KeyA", ctrlKey: true }), parsed),
		).toBe(false);
	});
});

describe("shortcutFromEvent", () => {
	it("builds command syntax from a keydown", () => {
		expect(
			shortcutFromEvent(
				keyEvent({ code: "KeyP", ctrlKey: true, shiftKey: true }),
				false,
			),
		).toBe("Ctrl+Shift+P");
		expect(
			shortcutFromEvent(keyEvent({ code: "Space", ctrlKey: true }), false),
		).toBe("Ctrl+Space");
	});

	it("uses MacCtrl and Command on macOS", () => {
		expect(
			shortcutFromEvent(keyEvent({ code: "Space", ctrlKey: true }), true),
		).toBe("MacCtrl+Space");
		expect(
			shortcutFromEvent(keyEvent({ code: "Space", metaKey: true }), true),
		).toBe("Command+Space");
	});

	it("rejects combinations without a primary modifier", () => {
		expect(shortcutFromEvent(keyEvent({ code: "KeyP" }), false)).toBeNull();
		expect(
			shortcutFromEvent(keyEvent({ code: "KeyP", shiftKey: true }), false),
		).toBeNull();
	});

	it("allows bare function keys", () => {
		expect(shortcutFromEvent(keyEvent({ code: "F6" }), false)).toBe("F6");
	});
});
