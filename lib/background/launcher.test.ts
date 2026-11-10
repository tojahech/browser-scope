import { beforeEach, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing";
import { type DisplayMode, DOUBLE_TAP_MS } from "../config";
import { createLauncher } from "./launcher";
import type { MruStore } from "./mru";

let time = 0;
let mode: DisplayMode = "overlay";
const recent = [1, 2, 3];
const mru = {
	read: async () => recent,
	touch: vi.fn(),
	remove: vi.fn(),
} as unknown as MruStore;

const openPopup = vi.fn();
const sendToTab = vi.fn();
const tab = { id: 1, windowId: 10 } as Browser.tabs.Tab;

beforeEach(() => {
	fakeBrowser.reset();
	vi.restoreAllMocks();
	time = 10_000;
	mode = "overlay";
	openPopup.mockReset().mockResolvedValue(undefined);
	sendToTab.mockReset().mockResolvedValue(undefined);
	// The fake has both `action` (MV3) and `browserAction` (Firefox MV2); either may be used.
	fakeBrowser.action.openPopup = openPopup;
	fakeBrowser.browserAction.openPopup = openPopup;
	fakeBrowser.tabs.sendMessage = sendToTab as never;
	vi.spyOn(fakeBrowser.runtime, "sendMessage").mockResolvedValue(undefined);
	vi.spyOn(fakeBrowser.tabs, "update").mockImplementation(
		async (id: unknown) => ({ id, windowId: 10 }) as Browser.tabs.Tab,
	);
	vi.spyOn(fakeBrowser.windows, "update").mockResolvedValue(
		{} as Browser.windows.Window,
	);
});

function launcher() {
	return createLauncher({ mru, displayMode: () => mode, now: () => time });
}

it("opens the overlay in a tab whose content script is ready", () => {
	const l = launcher();
	l.overlayReady(1);
	l.launch(tab);
	expect(sendToTab).toHaveBeenCalledWith(1, { type: "toggleOverlay" });
	expect(openPopup).not.toHaveBeenCalled();
});

it("opens the popup synchronously when the overlay isn't available", () => {
	const l = launcher();
	l.launch(tab);
	// Called before any await, as Firefox requires.
	expect(openPopup).toHaveBeenCalledOnce();
	expect(sendToTab).not.toHaveBeenCalled();
});

it("opens the popup when popup mode is chosen", () => {
	mode = "popup";
	const l = launcher();
	l.overlayReady(1);
	l.launch(tab);
	expect(openPopup).toHaveBeenCalledOnce();
});

it("forgets a tab after it navigates or closes", () => {
	const l = launcher();
	l.overlayReady(1);
	l.forgetTab(1);
	l.launch(tab);
	expect(openPopup).toHaveBeenCalledOnce();
});

it("falls back to the popup if the overlay doesn't answer", async () => {
	sendToTab.mockRejectedValueOnce(new Error("no receiver"));
	const l = launcher();
	l.overlayReady(1);
	l.launch(tab);
	await vi.waitFor(() => expect(openPopup).toHaveBeenCalledOnce());
	time += 1000;
	l.launch(tab);
	expect(openPopup).toHaveBeenCalledTimes(2);
});

it("switches to the previous tab on a double tap and closes the finder", async () => {
	const l = launcher();
	l.launch(tab);
	time += DOUBLE_TAP_MS - 1;
	l.launch(tab);
	expect(sendToTab).toHaveBeenCalledWith(1, { type: "closeUi" });
	expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({
		type: "closeUi",
	});
	await vi.waitFor(() =>
		expect(fakeBrowser.tabs.update).toHaveBeenCalledWith(2, { active: true }),
	);
});

it("skips closed tabs when switching back", async () => {
	vi.mocked(fakeBrowser.tabs.update).mockRejectedValueOnce(new Error("closed"));
	const l = launcher();
	l.launch(tab);
	l.launch(tab);
	await vi.waitFor(() =>
		expect(fakeBrowser.tabs.update).toHaveBeenLastCalledWith(3, {
			active: true,
		}),
	);
	expect(mru.remove).toHaveBeenCalledWith(2);
});

it("treats slow presses, and a third quick press, as separate launches", () => {
	const l = launcher();
	l.launch(tab);
	time += DOUBLE_TAP_MS;
	l.launch(tab);
	expect(openPopup).toHaveBeenCalledTimes(2);
	time += 1;
	l.launch(tab); // double tap
	time += 1;
	l.launch(tab); // starts afresh
	expect(openPopup).toHaveBeenCalledTimes(3);
});
