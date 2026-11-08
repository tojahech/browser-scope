import { CONFIG } from "./config";
export type Source = keyof typeof CONFIG.sourceWeights;
export interface Candidate {
	id: string;
	title: string;
	url: string;
	source: Source;
	tabId?: number;
	windowId?: number;
	lastAccessed: number;
}
export interface Result extends Candidate {
	score: number;
	titleMatches: number[];
	urlMatches: number[];
}
// Dynamic programming rewards adjacent characters and word boundaries, while
// retaining the best alignment rather than committing to the first occurrence.
export function fuzzyMatch(
	query: string,
	text: string,
): { score: number; indices: number[] } | null {
	const needle = query.toLowerCase();
	const haystack = text.toLowerCase();
	if (!needle.length) return { score: 1, indices: [] };
	if (needle.length > haystack.length) return null;
	let previous = new Float64Array(haystack.length).fill(-Infinity);
	const paths: Int32Array[] = [];
	const { base, boundary, consecutive, gap } = CONFIG.match;
	for (let i = 0; i < needle.length; i++) {
		const current = new Float64Array(haystack.length).fill(-Infinity);
		const parents = new Int32Array(haystack.length).fill(-1);
		let best = -Infinity;
		let bestIndex = -1;
		for (let j = 0; j < haystack.length; j++) {
			if (j > 0 && previous[j - 1] + gap * (j - 1) > best) {
				best = previous[j - 1] + gap * (j - 1);
				bestIndex = j - 1;
			}
			if (needle[i] !== haystack[j]) continue;
			const bonus =
				base + (j === 0 || /[\s/._\-:?#=&]/.test(text[j - 1]) ? boundary : 0);
			if (i === 0) current[j] = bonus - Math.min(j * gap, 0.8);
			else {
				current[j] = best - gap * (j - 1) + bonus;
				parents[j] = bestIndex;
				if (j > 0 && previous[j - 1] + consecutive + bonus >= current[j]) {
					current[j] = previous[j - 1] + consecutive + bonus;
					parents[j] = j - 1;
				}
			}
		}
		paths.push(parents);
		previous = current;
	}
	let end = -1;
	for (let j = 0; j < previous.length; j++)
		if (end === -1 || previous[j] > previous[end]) end = j;
	if (end < 0 || !Number.isFinite(previous[end])) return null;
	const raw = previous[end];
	const indices: number[] = [];
	for (let i = needle.length - 1; i >= 0; i--) {
		indices.unshift(end);
		end = paths[i][end];
	}
	const maximum =
		needle.length * (base + boundary) + (needle.length - 1) * consecutive;
	const score = Math.max(
		0.01,
		Math.min(
			1,
			(raw / maximum) * 0.9 + (needle.length / Math.max(text.length, 1)) * 0.1,
		),
	);
	return { score, indices };
}
export function searchCandidates(
	candidates: Candidate[],
	query: string,
): Result[] {
	const unique = new Map<string, Candidate>();
	for (const item of candidates) {
		const prior = unique.get(item.url);
		if (
			!prior ||
			CONFIG.sourceWeights[item.source] > CONFIG.sourceWeights[prior.source] ||
			(item.source === prior.source && item.lastAccessed > prior.lastAccessed)
		)
			unique.set(item.url, item);
	}
	const needle = query.trim();
	const results: Result[] = [];
	for (const item of unique.values()) {
		if (!needle) {
			if (item.source === "tab")
				results.push({ ...item, score: 1, titleMatches: [], urlMatches: [] });
			continue;
		}
		const title = fuzzyMatch(needle, item.title);
		const url = fuzzyMatch(needle, item.url);
		if (!title && !url) continue;
		results.push({
			...item,
			score:
				Math.max(title?.score ?? 0, url?.score ?? 0) *
				CONFIG.sourceWeights[item.source],
			titleMatches: title?.indices ?? [],
			urlMatches: url?.indices ?? [],
		});
	}
	return results
		.sort(
			(a, b) =>
				(needle ? b.score - a.score : 0) ||
				b.lastAccessed - a.lastAccessed ||
				a.id.localeCompare(b.id),
		)
		.slice(0, CONFIG.resultLimit);
}
