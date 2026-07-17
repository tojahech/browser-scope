import { describe, expect, it } from "vitest";
import {
	fuzzyMatch,
	rankRecentTabs,
	rankSearchResults,
	type SearchCandidate,
} from "../shared/search";

const candidates: SearchCandidate[] = [
	{
		source: "history",
		title: "BrowserScope documentation",
		url: "https://example.com/history",
	},
	{
		source: "bookmark",
		title: "Scope bookmark",
		url: "https://example.com/bookmark",
	},
	{
		mruRank: 1,
		source: "tab",
		tabId: 1,
		title: "BrowserScope tab",
		url: "https://example.com/tab",
	},
	{
		mruRank: 0,
		source: "tab",
		tabId: 2,
		title: "Scope duplicate tab",
		url: "https://example.com/bookmark",
	},
];

describe("fuzzyMatch", () => {
	it("matches case-insensitively and preserves character positions", () => {
		expect(fuzzyMatch("bSc", "BrowserScope")).toMatchObject({
			positions: [0, 7, 8],
		});
	});

	it("rejects non-subsequence queries", () => {
		expect(fuzzyMatch("zxy", "BrowserScope")).toBeNull();
	});

	it("rewards consecutive matches", () => {
		const consecutive = fuzzyMatch("bro", "BrowserScope");
		const sparse = fuzzyMatch("bro", "Browns are orange");
		expect(consecutive?.score).toBeGreaterThan(
			sparse?.score ?? Number.POSITIVE_INFINITY,
		);
	});
});

describe("result ranking", () => {
	it("prioritises tabs, then bookmarks, then history and de-duplicates URLs", () => {
		const results = rankSearchResults(candidates, "scope");
		expect(results.map((result) => result.source)).toEqual([
			"tab",
			"tab",
			"history",
		]);
		expect(
			results.filter((result) => result.url === "https://example.com/bookmark"),
		).toHaveLength(1);
	});

	it("shows empty queries as MRU tabs only", () => {
		const results = rankRecentTabs(candidates);
		expect(results.map((result) => result.tabId)).toEqual([2, 1]);
	});

	it("retains the highest-priority source when its duplicate supplies the match", () => {
		const results = rankSearchResults(
			[
				{
					source: "tab",
					tabId: 42,
					title: "Unrelated tab",
					url: "https://example.com/shared",
				},
				{
					source: "bookmark",
					title: "Needle",
					url: "https://example.com/shared",
				},
			],
			"needle",
		);
		expect(results[0]).toMatchObject({
			source: "tab",
			tabId: 42,
			title: "Needle",
		});
	});
});
