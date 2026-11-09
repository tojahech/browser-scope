import type { Candidate } from "./search";
import type { ThemeVars } from "./theme";

/** Messages sent from the finder UI (popup or overlay) to the background. */
export type BackgroundRequest =
	| { type: "getCandidates" }
	| { type: "activate"; candidate: Candidate }
	| { type: "searchWeb"; query: string }
	| { type: "overlayReady" };

export interface CandidatesResponse {
	candidates: Candidate[];
	theme: ThemeVars;
}

/** Messages sent from the background to the finder UI. */
export type UiRequest = { type: "toggleOverlay" } | { type: "closeUi" };

export function sendToBackground(request: {
	type: "getCandidates";
}): Promise<CandidatesResponse>;
export function sendToBackground(request: BackgroundRequest): Promise<void>;
export function sendToBackground(request: BackgroundRequest) {
	return browser.runtime.sendMessage(request);
}
