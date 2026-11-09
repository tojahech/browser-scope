/**
 * Make everything on the page except `keep` inert, so page scripts and ad iframes can't steal focus
 * from the overlay. Returns a function that restores the page.
 *
 * `keep` should be a direct child of <html> (not <body>), so that inerting <body> also covers any
 * content the page adds while the overlay is open.
 */
export function makePageInert(keep: Element): () => void {
	const inerted = new Set<HTMLElement>();

	const inertChildren = () => {
		for (const el of document.documentElement.children) {
			if (el === keep || el === document.head) continue;
			if (el instanceof HTMLElement && !el.inert) {
				el.inert = true;
				inerted.add(el);
			}
		}
	};

	inertChildren();
	// Catch elements added beside <body> (or a replaced <body>) while open.
	const observer = new MutationObserver(inertChildren);
	observer.observe(document.documentElement, { childList: true });

	return () => {
		observer.disconnect();
		for (const el of inerted) el.inert = false;
		inerted.clear();
	};
}
