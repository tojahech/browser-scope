/**
 * fzf-style fuzzy matching (a simplified port of fzf's v2 algorithm).
 *
 * Finds the best-scoring alignment of the pattern as a subsequence of the text, rewarding matches on
 * word boundaries and consecutive runs, and penalising gaps. Scores are normalised to 0..1.
 */

const SCORE_MATCH = 16;
const SCORE_GAP_START = -3;
const SCORE_GAP_EXTENSION = -1;
const BONUS_BOUNDARY = SCORE_MATCH / 2;
const BONUS_NON_WORD = SCORE_MATCH / 2;
const BONUS_CAMEL_123 = BONUS_BOUNDARY + SCORE_GAP_EXTENSION;
const BONUS_CONSECUTIVE = -(SCORE_GAP_START + SCORE_GAP_EXTENSION);
const BONUS_FIRST_CHAR_MULTIPLIER = 2;
const BONUS_BOUNDARY_WHITE = BONUS_BOUNDARY + 2;
const BONUS_BOUNDARY_DELIMITER = BONUS_BOUNDARY + 1;

const NONE = -1e9;

enum CharClass {
	White,
	NonWord,
	Delimiter,
	Lower,
	Upper,
	Number,
}

export interface FuzzyMatch {
	/** Match quality in the range 0..1. */
	score: number;
	/** Indices of matched characters in the text. */
	positions: number[];
}

function charClass(ch: string): CharClass {
	if (ch >= "a" && ch <= "z") return CharClass.Lower;
	if (ch >= "A" && ch <= "Z") return CharClass.Upper;
	if (ch >= "0" && ch <= "9") return CharClass.Number;
	if (ch === " " || ch === "\t" || ch === "\n") return CharClass.White;
	if ("/,:;|.-_?=&#".includes(ch)) return CharClass.Delimiter;
	// Treat other unicode letters as lowercase word characters.
	if (ch.toLowerCase() !== ch.toUpperCase()) return CharClass.Lower;
	return CharClass.NonWord;
}

function isWord(c: CharClass): boolean {
	return c >= CharClass.Lower;
}

function bonusFor(prev: CharClass, curr: CharClass): number {
	if (isWord(curr)) {
		if (prev === CharClass.White) return BONUS_BOUNDARY_WHITE;
		if (prev === CharClass.Delimiter) return BONUS_BOUNDARY_DELIMITER;
		if (prev === CharClass.NonWord) return BONUS_BOUNDARY;
	}
	if (
		(prev === CharClass.Lower && curr === CharClass.Upper) ||
		(prev !== CharClass.Number && curr === CharClass.Number)
	) {
		return BONUS_CAMEL_123;
	}
	if (curr === CharClass.White) return BONUS_BOUNDARY_WHITE;
	if (curr === CharClass.NonWord || curr === CharClass.Delimiter) {
		return BONUS_NON_WORD;
	}
	return 0;
}

/** Best achievable raw score for a pattern of length n, used for normalisation. */
function maxScore(n: number): number {
	return (
		SCORE_MATCH * n +
		BONUS_BOUNDARY_WHITE * (BONUS_FIRST_CHAR_MULTIPLIER + n - 1)
	);
}

/**
 * Match `pattern` against `text`, case-insensitively.
 * Returns undefined when the pattern is not a subsequence of the text.
 */
export function fuzzyMatch(
	pattern: string,
	text: string,
): FuzzyMatch | undefined {
	const p = pattern.toLowerCase();
	const n = p.length;
	if (n === 0) return { score: 1, positions: [] };

	const lower = text.toLowerCase();
	const m = lower.length;
	if (n > m) return undefined;

	// Cheap subsequence check before running the full DP.
	let pi = 0;
	for (let j = 0; j < m && pi < n; j++) {
		if (lower[j] === p[pi]) pi++;
	}
	if (pi < n) return undefined;

	const bonus = new Int32Array(m);
	let prevClass = CharClass.White;
	for (let j = 0; j < m; j++) {
		const c = charClass(text[j]);
		bonus[j] = bonusFor(prevClass, c);
		prevClass = c;
	}

	// score[i*m+j]: best score with pattern[i] matched at text[j].
	const score = new Float64Array(n * m).fill(NONE);
	// chunk[i*m+j]: bonus carried by the consecutive run ending at (i, j).
	const chunk = new Int32Array(n * m);
	// from[i*m+j]: text index where pattern[i-1] was matched.
	const from = new Int32Array(n * m).fill(-1);

	for (let j = 0; j < m; j++) {
		if (lower[j] === p[0]) {
			score[j] = SCORE_MATCH + bonus[j] * BONUS_FIRST_CHAR_MULTIPLIER;
			chunk[j] = bonus[j];
		}
	}

	for (let i = 1; i < n; i++) {
		const row = i * m;
		const prevRow = row - m;
		let gapBest = NONE;
		let gapFrom = -1;
		for (let j = i; j < m; j++) {
			// Best predecessor that leaves at least one unmatched char before j.
			if (j >= 2) {
				const extended = gapBest + SCORE_GAP_EXTENSION;
				const started = score[prevRow + j - 2] + SCORE_GAP_START;
				if (started >= extended) {
					gapBest = started;
					gapFrom = j - 2;
				} else {
					gapBest = extended;
				}
			}
			if (lower[j] !== p[i]) continue;

			const b = bonus[j];
			let best = NONE;
			let bestFrom = -1;
			let bestChunk = b;

			if (gapFrom >= 0 && gapBest > NONE / 2) {
				best = gapBest + SCORE_MATCH + b;
				bestFrom = gapFrom;
			}

			const diag = score[prevRow + j - 1];
			if (diag > NONE / 2) {
				let cb = Math.max(chunk[prevRow + j - 1], BONUS_CONSECUTIVE);
				if (b >= BONUS_BOUNDARY && b > cb) cb = b;
				const consecutive = diag + SCORE_MATCH + Math.max(b, cb);
				if (consecutive >= best) {
					best = consecutive;
					bestFrom = j - 1;
					bestChunk = cb;
				}
			}

			score[row + j] = best;
			from[row + j] = bestFrom;
			chunk[row + j] = bestChunk;
		}
	}

	const last = (n - 1) * m;
	let bestScore = NONE;
	let bestEnd = -1;
	for (let j = n - 1; j < m; j++) {
		if (score[last + j] > bestScore) {
			bestScore = score[last + j];
			bestEnd = j;
		}
	}
	if (bestEnd < 0) return undefined;

	const positions = new Array<number>(n);
	for (let i = n - 1, j = bestEnd; i >= 0; i--) {
		positions[i] = j;
		j = from[i * m + j];
	}

	return {
		score: Math.min(1, Math.max(0, bestScore / maxScore(n))),
		positions,
	};
}
