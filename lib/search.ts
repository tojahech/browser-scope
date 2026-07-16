/**
 * Pure search pipeline: dedupe, fuzzy-filter, rank. No browser APIs so it is
 * unit-testable; candidate loading lives in `sources.ts`.
 */
import { CONFIG, SOURCE_WEIGHT } from "./config";
import { fuzzyMatch } from "./fuzzy";
import type { Candidate } from "./types";

export interface SearchResult extends Candidate {
	score: number;
	/** Matched character indices into `title`, for highlighting. */
	titleIndices: number[];
}

/**
 * A URL that exists in multiple sources appears once, labelled by its
 * highest-priority source (tab > bookmark > history).
 */
export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
	const byUrl = new Map<string, Candidate>();
	for (const candidate of candidates) {
		const existing = byUrl.get(candidate.url);
		if (
			existing === undefined ||
			SOURCE_WEIGHT[candidate.type] > SOURCE_WEIGHT[existing.type]
		) {
			byUrl.set(candidate.url, candidate);
		}
	}
	return [...byUrl.values()];
}

/**
 * An empty query lists open tabs most-recently-used first, with the tab the
 * popup was opened from moved to the end (Alt-Tab style: the first result is
 * the previously active tab).
 */
export function mruTabs(candidates: Candidate[]): SearchResult[] {
	const tabs = candidates
		.filter((c) => c.type === "tab")
		.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
	const others = tabs.filter((t) => !t.isCurrentTab);
	const current = tabs.filter((t) => t.isCurrentTab);
	return [...others, ...current]
		.slice(0, CONFIG.MAX_RENDERED_RESULTS)
		.map((c) => ({ ...c, score: 0, titleIndices: [] }));
}

/**
 * Fuzzy-match the query against every candidate's title and URL, then rank:
 * source weight first (tabs > bookmarks > history), match quality second.
 */
export function searchCandidates(
	query: string,
	candidates: Candidate[],
): SearchResult[] {
	const trimmed = query.trim();
	if (trimmed === "") return mruTabs(candidates);

	const results: SearchResult[] = [];
	for (const candidate of candidates) {
		const titleMatch = fuzzyMatch(trimmed, candidate.title);
		const urlMatch = fuzzyMatch(trimmed, candidate.url);
		if (titleMatch === null && urlMatch === null) continue;
		const score = Math.max(
			titleMatch?.score ?? Number.NEGATIVE_INFINITY,
			urlMatch?.score ?? Number.NEGATIVE_INFINITY,
		);
		results.push({
			...candidate,
			score,
			titleIndices: titleMatch?.indices ?? [],
		});
	}

	results.sort(
		(a, b) =>
			SOURCE_WEIGHT[b.type] - SOURCE_WEIGHT[a.type] ||
			b.score - a.score ||
			a.title.localeCompare(b.title),
	);
	return results.slice(0, CONFIG.MAX_RENDERED_RESULTS);
}
