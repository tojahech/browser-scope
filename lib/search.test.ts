import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";
import { searchCandidates } from "./search";
import type { Candidate } from "./types";

function candidate(
	source: Candidate["source"],
	title: string,
	url = `https://${title}.test`,
	recency = 0,
): Candidate {
	const page = { id: `${source}:${title}`, title, url };
	if (source === "tab")
		return {
			...page,
			source,
			tabId: recency,
			windowId: 1,
			mruRank: 100 - recency,
		};
	if (source === "bookmark") return { ...page, source, dateAdded: recency };
	return { ...page, source, lastVisited: recency };
}
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
		expect(results[0].title).toBe("page");
		expect(results[0].target).toEqual({ kind: "tab", tabId: 5 });
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

describe("URL variants", () => {
	it("matches a bookmark title but activates the existing tab", () => {
		const [result] = searchCandidates(
			[
				candidate("tab", "Dashboard", "https://example.test", 42),
				candidate("bookmark", "Quarterly finances", "https://example.test"),
			],
			"finances",
		);
		expect(result).toMatchObject({
			source: "tab",
			title: "Quarterly finances",
			target: { kind: "tab", tabId: 42 },
			matchedCandidateId: "bookmark:Quarterly finances",
		});
		expect(result.titleMatches.map((i) => result.title[i]).join("")).toBe(
			"finances",
		);
	});
	it("matches an older duplicate tab title while activating the most recent instance", () => {
		const [result] = searchCandidates(
			[
				candidate("tab", "Old title", "https://same", 1),
				candidate("tab", "New title", "https://same", 5),
			],
			"old",
		);
		expect(result.title).toBe("Old title");
		expect(result.target).toEqual({ kind: "tab", tabId: 5 });
	});
	it("keeps the preferred tab title for empty queries", () => {
		const [result] = searchCandidates(
			[
				candidate("bookmark", "Alias", "https://same"),
				candidate("tab", "Old", "https://same", 1),
				candidate("tab", "Current", "https://same", 5),
			],
			"",
		);
		expect(result.title).toBe("Current");
		expect(result.titleMatches).toEqual([]);
	});
	it("uses the preferred source weight even when history supplies the match", () => {
		const bookmark = candidate("bookmark", "Dashboard", "https://same");
		const history = candidate("history", "Finances", "https://same");
		const [result] = searchCandidates([bookmark, history], "finances");
		expect(result.target).toEqual({ kind: "url", url: "https://same" });
		expect(result.score).toBeCloseTo(
			(fuzzyMatch("finances", "Finances")?.score ?? 0) * 0.85,
		);
	});
});
