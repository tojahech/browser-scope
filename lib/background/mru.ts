/**
 * Most-recently-used tab order. Persisted to storage.local so it survives the background being
 * suspended and restarted, and reconciled against live tabs on load.
 */

import { browser } from "wxt/browser";
import { MRU_LIMIT } from "../config";

const STORAGE_KEY = "mru";

export type MruStore = ReturnType<typeof createMruStore>;

export function createMruStore() {
	let ids: number[] = [];
	// Mutations run one at a time, after loading, so events during startup aren't lost or reordered.
	let mutations = Promise.resolve();

	const ready = Promise.all([
		browser.storage.local
			.get(STORAGE_KEY)
			.catch(() => ({ [STORAGE_KEY]: undefined })),
		browser.tabs.query({}),
	]).then(([stored, tabs]) => {
		const alive = new Set(tabs.map((tab) => tab.id));
		const persisted: unknown = stored[STORAGE_KEY];
		ids = Array.isArray(persisted)
			? [
					...new Set(
						persisted.filter(
							(id): id is number => Number.isInteger(id) && alive.has(id),
						),
					),
				]
			: [];

		// Tabs the stored list doesn't know about go after it, in the browser's own recency order.
		const byRecency = [...tabs].sort(
			(a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
		);
		for (const tab of byRecency) {
			if (tab.id != null && !ids.includes(tab.id)) ids.push(tab.id);
		}
		ids = ids.slice(0, MRU_LIMIT);
	});

	function mutate(update: (previous: number[]) => number[]) {
		mutations = mutations
			.then(async () => {
				await ready;
				ids = update(ids).slice(0, MRU_LIMIT);
				await browser.storage.local.set({ [STORAGE_KEY]: ids });
			})
			.catch(console.error);
		return mutations;
	}

	return {
		/** Move a tab to the front. */
		touch: (id: number) =>
			mutate((previous) => [id, ...previous.filter((entry) => entry !== id)]),

		remove: (id: number) =>
			mutate((previous) => previous.filter((entry) => entry !== id)),

		/** Tab IDs, most recent first, after any pending updates. */
		async read(): Promise<readonly number[]> {
			await ready;
			await mutations;
			return [...ids];
		},
	};
}
