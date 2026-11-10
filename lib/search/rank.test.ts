import { describe, expect, it } from "vitest";
import { SOURCE_WEIGHTS } from "../config";
import type { Candidate } from "../types";
import { fuzzyMatch } from "./fuzzy";
import { search } from "./rank";

function candidate(
	source: Candidate["source"],
	title: string,
	url = `https://${title.replaceAll(" ", "-")}.test`,
	recency = 0,
): Candidate {
	const page = { id: `${source}:${title}`, title, url };
	if (source === "tab") {
		return {
			...page,
			source,
			tabId: recency,
			windowId: 1,
			mruRank: 100 - recency,
		};
	}
	if (source === "bookmark") return { ...page, source, dateAdded: recency };
	return { ...page, source, lastVisited: recency };
}

const titles = (results: { title: string }[]) => results.map((r) => r.title);

describe("empty query", () => {
	it("lists only open tabs, most recently used first", () => {
		const results = search(
			[
				candidate("tab", "old", undefined, 1),
				candidate("bookmark", "saved"),
				candidate("tab", "new", undefined, 3),
				candidate("tab", "mid", undefined, 2),
			],
			"  ",
		);
		expect(titles(results)).toEqual(["new", "mid", "old"]);
	});

	it("labels a tab with its own title even when a bookmark shares the URL", () => {
		const [result] = search(
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
});

describe("ranking", () => {
	it("weights tabs above bookmarks above history for equal matches", () => {
		const results = search(
			[
				candidate("history", "Docs", "https://h.test/"),
				candidate("bookmark", "Docs", "https://b.test/"),
				candidate("tab", "Docs", "https://t.test/"),
			],
			"docs",
		);
		expect(results.map((r) => r.source)).toEqual([
			"tab",
			"bookmark",
			"history",
		]);
	});

	it("lets a much better match outrank a better source", () => {
		const results = search(
			[
				candidate("tab", "Daily operations checklist", "https://t.test/"),
				candidate("history", "Docs", "https://h.test/"),
			],
			"docs",
		);
		expect(results[0].source).toBe("history");
	});

	it("requires every space-separated term to match", () => {
		const results = search(
			[
				candidate("tab", "GitHub pull requests", "https://github.com/pulls"),
				candidate("tab", "GitHub issues", "https://github.com/issues"),
			],
			"git pull",
		);
		expect(titles(results)).toEqual(["GitHub pull requests"]);
	});

	it("matches the URL and reports URL highlight positions", () => {
		const [result] = search(
			[candidate("tab", "Home", "https://example.com/")],
			"example",
		);
		expect(result.titleMatches).toEqual([]);
		expect(result.urlMatches).toEqual([8, 9, 10, 11, 12, 13, 14]);
	});

	it("discounts URL matches against equal title matches", () => {
		const results = search(
			[
				candidate("history", "Elsewhere", "https://docs.test/"),
				candidate("history", "docs", "https://other.test/"),
			],
			"docs",
		);
		expect(titles(results)).toEqual(["docs", "Elsewhere"]);
	});

	it("keeps scores within 0..1 and respects the limit", () => {
		const many = Array.from({ length: 150 }, (_, i) =>
			candidate("history", `Page ${i}`),
		);
		expect(search(many, "page")).toHaveLength(100);
		const results = search(many, "page", 5);
		expect(results).toHaveLength(5);
		for (const r of results) {
			expect(r.score).toBeGreaterThan(0);
			expect(r.score).toBeLessThanOrEqual(1);
		}
	});
});

describe("URLs in several sources", () => {
	it("shows a URL once, labelled and targeted by the most recent tab", () => {
		const results = search(
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
		expect(results[0].target).toEqual({ kind: "tab", tabId: 5 });
	});

	it("matches a bookmark's title but activates the open tab", () => {
		const [result] = search(
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

	it("uses the preferred source's weight even when history supplies the match", () => {
		const [result] = search(
			[
				candidate("bookmark", "Dashboard", "https://same"),
				candidate("history", "Finances", "https://same"),
			],
			"finances",
		);
		expect(result.target).toEqual({ kind: "url", url: "https://same" });
		expect(result.score).toBeCloseTo(
			(fuzzyMatch("finances", "Finances")?.score ?? 0) *
				SOURCE_WEIGHTS.bookmark,
		);
	});
});
