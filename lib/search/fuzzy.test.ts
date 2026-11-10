import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";

describe("fuzzyMatch", () => {
	it("returns undefined when the pattern is not a subsequence", () => {
		expect(fuzzyMatch("xyz", "github")).toBeUndefined();
		expect(fuzzyMatch("hubgit", "github")).toBeUndefined();
	});

	it("matches empty pattern with full score", () => {
		expect(fuzzyMatch("", "anything")).toEqual({ score: 1, positions: [] });
	});

	it("is case-insensitive", () => {
		expect(fuzzyMatch("GIT", "github")?.positions).toEqual([0, 1, 2]);
		expect(fuzzyMatch("git", "GitHub")?.positions).toEqual([0, 1, 2]);
	});

	it("scores a prefix match as perfect", () => {
		expect(fuzzyMatch("git", "github")?.score).toBe(1);
	});

	it("keeps scores within 0..1", () => {
		for (const [p, t] of [
			["a", "zzzzzzzzzza"],
			["abc", "a-----------b-----------c"],
			["mail", "Inbox - Gmail"],
		]) {
			const score = fuzzyMatch(p, t)?.score ?? -1;
			expect(score).toBeGreaterThan(0);
			expect(score).toBeLessThanOrEqual(1);
		}
	});

	it("prefers word boundaries over mid-word matches", () => {
		// "gh" should match the initials of "Git Hub", not "ligh".
		expect(fuzzyMatch("gh", "light Git Hub")?.positions).toEqual([6, 10]);
	});

	it("prefers consecutive matches", () => {
		const consecutive = fuzzyMatch("doc", "docs.example.com")?.score ?? 0;
		const scattered = fuzzyMatch("doc", "d-o-c")?.score ?? 0;
		expect(consecutive).toBeGreaterThan(scattered);
	});

	it("finds the best alignment rather than the first", () => {
		// Greedy left-to-right would take the "r" in "react"; best is the "rs" boundary run.
		expect(fuzzyMatch("rs", "react rs")?.positions).toEqual([6, 7]);
	});

	it("ranks tighter matches higher", () => {
		const tight = fuzzyMatch("news", "Hacker News")?.score ?? 0;
		const loose = fuzzyMatch("news", "nobody ever wants snow")?.score ?? 0;
		expect(tight).toBeGreaterThan(loose);
	});
});
