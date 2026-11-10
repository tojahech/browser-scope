import { beforeEach, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing";
import { createMruStore } from "./mru";

const tabs = (...ids: number[]) =>
	ids.map((id, i) => ({ id, lastAccessed: i + 1 }) as Browser.tabs.Tab);

beforeEach(() => {
	fakeBrowser.reset();
	vi.restoreAllMocks();
	vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue(tabs(1, 2));
});

const stored = async () => (await fakeBrowser.storage.local.get("mru")).mru;

it("restores the persisted order, dropping closed and malformed IDs", async () => {
	await fakeBrowser.storage.local.set({ mru: [1, 1, 999, "2"] });
	// Tab 2 isn't in the stored list, so it follows in browser recency order.
	expect(await createMruStore().read()).toEqual([1, 2]);
});

it("falls back to browser recency when nothing is stored", async () => {
	expect(await createMruStore().read()).toEqual([2, 1]);
});

it("falls back to browser recency if storage can't be read", async () => {
	vi.spyOn(fakeBrowser.storage.local, "get").mockRejectedValueOnce(
		new Error("storage unavailable"),
	);
	expect(await createMruStore().read()).toEqual([2, 1]);
});

it("keeps updates that arrive before loading finishes, in order", async () => {
	let finishLoading!: (value: Record<string, unknown>) => void;
	vi.spyOn(fakeBrowser.storage.local, "get").mockReturnValueOnce(
		new Promise((resolve) => {
			finishLoading = resolve;
		}),
	);
	const store = createMruStore();
	const touched = store.touch(1);
	const removed = store.remove(2);
	finishLoading({ mru: [2, 1] });
	await Promise.all([touched, removed]);
	expect(await store.read()).toEqual([1]);
	expect(await stored()).toEqual([1]);
});

it("survives being recreated, as after a background restart", async () => {
	await createMruStore().touch(1);
	expect(await createMruStore().read()).toEqual([1, 2]);
});

it("keeps working in memory after a failed write", async () => {
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(
		new Error("storage unavailable"),
	);
	const store = createMruStore();
	await store.touch(1);
	expect(await store.read()).toEqual([1, 2]);
	await store.remove(2);
	expect(await store.read()).toEqual([1]);
});

it("returns independent copies", async () => {
	const store = createMruStore();
	const before = await store.read();
	await store.touch(1);
	expect(before).toEqual([2, 1]);
});
