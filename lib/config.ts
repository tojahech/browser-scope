export const CONFIG = {
	name: "BrowserScope",
	command: "launch-finder",
	defaultShortcut: "Ctrl+Space",
	doubleTapMs: 300,
	searchDebounceMs: 35,
	historyLimit: 10000,
	resultLimit: 100,
	mruLimit: 500,
	width: 600,
	height: 640,
	sourceWeights: { tab: 1, bookmark: 0.85, history: 0.65 },
	match: { base: 1, boundary: 0.8, consecutive: 1.2, gap: 0.03 },
} as const;
