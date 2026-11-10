/**
 * Ranking. Candidates sharing a URL are grouped so each URL appears once, labelled and weighted by
 * its preferred source, while any variant's title (e.g. a bookmark's custom name) can supply the
 * match. A result's score is match quality times the preferred source's weight.
 */

import { MAX_RESULTS, SOURCE_WEIGHTS, URL_MATCH_WEIGHT } from "../config";
import type { Candidate, Result, UrlGroup } from "../types";
import { fuzzyMatch } from "./fuzzy";

/**
 * Order candidates without a query: source weight first, then recency within a source (MRU rank
 * for tabs, timestamps for the rest). Also breaks ties between equal scores.
 */
export function compareCandidates(a: Candidate, b: Candidate): number {
	const source = SOURCE_WEIGHTS[b.source] - SOURCE_WEIGHTS[a.source];
	if (source) return source;
	if (a.source === "tab" && b.source === "tab") {
		return a.mruRank - b.mruRank || a.id.localeCompare(b.id);
	}
	if (a.source === "bookmark" && b.source === "bookmark") {
		return b.dateAdded - a.dateAdded || a.id.localeCompare(b.id);
	}
	if (a.source === "history" && b.source === "history") {
		return b.lastVisited - a.lastVisited || a.id.localeCompare(b.id);
	}
	return a.id.localeCompare(b.id);
}

/** Collapse candidates by URL, keeping every variant and picking the preferred one. */
export function groupCandidates(candidates: Candidate[]): UrlGroup[] {
	const groups = new Map<string, UrlGroup>();
	for (const candidate of candidates) {
		const group = groups.get(candidate.url);
		if (!group) {
			groups.set(candidate.url, {
				url: candidate.url,
				preferred: candidate,
				variants: [candidate],
			});
		} else {
			group.variants.push(candidate);
			if (compareCandidates(candidate, group.preferred) < 0) {
				group.preferred = candidate;
			}
		}
	}
	return [...groups.values()];
}

/** Split a query into whitespace-separated terms. Every term must match for a result to appear. */
export function queryTerms(query: string): string[] {
	return query.trim().split(/\s+/).filter(Boolean);
}

type UrlMatches = ReturnType<typeof fuzzyMatch>[];

/**
 * Score a title against all terms, given each term's precomputed URL match. Each term takes
 * whichever of title or URL matches better (URL matches discounted); quality is the mean over terms.
 */
function matchPage(terms: string[], title: string, urlHits: UrlMatches) {
	let total = 0;
	const titleMatches = new Set<number>();
	const urlMatches = new Set<number>();

	for (const [i, term] of terms.entries()) {
		const inTitle = fuzzyMatch(term, title);
		const inUrl = urlHits[i];
		const titleScore = inTitle?.score ?? -1;
		const urlScore = inUrl ? inUrl.score * URL_MATCH_WEIGHT : -1;
		if (inTitle && titleScore >= urlScore) {
			total += titleScore;
			for (const p of inTitle.positions) titleMatches.add(p);
		} else if (inUrl) {
			total += urlScore;
			for (const p of inUrl.positions) urlMatches.add(p);
		} else {
			return undefined;
		}
	}

	return {
		quality: total / terms.length,
		titleMatches: [...titleMatches].sort((a, b) => a - b),
		urlMatches: [...urlMatches].sort((a, b) => a - b),
	};
}

function toResult(
	group: UrlGroup,
	matched: Candidate,
	quality: number,
	titleMatches: number[],
	urlMatches: number[],
): Result {
	const { preferred } = group;
	return {
		id: preferred.id,
		title: matched.title,
		url: group.url,
		source: preferred.source,
		target:
			preferred.source === "tab"
				? { kind: "tab", tabId: preferred.tabId }
				: { kind: "url", url: group.url },
		matchedCandidateId: matched.id,
		score: quality * SOURCE_WEIGHTS[preferred.source],
		titleMatches,
		urlMatches,
	};
}

function matchGroup(group: UrlGroup, terms: string[]): Result | undefined {
	// Try the preferred variant first so its title wins ties.
	const variants = [
		group.preferred,
		...group.variants.filter((v) => v !== group.preferred),
	];
	const urlHits = terms.map((term) => fuzzyMatch(term, group.url));
	let best: Result | undefined;
	for (const variant of variants) {
		const match = matchPage(terms, variant.title, urlHits);
		if (!match) continue;
		const result = toResult(
			group,
			variant,
			match.quality,
			match.titleMatches,
			match.urlMatches,
		);
		if (!best || result.score > best.score) best = result;
	}
	return best;
}

/**
 * Rank candidates for a query. An empty query lists open tabs, most recently used first.
 */
export function search(
	candidates: Candidate[],
	query: string,
	limit = MAX_RESULTS,
): Result[] {
	const terms = queryTerms(query);
	const groups = groupCandidates(candidates);

	if (terms.length === 0) {
		return groups
			.filter((g) => g.preferred.source === "tab")
			.sort((a, b) => compareCandidates(a.preferred, b.preferred))
			.slice(0, limit)
			.map((g) => toResult(g, g.preferred, 1, [], []));
	}

	const ranked: { group: UrlGroup; result: Result }[] = [];
	for (const group of groups) {
		const result = matchGroup(group, terms);
		if (result) ranked.push({ group, result });
	}
	return ranked
		.sort(
			(a, b) =>
				b.result.score - a.result.score ||
				compareCandidates(a.group.preferred, b.group.preferred),
		)
		.slice(0, limit)
		.map(({ result }) => result);
}
