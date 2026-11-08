import { expect, it } from "vitest";
import { segmentByIndices } from "./highlight";

it("groups adjacent matches and preserves all text", () => {
	expect(segmentByIndices("BrowserScope", [0, 7, 8])).toEqual([
		{ text: "B", marked: true },
		{ text: "rowser", marked: false },
		{ text: "Sc", marked: true },
		{ text: "ope", marked: false },
	]);
});
it("handles empty input, full matches, and no matches", () => {
	expect(segmentByIndices("", [0])).toEqual([]);
	expect(segmentByIndices("abc", [])).toEqual([{ text: "abc", marked: false }]);
	expect(segmentByIndices("abc", [0, 1, 2])).toEqual([
		{ text: "abc", marked: true },
	]);
});
it("accepts unordered, repeated, and out-of-range positions", () => {
	expect(segmentByIndices("abc", [2, 1, 1, -1, 10])).toEqual([
		{ text: "a", marked: false },
		{ text: "bc", marked: true },
	]);
});
