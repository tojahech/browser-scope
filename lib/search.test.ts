import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { dedupeCandidates, mruTabs, searchCandidates } from "./search";
import type { Candidate } from "./types";

function tab(overrides: Partial<Candidate> & { url: string }): Candidate {
	return {
		type: "tab",
		title: overrides.url,
		tabId: 1,
		windowId: 1,
		...overrides,
	};
}

function bookmark(overrides: Partial<Candidate> & { url: string }): Candidate {
	return { type: "bookmark", title: overrides.url, ...overrides };
}

function history(overrides: Partial<Candidate> & { url: string }): Candidate {
	return { type: "history", title: overrides.url, ...overrides };
}

describe("dedupeCandidates", () => {
	it("keeps a URL once, labelled by its highest-priority source", () => {
		const deduped = dedupeCandidates([
			history({ url: "https://a.com" }),
			bookmark({ url: "https://a.com" }),
			tab({ url: "https://a.com" }),
			history({ url: "https://b.com" }),
		]);
		expect(deduped).toHaveLength(2);
		expect(deduped.find((c) => c.url === "https://a.com")?.type).toBe("tab");
		expect(deduped.find((c) => c.url === "https://b.com")?.type).toBe(
			"history",
		);
	});
});

describe("searchCandidates", () => {
	it("filters out candidates that do not match", () => {
		const results = searchCandidates("zzz", [
			tab({ url: "https://a.com", title: "Alpha" }),
			bookmark({ url: "https://b.com", title: "Beta" }),
		]);
		expect(results).toHaveLength(0);
	});

	it("ranks by source tier before match quality", () => {
		const results = searchCandidates("doc", [
			history({ url: "https://docs.com", title: "doc" }),
			bookmark({ url: "https://b.com/misc", title: "misc docs archive" }),
			tab({ url: "https://t.com/misc", title: "my odd collection" }),
		]);
		// The tab has a far weaker (scattered) match but still ranks first;
		// the history entry's exact match still ranks below the bookmark.
		expect(results.map((r) => r.type)).toEqual(["tab", "bookmark", "history"]);
	});

	it("ranks by match quality within a source tier", () => {
		const results = searchCandidates("news", [
			bookmark({ url: "https://a.com", title: "notes we share" }),
			bookmark({ url: "https://b.com", title: "news" }),
		]);
		expect(results[0]?.title).toBe("news");
	});

	it("matches against the URL as well as the title", () => {
		const results = searchCandidates("example", [
			bookmark({ url: "https://example.com", title: "Homepage" }),
		]);
		expect(results).toHaveLength(1);
		// URL-only match: no title highlight indices.
		expect(results[0]?.titleIndices).toEqual([]);
	});

	it("reports title match indices for highlighting", () => {
		const results = searchCandidates("home", [
			bookmark({ url: "https://example.com", title: "My Homepage" }),
		]);
		expect(results[0]?.titleIndices).toEqual([3, 4, 5, 6]);
	});

	it("caps the number of results", () => {
		const many = Array.from(
			{ length: CONFIG.MAX_RENDERED_RESULTS + 20 },
			(_, i) =>
				history({ url: `https://site-${i}.com/page`, title: `page ${i}` }),
		);
		expect(searchCandidates("page", many)).toHaveLength(
			CONFIG.MAX_RENDERED_RESULTS,
		);
	});
});

describe("mruTabs (empty query)", () => {
	const candidates: Candidate[] = [
		tab({ url: "https://old.com", tabId: 1, lastAccessed: 100 }),
		tab({
			url: "https://current.com",
			tabId: 2,
			lastAccessed: 300,
			isCurrentTab: true,
		}),
		tab({ url: "https://previous.com", tabId: 3, lastAccessed: 200 }),
		bookmark({ url: "https://bookmark.com" }),
		history({ url: "https://history.com" }),
	];

	it("lists only open tabs", () => {
		const results = searchCandidates("", candidates);
		expect(results.every((r) => r.type === "tab")).toBe(true);
	});

	it("orders by most-recently-used with the current tab last", () => {
		const results = mruTabs(candidates);
		expect(results.map((r) => r.url)).toEqual([
			"https://previous.com",
			"https://old.com",
			"https://current.com",
		]);
	});

	it("is used for whitespace-only queries", () => {
		expect(searchCandidates("  ", candidates)).toEqual(
			searchCandidates("", candidates),
		);
	});
});
