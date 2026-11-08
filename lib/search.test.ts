import { describe, expect, it } from "vitest";
import { type Candidate, fuzzyMatch, searchCandidates } from "./search";

function candidate(
	source: Candidate["source"],
	title: string,
	url = `https://${title}.test`,
	lastAccessed = 0,
): Candidate {
	return { id: `${source}:${title}`, source, title, url, lastAccessed };
}
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
describe("search ranking", () => {
	it("shows only tabs in MRU order for empty queries", () => {
		expect(
			searchCandidates(
				[
					candidate("tab", "old", undefined, 1),
					candidate("bookmark", "saved"),
					candidate("tab", "new", undefined, 3),
				],
				"  ",
			).map((item) => item.title),
		).toEqual(["new", "old"]);
	});
	it("deduplicates all sources by URL with tabs preferred, including duplicate tabs", () => {
		const results = searchCandidates(
			[
				candidate("history", "page", "https://same", 99),
				candidate("bookmark", "page", "https://same"),
				candidate("tab", "page old", "https://same", 1),
				candidate("tab", "page new", "https://same", 5),
			],
			"page",
		);
		expect(results).toHaveLength(1);
		expect(results[0].source).toBe("tab");
		expect(results[0].title).toBe("page new");
	});
	it("applies source discounts and keeps normalized scores", () => {
		const results = searchCandidates(
			[
				candidate("history", "example"),
				candidate("bookmark", "example", "https://bookmark"),
				candidate("tab", "example", "https://tab"),
			],
			"ex",
		);
		expect(results.map((item) => item.source)).toEqual([
			"tab",
			"bookmark",
			"history",
		]);
		for (const item of results) {
			expect(item.score).toBeGreaterThan(0);
			expect(item.score).toBeLessThanOrEqual(1);
		}
	});
	it("allows match quality to outweigh the source discount", () => {
		const results = searchCandidates(
			[
				candidate("tab", "a very long b very long c", "https://other"),
				candidate("bookmark", "abc"),
			],
			"abc",
		);
		expect(results[0].source).toBe("bookmark");
	});
	it("searches and highlights URLs as well as titles", () => {
		const [result] = searchCandidates(
			[candidate("history", "Documentation", "https://solidjs.com")],
			"sld",
		);
		expect(result.urlMatches.length).toBe(3);
		expect(result.titleMatches).toEqual([]);
	});
	it("limits the rendered results", () => {
		expect(
			searchCandidates(
				Array.from({ length: 150 }, (_, i) => candidate("tab", `page${i}`)),
				"page",
			),
		).toHaveLength(100);
	});
});
