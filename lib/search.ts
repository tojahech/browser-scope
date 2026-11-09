import {
	SOURCE_PRIORITY,
	SOURCE_WEIGHTS,
	type SourceKind,
	URL_MATCH_WEIGHT,
} from "./config";
import { fuzzyMatch } from "./fuzzy";

export interface Candidate {
	kind: SourceKind;
	title: string;
	url: string;
	tabId?: number;
	windowId?: number;
	/** Last access/visit time in ms, used to order ties and the empty-query tab list. */
	lastUsed?: number;
}

export interface Result {
	candidate: Candidate;
	/** Final rank in the range 0..1. */
	score: number;
	titlePositions: number[];
	urlPositions: number[];
}

/** Collapse entries sharing a URL, keeping the one from the highest-priority source. */
export function dedupe(candidates: Candidate[]): Candidate[] {
	const byUrl = new Map<string, Candidate>();
	const priority = (c: Candidate) => SOURCE_PRIORITY.indexOf(c.kind);
	for (const c of candidates) {
		const existing = byUrl.get(c.url);
		if (
			!existing ||
			priority(c) < priority(existing) ||
			(priority(c) === priority(existing) &&
				(c.lastUsed ?? 0) > (existing.lastUsed ?? 0))
		) {
			byUrl.set(c.url, c);
		}
	}
	return [...byUrl.values()];
}

/**
 * Score a candidate against whitespace-separated query terms. Every term must match the title or the
 * URL; the match quality is the mean of each term's best score.
 */
export function scoreCandidate(
	terms: string[],
	candidate: Candidate,
): Result | undefined {
	let total = 0;
	const titlePositions = new Set<number>();
	const urlPositions = new Set<number>();

	for (const term of terms) {
		const title = fuzzyMatch(term, candidate.title);
		const url = fuzzyMatch(term, candidate.url);
		const titleScore = title?.score ?? -1;
		const urlScore = url ? url.score * URL_MATCH_WEIGHT : -1;
		if (title && titleScore >= urlScore) {
			total += titleScore;
			for (const p of title.positions) titlePositions.add(p);
		} else if (url) {
			total += urlScore;
			for (const p of url.positions) urlPositions.add(p);
		} else {
			return undefined;
		}
	}

	const quality = terms.length ? total / terms.length : 1;
	return {
		candidate,
		score: quality * SOURCE_WEIGHTS[candidate.kind],
		titlePositions: [...titlePositions].sort((a, b) => a - b),
		urlPositions: [...urlPositions].sort((a, b) => a - b),
	};
}

function byRecency(a: Candidate, b: Candidate): number {
	return (b.lastUsed ?? 0) - (a.lastUsed ?? 0);
}

/**
 * Rank candidates for a query. An empty query lists open tabs, most recently used first.
 * Expects candidates that have already been deduplicated.
 */
export function search(
	query: string,
	candidates: Candidate[],
	limit: number,
): Result[] {
	const terms = query.trim().split(/\s+/).filter(Boolean);

	if (terms.length === 0) {
		return candidates
			.filter((c) => c.kind === "tab")
			.sort(byRecency)
			.slice(0, limit)
			.map((candidate) => ({
				candidate,
				score: SOURCE_WEIGHTS.tab,
				titlePositions: [],
				urlPositions: [],
			}));
	}

	const results: Result[] = [];
	for (const c of candidates) {
		const r = scoreCandidate(terms, c);
		if (r) results.push(r);
	}
	results.sort(
		(a, b) => b.score - a.score || byRecency(a.candidate, b.candidate),
	);
	return results.slice(0, limit);
}
