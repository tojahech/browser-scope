import { expect, it } from "vitest";
import { themeVariables } from "./theme";

it("converts string, RGB and RGBA theme colours", () => {
	expect(
		themeVariables({
			popup: "#123456",
			popup_text: [1, 2, 3],
			popup_highlight: [4, 5, 6, 0.5],
		}),
	).toMatchObject({
		"--bs-bg": "#123456",
		"--bs-fg": "rgb(1 2 3)",
		"--bs-selected-bg": "rgb(4 5 6 / 0.5)",
	});
});

it("falls back along each variable's preference chain", () => {
	expect(themeVariables({ toolbar: "#111", frame: "#222" })).toEqual({
		"--bs-bg": "#111",
	});
	expect(themeVariables({ popup: null, frame: "#222" })).toEqual({
		"--bs-bg": "#222",
	});
});

it("leaves missing and malformed colours to the default palette", () => {
	expect(themeVariables(undefined)).toEqual({});
	expect(
		themeVariables({ popup: null, popup_text: [], popup_border: "" }),
	).toEqual({});
});
