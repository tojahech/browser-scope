import { CONFIG, SOURCE_PRIORITY } from "./config";

export type ResultSource = "tab" | "bookmark" | "history";

export interface SearchCandidate {
	id?: string;
	mruRank?: number;
	source: ResultSource;
	tabId?: number;
	title: string;
	url: string;
	windowId?: number;
}

export interface FuzzyMatch {
	positions: number[];
	score: number;
}

export interface SearchResult extends SearchCandidate {
	matchPositions: number[];
	score: number;
}

const WORD_BOUNDARY = /[^a-z0-9]/i;

function isWordBoundary(target: string, position: number) {
	if (position === 0) return true;
	const previous = target[position - 1];
	const current = target[position];
	return (
		WORD_BOUNDARY.test(previous) ||
		(current === current.toUpperCase() && previous === previous.toLowerCase())
	);
}

/**
 * Score a subsequence match. Earlier, consecutive, word-boundary characters
 * beat a sparse match near the end of a string.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
	const normalizedQuery = query.toLowerCase();
	const normalizedTarget = target.toLowerCase();
	if (!normalizedQuery) return { positions: [], score: 0 };

	type MatchState = { positions: number[]; score: number };
	let states: MatchState[] = [];

	for (let position = 0; position < normalizedTarget.length; position += 1) {
		if (normalizedTarget[position] === normalizedQuery[0]) {
			states.push({
				positions: [position],
				score: (isWordBoundary(target, position) ? 12 : 0) - position * 0.45,
			});
		}
	}

	for (
		let queryIndex = 1;
		queryIndex < normalizedQuery.length;
		queryIndex += 1
	) {
		const nextStates: MatchState[] = [];
		let previousCursor = 0;
		let bestPrevious: MatchState | undefined;
		for (let position = 0; position < normalizedTarget.length; position += 1) {
			if (normalizedTarget[position] !== normalizedQuery[queryIndex]) continue;
			while (true) {
				const previous = states[previousCursor];
				if (
					!previous ||
					previous.positions[previous.positions.length - 1] >= position
				)
					break;
				if (!bestPrevious || previous.score > bestPrevious.score)
					bestPrevious = previous;
				previousCursor += 1;
			}
			const consecutive = states.find(
				(state) => state.positions.at(-1) === position - 1,
			);
			const previous =
				consecutive &&
				(!bestPrevious || consecutive.score + 20 >= bestPrevious.score)
					? { ...consecutive, score: consecutive.score + 20 }
					: bestPrevious;
			if (!previous) continue;
			nextStates.push({
				positions: [...previous.positions, position],
				score: previous.score + (isWordBoundary(target, position) ? 12 : 0),
			});
		}
		states = nextStates;
		if (states.length === 0) return null;
	}

	const best = states.reduce((winner, state) =>
		state.score > winner.score ? state : winner,
	);
	const start = best.positions[0] ?? 0;
	const end = best.positions[best.positions.length - 1] ?? 0;
	const span = end - start + 1;
	const ratio = normalizedQuery.length / Math.max(target.length, 1);
	return {
		positions: best.positions,
		score: best.score + ratio * 20 - (span - best.positions.length) * 0.8,
	};
}

function bestMatch(
	query: string,
	candidate: SearchCandidate,
): SearchResult | null {
	const titleMatch = fuzzyMatch(query, candidate.title);
	const urlMatch = fuzzyMatch(query, candidate.url);
	if (!titleMatch && !urlMatch) return null;

	// Prefer title highlighting when both targets match at a similar quality.
	const match =
		!urlMatch || (titleMatch && titleMatch.score >= urlMatch.score)
			? titleMatch
			: urlMatch;
	if (!match) return null;

	return {
		...candidate,
		matchPositions: match === titleMatch ? match.positions : [],
		score: match.score,
	};
}

/** Rank and de-duplicate candidates by their canonical URL. */
export function rankSearchResults(
	candidates: SearchCandidate[],
	query: string,
): SearchResult[] {
	const candidatesByUrl = new Map<string, SearchCandidate[]>();
	for (const candidate of candidates) {
		const existing = candidatesByUrl.get(candidate.url) ?? [];
		existing.push(candidate);
		candidatesByUrl.set(candidate.url, existing);
	}

	const matches = [...candidatesByUrl.values()]
		.map((sameUrlCandidates): SearchResult | null => {
			const sourceCandidate = [...sameUrlCandidates].sort((left, right) => {
				const sourceDifference =
					SOURCE_PRIORITY[left.source] - SOURCE_PRIORITY[right.source];
				if (sourceDifference !== 0) return sourceDifference;
				return (
					(left.mruRank ?? Number.MAX_SAFE_INTEGER) -
					(right.mruRank ?? Number.MAX_SAFE_INTEGER)
				);
			})[0];
			const matchingCandidate = sameUrlCandidates
				.map((candidate) => bestMatch(query, candidate))
				.filter((candidate): candidate is SearchResult => candidate !== null)
				.sort((left, right) => right.score - left.score)[0];
			if (!sourceCandidate || !matchingCandidate) return null;
			return {
				...matchingCandidate,
				id: sourceCandidate.id,
				mruRank: sourceCandidate.mruRank,
				source: sourceCandidate.source,
				tabId: sourceCandidate.tabId,
				windowId: sourceCandidate.windowId,
			};
		})
		.filter((candidate): candidate is SearchResult => candidate !== null)
		.sort((left, right) => {
			const sourceDifference =
				SOURCE_PRIORITY[left.source] - SOURCE_PRIORITY[right.source];
			if (sourceDifference !== 0) return sourceDifference;
			if (right.score !== left.score) return right.score - left.score;
			return (
				(left.mruRank ?? Number.MAX_SAFE_INTEGER) -
				(right.mruRank ?? Number.MAX_SAFE_INTEGER)
			);
		});

	return matches.slice(0, CONFIG.MAX_SEARCH_RESULTS);
}

/** Empty searches are deliberately a tab-only MRU switcher. */
export function rankRecentTabs(candidates: SearchCandidate[]): SearchResult[] {
	const seenUrls = new Set<string>();
	return candidates
		.filter((candidate) => candidate.source === "tab")
		.sort(
			(left, right) =>
				(left.mruRank ?? Number.MAX_SAFE_INTEGER) -
				(right.mruRank ?? Number.MAX_SAFE_INTEGER),
		)
		.filter((candidate) => {
			if (seenUrls.has(candidate.url)) return false;
			seenUrls.add(candidate.url);
			return true;
		})
		.slice(0, CONFIG.MAX_SEARCH_RESULTS)
		.map((candidate) => ({ ...candidate, matchPositions: [], score: 0 }));
}
