import { describe, expect, it } from "vitest";
import { type Candidate, dedupe, search } from "./search";

const tab = (title: string, url: string, lastUsed = 0): Candidate => ({
	kind: "tab",
	title,
	url,
	tabId: lastUsed,
	windowId: 1,
	lastUsed,
});
const bookmark = (title: string, url: string): Candidate => ({
	kind: "bookmark",
	title,
	url,
});
const history = (title: string, url: string, lastUsed = 0): Candidate => ({
	kind: "history",
	title,
	url,
	lastUsed,
});

describe("dedupe", () => {
	it("keeps the highest-priority source for a shared URL", () => {
		const url = "https://example.com/";
		const result = dedupe([
			history("Example", url),
			bookmark("Example", url),
			tab("Example", url),
		]);
		expect(result).toHaveLength(1);
		expect(result[0].kind).toBe("tab");
	});

	it("keeps the most recent of several tabs with the same URL", () => {
		const url = "https://example.com/";
		const result = dedupe([
			tab("A", url, 1),
			tab("B", url, 5),
			tab("C", url, 3),
		]);
		expect(result.map((c) => c.title)).toEqual(["B"]);
	});
});

describe("search", () => {
	it("lists open tabs by recency for an empty query", () => {
		const candidates = [
			tab("Old", "https://old.test/", 1),
			bookmark("Bookmark", "https://b.test/"),
			tab("New", "https://new.test/", 3),
			tab("Mid", "https://mid.test/", 2),
		];
		expect(search("  ", candidates, 10).map((r) => r.candidate.title)).toEqual([
			"New",
			"Mid",
			"Old",
		]);
	});

	it("weights tabs above bookmarks above history for equal matches", () => {
		const candidates = [
			history("Docs", "https://h.test/"),
			bookmark("Docs", "https://b.test/"),
			tab("Docs", "https://t.test/"),
		];
		expect(search("docs", candidates, 10).map((r) => r.candidate.kind)).toEqual(
			["tab", "bookmark", "history"],
		);
	});

	it("lets a much better match outrank a better source", () => {
		const candidates = [
			tab("Daily operations checklist", "https://t.test/"),
			history("Docs", "https://h.test/"),
		];
		expect(search("docs", candidates, 10)[0].candidate.kind).toBe("history");
	});

	it("matches against the URL and reports URL highlight positions", () => {
		const [result] = search(
			"example",
			[tab("Home", "https://example.com/")],
			10,
		);
		expect(result.titlePositions).toEqual([]);
		expect(result.urlPositions).toEqual([8, 9, 10, 11, 12, 13, 14]);
	});

	it("requires every space-separated term to match", () => {
		const candidates = [
			tab("GitHub pull requests", "https://github.com/pulls"),
			tab("GitHub issues", "https://github.com/issues"),
		];
		const results = search("git pull", candidates, 10);
		expect(results.map((r) => r.candidate.title)).toEqual([
			"GitHub pull requests",
		]);
	});

	it("returns scores within 0..1 and respects the limit", () => {
		const candidates = Array.from({ length: 20 }, (_, i) =>
			history(`Page ${i}`, `https://p${i}.test/`),
		);
		const results = search("page", candidates, 5);
		expect(results).toHaveLength(5);
		for (const r of results) {
			expect(r.score).toBeGreaterThan(0);
			expect(r.score).toBeLessThanOrEqual(1);
		}
	});
});
