import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing";
import { createSources } from "./sources";

const getTree = vi.fn<() => Promise<Browser.bookmarks.BookmarkTreeNode[]>>();
const searchHistory = vi.fn<() => Promise<Browser.history.HistoryItem[]>>();

beforeEach(() => {
	fakeBrowser.reset();
	vi.restoreAllMocks();
	vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue([
		{ id: 1, windowId: 10, url: "https://one.test/", title: "One" },
		{ id: 2, windowId: 10, url: "https://two.test/", title: "" },
		{ id: 3, windowId: 10, url: fakeBrowser.runtime.getURL("/popup.html") },
	] as Browser.tabs.Tab[]);
	getTree.mockReset().mockResolvedValue([
		{
			id: "root",
			title: "",
			children: [
				{ id: "a", title: "Saved", url: "https://saved.test/", dateAdded: 5 },
				{ id: "q", title: "Recent tags", url: "place:sort=14" },
				{
					id: "folder",
					title: "Folder",
					children: [{ id: "b", title: "", url: "https://nested.test/" }],
				},
			],
		},
	] as Browser.bookmarks.BookmarkTreeNode[]);
	searchHistory
		.mockReset()
		.mockResolvedValue([
			{ id: "h1", title: "Visited", url: "https://visited.test/" },
		]);
	fakeBrowser.bookmarks.getTree = getTree as never;
	fakeBrowser.history.search = searchHistory as never;
});

const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("load", () => {
	it("collects tabs, nested bookmarks and history", async () => {
		const { candidates, warnings } = await createSources().load([2]);
		expect(ids(candidates)).toEqual([
			"tab:1",
			"tab:2",
			"bookmark:a",
			"bookmark:b",
			"history:h1",
		]);
		expect(warnings).toEqual([]);
	});

	it("titles untitled pages with their URL and ranks tabs by MRU position", async () => {
		const { candidates } = await createSources().load([2]);
		expect(candidates[1]).toMatchObject({
			title: "https://two.test/",
			mruRank: 0,
		});
		expect(candidates[0]).toMatchObject({ mruRank: Number.MAX_SAFE_INTEGER });
	});

	it("reports a failed source without hiding the others, and retries it", async () => {
		searchHistory.mockRejectedValueOnce(new Error("permission denied"));
		const sources = createSources();
		const first = await sources.load([]);
		expect(first.warnings).toEqual(["History is unavailable."]);
		expect(first.candidates).toHaveLength(4);
		const second = await sources.load([]);
		expect(second.warnings).toEqual([]);
		expect(searchHistory).toHaveBeenCalledTimes(2);
	});
});

describe("cache", () => {
	it("loads bookmarks and history once", async () => {
		const sources = createSources();
		await sources.load([]);
		await sources.load([]);
		expect(getTree).toHaveBeenCalledOnce();
		expect(searchHistory).toHaveBeenCalledOnce();
	});

	it("reloads bookmarks after they change", async () => {
		const sources = createSources();
		await sources.load([]);
		sources.bookmarksChanged();
		await sources.load([]);
		expect(getTree).toHaveBeenCalledTimes(2);
		expect(searchHistory).toHaveBeenCalledOnce();
	});

	it("moves a revisited page to the front without reloading", async () => {
		const sources = createSources();
		await sources.load([]);
		sources.visited({ id: "h2", url: "https://new.test/", title: "New" });
		sources.visited({ id: "h1", url: "https://visited.test/", title: "Again" });
		const { candidates } = await sources.load([]);
		const history = candidates.filter((c) => c.source === "history");
		expect(history.map((c) => c.title)).toEqual(["Again", "New"]);
		expect(searchHistory).toHaveBeenCalledOnce();
	});

	it("updates titles reported after the visit", async () => {
		const sources = createSources();
		await sources.load([]);
		sources.titleChanged("https://visited.test/", "Renamed");
		const { candidates } = await sources.load([]);
		expect(candidates.at(-1)?.title).toBe("Renamed");
	});

	it("reloads history after visits are removed", async () => {
		const sources = createSources();
		await sources.load([]);
		sources.visitsRemoved();
		await sources.load([]);
		expect(searchHistory).toHaveBeenCalledTimes(2);
	});
});
