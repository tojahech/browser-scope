import { browser } from "wxt/browser";
import { CONFIG } from "./config";
export type MruStore = ReturnType<typeof createMruStore>;
export function createMruStore() {
	let ids: number[] = [];
	let mutations = Promise.resolve();
	const ready = Promise.all([
		browser.storage.local.get("mru").catch(() => ({ mru: undefined })),
		browser.tabs.query({}),
	]).then(([stored, tabs]) => {
		const alive = new Set(tabs.map((tab) => tab.id));
		ids = Array.isArray(stored.mru)
			? [
					...new Set<number>(
						stored.mru.filter(
							(id): id is number => Number.isInteger(id) && alive.has(id),
						),
					),
				]
			: [];
		for (const tab of [...tabs].sort(
			(a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
		)) {
			if (tab.id != null && !ids.includes(tab.id)) ids.push(tab.id);
		}
		ids = ids.slice(0, CONFIG.mruLimit);
	});
	function mutate(update: (previous: number[]) => number[]) {
		mutations = mutations
			.then(async () => {
				await ready;
				ids = update(ids).slice(0, CONFIG.mruLimit);
				await browser.storage.local.set({ mru: ids });
			})
			.catch(console.error);
		return mutations;
	}
	return {
		touch: (id: number) =>
			mutate((previous) => [id, ...previous.filter((entry) => entry !== id)]),
		remove: (id: number) =>
			mutate((previous) => previous.filter((entry) => entry !== id)),
		async read(): Promise<readonly number[]> {
			await ready;
			await mutations;
			return [...ids];
		},
	};
}
