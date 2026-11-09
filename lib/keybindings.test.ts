import { describe, expect, it } from "vitest";
import { actionForKey } from "./keybindings";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({
	key: k,
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

	it("leaves plain typing alone", () => {
		expect(actionForKey(key("j"))).toBeUndefined();
		expect(actionForKey(key("J", { ctrlKey: true, shiftKey: true }))).toBe(
			undefined,
		);
	});

	it("maps Escape to close", () => {
		expect(actionForKey(key("Escape"))).toBe("close");
	});
});
