export type Source = "tab" | "bookmark" | "history";
interface Page {
	id: string;
	title: string;
	url: string;
}
export type Candidate = Page &
	(
		| { source: "tab"; tabId: number; windowId: number; mruRank: number }
		| { source: "bookmark"; dateAdded: number }
		| { source: "history"; lastVisited: number }
	);
export type ActivationTarget =
	| { kind: "tab"; tabId: number }
	| { kind: "url"; url: string };
export interface UrlGroup {
	url: string;
	variants: Candidate[];
	preferred: Candidate;
}
export interface Result extends Page {
	source: Source;
	target: ActivationTarget;
	matchedCandidateId: string;
	score: number;
	titleMatches: number[];
	urlMatches: number[];
}
