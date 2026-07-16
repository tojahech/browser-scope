export type SourceType = "tab" | "bookmark" | "history";

/** A searchable item drawn from one of the sources. */
export interface Candidate {
	type: SourceType;
	title: string;
	url: string;
	/** Set for tabs only. */
	tabId?: number;
	windowId?: number;
	/** Epoch ms the tab was last activated; drives MRU ordering. */
	lastAccessed?: number;
	/** True for the active tab of the window the popup was opened from. */
	isCurrentTab?: boolean;
}
