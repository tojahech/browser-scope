import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";

describe("fuzzy matching", () => {
	it("matches non-contiguous characters case-insensitively and returns highlight positions", () => {
		expect(fuzzyMatch("BSc", "BrowserScope")?.indices).toEqual([0, 7, 8]);
		expect(fuzzyMatch("zz", "BrowserScope")).toBeNull();
	});
	it("prefers contiguous matches and finds a later better alignment", () => {
		expect(fuzzyMatch("abc", "a long b long c abc")?.indices).toEqual([
			16, 17, 18,
		]);
		expect(fuzzyMatch("abc", "abc")?.score).toBeGreaterThan(
			fuzzyMatch("abc", "a long b long c")?.score ?? 0,
		);
	});
	it("handles empty, missing, and repeated characters", () => {
		expect(fuzzyMatch("", "")).toEqual({ score: 1, indices: [] });
		expect(fuzzyMatch("long", "a")).toBeNull();
		expect(fuzzyMatch("aa", "a")).toBeNull();
		expect(fuzzyMatch("aa", "banana")?.indices).toHaveLength(2);
	});
});
