import { beforeEach, expect, it, vi } from "vitest";
import type { Snapshot } from "./messages";

const { api, listeners, state } = vi.hoisted(() => {
	const listeners: Record<string, (...args: unknown[]) => unknown> = {};
	const event = (name: string) => ({
		addListener: vi.fn((listener) => {
			listeners[name] = listener;
		}),
	});
	const state = {
		active: 1,
		failOverlay: false,
		tabs: [
			{
				id: 1,
				windowId: 10,
				url: "https://one.test",
				title: "One",
				lastAccessed: 2,
			},
			{
				id: 2,
				windowId: 20,
				url: "https://two.test",
				title: "Two",
				lastAccessed: 1,
			},
		],
	};
	const api = {
		storage: {
			local: {
				get: vi.fn(async () => ({ mru: [1, 2] })),
				set: vi.fn(async () => {}),
			},
		},
		tabs: {
			query: vi.fn(async (query: { active?: boolean }) =>
				query.active
					? state.tabs.filter((tab) => tab.id === state.active)
					: state.tabs,
			),
			update: vi.fn(async (id: number) => {
				state.active = id;
				return state.tabs.find((tab) => tab.id === id);
			}),
			create: vi.fn(async () => ({ id: 3, windowId: 10 })),
			sendMessage: vi.fn(async () => {
				if (state.failOverlay) throw new Error("restricted");
				return true;
			}),
			onActivated: event("activated"),
			onRemoved: event("tabRemoved"),
		},
		windows: {
			onFocusChanged: event("focused"),
			onRemoved: event("windowRemoved"),
			update: vi.fn(async () => ({})),
			remove: vi.fn(async () => {}),
			getLastFocused: vi.fn(async () => ({ id: 10, width: 1200, height: 900 })),
			getAll: vi.fn(async () => [
				{ id: 10, type: "normal" },
				{ id: 20, type: "normal" },
			]),
			create: vi.fn(async () => {
				state.active = 99;
				state.tabs.push({
					id: 99,
					windowId: 99,
					url: "moz-extension://scope/finder.html",
					title: "Finder",
					lastAccessed: 3,
				});
				return { id: 99 };
			}),
		},
		bookmarks: {
			getTree: vi.fn(async () => [
				{
					children: [{ id: "a", title: "Bookmark", url: "https://saved.test" }],
				},
			]),
		},
		history: {
			search: vi.fn(async () => [
				{ id: "h", title: "History", url: "https://history.test" },
			]),
		},
		search: { query: vi.fn(async () => {}), search: vi.fn(async () => {}) },
		theme: {
			getCurrent: vi.fn(async () => ({ colors: { popup: "#123456" } })),
		},
		commands: { onCommand: event("command") },
		browserAction: { onClicked: event("clicked") },
		runtime: {
			id: "scope",
			getURL: (path: string) => `moz-extension://scope${path}`,
			onMessage: event("message"),
		},
	};
	return { api, listeners, state };
});
vi.mock("wxt/browser", () => ({ browser: api }));
const sender = { id: "scope", tab: { id: 1, windowId: 10 } };
async function send(message: unknown, from = sender) {
	return listeners.message(message, from) as Promise<{
		ok: boolean;
		value: Snapshot;
	}>;
}
beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	state.active = 1;
	state.failOverlay = false;
	state.tabs = state.tabs.filter((tab) => tab.id !== 99);
	api.history.search.mockResolvedValue([
		{ id: "h", title: "History", url: "https://history.test" },
	]);
	vi.stubGlobal("defineBackground", (main: () => void) => main);
	const { default: main } = await import("../entrypoints/background");
	(main as unknown as () => void)();
});
it("collects nested bookmarks and all sources with Firefox theme colors", async () => {
	vi.stubEnv("FIREFOX", "true");
	const reply = await send({ type: "snapshot" });
	expect(reply.ok).toBe(true);
	expect(
		reply.value.candidates.map((item: { source: string }) => item.source),
	).toEqual(["tab", "tab", "bookmark", "history"]);
	expect(reply.value.theme["--surface"]).toBe("#123456");
});
it("preserves tabs and bookmarks when history access fails", async () => {
	api.history.search.mockRejectedValueOnce(new Error("permission denied"));
	const reply = await send({ type: "snapshot" });
	expect(reply.ok).toBe(true);
	expect(reply.value.candidates).toHaveLength(3);
	expect(reply.value.warnings).toEqual(["History is unavailable."]);
});
it("focuses both the selected tab and its window", async () => {
	expect(
		(await send({ type: "activate", result: { source: "tab", tabId: 2 } })).ok,
	).toBe(true);
	expect(api.tabs.update).toHaveBeenCalledWith(2, { active: true });
	expect(api.windows.update).toHaveBeenCalledWith(20, { focused: true });
});
it("returns actionable errors for closed tabs and rejects executable URLs", async () => {
	expect(
		(await send({ type: "activate", result: { source: "tab", tabId: 500 } }))
			.ok,
	).toBe(false);
	expect(
		(
			await send({
				type: "activate",
				result: { source: "bookmark", url: "javascript:alert(1)" },
			})
		).ok,
	).toBe(false);
	expect(api.tabs.create).not.toHaveBeenCalled();
});
it("routes raw queries through the appropriate browser search API", async () => {
	await send({ type: "search", query: "raw query" });
	expect(api.search.query).toHaveBeenCalledWith({
		text: "raw query",
		tabId: 3,
	});
	vi.stubEnv("FIREFOX", "true");
	await send({ type: "search", query: "firefox query" });
	expect(api.search.search).toHaveBeenCalledWith({
		query: "firefox query",
		tabId: 3,
	});
});
it("double-taps switch back even when the first tap opens a fallback window", async () => {
	state.failOverlay = true;
	listeners.command("launch-finder");
	listeners.command("launch-finder");
	await vi.waitFor(() =>
		expect(api.tabs.update).toHaveBeenCalledWith(2, { active: true }),
	);
	expect(api.windows.remove).toHaveBeenCalledWith(99);
});
it("tracks recent activations and ignores messages from other extensions", async () => {
	listeners.activated({ tabId: 2 });
	const reply = await send({ type: "snapshot" });
	const tabs = reply.value.candidates.filter(
		(item: { source: string }) => item.source === "tab",
	);
	expect(tabs[1].lastAccessed).toBeGreaterThan(tabs[0].lastAccessed);
	expect(
		await send({ type: "snapshot" }, { ...sender, id: "other" }),
	).toBeUndefined();
});
