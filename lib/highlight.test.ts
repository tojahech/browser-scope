import { describe, expect, it } from "vitest";
import { segmentByIndices } from "./highlight";

describe("segmentByIndices", () => {
	it("returns one plain segment when nothing matched", () => {
		expect(segmentByIndices("hello", [])).toEqual([
			{ text: "hello", highlighted: false },
		]);
	});

	it("splits matched and unmatched runs", () => {
		expect(segmentByIndices("hello", [0, 3, 4])).toEqual([
			{ text: "h", highlighted: true },
			{ text: "el", highlighted: false },
			{ text: "lo", highlighted: true },
		]);
	});

	it("merges consecutive matched indices into one segment", () => {
		expect(segmentByIndices("abcdef", [1, 2, 3])).toEqual([
			{ text: "a", highlighted: false },
			{ text: "bcd", highlighted: true },
			{ text: "ef", highlighted: false },
		]);
	});

	it("handles a fully matched string", () => {
		expect(segmentByIndices("ab", [0, 1])).toEqual([
			{ text: "ab", highlighted: true },
		]);
	});

	it("handles empty text", () => {
		expect(segmentByIndices("", [])).toEqual([]);
	});

	it("reassembles to the original text", () => {
		const segments = segmentByIndices("The quick brown fox", [4, 5, 10, 16]);
		expect(segments.map((s) => s.text).join("")).toBe("The quick brown fox");
	});
});
