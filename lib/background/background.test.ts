import { beforeEach, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing";
// Lives here because WXT treats every file in entrypoints/ as an entrypoint.
import background from "@/entrypoints/background";
import type { Reply, Snapshot } from "@/lib/messages";
import { displayMode } from "@/lib/settings";

/** A stand-in for event APIs the fake browser doesn't implement. */
function fakeEvent() {
	const listeners: ((...args: never[]) => unknown)[] = [];
	return {
		addListener: (listener: (...args: never[]) => unknown) => {
			listeners.push(listener);
		},
		trigger: (...args: unknown[]) => {
			for (const listener of listeners) listener(...(args as never[]));
		},
	};
}

let command: ReturnType<typeof fakeEvent>;
let bookmarkCreated: ReturnType<typeof fakeEvent>;
const getTree = vi.fn();
const openPopup = vi.fn();

const tabs = [
	{ id: 1, windowId: 10, url: "https://one.test/", title: "One" },
	{ id: 2, windowId: 10, url: "https://two.test/", title: "Two" },
] as Browser.tabs.Tab[];

const ownSender = { id: fakeBrowser.runtime.id, tab: tabs[0] };

/** Deliver a message to the background the way the browser would, and wait for the reply. */
function send<T>(
	message: unknown,
	sender: Browser.runtime.MessageSender = ownSender,
) {
	const onMessage = fakeBrowser.runtime.onMessage as unknown as {
		trigger(...args: unknown[]): Promise<unknown[]>;
	};
	return new Promise<Reply<T> | undefined>((resolve) => {
		// A listener returns true when it will reply through the callback; anything else is no reply.
		void onMessage.trigger(message, sender, resolve).then(([keptOpen]) => {
			if (keptOpen !== true) resolve(undefined);
		});
	});
}

beforeEach(async () => {
	fakeBrowser.reset();
	vi.restoreAllMocks();
	command = fakeEvent();
	bookmarkCreated = fakeEvent();
	getTree
		.mockReset()
		.mockResolvedValue([
			{ id: "a", title: "Saved", url: "https://saved.test/" },
		]);
	openPopup.mockReset().mockResolvedValue(undefined);

	Object.assign(fakeBrowser.commands, { onCommand: command });
	Object.assign(fakeBrowser.bookmarks, {
		getTree,
		onCreated: bookmarkCreated,
		onRemoved: fakeEvent(),
		onChanged: fakeEvent(),
	});
	Object.assign(fakeBrowser.history, {
		search: vi.fn(async () => [
			{ id: "h", title: "Visited", url: "https://visited.test/" },
		]),
		onVisited: fakeEvent(),
		onVisitRemoved: fakeEvent(),
		onTitleChanged: fakeEvent(),
	});
	Object.assign(fakeBrowser.theme, {
		getCurrent: vi.fn(async () => ({ colors: { popup: "#123456" } })),
	});
	fakeBrowser.action.openPopup = openPopup;
	fakeBrowser.browserAction.openPopup = openPopup;
	vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue(tabs);
	vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({
		id: 3,
	} as Browser.tabs.Tab);

	background.main();
});

it("answers a snapshot with every source and the Firefox theme", async () => {
	const reply = await send<Snapshot>({ type: "snapshot" });
	expect(reply?.ok).toBe(true);
	if (!reply?.ok) return;
	expect(reply.value.candidates.map((c) => c.source)).toEqual([
		"tab",
		"tab",
		"bookmark",
		"history",
	]);
	expect(reply.value.theme["--bs-bg"]).toBe("#123456");
});

it("ignores messages from other extensions and malformed requests", async () => {
	expect(
		await send({ type: "snapshot" }, { ...ownSender, id: "other" }),
	).toBeUndefined();
	expect(await send({ type: "activate", target: {} })).toBeUndefined();
});

it("refuses to open executable URLs", async () => {
	const reply = await send({
		type: "activate",
		target: { kind: "url", url: "javascript:alert(1)" },
	});
	expect(reply).toEqual({
		ok: false,
		error: "This address cannot be opened by BrowserScope.",
	});
	expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
});

it("opens URLs in the sender's window", async () => {
	await send({
		type: "activate",
		target: { kind: "url", url: "https://saved.test/" },
	});
	expect(fakeBrowser.tabs.create).toHaveBeenCalledWith({
		url: "https://saved.test/",
		windowId: 10,
		active: true,
	});
});

it("reloads bookmarks when one is created", async () => {
	await send({ type: "snapshot" });
	await send({ type: "snapshot" });
	expect(getTree).toHaveBeenCalledOnce();
	bookmarkCreated.trigger();
	await send({ type: "snapshot" });
	expect(getTree).toHaveBeenCalledTimes(2);
});

it("shows the overlay once the tab's content script is ready", async () => {
	vi.useFakeTimers({ toFake: ["Date"] });
	const sendToTab = vi.fn(async () => undefined);
	fakeBrowser.tabs.sendMessage = sendToTab as never;
	await displayMode.setValue("overlay");

	command.trigger("launch", tabs[1]);
	expect(openPopup).toHaveBeenCalledOnce();

	await send({ type: "overlayReady" }, { ...ownSender, tab: tabs[1] });
	vi.setSystemTime(Date.now() + 1000); // not a double tap
	command.trigger("launch", tabs[1]);
	expect(sendToTab).toHaveBeenCalledWith(2, { type: "toggleOverlay" });
	vi.useRealTimers();
});
