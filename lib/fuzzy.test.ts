import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";

function score(query: string, target: string): number {
	const match = fuzzyMatch(query, target);
	if (match === null)
		throw new Error(`expected "${query}" to match "${target}"`);
	return match.score;
}

describe("fuzzyMatch", () => {
	it("matches a subsequence", () => {
		expect(fuzzyMatch("hlo", "hello")).not.toBeNull();
	});

	it("rejects a non-subsequence", () => {
		expect(fuzzyMatch("hox", "hello")).toBeNull();
		expect(fuzzyMatch("olleh", "hello")).toBeNull();
	});

	it("rejects queries longer than the target", () => {
		expect(fuzzyMatch("hello world", "hello")).toBeNull();
	});

	it("is case-insensitive", () => {
		expect(fuzzyMatch("HELLO", "hello")).not.toBeNull();
		expect(fuzzyMatch("hello", "HeLLo")).not.toBeNull();
	});

	it("matches an empty query with an empty score", () => {
		expect(fuzzyMatch("", "anything")).toEqual({ score: 0, indices: [] });
	});

	it("returns the matched indices for highlighting", () => {
		const match = fuzzyMatch("hlo", "hello");
		expect(match?.indices).toEqual([0, 3, 4]);
	});

	it("tightens the match window from the right", () => {
		// Forward-only matching would pick indices [0, 4]; the backward pass
		// should prefer the tighter window [2, 4].
		const match = fuzzyMatch("ab", "axaxb");
		expect(match?.indices).toEqual([2, 4]);
	});

	it("prefers consecutive matches over scattered ones", () => {
		expect(score("foo", "foobar")).toBeGreaterThan(score("foo", "fxoxobar"));
	});

	it("prefers word-boundary matches", () => {
		expect(score("bar", "foo bar")).toBeGreaterThan(score("bar", "foobark"));
	});

	it("prefers matches near the start of the target", () => {
		expect(score("conf", "config for tests")).toBeGreaterThan(
			score("conf", "tests for config"),
		);
	});

	it("prefers shorter targets for the same match", () => {
		expect(score("abc", "abc")).toBeGreaterThan(score("abc", "abcdefghij"));
	});
});
