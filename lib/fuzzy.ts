/**
 * fzf-style fuzzy matching: a case-insensitive subsequence search scored by
 * consecutive runs, word-boundary hits, match position, and the ratio of
 * query length to target length.
 *
 * Pure module — no browser APIs — so it is unit-testable.
 */

export interface FuzzyMatch {
	/** Higher is better. Only comparable between matches for the same query. */
	score: number;
	/** Indices into the target string of the matched characters. */
	indices: number[];
}

const SCORE_MATCH = 16;
const BONUS_BOUNDARY = 8;
const BONUS_CONSECUTIVE = 4;
const PENALTY_GAP_START = 3;
const PENALTY_GAP_EXTEND = 1;
const MAX_GAP_PENALTY = 12;
const BONUS_MATCH_POSITION = 10;
const BONUS_COVERAGE = 10;

const BOUNDARY_CHARS = new Set(` \t/\\-_.:#?&=+,;'"()[]{}<>|@!~`);

/** A match at index 0, after a separator, or at a camelCase hump. */
function isBoundary(target: string, index: number): boolean {
	if (index === 0) return true;
	const prev = target[index - 1];
	if (BOUNDARY_CHARS.has(prev)) return true;
	const cur = target[index];
	return prev >= "a" && prev <= "z" && cur >= "A" && cur <= "Z";
}

/**
 * Match `query` against `target`. Returns null when the query is not a
 * subsequence of the target; otherwise a score plus the matched indices
 * (for highlighting).
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
	if (query.length === 0) return { score: 0, indices: [] };
	if (query.length > target.length) return null;

	const q = query.toLowerCase();
	const t = target.toLowerCase();

	// Forward pass: locate the end of the first subsequence match.
	let qi = 0;
	let end = -1;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			qi++;
			end = ti;
		}
	}
	if (qi < q.length) return null;

	// Backward pass from that end tightens the window, pulling every matched
	// character as close to the end as possible (fzf's v1 algorithm).
	const indices = new Array<number>(q.length);
	qi = q.length - 1;
	for (let ti = end; ti >= 0 && qi >= 0; ti--) {
		if (t[ti] === q[qi]) {
			indices[qi] = ti;
			qi--;
		}
	}

	return { score: scoreIndices(target, indices), indices };
}

function scoreIndices(target: string, indices: number[]): number {
	let score = 0;
	let prev = -2;
	for (const idx of indices) {
		score += SCORE_MATCH;
		if (isBoundary(target, idx)) score += BONUS_BOUNDARY;
		if (idx === prev + 1) {
			score += BONUS_CONSECUTIVE;
		} else if (prev >= 0) {
			const gap = idx - prev - 1;
			score -= Math.min(
				PENALTY_GAP_START + PENALTY_GAP_EXTEND * (gap - 1),
				MAX_GAP_PENALTY,
			);
		}
		prev = idx;
	}
	// Matches near the start of the target score higher.
	score += Math.max(0, BONUS_MATCH_POSITION - indices[0]);
	// Queries covering more of the target score higher.
	score += Math.round((BONUS_COVERAGE * indices.length) / target.length);
	return score;
}
