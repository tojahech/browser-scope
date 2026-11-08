import { CONFIG } from "./config";
import { fuzzyMatch } from "./fuzzy";
import type { Candidate, Result, UrlGroup } from "./types";

// Compare like units only: MRU ranks for tabs and timestamps within each
// non-tab source. Source priority resolves equal scores across source types.
function compareCandidates(a: Candidate, b: Candidate): number {
	const source =
		CONFIG.sourceWeights[b.source] - CONFIG.sourceWeights[a.source];
	if (source) return source;
	if (a.source === "tab" && b.source === "tab")
		return a.mruRank - b.mruRank || a.id.localeCompare(b.id);
	if (a.source === "bookmark" && b.source === "bookmark")
		return b.dateAdded - a.dateAdded || a.id.localeCompare(b.id);
	if (a.source === "history" && b.source === "history")
		return b.lastVisited - a.lastVisited || a.id.localeCompare(b.id);
	return a.id.localeCompare(b.id);
}
export function groupCandidates(candidates: Candidate[]): UrlGroup[] {
	const groups = new Map<string, UrlGroup>();
	for (const candidate of candidates) {
		const group = groups.get(candidate.url);
		if (!group)
			groups.set(candidate.url, {
				url: candidate.url,
				preferred: candidate,
				variants: [candidate],
			});
		else {
			group.variants.push(candidate);
			if (compareCandidates(candidate, group.preferred) < 0)
				group.preferred = candidate;
		}
	}
	return [...groups.values()];
}
function matchGroup(group: UrlGroup, query: string): Result | null {
	const preferred = group.preferred;
	if (!query && preferred.source !== "tab") return null;
	let matched = preferred;
	let bestScore = -1;
	let titleMatches: number[] = [];
	const urlMatch = fuzzyMatch(query, group.url);
	// Prefer the activation target's title when match quality is tied.
	for (const variant of [
		preferred,
		...group.variants.filter((item) => item !== preferred),
	]) {
		const title = fuzzyMatch(query, variant.title);
		if (!title && !urlMatch) continue;
		const score = Math.max(title?.score ?? 0, urlMatch?.score ?? 0);
		if (score > bestScore) {
			bestScore = score;
			matched = variant;
			titleMatches = title?.indices ?? [];
		}
	}
	if (bestScore < 0) return null;
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
		score: bestScore * CONFIG.sourceWeights[preferred.source],
		titleMatches,
		urlMatches: urlMatch?.indices ?? [],
	};
}
export function searchCandidates(
	candidates: Candidate[],
	query: string,
): Result[] {
	const needle = query.trim();
	return groupCandidates(candidates)
		.map((group) => ({ group, result: matchGroup(group, needle) }))
		.filter(
			(item): item is { group: UrlGroup; result: Result } =>
				item.result !== null,
		)
		.sort(
			(a, b) =>
				(needle ? b.result.score - a.result.score : 0) ||
				compareCandidates(a.group.preferred, b.group.preferred),
		)
		.slice(0, CONFIG.resultLimit)
		.map(({ result }) => result);
}
