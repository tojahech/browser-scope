/** Data shapes shared by the background and the finder UI. */

export type Source = "tab" | "bookmark" | "history";

interface Page {
	/** Unique across sources, e.g. `tab:12` or `bookmark:abc`. */
	id: string;
	title: string;
	url: string;
}

/** One entry from one source. Each source carries the fields needed to order it. */
export type Candidate = Page &
	(
		| { source: "tab"; tabId: number; windowId: number; mruRank: number }
		| { source: "bookmark"; dateAdded: number }
		| { source: "history"; lastVisited: number }
	);

/** What the background should do when a result is chosen. */
export type ActivationTarget =
	| { kind: "tab"; tabId: number }
	| { kind: "url"; url: string };

/** All candidates sharing a URL. `preferred` decides the label, weight and target. */
export interface UrlGroup {
	url: string;
	variants: Candidate[];
	preferred: Candidate;
}

/** A ranked row in the results list. */
export interface Result extends Page {
	source: Source;
	target: ActivationTarget;
	/** The variant whose title supplied the match, which may not be the preferred one. */
	matchedCandidateId: string;
	/** Final rank in the range 0..1. */
	score: number;
	titleMatches: number[];
	urlMatches: number[];
}
