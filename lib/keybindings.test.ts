import { expect, it } from "vitest";
import { keyAction, moveSelection } from "./keybindings";

const event = {
	key: "Enter",
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	isComposing: false,
};
it("distinguishes activation from default-engine search", () => {
	expect(keyAction(event)).toBe("activate");
	expect(keyAction({ ...event, ctrlKey: true })).toBe("search");
});
it("supports arrow keys and control navigation", () => {
	expect(keyAction({ ...event, key: "j", ctrlKey: true })).toBe("next");
	expect(keyAction({ ...event, key: "k", ctrlKey: true })).toBe("previous");
	expect(keyAction({ ...event, key: "ArrowDown" })).toBe("next");
	expect(keyAction({ ...event, key: "ArrowUp" })).toBe("previous");
	expect(keyAction({ ...event, key: "Escape" })).toBe("close");
});
it("does not intercept composition or unrelated shortcuts", () => {
	expect(keyAction({ ...event, isComposing: true })).toBeUndefined();
	expect(keyAction({ ...event, altKey: true })).toBeUndefined();
	expect(keyAction({ ...event, key: "j" })).toBeUndefined();
});
it("wraps selection and safely handles empty lists", () => {
	expect(moveSelection(0, -1, 3)).toBe(2);
	expect(moveSelection(2, 1, 3)).toBe(0);
	expect(moveSelection(0, -1, 0)).toBe(0);
});
