import { expect, it, vi } from "vitest";
import { themeVariables } from "./theme";

vi.mock("wxt/browser", () => ({ browser: {} }));
it("converts string, RGB, and RGBA browser colors", () => {
	expect(
		themeVariables({
			popup: "#123456",
			popup_text: [1, 2, 3],
			popup_highlight: [4, 5, 6, 0.5],
		}),
	).toEqual({
		"--surface": "#123456",
		"--text": "rgb(1 2 3)",
		"--selected": "rgb(4 5 6 / 0.5)",
	});
});
it("leaves missing and malformed colors to the default palette", () => {
	expect(
		themeVariables({ popup: null, popup_text: [], popup_border: "" }),
	).toEqual({});
});
